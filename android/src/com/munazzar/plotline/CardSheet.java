package com.munazzar.plotline;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;
import java.util.Calendar;
import org.json.JSONObject;

/* What a tap on the Cards widget opens. Quick taps (tick, open) act and close without showing anything; the rest
   is a small sheet over the home screen, since a widget can't take typing or pickers itself:
   - item: done / not done, edit, pin, move up / down / to top, remind me (presets or any date and time), delete
   - add:  type one or more items (one per line)
   - card: add, open in Plotline, show this one as a full list (or back to cards), widget options */
public class CardSheet extends Activity {
    String op, src, id, iid; int wid;
    JSONObject all, e, it;
    boolean dark; int fg, muted, card, accent = 0xFFFFB547, onAccent = 0xFF1B1300, col;
    LinearLayout box; boolean armedDelete;

    int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    GradientDrawable round(int color, float r, int stroke) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(r)); if (stroke != 0) g.setStroke(dp(1), stroke); return g; }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent in = getIntent();
        op = str(in, "op"); src = str(in, "src"); id = str(in, "id"); iid = str(in, "i");
        wid = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0);
        if ("open".equals(op)) { open(Cards.route(src, id)); return; }
        all = Cards.load(this);
        e = Cards.entry(all, src, id);
        it = e == null || iid.isEmpty() ? null : Cards.item(e, iid);
        if (e == null || ("item".equals(op) || "tog".equals(op)) && it == null) { Toast.makeText(this, "That isn’t on this widget any more", Toast.LENGTH_SHORT).show(); finish(); return; }
        if ("tog".equals(op)) {
            boolean d = it.optBoolean("done");
            Cards.act(this, src, id, iid, d ? "undone" : "done", null, 0);
            finish(); overridePendingTransition(0, 0); return;
        }
        W.loadTheme(this);
        if (W.THEMED) { dark = !W.LIGHT; fg = W.TEXT; muted = W.MUTED; card = W.blend(W.BG | 0xFF000000, W.TEXT, 0.04f); accent = W.ACCENT; onAccent = W.ON; }
        else {
            dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            fg = dark ? 0xFFECEAE3 : 0xFF141A2B; muted = dark ? 0xFF8F96AC : 0xFF5D6580; card = dark ? 0xFF171D33 : 0xFFFFFFFF;
        }
        col = Cards.color(e.optString("a"));

        FrameLayout dim = new FrameLayout(this);
        dim.setBackgroundColor(0x99000000);
        dim.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        ScrollView sc = new ScrollView(this);
        box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(dp(20), dp(18), dp(20), dp(18));
        box.setBackground(round(card, 26, (col & 0x00FFFFFF) | 0x66000000));
        box.setClickable(true);
        sc.addView(box);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.min(getResources().getDisplayMetrics().widthPixels - dp(24), dp(520)), -2, Gravity.CENTER);
        dim.addView(sc, lp);
        setContentView(dim);
        if ("add".equals(op)) addForm();
        else if ("card".equals(op)) cardMenu();
        else itemMenu();
    }

    static String str(Intent i, String k) { String s = i.getStringExtra(k); return s == null ? "" : s; }

    void open(String route) {
        Intent o = new Intent(this, MainActivity.class);
        o.setAction("com.munazzar.plotline.ROUTE." + route); o.putExtra("route", route);
        o.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(o); finish(); overridePendingTransition(0, 0);
    }

    /* ---------- building blocks ---------- */
    void head(String kicker, String title) {
        box.removeAllViews();
        TextView k = new TextView(this); k.setText(kicker.toUpperCase()); k.setTextSize(11); k.setTypeface(Typeface.MONOSPACE); k.setLetterSpacing(0.12f); k.setTextColor(col);
        box.addView(k);
        TextView h = new TextView(this); h.setText(title); h.setTextSize(19); h.setTypeface(Typeface.DEFAULT_BOLD); h.setTextColor(fg); h.setMaxLines(3);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2); p.topMargin = dp(4); p.bottomMargin = dp(10); box.addView(h, p);
    }

    TextView row(String icon, String label, boolean danger, View.OnClickListener on) {
        TextView t = new TextView(this);
        t.setText(icon + "   " + label); t.setTextSize(16); t.setTextColor(danger ? W.LATE : fg);
        t.setPadding(dp(12), dp(13), dp(12), dp(13)); t.setBackground(round(Color.TRANSPARENT, 14, 0));
        t.setOnClickListener(on);
        box.addView(t, new LinearLayout.LayoutParams(-1, -2));
        return t;
    }

    LinearLayout chips() {
        LinearLayout r = new LinearLayout(this); r.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2); p.topMargin = dp(4); p.bottomMargin = dp(4); box.addView(r, p);
        return r;
    }

    TextView chip(LinearLayout r, String s, View.OnClickListener on) {
        TextView t = new TextView(this); t.setText(s); t.setTextSize(13.5f); t.setTextColor(fg); t.setGravity(Gravity.CENTER);
        t.setPadding(dp(10), dp(9), dp(10), dp(9)); t.setBackground(round(dark ? 0x14FFFFFF : 0x0A000000, 12, 0));
        t.setOnClickListener(on);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1); p.setMarginEnd(dp(6)); r.addView(t, p);
        return t;
    }

    TextView btn(String s, boolean pri) {
        TextView b = new TextView(this); b.setText(s); b.setTextSize(15); b.setTypeface(Typeface.DEFAULT_BOLD); b.setGravity(Gravity.CENTER);
        b.setPadding(dp(16), dp(10), dp(16), dp(10)); b.setTextColor(pri ? onAccent : fg);
        b.setBackground(pri ? round(accent, 14, 0) : round(Color.TRANSPARENT, 14, muted)); return b;
    }

    EditText field(String hint, String val, boolean multi) {
        EditText x = new EditText(this); x.setHint(hint); x.setText(val); x.setTextColor(fg); x.setHintTextColor(muted);
        x.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | (multi ? InputType.TYPE_TEXT_FLAG_MULTI_LINE : 0));
        if (multi) { x.setMinLines(3); x.setMaxLines(8); x.setGravity(Gravity.TOP | Gravity.START); } else x.setSingleLine(true);
        x.setBackground(round(dark ? 0x14FFFFFF : 0x0A000000, 14, 0)); x.setPadding(dp(14), dp(12), dp(14), dp(12));
        box.addView(x, new LinearLayout.LayoutParams(-1, -2));
        x.setSelection(x.getText().length());
        x.requestFocus();
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        return x;
    }

    void bar(View.OnClickListener onSave, String saveLabel) {
        LinearLayout bar = new LinearLayout(this); bar.setOrientation(LinearLayout.HORIZONTAL); bar.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        TextView cancel = btn("Cancel", false); cancel.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        bar.addView(cancel, new LinearLayout.LayoutParams(-2, -2));
        TextView save = btn(saveLabel, true); save.setOnClickListener(onSave);
        LinearLayout.LayoutParams sv = new LinearLayout.LayoutParams(-2, -2); sv.setMarginStart(dp(8)); bar.addView(save, sv);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-1, -2); bp.topMargin = dp(14); box.addView(bar, bp);
    }

    void done(String toast) {
        View f = getCurrentFocus();
        if (f != null) { InputMethodManager im = getSystemService(InputMethodManager.class); if (im != null) im.hideSoftInputFromWindow(f.getWindowToken(), 0); }
        if (toast != null) Toast.makeText(this, toast, Toast.LENGTH_SHORT).show();
        finish();
    }

    void act(String o, String text, long at) { Cards.act(this, src, id, iid, o, text, at); }

    /* ---------- item ---------- */
    void itemMenu() {
        boolean thr = "thr".equals(src), d = it.optBoolean("done"), pin = it.optBoolean("pin");
        head(e.optString("e", "") + "  " + e.optString("t"), it.optString("t"));
        if (!thr) row(d ? "↺" : "✓", d ? "Mark not done" : "Mark done", false, new View.OnClickListener() { public void onClick(View v) { act(it.optBoolean("done") ? "undone" : "done", null, 0); done(null); } });
        row("✎", "Edit", false, new View.OnClickListener() { public void onClick(View v) { editForm(); } });
        row("📌", pin ? "Unpin" : "Pin to the top", false, new View.OnClickListener() { public void onClick(View v) { act(it.optBoolean("pin") ? "unpin" : "pin", null, 0); done(null); } });
        if (!thr) {
            LinearLayout mv = chips();
            chip(mv, "↑  Up", new View.OnClickListener() { public void onClick(View v) { act("up", null, 0); done(null); } });
            chip(mv, "↓  Down", new View.OnClickListener() { public void onClick(View v) { act("down", null, 0); done(null); } });
            chip(mv, "⤒  Top", new View.OnClickListener() { public void onClick(View v) { act("top", null, 0); done(null); } });
            long rem = it.optLong("rem");
            row("🔔", rem > System.currentTimeMillis() ? "Reminder · " + Cards.when(rem) : "Remind me…", false, new View.OnClickListener() { public void onClick(View v) { remindMenu(); } });
        }
        final TextView del = row("🗑", "Delete", true, null);
        del.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            if (!armedDelete) { armedDelete = true; del.setText("🗑   Tap again to delete"); return; }
            act("del", null, 0); done("Deleted");
        } });
        row("↗", "Open in Plotline", false, new View.OnClickListener() { public void onClick(View v) { open(Cards.route(src, id)); } });
    }

    void editForm() {
        head("Edit", e.optString("t"));
        final EditText x = field("thr".equals(src) ? "Update" : "Item", it.optString("t"), "thr".equals(src));
        bar(new View.OnClickListener() { public void onClick(View v) {
            String t = x.getText().toString().trim();
            if (t.isEmpty()) { Toast.makeText(CardSheet.this, "Write something first", Toast.LENGTH_SHORT).show(); return; }
            act("edit", t, 0); done(null);
        } }, "Save");
    }

    /* ---------- reminders ---------- */
    void remindMenu() {
        head("Remind me", it.optString("t"));
        final Calendar k = Calendar.getInstance();
        LinearLayout r1 = chips();
        chip(r1, "In 1 hour", new View.OnClickListener() { public void onClick(View v) { setRem(System.currentTimeMillis() + 3600000L); } });
        chip(r1, "In 3 hours", new View.OnClickListener() { public void onClick(View v) { setRem(System.currentTimeMillis() + 3 * 3600000L); } });
        LinearLayout r2 = chips();
        if (k.get(Calendar.HOUR_OF_DAY) < 18) chip(r2, "This evening 6 PM", new View.OnClickListener() { public void onClick(View v) { setRem(at(0, 18, 0)); } });
        chip(r2, "Tomorrow 9 AM", new View.OnClickListener() { public void onClick(View v) { setRem(at(1, 9, 0)); } });
        String due = it.optString("due");
        if (!due.isEmpty() && due.compareTo(W.today()) >= 0) {
            LinearLayout r3 = chips();
            chip(r3, "On its date · 9 AM", new View.OnClickListener() { public void onClick(View v) { setRem(onDate(it.optString("due"), 9, 0)); } });
        }
        row("📅", "Pick a date and time…", false, new View.OnClickListener() { public void onClick(View v) { pick(); } });
        if (it.optLong("rem") > System.currentTimeMillis()) row("🔕", "Remove the reminder", true, new View.OnClickListener() { public void onClick(View v) { Cards.remind(CardSheet.this, src, e, it, 0); done("Reminder removed"); } });
    }

    static long at(int addDays, int h, int m) {
        Calendar k = Calendar.getInstance(); k.add(Calendar.DATE, addDays);
        k.set(Calendar.HOUR_OF_DAY, h); k.set(Calendar.MINUTE, m); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        return k.getTimeInMillis();
    }

    static long onDate(String ymd, int h, int m) {
        try {
            String[] p = ymd.split("-");
            Calendar k = Calendar.getInstance();
            k.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), h, m, 0); k.set(Calendar.MILLISECOND, 0);
            return k.getTimeInMillis();
        } catch (Exception x) { return at(1, h, m); }
    }

    void pick() {
        final Calendar k = Calendar.getInstance(); k.add(Calendar.HOUR_OF_DAY, 1); k.set(Calendar.MINUTE, 0);
        final int th = dark ? android.R.style.Theme_DeviceDefault_Dialog_Alert : android.R.style.Theme_DeviceDefault_Light_Dialog_Alert;
        DatePickerDialog dd = new DatePickerDialog(this, th, new DatePickerDialog.OnDateSetListener() {
            public void onDateSet(DatePicker v, int y, int mo, int d) {
                k.set(y, mo, d);
                TimePickerDialog td = new TimePickerDialog(CardSheet.this, th, new TimePickerDialog.OnTimeSetListener() {
                    public void onTimeSet(TimePicker tp, int h, int mi) {
                        k.set(Calendar.HOUR_OF_DAY, h); k.set(Calendar.MINUTE, mi); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
                        setRem(k.getTimeInMillis());
                    }
                }, k.get(Calendar.HOUR_OF_DAY), k.get(Calendar.MINUTE), android.text.format.DateFormat.is24HourFormat(CardSheet.this));
                td.show();
            }
        }, k.get(Calendar.YEAR), k.get(Calendar.MONTH), k.get(Calendar.DAY_OF_MONTH));
        dd.getDatePicker().setMinDate(System.currentTimeMillis() - 1000);
        dd.show();
    }

    void setRem(long when) {
        if (when <= System.currentTimeMillis()) { Toast.makeText(this, "Pick a time that hasn’t passed yet", Toast.LENGTH_SHORT).show(); return; }
        Cards.remind(this, src, e, it, when);
        done("Reminder set for " + Cards.when(when));
    }

    /* ---------- add ---------- */
    void addForm() {
        boolean thr = "thr".equals(src);
        head(e.optString("e", "") + "  " + e.optString("t"), thr ? "Add an update" : "goal".equals(src) ? "Add steps" : "Add items");
        final EditText x = field(thr ? "What’s new?" : "One per line", "", true);
        bar(new View.OnClickListener() { public void onClick(View v) {
            String t = x.getText().toString().trim();
            if (t.isEmpty()) { Toast.makeText(CardSheet.this, "Write something first", Toast.LENGTH_SHORT).show(); return; }
            int n = 0;
            if ("thr".equals(src)) { Cards.act(CardSheet.this, src, id, Cards.newId(), "add", t.length() > 2000 ? t.substring(0, 2000) : t, 0); n = 1; }
            else for (String line : t.split("\n|;")) {
                String s = line.trim(); if (s.isEmpty()) continue;
                Cards.act(CardSheet.this, src, id, Cards.newId(), "add", s.length() > 200 ? s.substring(0, 200) : s, 0); n++;
            }
            done(n == 1 ? "Added" : n + " added");
        } }, "Add");
    }

    /* ---------- card ---------- */
    void cardMenu() {
        final Cards.Opt o = Cards.opt(this, wid);
        int[] n = Cards.counts(e);
        head(Cards.noun(src).replaceAll("s$", ""), e.optString("e", "") + "  " + e.optString("t"));
        row("＋", "thr".equals(src) ? "Add an update" : "goal".equals(src) ? "Add steps" : "Add items", false, new View.OnClickListener() { public void onClick(View v) { addForm(); } });
        if (!"thr".equals(src) && n[1] > 0) {
            final boolean hide = o.done;
            row(hide ? "◌" : "◉", hide ? "Hide done items" : "Show done items", false, new View.OnClickListener() { public void onClick(View v) { o.done = !hide; save(o); } });
        }
        final boolean full = "list".equals(o.style);
        row(full ? "▤" : "☰", full ? "Back to the big card" : "Show this as a full list", false, new View.OnClickListener() { public void onClick(View v) {
            o.style = full ? "cards" : "list"; o.sel = id; save(o);
        } });
        final String[] det = {"compact", "detailed", "full"}, detN = {"Compact", "Detailed", "Everything"};
        LinearLayout dr = chips();
        for (int k = 0; k < det.length; k++) {
            final String dv = det[k];
            TextView t = chip(dr, detN[k], new View.OnClickListener() { public void onClick(View v) { o.detail = dv; save(o); } });
            if (dv.equals(o.detail)) { t.setBackground(round((accent & 0x00FFFFFF) | 0x33000000, 12, accent)); }
        }
        row("⚙", "More widget options…", false, new View.OnClickListener() { public void onClick(View v) {
            Intent i = new Intent(CardSheet.this, CardsConfig.class); i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
            startActivity(i); finish();
        } });
        row("↗", "Open in Plotline", false, new View.OnClickListener() { public void onClick(View v) { open(Cards.route(src, id)); } });
    }

    void save(Cards.Opt o) {
        if (wid != 0) { Cards.save(this, wid, o); CardsWidget.update(this, wid); }
        finish();
    }
}
