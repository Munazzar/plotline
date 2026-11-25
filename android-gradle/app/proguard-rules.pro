# Keep JavaScript bridge methods exposed to WebView
-keepclassmembers class com.munazzar.plotline.PlotlineBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*,JavascriptInterface
-keep class com.munazzar.plotline.MainActivity { *; }
-keep class com.munazzar.plotline.AlarmReceiver { *; }
