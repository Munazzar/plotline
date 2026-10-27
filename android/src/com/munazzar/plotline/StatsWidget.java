package com.munazzar.plotline;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/* 1.62.0: Screen time and Steps home-screen widgets, today hour by hour, like the Home cards in the app.
   Screen time is read from Android's usage timeline each time the widget draws (UsageHours), leaving out the apps
   skipped in the app; labels and the skip list come with the widget data the app sends (stats.skip, stats.lab).
   Steps come from the app (stats.stp: day, total, goal, steps per hour with -1 for an hour nothing measured), so the
   widget shows the same numbers as the app, and says so when they're from an earlier day. ScreenWidget and StepsWidget
   are the two receivers; W.updateAll redraws both when the app sends new data. */
public class StatsWidget {
    static final int[] PAL = {0xFF4E79A7, 0xFFF28E2B, 0xFFE15759, 0xFF76B7B2, 0xFF59A14F, 0xFFEDC948, 0xFFB07AA1, 0xFFFF9DA7};
    static final int OTHER = 0xFF9AA0A6, STEP = 0xFF59A14F, MUTED = 0x99ECEAE3, GRID = 0x26ECEAE3;

    static void updateAll(Context c, Class<?> k, boolean steps) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids != null) for (int id : ids) m.updateAppWidget(id, build(c, m, id, steps));
        } catch (Exception e) { }
    }

    static String fmtMin(double m) {
        int t = (int) Math.round(m);
        if (t < 60) return t + "m";
        return (t / 60) + "h" + (t % 60 > 0 ? " " + (t % 60) + "m" : "");
    }

    static String hLab(int h) { return h == 0 ? "12a" : h == 12 ? "12p" : h < 12 ? h + "a" : (h - 12) + "p"; }

    static RemoteViews build(Context c, AppWidgetManager m, int id, boolean steps) {
        RemoteViews v = W.rv(c, steps ? "widget_stats_steps" : "widget_stats");
        v.setOnClickPendingIntent(W.id(c, "w_root"), W.open(c, steps ? "activity" : "screen", steps ? 6311 : 6310));
        float d = c.getResources().getDisplayMetrics().density;
        int wd = 250, hd = 110;
        try {
            Bundle o = m.getAppWidgetOptions(id);
            wd = Math.max(160, o.getInt("appWidgetMinWidth", wd));
            hd = Math.max(80, o.getInt("appWidgetMaxHeight", hd));
        } catch (Exception e) { }
        int bw = (int) ((wd - 28) * d), bh = (int) Math.max(40 * d, (hd - 28 - 50) * d);
        JSONObject all = W.data(c), st = all == null ? null : all.optJSONObject("stats");
        if (st == null) st = new JSONObject();
        String title = steps ? "STEPS" : "SCREEN TIME", sum, sub;
        Bitmap img;
        if (steps) {
            JSONObject p = st.optJSONObject("stp");
            boolean today = p != null && W.today().equals(p.optString("d"));
            long t = p == null ? 0 : p.optLong("t");
            int g = p == null ? 8000 : Math.max(1, p.optInt("g", 8000));
            int[] hr = new int[24];
            JSONArray a = p == null ? null : p.optJSONArray("h");
            for (int i = 0; i < 24; i++) hr[i] = a == null ? -1 : a.optInt(i, -1);
            if (p == null) { sum = "No steps yet"; sub = "Open Plotlines once to fill this in"; }
            else if (!today) { sum = String.format(Locale.getDefault(), "%,d steps", t); sub = "From " + p.optString("d") + " · open Plotlines to update"; }
            else {
                sum = String.format(Locale.getDefault(), "%,d steps", t);
                int top = -1;
                for (int i = 0; i < 24; i++) if (hr[i] > 0 && (top < 0 || hr[i] > hr[top])) top = i;
                sub = Math.round(t * 100.0 / g) + "% of " + String.format(Locale.getDefault(), "%,d", g) + (top >= 0 ? " · most at " + hLab(top) : "");
            }
            float[][] cols = new float[24][];
            int[][] cc = new int[24][];
            for (int i = 0; i < 24; i++) {
                if (!today || hr[i] < 0) continue;
                cols[i] = new float[]{hr[i]};
                cc[i] = new int[]{STEP};
            }
            img = bars(cols, cc, bw, bh, d, 100, false);
        } else {
            Set<String> skip = new HashSet<String>();
            JSONArray sk = st.optJSONArray("skip");
            if (sk != null) for (int i = 0; i < sk.length(); i++) skip.add(sk.optString(i));
            JSONObject lab = st.optJSONObject("lab");
            int unl = 0;
            boolean perm = UsageHours.allowed(c);
            Map<String, Double> app = new HashMap<String, Double>();
            Map<String, String> L = new HashMap<String, String>();
            List<Map<String, Double>> hrs = new ArrayList<Map<String, Double>>();
            for (int i = 0; i < 24; i++) hrs.add(new HashMap<String, Double>());
            if (perm) try {
                JSONObject j = new JSONObject(UsageHours.json(c, 1)), dy = j.optJSONObject("days");
                JSONObject o = dy == null ? null : dy.optJSONObject(W.today()), ls = j.optJSONObject("labels");
                if (ls != null) { Iterator<String> it = ls.keys(); while (it.hasNext()) { String k = it.next(); L.put(k, ls.optString(k)); } }
                if (o != null) {
                    JSONObject h = o.optJSONObject("h"), u = o.optJSONObject("u");
                    if (h != null) {
                        Iterator<String> it = h.keys();
                        while (it.hasNext()) {
                            String hk = it.next();
                            int hh = Integer.parseInt(hk);
                            JSONObject ap = h.optJSONObject(hk);
                            if (ap == null || hh < 0 || hh > 23) continue;
                            Iterator<String> i2 = ap.keys();
                            while (i2.hasNext()) {
                                String pk = i2.next();
                                if (skip.contains(pk)) continue;
                                double mn = ap.optDouble(pk, 0);
                                hrs.get(hh).put(pk, mn);
                                Double x = app.get(pk);
                                app.put(pk, (x == null ? 0 : x) + mn);
                            }
                        }
                    }
                    if (u != null) { Iterator<String> it = u.keys(); while (it.hasNext()) unl += u.optInt(it.next()); }
                }
            } catch (Exception e) { }
            /* apps by minutes, most first (insertion sort: a day has a few dozen apps at most) */
            List<String> ks = new ArrayList<String>();
            for (String k : app.keySet()) {
                int at = 0;
                while (at < ks.size() && app.get(ks.get(at)) >= app.get(k)) at++;
                ks.add(at, k);
            }
            double tot = 0;
            for (double x : app.values()) tot += x;
            String top = ks.isEmpty() ? null : ks.get(0);
            String topL = top == null ? null : lab != null && lab.has(top) ? lab.optString(top) : L.containsKey(top) ? L.get(top) : top;
            if (!perm) { sum = "Allow usage access"; sub = "Open Plotlines › Screen time to turn it on"; }
            else if (tot < 1) { sum = "No screen time yet today"; sub = "Counts from when you use your phone"; }
            else { sum = fmtMin(tot) + " today"; sub = unl + " unlocks" + (topL != null ? " · most on " + topL : ""); }
            float[][] cols = new float[24][];
            int[][] cc = new int[24][];
            for (int i = 0; i < 24; i++) {
                float[] seg = new float[9];
                int[] sc = new int[9];
                for (int k = 0; k < 9; k++) sc[k] = k < 8 ? PAL[k] : OTHER;
                for (Map.Entry<String, Double> e : hrs.get(i).entrySet()) {
                    int r = ks.indexOf(e.getKey());
                    seg[r >= 0 && r < 8 ? r : 8] += e.getValue().floatValue();
                }
                cols[i] = seg;
                cc[i] = sc;
            }
            img = bars(cols, cc, bw, bh, d, 15, true);
        }
        v.setTextViewText(W.id(c, "w_t"), title);
        v.setTextViewText(W.id(c, "w_sum"), sum);
        v.setTextViewText(W.id(c, "w_sub"), sub);
        v.setImageViewBitmap(W.id(c, "w_img"), img);
        return v;
    }

    /* stacked bars for the 24 hours; a null column is an hour nothing was measured (a faint outline, not a zero) */
    static Bitmap bars(float[][] cols, int[][] cc, int w, int h, float d, float min, boolean minutes) {
        w = Math.max(60, Math.min(w, 1400));
        h = Math.max(40, Math.min(h, 800));
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG), tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(MUTED);
        tp.setTextSize(10 * d);
        float mx = min;
        for (float[] c : cols) if (c != null) { float s = 0; for (float x : c) s += x; mx = Math.max(mx, s); }
        float axisW = 30 * d, labH = 14 * d, top = 6 * d, ch = h - labH - top, cw = (w - axisW) / 24f, bwid = cw * .66f, r = Math.min(bwid / 2, 3 * d);
        float step = minutes ? (mx > 120 ? 60 : mx > 60 ? 30 : mx > 20 ? 10 : 5) : niceStep(mx / 3);
        float full = (float) Math.ceil(mx / step) * step;
        p.setStrokeWidth(Math.max(1, d * .6f));
        for (float g = step; g <= full + .01f; g += step) {
            float y = top + ch - g / full * ch;
            p.setColor(GRID);
            cv.drawLine(axisW, y, w, y, p);
            String s = minutes ? (g >= 60 ? (g % 60 == 0 ? (int) (g / 60) + "h" : String.format(Locale.US, "%.1fh", g / 60)) : (int) g + "m")
                : (g >= 1000 ? (g % 1000 == 0 ? (int) (g / 1000) + "k" : String.format(Locale.US, "%.1fk", g / 1000)) : String.valueOf((int) g));
            cv.drawText(s, 0, y + 4 * d, tp);
        }
        for (int i = 0; i < 24; i++) {
            float x = axisW + i * cw + (cw - bwid) / 2, base = top + ch;
            if (cols[i] == null) {
                p.setColor(GRID);
                p.setStyle(Paint.Style.STROKE);
                cv.drawRoundRect(new RectF(x, base - ch * .18f, x + bwid, base), r, r, p);
                p.setStyle(Paint.Style.FILL);
            } else {
                float y = base;
                for (int k = 0; k < cols[i].length; k++) {
                    float hh = cols[i][k] / full * ch;
                    if (hh <= 0) continue;
                    p.setColor(cc[i][k]);
                    cv.drawRect(x, y - hh, x + bwid, y, p);
                    y -= hh;
                }
            }
            if (i % 6 == 0) cv.drawText(hLab(i), x - 2 * d, h - 2 * d, tp);
        }
        return b;
    }

    static float niceStep(float raw) {
        if (raw <= 0) return 1;
        double p = Math.pow(10, Math.floor(Math.log10(raw)));
        double[] m = {1, 2, 2.5, 5, 10};
        for (double k : m) if (raw <= k * p) return (float) (k * p);
        return (float) (10 * p);
    }
}
