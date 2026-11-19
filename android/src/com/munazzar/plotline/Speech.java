package com.munazzar.plotline;

import android.content.Context;
import android.media.AudioTrack;
import java.util.concurrent.LinkedBlockingQueue;
import org.json.JSONArray;

/* One answer, spoken as one stream (1.76.0). The page hands over each sentence the moment the AI has written it
   (add), and says when the answer is complete (end). A maker thread turns sentences into audio in order, with the
   natural voice the user picked (Kokoro from phoneme ids, or Supertonic from text), while a player thread writes them
   into a single AudioTrack that stays open for the whole answer, so nothing pops, restarts or waits for the rest of
   the answer. Each sentence's own leading and trailing silence is trimmed and replaced by a short pause that fits its
   ending (a full stop or question mark ~0.18 s, a comma ~0.08 s), so speech flows like a person reading aloud instead
   of stopping at every dot. Answers ('tts', id, done|err) like Kokoro.say. */
final class Speech {
    static final Object END = new Object();
    static volatile Run cur;

    static final class Item { final String text, json; final int gap; Item(String t, String j, int g) { text = t; json = j; gap = g; } }

    static final class Run {
        final Context c; final String id, engine, voice, lang; final float speed;
        final LinkedBlockingQueue<Object> in = new LinkedBlockingQueue<Object>(), out = new LinkedBlockingQueue<Object>();
        volatile boolean stopped; volatile AudioTrack track;
        Run(Context c, String id, String engine, String voice, String lang, double rate) {
            this.c = c; this.id = id; this.engine = engine; this.voice = voice; this.lang = lang;
            this.speed = (float) Math.max(0.5, Math.min(2, rate > 0 ? rate : 1));
        }
    }

    static void start(Context c, String id, String engine, String voice, String lang, double rate) {
        stop(); Kokoro.stop(); Supertonic.stop();
        final Run r = new Run(c.getApplicationContext(), id, engine, voice, lang, rate);
        cur = r;
        new Thread(new Maker(r)).start();
        new Thread(new Player(r)).start();
    }
    static void add(String id, String text, String json, int gap) { Run r = cur; if (r != null && r.id.equals(id) && !r.stopped) r.in.add(new Item(text, json, gap)); }
    static void end(String id) { Run r = cur; if (r != null && r.id.equals(id)) r.in.add(END); }
    static void stop() {
        Run r = cur; cur = null;
        if (r == null) return;
        r.stopped = true; r.in.add(END); r.out.add(END);
        AudioTrack t = r.track; if (t != null) { try { t.pause(); t.flush(); } catch (Exception e) { } }
    }

    /* sentences → audio, in order, as fast as the phone can */
    static final class Maker implements Runnable {
        final Run r; Maker(Run r) { this.r = r; }
        public void run() {
            try {
                boolean st = "st".equals(r.engine);
                Supertonic.Model sm = st ? Supertonic.model(r.c) : null;
                ai.onnxruntime.OrtSession ks = st ? null : Kokoro.session(r.c);
                float[] kv = st ? null : Kokoro.voice(r.c, r.voice);
                String sv = java.util.Arrays.asList(Supertonic.VOICES).contains(r.voice) ? r.voice : "F1";
                for (;;) {
                    Object o = r.in.take();
                    if (o == END || r.stopped) break;
                    Item it = (Item) o;
                    if (st) {
                        for (String p : Supertonic.pieces(it.text)) {
                            if (r.stopped) break;
                            r.out.add(new float[][]{trim(Supertonic.synth(sm, p, r.lang, sv, r.speed * 1.05f), sm.sr), {it.gap, sm.sr}});
                        }
                    } else {
                        JSONArray a = new JSONArray(it.json);
                        for (int i = 0; i < a.length() && !r.stopped; i++) {
                            JSONArray x = a.getJSONArray(i); long[] ids = new long[x.length()];
                            for (int j = 0; j < ids.length; j++) ids[j] = x.getLong(j);
                            /* a long sentence the page cut at a comma gets a comma's pause inside it */
                            int g = i + 1 < a.length() ? 80 : it.gap;
                            r.out.add(new float[][]{trim(Kokoro.synth(ks, ids, kv, r.speed), Kokoro.RATE), {g, Kokoro.RATE}});
                        }
                    }
                }
            } catch (Throwable e) { r.out.add(e); }
            r.out.add(END);
        }
    }

    /* audio → speaker, through one track for the whole answer */
    static final class Player implements Runnable {
        final Run r; Player(Run r) { this.r = r; }
        public void run() {
            boolean said = false; long frames = 0; int rate = 0, pieces = 0; AudioTrack t = null;
            try {
                for (;;) {
                    Object o = r.out.take();
                    if (o == END || r.stopped) break;
                    if (o instanceof Throwable) { if (!said) throw (Throwable) o; break; }
                    float[][] x = (float[][]) o; float[] pcm = x[0]; int gap = (int) x[1][0], sr = (int) x[1][1];
                    if (t == null) {
                        rate = sr; t = Supertonic.track(sr); r.track = t;
                        Assist.H.post(new Runnable() { public void run() { WakeLoop.unmute(); Assist.ttsPause = true; Assist.applyNow(r.c); } });
                        /* a moment of silence first, so the track is running before the voice starts (no clipped first word) */
                        float[] lead = new float[sr / 20]; t.write(lead, 0, lead.length, AudioTrack.WRITE_BLOCKING); frames += lead.length;
                        t.play(); said = true;
                    }
                    for (int off = 0; off < pcm.length && !r.stopped; ) { int n = t.write(pcm, off, Math.min(4800, pcm.length - off), AudioTrack.WRITE_BLOCKING); if (n <= 0) break; off += n; }
                    frames += pcm.length; pieces++;
                    if (gap > 0 && !r.stopped) { float[] z = new float[sr * gap / 1000]; t.write(z, 0, z.length, AudioTrack.WRITE_BLOCKING); frames += z.length; }
                }
                if (t != null && !r.stopped) {
                    long until = System.currentTimeMillis() + frames * 1000 / rate + 1500;
                    while (!r.stopped && (t.getPlaybackHeadPosition() & 0xFFFFFFFFL) < frames && System.currentTimeMillis() < until) Thread.sleep(15);
                }
                /* how it went, for tests (adb logcat -s PlotSpeech): pieces, audio length, and how often the speaker ran dry */
                try { android.util.Log.i("PlotSpeech", r.engine + " pieces=" + pieces + " audioMs=" + (rate > 0 ? frames * 1000 / rate : 0) + " underruns=" + (t != null && android.os.Build.VERSION.SDK_INT >= 24 ? t.getUnderrunCount() : -1)); } catch (Throwable e) { }
                Assist.done(r.id, said || r.stopped ? "done" : "err");
            } catch (Throwable e) {
                android.util.Log.w("PlotSpeech", "failed: " + e);
                Assist.done(r.id, said ? "done" : "err");
            } finally {
                if (t != null) { try { t.pause(); t.flush(); t.release(); } catch (Exception e) { } }
                if (cur == r) cur = null;
                if (cur == null) Assist.H.post(new Runnable() { public void run() { Assist.ttsPause = false; Assist.applyNow(r.c); } });
                Assist.H.removeCallbacks(Kokoro.idle); Assist.H.postDelayed(Kokoro.idle, 180000);
            }
        }
    }

    /* cut the quiet before the first and after the last sound, keeping 25 ms so words aren't clipped; fade the edges */
    static float[] trim(float[] a, int sr) {
        if (a == null || a.length == 0) return new float[0];
        float th = 0.012f; int s = 0, e = a.length - 1, keep = sr / 40;
        while (s < a.length && Math.abs(a[s]) < th) s++;
        while (e > s && Math.abs(a[e]) < th) e--;
        if (s >= e) return new float[0];
        s = Math.max(0, s - keep); e = Math.min(a.length - 1, e + keep);
        float[] o = new float[e - s + 1]; System.arraycopy(a, s, o, 0, o.length);
        int f = Math.min(sr / 200, o.length / 2);
        for (int i = 0; i < f; i++) { float g = (float) i / f; o[i] *= g; o[o.length - 1 - i] *= g; }
        return o;
    }
}
