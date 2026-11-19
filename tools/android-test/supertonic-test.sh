#!/usr/bin/env bash
# 1.75.0 checks on the emulator: Supertonic voices and the Downloaded models list. Needs the app onboarded, Supertonic
# downloaded (Settings › AI & voice › Plot's voice, ~401 MB: ask the owner first, data cap) and a Whisper model (to check
# what was said). Supertonic writes a line into a WAV (PlotlineAssist.supertonicFile), Whisper writes it back down.
. "$(dirname "$0")/lib.sh"
FAIL=0; bad() { log "BUG: $*"; FAIL=1; }; ok() { log "ok: $*"; }
dismiss
say_check() { # text voice lang expect-regex
  js "(()=>{window.__stf=null;window.__stfile=r=>{__stf=r};PlotlineAssist.supertonicFile($(q "$1"),'$2','$3');return 1})()" >/dev/null
  local R=null; for i in $(seq 1 80); do R=$(js '__stf' 2>/dev/null); case "$R" in *"|"*|*err*) break;; esac; sleep 5; done
  log "made: $R"; local P; P=$(echo "$R" | tr -d '"' | cut -d'|' -f1)
  js "(()=>{window.__ev=[];window.__voice=(i,k,t)=>{if(k!=='level')__ev.push(k+': '+t)};PlotlineAssist.whisperFile('t','$P','$3');return 1})()" >/dev/null
  local E; for i in $(seq 1 40); do E=$(js '__ev' 2>/dev/null); echo "$E" | grep -q 'final\|err' && break; sleep 5; done
  log "heard: $E"; echo "$E" | grep -qiE "final: $4" && ok "$3 voice $2 says it" || bad "$3 voice $2: $E"
}
say_check "Good morning. You have three habits left for today, and your walk is at five." F1 en "good morning[.,]? you have three habits left for today,? and your walk is at five"
say_check "नमस्ते, आज का आपका प्लान तैयार है।" M1 hi "(نمس|नमस्ते).*(پلان|प्लान)"
js 'location.hash="#/settings/voice";1' >/dev/null; sleep 2
R=$(js '[...document.querySelectorAll("#dlPanel .dl-r")].map(r=>r.innerText.replace(/\n/g," | ")).join(" / ")')
log "downloaded: $R"; echo "$R" | grep -q "Supertonic voices" && ok "Supertonic is in Downloaded models" || bad "not listed: $R"
log "done, $( [ $FAIL = 0 ] && echo 'no bugs' || echo bugs)"; exit $FAIL
