package com.munazzar.plotline;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OnnxValue;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONObject;

/* Listening with Whisper (1.74.0): OpenAI's Whisper speech-to-text running on the phone, in the sherpa-onnx export
   (k2-fsa, Apache-2.0; the same files the WhisprKey keyboard uses), on the ONNX Runtime the app already has for Kokoro.
   Every mic in the app goes through it once a model is downloaded (PlotlineAssist.whisperListen): the phone records,
   finds where you stop talking, turns the audio into a log-mel picture exactly like Whisper's own code, runs the encoder
   once and the decoder token by token (greedy), and hands the text to the page as window.__voice(id, kind, text),
   the same events the phone's own recognizer sends. Long talk is cut at pauses into pieces under 25 s (Whisper's window
   is 30 s); each piece is written down while you keep talking, and shown as it's done.
   Models: "turbo" (large-v3-turbo, 989 MB, the most accurate) and "base" (161 MB, quick), 8-bit, from Hugging Face. */
final class Whisper {
    static final String HF = "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-";
    static final String[] NAMES = {"turbo", "base"};
    static final long[] BYTES = {361080764L + 674716297L + 816730L, 130672026L + 29120534L + 816730L};
    static final int SR = 16000, HOP = 160, NFFT = 400;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("plotline_whisper", 0); }
    static File dir(Context c, String n) { return new File(c.getFilesDir(), "whisper/" + n); }
    static boolean have(Context c, String n) { return new File(dir(c, n), "ready").exists(); }
    static String use(Context c) {
        String u = prefs(c).getString("use", "");
        if (u.length() > 0 && have(c, u)) return u;
        for (String n : NAMES) if (have(c, n)) return n;
        return "";
    }

    /* ---------------- downloads ---------------- */
    static volatile String getting = "", err = "";
    static volatile long got = 0, total = 0;

    static String state(Context c) {
        try {
            JSONObject o = new JSONObject(), h = new JSONObject();
            for (String n : NAMES) h.put(n, have(c, n));
            o.put("have", h).put("use", use(c)).put("getting", getting).put("err", err).put("got", got).put("total", total)
             .put("loaded", M == null ? "" : M.name).put("on", prefs(c).getBoolean("on", true));
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    static void get(final Context c, final String n) {
        if (getting.length() > 0) return;
        int k = -1; for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(n)) k = i;
        if (k < 0) return;
        getting = n; err = ""; got = 0; total = BYTES[k];
        new Thread(new Getter(c.getApplicationContext(), n)).start();
    }

    static final class Getter implements Runnable {
        final Context c; final String n;
        Getter(Context c, String n) { this.c = c; this.n = n; }
        public void run() {
            try {
                File d = dir(c, n); d.mkdirs();
                String[][] F = {{n + "-encoder.int8.onnx", "enc.onnx"}, {n + "-decoder.int8.onnx", "dec.onnx"}, {n + "-tokens.txt", "tokens.txt"}};
                long done = 0;
                for (String[] f : F) {
                    File out = new File(d, f[1]);
                    if (out.exists()) { done += out.length(); got = done; continue; }
                    done = fetch(HF + n + "/resolve/main/" + f[0], new File(d, f[1] + ".part"), out, done);
                }
                new FileOutputStream(new File(d, "ready")).close();
                prefs(c).edit().putString("use", n).apply();
            } catch (Exception e) { err = String.valueOf(e.getMessage()); }
            getting = "";
        }
    }

    /* resumes a part file after a dropped connection (a 1 GB download on a phone will sometimes drop) */
    static long fetch(String url, File part, File out, long before) throws Exception {
        for (int tries = 0; ; tries++) {
            long have = part.exists() ? part.length() : 0;
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
            h.setConnectTimeout(20000); h.setReadTimeout(60000); h.setInstanceFollowRedirects(true);
            if (have > 0) h.setRequestProperty("Range", "bytes=" + have + "-");
            try {
                int code = h.getResponseCode();
                if (code == 416) { if (!part.renameTo(out)) throw new Exception("Couldn't save the model"); return before + out.length(); }
                if (code != 200 && code != 206) throw new Exception("The download said " + code);
                if (code == 200) have = 0;
                InputStream in = h.getInputStream();
                FileOutputStream o = new FileOutputStream(part, have > 0);
                byte[] b = new byte[1 << 16]; int r; long n = have;
                try { while ((r = in.read(b)) > 0) { o.write(b, 0, r); n += r; got = before + n; } } finally { o.close(); in.close(); }
                if (!part.renameTo(out)) throw new Exception("Couldn't save the model");
                return before + out.length();
            } catch (Exception e) {
                if (tries >= 4 || (e.getMessage() != null && e.getMessage().startsWith("The download said"))) throw e;
                Thread.sleep(2000L * (tries + 1));
            } finally { h.disconnect(); }
        }
    }

    static void remove(Context c, String n) {
        synchronized (Whisper.class) { if (M != null && M.name.equals(n)) { M.close(); M = null; } }
        File d = dir(c, n); File[] L = d.listFiles();
        if (L != null) for (File f : L) f.delete();
        d.delete();
    }

    static void setUse(Context c, String n, boolean on) { prefs(c).edit().putString("use", n == null ? "" : n).putBoolean("on", on).apply(); }

    /* ---------------- the model ---------------- */
    static Model M;
    static OrtEnvironment env;

    static synchronized Model model(Context c) throws Exception {
        String n = use(c);
        if (n.length() == 0) throw new Exception("No Whisper model on this phone");
        if (M != null && M.name.equals(n)) return M;
        if (M != null) { M.close(); M = null; }
        M = new Model(n, dir(c, n));
        return M;
    }

    static void warm(final Context c) {
        new Thread(new Runnable() { public void run() { try { model(c); } catch (Throwable e) { } } }).start();
    }

    static final class Model {
        final String name;
        final OrtSession enc, dec;
        final String encIn; final String[] decIn;
        final int nMels, nLayer, nCtx, nState, sot, eot, transcribe, noTs;
        final boolean multi;
        final int[] sotSeq, langTok; final String[] langCode;
        final String[] tok;
        final float[][] mel;

        Model(String name, File d) throws Exception {
            this.name = name;
            if (env == null) { env = OrtEnvironment.getEnvironment(); }
            OrtSession.SessionOptions o = new OrtSession.SessionOptions();
            o.setIntraOpNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors())));
            o.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            enc = env.createSession(new File(d, "enc.onnx").getAbsolutePath(), o);
            dec = env.createSession(new File(d, "dec.onnx").getAbsolutePath(), o);
            encIn = enc.getInputNames().iterator().next();
            decIn = dec.getInputNames().toArray(new String[0]);
            Map<String, String> m = enc.getMetadata().getCustomMetadata();
            nMels = num(m, "n_mels", 80); nLayer = num(m, "n_text_layer", 4); nCtx = num(m, "n_text_ctx", 448); nState = num(m, "n_text_state", 384);
            sot = num(m, "sot", 50258); eot = num(m, "eot", 50257); transcribe = num(m, "transcribe", 50359); noTs = num(m, "no_timestamps", 50363);
            multi = num(m, "is_multilingual", 0) != 0;
            sotSeq = ints(m.get("sot_sequence"), new int[]{sot});
            langTok = multi ? ints(m.get("all_language_tokens"), new int[0]) : new int[0];
            langCode = multi && m.get("all_language_codes") != null ? m.get("all_language_codes").split(",") : new String[0];
            tok = tokens(new File(d, "tokens.txt"));
            mel = filters(nMels);
        }
        void close() { try { enc.close(); } catch (Exception e) { } try { dec.close(); } catch (Exception e) { } }
    }

    static int num(Map<String, String> m, String k, int def) { try { return Integer.parseInt(m.get(k).trim()); } catch (Exception e) { return def; } }
    static int[] ints(String s, int[] def) {
        if (s == null || s.trim().length() == 0) return def;
        String[] p = s.split(","); int[] r = new int[p.length];
        for (int i = 0; i < p.length; i++) r[i] = Integer.parseInt(p[i].trim());
        return r;
    }

    /* tokens.txt: "<base64 bytes> <id>" per line */
    static String[] tokens(File f) throws Exception {
        HashMap<Integer, byte[]> map = new HashMap<Integer, byte[]>(); int max = 0;
        BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), "UTF-8"));
        try {
            String l;
            while ((l = r.readLine()) != null) {
                int sp = l.lastIndexOf(' '); if (sp <= 0) continue;
                int id = Integer.parseInt(l.substring(sp + 1).trim());
                byte[] b; try { b = Base64.decode(l.substring(0, sp), Base64.DEFAULT); } catch (Exception e) { b = l.substring(0, sp).getBytes("UTF-8"); }
                map.put(id, b); if (id > max) max = id;
            }
        } finally { r.close(); }
        String[] t = new String[max + 1];
        for (Map.Entry<Integer, byte[]> e : map.entrySet()) t[e.getKey()] = new String(e.getValue(), "ISO-8859-1");
        return t; /* kept as raw bytes (one char per byte) and decoded as UTF-8 once the whole text is joined */
    }

    /* Whisper's mel filters (librosa, Slaney scale and norm), 16 kHz, 400-point FFT */
    static float[][] filters(int n) {
        double fmax = SR / 2.0, mMin = hz2mel(0), mMax = hz2mel(fmax);
        double[] hz = new double[n + 2];
        for (int i = 0; i < n + 2; i++) hz[i] = mel2hz(mMin + (mMax - mMin) * i / (n + 1));
        float[][] w = new float[n][NFFT / 2 + 1];
        for (int i = 0; i < n; i++) {
            double en = 2.0 / (hz[i + 2] - hz[i]);
            for (int k = 0; k <= NFFT / 2; k++) {
                double f = (double) k * SR / NFFT;
                double lo = (f - hz[i]) / (hz[i + 1] - hz[i]), up = (hz[i + 2] - f) / (hz[i + 2] - hz[i + 1]);
                w[i][k] = (float) (Math.max(0, Math.min(lo, up)) * en);
            }
        }
        return w;
    }
    static double hz2mel(double f) { return f < 1000 ? f / (200.0 / 3) : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27); }
    static double mel2hz(double m) { return m < 15 ? m * (200.0 / 3) : 1000 * Math.exp((m - 15) * (Math.log(6.4) / 27)); }

    static float[] COS, SIN, WIN;
    /* log-mel like whisper/audio.py: centred STFT (reflect padding), periodic Hann, |X|², mel, log10, top 8 dB kept, (x+4)/4.
       Returns [nMels][T] flattened, T = frames + up to 1000 frames of zeros (as sherpa-onnx does, so it finds the end). */
    static float[] logMel(Model m, float[] x, int[] outT) {
        if (COS == null) {
            float[] c = new float[NFFT], s = new float[NFFT], w = new float[NFFT];
            for (int i = 0; i < NFFT; i++) { c[i] = (float) Math.cos(2 * Math.PI * i / NFFT); s[i] = (float) Math.sin(2 * Math.PI * i / NFFT); w[i] = (float) (0.5 - 0.5 * Math.cos(2 * Math.PI * i / NFFT)); }
            COS = c; SIN = s; WIN = w;
        }
        int n = x.length, F = Math.max(1, n / HOP), K = NFFT / 2 + 1, T = Math.min(3000, F + 1000);
        float[] spec = new float[K], frame = new float[NFFT], out = new float[m.nMels * T];
        float mx = -1e30f;
        float[] lm = new float[m.nMels * F];
        for (int f = 0; f < F; f++) {
            int st = f * HOP - NFFT / 2;
            for (int i = 0; i < NFFT; i++) {
                int j = st + i;
                if (j < 0) j = -j; if (j >= n) j = 2 * n - 2 - j; if (j < 0) j = 0; if (j >= n) j = n - 1;
                frame[i] = x[j] * WIN[i];
            }
            for (int k = 0; k < K; k++) {
                float re = 0, im = 0; int idx = 0;
                for (int i = 0; i < NFFT; i++) { re += frame[i] * COS[idx]; im -= frame[i] * SIN[idx]; idx += k; if (idx >= NFFT) idx -= NFFT; }
                spec[k] = re * re + im * im;
            }
            for (int b = 0; b < m.nMels; b++) {
                float[] w = m.mel[b]; float s = 0;
                for (int k = 0; k < K; k++) s += w[k] * spec[k];
                float v = (float) Math.log10(Math.max(s, 1e-10f));
                lm[b * F + f] = v; if (v > mx) mx = v;
            }
        }
        float floor = mx - 8;
        for (int b = 0; b < m.nMels; b++) for (int f = 0; f < F; f++) out[b * T + f] = (Math.max(lm[b * F + f], floor) + 4) / 4;
        outT[0] = T;
        return out;
    }

    /* one piece of audio (≤ 25 s, floats in -1..1) to text */
    static String transcribe(Model m, float[] audio, String lang) throws Exception {
        int[] T = new int[1];
        float[] mel = logMel(m, audio, T);
        OnnxTensor in = OnnxTensor.createTensor(env, FloatBuffer.wrap(mel), new long[]{1, m.nMels, T[0]});
        OrtSession.Result er;
        Map<String, OnnxTensor> f = new HashMap<String, OnnxTensor>(); f.put(m.encIn, in);
        try { er = m.enc.run(f); } finally { in.close(); }
        try {
            OnnxTensor ck = (OnnxTensor) er.get(0), cv = (OnnxTensor) er.get(1);
            ArrayList<Integer> init = new ArrayList<Integer>();
            init.add(m.sot);
            if (m.multi) {
                int lt = -1;
                String lc = lang == null ? "" : lang.toLowerCase();
                int dash = lc.indexOf('-'); if (dash > 0) lc = lc.substring(0, dash);
                for (int i = 0; i < m.langCode.length && i < m.langTok.length; i++) if (m.langCode[i].trim().equals(lc)) lt = m.langTok[i];
                if (lt < 0) lt = detect(m, ck, cv);
                init.add(lt); init.add(m.transcribe);
            }
            init.add(m.noTs);
            int max = Math.min(m.nCtx / 2, 12 + (int) (audio.length / (float) SR * 7));
            return text(m, decode(m, ck, cv, init, max));
        } finally { er.close(); }
    }

    static float[] zeros(Model m) { return new float[m.nLayer * m.nCtx * m.nState]; }

    static int detect(Model m, OnnxTensor ck, OnnxTensor cv) throws Exception {
        ArrayList<Integer> one = new ArrayList<Integer>(); one.add(m.sot);
        Step s = step(m, one, null, null, ck, cv, 0);
        try {
            int best = m.langTok.length > 0 ? m.langTok[0] : m.sot; float bv = -1e30f;
            for (int t : m.langTok) if (t < s.logits.length && s.logits[t] > bv) { bv = s.logits[t]; best = t; }
            return best;
        } finally { s.close(); }
    }

    static final class Step {
        float[] logits; OrtSession.Result r; OnnxTensor k, v;
        void close() { if (r != null) r.close(); }
    }

    /* one decoder call; the caches it returns go straight into the next call (no copying) */
    static Step step(Model m, ArrayList<Integer> toks, OnnxTensor sk, OnnxTensor sv, OnnxTensor ck, OnnxTensor cv, long offset) throws Exception {
        long[] t = new long[toks.size()]; for (int i = 0; i < t.length; i++) t[i] = toks.get(i);
        OnnxTensor tt = OnnxTensor.createTensor(env, LongBuffer.wrap(t), new long[]{1, t.length});
        OnnxTensor off = OnnxTensor.createTensor(env, LongBuffer.wrap(new long[]{offset}), new long[]{1});
        OnnxTensor zk = null, zv = null;
        long[] cs = new long[]{m.nLayer, 1, m.nCtx, m.nState};
        if (sk == null) { zk = OnnxTensor.createTensor(env, FloatBuffer.wrap(zeros(m)), cs); zv = OnnxTensor.createTensor(env, FloatBuffer.wrap(zeros(m)), cs); sk = zk; sv = zv; }
        /* by name (tokens, in_n_layer_self_k_cache, in_n_layer_self_v_cache, n_layer_cross_k, n_layer_cross_v, offset) */
        Map<String, OnnxTensor> f = new HashMap<String, OnnxTensor>();
        for (String nm : m.decIn) {
            String l = nm.toLowerCase();
            f.put(nm, l.contains("self_k") ? sk : l.contains("self_v") ? sv : l.contains("cross_k") ? ck : l.contains("cross_v") ? cv : l.contains("offset") ? off : tt);
        }
        Step s = new Step();
        try { s.r = m.dec.run(f); }
        finally { tt.close(); off.close(); if (zk != null) zk.close(); if (zv != null) zv.close(); }
        FloatBuffer lb = ((OnnxTensor) s.r.get(0)).getFloatBuffer();
        int V = lb.capacity() / t.length; float[] lg = new float[V];
        lb.position((t.length - 1) * V); lb.get(lg);
        s.logits = lg; s.k = (OnnxTensor) s.r.get(1); s.v = (OnnxTensor) s.r.get(2);
        return s;
    }

    static ArrayList<Integer> decode(Model m, OnnxTensor ck, OnnxTensor cv, ArrayList<Integer> init, int max) throws Exception {
        ArrayList<Integer> out = new ArrayList<Integer>();
        Step s = step(m, init, null, null, ck, cv, 0);
        long offset = init.size();
        try {
            for (int n = 0; n < max; n++) {
                int best = 0; float bv = -1e30f;
                for (int i = 0; i < s.logits.length; i++) if (s.logits[i] > bv) { bv = s.logits[i]; best = i; }
                if (best == m.eot || offset >= m.nCtx - 1) break;
                out.add(best);
                /* the same short phrase three times running is Whisper looping on noise: keep one and stop */
                int lp = loops(out);
                if (lp > 0) { out.subList(out.size() - 2 * lp, out.size()).clear(); break; }
                ArrayList<Integer> one = new ArrayList<Integer>(); one.add(best);
                Step next = step(m, one, s.k, s.v, ck, cv, offset);
                s.close(); s = next; offset++;
            }
        } finally { s.close(); }
        return out;
    }

    /* the length of a phrase repeated 3 times at the end (a repeated word counts from 2 tokens), else 0 */
    static int loops(ArrayList<Integer> o) {
        int n = o.size();
        for (int p = 2; p <= 12 && 3 * p <= n; p++) {
            boolean rep = true;
            for (int i = 0; i < 2 * p && rep; i++) rep = o.get(n - 1 - i).equals(o.get(n - 1 - i - p));
            if (rep) return p;
        }
        return 0;
    }

    static String text(Model m, ArrayList<Integer> ids) throws Exception {
        StringBuilder b = new StringBuilder();
        for (int id : ids) if (id < m.eot && id < m.tok.length && m.tok[id] != null) b.append(m.tok[id]);
        String s = new String(b.toString().getBytes("ISO-8859-1"), "UTF-8").replaceAll("\\s+", " ").trim();
        /* what Whisper writes for silence or noise */
        if (s.matches("(?i)^[\\[(].*[\\])]$|^(thank you\\.?|thanks for watching!?|you)$")) return "";
        return s;
    }

    /* ---------------- listening ---------------- */
    static volatile Rec cur;

    static void listen(MainActivity a, String id, String lang, int pauseMs, int waitMs) {
        Rec old = cur; if (old != null) old.cancel = true;
        Rec r = new Rec(a, id, lang, Math.max(800, pauseMs), Math.max(3000, waitMs));
        cur = r; new Thread(r).start();
    }
    static void stop() { Rec r = cur; if (r != null) r.finish = true; }
    static void cancel() { Rec r = cur; if (r != null) { r.cancel = true; cur = null; } }

    static final class Rec implements Runnable {
        final WeakReference<MainActivity> a; final Context ctx; final String id, lang; final int pause, wait;
        volatile boolean finish, cancel;
        final StringBuffer said = new StringBuffer();
        final Object lock = new Object(); int pending = 0;
        Rec(MainActivity a, String id, String lang, int pause, int wait) { this.a = new WeakReference<MainActivity>(a); this.ctx = a.getApplicationContext(); this.id = id; this.lang = lang; this.pause = pause; this.wait = wait; }

        void send(String kind, String text) {
            if (cancel) return;
            MainActivity m = a.get(); if (m == null) return;
            m.js("window.__voice&&window.__voice(" + JSONObject.quote(id) + "," + JSONObject.quote(kind) + "," + JSONObject.quote(text == null ? "" : text) + ")");
        }

        public void run() {
            Model m;
            try { m = model(ctx); } catch (Throwable e) { send("err", "whisper:" + e.getMessage()); return; }
            int min = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            AudioRecord ar;
            try {
                ar = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, SR));
                if (ar.getState() != AudioRecord.STATE_INITIALIZED) { ar.release(); send("err", "3"); return; }
                ar.startRecording();
            } catch (SecurityException e) { send("err", "perm"); return; } catch (Throwable e) { send("err", "3"); return; }
            send("ready", "");
            final int FR = 320; /* 20 ms */
            short[] buf = new short[FR];
            float[] seg = new float[SR * 30]; int len = 0; /* the current piece */
            float nf = -50; int speech = 0, silent = 0, lastQuiet = -1, frames = 0;
            boolean heard = false; long t0 = System.currentTimeMillis();
            try {
                while (!cancel && !finish) {
                    int r = 0; while (r < FR) { int k = ar.read(buf, r, FR - r); if (k <= 0) break; r += k; }
                    if (r < FR) break;
                    double e = 0; for (int i = 0; i < FR; i++) e += (double) buf[i] * buf[i];
                    double db = 10 * Math.log10(e / FR / (32768.0 * 32768.0) + 1e-12);
                    if (db < nf) nf = (float) (nf * 0.7 + db * 0.3); else nf += (float) ((db - nf) * 0.005);
                    boolean on = db > Math.max(nf + 10, -55);
                    if ((frames++ & 1) == 0) send("level", String.valueOf((float) ((db + 60) / 50 * 12 - 2)));
                    if (len + FR > seg.length) { cut(m, seg, len); len = 0; }
                    for (int i = 0; i < FR; i++) seg[len + i] = buf[i] / 32768f;
                    len += FR;
                    if (on) { speech++; silent = 0; } else { silent++; if (speech < 5) speech = 0; }
                    if (!heard) {
                        if (speech >= 5) heard = true;
                        /* keep only the last 0.4 s from before they started talking */
                        else if (len > SR * 2) { int keep = SR * 2 / 5; System.arraycopy(seg, len - keep, seg, 0, keep); len = keep; }
                        if (!heard && System.currentTimeMillis() - t0 > wait) { send("err", "6"); return; }
                        continue;
                    }
                    if (silent * 20 >= pause) break;
                    /* a long piece: write down what's said so far at a pause after 18 s (or the last pause before 25 s,
                       or at 25 s if there was none) and keep listening */
                    if (silent == 12) lastQuiet = len - 6 * FR;
                    if ((len >= SR * 18 && silent == 12) || len >= SR * 25) {
                        int at = silent == 12 ? lastQuiet : lastQuiet > SR * 10 ? lastQuiet : len;
                        float[] p = new float[at]; System.arraycopy(seg, 0, p, 0, at);
                        System.arraycopy(seg, at, seg, 0, len - at); len -= at; lastQuiet = -1;
                        queue(m, p);
                    }
                }
            } finally { try { ar.stop(); } catch (Throwable e) { } ar.release(); }
            if (cancel) return;
            if (!heard && len < SR / 2) { send("err", "6"); return; }
            send("busy", "");
            int end = Math.max(0, len - Math.max(0, silent - 15) * FR); /* drop the trailing silence, keep 0.3 s */
            if (end > SR / 4) { float[] p = new float[end]; System.arraycopy(seg, 0, p, 0, end); queue(m, p); }
            synchronized (lock) { while (pending > 0 && !cancel) { try { lock.wait(500); } catch (InterruptedException e) { break; } } }
            if (cur == this) cur = null;
            send("final", said.toString().trim());
        }

        void cut(Model m, float[] seg, int len) { float[] p = new float[len]; System.arraycopy(seg, 0, p, 0, len); queue(m, p); }

        /* pieces are written down one after another, off the recording thread */
        void queue(final Model m, final float[] p) {
            synchronized (lock) { pending++; }
            Q.execute(new Piece(this, m, p));
        }
        void piece(Model m, float[] p) {
            try {
                if (!cancel) {
                    String t = transcribe(m, p, lang);
                    if (t.length() > 0) { if (said.length() > 0) said.append(' '); said.append(t); send("partial", said.toString()); }
                }
            } catch (Throwable e) { send("err", "whisper:" + e.getMessage()); }
            synchronized (lock) { pending--; lock.notifyAll(); }
        }
    }

    /* a recording (16-bit PCM WAV, 16 kHz mono; a file path or a URL) written down the same way, in pieces of up to 25 s: used by the emulator
       test (tools/android-test/whisper-test.sh), which can't speak into the mic */
    static void file(final MainActivity a, final String id, final String path, final String lang) {
        final Rec r = new Rec(a, id, lang, 1000, 1000);
        new Thread(new Runnable() { public void run() {
            try {
                Model m = model(r.ctx);
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                InputStream in = path.startsWith("http") ? new URL(path).openStream() : new FileInputStream(path);
                try { byte[] t = new byte[1 << 16]; int k; while ((k = in.read(t)) > 0) bo.write(t, 0, k); } finally { in.close(); }
                byte[] b = bo.toByteArray();
                int p = 12, data = -1, len = 0;
                while (p + 8 <= b.length) { int sz = (b[p + 4] & 255) | (b[p + 5] & 255) << 8 | (b[p + 6] & 255) << 16 | (b[p + 7] & 255) << 24; if (b[p] == 'd' && b[p + 1] == 'a' && b[p + 2] == 't' && b[p + 3] == 'a') { data = p + 8; len = Math.min(sz, b.length - data); break; } p += 8 + sz; }
                if (data < 0) { r.send("err", "whisper:not a WAV file"); return; }
                int n = len / 2; float[] x = new float[n];
                for (int i = 0; i < n; i++) x[i] = (short) ((b[data + 2 * i] & 255) | (b[data + 2 * i + 1] << 8)) / 32768f;
                long t0 = System.currentTimeMillis();
                for (int s = 0; s < n; s += SR * 25) { int e = Math.min(n, s + SR * 25); float[] piece = new float[e - s]; System.arraycopy(x, s, piece, 0, e - s); r.queue(m, piece); }
                synchronized (r.lock) { while (r.pending > 0) r.lock.wait(500); }
                r.send("final", r.said.toString().trim() + " [" + (System.currentTimeMillis() - t0) + " ms]");
            } catch (Throwable e) { r.send("err", "whisper:" + e.getMessage()); }
        } }).start();
    }

    static final java.util.concurrent.ExecutorService Q = java.util.concurrent.Executors.newSingleThreadExecutor();
    static final class Piece implements Runnable {
        final Rec r; final Model m; final float[] p;
        Piece(Rec r, Model m, float[] p) { this.r = r; this.m = m; this.p = p; }
        public void run() { r.piece(m, p); }
    }
}
