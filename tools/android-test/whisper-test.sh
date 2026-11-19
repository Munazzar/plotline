#!/usr/bin/env bash
# 1.74.0 checks on the emulator: Whisper listening. Needs the app running and onboarded, and a Whisper model on the
# emulator (Settings › AI & voice › Voice › Whisper Base, 161 MB: ask the owner before downloading, data cap).
# 1) a known recording (sherpa-onnx's test_wavs/0.wav, ~200 KB over https) is written down by PlotlineAssist.whisperFile;
# 2) the journal mic records with Whisper and closes cleanly on silence (the emulator's mic hears nothing).
. "$(dirname "$0")/lib.sh"
FAIL=0; bad() { log "BUG: $*"; FAIL=1; }; ok() { log "ok: $*"; }
dismiss
echo "$(js 'PlotlineAssist.whisperState()')" | grep -q '\\"use\\":\\"[a-z]' || { log "no Whisper model on the emulator"; exit 1; }
js 'window.__ev=[];window.__voice=(i,k,t)=>{if(k!=="level")__ev.push(k+": "+t)};PlotlineAssist.whisperFile("t1","https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/main/test_wavs/0.wav","en");1' >/dev/null
for i in $(seq 1 60); do R=$(js '__ev'); echo "$R" | grep -q 'final\|err' && break; sleep 5; done
log "heard: $R"
echo "$R" | grep -qi 'final: After early nightfall, the yellow lamps would light up here and there, the squalid quarter of the brothels' && ok "recording written down" || bad "transcript: $R"
js 'location.hash="#/journal";1' >/dev/null; sleep 2; dismiss
tapel '#view .ip .mic'; sleep 2
[ "$(js 'VC&&VC.wh')" = true ] && ok "journal mic listens with Whisper" || bad "journal mic didn't use Whisper"
sleep 14
[ "$(js '!VC&&!document.querySelector("#view .ip .mic.rec")')" = true ] && ok "mic closed on silence" || bad "mic still open"
log "done, $( [ $FAIL = 0 ] && echo 'no bugs' || echo bugs)"; exit $FAIL
