package com.munazzar.plotline;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/* Plotline · Threads: your threads one full card at a time (ThreadsCards draws them), the latest update on each,
   with 🎤 and + Add. ‹ › slide to the previous or next thread; the last card starts a new one.
   1.45.3: an AdapterViewFlipper in place of the StackView, which some launchers squeezed into thin tilted columns.
   This class sits in classes.dex with the rest of the original widgets, so it ships as smali swapped into that dex
   (see the README); the layouts are widget_threads.xml and widget_thr_card.xml. */
public class ThreadsWidget extends AppWidgetProvider {
    static final String NEXT = "com.munazzar.plotline.THREADS_NEXT", PREV = "com.munazzar.plotline.THREADS_PREV";
    static final int FLAG_MUTABLE = 0x02000000;

    static RemoteViews build(Context c) {
        RemoteViews v = W.rv(c, "widget_threads");
        int stack = W.id(c, "w_stack");
        Intent svc = new Intent(c, ThreadsCards.class);
        svc.setData(Uri.parse("plotline://threads-cards"));
        v.setRemoteAdapter(stack, svc);
        v.setEmptyView(stack, W.id(c, "w_empty"));
        Intent t = new Intent(c, QuickLog.class);
        t.setAction("com.munazzar.plotline.QUICK.CARD");
        t.setFlags(0x10008000);
        v.setPendingIntentTemplate(stack, PendingIntent.getActivity(c, 66, t, PendingIntent.FLAG_UPDATE_CURRENT | FLAG_MUTABLE));
        v.setOnClickPendingIntent(W.id(c, "w_add"), quick(c, "", false, 62));
        v.setOnClickPendingIntent(W.id(c, "w_thr_title"), W.open(c, "threads", 61));
        v.setOnClickPendingIntent(W.id(c, "w_prev"), step(c, PREV, 63));
        v.setOnClickPendingIntent(W.id(c, "w_next"), step(c, NEXT, 64));
        return v;
    }

    static PendingIntent step(Context c, String a, int rq) {
        Intent i = new Intent(c, ThreadsWidget.class);
        i.setAction(a);
        return PendingIntent.getBroadcast(c, rq, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent quick(Context c, String thread, boolean voice, int rq) {
        Intent i = new Intent(c, QuickLog.class);
        i.setAction("com.munazzar.plotline.QUICK." + rq);
        if (thread != null) i.putExtra("thread", thread);
        if (voice) i.putExtra("voice", true);
        i.setFlags(0x10008000);
        return PendingIntent.getActivity(c, rq, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void updateAll(Context c) {
        W.update(c, ThreadsWidget.class, new W.Builder() {
            public RemoteViews build(Context x) { return ThreadsWidget.build(x); }
        });
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, ThreadsWidget.class));
        if (ids != null && ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, W.id(c, "w_stack"));
    }

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (NEXT.equals(a) || PREV.equals(a)) {
            try {
                AppWidgetManager m = AppWidgetManager.getInstance(c);
                int[] ids = m.getAppWidgetIds(new ComponentName(c, ThreadsWidget.class));
                if (ids == null) return;
                RemoteViews v = new RemoteViews(c.getPackageName(), W.id(c, "widget_threads", "layout"));
                if (NEXT.equals(a)) v.showNext(W.id(c, "w_stack"));
                else v.showPrevious(W.id(c, "w_stack"));
                for (int id : ids) m.partiallyUpdateAppWidget(id, v);
            } catch (Exception e) {}
            return;
        }
        super.onReceive(c, i);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
        m.notifyAppWidgetViewDataChanged(ids, W.id(c, "w_stack"));
    }
}
