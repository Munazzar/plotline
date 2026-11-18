#!/bin/bash
# Blocks (1.71.0) on the emulator: real app launches with the block screen over them.
#   tools/android-test/blocks-test.sh [apk]     (fresh install unless SKIP_INSTALL=1)
# Checks: the page and its permission card, the app list with icons, focus over Chrome, Close and Back, a schedule
# with "type a sentence" (typed with the keyboard) that opens the app for 1 minute and blocks it again, a 1-minute
# daily limit counted from real use, a phone limit, never-blocked apps, a rule turned off, the service coming back
# from the 15-minute tick after it is stopped, the notification, and the log the page reads.
# Failures: out/blk-bugs.txt (one line each). Screens: out/blk-*.png.
set -u
. "$(dirname "$0")/lib.sh"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
BUGS="$OUT/blk-bugs.txt"; : > "$BUGS"
bug() { log "BUG: $*"; echo "$*" >> "$BUGS"; }
ok() { log "ok: $*"; }
J() { timeout 40 bash -c "$(declare -f js q); AT_DIR='$AT_DIR'; js \"\$1\"" _ "$1"; }
top() { adb shell dumpsys activity activities | grep -a topResumedActivity | grep -ao 'u0 [^ ]*' | head -1; }
shield() { adb shell dumpsys window windows | grep -a 'ty=APPLICATION_OVERLAY' | grep -ac 'adjust=resize'; }
open_app() { adb shell monkey -p "$1" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep "${2:-5}"; }
ui() { adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb shell cat /sdcard/u.xml; }
uitap() { local b; b=$(ui | grep -ao "text=\"$1\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" | grep -ao 'bounds="[^"]*"' | head -1 | grep -o '[0-9]*'); [ -n "$b" ] || return 1; set -- $b; tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 )); }
home() { adb shell input keyevent HOME; sleep 2; }
appjs() { open_app "$PKG" 4; forward_devtools >/dev/null 2>&1; J "$1"; }
CHROME=com.android.chrome; YT=com.google.android.youtube; CLOCK=com.google.android.deskclock; CAL=com.google.android.calendar; CONTACTS=com.google.android.contacts

APK="${1:-$(ls -d "$AT_DIR/../../../apk"/*/Plotline.apk | sort -V | tail -1)}"
if [ "${SKIP_INSTALL:-0}" != 1 ]; then log "installing $APK"; install_app "$APK"; sleep 3; fi
forward_devtools
J '(()=>{S.settings.name="Sam";S.settings.ins={...(S.settings.ins||{}),engine:"copy"};save();closeSheet();localStorage.removeItem("plotline.focus");return 1})()' >/dev/null

# 1. the page before access
adb shell appops set $PKG GET_USAGE_STATS default; adb shell appops set $PKG SYSTEM_ALERT_WINDOW default
J 'go("blocks"),1' >/dev/null; sleep 3
t=$(J 'document.querySelector("#view").innerText')
echo "$t" | grep -q "Two permissions" && ok "permission card shows" || bug "permission card missing: $(echo "$t" | head -c 200)"
echo "$t" | grep -q "Blocking runs in the Plotlines Android app" && bug "Android shows the web-only note"
shot blk-01-page >/dev/null
adb shell appops set $PKG GET_USAGE_STATS allow; adb shell appops set $PKG SYSTEM_ALERT_WINDOW allow; sleep 1
J 'render(false),1' >/dev/null; sleep 1.5
J 'document.querySelector("#view").innerText' | grep -q "Two permissions" && bug "permission card still there after access" || ok "permission card gone"
n=$(J 'JSON.parse(PlotlineAssist.blockApps()).filter(a=>a.i).length'); [ "${n:-0}" -ge 5 ] && ok "$n apps with icons" || bug "app list: $n with icons"

# 1b. Never blocked, with real taps: the section on the page, Add apps, tick Maps, Done
J '(()=>{BLOCKS.cfg().allow=[];save();render(false);return 1})()' >/dev/null; sleep 1.5
tapel '#blkAllow [data-act=blkPick]' && sleep 2
p=$(xy '.blk-pa' 'Maps'); [ -n "$p" ] && tap $p; sleep 1; tapel '[data-act=blkPickOk]'; sleep 2
J 'JSON.stringify(BLOCKS.cfg().allow)' | grep -q maps && ok "Never blocked: Maps added with real taps" || bug "Never blocked: Maps not added ($(J 'JSON.stringify(BLOCKS.cfg().allow)'))"
J 'document.querySelector("#blkAllow").innerText' | grep -q Maps && ok "Never blocked list shows Maps" || bug "Never blocked list doesn't show Maps"
shot blk-01b-allow >/dev/null
tapel '#blkAllow [data-act=blkAllowDel]'; sleep 1.5; J 'BLOCKS.cfg().allow.length' | grep -q "^0$" && ok "Never blocked: removed with ×" || bug "remove from Never blocked failed"
# 1c. its own place: Home card and Settings entry
J '(()=>{go("today");return 1})()' >/dev/null; sleep 3; J '!!document.querySelector(".hblk")' | grep -q true && ok "Home has a Blocks card" || bug "no Blocks card on Home"
shot blk-01c-home >/dev/null
J '(()=>{go("settings");return 1})()' >/dev/null; sleep 2.5; J '[...document.querySelectorAll(".shub-r b")].map(b=>b.textContent).join()' | grep -q Blocks && ok "Settings lists Blocks" || bug "Settings has no Blocks entry"
J '(()=>{go("blocks");return 1})()' >/dev/null; sleep 2

# 2. focus over Chrome: shown, Close goes home, Back goes home
J '(()=>{const c=BLOCKS.cfg();c.distract=["com.android.chrome","com.google.android.youtube"];c.rules=[];save();return !BLOCKS.startFocus({min:20,mode:"apps"}).err})()' | grep -q true || bug "focus didn't start"
sleep 2; open_app $CHROME
[ "$(shield)" = 1 ] && ok "focus blocks Chrome" || bug "focus: no block screen over Chrome"
shot blk-02-focus >/dev/null
ui | grep -q 'Focus until' || bug "block screen doesn't say why"
fr=$(adb shell dumpsys window windows | grep -a -A25 "adjust=resize" | grep -ao ' frame=\[[0-9,]*\]\[[0-9,]*\]' | head -1)
echo "$fr" | grep -qF "[0,0][1080,2340]" && ok "block screen covers the whole screen ($fr)" || bug "block screen not edge to edge: $fr"
uitap "Close Chrome" && sleep 2.5; top | grep -q launcher && ok "Close goes home" || bug "Close: top is $(top)"
[ "$(shield)" = 0 ] || bug "block screen still up after Close"
open_app $CHROME; adb shell input keyevent BACK; sleep 2.5
top | grep -q launcher && [ "$(shield)" = 0 ] && ok "Back closes it" || bug "Back: top $(top), shield $(shield)"
open_app $CLOCK; [ "$(shield)" = 0 ] && ok "apps outside focus open" || bug "Clock blocked during focus"; home

# 3. a schedule for every app with "type a sentence"; ending focus and adding it at once must keep the service going
J '(()=>{BLOCKS.endFocus(true);const c=BLOCKS.cfg(),d=new Date(),p=n=>String(n).padStart(2,"0"),a=new Date(d-120000),z=new Date(+d+3600000);c.rules.push({id:"ts",kind:"sched",on:true,name:"Test schedule",apps:[],all:true,allow:[],from:p(a.getHours())+":"+p(a.getMinutes()),to:p(z.getHours())+":"+p(z.getMinutes()),days:[],fr:"type",more:1});save();BLOCKS.push(true);return 1})()' >/dev/null
sleep 3; open_app $CLOCK
[ "$(shield)" = 1 ] && ok "schedule blocks Clock" || bug "schedule: no block screen over Clock"
shot blk-03-type >/dev/null
ui | grep -q 'I choose to use Clock now' || bug "type sentence not shown"
uitap "Type it here"; sleep 1; adb shell input text "i%schoose%sto%suse%sclock%snow"; sleep 1.5
shot blk-04-typed >/dev/null
uitap "Open for 1 minute"; sleep 2.5
[ "$(shield)" = 0 ] && top | grep -q deskclock && ok "typing the sentence opens Clock" || bug "type unlock: shield $(shield), top $(top)"
log "waiting 70 s for the minute to run out"; sleep 70
[ "$(shield)" = 1 ] && ok "blocked again after the extra minute" || bug "not blocked again after the extra minute"
home
g=$(J 'JSON.stringify(Object.keys(JSON.parse(PlotlineAssist.blockState()).grants))'); echo "$g" | grep -q ts && ok "grant recorded" || bug "grant not recorded: $g"

# 4. never block: Calendar in allow stays open under the schedule
J '(()=>{BLOCKS.cfg().allow=["com.google.android.calendar"];save();BLOCKS.push(true);return 1})()' >/dev/null; sleep 2
open_app $CAL; [ "$(shield)" = 0 ] && ok "never-blocked app opens" || bug "never-blocked Calendar was blocked"; home

# 5. turning the rule off unblocks right away
J '(()=>{BLOCKS.cfg().rules.forEach(r=>r.on=false);save();BLOCKS.push(true);return 1})()' >/dev/null; sleep 2
open_app $CLOCK; [ "$(shield)" = 0 ] && ok "rule off: Clock opens" || bug "rule off but Clock blocked"; home

# 6. a 1-minute limit on Contacts (not opened before), from real use; "5 more minutes once" then no second extension
J '(()=>{const c=BLOCKS.cfg();c.allow=[];c.rules=[{id:"tl",kind:"limit",on:true,name:"",apps:["com.google.android.contacts"],min:1,days:[],fr:"once",more:5}];save();BLOCKS.push(true);return 1})()' >/dev/null; sleep 2
open_app $CONTACTS 3; [ "$(shield)" = 0 ] || bug "limit blocked before any use"
log "using Contacts for 75 s"; sleep 75
[ "$(shield)" = 1 ] && ok "limit blocks after 1 minute of use" || bug "limit: not blocked after 75 s of use"
shot blk-05-limit >/dev/null
ui | grep -q 'more minutes (once today)' || bug "once button missing"
uitap "5 more minutes (once today)"; sleep 2.5; [ "$(shield)" = 0 ] && ok "once: 5 more minutes" || bug "once: still blocked"
J '(()=>{const g=JSON.parse(PlotlineAssist.blockState());return JSON.stringify({once:g.once,used:g.used["com.google.android.contacts"]})})()'
home

# 7. phone limit (1 minute over everything) blocks Chrome, not the phone app or Settings
J '(()=>{const c=BLOCKS.cfg();c.rules=[{id:"tt",kind:"total",on:true,name:"",apps:[],allow:[],min:1,days:[],fr:"hard",more:5}];save();BLOCKS.push(true);return 1})()' >/dev/null; sleep 3
open_app $CHROME; [ "$(shield)" = 1 ] && ok "phone limit blocks Chrome" || bug "phone limit: Chrome open"
ui | grep -q "can’t be skipped" || bug "hard block text missing"
shot blk-06-total >/dev/null
open_app com.android.settings; [ "$(shield)" = 0 ] && ok "Settings never blocked" || bug "Settings blocked"; home

# 8. stopped by Android: the 15-minute tick brings it back; the notification shows
adb shell am stopservice -n $PKG/.Blocker >/dev/null 2>&1; sleep 2
adb shell am broadcast -a com.munazzar.plotline.A_TICK -n $PKG/.Auto >/dev/null 2>&1; sleep 4
adb shell dumpsys activity services $PKG | grep -aq 'plotline/.Blocker' && ok "tick restarts the service" || bug "service not restarted by the tick"
adb shell dumpsys notification --noredact | grep -aq 'Plotlines blocks' && ok "notification shows" || bug "no Blocks notification"

# 9. the page with rules, and the log
appjs 'go("blocks"),1' >/dev/null; sleep 3
J 'JSON.stringify((s=>({b:s.log.filter(x=>x.k==="b").length,m:s.log.filter(x=>x.k==="m").length,c:s.log.filter(x=>x.k==="c").length}))(JSON.parse(PlotlineAssist.blockState())))'
J 'document.querySelector("#view").innerText' | grep -q "times blocked\|time blocked" && ok "Today section shows" || bug "Today section missing"
shot blk-07-page >/dev/null

# clean up: rules off so the service stops
J '(()=>{BLOCKS.cfg().rules=[];save();localStorage.removeItem("plotline.focus");BLOCKS.push(true);return 1})()' >/dev/null; sleep 3
adb shell dumpsys activity services $PKG | grep -aq 'plotline/.Blocker' && bug "service still running with no rules" || ok "service stops with no rules"
log "done: $(wc -l < "$BUGS") bug(s)"; cat "$BUGS"
