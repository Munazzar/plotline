#!/usr/bin/env bash
# Journal book turn test: every turn style with real swipes and taps, recorded and checked frame by frame.
# Needs the app running with a book of 8+ pages (run.sh does the setup). Usage: book-test.sh [curl slide fade]
. "$(dirname "$0")/lib.sh"
STYLES="${*:-curl slide fade}"
PY="${PY:-/c/Users/PORTAL/AppData/Local/Programs/Python/Python312/python.exe}"
FAIL=0
bad() { log "BUG: $*"; echo "$*" >> "$OUT/book-bugs.txt"; FAIL=1; }

state() { js 'BOOK.state().i'; }
# Everything the page should agree on once a turn has settled, as one line.
check() {  # check <expected index> <label>
  if [ "$(js '!!document.querySelector(".tprompt")')" = true ]; then
    shot "bugs/$STYLE-tour-prompt-$N" >/dev/null; bad "$STYLE $2: the tour prompt is showing over the book"; dismiss; fi
  if [ "$(js '$("#sheet").classList.contains("on")')" = true ]; then   # a stray tap opened the writer
    shot "bugs/$STYLE-writer-opened-$N" >/dev/null; bad "$STYLE $2: the writer opened instead of a turn"; js 'closeSheet();1' >/dev/null; sleep 1.2; fi
  local r; r=$(js "(()=>{const s=BOOK.state(),B=document.querySelector('#bkBook'),R=document.querySelector('#bkR .bk-pc'),h=document.querySelector('#bkCount');
    const left=[...B.querySelectorAll('.bk-lay,.bk-view')].length,moved=[...B.querySelectorAll(':scope>.bk-pg,:scope>.bk-edge')].filter(e=>e.style.transform||e.style.opacity).length;
    const r=B.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const dn=R&&R.querySelector('.bk-dn'),hd=h?h.innerText.replace(/\s+/g,' '):'';
    const hdOk=R&&R.classList.contains('bk-cover')?/^Journal/.test(hd):!!(dn&&new RegExp('\\\\b'+dn.textContent+'\\\\b').test(hd.split(' ').slice(0,3).join(' ')));
    return [s.i,s.busy,left,moved,!!(top&&top.closest('#bkR')),hdOk,hd].join('|')})()" | tr -d '"')
  IFS='|' read -r i busy left moved ontop hdok hd <<<"$r"
  [ "$i" = "$1" ] || bad "$STYLE $2: on page index $i, expected $1"
  [ "$busy" = false ] || bad "$STYLE $2: still busy after settling"
  [ "$left" = 0 ] || bad "$STYLE $2: $left turn layer(s) left in the book"
  [ "$moved" = 0 ] || bad "$STYLE $2: $moved page(s) still moved/faded"
  [ "$ontop" = true ] || bad "$STYLE $2: something other than the page is on top in the middle of the book"
  [ "$hdok" = true ] || bad "$STYLE $2: header '$hd' does not match the page"
  # the settled screen against a clean reference of the same page
  local s; s=$(shot "set-$STYLE-$N"); N=$((N+1))
  if [ -z "$3" ] && [ -f "$OUT/ref-$i.png" ]; then
    local d; d=$("$PY" "$AT_DIR/frames.py" diff "$OUT/ref-$i.png" "$s" $BOX)
    awk "BEGIN{exit !($d > 4)}" && bad "$STYLE $2: settled screen differs from a clean page $i (diff $d) -> $s vs $OUT/ref-$i.png"
  fi
  log "$STYLE $2 -> page $i  [$hd]"
  CUR=$i
}

open_book() {
  js 'BOOK.close();location.hash="#/journal";1' >/dev/null; sleep 1.5
  tapel '[data-act=jvGo][data-v=book]' || return 1; sleep 1.2
}
set_style() {
  tapel '.bk-aa'; sleep 0.8
  tapel "#bkSet [data-k=turn][data-v=$1]"; sleep 0.3
  tapel "#bkSet [data-k=speed][data-v=normal]"; sleep 0.3
  tapel '#bkSet .bk-ixh [data-act=bkSet]'; sleep 0.8   # the panel covers the Aa button on a phone: close with its X
  [ "$(js 'S.settings.book.turn' | tr -d '"')" = "$1" ] || bad "Aa: turn style did not change to $1"
}
go() { js "ACT.bkGo({i:$1});1" >/dev/null; sleep 1; CUR=$1; }   # jump (Contents); used for references and resets only

# book geometry in device px
geom() {
  read -r BX BY BW BH HX HY HW HH <<<"$(js '(()=>{const d=devicePixelRatio,b=document.querySelector("#bkBook").getBoundingClientRect(),h=document.querySelector(".bk-top").getBoundingClientRect();return [b.x,b.y,b.width,b.height,h.x,h.y,h.width,h.height].map(v=>Math.round(v*d)).join(" ")})()' | tr -d '"')"
  BOX="$BX $BY $BW $BH"; HBOX="$HX $HY $HW $HH"
  YM=$((BY + BH * 6 / 10)); XR=$((BX + BW * 85 / 100)); XL=$((BX + BW * 12 / 100))
  TAPR=$((BX + BW * 94 / 100)); TAPL=$((BX + BW * 5 / 100)); YT=$((BY + BH * 45 / 100))
}

rm -f "$OUT/book-bugs.txt"
dismiss
open_book || exit 1
geom
NP=$(js 'BOOK.state().n'); log "book: $NP pages, area $BOX"
[ "$NP" -ge 8 ] || { log "need 8+ pages, have $NP"; exit 1; }
LAST=$((NP-1))

# clean references for every page (reached by Contents, no turn animation)
for k in $(seq 0 $LAST); do go $k; shot "ref-$k" >/dev/null; done

for STYLE in $STYLES; do
  N=0; log "=== $STYLE ==="
  dismiss; js '$("#sheet").classList.contains("on")&&closeSheet();1' >/dev/null; js 'BOOK.state().open||BOOK.open();1' >/dev/null; sleep 1
  set_style "$STYLE"; go 0; check 0 "start"
  rec_start "book-$STYLE"
  # each check expects a page relative to where the book really is, so one ignored swipe doesn't fail every later step
  c() { local e=$((CUR + $1)); [ $e -lt 0 ] && e=0; [ $e -gt $LAST ] && e=$LAST; echo $e; }
  for k in 1 2 3 4; do E=$(c 1); swipe $XR $YM $XL $YM 300; sleep 1.3; check $E "swipe forward #$k"; done
  for k in 1 2; do E=$(c -1); swipe $XL $YM $XR $YM 300; sleep 1.3; check $E "swipe back #$k"; done
  for k in 1 2 3; do E=$(c 1); tap $TAPR $YT; sleep 1.3; check $E "tap right edge #$k"; done
  E=$(c -1); tap $TAPL $YT; sleep 1.3; check $E "tap left edge"
  # three quick swipes, each one starting while the last turn is still running
  E=$(c 3); swipe $XR $YM $XL $YM 150; sleep 0.15; swipe $XR $YM $XL $YM 150; sleep 0.15; swipe $XR $YM $XL $YM 150; sleep 1.6
  check $E "3 quick swipes"
  # a short slow drag that should spring back
  E=$(c 0); swipe $XR $YM $((XR - BW / 8)) $YM 600; sleep 1.3; check $E "short drag (springs back)"
  # quick taps on the edge, faster than a turn
  E=$(c -2); tap $TAPL $YT; sleep 0.12; tap $TAPL $YT; sleep 1.6; check $E "2 quick left-edge taps"
  # a slow, long drag forward and one back
  E=$(c 1); swipe $XR $YM $XL $YM 1500; sleep 1.3; check $E "slow drag forward"
  E=$(c -1); swipe $XL $YM $XR $YM 1500; sleep 1.3; check $E "slow drag back"
  go $LAST; swipe $XR $YM $XL $YM 300; sleep 1.3; check $LAST "swipe past the last page"
  go 0; swipe $XL $YM $XR $YM 300; sleep 1.3; check 0 "swipe back on the cover"
  # a diagonal swipe should still turn (mostly sideways counts)
  E=$(c 1); swipe $XR $((YM - 60)) $XL $((YM + 120)) 300; sleep 1.3; check $E "diagonal swipe"
  # a vertical scroll must not turn the page
  E=$(c 0); swipe $((BX + BW / 2)) $((BY + BH * 7 / 10)) $((BX + BW / 2)) $((BY + BH * 3 / 10)) 300; sleep 1.3; check $E "vertical scroll (no turn)" noref
  # 10 ordinary swipes in a row: how many does the book take?
  go 0; MISS=0; for k in $(seq 1 10); do B4=$CUR; swipe $XR $YM $XL $YM 250; sleep 1.2; check $(c 1) "swipe run #$k" >/dev/null; [ "$CUR" = "$B4" ] && MISS=$((MISS+1)); done
  [ $MISS = 0 ] || bad "$STYLE: $MISS of 10 ordinary forward swipes were ignored"
  # a swipe that starts on the "Add to this day" button (it sits mid-page on short pages) should still turn
  K=$(js '(()=>{for(let k=1;k<BOOK.state().n-1;k++){ACT.bkGo({i:k});const b=document.querySelector("#bkR .bk-add"),r=b&&b.getBoundingClientRect(),B=document.querySelector("#bkBook").getBoundingClientRect();if(r&&r.top>B.top+B.height*.3&&r.bottom<B.bottom-40)return k}return -1})()')
  if [ "$K" -ge 0 ]; then go $K; read -r AY AR <<<"$(js '(()=>{const r=document.querySelector("#bkR .bk-add").getBoundingClientRect(),d=devicePixelRatio;return Math.round((r.top+r.height/2)*d)+" "+Math.round((r.right-6)*d)})()' | tr -d '"')"
    E=$(c 1); swipe $AR $AY $XL $AY 300; sleep 1.3; check $E "swipe starting on 'Add to this day'"; fi   # from its right end: a long enough drag
  V=$(rec_stop "book-$STYLE")
  log "analysing $V"
  BLANK_OK=1 "$PY" "$AT_DIR/frames.py" video "$V" "$OUT/frames-$STYLE" $BOX $HBOX | tee "$OUT/frames-$STYLE.txt" | tail -15 || FAIL=1
  grep -q '^\(blank\|flicker\|header\)' "$OUT/frames-$STYLE.txt" && bad "$STYLE: frame check flagged frames, see $OUT/frames-$STYLE.txt"
done
log "book test done, $( [ $FAIL = 0 ] && echo 'no bugs found' || echo "bugs in $OUT/book-bugs.txt")"
exit $FAIL
