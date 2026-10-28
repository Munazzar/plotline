# Plotlines handover

Written 2026-10-24 (updated the same day for 1.52.0 and 1.53.0) for a fresh Claude (new account, no project memory) picking up this project. Read this file
first, then save the important parts into your own project memory. Nothing secret is in here: no keys, passwords or
tokens. Where a secret is needed, this file says where the owner keeps it.

Current state: **v1.64.1 is on main and released** (versionCode 170). **The next versionCode is 171.** (`tools/apk/build.cjs` needs old and new versionName of the same length, so after 1.59.9 came 1.60.0.)

**Product rules for every change (section 7 has the full list):** sync everything except looks and device-only
things (section 2a); obvious features (delete, delete all, undo, search) must exist wherever data lives; secure and
private by default, because the app is heading to the **Google Play Store**; never break a working feature.

---

## 1. Who and what

- **Owner:** Munazzar (GitHub `Munazzar` owns the repo; the Claude-side login was `munazzaruddin`). Tests on both
  the web app and an Android phone. Uses a Windows PC called **PORTAL** for publishing.
- **Repo:** `Munazzar/plotline` (the only active repo). `plotline-native` is paused: don't work there.
- **App:** a personal life planner called **Plotlines** (renamed from "Plotline" in 1.41.0; the package id, storage
  keys, repo name and the `Plotline.apk` release asset kept the old name on purpose).
- **Web app:** GitHub Pages at `https://munazzar.github.io/plotline/` (served from `main`, so merging to main
  deploys the web app at once).
- **Android app:** a WebView wrapper that ships the same web files inside the APK (`assets/www/`), plus native Java
  for the voice assistant, widgets, alarms, natural voices and on-device AI. Distributed through GitHub Releases;
  the app's update banner points users at the latest release.

## 2. Architecture

Plain HTML/JS, no build step, no framework. Every file is loaded by `index.html` with a `<script src>` tag, in this
order: `bench.js, lists.js, assistant.js, agent.js, ai.js, convs.js, me.js, canvas.js, ink.js, kokoro.js, polish.js,
trackers.js, screen.js, moves.js, sched.js, guides.js, howto.js, setup.js, notes.js, bills.js, book.js`. Later scripts patch or wrap functions defined earlier, so
**order matters** and a later file often overrides an earlier one by reusing the same function name.

Run locally: `npx http-server -p 8765 -c-1` in the repo root (see `.claude/launch.json`). Test with headless
Playwright at 390 px (phone) and 1280 px (desktop).

| File | What it holds |
|---|---|
| `index.html` (~1.4 MB) | The core app: state `S`, storage (`DB`, IndexedDB store "waypoints"), router (`VIEWS`, hash routes like `#/today`, `#/goals`, `#/habits`, `#/cal`, `#/journal`, `#/settings`), Today/Home, habits, goals, calendar, journal, settings, Google sign-in and Drive sync, PIN lock, alarms (`alarmList`, `syncNative`), update banner, demo mode (`window.PLOT_DEMO`). `APP_VER` near line 3578. `PLOTLINE_CFG` near line 3490 holds the public Google client id, web URL and Firebase project id (public config, not secrets). Home cards order: `HOME_ORDER`. |
| `ai.js` | AI engines and settings (`window.AIX`): on-device models (wllama/llama.cpp in `lib/wllama`, Gemma via LiteRT-LM on Android), "Your AI server" (any OpenAI-compatible URL, e.g. Ollama/LM Studio), API engines, model setup card, Live conversation mode, voice picker, safety (family-safe mode), ACTION chips, quick settings sheet (`aiQuick`), Thinking switch, widget talk overlay (`talkStart/talkEnd`). |
| `agent.js` | The agent (`window.AGENT`): `AGENT.decide` (one JSON call choosing do/apps/live/schedule/talk), `AGENT.ask`, `AGENT.route`, tool lookups over Gmail, Google Calendar, Drive, Notion and the web (Open-Meteo weather, Nominatim places, DuckDuckGo + Wikipedia search), the Agent page with background tasks and inbox, connections UI (`AGENT.connHTML`). |
| `assistant.js` | "Hey Plot" voice assistant and the orb chat (`#asv`): command parser, chat UI (Ask was merged into it in 1.51.0), listening cues (`CUES`), thinking sounds (`THINK`), minimize bubble (`aiMini`), quick-settings strip (`qsBar`), Talk button. |
| `convs.js` | Conversations page: every chat, Live talk and Ask thread saved on the device (IndexedDB "convs"); continue, or "Make something from this". |
| `sched.js` | `SCHED.make`: reminders in plain words with repeats/windows, timers, check-ins; Home Scheduled card. |
| `setup.js` | Guided first-time setup (steps: notif, ai, voice, hey, conn, sync, lock, end). Add a step when a setup-worthy feature ships. |
| `me.js` | "Picture of me" page (`#/me`): an AI-written profile of the user from all their data; synced via Drive (`MESYNC`). |
| `guides.js` + `howto.js` | How-to page (`#/howto`): 70+ searchable guides with live looping demos of the real app in an iframe (`index.html?demo=<id>`). **Add a guide whenever a feature ships** and keep demo selectors in sync with UI changes. |
| `canvas.js` | "AI canvas": the AI builds a self-contained HTML page step by step, runs it in a sandboxed iframe, versions, Fix it. A version is only committed after it is test-run. |
| `bench.js` | Workbench: infinite canvas boards; encrypted sharing via Firestore (key only in the link's #fragment). |
| `lists.js` | Lists (checklists with deadlines), encrypted sharing, Cards widget data. |
| `trackers.js` | Custom activity trackers and Home Insights (AI-written with refresh). |
| `screen.js` | Screen time hour by hour (`#/screen`): reads `PlotlineAssist.usageHours`, stores `actLog()[day].hu/.un`, Day/Week/Month/All charts, legend, skip, limits, habits, `scrHours` for the AI. |
| `moves.js` | Activity in detail (`#/moves`): steps, workouts, sleep and places by day/week/month/all, day timeline, `actDetail` for the AI. |
| `ink.js` + `ocr/` | Handwriting/drawing (pressure, palm rejection, S Pen eraser) and photo-to-text (PaddleOCR on onnxruntime-web; Tesseract fallback). See `ocr/README.md`. |
| `kokoro.js` + `lib/phonemizer` | Natural voices (Kokoro TTS). Web uses ONNX Runtime Web; Android uses native `Kokoro.java`. |
| `polish.js` + `polish.css` | Design layer loaded last: SF-style icons, Apple type, shadows, backgrounds, swipe decks, page gears (`GEARS`), canvas mode. |
| `notes.js` | Notes (1.58: Thread renamed Notes in the UI only; data, routes and `thr*` names unchanged, `#/notes` aliases `#/threads`): quick-note box, templates, title from the first line, pin (`t.pin`), colour (`t.col`), labels (`t.tags`), search across notes, sort, duplicate, archive (= old status "done"), delete with undo, tickable checklists, voice typing, reminder, AI tools (summarise, tidy, to-dos, keep writing, ask). |
| `bills.js` | Bills (`#/bills`, `#/bill/<id>`): snap/pick a photo (PaddleOCR on device, or a Workbench vision AI), paste text, or read Gmail (`AGENT.mailSearch/mailRead`); the AI fills a strict JSON template (kind `not_a_bill` rejects junk; nothing guessed, nulls show "not read"); review sheet; totals check; due/paid, reminders, CSV, delete all. IndexedDB "bills" + `syncList("bills")`; photos per device ("billimg:<id>"). Ask: app-computed exact totals + bill index + BM25 top matches, answers cite `[bill:ID]`. Bills also feed `ragDocs`/`insOverview`. |
| `book.js` | Journal book (1.59): full-screen book, one page per day (cover + days oldest first + today), one page on phones and a two-page spread from 900 px. Opened from the Book tab next to Journal | Notes (1.59.2). Pages turn with a real paper fold (1.59.2): the fold line is the perpendicular bisector of the finger and the lifted corner; the page is clip-path'd to the spine side; the flap is the folded part reflected over the line (an affine matrix; on a spread it carries the next page pre-mirrored, so it lands readable), with gloss, a cast shadow and a drop shadow. The corner is kept within reach of the spine (turn.js-style), and a timer finishes every turn. Leather cover, page edges, grain, serif type; the paper follows the theme (light or dark). 1.59.3: an Aa panel in the book (`S.settings.book`, per device like other looks): paper, lines/dots, grain, font (book/clean/typewriter/handwritten), size, line spacing, first letter, moments, cover colour, turn style (curl/slide/fade), speed, page sound (generated noise, no files), two pages on wide screens, open on today or the last page read. 1.59.5: a turn never replaces the page under the finger (the next page is its own `.bk-under` layer), because Android stops sending a touch whose element was removed. Everything in the book has `touch-action:pan-y`, so the scrolling page boxes don't let Android take sideways swipes. Slide and fade follow the finger (`svStart/svSet/svEnd`). Paper "App theme" uses the app's own colours, and the journal writer takes the book's look (`sheetLook`, switch `wsync`). 1.59.6 (from the owner's screen recording): a turn is committed on release, and the header, scrubber and edges show the new page at once (`chrome(i)`). A new swipe, tap or key finishes a running turn immediately (`finishNow`), so pages flip quickly. Release uses ease-out and button turns ease-in-out, with no dead tail. 1.59.7 (flicker): new turn layers start behind the page (`.bk-prep`, z 0) and come forward after two frames, once painted. A finished turn repaints the pages under its layers and removes them two frames later. Slide and fade keep the incoming view on top until the pages are repainted. No CSS filters during turns (the drop-shadow is a gradient, `.bk-fsh`). The grain is a canvas PNG made once instead of an SVG feTurbulence. sw.js is network-first (4 s timeout, then cache); the web only, since the APK registers no service worker. Turning layers use `grid-column:1/-1`, or a spread's right-page layer is shifted a page to the right. Index by month, scrubber, write/edit via `writeSheet` and back to the same page, Back/Esc closes. |
| `privacy.html` | Privacy policy (rewritten 2026-10-24, lists every outside service). Update it when a feature contacts a new service. |
| `sw.js` | Service worker. Bump `CACHE` (`plotline-vX.Y.Z`) with every version. |
| `firestore.rules`, `database.rules.json` | Firebase rules for sharing (Firebase project `plotline-510215`; Anonymous auth must stay on). |
| `train/` | Notes and notebook for a small fine-tuned "Plot Mini" model and voice-speed measurements. |
| `android/` | The native Java that lives in the repo (see below) plus widget layouts, orb frames and READMEs. |

### Native Android

In the repo (`android/src/com/munazzar/plotline/`): `Assist*`, `WakeLoop` (wake word), `Listen` (mic buttons),
`Chime` (listening sounds), `AssistService` (background listening), `TalkActivity` (talk overlay over other apps),
`OrbWidget`, `ThreadsWidget`, `Cards*` (Cards widget), `RepAlarm` (repeating reminders), `Kokoro` (natural voice).
The JS bridge is `window.PlotlineAssist` (plus `window.PlotlineNative` from MainActivity).

**Not in the repo:** `MainActivity`, `LocalLlm`, `Voice`, `W`, `Notify`, `AlarmReceiver` and other wrapper classes
exist only as compiled code in `classes.dex` inside the released APK. There is no Gradle project. That is why every
build starts from the previous APK (section 4).

## 2a. What syncs (1.53) and how to add more

Sync is the user's own Google Drive app-data file `plotline.json` (`drive.appdata` scope), merged on every device.
**The owner's rule: apart from looks and UI customisation, features sync.** If a user sets "Your AI server" on the
phone, the web must pick it up on sign-in, and the same goes for every feature.

- **Syncs:** goals, steps, days, habits, journal, lists, threads, chapters, shares, activity (120 days), Workbench
  boards, Picture of me, the sharing key pair, and since 1.53: agent tasks (`agTasks`), agent reports (`agInbox`),
  conversations (`convs`), AI canvases (`canvases`: page, chat, saved data; the version history stays per device and an
  incoming page becomes a new version), and settings through `prefs`: name, act (trackers and activity goals), share,
  shPeople, places, aiInsAuto, ai (engine, url, model, smart, priv), aikey, agentOn, conn, notion.
- **Stays per device:** looks and layout (theme, fonts, cards, Home sections, tabs...), PIN and app lock,
  notification settings, which on-device model is downloaded, Google sign-in tokens, assistant and voice settings.
- **How it works** (index.html, search "1.53: the rest of the app syncs too"): `syncList(key,{load,get,set,out,inn})`
  registers a list of objects with ids. Each object gets `u` from a hash of its content; a removed id becomes a
  tombstone in `S.dead` (kept 120 days); the merge keeps the newest `u` per object. `syncPref(key,get,set,def)`
  registers a setting merged key by key; a key that was never changed counts as older than one with a value, so a
  fresh device takes the other device's value. `save()` asks every registered store whether it changed (`peek`) and
  starts a sync; modules with their own IndexedDB store call `window.syncTouch()` when they persist.
- **Adding a feature:** register its store with `syncList`/`syncPref` in the module itself, and make deletes remove
  the object from its list (the tombstone follows). Old app versions ignore unknown keys; re-adding is harmless.
- **An agent task runs once:** before a scheduled task runs, the agent syncs and re-checks `next`, so the phone and
  the web don't both run it.
- **Secrets in the Drive file:** the AI server key and Notion token travel in the app-data file (readable only by
  Plotlines with the user's Google token, like the journal itself). They never go into exported backups. Google
  tokens never sync.

## 3. Features and version history

Every feature below is shipped and on main. Versions with a PR number were merged; all through 1.51.1 are released
unless noted.

- **1.32–1.33.x:** core planner, Hey Plot voice assistant (smoother wake, Stop, side-button assistant, Share to Plot), Plot answers from all app data, interactive home-screen widget.
- **1.34.0 (PR #8):** Agent page with background tasks and inbox; Google Calendar (read+write), Gmail (read-only), Drive, Notion connections; Gemma 4 option; Vista renamed Timeline, Threads renamed Thread.
- **1.35.0 (PR #9):** UI overhaul, Halo theme, customizable Home, full-screen journal writing.
- **1.36.0 (PR #10):** handwriting/drawing, photo-to-text, adjustable Hey Plot silence timeout.
- **1.37.0 (PR #12):** long-press selection with bulk delete, sub-goal toggle, entire-journal view.
- **1.37.2 (PR #14, includes #13):** "Up next" day card, photo-to-text fixes.
- **1.38.0 (PR #15):** AI overhaul (model setup card, Live conversation mode, voice picker, minimal safety, ACTION chips).
- **1.38.1 (#16):** real download progress, 11 listening sounds, voice gender filter. **1.38.2 (#17):** Conversations page. **1.38.3 (#18):** agent lists real emails/events. **1.38.4:** agent plans its own lookups and writes a free-form answer with "What I'd do" buttons.
- **1.39.0 (#20):** chat/Live hand email/calendar/Drive/Notion work to the agent; foldable inbox; Halo Light default (later changed). **1.39.1 (#21)** and **1.39.2 (#22):** soothing thinking sounds; Ask routes to the agent too.
- **1.40.0 (#23):** `AGENT.decide` acts directly and fast; web connection. **1.40.1 (#24):** user's data first, then AI knowledge, then apps, web last. **1.40.2 (#25):** minimize bubble, quick settings, silent background listening.
- **1.41.0 (#26):** renamed to Plotlines, polish.js design layer. **1.41.1:** PaddleOCR photo-to-text. **1.41.2:** scroll and goal-open fixes.
- **1.42.0 (#31):** custom trackers, AI insights, grouped navigation, page gears. **1.42.1 (#32):** calendar tidy, carousels, orb widget.
- **1.43.0 (#33):** instant voice: command router, streamed speech, prompt caching, Plot Mini training notes.
- **1.44.0 (#34):** talk overlay over the screen, swirling orb widget, Thread swipe deck, two-app-copy save merge.
- **1.45.0 (#35):** reminders in plain words with repeats, timers, check-ins; Home Scheduled and Trends cards. **1.45.1 (#36):** new mic path (`Listen.java`) for a friend's listening bug. **1.45.2 (#37):** user's chosen sounds as defaults (thinking Bubbles, start Soft, stop Low hum). **1.45.4 (#39):** habit page day bar (lost in 1.46.0, restored in 1.46.3).
- **1.46.0 (#40):** Picture of me. **1.46.1 (#41):** reminder repeats fixed (native `RepAlarm`). **1.46.2 (#42):** Picture of me syncs. **1.46.3 (#43):** habit day bar restored.
- **1.47.0 (#44):** How-to page with live demos.
- **1.48.0 (#45):** natural voices (Kokoro, free and offline). **1.48.1 (#46):** settings jump, voice download stuck at 99%, sliders fixed.
- **1.49.0–1.49.4 (#47–#51):** AI canvas, stream resume, Thinking switch, keyboard layout, honest build status. **1.49.5 (#52):** pull-to-refresh only from the page itself. **1.49.6 (#53):** Home gear opens Settings, AI Home insights.
- **1.50.0 (#54):** guided first-time setup (shipped inside 1.51.0).
- **1.51.0 (#55):** Ask merged into the orb chat, separate Talk button, quick-settings strip, dark Halo default for new users.
- **1.51.1 (#56):** security/privacy hardening (shared boards/lists sanitized, canvas CSP lock, prompt-injection rules, OAuth state check, PIN backoff, full erase) and the rewritten privacy policy.
- **1.52.0 (#58):** agent news/trending/read_url lookups (Google News in the app or via proxy, GDELT in a browser, Wikipedia Current events fallback, Google Trends or Hacker News), tasks that learn from tapped tags (More of / Less of), per-task "Think with: Your AI server", "News for me" template, How-to in More and the sidebar, More gets AI & voice / Automations / Connections shortcuts, phone title fit, Agent card title CSS fix.
- **1.53.0:** almost everything syncs (section 2a): agent tasks and reports, conversations, AI canvases, trackers, AI server address/model/key, Notion token, agent connections. Home "Agent reports" card. "Delete all" for conversations and canvases. Agent read_url only reads public https hosts. Backups no longer carry the PIN hash.
- **1.54.0:** Screen time hour by hour (`screen.js`, `#/screen`): Day / Week / Month / All, hourly bars stacked by app (faded when light), a day-by-hour map, a typical day, a legend that hides apps, skip (not counted), daily limits with a nudge, habits that check themselves off, phone-habit tips; the assistant gets the hours (`scrHours`). Native: `UsageHours.java` + `PlotlineAssist.usageHours(days)`; `PlotlineAssist.http` now also does plain GETs to public https hosts (news/trends/RSS on Android). Settings in `S.settings.act.scx` (`act.scr` is the old daily screen-time goal: don't reuse it).
- **1.55.0:** Activity in detail (`moves.js`, `#/moves/<day>`): a 24-hour day line (sleep, workouts, steps, screen time), steps by hour against the goal and a typical day, workouts by type with start/end and usual start hour, a sleep schedule (bedtime to wake per night, green when the goal is met, bedtime spread), minutes at places. Charts reuse `SCREEN.bars`. `actDetail(ds)` feeds the assistant. Places have minutes only: the phone (compiled MainActivity geofencing) doesn't record arrival/leave times.
- **1.55.1:** steps by hour ignore Health Connect hours that are one day-long record spread evenly (Samsung Health writes steps that way; seen on the owner's phone): `flatHr` in index.html, used by `hrOf`, so both Activity and Activity in detail fall back to the phone counter's readings or say why there's no hourly chart. Fixed properly in 1.56.
- **1.56.0:** steps by hour from the phone's own step counter: `StepHours.java` reads TYPE_STEP_COUNTER every ~15 min (inexact repeating alarm, request code 612, action `A_TICK` to `Auto`, so no manifest change and no exact-alarm permission) and keeps 11 days of readings; `PlotlineAssist.stepHours(days)` returns steps per hour; JS stores `actLog()[day].hs`, preferred by `hrOf` when Health Connect has no real hours. **Smali patch in classes.dex:** `Auto$3.run` calls `StepHours.tick(c)` right after `Auto.sampleSteps` (two instructions). Classes6.dex now holds Assist, UsageHours, StepHours. Re-apply the patch if classes.dex is ever rebuilt from elsewhere.
- **1.56.1: no estimates anywhere (owner's rule).** `hrOf` returns only measured hours: real Health Connect hours, else the phone's counted hours (`hs`), with `null` (shown striped, "not recorded") before counting began (`hsFrom`/`hsAt`, from `StepHours` `from`). The old spreading of app-open readings (`sp`) and the steps-based "about X km" distance are gone; distance shows only when measured.
- **1.57.0: agent tasks run by themselves, app closed, no taps.** `BgAgent.java` (a dataSync foreground service, added to the binary manifest with `tools/apk/manifest.cjs` by copying the LiveShare `<service>`; check with aapt2) is started by an alarm at each task's time: exact when "Alarms & reminders" is allowed, else `setAndAllowWhileIdle` when Plotlines ignores battery optimisation (both let an alarm start a foreground service). It loads `https://appassets.androidplatform.net/index.html?bg=agent` in an invisible WebView (same origin, same data), and agent.js's runner does every due task, posts each result (`PlotlineBg.done`), syncs and stops (`PlotlineBg.finish`), 8 min max. Thinking: Your AI server as usual, or the on-device model via `PlotlineBg.llm` -> `LocalLlm.ensure/complete` (the phone's llama-server, as AI notification replies use) with the model the app passes in `PlotlineAssist.bgModel`. The app schedules with `PlotlineAssist.bgAgent([{at}])` from `agentAlarms` and drops the "Open Plotlines and I'll run it" reminder for tasks that will run by themselves. New do-it-itself templates: Plan my day, Write my day, Get tomorrow ready. Also: the in-app dropdown picker (`.selp`) sits above every sheet (it opened behind Plot settings).

- **1.58.0:** Bills (`bills.js`), Thread renamed Notes with note-taking features (`notes.js`), Settings › Updates with a Check for updates button (index.html, "1.58: Settings › Updates"). Voice commands accept "note" as well as "thread". Agent suggestions the AI writes into its answer text (a "Suggestions" list) are lifted out into one-tap buttons (`sugsFromText`/`liftSugs` in agent.js), also for older reports.

- **1.59.0: UI quality pass.** Mirrored flip cards: screen.js (1.54) defined a global `.flip{transform:scaleX(-1)}`, the same class flip cards use. It is now `.scr-flip`, and flip faces rotate on their own. Narrow goal step cards with broken titles: screen.js reused `.sc-in` (now `.scr-in`) and sched.js `.sc-t` (now `.sd-t`). screen.js `.sc-top` is now `.scr-top`. **Rule: scope every module class with its own prefix.** Also: the Notes icon is restored (the 1.58 rename turned polish.js `IC.thread` into `note`), and the canvas data key is `threads` again. Plus: Up next deck shadows no longer clipped, theme grid fits, back faces scroll, phone header buttons, goal card labels wrap, note previews without markdown (`thrPlain`), Agent reports in full on Home with show/hide (`A.hmin`), journal book mode.

- **1.59.8: bugs found by the Android emulator tests** (`tools/android-test/`, see its README; run `tools/android-test/run.sh` before every release).
  - **Book:**
    - A turn decides from where the finger lifts. The last pointermove can arrive late or be skipped (`dragP` in `onUp`). A swipe whose moves never arrived at all (only down and up, 40 px or more sideways) still turns.
    - `animTo`/`svAnim` clamp `k>=0`: the first rAF is stamped before `t0`, which swung the page back for a frame.
    - A swipe may start on a button inside the page ("Add to this day", edit). A tap still presses it.
    - An edge tap that turns the page swallows the click Chrome would move onto a nearby button (`NOCLICK`).
    - The page number follows the text (`.bk-pc` is a flex column) instead of being drawn over it.
    - The Aa and Contents panels' sticky header covers the status bar.
  - **Writer (phone):** the top row with Done stays below the status bar (sticky; `wr-stuck` paints behind it once scrolled), and the formatting bar sits under it.
  - **Tour prompt:** it waits while the book or a sheet is open.
  - **Bills:**
    - "From a picture" works again. The review sheet's pick action is now `blPickF`; it had the same name as the picture action and replaced it.
    - A receipt line that holds only a quantity takes its name from the line above and fills Qty. This includes OCR putting "2" on a line of its own between "Apples" and "3.40" (`pq` in `picks`). `tools/android-test/picks-check.cjs` checks this.
    - Item columns are in px, so the headings line up.
    - The item count follows added and removed rows, and the × fits.
  - **`planEngine()` picks on-device AI only when its model is on the phone, or already downloading (`natReady`).** Before this, the first Bills read on a fresh install started a 2.8 GB Gemma download with no notice and no way to stop it.
  - **Halo:** text on moment and note cards (`--mo` #262A3C) is light.
  - **Other:** the Journal/Notes/Book row wraps instead of clipping "Book". The setup dots count the same steps as "1 of 7".
  - **Curl folds the real page.** When the turning page is the one on screen (forward turns, and spreads), that page itself folds (`real` in `turnStart`, `unfold` in `turnEnd`). Before, a fresh copy was used, and it could show blank for a frame or two before Android painted it. Only a phone page coming back from the left is still a copy. After this, about 10,000 recorded frames had no blank or flicker frames.
  - **Safe areas:** the book uses the native `--sat`/`--sab` (as the rest of the app does). On Android, `env(safe-area-inset-top)` can read 0, which put the book's top bar under the status bar.

- **1.59.9: vibrate when you tap.**
  - Settings › Look & feel offers Off, Light, Medium or Strong (`S.settings.hap`, per device, default Light; 8, 16 or 28 ms). The section shows in the Android app or on touch screens.
  - Every buzz goes through `hap()` (index.html, next to `vib`), and `vib()` now calls it. A capture-phase click listener buzzes on touch taps of buttons, links, tabs and toggles, but not on mouse clicks or scrolls. Two buzzes within 70 ms play once.
  - Off also silences the other buzzes (`hapOn()` in the assistant cue and reactions).
  - WebView vibrations are `Usage=TOUCH`, so Android's system touch-feedback setting can mute them.
  - Guide: `touch-vibrate`.

- **1.60.0: no flicker by design (the owner's idea).** A page that isn't on screen yet is plain paper while it turns in: the under page, the flap's back on a spread, a phone page coming back, and the slide/fade incoming view. A cover keeps its leather. The words are drawn once the turn lands, in `paint()`. See `blankPg` in book.js. Owner, 2026-10-27: the flicker was still there on the phone in 1.59.9.

- **1.64.1: "what's open today" is exact, and the natural voice no longer goes silent mid-answer.** `todayRead` (assistant.js) lists today's open goals and reminders, goal steps due, habits not done yet and the last week's overdue items, straight from the data; `OPEN_TODAY` routes "what's open/left/pending today" to it, and `asCtx` adds it as an exact section for any question mentioning today/left/open/due, so the AI never has to find today in search. Lists are now in `ragDocs` too (notes already were, from the thread patch). Voice: `sqStart` and the spoken answer call `wakePause(true)` for the whole answer (on Android the wake listener restarted between sentences and its beep-hush muted the media stream Kokoro plays on); Kokoro `clean()` drops symbols and `can()` only sends other scripts' letters to the system voice (a → or ⏰ used to switch the sentence to the system voice); `sqEnd` lines the final text up with what was spoken by letters and digits.
- **1.64.0: commands the on-device AI gets right, and nothing you say is lost.** Both AI paths (`AGENT.decide` in agent.js and `llmIntent` in assistant.js) return items {type,title,detail,when,end}: the model copies the time words as said and `whenOf`/`parseWhen` work out the dates (spoken words beat a model-computed date); `end` gives the duration. A today goal, goal or habit with a time gets its reminder (`addToday(t,w)`, `also()` in `doItem`, habit `time`+`remind` in `AIX.doAct`). Requests made while busy queue in `AS.q` (run in `afterSpeak`); Stop puts the words back in the box and `halt()` drops results of model calls that can't be cancelled. The mic/orb no longer cancel while thinking; `.as-tag` (chat) and `#lvTag` (Talk out loud) are the start/stop listening buttons; Talk out loud keeps unsent words as `LV.retry` with a Send again button. No training: `train/golden.jsonl` + `train/score.py` score the stock model on 45 real requests after a prompt change.
- **1.63.0: plain-words search and pin-anything-to-Home.** `featureFind` (howto.js) indexes pages (`window.FF_PAGES`), settings (`window.FF_SETS` plus `SETK` words), a few extras and every guide; scoring is word-start, synonyms (`SYN`), one typo on 6+ letter words, a bonus per matched query word, settings/pages above guides. Its results go first in Find anything; the search button now shows on phone Home (the summary line moved under the greeting). Pins (index.html, after Customize Home): `pinBtns` adds a faint `.hpin-b` to the first h1, `.st-h>h3` and `.sc-cht>b` on every page (MutationObserver on #view); `S.settings.homePins` (per device, like Home sections) holds {r,i,h,pn}; `pinsHTML` renders the page view and keeps that section (or the whole page minus its header, capped) and the keys `pin:<id>` join `HOME_ORDER`/`HOME_NAME` so Customize Home moves, hides and removes them.
- **1.62.0: Screen time and Steps home-screen widgets** (`StatsWidget`, `ScreenWidget`, `StepsWidget` in android/src; layouts `widget_stats`, `widget_stats_steps`; `AndroidManifest-stats.xml`). Screen time reads `UsageHours.json` itself on every redraw (skip list and renamed apps come from the app as `stats.skip`/`stats.lab`); Steps draw the app's `stats.stp` (day, total, goal, hours with -1 = not measured) and say when it's from an earlier day. The app sends `stats` with the widget payload (`scrWidget()` in screen.js, `stepsWidget()` in moves.js); `W.updateAll` was patched in smali to redraw them.
  - **Native build route used for 1.62.0 (PORTAL PC, no Gradle):** JDK 21 at `C:UsersPORTALAndroidjdk`, SDK `build-tools;34.0.0` + `platforms;android-34`, `C:UsersPORTALAndroid	oolsapktool.jar` (2.10.0). `apktool d` the last APK; add res/manifest entries and smali patches in the decoded tree; `apktool b`. Compile new Java with `javac --release 8` against android.jar plus small stubs for compiled-only classes (W) and D8 (`java -cp build-tools/34.0.0/lib/d8.jar com.android.tools.r8.D8 --min-api 29`; no anonymous classes, D8 34 crashed on one) into `classes7.dex`. Then `tools/apk/build.cjs` with the apktool output as base, the ORIGINAL `classes2..6.dex` as replacement entries (only classes.dex comes from apktool's smali, because of the W patch) and `classes7.dex` added.
- **1.61.0: Home widgets, a Reminders manager and workout programs.** Home has Screen time (`scrHome` in screen.js) and Steps (`stepsHome` in moves.js) cards, today hour by hour; they are Customize Home sections `scr` and `stp` and render nothing when nothing was recorded today. More › Reminders / Scheduled › Manage (`remMgr` in sched.js) lists every alarm source once (deduped from `alarmList(now,true)`), with Edit (the existing `remEdit` sheet), Off with undo, search, and Pause all (`S.settings.remPause`, per device: it filters `alarmList` and mutes `notify` except the focus timer). Workout programs (`WKP` in index.html, after Customize Home) make one `routine` habit per session on fixed weekdays, marked `wk`; offered in the routine templates and on gym-ish habits and goals (`GYM_RX`).
  - 1.60.2 (not released): turning `.bk-pc` to `overflow:hidden` during a curl made the top bar vanish for a frame at turn start (layer rebuild). Don't toggle overflow or other layer-creating styles at turn start. The phone's slow-turn flicker is still open; a phone screen recording was asked for.
- **1.60.1: the curl works like Munazzar/noor's book reader** (the owner: "smooth on web as well, no issues at all, just replicate that"). Slow drags on the owner's phone still flickered the shadow and the next page.
  - The turning layers (`lays()`: under, copy, shadow strips, flap) are made once per open book and reused (`visibility` toggles), never created or removed mid-turn.
  - The flap carries its transform and clip-path on one element (`will-change:transform,clip-path`). The real pages have `will-change:clip-path`.
  - The cast shadow, the shade on the lifted page and the flap's gloss are fixed-gradient strips (`.bk-cs/.bk-fs/.bk-gl`) moved with transform. No gradient is rebuilt per frame; only the two clip paths change.
  - `tools/android-test/slow-drags.cjs` records slow drags with a CPU slowdown. Neither the host-GPU nor the software-GPU emulator ever reproduced the phone's flicker, so the phone is the real test.

### versionCode table (for the APK)

1.38.0=98 … 1.40.2=108, 1.41.0=109, 1.41.1=110, 1.43.0=116, 1.44.0=117, 1.45.0=118, 1.45.1=119, 1.45.2=120,
1.45.4=122, 1.46.0=123, 1.46.1=124, 1.46.2=125, 1.46.3=126, 1.47.0=127, 1.48.0=128, 1.48.1=129, 1.49.0=130 …
1.49.6=136, 1.50.0=137, 1.51.0=138, 1.51.1=139, 1.52.0=140, 1.52.1=141 (#59, built but not released when 1.53.0 shipped), 1.53.0=142, 1.54.0=143, 1.55.0=144, 1.55.1=145, 1.56.0=146, 1.56.1=147, 1.57.0=148, 1.58.0=149, 1.59.0=150, 1.59.1=151, 1.59.2=152, 1.59.3=153, 1.59.4=154, 1.59.5=155, 1.59.6=156, 1.59.7=157, 1.59.8=158, 1.59.9=159, 1.60.0=160, 1.60.1=161, 1.61.0=162, 1.62.0=163, 1.63.0=164, 1.63.1=165, 1.63.2=166, 1.63.3=167, 1.63.4=168, 1.64.0=169, 1.64.1=170. **Next: 171.**

## 4. Building the APK (cloud, no Android SDK)

**Easiest, no Java needed (1.52+): `tools/apk/` in the repo.**
`node tools/apk/build.cjs <base.apk> <repo dir> <out.apk> <oldVer> <newVer> <oldCode> <newCode> <key.pem> <cert.der>`
swaps `assets/www`, patches the manifest, 4-byte aligns stored entries and signs with APK Signature Scheme v2 (RSA
PKCS#1 v1.5 with SHA-512, algorithm 0x0104, the same one apksig picks). `node tools/apk/v2.cjs <apk>` verifies and
prints the certificate SHA-256; it accepts the apksig-signed official APKs, so it is a real check. The `.jks` is
PKCS12: `openssl pkcs12 -in plotline-upload.jks -passin file:pass.txt -nocerts -nodes | openssl pkey -out key.pem` and
`openssl pkcs12 -in plotline-upload.jks -passin file:pass.txt -nokeys -clcerts | openssl x509 -outform DER -out cert.der`.
On the PORTAL PC the key zip is `C:\Users\PORTAL\Downloads\plotline-signing-key (1).zip` and base APKs are in
`C:\Users\PORTAL\Claude and me\apk\<version>\`. Delete the extracted key after each build. The Java/apksig route
below still works where Java exists.

There is no Gradle build. `dl.google.com`, `maven.google.com`, Hugging Face and GitHub release downloads are blocked
from the cloud container. Maven Central and PyPI work (retry on HTTP 429).

**Inputs you need in the new project (the old project's files do not move with you):**
1. **The latest released APK** (1.51.1) as the base. Download `Plotline.apk` from the GitHub release v1.51.1 on a
   device and upload it to the new project, or stage it from the PORTAL PC. Old APKs were kept under
   `apk/<version>/Plotline.apk` in the project files.
2. **The signing key.** The owner has a zip with `plotline-upload.jks` and a password file (alias `plotline`).
   Upload it to the new project. The signing certificate's SHA-256 must start with `7bb13e1a`
   (`7B:B1:3E:1A…48:99`). **An APK signed with any other key will not install over the existing app.** Delete
   the extracted key after each build.

**Web-only release (most versions):**
1. Copy the previous APK. Replace the files in `assets/www/` with the repo's web files (`index.html`, all `.js`,
   `polish.css`, `sw.js`, `privacy.html`, `lib/`, `ocr/`, fonts as needed). **Add any new web file** (e.g. a new
   `.js`), or the app breaks on Android.
2. Patch the version in the binary `AndroidManifest.xml`: versionName is UTF-16 in the string pool (same length
   is easiest), versionCode is an int attribute. Find the bytes `08 00 00 10` followed by the old code
   (little-endian int) and replace the code. Don't use fixed offsets (the pool moved in 1.41.0).
3. Rebuild the zip with Python `zipfile`: drop `META-INF` signature files, keep each entry's compression, 4-byte
   align stored entries with an extra field. Never open two writers on the same output file.
4. Sign **v2 only** with `com.android.tools.build:apksig:2.3.0` from Maven Central via a small Java program (v1
   signing crashes on Java 21). Run java with
   `--add-exports java.base/sun.security.x509=ALL-UNNAMED` (also `pkcs` and `util`). Verify with `ApkVerifier`
   and check the cert fingerprint.
5. Bump `APP_VER` in `index.html` and `CACHE` in `sw.js` in the same PR.

**When repo Java changes, on the PORTAL PC (1.54 route, no dex2jar round trip of other classes):** download Temurin JDK 21, `org.robolectric:android-all:11-robolectric-6757853`, `com.jakewharton.android.repackaged:dalvik-dx:16.0.1` and dex2jar 2.4.38 (GitHub ThexXTURBOXx/dex2jar, it bundles `d2j-baksmali`/`d2j-smali`) into the scratch folder (ask the owner first). Then: dex2jar every `classes*.dex` only to use as a compile classpath; `javac --release 8` the changed classes (`Assist.java`, `UsageHours.java`) against android-all plus those jars and diff `javap -p` with the released class so nothing is lost; `BaksmaliCmd` classes4.dex, delete the replaced classes' `.smali` (`Assist.smali`, `Assist$*.smali`), `SmaliCmd` it back to classes4.dex; `dx --dex --min-sdk-version=26` the new classes into a new **classes6.dex**; then `node tools/apk/build.cjs ... classes4.dex=<new4> classes6.dex=<bridge>`. The next native change should replace classes6.dex the same way.

**Older route (cloud):** dex2jar (`de.femtopedia.dex2jar:dex-tools 2.4.38`) the APK's `classes.dex`,
`classes2.dex`, `classes3.dex`; compile the changed `.java` with `javac --release 8` (no lambdas) against
`org.robolectric:android-all:11-robolectric-6757853` (an API 30 android.jar) plus those jars; put the classes into
`classes4.jar` (where `Assist*`, `WakeLoop`, `Chime` and friends live; `Cards*` are in an earlier dex, leave them)
and convert back with Jar2Dex / `dalvik-dx 16.0.1`. Kokoro's ONNX Runtime 1.20.0 is in `classes5.dex` and
`lib/arm64-v8a` (newer ORT AARs are Java 17 bytecode that dx can't read). Patching compiled classes in
`classes.dex` has been done with smali/baksmali 2.5.2. Manifest or resource changes (new activities, labels) were
done with a hand-written AXML reader/writer in Python; androguard from PyPI is handy for checks.

## 5. Releasing

- **Cloud sessions cannot create GitHub releases** (403, platform rule). Workarounds (release-on-tag Action, pushing
  the APK into the repo) are blocked too. Merging PRs from the cloud with the GitHub MCP merge tool works fine.
- **What works:** get the signed APK onto the PORTAL PC, then start a **Remote Control session** there in
  `C:\Users\PORTAL\Claude and me` (gh is signed in as Munazzar; the shell is PowerShell) that checks the SHA-256 and
  runs:
  `gh release create vX.Y.Z Plotline.apk -R Munazzar/plotline --target main --latest`
- **The asset must be named exactly `Plotline.apk`.** The in-app update banner (Android only, 6-hour cache)
  compares the latest release tag with `APP_VER` and downloads `releases/latest/download/Plotline.apk`.
- **Getting the APK onto the PC:** folder access to `C:\Users\PORTAL\Claude and me`, then `device_commit_files` from
  the project files. Do this before starting RC, because a running RC session hides the folder tools. Fallback used
  several times: a temporary commit of the APK on the work branch (`tmp-apk/Plotline.apk`) that the RC session
  fetches with `gh api`, then remove that commit. Last resort: the user downloads it from the thread.
- **PC safety-check quirks:** the PC's auto mode sometimes blocks `gh release create` ("Create Public Surface"),
  inconsistently, even with an allow rule in settings. What reliably works: ask the user for a one-word reply like
  **"Yes, publish v1.52.0"** and start (or restart) the RC session *from that message*. A relayed approval from
  another Claude is refused. In PowerShell, wrap a `cmd.exe /c` argument in single quotes. RC can't edit
  `.claude` settings (counts as self-modification). The RC's `gh release view` may be blocked: verify from the cloud
  with the GitHub MCP `get_release_by_tag` (shows the asset digest).
- **Standing approval:** the user said "You merge pr and release apk i give you go ahead. Use my pc if needed."
  On 2026-10-24 they repeated it for publishing: "yes publish dont ask again until i tell other wise".
  Merge and publish without extra back-and-forth, and never ask the user to run commands themselves (they find the
  publish hurdles frustrating).
- **Parallel work:** when several threads ship at once, versions collide. Later PRs rebase on the merged one and take
  the next version and versionCode, so each APK carries everything.

## 5a. Google Play readiness (the owner is a solo developer)

- **1.57 background agent:** a dataSync foreground service started from an alarm. Play's foreground-service declaration needs a short video of a scheduled task running and its notification; SCHEDULE_EXACT_ALARM is justified by reminders and scheduled tasks. The owner wants tasks to run with no taps, so keep it automatic.

Everything new must be approvable on Play without company paperwork. Known items before submitting:
- **Usage access (PACKAGE_USAGE_STATS):** allowed for screen-time features. Show the in-app explanation before sending the user to Android's setting (done on the Screen time page). Declare it in the Data safety form (app activity, on device, optional sync to the user's Drive).
- **Needs Play declarations or justification:** ACCESS_BACKGROUND_LOCATION (places auto-check-off: needs the location declaration and a short video, or drop background and use foreground only), USE_FULL_SCREEN_INTENT (only allowed for alarms/calls: the assistant's lock-screen use may be refused; consider removing), SYSTEM_ALERT_WINDOW (talk overlay: explain), REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (restricted: needs a core-function reason or remove), foreground service types (microphone, dataSync: each needs the FGS declaration with a video), SCHEDULE_EXACT_ALARM (reminders: OK for alarm/reminder apps), BIND_VOICE_INTERACTION (assistant role: OK if it is a real assistant).
- **Never add QUERY_ALL_PACKAGES** (restricted). App names come from apps that have a launcher icon, which needs no special permission.
- Play needs an AAB signed by Play App Signing and a target SDK within a year of the latest. The current wrapper has no Gradle project; publishing on Play will need a real Android project (or a bundle built from the APK with bundletool), a privacy policy URL (`privacy.html` on GitHub Pages works) and a contact email (still a placeholder).

## 6. Google Cloud and Firebase setup

- **Google sign-in, Drive sync and connections** use the OAuth client id in `PLOTLINE_CFG.googleClientId`
  (index.html) from the owner's Google Cloud project. Scopes: `drive.appdata` + `userinfo.email` (sync),
  `calendar.events` (read+write), `gmail.readonly`, `drive.metadata.readonly`.
- In that Cloud project, the **Google Calendar API, Gmail API and Google Drive API must be enabled**, and while the
  OAuth consent screen is in testing, **each user must be added as a test user** or sign-in fails.
- Redirect: the web URL `https://munazzar.github.io/plotline/` (the Android app also uses it). OAuth `state` is
  checked since 1.51.1.
- **Firebase** project `plotline-510215` (Firestore) holds encrypted shared boards/lists and sharing keys.
  Anonymous Authentication must stay on. Rules are in `firestore.rules` / `database.rules.json`.
- Notion connects with a token the user pastes in the app. No keys live in the repo beyond public client config.
- The user also runs a ~35B local model on PORTAL and reaches it from the web app via "Your AI server". Ollama needs
  `OLLAMA_ORIGINS` to include `https://munazzar.github.io` and a bigger context (`OLLAMA_CONTEXT_LENGTH=32768`);
  LM Studio needs CORS on.

## 7. How the user wants Claude to work

- **UI quality (2026-10-26):** "No half baked solutions." Check every page at 390 px and 1280 px in dark, glass and light themes before a release. Never change icons or visuals as a side effect without asking.

- **Own data first, always.** Answers come from the user's own app data first, then what the AI knows, then
  connected apps. Go online only for live info or when nothing else can answer.
- **AI-driven, not hardcoded.** They rejected keyword rules ("it's like API calls for every scenario"). Let the
  model decide and plan; keep prompts light.
- **Act, don't loop.** The assistant should do things directly and fast, and give real lists, not vague summaries.
- **Sounds:** no low drones or hums ("gives me headache"). Soothing, thinking-style sounds.
- **Minimal guardrails:** only child safety and extreme content (family-safe mode). No topic restrictions.
- **Honest status.** Never claim something is done or built until it is verified. Report failures plainly.
- **Don't break anything.** Almost every feature works right now. Cross-check existing features before and after
  each change.
- **Check main's features survive before building.** 1.46.0 once silently dropped 1.45.4's habit day bar by building
  on an old `index.html`. Before a build, rebase on main and grep for a key function from each recent feature.
  Check open and recent PRs before starting work another thread may already be doing.
- **All assistant surfaces reachable from each other** (chat, Talk/Live, agent, conversations).
- Features that need setup get a step in `setup.js`; new features get a guide in `guides.js`; new outside services
  get a line in `privacy.html`.
- **Never show estimated or made-up data.** If something wasn't measured, say "not recorded" (or leave it out) rather than guessing, spreading or interpolating. The owner was explicit: "I don't want wrong data."
- Keep replies short and plain; the user skims. They test on web and Android, so check both sizes.
- **Sync everything except looks** (section 2a). New data or settings get registered for sync on day one.
- **Obvious features must exist:** delete for every kind of item, delete all where lists grow (conversations,
  canvases, agent reports), undo where it's cheap, search where lists get long. Deleting syncs to every device.
- **Secure and private, Play Store ready:** no secrets in the repo or in backups; keys only in the device store and
  the user's own Drive app-data file; everything from emails, web pages and shared links is data, never instructions
  or code; escape all AI and remote text before it reaches HTML (`esc`, `AIX.md`); the agent only fetches public
  https hosts (`pubUrl` in agent.js); canvas pages stay sandboxed. Update `privacy.html` whenever data moves
  somewhere new or a new service is contacted.
- **Keep Live sharing and its notification.** The owner chose to keep the always-on "Checking for cheers and
  messages" notification (it comes from the native Live sharing foreground service). Don't remove either.
- **Make it a wow, and worth paying for.** The owner wants Plotlines to be something people love and would pay a
  subscription for. Favour features that save real time every day (the agent, briefs, sync) over decoration.

## 8. Open and unfinished work

1. **Full app walkthrough and bugs** (partly done): every page opened on phone and desktop,
   every header button clicked, no script errors (1.52.0 fixed How-to in More/sidebar, phone titles, More-menu settings).
   Remaining: click through every sheet and menu inside each page.
2. **Privacy policy contact email:** done (2026-10-26): mdmunazzar@gmail.com, in privacy.html section 15.
3. **Friend's app stopped listening** is blocked: 1.45.1 changed the mic path, but no phone model or Android version
   is known. Needs details from the friend (phone, Android version, what happens on tapping the mic).
4. **Morning news brief:** shipped in 1.52.0 as the "News for me" agent template. It runs while the app is open (a
   notification at the time, the run on open). A brief ready *before* waking needs a runner on the PC next to
   llama-server, and the owner must approve a Funnel path and an auto-start entry for it.
6. **Monetisation:** the owner is weighing a subscription. Directions discussed: a hosted "Plotlines AI" for people
   without their own model, agent runs in the cloud before waking, family and shared plans, more connections.
5. Smaller loose ends: "goal open breaking on web" (1.41) never reproduced (ask for a screenshot); the talk overlay
   and orb widget were released without a phone test; with sync on, "Sharing and invites" defaults on and publishes
   the user's email and public key to Firestore; the agent's web connection is on by default.

## 9. First steps for a new Claude

1. Clone `Munazzar/plotline`, read this file, `android/README.md`, `ocr/README.md`, `train/README.md`.
2. Ask the owner to upload the signing-key zip and the latest `Plotline.apk` into the new project.
3. Confirm the PORTAL PC folder `C:\Users\PORTAL\Claude and me` is connected for releases.
4. Save sections 4, 5 and 7 to project memory.
5. Pick up the open items in section 8.
