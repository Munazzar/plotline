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

# Hey Plot assistant (Android)

The voice assistant itself (commands, answers, the sheet, settings) is in `assistant.js`. This side gives it a wake
word, a voice and a widget, through a second JavaScript interface, `window.PlotlineAssist` (`Assist`).

- **Wake word** (`WakeLoop`): the phone's speech recognizer listens in rounds for "hey <name>" (also hi / ok / okay,
  and near misses like "hey plat"). It uses the on-device recognizer when the phone has one, otherwise the regular one
  only if online speech is allowed. "Hey Plot, add milk to groceries" in one breath runs straight away; "Hey Plot" alone
  opens the assistant listening. It pauses while Plotline uses the mic itself or is talking.
- **While the app is open**: `Assist` runs the loop whenever MainActivity is on screen (found with activity lifecycle
  callbacks, so MainActivity itself needs no changes beyond registering the interface).
- **In the background** (`AssistService`): a foreground service of type microphone with a silent, minimum-importance
  "Listening" notification and a Stop button. Android only allows this when it is started while the app is open. A
  command heard in the background is kept and Plotline is opened on the assistant (route `assistant-bg`); Android only
  lets it open itself with "Display over other apps", otherwise a silent full-screen-intent notification
  (`USE_FULL_SCREEN_INTENT`) opens it when the phone is locked, or asks you to tap.
- **Hands-free**: right after a background wake, MainActivity shows over the lock screen and turns the screen on, so
  the answer is spoken without unlocking; once it's done and nothing follows, `background()` sends Plotline back.
  "Quiet listening" (`quiet` in the config, on by default) mutes the notification and system streams (and media,
  unless something is playing) for a moment around each recognizer round so its start/stop beeps don't play; streams
  are always unmuted before speaking, on stop, and on the next start after a crash.
- **Listening sounds** (`Chime`): a rising two-note chime when it starts listening and a falling one when it stops
  (command heard, or it gave up), each with a short buzz. Synthesised with `AudioTrack` on the assistant audio usage,
  so they stay clear while the recognizer's own beeps are hushed. `cues` in the config turns them off.
- **Connector requests** (`http(id, json)`): an https request for an agent connection whose server won't answer web
  pages (Notion). Only hosts in `HTTP_HOSTS`; the answer comes back as `window.__http(id, status, body)`.
- **Voice**: Android's text-to-speech (`TextToSpeech`). The `TTS_SERVICE` query is needed to find the engine on Android 11+.
- **Widget** (`AssistWidget`, Plotline · Assistant): the last thing you said and the reply, with Talk (opens the app
  listening) and Type. Widgets can't use the mic or take typing themselves.
- **App shortcut**: long-press the app icon › Assistant.
- **Phone assistant** (`AssistVIS`, `AssistSessionService`, `AssistRecognizer`): Plotline can be picked as the
  digital assistant app (Settings › Apps › Default apps; on Samsung, Side button › Press and hold › Digital assistant).
  Holding the side button then opens Plot listening, through `AssistEntry`. Android requires an assistant to also offer
  a speech recognizer, so `AssistRecognizer` passes recognition on to the phone's own one (Google's when installed).
- **Share to Plot** (`AssistEntry`): Share › Plotline from any app, and Send to Plotline on selected text. The text is
  kept for `takeShare()` and Plotline opens on the assistant, which asks where it goes (journal, a thread, today, a
  list) or answers a question about it.

## Adding it to the Android build

1. Compile `Assist.java`, `AssistService.java`, `AssistWidget.java`, `WakeLoop.java`, `AssistEntry.java`, `AssistVIS.java`,
   `AssistSessionService.java`, `AssistRecognizer.java` and `Chime.java` with the other sources.
2. Copy `res/layout/widget_assist.xml`, `res/xml/widget_assist_info.xml`, `res/xml/assist_shortcuts.xml`,
   `res/xml/assist_interaction.xml`, `res/xml/assist_recognizer.xml`,
   `res/values/assist_ids.xml` and `res/values/assist_strings.xml` into the app's `res/`.
3. Add the lines in `AndroidManifest-assist.xml` where its comments say.
4. One line in `MainActivity.onCreate`, after `PlotlineNative` is added:
   `web.addJavascriptInterface(new Assist(this), "PlotlineAssist");`
