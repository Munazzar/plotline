package com.munazzar.plotline;

import android.content.Intent;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.widget.ImageView;

/* A voice conversation over whatever is on screen, from the Orb widget (and Talk on the Assistant widget).
   It is MainActivity with a see-through window: the same page loads with ?talk=1, which shows only the Live card
   (ai.js) on a dim backdrop, so the home screen or the app you were in stays in view behind it.
   Ending the talk, Back, tapping the backdrop or leaving closes it. "Open Plotlines" goes to the full app.
   Its own task (taskAffinity .talk, kept out of Recents), so the full app's task isn't brought forward.
   window.PlotTalk: ready() once the card is up, close(), openApp(route). */
public class TalkActivity extends MainActivity {
    ImageView wait;
    boolean closing;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(null);
        getWindow().setBackgroundDrawable(new ColorDrawable(0));
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.setBackgroundColor(0);
        View root = (View) web.getParent();
        root.setBackgroundColor(0x33000000);
        /* the orb pulses on the backdrop while the page loads */
        if (root instanceof FrameLayout) {
            try {
                wait = new ImageView(this);
                wait.setImageResource(W.id(this, "widget_orb_img", "drawable"));
                float d = getResources().getDisplayMetrics().density;
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams((int) (120 * d), (int) (120 * d), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
                lp.bottomMargin = (int) (150 * d);
                ((FrameLayout) root).addView(wait, lp);
                pulse(true);
            } catch (Exception e) { wait = null; }
        }
        web.addJavascriptInterface(new Talk(), "PlotTalk");
        web.loadUrl("https://appassets.androidplatform.net/index.html?talk=1");
    }

    void pulse(final boolean big) {
        if (wait == null) return;
        wait.animate().scaleX(big ? 1.08f : 0.94f).scaleY(big ? 1.08f : 0.94f).setDuration(900)
            .setInterpolator(new AccelerateDecelerateInterpolator())
            .withEndAction(new Runnable() { public void run() { pulse(!big); } }).start();
    }

    void ready() {
        if (wait != null) {
            final ImageView w = wait;
            wait = null;
            w.animate().cancel();
            w.animate().alpha(0f).setDuration(200).withEndAction(new Runnable() { public void run() {
                try { ((ViewGroup) w.getParent()).removeView(w); } catch (Exception e) {}
            } }).start();
        }
        /* the page draws its own backdrop from here */
        ((View) web.getParent()).setBackgroundColor(0);
    }

    void close() {
        if (closing) return;
        closing = true;
        finish();
        overridePendingTransition(0, android.R.anim.fade_out);
    }

    class Talk {
        @JavascriptInterface public void ready() { runOnUiThread(new Runnable() { public void run() { TalkActivity.this.ready(); } }); }
        @JavascriptInterface public void close() { runOnUiThread(new Runnable() { public void run() { TalkActivity.this.close(); } }); }
        @JavascriptInterface public void openApp(final String route) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    String r = route != null && route.matches("[A-Za-z0-9/-]{0,60}") ? route : "";
                    startActivity(r.isEmpty() ? new Intent(TalkActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) : Assist.open(TalkActivity.this, r));
                } catch (Exception e) {}
                TalkActivity.this.close();
            } });
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__back&&window.__back())?'1':'0'", new ValueCallback<String>() {
            public void onReceiveValue(String v) { if (v == null || !v.contains("1")) close(); }
        });
    }

    /* Home, the app switcher or another app on top: the talk ends with it, rather than waiting hidden in the background.
       (A permission prompt only pauses it.) The screen stays on while it's up, like a call. */
    @Override
    protected void onStop() {
        super.onStop();
        if (isFinishing() || isChangingConfigurations()) return;
        web.evaluateJavascript("window.liveClose&&window.liveClose()", null);
        close();
    }

    @Override
    protected void onDestroy() {
        if (Assist.act.get() == this) Assist.act = new java.lang.ref.WeakReference<MainActivity>(null);
        /* the talk paused the wake word; closing it before its page could say so mustn't leave the wake word off */
        Listen.gone(this);
        Assist.jsPause = false;
        Assist.apply(this);
        try { web.destroy(); } catch (Exception e) {}
        super.onDestroy();
    }
}
