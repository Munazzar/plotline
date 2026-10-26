package com.munazzar.plotline;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import java.util.Calendar;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/* Steps by hour from the phone's own step counter (1.56), for step apps like Samsung Health that give Health Connect
   one record for the whole day. Every ~15 minutes (an inexact alarm, so no special permission; Android may stretch it
   while the phone sleeps, when there are no steps anyway) the counter is read and kept as "time:value;" for 11 days.
   The alarm goes to Auto with its A_TICK action, which already reads the counter for step goals; Auto$3 calls tick()
   right after (a one-line smali patch, see HANDOVER). Needs "Physical activity" (ACTIVITY_RECOGNITION).
   hours(days) turns the readings into steps per hour: the steps between two readings are spread over that time, split
   at each hour; a counter that went down means the phone restarted. Result: {"perm":true,"days":{"2026-10-25":{"7":512}}}. */
public class StepHours {
    static final String PREF = "plotline_steph", ACT = "com.munazzar.plotline.A_TICK";
    static final int RC = 612;
    static final long KEEP = 11L * 86400000L;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, 0); }

    static boolean perm(Context c) {
        return Build.VERSION.SDK_INT < 29 || c.checkSelfPermission("android.permission.ACTIVITY_RECOGNITION") == PackageManager.PERMISSION_GRANTED;
    }

    static void arm(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            Intent i = new Intent(c, Auto.class).setAction(ACT);
            int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(c, RC, i, fl);
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 15L * 60000L, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi);
        } catch (Exception e) { }
    }

    /* one reading of the counter, kept with its time */
    static synchronized void tick(Context c) {
        try {
            if (!perm(c)) return;
            SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
            Sensor s = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (s == null) return;
            final float[] v = {-1f};
            final CountDownLatch l = new CountDownLatch(1);
            SensorEventListener li = new SensorEventListener() {
                public void onSensorChanged(SensorEvent e) { v[0] = e.values[0]; l.countDown(); }
                public void onAccuracyChanged(Sensor x, int a) { }
            };
            sm.registerListener(li, s, SensorManager.SENSOR_DELAY_NORMAL);
            try { l.await(6, TimeUnit.SECONDS); } catch (InterruptedException e) { }
            sm.unregisterListener(li);
            if (v[0] < 0) return;
            long now = System.currentTimeMillis();
            String old = prefs(c).getString("s", ""), keep = trim(old, now - KEEP);
            prefs(c).edit().putString("s", keep + now + ":" + (long) v[0] + ";").apply();
        } catch (Exception e) { }
    }

    static String trim(String s, long from) {
        int i = 0;
        while (i < s.length()) {
            int c = s.indexOf(':', i), e = s.indexOf(';', i);
            if (c < 0 || e < 0) return "";
            try { if (Long.parseLong(s.substring(i, c)) >= from) return s.substring(i); } catch (Exception x) { }
            i = e + 1;
        }
        return "";
    }

    static String day(long t) {
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(t);
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    static long nextHour(long t) {
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(t);
        k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        return k.getTimeInMillis() + 3600000L;
    }

    static String hours(Context c, int days) {
        JSONObject out = new JSONObject();
        try {
            out.put("perm", perm(c));
            String[] p = prefs(c).getString("s", "").split(";");
            long from = System.currentTimeMillis() - Math.max(1, Math.min(days, 11)) * 86400000L;
            JSONObject D = new JSONObject();
            long pt = -1, pv = -1;
            for (String x : p) {
                int k = x.indexOf(':');
                if (k < 0) continue;
                long t, v;
                try { t = Long.parseLong(x.substring(0, k)); v = Long.parseLong(x.substring(k + 1)); } catch (Exception e) { continue; }
                if (pt >= 0 && t > pt) {
                    long d = v >= pv ? v - pv : v; /* the counter starts again after a restart */
                    if (d > 0 && t > from) {
                        /* spread over the time since the last reading, split at hours; a long gap (phone off, no
                           readings) keeps its steps in the last 2 hours rather than smearing them over the night */
                        long s = Math.max(pt, t - 2L * 3600000L), span = t - s;
                        while (s < t) {
                            long e = Math.min(t, nextHour(s));
                            double part = d * (double) (e - s) / span;
                            String dy = day(s); Calendar kk = Calendar.getInstance(); kk.setTimeInMillis(s);
                            String h = String.valueOf(kk.get(Calendar.HOUR_OF_DAY));
                            JSONObject o = D.optJSONObject(dy); if (o == null) { o = new JSONObject(); D.put(dy, o); }
                            o.put(h, o.optDouble(h, 0) + part);
                            s = e;
                        }
                    }
                }
                pt = t; pv = v;
            }
            out.put("days", D);
            out.put("n", p.length);
            /* when the kept readings begin: hours before it weren't measured (1.56.1) */
            int k0 = p.length > 0 ? p[0].indexOf(':') : -1;
            if (k0 > 0) try { out.put("from", Long.parseLong(p[0].substring(0, k0))); } catch (Exception e) { }
        } catch (Exception e) {
            try { out.put("err", String.valueOf(e)); } catch (Exception x) { }
        }
        return out.toString();
    }
}
