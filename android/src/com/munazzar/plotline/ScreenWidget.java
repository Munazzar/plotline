package com.munazzar.plotline;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/* 1.62.0: the Screen time widget (drawing is in StatsWidget) */
public class ScreenWidget extends AppWidgetProvider {
    static void updateAll(Context c) { StatsWidget.updateAll(c, ScreenWidget.class, false); }
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, StatsWidget.build(c, m, id, false)); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { m.updateAppWidget(id, StatsWidget.build(c, m, id, false)); }
}
