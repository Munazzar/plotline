# Cards widget (Android)

A home-screen widget that shows your lists, goals or threads as one big card at a time, styled like the Lists
carousel. The app side (data for the widget, applying widget changes, list-item reminders) is in `lists.js` and
`index.html`. This folder holds the Android side, which goes into the Android wrapper build alongside the other
widgets (`W`, `WidgetActions`, `ThreadsWidget` and the rest).

## What it does

- **Show**: Lists, Goals (steps, plus sub-goals) or Threads (updates). You pick per widget when you add it, or later from ⚙.
- **Layout**: *Big card* (one full-width card; ‹ 01 / 05 › go to the next list) or *One full list* (every item in a scrolling list; ‹ › switch which list).
- **Detail**: Compact (title and three open items, like the app's card), Detailed (six rows with dates, pins and reminders), Everything (twelve rows, done items and sub-goals).
- **Items**: All, Open, Pinned or Due soon.
- **Hide**: progress bar, done count, dates, pins and reminders, icon, card number, done items, sub-goals.
- **On an item**: tap ○ to tick it. Tap the item for Mark done / not done, Edit, Pin to the top, Move up / down / to the top, Remind me (in 1 or 3 hours, this evening, tomorrow 9 AM, on its date, or any date and time), Delete, Open in Plotline.
- **On a card**: + adds items (one per line), ⋯ has Add, Hide or show done items, Show as a full list, Compact / Detailed / Everything, More widget options, Open in Plotline.

Widgets can't take typing, drag-to-reorder or date pickers on the home screen itself, so those open a small sheet
over the home screen (`CardSheet`). Reordering is Move up / down / to the top rather than dragging.

Changes made on the widget show on the widget at once and are queued (`{k:'wi', src, id, i, op, ...}` in the
existing widget queue). The app applies them the next time it opens (`cardsFromQueue()` in `lists.js`). A reminder
set on the widget is armed on the phone right away, so it rings even if the app isn't opened first.

## Adding it to the Android build

1. Copy `src/com/munazzar/plotline/*.java` next to the other Java sources.
2. Copy `res/layout`, `res/drawable`, `res/xml` and `res/values/cards_ids.xml` into the app's `res/`.
   `cards_ids.xml` leaves out `w_root`, `w_add`, `w_next` and `w_count`, which `values/ids.xml` already declares.
3. Paste `AndroidManifest-cards.xml` inside `<application>` in `AndroidManifest.xml`.
4. Two one-line changes in existing files:
   - `W.java`, at the end of `updateAll()`: `CardsWidget.updateAll(c);` (so the widget redraws when the app sends new data)
   - `Notify.java`, in `route()`: `if ("litem".equals(k)) return "list/" + o.optString("l");` (a list-item reminder opens its list)

It follows the same rules as the other Java: no lambdas, framework views only, compiles against API 30.
It was compiled and packaged into a debug APK with apktool, dex2jar and the API 30 jar, but hasn't been run on a phone yet.
