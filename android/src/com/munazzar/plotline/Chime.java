package com.munazzar.plotline;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/* The "Hey Plot" listening cues: one chime when it starts listening, another when it stops (heard you, or gave up),
   each with a short buzz. The user picks both in Settings › AI & voice; the picks arrive in the wake config as cueStart
   and cueDone, and this table matches CUES in assistant.js. Notes are synthesised at full scale (sine plus one overtone,
   quick attack, exponential decay) and played on the assistant's own audio usage, so they're clear even while the
   recognizer's beeps are hushed. "Listening sounds" off silences them. */
public class Chime {
    static final int RATE = 44100;
    static final Handler H = new Handler(Looper.getMainLooper());
    static final java.util.HashMap<String, short[]> CACHE = new java.util.HashMap<>();

    /* id -> {overtone ratio, overtone level, decay s, then pairs of (Hz, start s)} */
    static double[] spec(String id) {
        switch (id == null ? "" : id) {
            case "fall": return new double[]{2, .18, .26, 1047, 0, 659, .12};
            case "bell": return new double[]{2.76, .35, .7, 1319, 0};
            case "glass": return new double[]{3, .15, .5, 2093, 0};
            case "soft": return new double[]{2, .08, .4, 523, 0, 659, .14};
            case "pop": return new double[]{2, .1, .09, 988, 0};
            case "tap": return new double[]{2, .12, .08, 880, 0, 880, .11};
            case "marimba": return new double[]{3.9, .3, .22, 523, 0, 659, .09, 784, .18};
            case "marimbad": return new double[]{3.9, .3, .22, 784, 0, 659, .09, 523, .18};
            case "low": return new double[]{2, .25, .35, 330, 0};
            case "chirp": return new double[]{2, .05, .07, 1568, 0, 2093, .06};
            case "none": return new double[]{2, 0, 0};
            case "rise": return new double[]{2, .18, .26, 784, 0, 1175, .11};
            default: return null;
        }
    }

    static boolean on(Context c) { return Assist.cfg(c).optBoolean("cues", true); }

    static void start(Context c) { if (on(c)) { play(Assist.cfg(c).optString("cueStart", "rise"), "rise"); buzz(c, true); } }

    static void stop(Context c) { if (on(c)) { play(Assist.cfg(c).optString("cueDone", "fall"), "fall"); buzz(c, false); } }

    static short[] tones(double[] p) {
        double h = p[0], hv = p[1], dec = Math.max(.05, p[2]);
        int notes = (p.length - 3) / 2;
        if (notes < 1) return null;
        double last = 0;
        for (int k = 0; k < notes; k++) last = Math.max(last, p[4 + k * 2]);
        int n = (int) (RATE * (last + dec * 1.6 + .02));
        double[] mix = new double[n];
        for (int k = 0; k < notes; k++) {
            double f = p[3 + k * 2];
            int off = (int) (RATE * p[4 + k * 2]);
            for (int i = 0; off + i < n; i++) {
                double t = (double) i / RATE, att = Math.min(1.0, t / 0.008);
                double main = Math.exp(-t * 4.6 / dec), over = Math.exp(-t * 4.6 / (dec * .6));
                mix[off + i] += att * (.75 * main * Math.sin(2 * Math.PI * f * t) + hv * over * Math.sin(2 * Math.PI * f * h * t));
            }
        }
        double peak = 0;
        for (double v : mix) peak = Math.max(peak, Math.abs(v));
        short[] out = new short[n];
        for (int i = 0; i < n; i++) out[i] = (short) (mix[i] / (peak == 0 ? 1 : peak) * 32000);
        return out;
    }

    static void play(String id, String fallback) {
        try {
            if (spec(id) == null) id = fallback;
            short[] cached = CACHE.get(id);
            if (cached == null && !CACHE.containsKey(id)) { cached = tones(spec(id)); CACHE.put(id, cached); }
            final short[] pcm = cached;
            if (pcm == null || pcm.length == 0) return;
            AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(Build.VERSION.SDK_INT >= 26 ? AudioAttributes.USAGE_ASSISTANT : AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            AudioFormat af = new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
            final AudioTrack t = new AudioTrack(aa, af, pcm.length * 2, AudioTrack.MODE_STATIC, 0);
            t.write(pcm, 0, pcm.length);
            t.setVolume(1f);
            t.play();
            H.postDelayed(new Runnable() { public void run() { try { t.release(); } catch (Exception e) {} } }, pcm.length * 1000L / RATE + 200);
        } catch (Exception e) {}
    }

    static void buzz(Context c, boolean start) {
        try {
            Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(start ? VibrationEffect.createOneShot(25, 180) : VibrationEffect.createWaveform(new long[]{0, 15, 70, 15}, -1));
            else v.vibrate(start ? 25 : 15);
        } catch (Exception e) {}
    }
}
