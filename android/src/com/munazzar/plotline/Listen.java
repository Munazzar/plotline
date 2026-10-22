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
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import org.json.JSONObject;

/* The mic buttons (PlotlineAssist.listen): one round of speech to text, reported to the page as window.__voice(id, kind, text)
   with kind ready / partial / final / end / level / err, like the older NATIVE.voiceStart it replaces.
   It doesn't give up the way that one could:
   - The wake word's recognizer is let go first (not just cancelled), so the two never fight over the phone's speech service.
   - "Busy" (the service is still closing the last round) is tried again after a moment.
   - When the phone's on-device speech can't do the language (not downloaded, or not offered), or its service drops,
     online speech is used if it's allowed (mode 1); otherwise the page is told "lang" so it can ask. A missing language
     pack is also asked for, on Android 13+, so on-device works next time.
   mode: 0 on-device only, 1 on-device then online, 2 online only. */
final class Listen implements RecognitionListener {
    static Listen cur;
    static final HashSet<String> odBad = new HashSet<String>(); /* languages the on-device service failed on, this run */
    static final Handler H = new Handler(Looper.getMainLooper());

    final WeakReference<MainActivity> a;
    final Context c;
    final String id, lang;
    final int mode;
    SpeechRecognizer rec;
    boolean onDevice, done;
    int busy;
    Intent intent;

    Listen(MainActivity a, String id, String lang, int mode) {
        this.a = new WeakReference<MainActivity>(a);
        this.c = a.getApplicationContext();
        this.id = id; this.lang = lang == null ? "" : lang; this.mode = mode;
    }

    static void start(final MainActivity a, final String id, final String lang, final int mode) {
        H.post(new Runnable() { public void run() {
            stopNow();
            Assist.jsPause = true;
            Assist.applyNow(a.getApplicationContext()); /* the wake word steps aside and lets go of the recognizer */
            cur = new Listen(a, id, lang, mode);
            cur.go(mode == 2 || (mode == 1 && odBad.contains(cur.lang)));
        } });
    }

    /* finish: what was heard so far comes back as the final result */
    static void stop() {
        H.post(new Runnable() { public void run() { try { if (cur != null && cur.rec != null) cur.rec.stopListening(); } catch (Exception e) {} } });
    }

    static void stopNow() {
        if (cur == null) return;
        cur.done = true;
        try { if (cur.rec != null) cur.rec.cancel(); } catch (Exception e) {}
        cur.release();
        cur = null;
    }

    /* an activity going away takes its round with it */
    static void gone(MainActivity m) { if (cur != null && cur.a.get() == m) stopNow(); }

    void send(String kind, String text) {
        if (done && !"end".equals(kind) && !"err".equals(kind) && !"final".equals(kind)) return;
        MainActivity m = a.get();
        if (m == null) return;
        m.js("window.__voice&&window.__voice(" + JSONObject.quote(id) + "," + JSONObject.quote(kind) + "," + JSONObject.quote(text == null ? "" : text) + ")");
    }

    void go(boolean online) {
        if (c.checkSelfPermission("android.permission.RECORD_AUDIO") != 0) { finish("err", "perm"); return; }
        release();
        onDevice = !online && WakeLoop.onDeviceAvailable(c);
        try {
            if (onDevice) rec = (SpeechRecognizer) SpeechRecognizer.class.getMethod("createOnDeviceSpeechRecognizer", Context.class).invoke(null, c);
            else if (mode != 0 && SpeechRecognizer.isRecognitionAvailable(c)) rec = SpeechRecognizer.createSpeechRecognizer(c);
            else { finish("err", mode == 0 && SpeechRecognizer.isRecognitionAvailable(c) ? "lang" : "unavailable"); return; }
            rec.setRecognitionListener(this);
            intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, onDevice);
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, c.getPackageName());
            intent.putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 2500L);
            intent.putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 2000L);
            if (!lang.isEmpty()) intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            rec.startListening(intent);
        } catch (Exception e) {
            if (onDevice && mode != 0) { odBad.add(lang); go(true); return; }
            finish("err", onDevice ? "lang" : "unavailable");
        }
    }

    void release() {
        try { if (rec != null) rec.destroy(); } catch (Exception e) {}
        rec = null;
    }

    void finish(String kind, String text) {
        send(kind, text);
        done = true;
        release();
        if (cur == this) cur = null;
        if (!"final".equals(kind)) unpause();
    }

    /* the page also says when it's done with the mic (wakePause(false)); this covers a page that's gone */
    void unpause() {
        H.postDelayed(new Runnable() { public void run() {
            if (cur == null && a.get() == null) { Assist.jsPause = false; Assist.applyNow(c); }
        } }, 300);
    }

    /* ask Android 13+ to fetch the on-device language, so it works next time */
    void fetchLang() {
        if (Build.VERSION.SDK_INT < 33 || rec == null || intent == null) return;
        try { SpeechRecognizer.class.getMethod("triggerModelDownload", Intent.class).invoke(rec, intent); } catch (Exception e) {}
    }

    public void onError(int e) {
        if (cur != this || done) return;
        /* 8: the speech service is still busy with the last round */
        if ((e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == 10) && busy++ < 3) {
            release();
            H.postDelayed(new Runnable() { public void run() { if (cur == Listen.this && !done) go(!onDevice); } }, 350L * busy);
            return;
        }
        /* 12/13: on-device can't do this language; 5/11: its service fell over */
        if (onDevice && (e == 12 || e == 13 || e == SpeechRecognizer.ERROR_CLIENT || e == 11 || e == SpeechRecognizer.ERROR_SERVER)) {
            if (e == 13) fetchLang();
            if (mode != 0 && SpeechRecognizer.isRecognitionAvailable(c)) { odBad.add(lang); go(true); return; }
            if (e == 12 || e == 13) { finish("err", e == 13 ? "dl" : "lang"); return; }
        }
        finish("err", String.valueOf(e));
    }

    public void onResults(Bundle b) {
        if (cur != this) return;
        ArrayList<String> r = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        send("final", r == null || r.isEmpty() ? "" : r.get(0));
        finish("end", "");
    }

    public void onPartialResults(Bundle b) {
        ArrayList<String> r = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (r != null && !r.isEmpty()) send("partial", r.get(0));
    }

    public void onReadyForSpeech(Bundle b) { busy = 0; send("ready", onDevice ? "device" : "online"); }
    public void onRmsChanged(float v) { send("level", String.valueOf(Math.round(v))); }
    public void onBeginningOfSpeech() {}
    public void onBufferReceived(byte[] b) {}
    public void onEndOfSpeech() {}
    public void onEvent(int t, Bundle b) {}
}
