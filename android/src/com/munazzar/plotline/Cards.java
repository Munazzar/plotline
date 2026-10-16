package com.munazzar.plotline;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/* Data and per-widget options for the Cards widget (CardsWidget).
   The app sends {cards:{lists,goals,thr}} with the rest of the widget payload (widgetCards() in lists.js).
   Everything done on the widget is queued as {k:'wi',src,id,i,op,...} (W.enqueue) and applied by the app the next
   time it opens (cardsFromQueue() in lists.js); until then, load() layers the queued changes on top so the widget
   shows them straight away. */
final class Cards {
    static final String PREF = "plotline_cards";
    static final String[] SRC = {"list", "goal", "thr"};
    static final java.util.HashMap<String, Integer> COL = new java.util.HashMap<>();
    static {
        COL.put("health", 0xFF46C99B); COL.put("career", 0xFF6B9BFF); COL.put("family", 0xFFFF8C6B); COL.put("faith", 0xFFF0C862);
        COL.put("finance", 0xFFA9D14A); COL.put("learning", 0xFFAC93FF); COL.put("personal", 0xFFF585B8);
    }

    static int color(String area) { Integer k = COL.get(area); return k == null ? 0xFFAC93FF : k; }

    /* ---------- options, one set per widget ---------- */
    static final class Opt {
        String src = "list", style = "cards", detail = "compact", show = "all", sel = "";
        boolean prog = true, count = true, due = true, marks = true, emoji = true, badge = true, done = true, subs = true;

        JSONObject json() {
            JSONObject o = new JSONObject();
            try {
                o.put("src", src).put("style", style).put("detail", detail).put("show", show).put("sel", sel)
                 .put("prog", prog).put("count", count).put("due", due).put("marks", marks).put("emoji", emoji).put("badge", badge).put("done", done).put("subs", subs);
            } catch (Exception ignored) { }
            return o;
        }

        static Opt of(JSONObject o) {
            Opt p = new Opt();
            if (o == null) return p;
            p.src = o.optString("src", p.src); p.style = o.optString("style", p.style); p.detail = o.optString("detail", p.detail);
            p.show = o.optString("show", p.show); p.sel = o.optString("sel", "");
            p.prog = o.optBoolean("prog", true); p.count = o.optBoolean("count", true); p.due = o.optBoolean("due", true); p.marks = o.optBoolean("marks", true);
            p.emoji = o.optBoolean("emoji", true); p.badge = o.optBoolean("badge", true); p.done = o.optBoolean("done", true); p.subs = o.optBoolean("subs", true);
            return p;
        }

        /* rows a card shows before it runs out of room */
        int rows() { return "full".equals(detail) ? 12 : "detailed".equals(detail) ? 6 : 3; }
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, 0); }

    static Opt opt(Context c, int wid) {
        try { return Opt.of(new JSONObject(prefs(c).getString("w" + wid, "{}"))); } catch (Exception e) { return new Opt(); }
    }

    static void save(Context c, int wid, Opt o) { prefs(c).edit().putString("w" + wid, o.json().toString()).commit(); }

    static void forget(Context c, int wid) { prefs(c).edit().remove("w" + wid).commit(); }

    /* ---------- data ---------- */
    static String key(String src) { return "goal".equals(src) ? "goals" : "thr".equals(src) ? "thr" : "lists"; }

    static String noun(String src) { return "goal".equals(src) ? "Goals" : "thr".equals(src) ? "Threads" : "Lists"; }

    static String route(String src, String id) { return ("goal".equals(src) ? "goal/" : "thr".equals(src) ? "thread/" : "list/") + id; }

    /* every card source, with queued widget changes applied */
    static JSONObject load(Context c) {
        JSONObject all = W.data(c).optJSONObject("cards");
        if (all == null) all = new JSONObject();
        JSONArray q = W.queue(c);
        for (int k = 0; k < q.length(); k++) {
            JSONObject a = q.optJSONObject(k);
            if (a != null && "wi".equals(a.optString("k"))) try { apply(all, a); } catch (Exception ignored) { }
        }
        return all;
    }

    static List<JSONObject> entries(JSONObject all, String src) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray a = all.optJSONArray(key(src));
        if (a != null) for (int i = 0; i < a.length(); i++) { JSONObject o = a.optJSONObject(i); if (o != null) out.add(o); }
        return out;
    }

    static JSONObject entry(JSONObject all, String src, String id) {
        for (JSONObject o : entries(all, src)) if (id.equals(o.optString("id"))) return o;
        return null;
    }

    static List<JSONObject> items(JSONObject e) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray a = e == null ? null : e.optJSONArray("items");
        if (a != null) for (int i = 0; i < a.length(); i++) { JSONObject o = a.optJSONObject(i); if (o != null) out.add(o); }
        return out;
    }

    static JSONObject item(JSONObject e, String iid) {
        for (JSONObject o : items(e)) if (iid.equals(o.optString("id"))) return o;
        return null;
    }

    /* items as a card shows them: pinned first, then filtered by the widget's options */
    static List<JSONObject> visible(JSONObject e, Opt o) {
        List<JSONObject> out = new ArrayList<>();
        long soon = System.currentTimeMillis() + 2 * 86400000L;
        for (JSONObject it : items(e)) {
            boolean d = it.optBoolean("done");
            if (d && (!o.done || "open".equals(o.show) || "pinned".equals(o.show) || "due".equals(o.show))) continue;
            if ("pinned".equals(o.show) && !it.optBoolean("pin")) continue;
            if ("due".equals(o.show)) {
                String due = it.optString("due");
                boolean near = it.optLong("rem") > 0 || (!due.isEmpty() && due.compareTo(W.ymd(new java.util.Date(soon))) <= 0);
                if (!near) continue;
            }
            out.add(it);
        }
        /* open before done, pinned before the rest (stable, so the app's order is kept) */
        Collections.sort(out, new Comparator<JSONObject>() {
            public int compare(JSONObject a, JSONObject b) {
                int x = (a.optBoolean("done") ? 2 : 0) + (a.optBoolean("pin") ? 0 : 1), y = (b.optBoolean("done") ? 2 : 0) + (b.optBoolean("pin") ? 0 : 1);
                return x - y;
            }
        });
        return out;
    }

    static int[] counts(JSONObject e) {
        int n = 0, d = 0;
        for (JSONObject it : items(e)) { n++; if (it.optBoolean("done")) d++; }
        return new int[]{n, d};
    }

    /* ---------- one widget change ---------- */
    static void apply(JSONObject all, JSONObject a) throws Exception {
        String src = a.optString("src"), op = a.optString("op"), iid = a.optString("i");
        JSONObject e = entry(all, src, a.optString("id"));
        if (e == null) return;
        JSONArray arr = e.optJSONArray("items");
        if (arr == null) { arr = new JSONArray(); e.put("items", arr); }
        if ("add".equals(op)) {
            if (item(e, iid) != null) return;
            JSONObject it = new JSONObject().put("id", iid).put("t", a.optString("t")).put("done", false).put("due", "").put("pin", false);
            if ("thr".equals(src)) {
                it.put("e", "💭").put("at", a.optLong("ts", System.currentTimeMillis()));
                JSONArray n = new JSONArray(); n.put(it); for (int k = 0; k < arr.length(); k++) n.put(arr.opt(k)); e.put("items", n);
            } else arr.put(it);
            return;
        }
        JSONObject it = item(e, iid);
        if (it == null) return;
        if ("done".equals(op) || "undone".equals(op)) it.put("done", "done".equals(op));
        else if ("pin".equals(op) || "unpin".equals(op)) it.put("pin", "pin".equals(op));
        else if ("edit".equals(op)) it.put("t", a.optString("t"));
        else if ("rem".equals(op)) it.put("rem", a.optLong("at"));
        else if ("del".equals(op)) {
            JSONArray n = new JSONArray();
            for (int k = 0; k < arr.length(); k++) { JSONObject x = arr.optJSONObject(k); if (x != null && !iid.equals(x.optString("id"))) n.put(x); }
            e.put("items", n);
        } else if ("up".equals(op) || "down".equals(op) || "top".equals(op)) {
            List<JSONObject> L = items(e), same = new ArrayList<>(), other = new ArrayList<>();
            boolean pin = it.optBoolean("pin");
            for (JSONObject x : L) (x.optBoolean("pin") == pin ? same : other).add(x);
            int k = same.indexOf(it);
            if ("top".equals(op)) { same.remove(k); same.add(0, it); }
            else { int j = "up".equals(op) ? k - 1 : k + 1; if (j < 0 || j >= same.size()) return; Collections.swap(same, k, j); }
            JSONArray n = new JSONArray();
            List<JSONObject> first = pin ? same : other, second = pin ? other : same;
            for (JSONObject x : first) n.put(x);
            for (JSONObject x : second) n.put(x);
            e.put("items", n);
        }
    }

    static String newId() { return "w" + Long.toString(System.currentTimeMillis(), 36) + Integer.toString((int) (Math.random() * 1296), 36); }

    /* queue a change for the app and redraw the Cards widgets */
    static void act(Context c, String src, String id, String iid, String op, String text, long at) {
        try {
            JSONObject a = new JSONObject().put("k", "wi").put("src", src).put("id", id).put("i", iid).put("op", op).put("ts", System.currentTimeMillis());
            if (text != null) a.put("t", text);
            if ("rem".equals(op)) a.put("at", at);
            W.enqueue(c, a);
        } catch (Exception ignored) { }
        CardsWidget.updateAll(c);
    }

    /* ---------- reminders ----------
       A reminder set on the widget is armed on the phone right away (so it rings even if the app isn't opened first);
       the app keeps it in its own alarm list once it has applied the change. */
    static void remind(Context c, String src, JSONObject e, JSONObject it, long at) {
        act(c, src, e.optString("id"), it.optString("id"), "rem", null, at);
        try {
            android.content.SharedPreferences p = c.getSharedPreferences(Reminders.PREF, 0);
            JSONArray L = new JSONArray(p.getString("list", "[]")), out = new JSONArray();
            boolean step = "goal".equals(src);
            for (int i = 0; i < L.length(); i++) {
                JSONObject o = L.getJSONObject(i);
                boolean same = step ? "step".equals(o.optString("k")) && it.optString("id").equals(o.optString("s"))
                        : "litem".equals(o.optString("k")) && it.optString("id").equals(o.optString("i"));
                if (!same) out.put(o);
            }
            if (at > System.currentTimeMillis()) {
                JSONObject o = new JSONObject().put("at", at).put("title", it.optString("t"));
                if (step) o.put("body", e.optString("t")).put("k", "step").put("g", e.optString("id")).put("s", it.optString("id"));
                else o.put("body", e.optString("e", "📝") + " " + e.optString("t")).put("k", "litem").put("l", e.optString("id")).put("i", it.optString("id")).put("rp", false);
                out.put(o);
            }
            List<JSONObject> s = new ArrayList<>();
            for (int i = 0; i < out.length(); i++) s.add(out.getJSONObject(i));
            Collections.sort(s, new Comparator<JSONObject>() { public int compare(JSONObject a, JSONObject b) { return Long.compare(a.optLong("at"), b.optLong("at")); } });
            JSONArray fin = new JSONArray();
            for (int i = 0; i < s.size() && i < Reminders.MAX; i++) fin.put(s.get(i));
            Reminders.schedule(c, fin.toString());
        } catch (Exception ignored) { }
    }

    /* "Today 6:00 PM", "Tomorrow 9:00 AM", "Fri 8:30 AM" */
    static String when(long at) {
        if (at <= 0) return "";
        java.util.Date d = new java.util.Date(at);
        return W.dayLabel(W.ymd(d)) + " " + W.fmt(d, "h:mm a");
    }
}
