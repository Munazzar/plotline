package com.munazzar.plotline;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.telecom.TelecomManager;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.text.DateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/* Blocks (1.71.0): app limits, focus sessions, schedules and a whole-phone limit that actually stop you.
   The app (blocks.js) sends the rules with PlotlineAssist.blockSet(json):
     {"rules":[{"id","kind":"limit"|"sched"|"total","on",apps:[pkg],"all","min","from":"22:00","to":"07:00",
                "days":[0..6, empty = every day],"fr":"hard"|"once"|"wait"|"type","more":5,"name"}],
      "focus":{"id","start","until","apps":[pkg],"all","lock","fr","more","name"} or null,
      "allow":[pkg never blocked]}
   While any rule is on (or a focus session runs) this foreground service watches which app is in front, from
   Android's usage timeline (Usage access, which Screen time already asks for), every ~1.2 s while the screen is on.
   When the app in front is blocked, a full-screen Plotlines screen covers it ("Display over other apps"): close
   the app, or get past it the way the rule allows (once a day 5 more minutes, wait 20 s, or type a sentence).
   Minutes are counted like UsageHours: from an app's screen coming to the front until it leaves or the screen
   goes off, only for apps you can open from the app drawer. The home screen, the phone app, Settings, the system
   UI and Plotlines itself are never blocked. Restarted by the app, and by StepHours.tick after a reboot. */
public class Blocker extends Service {
    static final String PREF = "plotline_block", CH = "blocks";
    static final int NID = 7301, TICK = 1200, ACCENT = 0xFFFFB547;
    static volatile Blocker me;

    /* ---------------- rules, kept in SharedPreferences ---------------- */
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, 0); }
    static JSONObject cfg(Context c) { try { return new JSONObject(prefs(c).getString("cfg", "{}")); } catch (Exception e) { return new JSONObject(); } }
    static JSONObject obj(Context c, String k) { try { return new JSONObject(prefs(c).getString(k, "{}")); } catch (Exception e) { return new JSONObject(); } }
    static void put(Context c, String k, JSONObject o) { prefs(c).edit().putString(k, o.toString()).apply(); }

    static void set(Context c, String json) {
        try { new JSONObject(json); } catch (Exception e) { return; }
        prefs(c).edit().putString("cfg", json).apply();
        ensure(c);
        Blocker b = me;
        if (b != null) b.poke();
    }

    /* anything that needs watching right now? */
    static boolean wanted(JSONObject o, long now) {
        JSONObject f = o.optJSONObject("focus");
        if (f != null && f.optLong("until") > now) return true;
        JSONArray r = o.optJSONArray("rules");
        if (r != null) for (int i = 0; i < r.length(); i++) { JSONObject x = r.optJSONObject(i); if (x != null && x.optBoolean("on", true)) return true; }
        return false;
    }

    static boolean overlayOk(Context c) { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c); }
    static boolean ready(Context c) { return UsageHours.allowed(c) && overlayOk(c); }

    /* start or stop the service to match the rules and the permissions */
    static void ensure(Context c) {
        Context a = c.getApplicationContext();
        boolean want = wanted(cfg(a), System.currentTimeMillis()) && ready(a);
        Blocker b = me;
        if (want && b == null) {
            try {
                Intent i = new Intent(a, Blocker.class);
                if (Build.VERSION.SDK_INT >= 26) a.startForegroundService(i); else a.startService(i);
            } catch (Exception e) { }
        } else if (!want && b != null) {
            b.quit();
        }
    }

    /* ---------------- the service ---------------- */
    HandlerThread ht;
    Handler bg;
    final Handler ui = new Handler(Looper.getMainLooper());
    boolean screen = true, ticking;
    String fg;               /* the app in front */
    long lastQ;              /* end of the last usage-events read */
    Map<String, Long> used = new HashMap<String, Long>();
    long usedAt;             /* when `used` was read */
    String usedFg; long usedFgAt;
    Set<String> never = new HashSet<String>();
    long neverAt;
    String note = "";
    Shield shield;           /* the block screen, when it's up */

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        me = this;
        channel(this);
        Notification n = notif(this, "Blocks are on");
        if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC); else startForeground(NID, n);
        ht = new HandlerThread("plotline-blocks");
        ht.start();
        bg = new Handler(ht.getLooper());
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_ON); f.addAction(Intent.ACTION_SCREEN_OFF); f.addAction(Intent.ACTION_USER_PRESENT);
        registerReceiver(scr, f);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        screen = pm == null || pm.isInteractive();
        lastQ = System.currentTimeMillis() - 6 * 3600000L;
        loop();
    }

    @Override public int onStartCommand(Intent i, int flags, int id) { poke(); return START_STICKY; }

    @Override
    public void onDestroy() {
        me = null;
        try { unregisterReceiver(scr); } catch (Exception e) { }
        ticking = false;
        if (bg != null) bg.removeCallbacksAndMessages(null);
        if (ht != null) ht.quitSafely();
        ui.post(new Runnable() { public void run() { hideNow(); } });
        super.onDestroy();
    }

    /* stop, unless new rules arrived in the meantime (ensure() sees this instance until onDestroy and won't start another) */
    void quit() {
        ui.post(new Runnable() { public void run() {
            if (wanted(cfg(Blocker.this), System.currentTimeMillis()) && ready(Blocker.this)) { loop(); return; }
            hideNow(); stopForeground(true); stopSelf();
        } });
    }

    final BroadcastReceiver scr = new BroadcastReceiver() {
        public void onReceive(Context c, Intent i) {
            String a = i.getAction();
            if (Intent.ACTION_SCREEN_OFF.equals(a)) { screen = false; fg = null; ui.post(new Runnable() { public void run() { hideNow(); } }); }
            else { screen = true; loop(); }
        }
    };

    /* a rule changed or the app asked: check right away */
    void poke() { usedAt = 0; neverAt = 0; loop(); }

    final Runnable tick = new Runnable() {
        public void run() {
            try { step(); } catch (Throwable e) { }
            if (ticking && screen) bg.postDelayed(this, TICK); else ticking = false;
        }
    };

    void loop() {
        if (bg == null) return;
        bg.removeCallbacks(tick);
        ticking = true;
        bg.post(tick);
    }

    /* one look: who is in front, is it blocked, keep the screen and the notification right */
    void step() {
        long now = System.currentTimeMillis();
        JSONObject o = cfg(this);
        if (!wanted(o, now)) { finishFocus(o, now); quit(); return; }
        if (!ready(this)) { ui.post(new Runnable() { public void run() { hideNow(); } }); setNote("Blocks need Usage access and Display over other apps"); return; }
        finishFocus(o, now);
        readFg(now);
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        final Hit h = (km != null && km.isKeyguardLocked()) ? null : find(this, o, fg, now, usedNow(now, o));
        final String p = fg;
        ui.post(new Runnable() { public void run() { if (h == null) hideNow(); else show(p, h); } });
        setNote(summary(o, now));
    }

    /* the app in front, from the usage timeline since the last look */
    void readFg(long now) {
        UsageStatsManager um = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        if (um == null) return;
        UsageEvents ev = um.queryEvents(lastQ - 2000, now);
        UsageEvents.Event e = new UsageEvents.Event();
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            int t = e.getEventType();
            if (t == UsageHours.RESUMED) fg = e.getPackageName();
            else if (t == UsageHours.SCREEN_OFF || t == UsageHours.LOCKED) fg = null;
        }
        lastQ = now;
    }

    /* minutes used today per app (ms), read every 10 s; the app in front gets the time since then added */
    Map<String, Long> usedNow(long now, JSONObject o) {
        if (now - usedAt > 10000 || !sameDay(usedAt, now)) { used = today(this, now); usedAt = now; usedFg = fg; usedFgAt = now; }
        if (fg == null || !fg.equals(usedFg)) { usedFg = fg; usedFgAt = now; }
        Map<String, Long> m = new HashMap<String, Long>(used);
        if (fg != null && opens(this, fg)) { Long v = m.get(fg); m.put(fg, (v == null ? 0L : v) + Math.max(0, now - usedFgAt)); }
        return m;
    }

    /* a focus session that just ended: tell the person once */
    void finishFocus(JSONObject o, long now) {
        JSONObject f = o.optJSONObject("focus");
        if (f == null) return;
        long until = f.optLong("until"), start = f.optLong("start");
        if (until <= 0 || until > now) return;
        SharedPreferences p = prefs(this);
        if (p.getLong("fdone", 0) == until) return;
        p.edit().putLong("fdone", until).apply();
        if (now - until > 3600000L) return;
        long min = Math.max(1, Math.round((until - start) / 60000.0));
        log(this, "", "focus", "fd", min);
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "blocks_done") : new Notification.Builder(this);
            b.setSmallIcon(W.id(this, "ic_stat", "drawable")).setColor(ACCENT).setContentTitle("Focus done")
                .setContentText(min + " minutes of focus. Your apps are open again.").setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(this, 7303, Assist.open(this, "blocks"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            if (nm != null) nm.notify(NID + 1, b.build());
        } catch (Exception x) { }
    }

    /* ---------------- which rule blocks an app ---------------- */
    static final class Hit {
        String id, why, fr, title; int more; long until;
    }

    static Set<String> set(JSONArray a) {
        Set<String> s = new HashSet<String>();
        if (a != null) for (int i = 0; i < a.length(); i++) s.add(a.optString(i));
        return s;
    }

    static int dow(long t) { Calendar k = Calendar.getInstance(); k.setTimeInMillis(t); return k.get(Calendar.DAY_OF_WEEK) - 1; }
    static int minOfDay(long t) { Calendar k = Calendar.getInstance(); k.setTimeInMillis(t); return k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE); }
    static boolean sameDay(long a, long b) { return UsageHours.day(a).equals(UsageHours.day(b)); }
    static boolean dayOn(JSONArray days, int d) {
        if (days == null || days.length() == 0) return true;
        for (int i = 0; i < days.length(); i++) if (days.optInt(i, -1) == d) return true;
        return false;
    }
    static int hm(String s, int def) {
        try { String[] p = s.split(":"); return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim()); } catch (Exception e) { return def; }
    }
    /* is now inside from-to on one of the days? A window past midnight belongs to the day it starts */
    static boolean inWindow(JSONObject r, long now) {
        int a = hm(r.optString("from"), -1), b = hm(r.optString("to"), -1), m = minOfDay(now), d = dow(now);
        if (a < 0 || b < 0 || a == b) return false;
        JSONArray days = r.optJSONArray("days");
        if (a < b) return m >= a && m < b && dayOn(days, d);
        return (m >= a && dayOn(days, d)) || (m < b && dayOn(days, (d + 6) % 7));
    }
    /* when a schedule ends, as a time today or tomorrow */
    static long windowEnd(JSONObject r, long now) {
        int b = hm(r.optString("to"), 0);
        Calendar k = Calendar.getInstance(); k.setTimeInMillis(now);
        k.set(Calendar.HOUR_OF_DAY, b / 60); k.set(Calendar.MINUTE, b % 60); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        if (k.getTimeInMillis() <= now) k.add(Calendar.DAY_OF_MONTH, 1);
        return k.getTimeInMillis();
    }

    static String clock(Context c, long t) { return android.text.format.DateFormat.getTimeFormat(c).format(new Date(t)); }
    static String mn(int n) { return n == 1 ? "1 minute" : n + " minutes"; }
    static String mins(long ms) {
        long m = Math.round(ms / 60000.0);
        if (m < 60) return m + " min";
        long h = m / 60, r = m % 60;
        return r == 0 ? h + " h" : h + " h " + r + " min";
    }

    Set<String> never(long now) {
        if (now - neverAt < 60000 && !never.isEmpty()) return never;
        Set<String> s = new HashSet<String>();
        s.add(getPackageName()); s.add("com.android.systemui"); s.add("com.android.settings"); s.add("com.android.phone");
        s.add("com.google.android.dialer"); s.add("com.android.dialer"); s.add("com.android.emergency"); s.add("com.google.android.permissioncontroller");
        try { TelecomManager tm = (TelecomManager) getSystemService(TELECOM_SERVICE); String d = tm == null ? null : tm.getDefaultDialerPackage(); if (d != null) s.add(d); } catch (Exception e) { }
        try {
            Intent h = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            List<ResolveInfo> L = getPackageManager().queryIntentActivities(h, 0);
            for (ResolveInfo ri : L) s.add(ri.activityInfo.packageName);
        } catch (Exception e) { }
        never = s; neverAt = now;
        return s;
    }

    static final Map<String, Boolean> OPENS = new HashMap<String, Boolean>();
    static boolean opens(Context c, String p) {
        Boolean b = OPENS.get(p);
        if (b == null) { try { b = c.getPackageManager().getLaunchIntentForPackage(p) != null; } catch (Exception e) { b = false; } OPENS.put(p, b); }
        return b;
    }

    /* the first rule that blocks app p right now, or null */
    Hit find(Context c, JSONObject o, String p, long now, Map<String, Long> u) {
        if (p == null || never(now).contains(p) || !opens(c, p)) return null;
        if (set(o.optJSONArray("allow")).contains(p)) return null;
        JSONObject grants = obj(c, "grants");
        JSONObject f = o.optJSONObject("focus");
        if (f != null && f.optLong("until") > now && grants.optLong("focus") <= now) {
            boolean hit = f.optBoolean("all") ? !set(f.optJSONArray("allow")).contains(p) : set(f.optJSONArray("apps")).contains(p);
            if (hit) {
                Hit h = new Hit(); h.id = "focus"; h.until = f.optLong("until");
                h.title = f.optString("name", "").isEmpty() ? "Focus" : f.optString("name");
                h.why = h.title + " until " + clock(c, h.until) + " · " + mins(h.until - now) + " left";
                h.fr = f.optBoolean("lock") ? "lock" : f.optString("fr", "hard"); h.more = f.optInt("more", 5);
                return h;
            }
        }
        JSONArray R = o.optJSONArray("rules");
        if (R == null) return null;
        for (int i = 0; i < R.length(); i++) {
            JSONObject r = R.optJSONObject(i);
            if (r == null || !r.optBoolean("on", true)) continue;
            String id = r.optString("id"), k = r.optString("kind");
            if (grants.optLong(id) > now) continue;
            Set<String> apps = set(r.optJSONArray("apps"));
            boolean all = r.optBoolean("all");
            String name = r.optString("name", "");
            Hit h = null;
            if ("sched".equals(k)) {
                if ((all ? !apps.contains(p) && !set(r.optJSONArray("allow")).contains(p) : apps.contains(p)) && inWindow(r, now)) {
                    h = new Hit(); h.until = windowEnd(r, now);
                    h.why = (name.isEmpty() ? "Blocked" : name) + " until " + clock(c, h.until);
                }
            } else if ("limit".equals(k)) {
                if (apps.contains(p) && dayOn(r.optJSONArray("days"), dow(now))) {
                    long t = 0; for (String a : apps) { Long v = u.get(a); if (v != null) t += v; }
                    long lim = r.optLong("min") * 60000L;
                    if (lim > 0 && t >= lim) { h = new Hit(); h.why = "You’ve used your " + mins(lim) + (apps.size() > 1 ? " for these apps" : "") + " today. It opens again tomorrow."; }
                }
            } else if ("total".equals(k)) {
                if (dayOn(r.optJSONArray("days"), dow(now))) {
                    Set<String> skip = set(r.optJSONArray("allow")); Set<String> nv = never(now);
                    long t = 0; for (Map.Entry<String, Long> x : u.entrySet()) if (!skip.contains(x.getKey()) && !nv.contains(x.getKey())) t += x.getValue();
                    long lim = r.optLong("min") * 60000L;
                    if (lim > 0 && t >= lim && !skip.contains(p)) { h = new Hit(); h.why = "Your " + mins(lim) + " of phone time today is used up. Apps open again tomorrow."; }
                }
            }
            if (h != null) { h.id = id; h.title = name; h.fr = r.optString("fr", "hard"); h.more = r.optInt("more", 5); return h; }
        }
        return null;
    }

    /* the notification line: what's on */
    String summary(JSONObject o, long now) {
        JSONObject f = o.optJSONObject("focus");
        if (f != null && f.optLong("until") > now) return (f.optString("name", "").isEmpty() ? "Focus" : f.optString("name")) + " until " + clock(this, f.optLong("until"));
        JSONArray R = o.optJSONArray("rules"); int n = 0; String sched = null;
        if (R != null) for (int i = 0; i < R.length(); i++) { JSONObject r = R.optJSONObject(i); if (r == null || !r.optBoolean("on", true)) continue; n++; if ("sched".equals(r.optString("kind")) && inWindow(r, now)) sched = (r.optString("name", "").isEmpty() ? "Schedule" : r.optString("name")) + " until " + clock(this, windowEnd(r, now)); }
        if (sched != null) return sched;
        return n == 1 ? "1 block is on" : n + " blocks are on";
    }

    void setNote(String t) {
        if (t == null || t.equals(note)) return;
        note = t;
        try { NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE); if (nm != null) nm.notify(NID, notif(this, t)); } catch (Exception e) { }
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CH, "Blocks", NotificationManager.IMPORTANCE_MIN);
        ch.setDescription("Shows while app limits, schedules or focus are on");
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
        NotificationChannel d = new NotificationChannel("blocks_done", "Focus finished", NotificationManager.IMPORTANCE_DEFAULT);
        d.setDescription("When a focus session ends");
        nm.createNotificationChannel(d);
    }

    static Notification notif(Context c, String text) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        return b.setSmallIcon(W.id(c, "ic_stat", "drawable")).setColor(ACCENT).setContentTitle("Plotlines blocks")
            .setContentText(text).setOngoing(true).setShowWhen(false)
            .setContentIntent(PendingIntent.getActivity(c, 7302, Assist.open(c, "blocks"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .build();
    }

    /* ---------------- usage today ---------------- */
    static synchronized Map<String, Long> today(Context c, long now) {
        Map<String, Long> m = new HashMap<String, Long>();
        try {
            UsageStatsManager um = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
            Calendar k = Calendar.getInstance(); k.setTimeInMillis(now);
            k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
            long from = k.getTimeInMillis();
            UsageEvents ev = um.queryEvents(from - 3 * 3600000L, now);
            UsageEvents.Event e = new UsageEvents.Event();
            String cur = null; long st = 0;
            while (ev.hasNextEvent()) {
                ev.getNextEvent(e);
                int t = e.getEventType(); long at = e.getTimeStamp(); String p = e.getPackageName();
                if (t == UsageHours.RESUMED) {
                    if (!opens(c, p)) { if (cur != null) add(m, cur, st, at, from); cur = null; continue; }
                    if (p.equals(cur)) continue;
                    if (cur != null) add(m, cur, st, at, from);
                    cur = p; st = at;
                } else if (t == UsageHours.PAUSED) {
                    if (p.equals(cur)) { add(m, cur, st, at, from); cur = null; }
                } else if (t == UsageHours.SCREEN_OFF || t == UsageHours.LOCKED) {
                    if (cur != null) { add(m, cur, st, at, from); cur = null; }
                }
            }
            /* the app still in front is counted by usedNow from the last read on */
            if (cur != null) add(m, cur, st, now, from);
        } catch (Exception x) { }
        return m;
    }
    static void add(Map<String, Long> m, String p, long s, long e, long from) {
        if (s < from) s = from;
        if (e <= s) return;
        Long o = m.get(p); m.put(p, (o == null ? 0L : o) + (e - s));
    }

    /* ---------------- what happened: blocks, extra time, focus done (the app reads it) ---------------- */
    static synchronized void log(Context c, String pkg, String rule, String kind, long n) {
        try {
            JSONArray a; try { a = new JSONArray(prefs(c).getString("log", "[]")); } catch (Exception e) { a = new JSONArray(); }
            JSONObject x = new JSONObject(); x.put("t", System.currentTimeMillis()); x.put("p", pkg); x.put("r", rule); x.put("k", kind); if (n != 0) x.put("n", n);
            a.put(x);
            long old = System.currentTimeMillis() - 9 * 86400000L;
            JSONArray b = new JSONArray(); int skip = Math.max(0, a.length() - 600);
            for (int i = skip; i < a.length(); i++) { JSONObject y = a.optJSONObject(i); if (y != null && y.optLong("t") > old) b.put(y); }
            prefs(c).edit().putString("log", b.toString()).apply();
        } catch (Exception e) { }
    }

    /* for the app: permissions, today's minutes, extra time given, and the log */
    static String state(Context c) {
        JSONObject o = new JSONObject();
        try {
            long now = System.currentTimeMillis();
            o.put("usage", UsageHours.allowed(c)); o.put("overlay", overlayOk(c)); o.put("running", me != null); o.put("now", now);
            JSONObject u = new JSONObject();
            if (UsageHours.allowed(c)) {
                Blocker b = me;
                Map<String, Long> m = b != null && b.usedAt > 0 ? b.usedNow(now, cfg(c)) : today(c, now);
                for (Map.Entry<String, Long> x : m.entrySet()) if (x.getValue() >= 30000) u.put(x.getKey(), Math.round(x.getValue() / 6000.0) / 10.0);
            }
            o.put("used", u);
            o.put("grants", obj(c, "grants")); o.put("once", obj(c, "once"));
            try { o.put("log", new JSONArray(prefs(c).getString("log", "[]"))); } catch (Exception e) { o.put("log", new JSONArray()); }
        } catch (Exception e) { }
        return o.toString();
    }

    /* launcher apps with their names and small icons, for the app's picker. Drawing 100+ icons took seconds and the page
       waited for it (1.77.1), so the list is built on a background thread and kept in files/blkapps.json: the page gets the
       last list at once (an empty one the very first time, and asks again), and a list older than 10 minutes is rebuilt. */
    static volatile String appsJson;
    static volatile long appsAt;
    static volatile boolean appsBusy;
    static String apps(Context c) {
        Context a = c.getApplicationContext();
        if (appsJson == null) {
            try {
                java.io.File fl = new java.io.File(a.getFilesDir(), "blkapps.json");
                if (fl.exists()) {
                    byte[] d = new byte[(int) fl.length()]; java.io.FileInputStream in = new java.io.FileInputStream(fl); int o = 0;
                    while (o < d.length) { int n = in.read(d, o, d.length - o); if (n < 0) break; o += n; }
                    in.close(); appsJson = new String(d, 0, o, "UTF-8"); appsAt = fl.lastModified();
                }
            } catch (Exception e) { }
        }
        if ((appsJson == null || System.currentTimeMillis() - appsAt > 600000) && !appsBusy) { appsBusy = true; new Thread(new AppsJob(a)).start(); }
        return appsJson != null ? appsJson : "[]";
    }
    static final class AppsJob implements Runnable {
        final Context c; AppsJob(Context c) { this.c = c; }
        public void run() {
            try {
                String j = buildApps(c); appsJson = j; appsAt = System.currentTimeMillis();
                java.io.File t = new java.io.File(c.getFilesDir(), "blkapps.tmp"); java.io.FileOutputStream o = new java.io.FileOutputStream(t);
                o.write(j.getBytes("UTF-8")); o.close(); t.renameTo(new java.io.File(c.getFilesDir(), "blkapps.json"));
            } catch (Exception e) { } finally { appsBusy = false; }
        }
    }
    static String buildApps(Context c) {
        JSONArray a = new JSONArray();
        try {
            PackageManager pm = c.getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> L = pm.queryIntentActivities(i, 0);
            Set<String> seen = new HashSet<String>();
            int px = (int) (40 * c.getResources().getDisplayMetrics().density);
            px = Math.max(48, Math.min(px, 96));
            for (ResolveInfo ri : L) {
                String p = ri.activityInfo.packageName;
                if (!seen.add(p) || p.equals(c.getPackageName())) continue;
                JSONObject x = new JSONObject();
                x.put("p", p);
                ApplicationInfo ai = ri.activityInfo.applicationInfo;
                x.put("l", String.valueOf(ri.loadLabel(pm)));
                if (Build.VERSION.SDK_INT >= 26) x.put("cat", ai.category);
                x.put("sys", (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0 && (ai.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0);
                try { x.put("i", icon(ri.loadIcon(pm), px)); } catch (Exception e) { }
                a.put(x);
            }
        } catch (Exception e) { }
        return a.toString();
    }
    static String icon(Drawable d, int px) {
        Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b); d.setBounds(0, 0, px, px); d.draw(cv);
        ByteArrayOutputStream s = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.PNG, 100, s); b.recycle();
        return Base64.encodeToString(s.toByteArray(), Base64.NO_WRAP);
    }

    /* ---------------- the block screen ---------------- */
    void show(String pkg, Hit h) {
        if (shield != null && pkg.equals(shield.pkg) && h.id.equals(shield.hit.id)) { shield.update(h); return; }
        hideNow();
        try {
            shield = new Shield(this, pkg, h);
            log(this, pkg, h.id, "b", 0);
        } catch (Exception e) { shield = null; }
    }

    void hideNow() {
        Shield s = shield; shield = null;
        if (s != null) s.remove();
    }

    void home() {
        try { Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); } catch (Exception e) { }
    }

    /* extra time on a rule (or the focus session) */
    void grant(String pkg, String rule, int min, boolean once) {
        try {
            JSONObject g = obj(this, "grants");
            g.put(rule, System.currentTimeMillis() + min * 60000L);
            put(this, "grants", g);
            if (once) {
                JSONObject o = obj(this, "once"); String d = UsageHours.day(System.currentTimeMillis());
                if (!d.equals(o.optString("d"))) o = new JSONObject().put("d", d);
                o.put(rule, true); put(this, "once", o);
            }
            log(this, pkg, rule, "m", min);
        } catch (Exception e) { }
        hideNow();
        poke();
    }

    static boolean onceUsed(Context c, String rule) {
        JSONObject o = obj(c, "once");
        return UsageHours.day(System.currentTimeMillis()).equals(o.optString("d")) && o.optBoolean(rule);
    }

    /* the full-screen view over the blocked app */
    static final class Shield implements View.OnClickListener, TextWatcher, View.OnFocusChangeListener, TextView.OnEditorActionListener {
        final Blocker s; final String pkg; Hit hit;
        final WindowManager wm; final Root root;
        TextView why, count, hint; Button close, more; EditText in; LinearLayout box; ImageView icon; ScrollView sv;
        String phrase = "";
        int wait = -1;
        final float dp;

        Shield(Blocker s, String pkg, Hit h) {
            this.s = s; this.pkg = pkg; this.hit = h;
            dp = s.getResources().getDisplayMetrics().density;
            wm = (WindowManager) s.getSystemService(WINDOW_SERVICE);
            root = new Root(s, this);
            build();
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT,
                Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.OPAQUE);
            lp.gravity = Gravity.TOP | Gravity.START;
            lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
            if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30 ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            /* edge to edge: by default an overlay window is laid out inside the status and navigation bars, which left
               the blocked app showing under the gesture bar. With no insets to fit it covers the whole screen. */
            if (Build.VERSION.SDK_INT >= 30) { lp.setFitInsetsTypes(0); lp.setFitInsetsSides(0); lp.setFitInsetsIgnoringVisibility(true); }
            wm.addView(root, lp);
        }

        int px(float v) { return Math.round(v * dp); }
        TextView text(String t, float sp, int color, boolean bold) {
            TextView v = new TextView(s); v.setText(t); v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp); v.setTextColor(color);
            v.setGravity(Gravity.CENTER_HORIZONTAL); v.setLineSpacing(0, 1.15f);
            if (bold) v.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
            return v;
        }
        Button button(String t, boolean primary) {
            Button b = new Button(s); b.setText(t); b.setAllCaps(false); b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
            b.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
            GradientDrawable g = new GradientDrawable(); g.setCornerRadius(px(28));
            if (primary) { g.setColor(ACCENT); b.setTextColor(0xFF1A1206); } else { g.setColor(0x00000000); g.setStroke(px(1.5f), 0x55FFFFFF); b.setTextColor(0xFFF2F2F5); }
            b.setBackground(g); b.setMinHeight(px(52)); b.setPadding(px(20), 0, px(20), 0); b.setStateListAnimator(null);
            b.setOnClickListener(this);
            return b;
        }
        LinearLayout.LayoutParams lp(int top) {
            LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            l.topMargin = px(top); return l;
        }

        String label() {
            try { PackageManager pm = s.getPackageManager(); return String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0))); } catch (Exception e) { return "This app"; }
        }

        void build() {
            root.setBackgroundColor(0xFF101115);
            sv = new ScrollView(s); sv.setFillViewport(true);
            FrameLayout wrap = new FrameLayout(s);
            box = new LinearLayout(s); box.setOrientation(LinearLayout.VERTICAL); box.setGravity(Gravity.CENTER_HORIZONTAL);
            box.setPadding(px(28), px(48), px(28), px(32));
            FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(Math.min(px(440), s.getResources().getDisplayMetrics().widthPixels), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
            wrap.addView(box, bl);
            sv.addView(wrap, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            root.addView(sv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            String name = label();
            ImageView ic = icon = new ImageView(s);
            try { ic.setImageDrawable(s.getPackageManager().getApplicationIcon(pkg)); } catch (Exception e) { }
            LinearLayout.LayoutParams il = new LinearLayout.LayoutParams(px(76), px(76)); il.gravity = Gravity.CENTER_HORIZONTAL;
            ic.setAlpha(0.92f);
            box.addView(ic, il);
            TextView t = text(name + " is blocked", 25, 0xFFF4F4F7, true);
            box.addView(t, lp(22));
            why = text(hit.why, 16, 0xFFB4B7C0, false);
            box.addView(why, lp(10));
            Map<String, Long> u = s.usedNow(System.currentTimeMillis(), cfg(s));
            Long m = u.get(pkg);
            count = text(m != null && m >= 60000 ? "Used today: " + mins(m) : "", 14, 0xFF878B96, false);
            box.addView(count, lp(6));

            close = button("Close " + name, true);
            box.addView(close, lp(34));

            String fr = hit.fr == null ? "hard" : hit.fr;
            if ("once".equals(fr)) {
                if (onceUsed(s, hit.id)) box.addView(hint = text("You’ve had your extra " + mn(hit.more) + " today.", 14, 0xFF878B96, false), lp(16));
                else { more = button(mn(hit.more).replace(" minute", " more minute") + " (once today)", false); box.addView(more, lp(12)); }
            } else if ("wait".equals(fr)) {
                more = button("Wait 20 seconds for " + mn(hit.more).replace(" minute", " more minute"), false); box.addView(more, lp(12));
            } else if ("type".equals(fr)) {
                phrase = "I choose to use " + name + " now";
                box.addView(hint = text("To open it anyway, type:\n“" + phrase + "”", 14, 0xFFB4B7C0, false), lp(22));
                in = new EditText(s); in.setTextColor(0xFFF4F4F7); in.setHintTextColor(0xFF6E727C); in.setHint("Type it here");
                in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
                in.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16); in.setSingleLine(true);
                GradientDrawable g = new GradientDrawable(); g.setCornerRadius(px(14)); g.setColor(0xFF1C1D23); g.setStroke(px(1), 0x33FFFFFF);
                in.setBackground(g); in.setPadding(px(16), px(12), px(16), px(12));
                in.addTextChangedListener(this);
                in.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
                in.setOnEditorActionListener(this); in.setOnFocusChangeListener(this);
                box.addView(in, lp(10));
                more = button("Open for " + mn(hit.more), false); more.setEnabled(false); more.setAlpha(0.4f);
                box.addView(more, lp(10));
            } else if ("lock".equals(fr)) {
                box.addView(hint = text("Focus is locked until " + clock(s, hit.until) + ". It can’t be skipped.", 14, 0xFF878B96, false), lp(16));
            } else {
                box.addView(hint = text("This block can’t be skipped. Change it in Plotlines\u00a0›\u00a0Blocks.", 14, 0xFF878B96, false), lp(16));
            }
            TextView open = text("Open Plotlines", 15, ACCENT, true);
            open.setPadding(px(12), px(14), px(12), px(14));
            open.setOnClickListener(this); open.setTag("open");
            box.addView(open, lp(22));
        }

        void update(Hit h) {
            hit = h;
            if (why != null) why.setText(h.why);
        }

        public void onClick(View v) {
            if (v == close) { Blocker.log(s, pkg, hit.id, "c", 0); s.home(); s.hideNow(); return; }
            if ("open".equals(v.getTag())) {
                try { Intent i = Assist.open(s, "blocks"); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); s.startActivity(i); } catch (Exception e) { }
                s.hideNow(); return;
            }
            if (v == more) {
                String fr = hit.fr;
                if ("once".equals(fr)) { s.grant(pkg, hit.id, hit.more, true); return; }
                if ("type".equals(fr)) { if (matches()) { hideKb(); s.grant(pkg, hit.id, hit.more, false); } return; }
                if ("wait".equals(fr)) {
                    if (wait == 0) { s.grant(pkg, hit.id, hit.more, false); return; }
                    if (wait < 0) { wait = 20; more.setEnabled(false); more.setAlpha(0.55f); s.ui.post(countdown); }
                }
            }
        }

        final Runnable countdown = new Runnable() {
            public void run() {
                if (s.shield != Shield.this) return;
                if (wait > 0) { more.setText("Open in " + wait + "…"); wait--; s.ui.postDelayed(this, 1000); }
                else { more.setText("Open for " + mn(hit.more)); more.setEnabled(true); more.setAlpha(1f); }
            }
        };

        /* typed the sentence? Case, extra spaces, curly quotes and a final full stop don't matter */
        static String norm(String t) { return t.toLowerCase(Locale.ROOT).replace('’', '\'').replaceAll("[.!]+$", "").replaceAll("\\s+", " ").trim(); }
        boolean matches() { return in != null && norm(in.getText().toString()).equals(norm(phrase)); }
        /* an overlay window doesn’t shrink for the keyboard: while typing, drop the icon and move everything to the top,
           so the box and the Open button stay above the keyboard */
        public void onFocusChange(View v, boolean has) {
            if (!has) return;
            if (icon != null) icon.setVisibility(View.GONE);
            FrameLayout.LayoutParams l = (FrameLayout.LayoutParams) box.getLayoutParams();
            l.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL; box.setLayoutParams(l);
            box.setPadding(px(28), px(36), px(28), px(32));
            sv.post(new Runnable() { public void run() { sv.scrollTo(0, 0); } });
        }
        /* the keyboard’s done key opens it once the sentence matches */
        public boolean onEditorAction(TextView v, int action, KeyEvent e) {
            if (matches()) { hideKb(); s.grant(pkg, hit.id, hit.more, false); }
            return true;
        }
        public void beforeTextChanged(CharSequence a, int b, int c, int d) { }
        public void onTextChanged(CharSequence a, int b, int c, int d) { }
        public void afterTextChanged(Editable e) { boolean ok = matches(); more.setEnabled(ok); more.setAlpha(ok ? 1f : 0.4f); }

        void hideKb() {
            try { InputMethodManager im = (InputMethodManager) s.getSystemService(INPUT_METHOD_SERVICE); if (im != null && in != null) im.hideSoftInputFromWindow(in.getWindowToken(), 0); } catch (Exception e) { }
        }

        void back() { Blocker.log(s, pkg, hit.id, "c", 0); s.home(); s.hideNow(); }

        void remove() {
            hideKb();
            try { wm.removeView(root); } catch (Exception e) { }
        }
    }

    /* the screen's root: Back closes the blocked app */
    static final class Root extends FrameLayout {
        final Shield sh;
        Root(Context c, Shield sh) { super(c); this.sh = sh; setFocusableInTouchMode(true); }
        @Override public boolean dispatchKeyEvent(KeyEvent e) {
            if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (e.getAction() == KeyEvent.ACTION_UP) sh.back(); return true; }
            return super.dispatchKeyEvent(e);
        }
    }
}
