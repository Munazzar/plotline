package com.munazzar.plotline;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private PlotlineBridge bridge;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingPermId = "";
    private String pendingAuthJson = null;
    private boolean pageReady = false;
    private int satPx = 0, sabPx = 0;

    private final ActivityResultLauncher<Intent> filePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), res -> {
                if (fileCallback == null) return;
                Uri[] uris = WebChromeClient.FileChooserParams.parseResult(res.getResultCode(), res.getData());
                fileCallback.onReceiveValue(uris);
                fileCallback = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0A12);
        setContentView(web);

        boolean isDebug = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(isDebug);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        bridge = new PlotlineBridge(this, web);
        web.addJavascriptInterface(bridge, "PlotlineNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) {
                    String path = u.getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                    Uri mapped = u.buildUpon().path("/www" + path).build();
                    return assetLoader.shouldInterceptRequest(mapped);
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                    bridge.openUrl(u.toString());
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                injectSafeArea();
                if (pendingAuthJson != null) {
                    String json = pendingAuthJson;
                    pendingAuthJson = null;
                    deliverAuth(json);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;
                try {
                    filePicker.launch(params.createIntent());
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                Uri origin = request.getOrigin();
                if (origin == null || !"appassets.androidplatform.net".equals(origin.getHost())) {
                    request.deny();
                    return;
                }
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            float d = getResources().getDisplayMetrics().density;
            satPx = Math.round(bars.top / d);
            sabPx = Math.round(bars.bottom / d);
            injectSafeArea();
            return insets;
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript(
                        "(function(){try{return !!(window.__back && window.__back())}catch(e){return false}})()",
                        val -> {
                            if (!"true".equals(val)) {
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                                setEnabled(true);
                            }
                        });
            }
        });

        web.loadUrl(APP_ORIGIN + "/index.html");
        handleAuthIntent(getIntent());
    }

    private void injectSafeArea() {
        if (web == null) return;
        String js = "if(document.documentElement){document.documentElement.style.setProperty('--sat','" + satPx + "px');"
                + "document.documentElement.style.setProperty('--sab','" + sabPx + "px');}";
        web.post(() -> web.evaluateJavascript(js, null));
    }

    public void requestPermFromJs(String id, String perm) {
        runOnUiThread(() -> {
            pendingPermId = id == null ? "" : id;
            if (perm == null || perm.isEmpty()) {
                web.evaluateJavascript("window.__perm && window.__perm(" + JSONObject.quote(pendingPermId) + ", false)", null);
                return;
            }
            ActivityCompat.requestPermissions(this, new String[]{perm}, 1002);
        });
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] grants) {
        super.onRequestPermissionsResult(code, perms, grants);
        if (code == 1002 && web != null) {
            boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
            web.evaluateJavascript("window.__perm && window.__perm(" + JSONObject.quote(pendingPermId) + ", " + ok + ")", null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null && pageReady) {
            web.evaluateJavascript("window.dispatchEvent(new Event('app-resume'))", null);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthIntent(intent);
    }

    private void handleAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri u = intent.getData();
        if ("plotline".equals(u.getScheme()) && "auth".equals(u.getHost())) {
            String raw = u.getFragment();
            if (raw == null || raw.isEmpty()) raw = u.getQuery();
            if (raw == null || raw.isEmpty()) return;
            try {
                Uri parsed = Uri.parse("https://local/?" + raw);
                String tok = parsed.getQueryParameter("access_token");
                String expStr = parsed.getQueryParameter("expires_in");
                String err = parsed.getQueryParameter("error");
                JSONObject o = new JSONObject();
                if (tok != null && !tok.isEmpty()) {
                    o.put("token", tok);
                    int exp = 3600;
                    try { if (expStr != null) exp = Integer.parseInt(expStr); } catch (Exception ignored) {}
                    o.put("exp", exp);
                    o.put("native", false);
                } else {
                    o.put("err", (err != null && !err.isEmpty()) ? err : "Sign-in cancelled");
                }
                deliverAuth(o.toString());
            } catch (Exception ignored) {
            }
        }
    }

    private void deliverAuth(String json) {
        if (web == null || !pageReady) {
            pendingAuthJson = json;
            return;
        }
        web.post(() -> web.evaluateJavascript("window.__gauth && window.__gauth(" + JSONObject.quote(json) + ")", null));
    }
}
