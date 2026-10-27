#!/usr/bin/env bash
# Smoke test: Bills (photo read, pick-from-bill buttons, Item/Qty/Price headings, save), Notes (quick note, search),
# Home agent reports (card, Do it, hide/show), Settings › Updates (up to date, and a faked newer release).
# Needs the app running and onboarded (run.sh). Failures go to $OUT/smoke-bugs.txt.
. "$(dirname "$0")/lib.sh"
FAIL=0
bad() { log "BUG: $*"; echo "$*" >> "$OUT/smoke-bugs.txt"; FAIL=1; }
ok() { log "ok: $*"; }
eq() { [ "$(js "$1" | tr -d '"')" = "$2" ] && ok "$3" || bad "$3 (got $(js "$1"), expected $2)"; }
rm -f "$OUT/smoke-bugs.txt"
dismiss; js 'BOOK.state().open&&BOOK.close();1' >/dev/null; sleep 1
# A fresh install has no AI model, but the app still picks "on-device AI" and starts a 2.8 GB download on the first
# AI call. Turn AI off for this page session so nothing downloads (in memory only; relaunching the app undoes it).
js 'window.planEngine=()=>"";1' >/dev/null

log "=== Bills"
js 'location.hash="#/bills";1' >/dev/null; sleep 2; shot smoke-bills >/dev/null
# "From a picture" must open Android's picker (in 1.59.7 a second ACT.blPick replaced it)
js '(()=>{window.__fi=0;if(window.__fiHook)return 1;window.__fiHook=1;const c=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==="file")__fi++;return c.apply(this,arguments)};return 1})()' >/dev/null
tapel '[data-act=blPick]' 'From a picture'; sleep 2
if [ "$(js '__fi')" = 0 ]; then bad "Bills: 'From a picture' does not open the picker"; shot bugs/bills-from-picture >/dev/null
else ok "From a picture opens the picker"; adb shell input keyevent BACK; sleep 1; fi
# read the test receipt with the app's own photo reader (on-device OCR, no AI)
echo "(async()=>{const b=await (await fetch('data:image/png;base64,$(base64 -w0 "$AT_DIR/fixtures/receipt.png")')).blob();BILLS.fromPhoto(new File([b],'receipt.png',{type:'image/png'}));return 1})()" > "$OUT/fp.js"
node "$AT_DIR/cdp.cjs" @"$(cygpath -w "$OUT/fp.js")" >/dev/null
for i in $(seq 1 40); do sleep 2; [ "$(js '(document.querySelector("#sheet.on h2")||{}).innerText||""' | tr -d '"')" = "New bill" ] && break; done
eq '(document.querySelector("#sheet.on h2")||{}).innerText' "New bill" "receipt read into the review sheet"
eq 'document.querySelectorAll("#sheet [data-act=blPickF]").length>=4' true "pick buttons on total, subtotal, tax, tip"
tapel '[data-act=blPickF][data-f=total]'; sleep 0.8; tapel '#sheet [data-act=blPickV]' '24.22'; sleep 0.6
eq '$("#sheet [name=total]").value' 24.22 "pick the total"
tapel '[data-act=blPickF][data-f=tax]'; sleep 0.8; tapel '#sheet [data-act=blPickV]' '1.79'; sleep 0.6
eq '$("#sheet [name=tax]").value' 1.79 "pick the tax"
tapel '[data-act=blIAdd]'; sleep 0.6; tapel '#sheet .bl-ir:last-of-type [data-act=blPickF]'; sleep 0.8; tapel '#sheet [data-act=blPickV]' '3.40'; sleep 0.6
eq '$("#sheet .bl-ir:last-of-type [name=ip]").value' 3.4 "pick an item price"
N=$(js '$("#sheet .bl-ir:last-of-type [name=in]").value' | tr -d '"')
[[ "$N" =~ ^[0-9.\ ]+$ ]] && bad "Bills: picking an item price fills the item name with '$N' (a number from the bill line)"
eq '[...document.querySelectorAll("#sheet .field label")].some(l=>l.innerText.toLowerCase().includes("items · "+document.querySelectorAll("#sheet .bl-ir").length))' true "items count follows added rows"
# headings over the item row: each should start where its field starts (±6 px)
A=$(js '(()=>{const h=[...document.querySelectorAll("#sheet .bl-ih span")],r=document.querySelector("#sheet .bl-ir");const f=n=>r.querySelector("[name="+n+"]").getBoundingClientRect().left,H=t=>h.find(s=>s.innerText.trim().toLowerCase()===t).getBoundingClientRect().left;return ["item","qty","price"].map((t,k)=>t+":"+Math.round(H(t)-f(["in","iq","ip"][k]))).join(" ")})()' | tr -d '"')
echo "$A" | grep -qE ':(-?[7-9]|-?[1-9][0-9])' && { bad "Bills: Item/Qty/Price headings don't line up with their fields (offsets $A)"; shot bugs/bills-headings >/dev/null; } || ok "headings line up ($A)"
tapel '#sheet [name=m]'; sleep 0.4; adb shell input text 'Green%sLeaf%sGrocery'; kb_hide
tapel '#sheet button' 'Save bill'; sleep 2
eq 'location.hash.startsWith("#/bill/")' true "bill saved and opened"; shot smoke-bill-page >/dev/null

log "=== Notes"
js 'location.hash="#/notes";1' >/dev/null; sleep 2
eq '(()=>{const t=document.querySelector(".bk-tab"),p=t.parentElement.getBoundingClientRect(),r=t.getBoundingClientRect();return r.right<=p.right+1})()' true "Book tab fits on the Notes page"
tapel 'textarea[name=x]'; sleep 0.4; adb shell input text 'Buy%soat%smilk%sand%sbatteries'; kb_hide; tapel 'form[data-form=ntQuick] button[type=submit]'; sleep 1.5
eq 'document.body.innerText.includes("Buy oat milk")' true "quick note saved"
tapel 'input[placeholder*="Search every"]'; sleep 0.3; adb shell input text 'zzzqqq'; sleep 1.2
eq '[...document.querySelectorAll(".thr-jb, .tint")].filter(e=>e.getBoundingClientRect().height&&e.innerText.includes("oat")).length' 0 "search hides notes that don't match"
kb_hide; js 'location.hash="#/today";1' >/dev/null; sleep 1

log "=== Readable cards (dark text on a dark card)"
for page in journal notes; do
  js "location.hash='#/$page';1" >/dev/null; sleep 2
  js '(()=>{const i=document.querySelector("input[placeholder*=\"Search every\"]");if(i&&i.value){i.value="";i.dispatchEvent(new Event("input",{bubbles:true}))}return 1})()' >/dev/null; sleep 1   # clear the earlier search
  R=$(js '(()=>{const L=c=>{const m=c.match(/\d+(\.\d+)?/g).map(Number).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*m[0]+.7152*m[1]+.0722*m[2]};
    const bad=[...document.querySelectorAll(".tint")].filter(e=>e.getBoundingClientRect().height&&e.innerText.trim()).map(e=>{const s=getComputedStyle(e),a=L(s.color),b=L(s.backgroundColor);return [(Math.max(a,b)+.05)/(Math.min(a,b)+.05),e.innerText.trim().split("\n")[0].slice(0,30)]}).filter(x=>x[0]<3);
    return bad.length?bad.length+" cards, worst "+bad.sort((a,b)=>a[0]-b[0])[0][0].toFixed(2)+":1 ("+bad[0][1]+")":""})()' | tr -d '"')
  [ -n "$R" ] && { bad "$page: unreadable cards, contrast under 3:1: $R"; shot "bugs/$page-cards-contrast" >/dev/null; } || ok "$page cards readable"
done

log "=== Home agent reports"
js '(()=>{const A=S.settings.agent=Object.assign({},S.settings.agent||{});A.inbox=(A.inbox||[]).filter(i=>i.task!=="smoke");const id=()=>Math.random().toString(36).slice(2,12);
  A.inbox.unshift({id:id(),t:Date.now()-600e3,task:"smoke",title:"Plan my day",from:"",summary:"A light day. Finish the bookshelf, call mum, and prep tomorrow’s bag.",data:"",sugs:[{id:id(),type:"today",text:"Prep tomorrow’s bag",target:"",date:"",time:"",st:""}],tags:[],errs:[],seen:false});
  A.hmin=false;save();location.hash="#/journal";setTimeout(()=>location.hash="#/today",300);return 1})()' >/dev/null; sleep 2.5
eq '!!document.querySelector(".hagent")' true "Agent reports card on Home"
tapel '.hagent [data-act=agYes]'; sleep 1.2
eq 'S.days.some(d=>/bag/i.test(d.title)&&d.date===ymd())' true "Do it adds the suggestion to today"
tapel '.hagent [data-act=agHMin]'; sleep 0.8; eq 'S.settings.agent.hmin' true "hide the reports"
tapel '.hagent [data-act=agHMin]'; sleep 0.8; eq 'S.settings.agent.hmin' false "show the reports"

log "=== Settings › Updates"
js 'location.hash="#/settings";1' >/dev/null; sleep 1.5; tapel 'a[href="#/settings/updates"]'; sleep 1.5
tapel '[data-act=updCheck]'; for i in 1 2 3 4 5 6; do sleep 1.5; js '(document.getElementById("updMsg")||{}).innerText||""' | grep -q Checking || break; done
eq '/up to date|is ready/.test(document.getElementById("updMsg").innerText)' true "check for updates answers ($(js 'document.getElementById("updMsg").innerText' | head -c 60))"
js 'window.__f=window.fetch;window.fetch=(u,o)=>String(u).includes("releases/latest")?Promise.resolve(new Response(JSON.stringify({tag_name:"v9.9.9"}),{status:200})):__f(u,o);1' >/dev/null
tapel '[data-act=updCheck]'; sleep 1.5
eq '!!document.querySelector("#updMsg [data-act=updDl]")' true "a newer release offers Download"
js 'window.fetch=__f;try{localStorage.removeItem("plotline.upd")}catch(e){};1' >/dev/null

log "smoke test done, $( [ $FAIL = 0 ] && echo 'no bugs found' || echo "bugs in $OUT/smoke-bugs.txt")"
exit $FAIL
