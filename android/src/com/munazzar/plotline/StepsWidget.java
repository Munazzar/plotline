package com.munazzar.plotline;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/* 1.62.0: the Steps widget (drawing is in StatsWidget) */
public class StepsWidget extends AppWidgetProvider {
    static void updateAll(Context c) { StatsWidget.updateAll(c, StepsWidget.class, true); }
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, StatsWidget.build(c, m, id, true)); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { m.updateAppWidget(id, StatsWidget.build(c, m, id, true)); }
}
