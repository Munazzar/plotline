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

/* The "Hey Plot" listening cues. The old cue was one quiet 160 ms ToneGenerator beep at 70% on the media stream and
   there was nothing when it stopped. Now: a bright rising two-note chime when it starts listening, a falling one
   when it stops (heard you, or gave up), each with a short buzz. The notes are synthesised at full scale (sine plus a
   soft overtone, quick attack, smooth decay) and played on the assistant's own audio usage, so they're clear even
   while the recognizer's beeps are hushed. Turn them off with "Listening sounds" in the assistant settings. */
public class Chime {
    static final int RATE = 44100;
    static final Handler H = new Handler(Looper.getMainLooper());
    static short[] up, down;

    static boolean on(Context c) { return Assist.cfg(c).optBoolean("cues", true); }

    static void start(Context c) { if (on(c)) { play(true); buzz(c, true); } }

    static void stop(Context c) { if (on(c)) { play(false); buzz(c, false); } }

    static short[] tones(double[] f) {
        int note = (int) (RATE * 0.12), tail = (int) (RATE * 0.16), n = note * (f.length - 1) + note + tail;
        double[] mix = new double[n];
        for (int k = 0; k < f.length; k++) {
            int off = k * note, len = note + tail;
            for (int i = 0; i < len && off + i < n; i++) {
                double t = (double) i / RATE;
                double env = Math.min(1.0, t / 0.008) * Math.exp(-t * 11.0);
                mix[off + i] += env * (0.8 * Math.sin(2 * Math.PI * f[k] * t) + 0.2 * Math.sin(2 * Math.PI * f[k] * 2 * t));
            }
        }
        double peak = 0;
        for (double v : mix) peak = Math.max(peak, Math.abs(v));
        short[] out = new short[n];
        for (int i = 0; i < n; i++) out[i] = (short) (mix[i] / (peak == 0 ? 1 : peak) * 32000);
        return out;
    }

    static void play(boolean rising) {
        try {
            if (up == null) { up = tones(new double[]{784, 1175}); down = tones(new double[]{1047, 659}); }
            final short[] pcm = rising ? up : down;
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
