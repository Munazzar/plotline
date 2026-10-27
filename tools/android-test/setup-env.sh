#!/usr/bin/env bash
# One-time: JDK 21 + Android SDK (cmdline-tools, platform-tools, emulator, API 34 x86_64 Google APIs image) and the
# plotline34 AVD (1080x2340, 420 dpi), all under $ANDROID_ROOT (default C:\Users\PORTAL\Android). No admin needed.
# About 2.2 GB to download, ~6 GB on disk. Needs Windows Hypervisor Platform (checked at the end).
set -e
. "$(dirname "$0")/lib.sh"
mkdir -p "$ANDROID_ROOT/dl"; cd "$ANDROID_ROOT/dl"
if [ ! -x "$ANDROID_ROOT/jdk/bin/java.exe" ]; then
  log "JDK 21 (~200 MB)"
  curl -sSL -o jdk.zip "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"
  unzip -q jdk.zip -d "$ANDROID_ROOT"; mv "$ANDROID_ROOT"/jdk-21* "$ANDROID_ROOT/jdk"
fi
SM="$SDK/cmdline-tools/latest/bin/sdkmanager.bat"
if [ ! -f "$SM" ]; then
  log "cmdline-tools (~150 MB)"
  curl -sSL -o clt.zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
  mkdir -p "$SDK/cmdline-tools"; unzip -q clt.zip -d "$SDK/cmdline-tools"; mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
fi
log "SDK packages (~1.9 GB the first time). Running this accepts the Android SDK licences."
yes | "$SM" --sdk_root="$ANDROID_HOME" --licenses >/dev/null
"$SM" --sdk_root="$ANDROID_HOME" platform-tools emulator "system-images;android-34;google_apis;x86_64" | tr '\r' '\n' | grep -v '^\s*\[' | tail -2
if [ ! -d "$HOME/.android/avd/$AVD.avd" ]; then
  echo no | "$SDK/cmdline-tools/latest/bin/avdmanager.bat" create avd -n "$AVD" -k "system-images;android-34;google_apis;x86_64" -d pixel_7 --force >/dev/null
  C="$HOME/.android/avd/$AVD.avd/config.ini"
  sed -i -e 's/^hw.lcd.width=.*/hw.lcd.width=1080/' -e 's/^hw.lcd.height=.*/hw.lcd.height=2340/' -e 's/^hw.lcd.density=.*/hw.lcd.density=420/' \
         -e 's/^hw.keyboard=.*/hw.keyboard=yes/' -e 's/^hw.gpu.enabled=.*/hw.gpu.enabled=yes/' -e 's/^hw.gpu.mode=.*/hw.gpu.mode=host/' "$C"
  grep -q '^hw.ramSize' "$C" && sed -i 's/^hw.ramSize=.*/hw.ramSize=4096/' "$C" || echo hw.ramSize=4096 >> "$C"
fi
"$EMU" -accel-check 2>&1 | tail -1
log "ready: AVD $AVD"
