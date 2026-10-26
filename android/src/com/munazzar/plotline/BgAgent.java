package com.munazzar.plotline;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/* Agent tasks that run by themselves (1.57). At a task's time an exact alarm starts this service (Android lets an
   exact alarm start a foreground service from the background); it shows a quiet "working" notification while it runs,
   loads the app's own page invisibly (https://appassets.androidplatform.net/index.html?bg=agent, the same origin as
   the app, so the same data), lets agent.js run what's due, posts each result as a notification and stops. At most
   8 minutes. Tasks think with "Your AI server" (a plain fetch from the page) or the on-device model: the page asks
   PlotlineBg.llm(), which starts the phone's own llama-server (LocalLlm, as notification replies do) with the model the
   app picked (PlotlineAssist.bgModel) and answers there.
   The app schedules the runs with PlotlineAssist.bgAgent([{at}]). Android lets the alarm start this service when exact
   alarms are allowed ("exact") or when Plotlines may ignore battery optimisation ("idle", within a few minutes of the
   time); otherwise "no", and the app keeps its "Open Plotlines and I'll run it" reminder instead. */
public class BgAgent extends Service {
    static final String HOST = "appassets.androidplatform.net", CH_RUN = "agent_bg", CH_DONE = "agent_done";
    static final int NID = 9301, RC0 = 7100, MAX = 8;
    final Handler H = new Handler(Looper.getMainLooper());
    WebView w;
    PowerManager.WakeLock wl;
    int posted;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("plotline_bgagent", 0); }

    static PendingIntent pi(Context c, int i) {
        Intent it = new Intent(c, BgAgent.class).setAction("run");
        return PendingIntent.getForegroundService(c, RC0 + i, it, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static String schedule(Context c, String json) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            int old = prefs(c).getInt("n", 0);
            for (int i = 0; i < Math.max(old, MAX); i++) am.cancel(pi(c, i));
            boolean exact = Build.VERSION.SDK_INT < 31 || Reminders.canExact(am), idle = false;
            try { idle = ((PowerManager) c.getSystemService(Context.POWER_SERVICE)).isIgnoringBatteryOptimizations(c.getPackageName()); } catch (Exception e) { }
            if (!exact && !idle) { prefs(c).edit().putInt("n", 0).apply(); return "no"; }
            JSONArray a = new JSONArray(json == null ? "[]" : json);
            int n = 0; long now = System.currentTimeMillis();
            for (int i = 0; i < a.length() && n < MAX; i++) {
                long at = a.getJSONObject(i).optLong("at", 0);
                if (at <= now) continue;
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi(c, n));
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi(c, n));
                n++;
            }
            prefs(c).edit().putInt("n", n).apply();
            return exact ? "exact" : "idle";
        } catch (Exception e) { return "no"; }
    }

    /* the on-device model to use in the background: its file, context size and threads (from the app) */
    static void model(Context c, String file, int ctx, int threads) {
        prefs(c).edit().putString("model", file == null ? "" : file).putInt("ctx", ctx).putInt("threads", threads).apply();
    }

    void channels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel a = new NotificationChannel(CH_RUN, "Agent working", NotificationManager.IMPORTANCE_MIN);
        a.setDescription("Shown while a task runs by itself"); a.setShowBadge(false);
        NotificationChannel b = new NotificationChannel(CH_DONE, "Agent results", NotificationManager.IMPORTANCE_DEFAULT);
        b.setDescription("What your agent tasks found");
        nm.createNotificationChannel(a); nm.createNotificationChannel(b);
    }

    PendingIntent open() {
        Intent i = new Intent(this, MainActivity.class).putExtra("route", "agent").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 9302, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    Notification.Builder nb(String ch) {
        return (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, ch) : new Notification.Builder(this))
            .setSmallIcon(getApplicationInfo().icon).setContentIntent(open());
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int id) {
        channels();
        Notification n = nb(CH_RUN).setContentTitle("Plot is working on your tasks").setOngoing(true).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(NID, n);
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (w == null) start();
        return START_NOT_STICKY;
    }

    final Runnable stop = new Runnable() { public void run() { finishAll(); } };

    void start() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "plotline:agent");
            wl.acquire(9 * 60 * 1000L);
        } catch (Exception e) { }
        w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        w.addJavascriptInterface(new Bridge(), "PlotlineBg");
        w.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String p = u.getPath(); if (p == null || p.equals("/")) p = "/index.html";
                try {
                    InputStream in = getAssets().open("www" + p);
                    return new WebResourceResponse(mime(p), "UTF-8", in);
                } catch (Exception e) { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, null); }
            }
        });
        w.loadUrl("https://" + HOST + "/index.html?bg=agent");
        H.postDelayed(stop, 8 * 60 * 1000L);
    }

    static String mime(String p) {
        String x = p.substring(p.lastIndexOf('.') + 1).toLowerCase();
        if (x.equals("html")) return "text/html"; if (x.equals("js") || x.equals("mjs")) return "text/javascript";
        if (x.equals("css")) return "text/css"; if (x.equals("json") || x.equals("webmanifest")) return "application/json";
        if (x.equals("wasm")) return "application/wasm"; if (x.equals("svg")) return "image/svg+xml"; if (x.equals("png")) return "image/png";
        if (x.equals("woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    class Bridge {
        /* one result: the task's name and the first line of what it found */
        @JavascriptInterface public void done(final String title, final String text) {
            H.post(new Runnable() { public void run() {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    Notification n = nb(CH_DONE).setContentTitle(title == null ? "Plot" : title).setContentText(text == null ? "" : text)
                        .setStyle(new Notification.BigTextStyle().bigText(text == null ? "" : text)).setAutoCancel(true).build();
                    nm.notify(9310 + (posted++ % 20), n);
                } catch (Exception e) { }
            } });
        }
        @JavascriptInterface public void finish() { H.post(stop); }
        /* one chat completion from the on-device model (OpenAI-style request and answer, as JSON text) */
        @JavascriptInterface public String llm(String body, int timeoutSec) {
            try {
                SharedPreferences p = prefs(BgAgent.this);
                String m = p.getString("model", "");
                if (m.length() == 0) return "{\"error\":\"No on-device model is set up\"}";
                String e = LocalLlm.ensure(BgAgent.this, m, Math.max(4096, p.getInt("ctx", 4096)), p.getInt("threads", 4));
                if (e != null && e.length() > 0) return new JSONObject().put("error", e).toString();
                return LocalLlm.complete(body, Math.max(30, Math.min(timeoutSec, 420)));
            } catch (Exception x) {
                try { return new JSONObject().put("error", String.valueOf(x.getMessage())).toString(); } catch (Exception y) { return "{}"; }
            }
        }
    }

    void finishAll() {
        H.removeCallbacks(stop);
        try { if (w != null) { w.stopLoading(); w.destroy(); } } catch (Exception e) { }
        w = null;
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception e) { }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override public void onDestroy() { if (w != null) finishAll(); super.onDestroy(); }
}
