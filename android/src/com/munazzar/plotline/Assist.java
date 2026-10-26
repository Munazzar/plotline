package com.munazzar.plotline;

import android.app.Activity;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import java.lang.ref.WeakReference;
import java.util.Locale;
import org.json.JSONObject;

/* window.PlotlineAssist: the Android side of the "Hey Plot" assistant (assistant.js).
   - speak / stopSpeaking: Android's text-to-speech reads the replies.
   - wake(cfg) / wakePause: the wake word. While Plotline is on screen a WakeLoop runs here; with "keep listening
     in the background" on, AssistService runs it instead, with its "Listening" notification.
   - A wake word heard while the app is on screen goes straight to the page (window.__assist). Heard in the
     background, the command is kept (takePending) and Plotline is opened on the assistant. Android only lets
     an app open itself from the background with "Display over other apps", so without it a notification asks.
   - widget(json): the last exchange, for the Plotline · Assistant home-screen widget.
   Callbacks: window.__assist(kind, a, b) with kind tts (id, start|done|err), wake, cmd (text), wstate (state). */
public class Assist {
    static WeakReference<MainActivity> act = new WeakReference<MainActivity>(null);
    static boolean resumed, hooked, jsPause, ttsPause;
    static WakeLoop inApp;
    static TextToSpeech tts;
    static boolean ttsReady;
    static String ttsLang = "";
    static String[] queued;
    static final Handler H = new Handler(Looper.getMainLooper());
    static final String CH = "assistant", CH_HEARD = "assistant_heard";

    final Context c;
    final WeakReference<MainActivity> own;

    Assist(MainActivity a) {
        c = a.getApplicationContext();
        own = new WeakReference<MainActivity>(a);
        act = new WeakReference<MainActivity>(a);
        resumed = true;
        hook(a);
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("plotline_assist", 0); }

    static JSONObject cfg(Context c) {
        try { return new JSONObject(prefs(c).getString("cfg", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    /* know when the app is on screen, without touching MainActivity */
    static void hook(Activity a) {
        if (hooked) return;
        hooked = true;
        a.getApplication().registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            public void onActivityResumed(Activity x) { if (x instanceof MainActivity) { act = new WeakReference<MainActivity>((MainActivity) x); resumed = true; overLock(x); apply(x); } }
            public void onActivityPaused(Activity x) { if (x instanceof MainActivity) { resumed = false; apply(x); } }
            public void onActivityCreated(Activity x, Bundle b) { if (x instanceof MainActivity) overLock(x); }
            public void onActivityStarted(Activity x) { if (x instanceof MainActivity) overLock(x); }
            public void onActivityStopped(Activity x) {}
            public void onActivitySaveInstanceState(Activity x, Bundle b) {}
            public void onActivityDestroyed(Activity x) {}
        });
    }

    /* start or stop listening to match the settings, whether the app is on screen, and pauses */
    static void apply(final Context cx) {
        H.post(new Runnable() { public void run() { applyNow(cx.getApplicationContext()); } });
    }

    static void applyNow(Context c) {
        JSONObject o = cfg(c);
        boolean on = o.optBoolean("on"), bg = o.optBoolean("bg");
        boolean pause = jsPause || ttsPause;
        if (on && bg) {
            stopInApp();
            if (AssistService.me == null) {
                if (resumed) {
                    try {
                        Intent i = new Intent(c, AssistService.class);
                        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
                    } catch (Exception e) {}
                }
            } else AssistService.me.sync(pause);
            return;
        }
        if (AssistService.me != null) AssistService.me.stopSelf();
        if (!on || !resumed) { stopInApp(); return; }
        final Context cc = c;
        if (inApp == null) inApp = new WakeLoop(c, new WakeLoop.Cb() {
            public void heard(String cmd) { Assist.heard(cc, cmd); }
            public void wake() { Assist.woke(cc); }
            public void partial(String s) { Assist.partial(s); }
            public void state(String s) { Assist.state(s); }
        });
        inApp.config(o.optString("name", "Plot"), o.optString("lang", ""), o.optBoolean("cloud"));
        inApp.setPaused(pause);
        inApp.start();
    }

    static void stopInApp() { if (inApp != null) { inApp.stop(); inApp = null; } }

    static void js(String code) {
        MainActivity a = act.get();
        if (a != null) a.js(code);
    }

    /* "Hey Plot" on its own: the start chime, and the page shows it's listening (the loop hears the command itself) */
    static void woke(Context c) {
        WakeLoop.unmute();
        Chime.start(c);
        if (resumed) js("window.__assist&&window.__assist('wake','native','')");
    }

    static void partial(String s) { if (resumed) js("window.__assist&&window.__assist('partial'," + JSONObject.quote(s) + ",'')"); }

    static void state(String s) {
        Context cx = act.get() != null ? act.get() : WakeLoop.mc;
        if ("timeout".equals(s) && cx != null) { WakeLoop.unmute(); Chime.stop(cx); } /* gave up waiting for the command */
        if (resumed) js("window.__assist&&window.__assist('wstate'," + JSONObject.quote(s) + ",'')"); }

    /* the wake word was heard; cmd is what followed it ("" if nothing) */
    static void heard(Context c, String cmd) {
        if (!cmd.isEmpty()) { WakeLoop.unmute(); Chime.stop(c); } /* got the command: the stop chime */
        MainActivity a = act.get();
        if (a != null && resumed) {
            js(cmd.isEmpty() ? "window.__assist&&window.__assist('wake','','')" : "window.__assist&&window.__assist('cmd'," + JSONObject.quote(cmd) + ",'')");
            return;
        }
        prefs(c).edit().putString("pending", cmd).putLong("pendingAt", System.currentTimeMillis()).apply();
        bgAt = System.currentTimeMillis();
        String route = cmd.isEmpty() ? "assistant-listen-bg" : "assistant-bg"; /* -bg: step aside again after answering */
        boolean pop = Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(c);
        if (pop) {
            try { c.startActivity(open(c, route)); return; } catch (Exception e) {}
        }
        notifyHeard(c, cmd, route);
        apply(c); /* nothing on screen will take over, so keep listening */
    }

    static Intent open(Context c, String route) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("com.munazzar.plotline.ROUTE." + route);
        i.putExtra("route", route);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return i;
    }

    /* Heard in the background with the phone locked or the screen off: Plotline comes up over the lock screen
       (and turns the screen on) so it can answer out loud without unlocking, like Gemini does while you drive.
       Only for a moment after "Hey Plot"; opening the app normally still goes through the lock screen. */
    static long bgAt;

    static void overLock(Activity x) {
        boolean on = System.currentTimeMillis() - bgAt < 30000;
        if (!on && !shownLocked) return;
        shownLocked = on;
        try {
            if (Build.VERSION.SDK_INT >= 27) { x.setShowWhenLocked(on); x.setTurnScreenOn(on); }
            else if (on) x.getWindow().addFlags(0x00080000 | 0x00200000); /* FLAG_SHOW_WHEN_LOCKED | FLAG_TURN_SCREEN_ON */
            else x.getWindow().clearFlags(0x00080000 | 0x00200000);
        } catch (Exception e) {}
        if (on) bgAt = 0;
    }
    static boolean shownLocked;

    /* back to whatever was on screen (or the lock screen) once a hands-free answer is done */
    static void toBack() {
        final MainActivity a = act.get();
        if (a == null) return;
        H.post(new Runnable() { public void run() {
            try { if (shownLocked && Build.VERSION.SDK_INT >= 27) { a.setShowWhenLocked(false); a.setTurnScreenOn(false); shownLocked = false; } } catch (Exception e) {}
            try { a.moveTaskToBack(true); } catch (Exception e) {}
        } });
    }

    static void notifyHeard(Context c, String cmd, String route) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            /* silent: no sound or buzz, but high enough to open Plotline straight away when the phone is locked */
            NotificationChannel nc = new NotificationChannel(CH_HEARD, "Assistant", NotificationManager.IMPORTANCE_HIGH);
            nc.setSound(null, null); nc.enableVibration(false);
            nm.createNotificationChannel(nc);
            try { nm.deleteNotificationChannel(CH); } catch (Exception e) {}
            PendingIntent pi = PendingIntent.getActivity(c, 2951, open(c, route), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new Notification.Builder(c, CH_HEARD)
                .setSmallIcon(W.id(c, "ic_stat", "drawable")).setColor(0xFFFFB547)
                .setFullScreenIntent(pi, true).setOnlyAlertOnce(true)
                .setContentTitle(cmd.isEmpty() ? "I'm listening. Tap to talk" : "Tap to finish: “" + cmd + "”")
                .setContentIntent(pi).setAutoCancel(true).setTimeoutAfter(120000)
                .setCategory(Notification.CATEGORY_MESSAGE).build();
            nm.notify(2951, n);
        } catch (Exception e) {}
    }

    /* ---------------- text to speech ---------------- */
    static String ttsVoice = "";
    static void speakNow(final Context c, final String id, final String text, final String lang, final double rate) { speakNow(c, id, text, lang, rate, 1, ""); }

    /* the voice the user picked (Settings › Voice), by name; "" keeps the engine's default for the language */
    static void speakNow(final Context c, final String id, final String text, final String lang, final double rate, final double pitch, final String voice) {
        if (tts == null) {
            queued = new String[]{id, text, lang, String.valueOf(rate), String.valueOf(pitch), voice};
            tts = new TextToSpeech(c, new TextToSpeech.OnInitListener() {
                public void onInit(int st) {
                    ttsReady = st == TextToSpeech.SUCCESS;
                    String[] q = queued; queued = null;
                    if (!ttsReady) { if (q != null) done(q[0], "err"); tts = null; return; }
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        public void onStart(String u) { ttsPause = true; apply(c); }
                        public void onDone(String u) { ttsPause = false; apply(c); done(u, "done"); }
                        public void onError(String u) { ttsPause = false; apply(c); done(u, "err"); }
                        public void onStop(String u, boolean i) { ttsPause = false; apply(c); done(u, "done"); }
                    });
                    voicesReady();
                    if (q != null && q[0] != null) speakNow(c, q[0], q[1], q[2], Double.parseDouble(q[3]), Double.parseDouble(q[4]), q[5]);
                }
            });
            return;
        }
        if (!ttsReady) { queued = new String[]{id, text, lang, String.valueOf(rate), String.valueOf(pitch), voice}; return; }
        try {
            if (!lang.equals(ttsLang) || !voice.equals(ttsVoice)) {
                ttsLang = lang; ttsVoice = voice;
                tts.setLanguage(lang.isEmpty() ? Locale.getDefault() : Locale.forLanguageTag(lang));
                if (!voice.isEmpty() && tts.getVoices() != null)
                    for (android.speech.tts.Voice v : tts.getVoices()) if (voice.equals(v.getName())) { tts.setVoice(v); break; }
            }
            tts.setSpeechRate((float) (rate > 0 ? rate : 1));
            tts.setPitch((float) (pitch > 0 ? pitch : 1));
            WakeLoop.unmute(); /* never answer into a hushed stream */
            ttsPause = true;
            applyNow(c);
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) { ttsPause = false; applyNow(c); done(id, "err"); }
        } catch (Exception e) { ttsPause = false; done(id, "err"); }
    }

    /* the engine's voices, for the voice picker: [{n: name, l: language tag, q: quality, net: needs internet}] */
    static String voiceList = "";
    static void voicesReady() {
        try {
            org.json.JSONArray a = new org.json.JSONArray();
            if (tts != null && tts.getVoices() != null) for (android.speech.tts.Voice v : tts.getVoices()) {
                if (v.getFeatures() != null && v.getFeatures().contains("notInstalled")) continue;
                JSONObject o = new JSONObject();
                o.put("n", v.getName()); o.put("l", v.getLocale().toLanguageTag()); o.put("q", v.getQuality()); o.put("net", v.isNetworkConnectionRequired());
                if (v.getFeatures() != null) o.put("f", android.text.TextUtils.join(",", v.getFeatures())); /* some engines say male / female here */
                a.put(o);
            }
            voiceList = a.toString();
        } catch (Exception e) { voiceList = "[]"; }
        js("window.__assist&&window.__assist('voices','','')");
    }

    static void done(String id, String k) { js("window.__assist&&window.__assist('tts'," + JSONObject.quote(id) + "," + JSONObject.quote(k) + ")"); }

    /* ---------------- the page's side ---------------- */
    @JavascriptInterface
    public String state() {
        try {
            JSONObject o = new JSONObject();
            o.put("tts", true);
            o.put("onDevice", WakeLoop.onDeviceAvailable(c));
            o.put("overlay", Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(c));
            o.put("bg", AssistService.me != null);
            o.put("bgOff", prefs(c).getBoolean("bgOff", false));
            o.put("assistRole", assistRole(c));
            o.put("share", true);
            o.put("handsFree", true);
            o.put("http", true);
            prefs(c).edit().putBoolean("bgOff", false).apply();
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /* usageHours(days): screen time per app for each hour of the last few days (UsageHours), "{"perm":false}" without
       usage access. 1.54. */
    @JavascriptInterface
    public String usageHours(int days) { return UsageHours.json(c, days); }

    /* bgAgent([{at}]): when agent tasks are due, so they run by themselves (BgAgent). "exact" or "no". 1.57. */
    @JavascriptInterface
    public String bgAgent(String json) { return BgAgent.schedule(c, json); }

    /* bgModel(file, ctx, threads): the on-device model background tasks think with. 1.57. */
    @JavascriptInterface
    public void bgModel(String file, int ctx, int threads) { BgAgent.model(c, file, ctx, threads); }

    /* stepHours(days): steps per hour from this phone's step counter (StepHours); also keeps the 15-minute readings
       going and takes one now. 1.56. */
    @JavascriptInterface
    public String stepHours(int days) {
        StepHours.arm(c);
        new Thread(new Runnable() { public void run() { StepHours.tick(c); } }).start();
        return StepHours.hours(c, days);
    }

    /* http(id, {url, method, headers, body}): a request for a connector whose server doesn't allow browser pages (Notion),
       or (1.54) a plain read of a public page or feed for the agent (news, trends, RSS). Only https. Requests with a body
       or headers go only to the hosts below; a plain GET goes to any public address, never this phone, the home network
       or a private (Tailscale) one, and doesn't follow redirects. The answer comes back as window.__http(id, status, body). */
    static final String[] HTTP_HOSTS = {"api.notion.com"};

    static boolean publicHost(String host) {
        try {
            for (java.net.InetAddress a : java.net.InetAddress.getAllByName(host)) {
                if (a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress() || a.isAnyLocalAddress() || a.isMulticastAddress()) return false;
                byte[] b = a.getAddress();
                if (b.length == 4 && (b[0] & 0xff) == 100 && (b[1] & 0xc0) == 64) return false;
                if (b.length == 16 && (b[0] & 0xfe) == 0xfc) return false;
            }
            return true;
        } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public void http(final String id, final String json) {
        new Thread(new Runnable() { public void run() {
            int code = 0; String out;
            try {
                JSONObject o = new JSONObject(json);
                java.net.URL u = new java.net.URL(o.getString("url"));
                boolean ok = "https".equals(u.getProtocol()), listed = false;
                if (ok) for (String h : HTTP_HOSTS) if (h.equals(u.getHost())) listed = true;
                JSONObject hd0 = o.optJSONObject("headers");
                boolean plain = "GET".equals(o.optString("method", "GET")) && o.optString("body", "").length() == 0
                    && (hd0 == null || !(hd0.has("Authorization") || hd0.has("Cookie"))) && u.getUserInfo() == null;
                if (!ok || !(listed || (plain && publicHost(u.getHost())))) throw new Exception("host not allowed");
                java.net.HttpURLConnection h = (java.net.HttpURLConnection) u.openConnection();
                if (!listed) h.setInstanceFollowRedirects(false);
                h.setConnectTimeout(15000); h.setReadTimeout(30000);
                h.setRequestMethod(o.optString("method", "GET"));
                JSONObject hd = o.optJSONObject("headers");
                if (hd != null) { java.util.Iterator<String> k = hd.keys(); while (k.hasNext()) { String n = k.next(); h.setRequestProperty(n, hd.optString(n)); } }
                String body = o.optString("body", "");
                if (body.length() > 0) { h.setDoOutput(true); java.io.OutputStream os = h.getOutputStream(); os.write(body.getBytes("UTF-8")); os.close(); }
                code = h.getResponseCode();
                java.io.InputStream in = code >= 400 ? h.getErrorStream() : h.getInputStream();
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0 && bo.size() < 4000000) bo.write(buf, 0, n); in.close(); }
                out = bo.toString("UTF-8");
                h.disconnect();
            } catch (Exception e) { out = String.valueOf(e.getMessage()); }
            final String js = "window.__http&&window.__http(" + JSONObject.quote(id) + "," + code + "," + JSONObject.quote(out) + ")";
            H.post(new Runnable() { public void run() { js(js); } });
        } }).start();
    }

    @JavascriptInterface
    public void speak(final String id, final String text, final String lang, final double rate) {
        H.post(new Runnable() { public void run() { speakNow(c, id, text == null ? "" : text, lang == null ? "" : lang, rate); } });
    }

    @JavascriptInterface
    public void speak2(final String id, final String text, final String lang, final double rate, final double pitch, final String voice) {
        H.post(new Runnable() { public void run() { speakNow(c, id, text == null ? "" : text, lang == null ? "" : lang, rate, pitch, voice == null ? "" : voice); } });
    }

    /* "" until the engine has started; then window.__assist('voices') tells the page to ask again */
    @JavascriptInterface
    public String voices() {
        if (tts == null) H.post(new Runnable() { public void run() {
            if (tts != null) return;
            queued = new String[]{null, "", "", "1", "1", ""};
            speakNow(c, null, "", "", 1, 1, "");
        } });
        return tts != null && ttsReady ? voiceList : "";
    }

    /* Android's text-to-speech settings, where more voices can be downloaded */
    @JavascriptInterface
    public void openTtsSettings() {
        String[] acts = {"com.android.settings.TTS_SETTINGS", Settings.ACTION_SETTINGS};
        for (String a : acts) {
            try { Intent i = new Intent(a); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); return; } catch (Exception e) {}
        }
    }

    @JavascriptInterface
    public void stopSpeaking() {
        Kokoro.stop();
        H.post(new Runnable() { public void run() { try { if (tts != null) tts.stop(); } catch (Exception e) {} ttsPause = false; applyNow(c); } });
    }

    /* natural voices (Kokoro): kokoro() is the state as JSON, kokoroGet() downloads the model once,
       kokoroSay(id, [[phoneme ids], …] one list per sentence, voice id, speed) speaks like speak2 does */
    @JavascriptInterface
    public String kokoro() { return Kokoro.state(c); }

    @JavascriptInterface
    public void kokoroGet() { Kokoro.get(c); }

    @JavascriptInterface
    public void kokoroRemove() { new Thread(new Runnable() { public void run() { Kokoro.remove(c); } }).start(); }

    /* load the model ahead of the first sentence (a few seconds), e.g. when a conversation starts */
    @JavascriptInterface
    public void kokoroWarm() { new Thread(new Runnable() { public void run() { try { Kokoro.session(c); } catch (Throwable e) {} } }).start(); }

    @JavascriptInterface
    public void kokoroSay(String id, String json, String voice, double rate) { Kokoro.say(c, id == null ? "" : id, json == null ? "[]" : json, voice == null ? "" : voice, rate); }

    @JavascriptInterface
    public void wake(String json) {
        try { new JSONObject(json); prefs(c).edit().putString("cfg", json).apply(); } catch (Exception e) { return; }
        apply(c);
    }

    @JavascriptInterface
    public void wakePause(boolean p) { jsPause = p; apply(c); }

    /* the mic buttons: listen(id, lang, mode) with mode 0 on-device only, 1 on-device then online, 2 online (Listen) */
    @JavascriptInterface
    public void listen(String id, String lang, int mode) {
        MainActivity a = own.get();
        if (a != null) Listen.start(a, id == null ? "" : id, lang, mode);
    }

    @JavascriptInterface
    public void listenStop() { Listen.stop(); }

    @JavascriptInterface
    public String takePending() {
        SharedPreferences p = prefs(c);
        String s = p.getString("pending", "");
        long at = p.getLong("pendingAt", 0);
        p.edit().remove("pending").remove("pendingAt").apply();
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(2951); } catch (Exception e) {}
        return System.currentTimeMillis() - at < 180000 ? s : "";
    }

    /* text shared into Plotline (Share › Plotline, or select text › Send to Plotline), kept by AssistEntry */
    @JavascriptInterface
    public String takeShare() {
        SharedPreferences p = prefs(c);
        String s = p.getString("share", "");
        long at = p.getLong("shareAt", 0);
        p.edit().remove("share").remove("shareAt").apply();
        return System.currentTimeMillis() - at < 600000 ? s : "";
    }

    /* a hands-free answer is done: step aside (back to the lock screen or the app you were in) */
    @JavascriptInterface
    public void background() { toBack(); }

    /* is Plotline the phone's digital assistant (side button / long-press home)? */
    static boolean assistRole(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                android.app.role.RoleManager rm = (android.app.role.RoleManager) c.getSystemService(Context.ROLE_SERVICE);
                if (rm != null && rm.isRoleAvailable("android.app.role.ASSISTANT")) return rm.isRoleHeld("android.app.role.ASSISTANT");
            }
            String a = Settings.Secure.getString(c.getContentResolver(), "assistant");
            return a != null && a.startsWith(c.getPackageName() + "/");
        } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public void openAssistSettings() {
        String[] acts = {"android.settings.MANAGE_DEFAULT_APPS_SETTINGS", "android.settings.VOICE_INPUT_SETTINGS", Settings.ACTION_SETTINGS};
        for (String a : acts) {
            try {
                Intent i = new Intent(a);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                return;
            } catch (Exception e) {}
        }
    }

    @JavascriptInterface
    public void widget(String json) {
        prefs(c).edit().putString("w", json).apply();
        AssistWidget.updateAll(c);
    }

    @JavascriptInterface
    public void openOverlaySettings() {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {}
    }
}
