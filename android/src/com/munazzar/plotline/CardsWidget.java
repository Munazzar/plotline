package com.munazzar.plotline;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;
import org.json.JSONObject;

/* Plotline · Cards: your lists, goals or threads on the home screen, one big card each (like the Lists carousel).
   Two layouts, picked per widget in its options (⚙):
   - Big card: one full-width card (like the Lists carousel), ‹ 01 / 05 › go to the next list / goal / thread.
     (A StackView squeezed the cards into thin columns on some launchers, so the card is drawn straight into the widget.)
   - Full list: one list / goal / thread with every item in a scrolling list, ‹ › switch which one.
   On either, tap ○ to tick an item, tap the item for more (edit, pin, move, remind, delete), + to add.
   Home-screen widgets can't take typing, drag-to-reorder or pickers themselves, so those open a small sheet
   (CardSheet) over the home screen instead. */
public class CardsWidget extends AppWidgetProvider {
    static final String NEXT = "com.munazzar.plotline.CARDS_NEXT", PREV = "com.munazzar.plotline.CARDS_PREV";
    static final int FLAG_MUTABLE = 0x02000000; // PendingIntent.FLAG_MUTABLE (API 31), needed for fill-in intents

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) refresh(c, m, id);
    }

    @Override
    public void onDeleted(Context c, int[] ids) { for (int id : ids) Cards.forget(c, id); }

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        int wid = i.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0);
        if ((NEXT.equals(a) || PREV.equals(a)) && wid != 0) { step(c, wid, NEXT.equals(a) ? 1 : -1); return; }
        super.onReceive(c, i);
    }

    static int coll(Context c, Cards.Opt o) { return W.id(c, "w_clist"); }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, CardsWidget.class));
        if (ids == null) return;
        for (int id : ids) refresh(c, m, id);
    }

    static void refresh(Context c, AppWidgetManager m, int wid) {
        m.updateAppWidget(wid, build(c, wid));
        if ("list".equals(Cards.opt(c, wid).style)) m.notifyAppWidgetViewDataChanged(wid, W.id(c, "w_clist"));
    }

    static void update(Context c, int wid) {
        refresh(c, AppWidgetManager.getInstance(c), wid);
    }

    /* ‹ › : the stack flips a card; the full list moves to the next list / goal / thread */
    /* ‹ › : the next or previous list / goal / thread (for the card and for the full list alike) */
    static void step(Context c, int wid, int dir) {
        Cards.Opt o = Cards.opt(c, wid);
        List<JSONObject> es = Cards.entries(Cards.load(c), o.src);
        if (es.isEmpty()) return;
        int at = 0;
        for (int k = 0; k < es.size(); k++) if (es.get(k).optString("id").equals(o.sel)) at = k;
        o.sel = es.get(((at + dir) % es.size() + es.size()) % es.size()).optString("id");
        Cards.save(c, wid, o);
        update(c, wid);
    }

    static PendingIntent broadcast(Context c, String act, int wid) {
        Intent i = new Intent(c, CardsWidget.class);
        i.setAction(act);
        i.setData(Uri.parse("plotline://cards/" + act + "/" + wid));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        return PendingIntent.getBroadcast(c, wid, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static PendingIntent options(Context c, int wid) {
        Intent i = new Intent(c, CardsConfig.class);
        i.setAction("com.munazzar.plotline.CARDS_CFG." + wid);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(c, 9100 + wid, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static PendingIntent sheet(Context c, int wid, int req, String... kv) {
        Intent i = new Intent(c, CardSheet.class);
        i.setAction("com.munazzar.plotline.CARD." + req + "." + wid);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        for (int k = 0; k + 1 < kv.length; k += 2) i.putExtra(kv[k], kv[k + 1]);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(c, req * 1000 + wid, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static RemoteViews build(Context c, int wid) {
        Cards.Opt o = Cards.opt(c, wid);
        boolean full = "list".equals(o.style);
        RemoteViews v = W.rv(c, full ? "widget_cards_list" : "widget_cards");
        if (full) {
            int coll = coll(c, o);
            Intent svc = new Intent(c, CardsService.class);
            svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
            svc.setData(Uri.parse("plotline://cards/" + wid + "/" + o.style)); // one adapter per widget
            v.setRemoteAdapter(coll, svc);
            v.setEmptyView(coll, W.id(c, "w_cempty"));
            Intent t = new Intent(c, CardSheet.class);
            t.setAction("com.munazzar.plotline.CARD.T." + wid);
            t.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
            t.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            v.setPendingIntentTemplate(coll, PendingIntent.getActivity(c, 9000 + wid, t, FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        v.setOnClickPendingIntent(W.id(c, "w_cfg"), options(c, wid));
        v.setOnClickPendingIntent(W.id(c, "w_next"), broadcast(c, NEXT, wid));
        v.setOnClickPendingIntent(W.id(c, "w_prev"), broadcast(c, PREV, wid));
        JSONObject all = Cards.load(c);
        List<JSONObject> es = Cards.entries(all, o.src);
        v.setTextViewText(W.id(c, "w_cempty"), es.isEmpty() ? "No " + Cards.noun(o.src).toLowerCase() + " yet. Open Plotline to add one, or tap ⚙ to show something else." : "");
        JSONObject e = null; int at = 0;
        for (int k = 0; k < es.size(); k++) if (es.get(k).optString("id").equals(o.sel)) { e = es.get(k); at = k; }
        if (e == null && !es.isEmpty()) e = es.get(0);
        if (!full) {
            /* one big card, like the Lists carousel; ‹ › go to the next one */
            v.setTextViewText(W.id(c, "w_src"), Cards.noun(o.src).toUpperCase(java.util.Locale.getDefault()));
            v.setOnClickPendingIntent(W.id(c, "w_src"), options(c, wid));
            int box = W.id(c, "w_cardbox");
            v.removeAllViews(box);
            v.setViewVisibility(W.id(c, "w_cempty"), e == null ? View.VISIBLE : View.GONE);
            v.setViewVisibility(W.id(c, "w_nav"), es.size() > 1 ? View.VISIBLE : View.GONE);
            v.setTextViewText(W.id(c, "w_count"), CardsService.pad2(at + 1) + "  /  " + CardsService.pad2(es.size()));
            if (e != null) v.addView(box, CardsService.card(c, new CardsService.Tap(c, wid, true), o, e, at, es.size()));
            return v;
        }
        /* full list: the header is the chosen list / goal / thread */
        v.setViewVisibility(W.id(c, "w_prev"), es.size() > 1 ? View.VISIBLE : View.INVISIBLE);
        v.setViewVisibility(W.id(c, "w_next"), es.size() > 1 ? View.VISIBLE : View.INVISIBLE);
        if (e == null) {
            v.setTextViewText(W.id(c, "w_title"), Cards.noun(o.src));
            v.setTextViewText(W.id(c, "w_meta"), "");
            v.setViewVisibility(W.id(c, "w_add"), View.GONE);
            v.setViewVisibility(W.id(c, "w_pbar"), View.GONE);
            return v;
        }
        String id = e.optString("id");
        v.setTextViewText(W.id(c, "w_title"), (o.emoji ? e.optString("e", "📝") + "  " : "") + e.optString("t"));
        v.setOnClickPendingIntent(W.id(c, "w_title"), sheet(c, wid, 3, "op", "card", "src", o.src, "id", id));
        v.setTextViewText(W.id(c, "w_meta"), CardsService.meta(e, o, at, es.size()));
        v.setViewVisibility(W.id(c, "w_add"), View.VISIBLE);
        v.setOnClickPendingIntent(W.id(c, "w_add"), sheet(c, wid, 4, "op", "add", "src", o.src, "id", id));
        int p = CardsService.pct(e, o.src);
        int col = Cards.color(e.optString("a"));
        v.setTextColor(W.id(c, "w_meta"), col);
        if (o.prog && p >= 0) { v.setViewVisibility(W.id(c, "w_pbar"), View.VISIBLE); v.setImageViewBitmap(W.id(c, "w_pbar"), W.bar(p, col)); }
        else v.setViewVisibility(W.id(c, "w_pbar"), View.GONE);
        return v;
    }
}
