package com.munazzar.plotline;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/* Listens for "hey <name>" with the phone's own speech recognizer, in rounds: each round ends after a pause in
   speech (or a few seconds of quiet) and the next one starts straight away. Uses the on-device recognizer when
   the phone has one (Android 12+), so audio stays on the phone; otherwise the regular one, only if online speech
   is allowed in Settings. "hey plot add milk to groceries" in one breath is heard as the wake word plus a command.
   Runs on the main thread. Used by Assist (while the app is on screen) and AssistService (in the background). */
final class WakeLoop implements RecognitionListener {
    interface Cb { void heard(String cmd); void state(String s); }

    static final String[] PRE = {"hey", "hi", "hay", "ok", "okay", "hello", "yo", "hei"};
    static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}']+");

    final Context c;
    final Cb cb;
    final Handler h = new Handler(Looper.getMainLooper());
    SpeechRecognizer rec;
    boolean running, paused, listening, onDevice;
    String[] name = {"plot"};
    String lang = "";
    boolean cloud;
    int fails;

    final Runnable goR = new Runnable() { public void run() { go(); } };
    final Runnable unstick = new Runnable() { public void run() { if (paused) setPaused(false); } };

    WakeLoop(Context c, Cb cb) { this.c = c.getApplicationContext(); this.cb = cb; }

    void config(String n, String l, boolean cl) {
        ArrayList<String> t = new ArrayList<String>();
        Matcher m = WORD.matcher(n == null ? "" : n.toLowerCase());
        while (m.find()) t.add(m.group());
        if (t.isEmpty()) t.add("plot");
        String[] nn = t.toArray(new String[0]);
        boolean ch = !java.util.Arrays.equals(nn, name) || !eq(l, lang) || cl != cloud;
        name = nn; lang = l == null ? "" : l; cloud = cl;
        if (ch && listening) { kill(); h.postDelayed(goR, 300); }
    }

    static boolean eq(String a, String b) { return a == null ? b == null : a.equals(b); }

    void start() { if (running) return; running = true; fails = 0; if (!paused) h.post(goR); }

    void stop() { running = false; h.removeCallbacks(unstick); kill(); destroy(); cb.state("off"); }

    /* paused while Plotline uses the mic itself or talks; resumes on its own after a while in case nobody says so */
    void setPaused(boolean p) {
        paused = p;
        h.removeCallbacks(unstick);
        if (p) { kill(); cb.state("paused"); h.postDelayed(unstick, 60000); }
        else if (running) { h.removeCallbacks(goR); h.postDelayed(goR, 500); }
    }

    static boolean onDeviceAvailable(Context c) {
        if (Build.VERSION.SDK_INT < 31) return false;
        try { return (Boolean) SpeechRecognizer.class.getMethod("isOnDeviceRecognitionAvailable", Context.class).invoke(null, c); }
        catch (Exception e) { return false; }
    }

    void go() {
        if (!running || paused || listening) return;
        if (c.checkSelfPermission("android.permission.RECORD_AUDIO") != 0) { cb.state("perm"); return; }
        try {
            if (rec == null) {
                onDevice = onDeviceAvailable(c);
                if (onDevice) rec = (SpeechRecognizer) SpeechRecognizer.class.getMethod("createOnDeviceSpeechRecognizer", Context.class).invoke(null, c);
                else if (cloud && SpeechRecognizer.isRecognitionAvailable(c)) rec = SpeechRecognizer.createSpeechRecognizer(c);
                else { cb.state("unavailable"); return; }
                rec.setRecognitionListener(this);
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, c.getPackageName());
            i.putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 1800L);
            i.putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 1500L);
            if (lang != null && !lang.isEmpty()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            listening = true;
            rec.startListening(i);
            cb.state("listening");
        } catch (Exception e) {
            listening = false;
            destroy();
            retry();
        }
    }

    void kill() {
        h.removeCallbacks(goR);
        listening = false;
        try { if (rec != null) rec.cancel(); } catch (Exception e) {}
    }

    void destroy() {
        try { if (rec != null) rec.destroy(); } catch (Exception e) {}
        rec = null;
    }

    void retry() {
        fails++;
        long d = Math.min(30000L, 800L << Math.min(fails, 6));
        cb.state("err");
        h.removeCallbacks(goR);
        h.postDelayed(goR, d);
    }

    void next(long d) { listening = false; h.removeCallbacks(goR); if (running && !paused) h.postDelayed(goR, d); }

    /* "hey plot", "ok plot", "hi plat"... returns what came after the name ("" for the wake word alone), or null */
    String match(String s) {
        if (s == null) return null;
        Matcher m = WORD.matcher(s);
        ArrayList<String> w = new ArrayList<String>();
        ArrayList<Integer> end = new ArrayList<Integer>();
        while (m.find()) { w.add(m.group().toLowerCase()); end.add(m.end()); }
        for (int i = 0; i + name.length < w.size(); i++) {
            if (!isPre(w.get(i))) continue;
            boolean ok = true;
            for (int k = 0; k < name.length && ok; k++) ok = near(w.get(i + 1 + k), name[k]);
            if (!ok) continue;
            String rest = s.substring(end.get(i + name.length)).replaceAll("^[\\s,.!?:;-]+", "").trim();
            return rest;
        }
        return null;
    }

    static boolean isPre(String t) { for (String p : PRE) if (p.equals(t)) return true; return false; }

    static boolean near(String a, String b) {
        if (a.equals(b)) return true;
        if (a.startsWith(b) && a.length() - b.length() <= 1) return true; /* plots */
        int n = b.length(), max = n >= 6 ? 2 : n >= 4 ? 1 : 0;
        return max > 0 && lev(a, b) <= max;
    }

    static int lev(String a, String b) {
        int[] p = new int[b.length() + 1], q = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) p[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            q[0] = i;
            for (int j = 1; j <= b.length(); j++)
                q[j] = Math.min(Math.min(p[j] + 1, q[j - 1] + 1), p[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            int[] t = p; p = q; q = t;
        }
        return p[b.length()];
    }

    String best(Bundle b) {
        ArrayList<String> r = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (r == null) return null;
        for (String s : r) { String m = match(s); if (m != null) return m; }
        return null;
    }

    public void onResults(Bundle b) {
        fails = 0;
        String m = best(b);
        if (m != null && running && !paused) {
            listening = false;
            setPaused(true);
            cb.heard(m);
            return;
        }
        next(150);
    }

    public void onError(int e) {
        listening = false;
        if (!running || paused) return;
        if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { fails = 0; next(200); return; }
        if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { cb.state("perm"); return; }
        destroy();
        retry();
    }

    public void onPartialResults(Bundle b) {}
    public void onReadyForSpeech(Bundle b) {}
    public void onBeginningOfSpeech() {}
    public void onRmsChanged(float v) {}
    public void onBufferReceived(byte[] b) {}
    public void onEndOfSpeech() {}
    public void onEvent(int t, Bundle b) {}
}
