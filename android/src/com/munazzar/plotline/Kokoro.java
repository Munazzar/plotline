package com.munazzar.plotline;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;

/* Natural voices on the phone: Kokoro-82M (hexgrad, Apache-2.0) on ONNX Runtime, using several CPU cores, which is
   several times faster than the page's WebAssembly copy. The page (kokoro.js) turns the text into phoneme ids, one
   list per sentence; here each sentence becomes 24 kHz audio while the one before it plays.
   The model (model_fp16.onnx, 163 MB) downloads once into the app's files and then works offline.
   Callbacks go through window.__assist: ('tts', id, done|err) like the system voice, ('kokoro', state, progress). */
final class Kokoro {
    static final String HF = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/";
    static final String SHARDS = "https://cdn.jsdelivr.net/npm/kokoro-fp16-shards@1.0.4/kokoro-fp16.part";
    static final String[] VOICES = {HF + "voices/", "https://cdn.jsdelivr.net/npm/kokoro-local-runtime@0.1.0/voices/"};
    static final long MIN_MODEL = 150000000L, MODEL_BYTES = 163234740L;
    static final int RATE = 24000;

    static volatile String st = "";
    static volatile float prog;
    static volatile String err = "";
    static volatile int gen;
    static volatile AudioTrack cur;
    static OrtEnvironment env;
    static OrtSession sess;
    static final Map<String, float[]> vv = new HashMap<String, float[]>();
    static final ExecutorService SYN = Executors.newSingleThreadExecutor();

    static File dir(Context c) { File d = new File(c.getFilesDir(), "kokoro"); d.mkdirs(); return d; }
    static File model(Context c) { return new File(dir(c), "model_fp16.onnx"); }

    static String state(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("st", "getting".equals(st) ? "getting" : model(c).length() > MIN_MODEL ? "have" : "err".equals(st) ? "err" : "none");
            o.put("p", prog);
            o.put("err", err);
            o.put("mb", 163);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    static void tell(String what, float p) {
        final String code = "window.__assist&&window.__assist('kokoro'," + JSONObject.quote(what) + "," + JSONObject.quote(String.valueOf(p)) + ")";
        Assist.H.post(new Runnable() { public void run() { Assist.js(code); } });
    }

    /* ---------------- getting the model ---------------- */
    static void get(final Context c) {
        if ("getting".equals(st)) return;
        st = "getting"; prog = 0; err = "";
        tell("getting", 0);
        new Thread(new Runnable() { public void run() {
            try {
                File m = model(c);
                if (m.length() <= MIN_MODEL) {
                    File part = new File(dir(c), "model.part");
                    Exception last = null;
                    String[][] srcs = new String[2][];
                    srcs[0] = new String[]{HF + "onnx/model_fp16.onnx"};
                    srcs[1] = new String[10];
                    for (int i = 0; i < 10; i++) srcs[1][i] = SHARDS + i + ".bin";
                    boolean ok = false;
                    for (String[] src : srcs) {
                        try { pull(src, part, MODEL_BYTES, true); ok = part.length() > MIN_MODEL; if (ok) break; }
                        catch (Exception e) { last = e; }
                    }
                    if (!ok) throw last != null ? last : new Exception("The download was cut short");
                    if (!part.renameTo(m)) throw new Exception("Couldn't save the voices");
                }
                /* ready as soon as the model is in place; the first voice follows quietly (or on first use) */
                st = "have"; prog = 1;
                tell("have", 1);
                try { voice(c, "af_heart"); } catch (Exception e) {}
            } catch (Exception e) {
                st = "err"; err = e.getMessage() == null ? "Couldn't download the voices" : e.getMessage();
                tell("err", 0);
            }
        } }).start();
    }

    static HttpURLConnection open(String url) throws Exception {
        for (int i = 0; i < 6; i++) {
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
            h.setConnectTimeout(20000); h.setReadTimeout(60000);
            h.setInstanceFollowRedirects(false);
            int code = h.getResponseCode();
            if (code >= 300 && code < 400 && h.getHeaderField("Location") != null) { url = new URL(new URL(url), h.getHeaderField("Location")).toString(); h.disconnect(); continue; }
            if (code != 200) { h.disconnect(); throw new Exception("HTTP " + code); }
            return h;
        }
        throw new Exception("Too many redirects");
    }

    /* the files in urls, one after another, into out; progress (if report) against the real size when the server
       says it, else the expected total */
    static void pull(String[] urls, File out, long expect, boolean report) throws Exception {
        OutputStream os = new FileOutputStream(out);
        long got = 0; int lastPct = -1;
        try {
            byte[] buf = new byte[65536];
            for (String u : urls) {
                HttpURLConnection h = open(u);
                long len = h.getContentLengthLong();
                if (urls.length == 1 && len > 0) expect = len;
                InputStream in = h.getInputStream();
                int n;
                while ((n = in.read(buf)) > 0) {
                    os.write(buf, 0, n); got += n;
                    int pct = (int) Math.min(99, got * 100 / expect);
                    if (report && pct != lastPct) { lastPct = pct; prog = pct / 100f; tell("getting", prog); }
                }
                in.close(); h.disconnect();
            }
        } finally { os.close(); }
    }

    static void remove(Context c) {
        stop();
        synchronized (Kokoro.class) { closeSession(); vv.clear(); }
        File[] fs = dir(c).listFiles();
        if (fs != null) for (File f : fs) { if (f.isDirectory()) { File[] g = f.listFiles(); if (g != null) for (File x : g) x.delete(); } f.delete(); }
        st = ""; prog = 0; err = "";
        tell("none", 0);
    }

    /* a voice is 510 style vectors of 256 numbers, one per sentence length in phonemes */
    static synchronized float[] voice(Context c, String v) throws Exception {
        if (!v.matches("[a-z]{2}_[a-z]{2,12}")) v = "af_heart";
        float[] a = vv.get(v);
        if (a != null) return a;
        File vd = new File(dir(c), "voices"); vd.mkdirs();
        File f = new File(vd, v + ".bin");
        if (f.length() < 256 * 510 * 4) {
            Exception last = null;
            for (String b : VOICES) {
                try { pull(new String[]{b + v + ".bin"}, f, 522240, false); if (f.length() >= 256 * 510 * 4) break; }
                catch (Exception e) { last = e; f.delete(); }
            }
            if (f.length() < 256 * 510 * 4) throw last != null ? last : new Exception("Couldn't get that voice");
        }
        byte[] b = new byte[(int) f.length()];
        java.io.FileInputStream in = new java.io.FileInputStream(f);
        int off = 0, n;
        while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
        in.close();
        a = new float[b.length / 4];
        ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(a);
        vv.put(v, a);
        return a;
    }

    /* ---------------- the model ---------------- */
    static synchronized OrtSession session(Context c) throws Exception {
        Assist.H.removeCallbacks(idle);
        if (sess != null) return sess;
        File m = model(c);
        if (m.length() <= MIN_MODEL) throw new Exception("The natural voices aren't downloaded");
        sess = load(m.getPath());
        return sess;
    }

    static OrtSession load(String path) throws Exception {
        if (env == null) { env = OrtEnvironment.getEnvironment(); try { env.setTelemetry(false); } catch (Throwable e) {} }
        OrtSession.SessionOptions o = new OrtSession.SessionOptions();
        o.setIntraOpNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors())));
        o.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        return env.createSession(path, o);
    }

    static synchronized void closeSession() {
        try { if (sess != null) sess.close(); } catch (Exception e) {}
        sess = null;
    }

    /* let go of the model's memory after a few quiet minutes; it reloads in a few seconds */
    static final Runnable idle = new Runnable() { public void run() { new Thread(new Runnable() { public void run() { closeSession(); } }).start(); } };

    /* phoneme ids (without the start and end pads) → audio samples */
    static float[] synth(OrtSession s, long[] ids, float[] voice, float speed) throws Exception {
        int n = Math.min(ids.length, 510);
        long[] in = new long[n + 2];
        System.arraycopy(ids, 0, in, 1, n);
        float[] style = new float[256];
        System.arraycopy(voice, Math.min(n, voice.length / 256 - 1) * 256, style, 0, 256);
        OnnxTensor a = OnnxTensor.createTensor(env, LongBuffer.wrap(in), new long[]{1, n + 2});
        OnnxTensor b = OnnxTensor.createTensor(env, FloatBuffer.wrap(style), new long[]{1, 256});
        OnnxTensor sp = OnnxTensor.createTensor(env, FloatBuffer.wrap(new float[]{speed}), new long[]{1});
        try {
            Map<String, OnnxTensor> f = new HashMap<String, OnnxTensor>();
            f.put("input_ids", a); f.put("style", b); f.put("speed", sp);
            OrtSession.Result r = s.run(f);
            try {
                FloatBuffer fb = ((OnnxTensor) r.get(0)).getFloatBuffer();
                float[] out = new float[fb.remaining()];
                fb.get(out);
                return out;
            } finally { r.close(); }
        } finally { a.close(); b.close(); sp.close(); }
    }

    static long[][] chunks(String json) throws Exception {
        JSONArray a = new JSONArray(json);
        long[][] out = new long[a.length()][];
        for (int i = 0; i < a.length(); i++) {
            JSONArray x = a.getJSONArray(i);
            out[i] = new long[x.length()];
            for (int j = 0; j < x.length(); j++) out[i][j] = x.getLong(j);
        }
        return out;
    }

    /* ---------------- speaking ---------------- */
    static void say(final Context c, final String id, final String json, final String voice, final double rate) {
        stop();
        final int g = gen;
        new Thread(new Runnable() { public void run() {
            boolean started = false;
            AudioTrack t = null;
            try {
                final long[][] cs = chunks(json);
                final float[] vv = voice(c, voice);
                final OrtSession s = session(c);
                final float speed = (float) Math.max(0.5, Math.min(2, rate > 0 ? rate : 1));
                Future<float[]> next = SYN.submit(job(s, cs[0], vv, speed));
                long frames = 0;
                for (int i = 0; i < cs.length && g == gen; i++) {
                    float[] pcm = next.get();
                    next = i + 1 < cs.length ? SYN.submit(job(s, cs[i + 1], vv, speed)) : null;
                    if (g != gen) break;
                    if (t == null) {
                        t = track();
                        cur = t;
                        Assist.H.post(new Runnable() { public void run() { WakeLoop.unmute(); Assist.ttsPause = true; Assist.applyNow(c); } });
                        t.play();
                        started = true;
                    }
                    for (int off = 0; off < pcm.length && g == gen; ) {
                        int n = t.write(pcm, off, Math.min(4800, pcm.length - off), AudioTrack.WRITE_BLOCKING);
                        if (n <= 0) break;
                        off += n;
                    }
                    frames += pcm.length;
                }
                /* let the last of it play out */
                if (t != null && g == gen) {
                    long until = System.currentTimeMillis() + frames * 1000 / RATE + 1500;
                    while (g == gen && (t.getPlaybackHeadPosition() & 0xFFFFFFFFL) < frames && System.currentTimeMillis() < until) Thread.sleep(20);
                }
                Assist.done(id, started || g != gen ? "done" : "err");
            } catch (Exception e) {
                Assist.done(id, started ? "done" : "err");
            } finally {
                if (t != null) { try { t.pause(); t.flush(); t.release(); } catch (Exception e) {} }
                if (cur == t) cur = null;
                if (g == gen) Assist.H.post(new Runnable() { public void run() { Assist.ttsPause = false; Assist.applyNow(c); } });
                Assist.H.removeCallbacks(idle);
                Assist.H.postDelayed(idle, 180000);
            }
        } }).start();
    }

    static Callable<float[]> job(final OrtSession s, final long[] ids, final float[] v, final float speed) {
        return new Callable<float[]>() { public float[] call() throws Exception { return synth(s, ids, v, speed); } };
    }

    static AudioTrack track() {
        AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(Build.VERSION.SDK_INT >= 26 ? AudioAttributes.USAGE_ASSISTANT : AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        AudioFormat af = new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
        int min = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT);
        return new AudioTrack(aa, af, Math.max(min, RATE * 4 / 2), AudioTrack.MODE_STREAM, 0);
    }

    static void stop() {
        gen++;
        AudioTrack t = cur;
        if (t != null) { try { t.pause(); t.flush(); } catch (Exception e) {} }
    }
}
