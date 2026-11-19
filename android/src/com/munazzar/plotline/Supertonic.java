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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;

/* Supertonic 3 (Supertone, 1.75.0): a small expressive voice (~99M parameters, 31 languages, 10 voices) on the
   ONNX Runtime the app already has. Text goes in as characters wrapped in a language tag (no phonemizer), a duration
   predictor sets the length, a text encoder and a flow-matching vector estimator (8 steps) make a latent, and a
   vocoder turns it into 44.1 kHz audio. Follows Supertone's MIT-licensed Java example (github.com/supertone-inc/
   supertonic, java/Helper.java); the model is under OpenRAIL-M. Each sentence group is made while the one before
   plays, like Kokoro. Downloads ~401 MB into files/supertonic with resume (Whisper.fetch). */
final class Supertonic {
    static final String HF = "https://huggingface.co/Supertone/supertonic-3/resolve/main/";
    static final String[] VOICES = {"F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"};
    static final String[] ONNX = {"duration_predictor.onnx", "text_encoder.onnx", "vector_estimator.onnx", "vocoder.onnx", "tts.json", "unicode_indexer.json"};
    static final long BYTES = 3700147L + 36416150L + 256534781L + 101424195L + 8253L + 277676L + 10L * 291500L;
    static final String LANGS = ",en,ko,ja,ar,bg,cs,da,de,el,es,et,fi,fr,hi,hr,hu,id,it,lt,lv,nl,pl,pt,ro,ru,sk,sl,sv,tr,uk,vi,";
    static final int STEPS = 8;

    static File dir(Context c) { return new File(c.getFilesDir(), "supertonic"); }
    static boolean have(Context c) { return new File(dir(c), "ready").exists(); }

    /* ---------------- download ---------------- */
    static volatile boolean getting; static volatile String err = "";
    static final long[] GOT = {0};

    static String state(Context c) {
        try { return new JSONObject().put("have", have(c)).put("getting", getting).put("err", err).put("got", GOT[0]).put("total", BYTES).put("mb", BYTES / 1000000).toString(); }
        catch (Exception e) { return "{}"; }
    }

    static void get(final Context c) {
        if (getting || have(c)) return;
        getting = true; err = ""; GOT[0] = 0;
        new Thread(new Runnable() { public void run() {
            try {
                File d = dir(c); new File(d, "voices").mkdirs();
                long done = 0;
                ArrayList<String[]> L = new ArrayList<String[]>();
                for (String f : ONNX) L.add(new String[]{"onnx/" + f, f});
                for (String v : VOICES) L.add(new String[]{"voice_styles/" + v + ".json", "voices/" + v + ".json"});
                for (String[] f : L) {
                    File out = new File(d, f[1]);
                    if (out.exists()) { done += out.length(); GOT[0] = done; continue; }
                    done = Whisper.fetch(HF + f[0], new File(d, f[1] + ".part"), out, done, GOT);
                }
                new FileOutputStream(new File(d, "ready")).close();
            } catch (Exception e) { err = String.valueOf(e.getMessage()); }
            getting = false;
        } }).start();
    }

    static void remove(Context c) {
        stop();
        synchronized (Supertonic.class) { if (M != null) { M.close(); M = null; } }
        del(dir(c));
    }
    static void del(File f) { File[] L = f.listFiles(); if (L != null) for (File x : L) del(x); f.delete(); }

    /* ---------------- the model ---------------- */
    static Model M;
    static synchronized Model model(Context c) throws Exception {
        if (M == null) { if (!have(c)) throw new Exception("The voice isn't downloaded"); M = new Model(dir(c)); }
        return M;
    }

    static String read(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        try { byte[] b = new byte[(int) f.length()]; int o = 0, r; while (o < b.length && (r = in.read(b, o, b.length - o)) > 0) o += r; return new String(b, "UTF-8"); }
        finally { in.close(); }
    }

    static final class Model {
        final OrtEnvironment env = OrtEnvironment.getEnvironment();
        final OrtSession dp, te, ve, voc;
        final long[] idx; final int sr, chunk, ldim;
        final HashMap<String, float[][]> styles = new HashMap<String, float[][]>();
        final File d;
        Model(File d) throws Exception {
            this.d = d;
            OrtSession.SessionOptions o = new OrtSession.SessionOptions();
            o.setIntraOpNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors())));
            o.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            dp = env.createSession(new File(d, "duration_predictor.onnx").getAbsolutePath(), o);
            te = env.createSession(new File(d, "text_encoder.onnx").getAbsolutePath(), o);
            ve = env.createSession(new File(d, "vector_estimator.onnx").getAbsolutePath(), o);
            voc = env.createSession(new File(d, "vocoder.onnx").getAbsolutePath(), o);
            JSONObject cfg = new JSONObject(read(new File(d, "tts.json")));
            sr = cfg.getJSONObject("ae").getInt("sample_rate");
            JSONObject ttl = cfg.getJSONObject("ttl");
            chunk = cfg.getJSONObject("ae").getInt("base_chunk_size") * ttl.getInt("chunk_compress_factor");
            ldim = ttl.getInt("latent_dim") * ttl.getInt("chunk_compress_factor");
            JSONArray a = new JSONArray(read(new File(d, "unicode_indexer.json")));
            idx = new long[a.length()]; for (int i = 0; i < idx.length; i++) idx[i] = a.getLong(i);
        }
        /* {ttl data, dp data, ttl dims, dp dims} */
        synchronized float[][] style(String v) throws Exception {
            float[][] s = styles.get(v); if (s != null) return s;
            JSONObject j = new JSONObject(read(new File(d, "voices/" + v + ".json")));
            float[] t = flat(j.getJSONObject("style_ttl").getJSONArray("data")), p = flat(j.getJSONObject("style_dp").getJSONArray("data"));
            JSONArray td = j.getJSONObject("style_ttl").getJSONArray("dims"), pd = j.getJSONObject("style_dp").getJSONArray("dims");
            s = new float[][]{t, p, {(float) td.getLong(0), (float) td.getLong(1), (float) td.getLong(2)}, {(float) pd.getLong(0), (float) pd.getLong(1), (float) pd.getLong(2)}};
            styles.put(v, s); return s;
        }
        void close() { try { dp.close(); te.close(); ve.close(); voc.close(); } catch (Exception e) { } }
    }

    static float[] flat(JSONArray a) throws Exception {
        ArrayList<Double> L = new ArrayList<Double>(); walk(a, L);
        float[] f = new float[L.size()]; for (int i = 0; i < f.length; i++) f[i] = L.get(i).floatValue(); return f;
    }
    static void walk(JSONArray a, ArrayList<Double> L) throws Exception {
        for (int i = 0; i < a.length(); i++) { Object x = a.get(i); if (x instanceof JSONArray) walk((JSONArray) x, L); else L.add(((Number) x).doubleValue()); }
    }
    static long[] dims(float[] d) { return new long[]{(long) d[0], (long) d[1], (long) d[2]}; }

    /* the same clean-up as Supertone's example, then <lang>text</lang> */
    static String prep(String t, String lang) {
        t = Normalizer.normalize(t, Normalizer.Form.NFKD);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < t.length(); ) {
            int cp = t.codePointAt(i); i += Character.charCount(cp);
            boolean emoji = (cp >= 0x1F000 && cp <= 0x1FAFF) || (cp >= 0x2600 && cp <= 0x27BF);
            if (!emoji) b.appendCodePoint(cp);
        }
        t = b.toString().replace('–', '-').replace('‑', '-').replace('—', '-').replace('_', ' ').replace('“', '"').replace('”', '"')
            .replace('‘', '\'').replace('’', '\'').replace('´', '\'').replace('`', '\'').replace('[', ' ').replace(']', ' ').replace('|', ' ')
            .replace('/', ' ').replace('#', ' ').replace('→', ' ').replace('←', ' ').replaceAll("[♥☆♡©\\\\*]", "")
            .replace("@", " at ").replace("e.g.,", "for example, ").replace("i.e.,", "that is, ")
            .replaceAll(" ([,.!?;:'])", "$1").replaceAll("\"{2,}", "\"").replaceAll("'{2,}", "'").replaceAll("\\s+", " ").trim();
        if (!t.matches("(?s).*[.!?;:,'\"\\u201C\\u201D\\u2018\\u2019)\\]}…。」』】〉》›»]$")) t += ".";
        if (LANGS.indexOf("," + lang + ",") < 0) lang = "en";
        return "<" + lang + ">" + t + "</" + lang + ">";
    }

    /* one piece of text (≤ 300 characters) to audio */
    static float[] synth(Model m, String text, String lang, String voice, float speed) throws Exception {
        String s = prep(text, lang);
        int[] cps = s.codePoints().toArray(); int L = cps.length;
        long[] ids = new long[L]; float[] mask = new float[L];
        for (int i = 0; i < L; i++) { ids[i] = cps[i] < m.idx.length ? m.idx[cps[i]] : 0; mask[i] = 1; }
        float[][] st = m.style(voice);
        OnnxTensor tid = OnnxTensor.createTensor(m.env, LongBuffer.wrap(ids), new long[]{1, L});
        OnnxTensor tm = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(mask), new long[]{1, 1, L});
        OnnxTensor sttl = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(st[0]), dims(st[2]));
        OnnxTensor sdp = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(st[1]), dims(st[3]));
        OrtSession.Result dr = null, er = null;
        try {
            Map<String, OnnxTensor> in = new HashMap<String, OnnxTensor>();
            in.put("text_ids", tid); in.put("style_dp", sdp); in.put("text_mask", tm);
            dr = m.dp.run(in);
            float dur = ((OnnxTensor) dr.get(0)).getFloatBuffer().get(0) / speed;
            in = new HashMap<String, OnnxTensor>();
            in.put("text_ids", tid); in.put("style_ttl", sttl); in.put("text_mask", tm);
            er = m.te.run(in);
            OnnxTensor emb = (OnnxTensor) er.get(0);
            int T = Math.max(1, (int) Math.ceil(dur * m.sr / m.chunk)), D = m.ldim;
            float[] x = new float[D * T]; Random r = new Random();
            for (int i = 0; i < x.length; i++) x[i] = (float) r.nextGaussian();
            float[] lm = new float[T]; for (int i = 0; i < T; i++) lm[i] = 1;
            OnnxTensor lmt = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(lm), new long[]{1, 1, T});
            OnnxTensor tot = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(new float[]{STEPS}), new long[]{1});
            try {
                for (int k = 0; k < STEPS; k++) {
                    OnnxTensor xt = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(x), new long[]{1, D, T});
                    OnnxTensor cur = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(new float[]{k}), new long[]{1});
                    in = new HashMap<String, OnnxTensor>();
                    in.put("noisy_latent", xt); in.put("text_emb", emb); in.put("style_ttl", sttl); in.put("latent_mask", lmt);
                    in.put("text_mask", tm); in.put("current_step", cur); in.put("total_step", tot);
                    OrtSession.Result vr = m.ve.run(in);
                    try { FloatBuffer fb = ((OnnxTensor) vr.get(0)).getFloatBuffer(); x = new float[fb.remaining()]; fb.get(x); }
                    finally { vr.close(); xt.close(); cur.close(); }
                }
            } finally { lmt.close(); tot.close(); }
            OnnxTensor lt = OnnxTensor.createTensor(m.env, FloatBuffer.wrap(x), new long[]{1, D, T});
            in = new HashMap<String, OnnxTensor>(); in.put("latent", lt);
            OrtSession.Result wr = m.voc.run(in);
            try {
                FloatBuffer w = ((OnnxTensor) wr.get(0)).getFloatBuffer();
                int n = Math.min(w.remaining(), (int) (dur * m.sr));
                float[] pcm = new float[Math.max(0, n)]; w.get(pcm); return pcm;
            } finally { wr.close(); lt.close(); }
        } finally {
            if (dr != null) dr.close(); if (er != null) er.close();
            tid.close(); tm.close(); sttl.close(); sdp.close();
        }
    }

    /* sentences joined into pieces of up to 300 characters (Supertone's limit) */
    static ArrayList<String> pieces(String text) {
        ArrayList<String> out = new ArrayList<String>(); StringBuilder cur = new StringBuilder();
        for (String s : text.trim().split("(?<=[.!?…。])\\s+|\\n+")) {
            s = s.trim(); if (s.length() == 0) continue;
            while (s.length() > 300) { int c = s.lastIndexOf(", ", 300); if (c < 100) c = s.lastIndexOf(' ', 300); if (c < 50) c = 300; if (cur.length() > 0) { out.add(cur.toString()); cur.setLength(0); } out.add(s.substring(0, c).trim()); s = s.substring(c).replaceFirst("^[,\\s]+", ""); }
            if (cur.length() > 0 && cur.length() + 1 + s.length() > 300) { out.add(cur.toString()); cur.setLength(0); }
            if (cur.length() > 0) cur.append(' '); cur.append(s);
        }
        if (cur.length() > 0) out.add(cur.toString());
        return out;
    }

    /* ---------------- speaking (like Kokoro.say) ---------------- */
    static volatile int gen; static volatile AudioTrack cur;
    static final ExecutorService SYN = Executors.newSingleThreadExecutor();

    static void say(final Context c, final String id, final String text, final String voice, final String lang, final double rate) {
        stop(); Kokoro.stop();
        final int g = gen;
        new Thread(new Runnable() { public void run() {
            boolean started = false; AudioTrack t = null;
            try {
                final Model m = model(c);
                final String v = java.util.Arrays.asList(VOICES).contains(voice) ? voice : "F1";
                final float speed = (float) (1.05 * Math.max(0.5, Math.min(2, rate > 0 ? rate : 1)));
                final ArrayList<String> ps = pieces(text == null ? "" : text);
                if (ps.isEmpty()) { Assist.done(id, "done"); return; }
                Future<float[]> next = SYN.submit(job(m, ps.get(0), lang, v, speed));
                long frames = 0;
                for (int i = 0; i < ps.size() && g == gen; i++) {
                    float[] pcm = next.get();
                    next = i + 1 < ps.size() ? SYN.submit(job(m, ps.get(i + 1), lang, v, speed)) : null;
                    if (g != gen) break;
                    if (t == null) {
                        t = track(m.sr); cur = t;
                        Assist.H.post(new Runnable() { public void run() { WakeLoop.unmute(); Assist.ttsPause = true; Assist.applyNow(c); } });
                        t.play(); started = true;
                    }
                    /* a short breath between pieces */
                    if (i > 0) { float[] z = new float[m.sr / 5]; t.write(z, 0, z.length, AudioTrack.WRITE_BLOCKING); frames += z.length; }
                    for (int off = 0; off < pcm.length && g == gen; ) { int n = t.write(pcm, off, Math.min(4800, pcm.length - off), AudioTrack.WRITE_BLOCKING); if (n <= 0) break; off += n; }
                    frames += pcm.length;
                }
                if (t != null && g == gen) {
                    long until = System.currentTimeMillis() + frames * 1000 / m.sr + 1500;
                    while (g == gen && (t.getPlaybackHeadPosition() & 0xFFFFFFFFL) < frames && System.currentTimeMillis() < until) Thread.sleep(20);
                }
                Assist.done(id, started || g != gen ? "done" : "err");
            } catch (Exception e) {
                Assist.done(id, started ? "done" : "err");
            } finally {
                if (t != null) { try { t.pause(); t.flush(); t.release(); } catch (Exception e) { } }
                if (cur == t) cur = null;
                if (g == gen) Assist.H.post(new Runnable() { public void run() { Assist.ttsPause = false; Assist.applyNow(c); } });
            }
        } }).start();
    }

    /* test hook (tools/android-test/supertonic-test.sh): says the text into a 16 kHz WAV at path, so Whisper can check
       what was said. Returns the milliseconds it took, or "err: …" */
    static String file(Context c, String text, String voice, String lang, String path) {
        try {
            long t0 = System.currentTimeMillis(); Model m = model(c);
            ArrayList<float[]> P = new ArrayList<float[]>(); int n = 0;
            for (String s : pieces(text)) { float[] p = synth(m, s, lang, voice, 1.05f); P.add(p); n += p.length; }
            float[] a = new float[n]; int o = 0; for (float[] p : P) { System.arraycopy(p, 0, a, o, p.length); o += p.length; }
            int N = (int) ((long) n * 16000 / m.sr); byte[] b = new byte[44 + N * 2];
            java.nio.ByteBuffer w = java.nio.ByteBuffer.wrap(b).order(java.nio.ByteOrder.LITTLE_ENDIAN);
            w.put("RIFF".getBytes()).putInt(36 + N * 2).put("WAVEfmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1).putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(N * 2);
            for (int i = 0; i < N; i++) { double x = (double) i * m.sr / 16000; int k = (int) x; float v = k + 1 < n ? (float) (a[k] + (a[k + 1] - a[k]) * (x - k)) : a[Math.min(k, n - 1)]; w.putShort((short) Math.max(-32768, Math.min(32767, v * 32767))); }
            FileOutputStream f = new FileOutputStream(path); try { f.write(b); } finally { f.close(); }
            return String.valueOf(System.currentTimeMillis() - t0);
        } catch (Exception e) { return "err: " + e.getMessage(); }
    }

    static Callable<float[]> job(final Model m, final String s, final String lang, final String v, final float speed) {
        return new Callable<float[]>() { public float[] call() throws Exception { return synth(m, s, lang, v, speed); } };
    }

    static AudioTrack track(int rate) {
        AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(Build.VERSION.SDK_INT >= 26 ? AudioAttributes.USAGE_ASSISTANT : AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        AudioFormat af = new AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
        int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT);
        return new AudioTrack(aa, af, Math.max(min, rate * 2), AudioTrack.MODE_STREAM, 0);
    }

    static void stop() { gen++; AudioTrack t = cur; if (t != null) { try { t.pause(); t.flush(); } catch (Exception e) { } } }
}
