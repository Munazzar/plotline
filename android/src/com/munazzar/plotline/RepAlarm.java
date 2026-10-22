package com.munazzar.plotline;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/* Repeating reminders ("every 2 minutes tomorrow"). The app sends only the next time of each repeat, with rpm (ms between
   them) and end (the last allowed time), so one reminder takes one of the 60 alarm slots however often it repeats.
   AlarmReceiver calls next() right after showing the notification: it arms the following time in the same slot and moves
   the saved list along, so a reboot (Reminders.rearm) picks up from there. The app recomputes all of it on its next sync. */
public class RepAlarm {
    static void next(Context c, JSONObject o, int id) {
        try {
            long rp = o.optLong("rpm", 0);
            if (rp < 60000L) return;
            long end = o.optLong("end", 0), at = o.optLong("at", 0), now = System.currentTimeMillis();
            long nx = at + rp;
            while (nx <= now) nx += rp;
            if (end > 0 && nx > end) return;
            JSONObject n = new JSONObject(o.toString());
            n.put("at", nx);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = Reminders.pending(c, id, n);
            boolean exact = Build.VERSION.SDK_INT < 31 || Reminders.canExact(am);
            try {
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nx, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nx, pi);
            } catch (SecurityException e) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nx, pi);
            }
            save(c, o, nx);
        } catch (Exception e) {
        }
    }

    /* the saved list: the entry that just rang now holds its next time */
    static void save(Context c, JSONObject o, long nx) {
        synchronized (Reminders.class) {
            try {
                SharedPreferences p = c.getSharedPreferences(Reminders.PREF, 0);
                JSONArray a = new JSONArray(p.getString("list", "[]"));
                String id = o.optString("id"), k = o.optString("k");
                long at = o.optLong("at", 0);
                for (int i = 0; i < a.length(); i++) {
                    JSONObject x = a.getJSONObject(i);
                    if (k.equals(x.optString("k")) && id.equals(x.optString("id")) && x.optLong("at", 0) == at) {
                        x.put("at", nx);
                        p.edit().putString("list", a.toString()).apply();
                        return;
                    }
                }
            } catch (Exception e) {
            }
        }
    }
}
