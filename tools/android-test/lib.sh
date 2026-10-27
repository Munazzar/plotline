# Shared helpers for the Plotlines emulator tests. Source it from Git Bash: `. tools/android-test/lib.sh`
# Paths can be overridden with env vars.
AT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_ROOT="${ANDROID_ROOT:-/c/Users/PORTAL/Android}"
export JAVA_HOME="${JAVA_HOME:-$ANDROID_ROOT/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$(cygpath -w "$ANDROID_ROOT/sdk" 2>/dev/null || echo "$ANDROID_ROOT/sdk")}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
SDK="$ANDROID_ROOT/sdk"
ADB="$SDK/platform-tools/adb.exe"
EMU="$SDK/emulator/emulator.exe"
AVD="${AVD:-plotline34}"
PKG=com.munazzar.plotline
OUT="${OUT:-$AT_DIR/out}"
mkdir -p "$OUT"

adb() { MSYS_NO_PATHCONV=1 "$ADB" "$@"; }  # keep /sdcard paths as they are
log() { echo "[$(date +%H:%M:%S)] $*"; }

# Evaluate JS in the app's visible WebView; prints JSON.
js() { MSYS_NO_PATHCONV=1 node "$(cygpath -w "$AT_DIR/cdp.cjs")" "$1"; }  # no path rewriting: JS like /bag/i must reach node as is

q() { printf '%s' "$1" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8")))'; }  # shell string -> JS string literal
# Device pixels of an element's centre (scrolled into view first): `xy '.selector'` or `xy '.sel' 'Text it contains'` -> "x y"
xy() {
  js "(()=>{const t=$(q "${2:-}"),e=[...document.querySelectorAll($(q "$1"))].find(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(!t||e.innerText.includes(t))});
    if(!e)return '';e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),d=devicePixelRatio;
    return Math.round((r.x+r.width/2)*d)+' '+Math.round((r.y+r.height/2)*d)})()" | tr -d '"'
}
tap() { adb shell input tap "$1" "$2"; }
# Tap an element by selector (and optional text). Fails loudly if it isn't on screen.
tapel() { local p; p=$(xy "$1" "${2:-}"); [ -n "$p" ] || { log "NOT FOUND: $1 ${2:-}"; return 1; }; tap $p; }
swipe() { adb shell input swipe "$@"; }   # x1 y1 x2 y2 [ms]
shot() { adb exec-out screencap -p > "$OUT/$1.png"; echo "$OUT/$1.png"; }

# Screen recording: rec_start name; ...; rec_stop name  -> $OUT/name.mp4
rec_start() { adb shell rm -f "/sdcard/$1.mp4"; ( adb shell screenrecord --bit-rate 8000000 "/sdcard/$1.mp4" >/dev/null 2>&1 & ); sleep 1; }
rec_stop() { adb shell pkill -INT screenrecord; sleep 2; adb pull "/sdcard/$1.mp4" "$(cygpath -w "$OUT/$1.mp4")" >/dev/null && echo "$OUT/$1.mp4"; }

# Attach to the app's WebView DevTools socket on localhost:9222.
forward_devtools() {
  local s; s=$(adb shell cat /proc/net/unix | grep -ao 'webview_devtools_remote_[0-9]*' | tail -1)
  [ -n "$s" ] || { log "no WebView devtools socket: is the app running?"; return 1; }
  adb forward --remove tcp:9222 2>/dev/null; adb forward tcp:9222 "localabstract:$s" >/dev/null
}

boot() {
  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != 1 ]; then
    log "booting $AVD"; ( "$EMU" -avd "$AVD" -no-snapshot-save -no-boot-anim -gpu host >"$OUT/emulator.log" 2>&1 & )
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
  fi
  log "device ready: $(adb shell wm size | tr -d '\r')"
}

# Fresh install, grant every runtime permission, launch, skip Android's own permission screens.
install_app() {
  local apk="$1"
  adb uninstall "$PKG" >/dev/null 2>&1
  adb install -r "$(cygpath -w "$apk" 2>/dev/null || echo "$apk")" | tail -1
  for p in $(adb shell dumpsys package "$PKG" | grep -a 'granted=false' | sed 's/:.*//' | tr -d ' \r' | sort -u); do
    adb shell pm grant "$PKG" "$p" 2>/dev/null
  done
  launch
}
launch() {
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 6
  for i in 1 2 3 4 5; do
    adb shell dumpsys activity activities | grep -a topResumedActivity | grep -q "$PKG/.MainActivity" && break
    adb shell input keyevent BACK; sleep 1.5
  done
  forward_devtools
}

# Write a journal entry through the real writer: write_entry YYYY-MM-DD "Title" "Body text"
# Title and body are typed with the keyboard; the date field is a native picker, so it is set through the DOM.
write_entry() {
  js 'location.hash="#/journal";1' >/dev/null; sleep 1.5
  tapel '[data-act=addEntry]' || return 1; sleep 1.5
  js "(()=>{const d=\$('#wrDate');d.value='$1';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('change',{bubbles:true}));return d.value})()" >/dev/null
  tapel '#wrTitle'; sleep 0.4; adb shell input text "$(echo "$2" | sed 's/ /%s/g')"
  tapel '#wrEd'; sleep 0.6; adb shell input text "$(echo "$3" | sed 's/ /%s/g')"; sleep 0.4
  wr_done
}

# Press the writer's Done like a person: close the keyboard first (it hides the bottom Done), then tap a Done on screen.
kb_hide() { adb shell dumpsys input_method | grep -q 'mInputShown=true' && { adb shell input keyevent BACK; sleep 0.6; }; return 0; }
wr_done() { kb_hide; tapel '#sheet [data-act=wrDone]:not(.wr-done)'; sleep 1.2; }

# Close the first-run setup guide and the "Take a quick tour?" prompt if either is showing (they can pop up later,
# over the book or the writer). Taps their own buttons.
dismiss() {
  local i; for i in 1 2 3; do
    if [ "$(js '!!document.querySelector(".tprompt")')" = true ]; then tapel '.tprompt button' 'Not now'; sleep 0.8
    elif [ "$(js '!!(document.querySelector("#sheet.on [data-act=wzLater]"))')" = true ]; then tapel '#sheet [data-act=wzLater]'; sleep 0.8
    else return 0; fi
  done
}
