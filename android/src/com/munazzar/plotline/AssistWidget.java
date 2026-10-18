package com.munazzar.plotline;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/* Plotline · Assistant: what you last said to the assistant and what it answered, with Talk and Type.
   Talk opens Plotline on the assistant and starts listening; Type opens it with the keyboard.
   A home-screen widget can't use the mic or take typing itself, so both open the app. */
public class AssistWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, build(c)); }

    static void updateAll(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, AssistWidget.class));
            if (ids == null) return;
            for (int id : ids) m.updateAppWidget(id, build(c));
        } catch (Exception e) {}
    }

    static PendingIntent tap(Context c, String route, int rq) {
        return PendingIntent.getActivity(c, rq, Assist.open(c, route), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static RemoteViews build(Context c) {
        W.loadTheme(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), W.id(c, "widget_assist", "layout"));
        JSONObject o;
        try { o = new JSONObject(Assist.prefs(c).getString("w", "{}")); } catch (Exception e) { o = new JSONObject(); }
        String name = o.optString("name", "");
        if (name.isEmpty()) name = Assist.cfg(c).optString("name", "Plot");
        String wake = o.optString("wake", "");
        JSONArray t = o.optJSONArray("turns");
        JSONObject last = t != null && t.length() > 0 ? t.optJSONObject(t.length() - 1) : null;

        v.setTextViewText(W.id(c, "as_w_name"), name);
        v.setTextViewText(W.id(c, "as_w_hint"), wake.isEmpty() ? "Assistant" : "Say “" + wake + "”");
        int q = W.id(c, "as_w_q"), a = W.id(c, "as_w_a");
        if (last != null) {
            v.setViewVisibility(q, View.VISIBLE);
            v.setTextViewText(q, "You: " + last.optString("q"));
            v.setTextViewText(a, last.optString("a"));
        } else {
            v.setViewVisibility(q, View.GONE);
            v.setTextViewText(a, "Hi, I'm " + name + ". Tap Talk and ask me to add to your journal, set a reminder, or when you last did something.");
        }
        if (W.THEMED) {
            v.setTextColor(W.id(c, "as_w_name"), W.TEXT);
            v.setTextColor(a, W.TEXT);
            v.setTextColor(q, W.MUTED);
            v.setTextColor(W.id(c, "as_w_hint"), W.MUTED);
            W.bgRes(c, v, W.id(c, "w_root"), W.id(c, "widget_bg", "drawable"));
        }
        v.setOnClickPendingIntent(W.id(c, "as_w_talk"), tap(c, "assistant-listen", 2960));
        v.setOnClickPendingIntent(W.id(c, "as_w_type"), tap(c, "assistant-type", 2961));
        v.setOnClickPendingIntent(W.id(c, "as_w_body"), tap(c, "assistant", 2962));
        return v;
    }
}
