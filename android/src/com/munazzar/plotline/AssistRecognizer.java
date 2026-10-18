package com.munazzar.plotline;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;
import java.util.List;

/* An assistant app has to name a speech recognizer, and choosing an assistant can make it the phone's voice input
   too. So this one doesn't recognize anything itself: it hands each request to the phone's own recognizer (Google's
   when there is one), so voice typing keeps working everywhere after you pick Plotline as your assistant. */
public class AssistRecognizer extends RecognitionService {
    SpeechRecognizer inner;

    ComponentName other() {
        List<ResolveInfo> l = getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
        ComponentName pick = null;
        if (l == null) return null;
        for (ResolveInfo r : l) {
            if (r.serviceInfo == null || getPackageName().equals(r.serviceInfo.packageName)) continue;
            ComponentName c = new ComponentName(r.serviceInfo.packageName, r.serviceInfo.name);
            if (r.serviceInfo.packageName.startsWith("com.google.")) return c;
            if (pick == null) pick = c;
        }
        return pick;
    }

    void drop() {
        try { if (inner != null) inner.destroy(); } catch (Exception e) {}
        inner = null;
    }

    @Override
    protected void onStartListening(Intent i, final Callback cb) {
        drop();
        ComponentName o = other();
        if (o == null) { try { cb.error(SpeechRecognizer.ERROR_CLIENT); } catch (Exception e) {} return; }
        inner = SpeechRecognizer.createSpeechRecognizer(this, o);
        inner.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle b) { try { cb.readyForSpeech(b); } catch (Exception e) {} }
            public void onBeginningOfSpeech() { try { cb.beginningOfSpeech(); } catch (Exception e) {} }
            public void onRmsChanged(float v) { try { cb.rmsChanged(v); } catch (Exception e) {} }
            public void onBufferReceived(byte[] b) { try { cb.bufferReceived(b); } catch (Exception e) {} }
            public void onEndOfSpeech() { try { cb.endOfSpeech(); } catch (Exception e) {} }
            public void onError(int e) { try { cb.error(e); } catch (Exception x) {} drop(); }
            public void onResults(Bundle b) { try { cb.results(b); } catch (Exception e) {} drop(); }
            public void onPartialResults(Bundle b) { try { cb.partialResults(b); } catch (Exception e) {} }
            public void onEvent(int t, Bundle b) {}
        });
        inner.startListening(i);
    }

    @Override
    protected void onStopListening(Callback cb) { try { if (inner != null) inner.stopListening(); } catch (Exception e) {} }

    @Override
    protected void onCancel(Callback cb) { try { if (inner != null) inner.cancel(); } catch (Exception e) {} drop(); }

    @Override
    public void onDestroy() { drop(); super.onDestroy(); }
}
