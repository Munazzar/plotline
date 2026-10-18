package com.munazzar.plotline;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/* The door into Plot from outside the app:
   - the phone's assistant button (long-press the side key or home) when Plotline is the digital assistant app,
     reached through AssistSession, or ACTION_ASSIST from launchers that send it;
   - Share › Plotline from any app, and "Send to Plotline" on selected text: the text is kept and Plotline opens
     on the assistant, which asks where it should go (journal, a thread, a list…).
   It opens MainActivity normally and closes, so the app keeps its own single task. */
public class AssistEntry extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = getIntent();
        String a = i == null ? null : i.getAction();
        String route = "assistant-listen";
        CharSequence t = null;
        if (Intent.ACTION_SEND.equals(a)) {
            t = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
            CharSequence sub = i.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
            if (t != null && sub != null && sub.length() > 0 && !t.toString().contains(sub)) t = sub + "\n" + t;
        } else if ("android.intent.action.PROCESS_TEXT".equals(a)) {
            t = i.getCharSequenceExtra("android.intent.extra.PROCESS_TEXT");
        }
        if (t != null && t.toString().trim().length() > 0) {
            String s = t.toString().trim();
            if (s.length() > 4000) s = s.substring(0, 4000);
            Assist.prefs(this).edit().putString("share", s).putLong("shareAt", System.currentTimeMillis()).apply();
            route = "assistant-share";
        } else if (Intent.ACTION_SEND.equals(a) || "android.intent.action.PROCESS_TEXT".equals(a)) {
            route = "assistant";
        }
        try { startActivity(Assist.open(this, route)); } catch (Exception e) {}
        finish();
        overridePendingTransition(0, 0);
    }
}
