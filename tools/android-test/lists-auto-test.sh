#!/usr/bin/env bash
# 1.72.0 checks on the emulator: a list from a photo (real on-device reader, keep the photo, update with a ticked line),
# and a habit with several automatic ways (the ⚡ sheet with phone types, the rules the phone gets).
# Needs the app running and onboarded. Failures go to $OUT/lists-auto-bugs.txt.
. "$(dirname "$0")/lib.sh"
FAIL=0
bad() { log "BUG: $*"; echo "$*" >> "$OUT/lists-auto-bugs.txt"; FAIL=1; }
ok() { log "ok: $*"; }
rm -f "$OUT/lists-auto-bugs.txt"
dismiss; js 'location.hash="#/lists";1' >/dev/null; sleep 2

# a photo of a list, made in the page, fed to the same action the 📷 chip runs
js '(async()=>{const c=document.createElement("canvas");c.width=900;c.height=1000;const x=c.getContext("2d");x.fillStyle="#fbf7ee";x.fillRect(0,0,900,1000);x.fillStyle="#1d2a44";x.font="bold 60px serif";x.fillText("Camping trip",80,130);x.font="52px serif";["- Tent","- Sleeping bags","- Flashlight","- Matches"].forEach((t,i)=>x.fillText(t,90,260+i*120));
 const b=await new Promise(r=>c.toBlob(r,"image/jpeg",.92));window.__f=new File([b],"l.jpg",{type:"image/jpeg"});if(!window.__s0){window.__s0=window.inkScan;window.inkScan=(T,f,m,o)=>__s0(T,window.__f,m,o)}ACT.lsPhoto({});return 1})()' >/dev/null
for i in $(seq 1 60); do [ "$(js '!!(document.querySelector(".ink-rv [data-k=ins]")&&!document.querySelector(".ink-rv [data-k=ins]").disabled)')" = true ] && break; sleep 1; done
shot la-review >/dev/null
R=$(js 'document.querySelector(".ink-rvt").innerText')
echo "$R" | grep -q "Sleeping bags" && ok "reader read the photo" || bad "reader text: $R"
tapel '.ink-rv .ink-keep i'; sleep 0.4
tapel '.ink-rv [data-k=ins]'; sleep 3
G=$(js '(()=>{const L=S.lists[0];return JSON.stringify({h:location.hash.startsWith("#/list/"+L.id),t:L.title,i:Object.values(L.items).sort((a,b)=>a.o-b.o).map(i=>i.t),p:(L.pics||[]).length})})()')
log "new list: $G"
echo "$G" | grep -q '\\"h\\":true' && ok "opened the new list" || bad "not on the new list: $G"
echo "$G" | grep -q 'Camping trip' && ok "heading became the name" || bad "name: $G"
echo "$G" | grep -q 'Tent\\",\\"Sleeping bags\\",\\"Flashlight\\",\\"Matches' && ok "items in written order" || bad "order: $G"
echo "$G" | grep -q '\\"p\\":1' && ok "photo kept" || bad "photo not kept: $G"
js 'document.querySelectorAll("#view .rv").forEach(e=>e.classList.add("in"));scrollTo(0,9999);1' >/dev/null; sleep 1; shot la-list >/dev/null

# update: Flashlight ticked, Batteries new after it
js '(async()=>{const c=document.createElement("canvas");c.width=900;c.height=800;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,900,800);x.fillStyle="#111";x.font="52px serif";["Tent","[x] Flashlight","Batteries","Matches"].forEach((t,i)=>x.fillText(t,80,130+i*130));
 const b=await new Promise(r=>c.toBlob(r,"image/jpeg",.92));window.__f=new File([b],"u.jpg",{type:"image/jpeg"});ACT.lsPhoto({id:S.lists[0].id});return 1})()' >/dev/null
for i in $(seq 1 60); do [ "$(js '!!(document.querySelector(".ink-rv [data-k=ins]")&&!document.querySelector(".ink-rv [data-k=ins]").disabled)')" = true ] && break; sleep 1; done
log "update read: $(js 'document.querySelector(".ink-rvt").innerText' | tr '\n' ' ')"
tapel '.ink-rv [data-k=ins]'; sleep 2.5
U=$(js 'JSON.stringify(Object.values(S.lists[0].items).filter(i=>!i.del).sort((a,b)=>a.o-b.o).map(i=>(i.done?"x ":"")+i.t))')
log "updated: $U"
echo "$U" | grep -q 'x Flashlight\\",\\"Batteries' && ok "update ticked and placed the new item" || bad "update: $U"
[ "$(js 'location.hash.startsWith("#/list/")')" = true ] && ok "stayed on the list" || bad "left the list: $(js 'location.hash')"

# several ways: steps, place, focus on one habit
js '(()=>{const h=S.habits.find(x=>/exercis/i.test(x.title))||S.habits[0];S.settings.places=[{id:"pgym",name:"Gym",emoji:"🏋️",lat:51.5,lng:-.12,r:120}];h.auto={type:"place",place:"pgym",mins:20,tell:true,or:[{type:"steps",n:10000,tell:true,wid:"w1"},{type:"workout",mins:20,kind:"any",tell:true,wid:"w2"}]};save();syncNative();ACT.autoEdit({k:"habit",id:h.id});return 1})()' >/dev/null; sleep 1.5
shot la-ways >/dev/null
W=$(js '[...document.querySelectorAll("#auBody .au-w small")].map(e=>e.textContent).join(" | ")')
log "ways: $W"
echo "$W" | grep -q "10,000 steps" && echo "$W" | grep -q "20 min workout" && echo "$W" | grep -q "Gym" && ok "sheet lists all three ways" || bad "ways sheet: $W"
K=$(js '(()=>{const h=S.habits.find(x=>/exercis/i.test(x.title))||S.habits[0];return autoRules().filter(r=>r.hid===h.id).map(r=>r.key.replace(h.id,"ID")+" "+r.type).join(", ")})()')
log "rules: $K"
echo "$K" | grep -q "h:ID place" && echo "$K" | grep -q "h:ID~w1 steps" && echo "$K" | grep -q "h:ID~w2 workout" && ok "phone gets one rule per way" || bad "rules: $K"
js 'document.querySelector("#auBody .au-w[data-i=\"1\"]").click();1' >/dev/null; sleep 1; shot la-way-edit >/dev/null
B=$(js '[...document.querySelectorAll("#auBody .actions button")].map(b=>b.textContent).join("|")' | tr -d "\"")
[ "$B" = "Remove this way|Save" ] && ok "editing one way: $B" || bad "edit buttons: $B"
js 'closeSheet();1' >/dev/null

# 1.73.0: sections, typing into a section with the keyboard, a note, start fresh (real taps where it matters)
js '(()=>{const P=LISTS_PHOTO;P.fromPhoto(null,P.photoLines("<p>Weekly shop</p><p>Produce:</p><ul><li>Apples</li></ul><p>Dairy:</p><ul><li>Milk</li><li>[x] Yogurt</li></ul>"),null);return 1})()' >/dev/null; sleep 2.5
SC=$(js 'JSON.stringify({t:S.lists[0].title,s:S.lists[0].secs.map(x=>x.t),h:[...document.querySelectorAll(".ls-sf b")].map(b=>b.textContent)})' | tr -d '\\')
echo "$SC" | grep -q '"s":\["Produce","Dairy"\],"h":\["Produce","Dairy"\]' && ok "photo headings became sections: $SC" || bad "sections: $SC"
tapel '.ls-sec:nth-of-type(2) [data-act=lsSecAdd]' || tapel '[data-act=lsSecAdd]' ; sleep 1
js 'document.querySelector(".ls-sadd [data-act=lsToClear]")?1:0' | grep -q 1 || bad "no add field in the section"
tapel '.ls-sadd input'; sleep 0.5; adb shell input text Cheese; adb shell input keyevent 66; sleep 1.2
CH=$(js '(()=>{const L=S.lists[0],i=Object.values(L.items).find(x=>x.t==="Cheese");return i?(L.secs.find(s=>s.id===i.s)||{t:"none"}).t:"missing"})()' | tr -d '"')
[ "$CH" != missing ] && [ "$CH" != none ] && ok "typed item went into section $CH" || bad "typed into section: $CH"
[ "$(js 'document.activeElement&&!!document.activeElement.closest(".ls-sadd")')" = true ] && ok "field stays ready for the next item" || bad "focus left the section field"
kb_hide; tapel '.ls-sadd [data-act=lsToClear]'; sleep 0.8
js '(()=>{const L=S.lists[0],m=Object.values(L.items).find(x=>x.t==="Milk");ACT.lsItemMenu({id:L.id,i:m.id});return 1})()' >/dev/null; sleep 1
tapel '#sheet [data-act=lsNote]'; sleep 1; adb shell input text "2%slitres"; kb_hide; tapel '#sheet form[data-form=lsNote] .btn.pri'; sleep 1
[ "$(js '(Object.values(S.lists[0].items).find(x=>x.t==="Milk")||{}).n||""' | tr -d '"')" = "2 litres" ] && ok "note saved" || bad "note: $(js '(Object.values(S.lists[0].items).find(x=>x.t==="Milk")||{}).n')"
js 'document.querySelectorAll("#view .rv").forEach(e=>e.classList.add("in"));scrollTo(0,0);1' >/dev/null; sleep 0.8; shot la-sections >/dev/null
js 'ACT.lsFresh({id:S.lists[0].id});1' >/dev/null; sleep 1; tapel '#sheet [data-act=lsRep][data-v=week]'; sleep 1
js '(()=>{const L=S.lists[0];L.rst="2026-01-05";render(false);return 1})()' >/dev/null; sleep 1.5
[ "$(js 'Object.values(S.lists[0].items).filter(i=>!i.del&&i.done).length')" = 0 ] && ok "a new week unticked everything" || bad "fresh start left items ticked"
shot la-fresh >/dev/null; js 'closeSheet();1' >/dev/null
log "done, $( [ $FAIL = 0 ] && echo 'no bugs' || echo "bugs in $OUT/lists-auto-bugs.txt")"
exit $FAIL
