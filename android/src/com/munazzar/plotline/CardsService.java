package com.munazzar.plotline;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/* Builds the Cards widget's big card (drawn straight into the widget), and supplies one row per item for the
   full-list layout. Taps go to CardSheet through the widget's template intent. */
public class CardsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new F(getApplicationContext(), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0));
    }

    static String pad2(int n) { return n < 10 ? "0" + n : String.valueOf(n); }

    /* percent done (goals send theirs, lists count items); -1 for threads */
    static int pct(JSONObject e, String src) {
        if ("thr".equals(src)) return -1;
        if ("goal".equals(src)) return e.optInt("p");
        int[] n = Cards.counts(e);
        return n[0] == 0 ? 0 : Math.round(n[1] * 100f / n[0]);
    }

    /* the small line at the top of a card: "0 OF 5 DONE · SHARED" */
    static String meta(JSONObject e, Cards.Opt o, int at, int of) {
        List<String> bits = new ArrayList<>();
        int[] n = Cards.counts(e);
        if (o.count) {
            if ("thr".equals(o.src)) bits.add(n[0] + (n[0] == 1 ? " update" : " updates"));
            else if ("goal".equals(o.src)) bits.add(e.optInt("p") + "% · " + n[1] + " of " + n[0] + " steps");
            else bits.add(n[0] == 0 ? "Empty" : n[1] + " of " + n[0] + " done");
        }
        if (e.optBoolean("sh")) bits.add("shared");
        if ("list".equals(o.style) && of > 1) bits.add((at + 1) + "/" + of);
        return android.text.TextUtils.join(" · ", bits).toUpperCase(Locale.getDefault());
    }

    static String due(JSONObject e, String src) {
        if ("thr".equals(src)) {
            List<JSONObject> it = Cards.items(e);
            long t = it.isEmpty() ? 0 : it.get(0).optLong("at");
            return t > 0 ? "Updated " + ThreadsCards.ago(t) : "";
        }
        String d = e.optString("due");
        if (d.isEmpty()) return "";
        return ("goal".equals(src) ? "Target " : "Due ") + W.dayLabel(d);
    }

    /* "📌 · 🔔 Tomorrow 9:00 AM · Fri" on an item row */
    static String marks(JSONObject it, Cards.Opt o, String src) {
        List<String> bits = new ArrayList<>();
        if (o.marks && it.optBoolean("pin")) bits.add("📌");
        if (o.marks && it.optLong("rem") > System.currentTimeMillis() && !it.optBoolean("done")) bits.add("🔔 " + Cards.when(it.optLong("rem")));
        if (o.due && !it.optString("due").isEmpty()) bits.add(W.dayLabel(it.optString("due")) + (it.optString("time").isEmpty() ? "" : " " + it.optString("time")));
        if ("thr".equals(src) && o.due && it.optLong("at") > 0) bits.add(ThreadsCards.ago(it.optLong("at")));
        return android.text.TextUtils.join("  ", bits);
    }

    /* Where a tap goes. Rows in the full list are collection items (fill-in intents on the widget's template);
       the big card is drawn straight into the widget, so each tap there gets its own PendingIntent. */
    static final class Tap {
        final Context c; final int wid; final boolean direct; int n;
        Tap(Context c, int wid, boolean direct) { this.c = c; this.wid = wid; this.direct = direct; }
        void on(RemoteViews v, int id, Intent fill) {
            if (!direct) { v.setOnClickFillInIntent(id, fill); return; }
            Intent i = new Intent(c, CardSheet.class);
            i.putExtras(fill);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
            i.setAction("com.munazzar.plotline.CARDTAP." + wid + "." + n);
            i.setData(android.net.Uri.parse("plotline://cardtap/" + wid + "/" + n));
            i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            v.setOnClickPendingIntent(id, android.app.PendingIntent.getActivity(c, 20000 + (wid % 2000) * 400 + n, i, android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT));
            n++;
        }
    }

    static Intent fill(String op, String src, String id, String iid) {
        Intent i = new Intent();
        i.putExtra("op", op); i.putExtra("src", src); i.putExtra("id", id);
        if (iid != null) i.putExtra("i", iid);
        return i;
    }

    /* one item row (used inside a card and in the full list) */
    static RemoteViews row(Context c, Tap t, String layout, JSONObject e, JSONObject it, Cards.Opt o, int col, boolean compact) {
        RemoteViews r = new RemoteViews(c.getPackageName(), W.id(c, layout, "layout"));
        String id = e.optString("id"), iid = it.optString("id");
        boolean d = it.optBoolean("done"), thr = "thr".equals(o.src);
        r.setTextViewText(W.id(c, "r_chk"), thr ? it.optString("e", "💭") : d ? "✓" : "○");
        r.setTextColor(W.id(c, "r_chk"), d ? W.DIM : col);
        r.setTextViewText(W.id(c, "r_t"), it.optString("t"));
        r.setTextColor(W.id(c, "r_t"), d ? W.DIM : compact ? W.blend(col, 0xFFFFFFFF, 0.25f) : W.TEXT);
        String m = compact ? "" : marks(it, o, o.src);
        r.setTextViewText(W.id(c, "r_m"), m);
        r.setViewVisibility(W.id(c, "r_m"), m.isEmpty() ? View.GONE : View.VISIBLE);
        if (!thr) t.on(r, W.id(c, "r_chk"), fill("tog", o.src, id, iid));
        else t.on(r, W.id(c, "r_chk"), fill("item", o.src, id, iid));
        t.on(r, W.id(c, "r_t"), fill("item", o.src, id, iid));
        t.on(r, W.id(c, "r_m"), fill("item", o.src, id, iid));
        return r;
    }

    /* a sub-goal under a goal: tap to open it */
    static RemoteViews sub(Context c, Tap t, String layout, JSONObject s, Cards.Opt o, int col) {
        RemoteViews r = new RemoteViews(c.getPackageName(), W.id(c, layout, "layout"));
        r.setTextViewText(W.id(c, "r_chk"), "◎");
        r.setTextColor(W.id(c, "r_chk"), col);
        r.setTextViewText(W.id(c, "r_t"), s.optString("t"));
        r.setTextColor(W.id(c, "r_t"), W.MUTED);
        r.setTextViewText(W.id(c, "r_m"), s.optInt("p") + "%");
        r.setViewVisibility(W.id(c, "r_m"), View.VISIBLE);
        Intent open = fill("open", "goal", s.optString("id"), null);
        t.on(r, W.id(c, "r_t"), open);
        t.on(r, W.id(c, "r_chk"), open);
        return r;
    }

    /* the big card: meta line + number, icon, title, items, progress, due */
    static RemoteViews card(Context c, Tap t, Cards.Opt o, JSONObject e, int p, int of) {
        RemoteViews v = new RemoteViews(c.getPackageName(), W.id(c, "widget_card", "layout"));
        String id = e.optString("id"), area = e.optString("a");
        int col = Cards.color(area);
        boolean compact = "compact".equals(o.detail);
        int lc = W.id(c, "widget_lc_" + area, "drawable");
        v.setInt(W.id(c, "cd_root"), "setBackgroundResource", lc != 0 ? lc : W.id(c, "widget_lc_learning", "drawable"));
        String meta = meta(e, o, p, of);
        v.setTextViewText(W.id(c, "cd_meta"), meta);
        v.setTextColor(W.id(c, "cd_meta"), W.blend(col, 0xFFFFFFFF, 0.2f));
        v.setTextViewText(W.id(c, "cd_badge"), pad2(p + 1));
        v.setTextColor(W.id(c, "cd_badge"), col);
        v.setViewVisibility(W.id(c, "cd_badge"), o.badge ? View.VISIBLE : View.GONE);
        v.setTextViewText(W.id(c, "cd_emoji"), e.optString("e", "📝"));
        v.setViewVisibility(W.id(c, "cd_emoji"), o.emoji ? View.VISIBLE : View.GONE);
        v.setViewVisibility(W.id(c, "cd_gap"), compact ? View.VISIBLE : View.GONE);
        v.setTextViewText(W.id(c, "cd_title"), e.optString("t").toUpperCase(Locale.getDefault()));
        t.on(v, W.id(c, "cd_title"), fill("open", o.src, id, null));
        t.on(v, W.id(c, "cd_emoji"), fill("open", o.src, id, null));
        int rowsId = W.id(c, "cd_rows");
        v.removeAllViews(rowsId);
        List<JSONObject> its = Cards.visible(e, o);
        int max = o.rows(), shown = 0;
        for (JSONObject it : its) { if (shown >= max) break; v.addView(rowsId, row(c, t, "widget_card_row", e, it, o, col, compact)); shown++; }
        JSONArray subs = e.optJSONArray("subs");
        if (o.subs && !compact && subs != null) for (int k = 0; k < subs.length() && shown < max; k++, shown++) v.addView(rowsId, sub(c, t, "widget_card_row", subs.optJSONObject(k), o, col));
        int left = its.size() - Math.min(its.size(), max);
        String more = left > 0 ? "+" + left + " more" : its.isEmpty() ? (Cards.items(e).isEmpty() ? "Nothing here yet · tap + to add" : "All done 🎉") : "";
        v.setTextViewText(W.id(c, "cd_more"), more);
        v.setViewVisibility(W.id(c, "cd_more"), more.isEmpty() ? View.GONE : View.VISIBLE);
        t.on(v, W.id(c, "cd_more"), fill("card", o.src, id, null));
        int pc = pct(e, o.src);
        if (o.prog && pc >= 0) { v.setViewVisibility(W.id(c, "cd_prog"), View.VISIBLE); v.setImageViewBitmap(W.id(c, "cd_prog"), W.bar(pc, col)); }
        else v.setViewVisibility(W.id(c, "cd_prog"), View.GONE);
        String d = o.due ? due(e, o.src) : "";
        v.setTextViewText(W.id(c, "cd_due"), d.toUpperCase(Locale.getDefault()));
        t.on(v, W.id(c, "cd_add"), fill("add", o.src, id, null));
        t.on(v, W.id(c, "cd_opts"), fill("card", o.src, id, null));
        return v;
    }

    static final class F implements RemoteViewsFactory {
        final Context c; final int wid;
        Cards.Opt o = new Cards.Opt();
        final List<JSONObject> es = new ArrayList<>();
        JSONObject cur; final List<Object> rows = new ArrayList<>();

        final Tap tap;
        F(Context c, int wid) { this.c = c; this.wid = wid; this.tap = new Tap(c, wid, false); }
        public void onCreate() { }
        public void onDestroy() { es.clear(); rows.clear(); }
        public RemoteViews getLoadingView() { return null; }
        public int getViewTypeCount() { return 2; }
        public long getItemId(int p) { return p; }
        public boolean hasStableIds() { return false; }

        public void onDataSetChanged() {
            o = Cards.opt(c, wid);
            W.loadTheme(c);
            es.clear(); rows.clear(); cur = null;
            es.addAll(Cards.entries(Cards.load(c), o.src));
            if (!"list".equals(o.style)) return;
            for (JSONObject e : es) if (e.optString("id").equals(o.sel)) cur = e;
            if (cur == null && !es.isEmpty()) cur = es.get(0);
            if (cur == null) return;
            rows.addAll(Cards.visible(cur, o));
            JSONArray subs = cur.optJSONArray("subs");
            if (o.subs && subs != null) for (int k = 0; k < subs.length(); k++) rows.add(new Object[]{subs.optJSONObject(k)});
        }

        public int getCount() { return "list".equals(o.style) ? rows.size() : 0; }

        public RemoteViews getViewAt(int p) {
            if ("list".equals(o.style)) {
                if (cur == null || p >= rows.size()) return null;
                int col = Cards.color(cur.optString("a"));
                Object x = rows.get(p);
                if (x instanceof Object[]) return sub(c, tap, "widget_card_line", (JSONObject) ((Object[]) x)[0], o, col);
                return row(c, tap, "widget_card_line", cur, (JSONObject) x, o, col, false);
            }
            return null;
        }

    }
}
