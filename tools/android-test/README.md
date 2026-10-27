# Android emulator tests

Run a Plotlines APK on an Android 14 phone emulator (1080×2340, 420 dpi) on the PORTAL PC and check it before a release:
real taps, swipes and typing (`adb shell input`), a screen recording checked frame by frame, and the app's WebView
read over Chrome DevTools to see what is on screen. Nothing here changes app code.

## Run it

Use Git Bash, from the repo root:

```bash
tools/android-test/setup-env.sh
```

That's needed once. It downloads about 2.2 GB to `C:\Users\PORTAL\Android`: JDK 21, the SDK command-line tools, adb, the
emulator, the API 34 x86_64 image and the `plotline34` AVD. It also accepts the Android SDK licences. It doesn't need admin
rights, but it does need Windows Hypervisor Platform, and the last line says whether that's usable.

```bash
tools/android-test/run.sh
```

`run.sh` boots the emulator if it's not running and installs the newest `apk/<version>/Plotline.apk`, or pass a path. It
uninstalls first, so the app starts fresh. It then:

- onboards with "Explore with examples", writes five journal entries through the writer (11 book pages), and writes
  from the book;
- runs `book-test.sh` and `smoke-test.sh`.

It takes about 15 minutes. You can also run one part on a running app: `book-test.sh [curl slide fade]` or `smoke-test.sh`.

Results go to `tools/android-test/out/` (git-ignored):

| File | What |
|---|---|
| `book-bugs.txt`, `smoke-bugs.txt`, `run-bugs.txt` | One line per failed check. Empty or missing means it passed. |
| `book-<style>.mp4` | Screen recording of each turn style. |
| `frames-<style>.txt` + `frames-<style>/` | Flagged frames, saved as previous \| frame \| next. |
| `ref-<n>.png`, `set-<style>-<n>.png` | A clean shot of every page, and the screen after each gesture settled. |
| `bugs/` | Screenshots taken when a smoke check fails. |

## What the book test checks

The test runs each turn style (curl, slide, fade), chosen in Aa with real taps. In each style it does:

- 4 swipes forward and 2 back;
- 3 taps on the right edge and 1 on the left;
- 3 quick swipes, each one starting during the previous turn, and 2 quick edge taps;
- a short drag that should spring back, then slow drags forward and back;
- a swipe past the last page and one before the cover;
- a diagonal swipe, and a vertical scroll that must not turn;
- a swipe that starts on "Add to this day";
- 10 ordinary swipes in a row, counting how many were ignored.

After each gesture it checks:

- the page index is the one expected, counted from where the book really was, so one miss doesn't fail the rest;
- the header matches the page and nothing is still busy;
- no turn layer (`.bk-lay`, `.bk-view`) is left behind and no page is still moved or faded;
- the page is on top in the middle of the book;
- the settled screen matches a clean shot of that page (`frames.py diff`, mean difference under 4).

`frames.py video` flags a frame where the book area is one flat colour (**blank**). It also flags **flicker**: a frame
that differs from both neighbours while the neighbours match each other, in the book area or in the header.

## Smoke test

- **Bills:**
  - "From a picture" must open Android's picker.
  - `fixtures/receipt.png` is read by the app's own photo reader (on-device OCR).
  - In the review sheet: pick buttons for total, tax and an item price, the item count, and whether the Item/Qty/Price
    headings line up with their fields. Then it saves.
- **Notes:** a quick note by typing, then search. Book tab not clipped.
- **Readable cards:** tinted cards on Journal and Notes need at least 3:1 contrast.
- **Home agent reports:** a report is added to the agent inbox as test data. The card shows, "Do it" adds to today, and
  hide/show works.
- **Settings › Updates:** "Check for updates" answers. A faked newer release (only `fetch` in that page is patched)
  must offer Download, which isn't tapped.

**AI is turned off** for the smoke test page session (`planEngine=()=>""`, in memory). On a fresh install the app picks
"on-device AI" with no model downloaded, and the first AI call starts a 2.8 GB Gemma download.

## Pieces

- `lib.sh`: helpers.
  - `js` runs JS in the app over DevTools.
  - `xy`/`tapel` tap an element by CSS selector and text, after scrolling it to the middle.
  - `swipe`, `shot`, `rec_start`/`rec_stop`, `boot`, `install_app`, `launch`.
  - `write_entry`, `wr_done`, `kb_hide`.
- `cdp.cjs`: `node cdp.cjs "<js>"` or `@file.js`. It evaluates in the visible WebView and prints JSON.
- `picks-check.cjs`: `node tools/android-test/picks-check.cjs` checks bills.js `picks()` against the emulator's real OCR text of the receipt. No emulator needed.
- `frames.py`: frame and screenshot checks. Uses OpenCV and PyAV from
  `C:\Users\PORTAL\AppData\Local\Programs\Python\Python312` (set `PY` to use another).

## Notes

- The emulator's WebView is Chrome 113, older than most phones. A bug seen only here may be WebView-specific. Check
  `navigator.userAgent` in the log line.
- The Plotlines release APK has WebView debugging on, which is what makes `cdp.cjs` work. If a future build turns it
  off, only taps and screenshots are left.
- On a phone the open Aa panel covers its own Aa button. Close it with its ×.
- Git Bash rewrites `/sdcard/...` paths. `lib.sh` runs adb with `MSYS_NO_PATHCONV=1`.
