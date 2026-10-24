package com.munazzar.plotline;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

/* Screen time hour by hour, from Android's own usage timeline (the one Digital Wellbeing reads).
   Usage access must be granted; Android keeps the event timeline for about a week, so the app stores what it reads.
   An app counts from when one of its screens comes to the front until it leaves, the screen goes off or the phone
   locks, split at each hour. The home screen and the system UI don't count. Unlocks are counted per hour too.
   Result: {"perm":true,"days":{"2026-10-24":{"h":{"9":{"com.instagram.android":12.5}},"u":{"9":3}}},
            "labels":{"com.instagram.android":"Instagram"}} with minutes per app per hour. */
public class UsageHours {
    static final int RESUMED = 1, PAUSED = 2, SCREEN_OFF = 16, LOCKED = 17, UNLOCKED = 18;

    static boolean allowed(Context c) {
        try {
            AppOpsManager ao = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
            int m = Build.VERSION.SDK_INT >= 29
                ? ao.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
                : ao.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
            return m == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) { return false; }
    }

    static String day(long t) {
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(t);
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    static long hourStart(long t) {
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(t);
        k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        return k.getTimeInMillis();
    }

    static int hour(long t) { Calendar k = Calendar.getInstance(); k.setTimeInMillis(t); return k.get(Calendar.HOUR_OF_DAY); }

    /* day -> hour -> package -> milliseconds */
    static final Map<String, Map<Integer, Map<String, Long>>> ms = new HashMap<String, Map<Integer, Map<String, Long>>>();

    static void add(String pkg, long s, long e, long from) {
        if (pkg == null || e <= s) return;
        if (s < from) s = from;
        while (s < e) {
            long hs = hourStart(s), he = hs + 3600000L, x = Math.min(e, he);
            String d = day(s); int h = hour(s);
            Map<Integer, Map<String, Long>> D = ms.get(d); if (D == null) { D = new HashMap<Integer, Map<String, Long>>(); ms.put(d, D); }
            Map<String, Long> H = D.get(h); if (H == null) { H = new HashMap<String, Long>(); D.put(h, H); }
            Long o = H.get(pkg); H.put(pkg, (o == null ? 0L : o) + (x - s));
            s = x;
        }
    }

    static synchronized String json(Context c, int days) {
        JSONObject out = new JSONObject();
        try {
            if (!allowed(c)) { out.put("perm", false); return out.toString(); }
            out.put("perm", true);
            days = Math.max(1, Math.min(days, 10));
            Calendar k = Calendar.getInstance();
            k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
            k.add(Calendar.DAY_OF_MONTH, -(days - 1));
            long from = k.getTimeInMillis(), now = System.currentTimeMillis();

            /* like Digital Wellbeing, only apps you can open from the app drawer count: that leaves out the home screen,
               the system UI and background parts (and needs no extra permission to see other apps) */
            PackageManager pm0 = c.getPackageManager();
            Map<String, Boolean> opens = new HashMap<String, Boolean>();

            UsageStatsManager um = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
            /* start a few hours early so an app already open at midnight is counted from midnight */
            UsageEvents ev = um.queryEvents(from - 3 * 3600000L, now);
            UsageEvents.Event e = new UsageEvents.Event();
            Map<String, Map<Integer, Integer>> unl = new HashMap<String, Map<Integer, Integer>>();
            ms.clear();
            String cur = null; long st = 0;
            while (ev.hasNextEvent()) {
                ev.getNextEvent(e);
                int t = e.getEventType(); long at = e.getTimeStamp(); String p = e.getPackageName();
                if (t == RESUMED) {
                    Boolean op = opens.get(p);
                    if (op == null) { try { op = pm0.getLaunchIntentForPackage(p) != null; } catch (Exception x) { op = false; } opens.put(p, op); }
                    if (!op) { if (cur != null) add(cur, st, at, from); cur = null; continue; }
                    if (p.equals(cur)) continue;
                    if (cur != null) add(cur, st, at, from);
                    cur = p; st = at;
                } else if (t == PAUSED) {
                    if (p.equals(cur)) { add(cur, st, at, from); cur = null; }
                } else if (t == SCREEN_OFF || t == LOCKED) {
                    if (cur != null) { add(cur, st, at, from); cur = null; }
                } else if (t == UNLOCKED && at >= from) {
                    String d = day(at); int h = hour(at);
                    Map<Integer, Integer> U = unl.get(d); if (U == null) { U = new HashMap<Integer, Integer>(); unl.put(d, U); }
                    Integer o = U.get(h); U.put(h, (o == null ? 0 : o) + 1);
                }
            }
            if (cur != null) add(cur, st, now, from);

            JSONObject D = new JSONObject(), L = new JSONObject();
            PackageManager pm = c.getPackageManager();
            Set<String> ds = new HashSet<String>(ms.keySet()); ds.addAll(unl.keySet());
            for (String d : ds) {
                JSONObject o = new JSONObject(), hh = new JSONObject(), uu = new JSONObject();
                Map<Integer, Map<String, Long>> M = ms.get(d);
                if (M != null) for (Map.Entry<Integer, Map<String, Long>> h : M.entrySet()) {
                    JSONObject a = new JSONObject();
                    for (Map.Entry<String, Long> x : h.getValue().entrySet()) {
                        double min = Math.round(x.getValue() / 6000.0) / 10.0;
                        if (min < 0.1) continue;
                        a.put(x.getKey(), min);
                        if (!L.has(x.getKey())) {
                            String lab = x.getKey();
                            try { ApplicationInfo ai = pm.getApplicationInfo(x.getKey(), 0); lab = String.valueOf(pm.getApplicationLabel(ai)); } catch (Exception ex) { }
                            L.put(x.getKey(), lab);
                        }
                    }
                    if (a.length() > 0) hh.put(String.valueOf(h.getKey()), a);
                }
                Map<Integer, Integer> U = unl.get(d);
                if (U != null) for (Map.Entry<Integer, Integer> u : U.entrySet()) uu.put(String.valueOf(u.getKey()), u.getValue());
                o.put("h", hh); o.put("u", uu);
                D.put(d, o);
            }
            out.put("days", D); out.put("labels", L);
        } catch (Exception ex) {
            try { out.put("err", String.valueOf(ex)); } catch (Exception e2) { }
        }
        return out.toString();
    }
}
