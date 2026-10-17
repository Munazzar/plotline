package com.munazzar.plotline;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/* Options for one Cards widget. Opens when the widget is added and from its ⚙ button:
   what it shows (lists, goals or threads), one big card or one full list, how much detail, which items, and what
   to hide (progress, counts, dates, pins and reminders, icons, numbers, done items, sub-goals). */
public class CardsConfig extends Activity {
    int wid; Cards.Opt o;
    boolean dark; int fg, muted, card, accent = 0xFFFFB547, onAccent = 0xFF1B1300;
    LinearLayout box;

    int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    GradientDrawable round(int color, float r, int stroke) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(r)); if (stroke != 0) g.setStroke(dp(1), stroke); return g; }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        wid = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0);
        /* backing out of the first setup still keeps the widget (with the defaults) */
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid));
        if (wid == 0) { finish(); return; }
        o = Cards.opt(this, wid);
        W.loadTheme(this);
        if (W.THEMED) { dark = !W.LIGHT; fg = W.TEXT; muted = W.MUTED; card = W.blend(W.BG | 0xFF000000, W.TEXT, 0.04f); accent = W.ACCENT; onAccent = W.ON; }
        else {
            dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            fg = dark ? 0xFFECEAE3 : 0xFF141A2B; muted = dark ? 0xFF8F96AC : 0xFF5D6580; card = dark ? 0xFF171D33 : 0xFFFFFFFF;
        }
        android.widget.FrameLayout dim = new android.widget.FrameLayout(this);
        dim.setBackgroundColor(0x99000000);
        dim.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { apply(); } });
        ScrollView sc = new ScrollView(this);
        box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(dp(20), dp(18), dp(20), dp(18));
        box.setBackground(round(card, 26, 0)); box.setClickable(true);
        sc.addView(box);
        dim.addView(sc, new android.widget.FrameLayout.LayoutParams(Math.min(getResources().getDisplayMetrics().widthPixels - dp(24), dp(520)), -2, Gravity.CENTER));
        setContentView(dim);
        paint();
    }

    @Override
    public void onBackPressed() { apply(); }

    void apply() {
        Cards.save(this, wid, o);
        CardsWidget.update(this, wid);
        finish();
    }

    void paint() {
        box.removeAllViews();
        TextView h = new TextView(this); h.setText("Cards widget"); h.setTextSize(19); h.setTypeface(Typeface.DEFAULT_BOLD); h.setTextColor(fg); box.addView(h);

        label("Show");
        seg(new String[]{"list", "goal", "thr"}, new String[]{"📝 Lists", "🎯 Goals", "🧵 Threads"}, o.src, new Pick() { public void on(String v) { if (!v.equals(o.src)) { o.src = v; o.sel = ""; } } });
        label("Layout");
        seg(new String[]{"cards", "list"}, new String[]{"Big card", "Full list"}, o.style, new Pick() { public void on(String v) { o.style = v; } });
        if ("list".equals(o.style)) {
            List<JSONObject> es = Cards.entries(Cards.load(this), o.src);
            if (!es.isEmpty()) {
                label("Which one");
                List<String> ids = new ArrayList<>(), names = new ArrayList<>();
                for (JSONObject e : es) { ids.add(e.optString("id")); names.add(e.optString("e", "") + " " + e.optString("t")); }
                if (!ids.contains(o.sel)) o.sel = ids.get(0);
                wrap(ids, names, o.sel, new Pick() { public void on(String v) { o.sel = v; } });
            }
        }
        label("Detail");
        seg(new String[]{"compact", "detailed", "full"}, new String[]{"Compact", "Detailed", "Everything"}, o.detail, new Pick() { public void on(String v) { o.detail = v; } });
        label("Items");
        seg(new String[]{"all", "open", "pinned", "due"}, new String[]{"All", "Open", "Pinned", "Due soon"}, o.show, new Pick() { public void on(String v) { o.show = v; } });

        label("Show on the card");
        toggle("Progress bar", o.prog, new Flip() { public void on(boolean v) { o.prog = v; } });
        toggle("Done count", o.count, new Flip() { public void on(boolean v) { o.count = v; } });
        toggle("Dates", o.due, new Flip() { public void on(boolean v) { o.due = v; } });
        toggle("Pins and reminders", o.marks, new Flip() { public void on(boolean v) { o.marks = v; } });
        toggle("Icon", o.emoji, new Flip() { public void on(boolean v) { o.emoji = v; } });
        toggle("Card number", o.badge, new Flip() { public void on(boolean v) { o.badge = v; } });
        toggle("Done items", o.done, new Flip() { public void on(boolean v) { o.done = v; } });
        if ("goal".equals(o.src)) toggle("Sub-goals", o.subs, new Flip() { public void on(boolean v) { o.subs = v; } });

        TextView tip = new TextView(this);
        tip.setText("On the widget: tap ○ to tick, tap an item to edit, pin, move, set a reminder or delete it, and + to add.");
        tip.setTextSize(13); tip.setTextColor(muted); tip.setLineSpacing(0, 1.15f);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-1, -2); tp.topMargin = dp(14); box.addView(tip, tp);

        TextView ok = new TextView(this); ok.setText("Done"); ok.setTextSize(15); ok.setTypeface(Typeface.DEFAULT_BOLD); ok.setGravity(Gravity.CENTER);
        ok.setPadding(dp(16), dp(12), dp(16), dp(12)); ok.setTextColor(onAccent); ok.setBackground(round(accent, 14, 0));
        ok.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { apply(); } });
        LinearLayout.LayoutParams op = new LinearLayout.LayoutParams(-1, -2); op.topMargin = dp(16); box.addView(ok, op);
    }

    interface Pick { void on(String v); }
    interface Flip { void on(boolean v); }

    void label(String s) {
        TextView t = new TextView(this); t.setText(s.toUpperCase()); t.setTextSize(11); t.setTypeface(Typeface.MONOSPACE); t.setLetterSpacing(0.12f); t.setTextColor(muted);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2); p.topMargin = dp(14); p.bottomMargin = dp(6); box.addView(t, p);
    }

    TextView chip(String s, boolean on) {
        TextView t = new TextView(this); t.setText(s); t.setTextSize(13.5f); t.setGravity(Gravity.CENTER); t.setMaxLines(1);
        t.setPadding(dp(8), dp(9), dp(8), dp(9)); t.setTextColor(on ? fg : muted);
        t.setBackground(on ? round((accent & 0x00FFFFFF) | 0x33000000, 12, accent) : round(dark ? 0x14FFFFFF : 0x0A000000, 12, 0));
        return t;
    }

    void seg(String[] vals, String[] names, String cur, final Pick p) {
        LinearLayout r = new LinearLayout(this); r.setOrientation(LinearLayout.HORIZONTAL);
        for (int k = 0; k < vals.length; k++) {
            final String v = vals[k];
            TextView t = chip(names[k], v.equals(cur));
            t.setOnClickListener(new View.OnClickListener() { public void onClick(View x) { p.on(v); paint(); } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1); lp.setMarginEnd(dp(6)); r.addView(t, lp);
        }
        box.addView(r, new LinearLayout.LayoutParams(-1, -2));
    }

    /* one choice per line (names can be long) */
    void wrap(List<String> vals, List<String> names, String cur, final Pick p) {
        for (int k = 0; k < vals.size() && k < 12; k++) {
            final String v = vals.get(k);
            TextView t = chip(names.get(k), v.equals(cur)); t.setGravity(Gravity.START | Gravity.CENTER_VERTICAL); t.setPadding(dp(12), dp(9), dp(12), dp(9));
            t.setOnClickListener(new View.OnClickListener() { public void onClick(View x) { p.on(v); paint(); } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.bottomMargin = dp(4); box.addView(t, lp);
        }
    }

    void toggle(String s, boolean on, final Flip f) {
        Switch sw = new Switch(this); sw.setText(s); sw.setTextSize(15); sw.setTextColor(fg); sw.setChecked(on);
        sw.setPadding(dp(4), dp(6), dp(4), dp(6));
        sw.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
            public void onCheckedChanged(android.widget.CompoundButton b, boolean v) { f.on(v); }
        });
        box.addView(sw, new LinearLayout.LayoutParams(-1, -2));
    }
}
