#!/usr/bin/env bash
# Full pre-release run on the emulator: boot, fresh install of the APK, onboard with the example data, write journal
# entries through the real writer (so the book has 8+ pages), then book-test.sh and smoke-test.sh.
# Usage (Git Bash, from the repo): tools/android-test/run.sh [path/to/Plotline.apk] [book styles...]
. "$(dirname "$0")/lib.sh"
APK="${1:-/c/Users/PORTAL/Claude and me/apk/$(ls "/c/Users/PORTAL/Claude and me/apk" | grep -E '^[0-9.]+$' | sort -V | tail -1)/Plotline.apk}"
shift 2>/dev/null
rm -rf "$OUT"; mkdir -p "$OUT/bugs"
boot
log "installing $APK"; install_app "$APK"
log "app $(js 'APP_VER'), WebView $(adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tr -d ' \r')"

# welcome sheet: a name, then "Explore with examples"
tapel 'input[name=name]'; sleep 0.5; adb shell input text Tester; kb_hide
tapel 'form button' 'Explore'; sleep 3
sleep 2; dismiss; js 'location.hash="#/journal";1' >/dev/null; sleep 2; dismiss
[ "$(js 'S.settings.onboarded')" = true ] || { log "onboarding failed"; shot onboarding-failed; exit 1; }

L="Rain all morning so I stayed in and sorted the bookshelf. Found old notebooks from school and read half of them. Called mum in the evening and we talked for an hour about the trip next spring. Made soup. Went to bed early."
d() { date -d "$1 days ago" +%F; }
write_entry "$(d 16)" "Bookshelf day" "$L"
write_entry "$(d 12)" "Long walk" "$L $L"
write_entry "$(d 5)" "Work sprint" "Shipped the thing. Tired but happy. $L"
write_entry "$(d 2)" "Saturday market" "Bought apples and bread. $L $L $L"
write_entry "$(d 0)" "Today" "Typed with real keys on the emulator."
log "journal: $(js 'S.entries.filter(e=>e.type==="note").length') written entries"

# writing from the book: "Add to this day", then back on the same page
js 'BOOK.open();ACT.bkGo({i:3});1' >/dev/null; sleep 1.5
D=$(js 'BOOK.state().i')
tapel '#bkR .bk-add' && sleep 1.5 && tapel '#wrEd' && sleep 0.5 && adb shell input text 'Added%sfrom%sthe%sbook.' && wr_done
[ "$(js 'BOOK.state().i')" = "$D" ] && [ "$(js '[...document.querySelectorAll("#bkR .bk-x")].some(e=>e.innerText.includes("Added from the book"))')" = true ] \
  && log "ok: write from the book, back on page $D" || { log "BUG: writing from the book"; echo "writing from the book did not come back to page $D" >> "$OUT/run-bugs.txt"; }
js 'BOOK.close();1' >/dev/null; sleep 1

bash "$AT_DIR/book-test.sh" "$@"; B=$?
bash "$AT_DIR/smoke-test.sh"; M=$?
log "=== done. book: $([ $B = 0 ] && echo pass || echo FAIL), smoke: $([ $M = 0 ] && echo pass || echo FAIL). Everything is in $OUT"
cat "$OUT"/run-bugs.txt "$OUT"/book-bugs.txt "$OUT"/smoke-bugs.txt 2>/dev/null
