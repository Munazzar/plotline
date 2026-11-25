package com.munazzar.plotline;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.Executor;

/**
 * Clean, Play-Store-safe PlotlineNative JavaScript bridge.
 * Implements all 49 PlotlineNative methods called by the web app.
 */
public class PlotlineBridge {
    private final MainActivity act;
    private final WebView web;
    private final SharedPreferences prefs;
    private SpeechRecognizer sr;
    private String voiceId = "";

    public PlotlineBridge(MainActivity act, WebView web) {
        this.act = act;
        this.web = web;
        this.prefs = act.getSharedPreferences("plotline_native", Context.MODE_PRIVATE);
    }

    private void evalJs(String js) {
        act.runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    @JavascriptInterface
    public void copy(String text) {
        act.runOnUiThread(() -> {
            ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Plotlines", text == null ? "" : text));
        });
    }

    @JavascriptInterface
    public void share(String title, String text) {
        act.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            if (title != null && !title.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, title);
            i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
            act.startActivity(Intent.createChooser(i, title != null ? title : "Share"));
        });
    }

    @JavascriptInterface
    public void saveFile(String name, String mime, String content, boolean shareNow) {
        act.runOnUiThread(() -> {
            try {
                String safe = (name == null || name.isEmpty()) ? "plotlines.txt" : name.replaceAll("[^a-zA-Z0-9._-]", "_");
                File f = new File(act.getCacheDir(), safe);
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
                }
                Uri uri = FileProvider.getUriForFile(act, act.getPackageName() + ".fileprovider", f);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType((mime == null || mime.isEmpty()) ? "text/plain" : mime);
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.startActivity(Intent.createChooser(i, safe));
            } catch (Exception ignored) {
            }
        });
    }

    @JavascriptInterface
    public void openUrl(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        act.runOnUiThread(() -> {
            try {
                new CustomTabsIntent.Builder().build().launchUrl(act, Uri.parse(url));
            } catch (Exception e) {
                try {
                    act.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            }
        });
    }

    @JavascriptInterface
    public void setBars(String hexColor, boolean light) {
        act.runOnUiThread(() -> {
            try {
                if (hexColor != null && hexColor.startsWith("#")) {
                    int c = Color.parseColor(hexColor);
                    act.getWindow().setStatusBarColor(c);
                    act.getWindow().setNavigationBarColor(c);
                }
                WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(act.getWindow(), act.getWindow().getDecorView());
                if (ctrl != null) {
                    ctrl.setAppearanceLightStatusBars(light);
                    ctrl.setAppearanceLightNavigationBars(light);
                }
            } catch (Exception ignored) {
            }
        });
    }

    @JavascriptInterface
    public void setSecure(boolean on) {
        act.runOnUiThread(() -> {
            if (on) act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else act.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        });
    }

    @JavascriptInterface
    public void immersive(boolean on) {
        act.runOnUiThread(() -> {
            WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(act.getWindow(), act.getWindow().getDecorView());
            if (ctrl == null) return;
            if (on) {
                ctrl.hide(WindowInsetsCompat.Type.systemBars());
                ctrl.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                ctrl.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }

    @JavascriptInterface
    public boolean notificationsGranted() {
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return NotificationManagerCompat.from(act).areNotificationsEnabled();
    }

    @JavascriptInterface
    public void requestNotifications() {
        act.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= 33 && !notificationsGranted()) {
                ActivityCompat.requestPermissions(act, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        });
    }

    @JavascriptInterface
    public boolean exactAlarms() {
        AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= 31) return am.canScheduleExactAlarms();
        return true;
    }

    @JavascriptInterface
    public void openExactAlarms() {
        act.runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= 31) {
                    act.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                            Uri.parse("package:" + act.getPackageName())));
                }
            } catch (Exception ignored) {
                openAppSettings();
            }
        });
    }

    @JavascriptInterface
    public void openAppSettings() {
        act.runOnUiThread(() -> {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + act.getPackageName()));
            act.startActivity(i);
        });
    }

    @JavascriptInterface
    public void openUsageAccess() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
            } catch (Exception ignored) {
                openAppSettings();
            }
        });
    }

    @JavascriptInterface
    public void openHealthConnect() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"));
            } catch (Exception ignored) {
                openAppSettings();
            }
        });
    }

    @JavascriptInterface
    public boolean hasPerm(String perm) {
        if (perm == null || perm.isEmpty()) return false;
        return ContextCompat.checkSelfPermission(act, perm) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public void askPerm(String id, String perm) {
        act.requestPermFromJs(id, perm);
    }

    @JavascriptInterface
    public String bioState() {
        BiometricManager bm = BiometricManager.from(act);
        int res = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        return res == BiometricManager.BIOMETRIC_SUCCESS ? "ok" : "none";
    }

    @JavascriptInterface
    public void bioAuth(String id, String title, String subtitle) {
        act.runOnUiThread(() -> {
            Executor ex = ContextCompat.getMainExecutor(act);
            BiometricPrompt bp = new BiometricPrompt(act, ex, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    evalJs("window.__bio && window.__bio(" + JSONObject.quote(id) + ", true)");
                }
                @Override
                public void onAuthenticationError(int code, CharSequence errString) {
                    evalJs("window.__bio && window.__bio(" + JSONObject.quote(id) + ", false)");
                }
            });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title != null && !title.isEmpty() ? title : "Unlock Plotlines")
                    .setSubtitle(subtitle != null ? subtitle : "")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build();
            try {
                bp.authenticate(info);
            } catch (Exception e) {
                evalJs("window.__bio && window.__bio(" + JSONObject.quote(id) + ", false)");
            }
        });
    }

    @JavascriptInterface
    public String voiceState() {
        boolean avail = SpeechRecognizer.isRecognitionAvailable(act);
        return "{\"avail\":" + avail + ",\"onDevice\":false}";
    }

    @JavascriptInterface
    public void voiceStart(String id, String lang, boolean cloud) {
        act.runOnUiThread(() -> {
            voiceStop();
            voiceId = id == null ? "" : id;
            if (!hasPerm(Manifest.permission.RECORD_AUDIO)) {
                evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'err','perm')");
                return;
            }
            sr = SpeechRecognizer.createSpeechRecognizer(act);
            sr.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'ready','')"); }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) { evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'level'," + rmsdB + ")"); }
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() { evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'end','')"); }
                @Override public void onError(int error) { evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'err'," + error + ")"); }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String txt = (list != null && !list.isEmpty()) ? list.get(0) : "";
                    evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'final'," + JSONObject.quote(txt) + ")");
                }
                @Override public void onPartialResults(Bundle partial) {
                    ArrayList<String> list = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String txt = (list != null && !list.isEmpty()) ? list.get(0) : "";
                    evalJs("window.__voice && window.__voice(" + JSONObject.quote(voiceId) + ",'partial'," + JSONObject.quote(txt) + ")");
                }
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            if (lang != null && !lang.isEmpty()) intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            sr.startListening(intent);
        });
    }

    @JavascriptInterface
    public void voiceStop() {
        act.runOnUiThread(() -> {
            if (sr != null) {
                try { sr.stopListening(); sr.destroy(); } catch (Exception ignored) {}
                sr = null;
            }
        });
    }

    @JavascriptInterface
    public void schedule(String json) {
        try {
            AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
            if (am == null || json == null) return;
            JSONArray arr = new JSONArray(json);
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                int nid = o.optInt("nid", (o.optString("id", "") + at).hashCode() & 0x7FFFFFFF);
                Intent intent = new Intent(act, AlarmReceiver.class);
                intent.putExtra("title", o.optString("title", "Plotlines"));
                intent.putExtra("body", o.optString("body", ""));
                intent.putExtra("nid", nid);
                PendingIntent pi = PendingIntent.getBroadcast(
                        act, nid, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                if (exactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                }
            }
        } catch (Exception ignored) {
        }
    }

    @JavascriptInterface public String notifState() { return "{\"muteUntil\":" + prefs.getLong("muteUntil", 0) + ",\"snoozes\":[]}"; }
    @JavascriptInterface public void notifMute(long untilMs) { prefs.edit().putLong("muteUntil", untilMs).apply(); }
    @JavascriptInterface public String notifLog(String key) { return "[]"; }
    @JavascriptInterface public void notifCancelSnooze(int nid) {}

    // Advanced native modules (safe stubs in standalone Gradle preview; ready to wire existing android/src/ classes)
    @JavascriptInterface public String llmStatus() { return "{\"ok\":false,\"have\":[],\"busy\":false}"; }
    @JavascriptInterface public void llmStart(String id, String file) {}
    @JavascriptInterface public void llmChat(String id, String bodyJson) { evalJs("window.__llm && window.__llm(" + JSONObject.quote(id) + ",'err','On-device native llama.cpp is not bundled in Gradle preview yet — use Gemini/Groq Free or Web on-device AI')"); }
    @JavascriptInterface public void llmCancel(String id) {}
    @JavascriptInterface public void llmDownload(String id, String url, String file) {}
    @JavascriptInterface public void llmDelete(String file) {}
    @JavascriptInterface public void setReplyModel(String file) {}
    @JavascriptInterface public void setScopes(String scopes) { prefs.edit().putString("scopes", scopes).apply(); }
    @JavascriptInterface public void googleToken(boolean interactive) { evalJs("window.__gauth && window.__gauth({err:'use_browser'})"); }
    @JavascriptInterface public void googleSignOut() {}
    @JavascriptInterface public void invalidateToken(String tok) {}
    @JavascriptInterface public void liveShare(String json) {}
    @JavascriptInterface public boolean liveShareOn() { return false; }
    @JavascriptInterface public void shareCfg(String json) {}
    @JavascriptInterface public void shareImage(String title, String dataUrl) {}
    @JavascriptInterface public void widget(String json) {}
    @JavascriptInterface public String widgetQueue() { return "[]"; }
    @JavascriptInterface public String activityLoad(int days) { return "{}"; }
    @JavascriptInterface public String screenNow() { return "{}"; }
    @JavascriptInterface public String autoStatus() { return "{\"ok\":false}"; }
    @JavascriptInterface public void autoSet(String json) {}
    @JavascriptInterface public String autoApps() { return "[]"; }
    @JavascriptInterface public void placeHere(String id) {}
}
