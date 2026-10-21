package com.munazzar.plotline;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/* Plotlines · Orb: just Plot's orb, any size from one cell up. Tap it and Plotline opens on the assistant, listening.
   Shipped as hand-written smali (smali_classes4/.../OrbWidget.smali); this is the same code in Java. */
public class OrbWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), W.id(c, "widget_orb", "layout"));
        v.setOnClickPendingIntent(W.id(c, "orb_root"), AssistWidget.tap(c, "assistant-listen", 2964));
        m.updateAppWidget(ids, v);
    }
}
