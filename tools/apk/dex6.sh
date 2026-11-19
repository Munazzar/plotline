#!/bin/bash
# Build classes6.dex (Assist, BgAgent, StepHours, UsageHours, Blocker, Whisper, Supertonic) from android/src on the PORTAL PC.
#   tools/apk/dex6.sh <out dir>      -> <out dir>/classes.dex, to pass to build.cjs as classes6.dex=<out dir>/classes.dex
# The other dexes keep their compiled classes; stubs/ only gives javac their signatures (taken from the released smali).
set -e
A=${ANDROID_ROOT:-/c/Users/PORTAL/Android}; R="$(cd "$(dirname "$0")/../.." && pwd)"; O="$1"; W(){ cygpath -w "$1"; }
T="$O/tmp"; rm -rf "$T"; mkdir -p "$T/stub" "$T/out"
$A/jdk/bin/javac --release 8 -nowarn -Xlint:none -cp "$(W $A/sdk/platforms/android-34/android.jar)" -d "$(W $T/stub)" "$R"/tools/apk/stubs/com/munazzar/plotline/*.java "$R"/tools/apk/stubs/ai/onnxruntime/*.java
cd "$R/android/src/com/munazzar/plotline"
$A/jdk/bin/javac --release 8 -nowarn -Xlint:none -cp "$(W $A/sdk/platforms/android-34/android.jar);$(W $T/stub)" -d "$(W $T/out)" Assist.java BgAgent.java StepHours.java UsageHours.java Blocker.java Whisper.java Supertonic.java Speech.java
node "$R/tools/apk/strip-inner.cjs" "$(W $T/out)"
cd "$T/out" && $A/jdk/bin/jar cf "$(W $T/d6.jar)" com
$A/jdk/bin/java -cp "$(W $A/sdk/build-tools/34.0.0/lib/d8.jar)" com.android.tools.r8.D8 --release --min-api 29 --lib "$(W $A/sdk/platforms/android-34/android.jar)" --classpath "$(W $T/stub)" --output "$(W $O)" "$(W $T/d6.jar)"
rm -rf "$T"; ls -la "$O/classes.dex"
