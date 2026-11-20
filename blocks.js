/* ================= Blocks: app limits, focus, schedules, a phone limit (1.71.0) =================
   The page (#/blocks) makes and edits the rules; the Android app enforces them (android/.../Blocker.java): a
   foreground service watches which app is in front and covers a blocked one with a full-screen Plotlines screen.
   Rules live in S.settings.blk (they sync, so every phone of yours gets them; the web can edit them too):
     rules: [{id, kind:'limit'|'sched'|'total', on, name, apps:[pkg], all (sched: every app), allow:[pkg] (sched-all and
              total: apps that don't count), min (limit/total minutes a day), from/to ('22:00'), days:[0-6] (empty =
              every day), fr:'hard'|'once'|'wait'|'type' (how to get past it), more (extra minutes), u}]
     allow: [pkg never blocked], distract: [pkg focus blocks by default], fdef: {min, mode:'apps'|'all', lock, fr}
   A focus session is per phone (localStorage plotline.focus): {id, start, until, apps, all, allow, lock, fr, more,
   name}; finished and stopped sessions are kept (plotline.focusLog) so a "Focus" habit gets the minutes.
   Native bridge: PlotlineAssist.blockSet(json) -> state, blockState(), blockApps(), blockOpen('usage'|'overlay').
   window.BLOCKS.voice(text) handles "block Instagram for an hour", "focus for 25 minutes", "limit YouTube to 30
   minutes a day", "no TikTok from 10 pm to 7 am", "unblock Instagram", "stop focus", "what's blocked". */
(()=>{
'use strict';
const NA=!window.PLOT_DEMO&&window.PlotlineAssist||null;
const ON=()=>!!(NA&&NA.blockSet);
Object.assign(IC,{shield:'<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',hourglass:'<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3v2.5a4 4 0 0 0 1.6 3.2L12 10.5l2.4-1.8A4 4 0 0 0 16 5.5V3M8 21v-2.5a4 4 0 0 1 1.6-3.2L12 13.5l2.4 1.8a4 4 0 0 1 1.6 3.2V21"/>'});

/* ---------------- storage ---------------- */
const cfg=()=>{const s=S.settings.blk||(S.settings.blk={});s.rules=Array.isArray(s.rules)?s.rules:[];s.allow=s.allow||[];s.distract=s.distract||[];s.fdef={min:25,mode:'apps',lock:false,fr:'hard',...(s.fdef||{})};return s};
const LS=(k,v)=>{try{if(v===undefined){const x=localStorage.getItem(k);return x?JSON.parse(x):null}if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}};
const focusNow=()=>{const f=LS('plotline.focus');return f&&f.until>Date.now()?f:null};
const fLog=()=>LS('plotline.focusLog')||[];
const FR=[['hard','Can’t skip','Close the app is the only way'],['once','5 more minutes, once a day','One extension a day for this block'],['wait','Wait 20 seconds','A pause, then a few more minutes'],['type','Type a sentence','Write “I choose to use … now” to open it']];
const DAYS=['S','M','T','W','T','F','S'],DAYN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ---------------- the phone ---------------- */
/* the phone builds its app list in the background (1.77.1): the first time it answers with nothing yet, so the page
   draws letters for icons, asks again at most every 1.5 s (AAT), and redraws once the list arrives (appsWait) */
let APPS=null,ST={},AAT=0,AWT=0;
function appsWait(){if(AWT||!(NA&&NA.blockApps))return;let n=0;AWT=setInterval(()=>{AAT=0;const L=apps();if((L.length&&APPS)||++n>20){clearInterval(AWT);AWT=0;if(APPS&&APPS.length&&cur.p==='blocks')render(false)}},1500)}
function apps(){if(APPS)return APPS;
 if(NA&&NA.blockApps&&Date.now()-AAT<1500)return[];APPS=[];
 if(NA&&NA.blockApps){AAT=Date.now();try{APPS=JSON.parse(NA.blockApps()).map(a=>({pk:a.p,name:a.l,icon:a.i||'',cat:a.cat,sys:a.sys}))}catch(e){APPS=[]}if(!APPS.length){APPS=null;appsWait();return[]}}
 else if((typeof NATIVE!=="undefined"&&NATIVE)&&NATIVE.autoApps){try{APPS=JSON.parse(NATIVE.autoApps()).map(a=>({pk:a.pk,name:a.name,cat:a.cat}))}catch(e){APPS=[]}}
 /* no phone list (the web, or an older app): the apps Screen time has seen. Not kept, so a later list replaces it */
 if(!APPS.length){const L=(S.settings.act&&S.settings.act.scx&&S.settings.act.scx.lab)||{};const A=Object.keys(L).filter(k=>!k.startsWith('n:')).map(k=>({pk:k,name:L[k]}));APPS=null;return A}
 return APPS}
const appOf=pk=>apps().find(a=>a.pk===pk);
const lab=pk=>{const a=appOf(pk);if(a)return a.name;try{if(window.SCREEN)return SCREEN.lab(pk)}catch(e){}return pk.split('.').pop().replace(/^\w/,c=>c.toUpperCase())};
const icoHTML=(pk,cls='')=>{const a=appOf(pk);return a&&a.icon?`<img class="blk-ai ${cls}" src="data:image/png;base64,${a.icon}" alt="">`:`<span class="blk-ai blk-al ${cls}" aria-hidden="true">${esc((lab(pk)[0]||'?').toUpperCase())}</span>`};
/* today's minutes come from reading Android's usage history, slow on a full day: read at most every 10 s while the
   page is redrawn, and fresh whenever the app comes back to the front (a permission may have just been given) */
let STAT=0;addEventListener('visibilitychange',()=>{STAT=0});
function state(force){if(!ON())return ST={};if(!force&&Date.now()-STAT<10000)return ST;try{ST=JSON.parse(NA.blockState())||{}}catch(e){ST={}}STAT=Date.now();return ST}
let PUSHED='';
/* a locked focus can't be loosened: no new Never blocked apps until it ends (1.77.0). The phone checks Never blocked
   first, so while it runs the phone only gets the apps that were on the list when it started, even if another device
   or an older copy adds some. */
const lockedNow=()=>{const f=LS('plotline.focus');return!!(f&&f.lock&&f.until>Date.now())};
function push(force){if(!ON())return;const c=cfg(),f=LS('plotline.focus');
 const o={rules:c.rules.map(r=>({...r,apps:r.apps||[],days:r.days||[]})),focus:f&&f.until>Date.now()?f:null,allow:lockedNow()?c.allow.filter(p=>(f.allow||[]).includes(p)):c.allow};
 const k=JSON.stringify(o);if(!force&&k===PUSHED)return;PUSHED=k;try{ST=JSON.parse(NA.blockSet(k))||{}}catch(e){}}
const usedMin=pk=>+((ST.used||{})[pk])||0;
const usedOf=list=>(list||[]).reduce((a,pk)=>a+usedMin(pk),0);
const usedAll=r=>{const skip=new Set([...(r.allow||[]),...cfg().allow]);return Object.entries(ST.used||{}).reduce((a,[k,v])=>skip.has(k)?a:a+v,0)};
const mm=m=>fmtMin(Math.round(m));

/* ---------------- describing a rule ---------------- */
const hm=s=>{const[h,m]=String(s||'0:0').split(':').map(Number);return h*60+(m||0)};
const t12=s=>{const v=hm(s),d=new Date();d.setHours(Math.floor(v/60),v%60,0,0);return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
const daysTxt=d=>{d=(d||[]).slice().sort();if(!d.length||d.length===7)return'every day';if(d.join()==='1,2,3,4,5')return'weekdays';if(d.join()==='0,6')return'weekends';return d.map(i=>DAYN[i].slice(0,3)).join(', ')};
const dayOn=(r,d)=>!(r.days||[]).length||(r.days||[]).includes(d);
function inWin(r,t=new Date()){const a=hm(r.from),b=hm(r.to),m=t.getHours()*60+t.getMinutes(),d=t.getDay();if(a===b)return false;return a<b?m>=a&&m<b&&dayOn(r,d):(m>=a&&dayOn(r,d))||(m<b&&dayOn(r,(d+6)%7))}
const appsTxt=(L,max=3)=>{L=L||[];if(!L.length)return'No apps yet';const n=L.slice(0,max).map(lab);return L.length>max?`${n.join(', ')} +${L.length-max}`:n.length>1?`${n.slice(0,-1).join(', ')} and ${n[n.length-1]}`:n[0]};
/* said out loud: "45 minutes", "1 hour 30 minutes" */
const say=m=>{m=Math.round(m);const h=Math.floor(m/60),r=m%60,H=h?`${h} hour${h===1?'':'s'}`:'',M=r?`${r} minute${r===1?'':'s'}`:'';return[H,M].filter(Boolean).join(' ')||'0 minutes'};
function title(r){if(r.name)return r.name;if(r.kind==='total')return'Phone limit';if(r.kind==='sched'&&r.all)return'All apps';return appsTxt(r.apps)}
const granted=r=>((ST.grants||{})[r.id]||0)>Date.now();
/* the line under a rule, and whether it's blocking now */
function status(r){const td=new Date().getDay();
 if(r.kind==='limit'){const u=usedOf(r.apps),over=u>=r.min;return{sub:`${mm(r.min)} a day${(r.days||[]).length?' · '+daysTxt(r.days):''}${ON()?` · ${mm(u)} used today`:''}`,p:Math.min(1,u/Math.max(1,r.min)),now:r.on&&over&&dayOn(r,td)&&!granted(r)}}
 if(r.kind==='total'){const u=usedAll(r),over=u>=r.min;return{sub:`${mm(r.min)} on your phone a day${ON()?` · ${mm(u)} used today`:''}`,p:Math.min(1,u/Math.max(1,r.min)),now:r.on&&over&&dayOn(r,td)&&!granted(r)}}
 const w=inWin(r);return{sub:`${t12(r.from)} – ${t12(r.to)} · ${daysTxt(r.days)}${r.all?'':' · '+appsTxt(r.apps,2)}`,now:r.on&&w&&!granted(r)}}
const frTxt=r=>(FR.find(x=>x[0]===(r.fr||'hard'))||FR[0])[1];

/* ---------------- focus ---------------- */
function startFocus(o){const c=cfg(),now=Date.now(),min=Math.max(1,Math.min(720,+o.min||25));
 const f={id:'focus',start:now,until:o.until&&o.until>now?o.until:now+min*60000,all:o.mode==='all',apps:o.mode==='all'?[]:(o.apps||c.distract),allow:c.allow,lock:!!o.lock,fr:o.lock?'hard':(o.fr||'hard'),more:5,name:o.name||''};
 if(!f.all&&!f.apps.length)return{err:'Pick the apps focus should block first.'};
 LS('plotline.focus',f);push(true);tickStart();return{f}}
function endFocus(early){const f=LS('plotline.focus');if(!f)return;const end=Math.min(Date.now(),f.until);
 const L=fLog();L.push({start:f.start,end,until:f.until,stopped:!!early});LS('plotline.focusLog',L.slice(-120));LS('plotline.focus',null);push(true);credit()}
/* a session that ran out while the app was closed */
function settle(){const f=LS('plotline.focus');if(f&&f.until<=Date.now())endFocus(false)}
function addFocus(min){const f=LS('plotline.focus');if(!f)return;f.until=Math.max(f.until,Date.now())+min*60000;LS('plotline.focus',f);push(true)}
/* focus minutes per day, from finished and stopped sessions (a session counts on the day it started) */
function focusByDay(){const o={};fLog().forEach(s=>{const m=Math.max(0,(s.end-s.start)/60000);if(m<1)return;const d=ymd(new Date(s.start));o[d]=(o[d]||0)+m});return o}
/* "Focus" habits (h.focus) get the day's focus minutes as their value */
function credit(){const by=focusByDay();let ch=false;S.habits.forEach(h=>{if(!h.focus||h.status!=='active')return;for(const[d,m]of Object.entries(by)){const v=Math.floor(m);if((+h.log[d]||0)<v){hSetVal(h,d,v);ch=true}}});if(ch){save();try{syncNative()}catch(e){}}}
function focusHabit(){const t='Focus time';const ex=S.habits.find(h=>h.focus&&h.status==='active');if(ex)return toast(`You already have “${esc(ex.title)}”`);
 const h=normHabit({id:uid(),kind:'build',title:t,icon:'🎯',area:'personal',why:'Time without distractions',startDate:ymd(),target:60,unit:'minutes',focus:true,u:Date.now()});S.habits.push(h);save();credit();try{syncNative()}catch(e){}
 toast(`Added “${t}”: 60 focus minutes a day fill it in by themselves`)}

/* ---------------- the page ---------------- */
let TICK=0;
function tickStart(){clearInterval(TICK);TICK=setInterval(()=>{if(cur.p!=='blocks'){clearInterval(TICK);TICK=0;return}const f=LS('plotline.focus');if(f&&f.until<=Date.now()){endFocus(false);render(false);return}const el=$('#blkClock');if(el&&f)el.textContent=clock(f.until-Date.now())},1000)}
const clock=ms=>{const s=Math.max(0,Math.round(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};
function vBlocks(){settle();push(false);state();credit();const c=cfg(),f=focusNow(),R=c.rules;
 const live=R.filter(r=>status(r).now);
 const sub=f?`Focus until ${new Date(f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`:live.length?`${live.length} blocking now`:R.filter(r=>r.on).length?`${R.filter(r=>r.on).length} on · nothing blocked right now`:'Limits, focus and schedules';
 const head=`<header class="ph"><div><h1>Blocks</h1><div class="data">${esc(sub)}</div></div><div class="ph-r"><button class="ibtn" data-act="blkSet" aria-label="Blocks settings" title="Never blocked, focus apps">${ic('tune')}</button>${typeof gear==='function'?gear():''}</div></header>`;
 return head+needHTML()+focusHTML(f)+rulesHTML(R)+allowHTML()+todayHTML()+`<p class="small muted rv me-priv">${ic('lock','ico-s')} Blocks run on your phone from Android’s own usage data. Nothing about the apps you use leaves the phone, except your rules, which sync with your Plotlines data.</p>`}
function needHTML(){if(!(typeof NATIVE!=="undefined"&&NATIVE))return`<div class="panel rv blk-need"><p class="small">Blocking runs in the Plotlines Android app. Rules you make here sync to your phone and work there.</p></div>`;
 if(!ON())return`<div class="panel rv blk-need"><p class="small">Update the Plotlines app to use Blocks.</p></div>`;
 if(ST.usage&&ST.overlay)return'';
 const row=(ok,t,x,k)=>`<li class="${ok?'ok':''}"><span class="blk-n">${ok?ic('check'):k==='usage'?'1':'2'}</span><div><b>${t}</b><small>${x}</small></div>${ok?'':`<button class="btn sm pri" data-act="blkPerm" data-k="${k}">Allow</button>`}</li>`;
 return`<section class="panel rv blk-need"><h3>Two permissions, once</h3><p class="small muted">Android needs both before Plotlines can block anything.</p><ul class="blk-steps">${row(ST.usage,'Usage access','To see which app is open and count its minutes. The same data Digital Wellbeing uses.','usage')}${row(ST.overlay,'Display over other apps','To cover a blocked app with the Plotlines block screen.','overlay')}</ul></section>`}
function focusHTML(f){const c=cfg(),d=c.fdef;
 if(f){const left=f.until-Date.now(),tot=f.until-f.start,p=Math.max(0,Math.min(1,1-left/tot));
  return`<section class="panel rv blk-focus on"><div class="blk-fh"><span class="blk-fi">${ic('hourglass')}</span><div><b>${esc(f.name||'Focus')}</b><small>${f.all?'Everything except your never-blocked apps':esc(appsTxt(f.apps,4))}${f.lock?' · locked':''}</small></div></div>
  <div class="blk-clock"><b id="blkClock">${clock(left)}</b><small>until ${new Date(f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</small></div><div class="blk-bar"><i style="width:${Math.round(p*100)}%"></i></div>
  <div class="actions left wrap"><button class="btn sm" data-act="blkMore" data-v="15">+15 min</button><button class="btn sm" data-act="blkMore" data-v="30">+30 min</button>${f.lock?`<span class="small muted blk-lk">${ic('lock','ico-s')} Locked until it ends</span>`:`<button class="btn sm ghost" data-act="blkStop">Stop focus</button>`}</div></section>`}
 const n=c.distract.length;
 return`<section class="panel rv blk-focus"><div class="blk-fh"><span class="blk-fi">${ic('hourglass')}</span><div><b>Focus</b><small>Block distracting apps for a while.</small></div></div>
 <div class="field"><label>For</label><div class="chips">${[[25,'25 min'],[45,'45 min'],[60,'1 hour'],[120,'2 hours'],[240,'4 hours']].map(([v,t])=>`<button class="chip${d.min===v?' on':''}" data-act="blkFdef" data-f="min" data-v="${v}">${t}</button>`).join('')}<label class="blk-num"><input type="number" min="1" max="720" inputmode="numeric" data-blkf="min" value="${d.min}" aria-label="Minutes"><span>min</span></label></div></div>
 <div class="field"><label>Block</label><div class="seg blk-seg" role="radiogroup">${[['apps','My distracting apps'],['all','Everything']].map(([k,t])=>`<button role="radio" aria-checked="${d.mode===k}" class="${d.mode===k?'on':''}" data-act="blkFdef" data-f="mode" data-v="${k}">${t}</button>`).join('')}</div>
 ${d.mode==='all'?`<small class="muted">Everything except calls, Settings and your never-blocked apps${c.allow.length?` (${esc(appsTxt(c.allow,3))})`:''}. <button class="link small" data-act="blkPick" data-for="allow">${c.allow.length?'Change':'Add apps'}</button></small>`:`<div class="blk-apps">${n?c.distract.slice(0,8).map(pk=>icoHTML(pk)).join('')+(n>8?`<span class="blk-more">+${n-8}</span>`:''):'<span class="small muted">None picked yet</span>'}<button class="btn sm" data-act="blkPick" data-for="distract">${n?'Change':'Choose apps'}</button></div>`}</div>
 <label class="sw"><span>Lock it<small>No stopping early and no extra minutes until it ends</small></span><input type="checkbox" data-blkf="lock" ${d.lock?'checked':''}><i></i></label>
 <div class="actions left"><button class="btn pri" data-act="blkStart" ${d.mode==='apps'&&!n?'disabled':''}>Start focus</button></div></section>`}
function rulesHTML(R){
 const add=`<div class="blk-add"><button class="blk-ab" data-act="blkNew" data-k="limit"><span>${ic('hourglass')}</span><b>App limit</b><small>Minutes a day in chosen apps</small></button><button class="blk-ab" data-act="blkNew" data-k="sched"><span>${ic('cal')}</span><b>Schedule</b><small>Blocked at set times, like bedtime</small></button><button class="blk-ab" data-act="blkNew" data-k="total"><span>${ic('scr')}</span><b>Phone limit</b><small>Total time on your phone a day</small></button></div>`;
 if(!R.length)return`<section class="rv"><div class="st-h"><h3>Your blocks</h3></div><p class="small muted" style="margin:0 2px 10px">Make your first one:</p>${add}</section>`;
 return`<section class="rv"><div class="st-h"><h3>Your blocks</h3><span class="small muted">${R.filter(r=>r.on).length} of ${R.length} on</span></div><div class="panel blk-list">${R.map(r=>{const s=status(r),ic2=r.kind==='total'?`<span class="blk-ai blk-al">${ic('scr')}</span>`:r.kind==='sched'&&r.all?`<span class="blk-ai blk-al">${ic('cal')}</span>`:`<span class="blk-stack">${(r.apps||[]).slice(0,3).map(pk=>icoHTML(pk)).join('')||`<span class="blk-ai blk-al">?</span>`}</span>`;
  return`<div class="blk-r${r.on?'':' off'}${s.now?' now':''}"><button class="blk-rb" data-act="blkEdit" data-id="${r.id}">${ic2}<span class="blk-rt"><b>${esc(title(r))}${s.now?' <em>blocking now</em>':granted(r)?' <em class="g">extra time</em>':''}</b><small>${esc(s.sub)}</small>${s.p!=null&&ON()?`<i class="blk-pb"><i style="width:${Math.round(s.p*100)}%"></i></i>`:''}<small class="blk-fr">${esc(frTxt(r))}</small></span></button><label class="blk-tg" aria-label="${r.on?'Turn off':'Turn on'} ${esc(title(r))}"><input type="checkbox" data-blkon="${r.id}" ${r.on?'checked':''}><i></i></label></div>`}).join('')}</div>
 <p class="small muted" style="margin:12px 2px 8px">Add another</p>${add}</section>`}
/* apps that always open, whatever blocks are on: right on the page, add and remove here */
function allowHTML(){const c=cfg();
 return`<section class="rv" id="blkAllow"><div class="st-h"><h3>Never blocked</h3><button class="link" data-act="blkPick" data-for="allow">${c.allow.length?'Change':'Add apps'}</button></div><div class="panel blk-allow">${c.allow.length?`<div class="blk-chips">${c.allow.map(pk=>`<span class="blk-chip">${icoHTML(pk,'sm')}<b>${esc(lab(pk))}</b><button class="blk-x" data-act="blkAllowDel" data-k="${esc(pk)}" aria-label="Let blocks cover ${esc(lab(pk))} again">${ic('plus','x45')}</button></span>`).join('')}<button class="blk-chip add" data-act="blkPick" data-for="allow">${ic('plus')}<b>Add</b></button></div>`:`<button class="blk-empty" data-act="blkPick" data-for="allow"><span class="blk-fi">${ic('plus')}</span><span><b>Add apps that should always open</b><small>Maps, banking, your authenticator, work chat</small></span></button>`}<p class="small muted blk-an">Calls, Settings, the home screen and Plotlines are always open too.</p></div></section>`}
function todayHTML(){if(!ON())return'';const L=(ST.log||[]).filter(x=>ymd(new Date(x.t))===ymd()),b=L.filter(x=>x.k==='b'),m=L.filter(x=>x.k==='m'),fm=Math.round((focusByDay()[ymd()]||0)+(()=>{const f=focusNow();return f?(Date.now()-f.start)/60000:0})());
 if(!b.length&&!m.length&&!fm)return'';const nm=id=>id==='focus'?'focus':(()=>{const r=cfg().rules.find(x=>x.id===id);return r?title(r):'a block'})();
 const ev=[...L].filter(x=>x.k==='b'||x.k==='m').reverse().slice(0,8);
 return`<section class="rv"><div class="st-h"><h3>Today</h3></div><div class="sc-stats blk-st"><div><b>${b.length}</b><small>time${b.length===1?'':'s'} blocked</small></div><div><b>${m.length}</b><small>extra time</small></div><div><b>${fm?mm(fm):'—'}</b><small>focus</small></div></div>
 ${ev.length?`<div class="panel blk-ev">${ev.map(x=>`<div><span>${new Date(x.t).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>${icoHTML(x.p,'sm')}<b>${esc(lab(x.p))}</b><small>${x.k==='b'?'blocked by '+esc(nm(x.r)):`${x.n||5} more minutes · ${esc(nm(x.r))}`}</small></div>`).join('')}</div>`:''}</section>`}

/* ---------------- the editor ---------------- */
let ED=null;
const blank=k=>({id:'b'+uid(),kind:k,on:true,name:'',apps:[],all:false,allow:[],min:k==='total'?180:30,from:'22:00',to:'07:00',days:[],fr:cfg().fdef.efr||'once',more:5});
function edHTML(){const r=ED.r,k=r.kind,isNew=!cfg().rules.some(x=>x.id===r.id);
 const kindT={limit:'App limit',sched:'Schedule',total:'Phone limit'}[k];
 let b=`<div class="data">${kindT}</div><h2 style="margin-top:6px">${isNew?'New '+kindT.toLowerCase():esc(title(r))}</h2>`;
 if(k!=='total'){const all=k==='sched'&&r.all;
  b+=`<div class="field"><label>Apps</label>${k==='sched'?`<div class="seg blk-seg" role="radiogroup">${[[0,'Chosen apps'],[1,'Every app']].map(([v,t])=>`<button role="radio" aria-checked="${!!r.all===!!v}" class="${!!r.all===!!v?'on':''}" data-act="blkEd" data-f="all" data-v="${v}">${t}</button>`).join('')}</div>`:''}
  ${all?exceptHTML(r):`<div class="blk-apps">${r.apps.length?r.apps.slice(0,10).map(pk=>icoHTML(pk)).join('')+(r.apps.length>10?`<span class="blk-more">+${r.apps.length-10}</span>`:''):'<span class="small muted">None picked yet</span>'}<button class="btn sm" data-act="blkPick" data-for="ed">${r.apps.length?'Change':'Choose apps'}</button></div>${r.apps.length?`<small class="muted">${esc(appsTxt(r.apps,6))}${k==='limit'&&r.apps.length>1?' · they share one daily limit':''}</small>`:''}`}</div>`}
 if(k==='limit'||k==='total'){const opts=k==='limit'?[[15,'15 min'],[30,'30 min'],[45,'45 min'],[60,'1 h'],[90,'1½ h'],[120,'2 h']]:[[60,'1 h'],[120,'2 h'],[180,'3 h'],[240,'4 h'],[300,'5 h']];
  b+=`<div class="field"><label>${k==='limit'?'A day':'Phone time a day'}</label><div class="chips">${opts.map(([v,t])=>`<button class="chip${r.min===v?' on':''}" data-act="blkEd" data-f="min" data-v="${v}">${t}</button>`).join('')}<label class="blk-num"><input type="number" min="1" max="1440" inputmode="numeric" data-blke="min" value="${r.min}" aria-label="Minutes a day"><span>min</span></label></div></div>${k==='total'?`<div class="field"><label>Except</label>${exceptHTML(r)}</div>`:''}`}
 if(k==='sched')b+=`<div class="field"><label>When</label><div class="chips">${[['22:00','07:00','Bedtime'],['09:00','17:00','Work hours'],['06:00','09:00','Mornings'],['13:00','14:00','Lunch hour']].map(([a,z,t])=>`<button class="chip${r.from===a&&r.to===z?' on':''}" data-act="blkWin" data-a="${a}" data-z="${z}">${t}</button>`).join('')}</div>
  <div class="blk-times"><label><span>From</span><input type="time" data-blke="from" value="${esc(r.from)}"></label><label><span>To</span><input type="time" data-blke="to" value="${esc(r.to)}"></label></div>${hm(r.from)>hm(r.to)?'<small class="muted">Runs past midnight: it ends the next morning.</small>':hm(r.from)===hm(r.to)?'<small class="err">Pick different start and end times.</small>':''}</div>`;
 b+=`<div class="field"><label>Days</label><div class="blk-days">${DAYS.map((d,i)=>`<button class="${!(r.days||[]).length||r.days.includes(i)?'on':''}" data-act="blkDay" data-v="${i}" aria-label="${DAYN[i]}" aria-pressed="${!(r.days||[]).length||r.days.includes(i)}">${d}</button>`).join('')}</div><small class="muted">${daysTxt(r.days)[0].toUpperCase()+daysTxt(r.days).slice(1)}</small></div>`;
 b+=`<div class="field"><label>When it’s blocking</label><div class="blk-frs">${FR.map(([v,t,x])=>`<label class="blk-fro${(r.fr||'hard')===v?' on':''}"><input type="radio" name="blkfr" data-blke="fr" value="${v}" ${(r.fr||'hard')===v?'checked':''}><span><b>${t}</b><small>${x}</small></span></label>`).join('')}</div>
 ${r.fr&&r.fr!=='hard'?`<div class="chips" style="margin-top:8px">${[5,10,15].map(v=>`<button class="chip${(+r.more||5)===v?' on':''}" data-act="blkEd" data-f="more" data-v="${v}">${v} more min</button>`).join('')}</div>`:''}</div>`;
 b+=`<div class="field"><label for="blkName">Name <small class="muted">(optional)</small></label><input id="blkName" data-blke="name" maxlength="40" value="${esc(r.name||'')}" placeholder="${esc(k==='sched'?'Bedtime':k==='total'?'Phone limit':'Social media')}"></div>`;
 const ok=edOk();
 b+=`<div class="actions">${isNew?'':`<button class="btn danger" data-act="blkDel">Delete</button>`}<button class="btn ghost" data-act="close">Cancel</button><button class="btn pri" data-act="blkSave" ${ok?'':'disabled'}>${isNew?'Add':'Save'}</button></div>`;
 return`<div id="blkEdit">${b}</div>`}
/* the apps a schedule for every app, or the phone limit, leaves open (besides calls, Settings and Never blocked) */
function exceptHTML(r){const L=r.allow||[],c=cfg();return`<div class="blk-apps">${L.length?L.slice(0,10).map(pk=>icoHTML(pk)).join(''):'<span class="small muted">No other apps</span>'}<button class="btn sm" data-act="blkPick" data-for="except">${L.length?'Change':'Choose apps'}</button></div><small class="muted">${r.kind==='total'?'These don’t count toward the limit and stay open.':'These stay open.'} Calls, Settings${c.allow.length?', '+esc(appsTxt(c.allow,3)):''} and Plotlines always do.</small>`}
function edOk(){const r=ED&&ED.r;if(!r)return false;if(r.kind==='limit')return r.apps.length>0&&r.min>0;if(r.kind==='total')return r.min>0;return(r.all||r.apps.length>0)&&hm(r.from)!==hm(r.to)}
function edPaint(){const e=$('#blkEdit');if(!e)return;const sh=$('#sheet'),y=sh&&sh.scrollTop;e.outerHTML=edHTML();if(sh)sh.scrollTop=y}
function edOpen(r){ED={r:JSON.parse(JSON.stringify(r))};openSheet(edHTML())}

/* ---------------- choosing apps ---------------- */
let PK=null;
const SUG=new Set([0,2,4,5]);
function pickOpen(sel,done,ttl){apps();PK={sel:new Set(sel),done,q:''};const d=document.createElement('div');d.className='vdlg blk-dlg';d.innerHTML=`<div class="vdlg-b blk-pick" role="dialog" aria-label="${esc(ttl||'Choose apps')}"><h3>${esc(ttl||'Choose apps')}</h3><input class="blk-q" type="search" placeholder="Search apps" aria-label="Search apps" autocomplete="off"><div class="blk-pl" id="blkPl"></div><div class="actions"><span class="small muted" id="blkPn"></span><button class="btn ghost" data-act="blkPickNo">Cancel</button><button class="btn pri" data-act="blkPickOk">Done</button></div></div>`;document.body.appendChild(d);pickPaint();
 d.addEventListener('click',e=>{if(e.target===d)d.remove()});d.querySelector('.blk-q').addEventListener('input',e=>{PK.q=e.target.value;pickPaint()})}
function pickPaint(){const el=$('#blkPl');if(!el||!PK)return;const q=PK.q.trim().toLowerCase(),A=apps();
 if(!A.length){el.innerHTML=`<p class="small muted">${(typeof NATIVE!=="undefined"&&NATIVE)?'No apps found on this phone.':'Apps come from your phone. Open Plotlines on Android with sync on, and the apps in your screen time show up here.'}</p>`;$('#blkPn').textContent='';return}
 const L=A.filter(a=>!q||a.name.toLowerCase().includes(q)||a.pk.includes(q)).sort((a,b)=>(PK.sel.has(b.pk)-PK.sel.has(a.pk))||(SUG.has(b.cat)-SUG.has(a.cat))||a.name.localeCompare(b.name));
 const tag=c=>c===4?'social':c===2?'video':c===0?'game':c===5?'news':'';
 el.innerHTML=L.map(a=>`<label class="blk-pa"><input type="checkbox" value="${esc(a.pk)}" ${PK.sel.has(a.pk)?'checked':''}>${icoHTML(a.pk)}<span>${esc(a.name)}${tag(a.cat)?` <em>${tag(a.cat)}</em>`:''}</span></label>`).join('')||'<p class="small muted">No app matches.</p>';
 $('#blkPn').textContent=PK.sel.size?`${PK.sel.size} chosen`:''}
document.addEventListener('change',e=>{const t=e.target;if(PK&&t.closest&&t.closest('.blk-pick')&&t.type==='checkbox'){if(t.checked)PK.sel.add(t.value);else PK.sel.delete(t.value);const n=$('#blkPn');if(n)n.textContent=PK.sel.size?`${PK.sel.size} chosen`:''}});

/* ---------------- actions ---------------- */
const saveAll=()=>{const c=cfg();c.u=Date.now();save();push(false);if(cur.p==='blocks')render(false)};
Object.assign(ACT,{
 blkPerm:d=>{try{NA.blockOpen(d.k)}catch(e){}},
 blkFdef:d=>{const f=cfg().fdef;f[d.f]=d.f==='min'?+d.v:d.v;save();render(false)},
 blkStart:()=>{const c=cfg(),d=c.fdef;const r=startFocus({min:d.min,mode:d.mode,lock:d.lock,fr:d.fr});if(r.err)return toast(esc(r.err));render(false);window.scrollTo({top:0,behavior:'smooth'});
  toast(ON()&&!(ST.usage&&ST.overlay)?'Focus started. Allow the two permissions so it can block':`Focus until ${new Date(r.f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`)},
 blkStop:()=>{const f=focusNow();if(!f)return;if(f.lock)return toast('Focus is locked until it ends');askConfirm('Stop focus now?',`You’ve done ${mm((Date.now()-f.start)/60000)}. Those minutes still count.`,'Stop focus',()=>{endFocus(true);closeSheet();render(false);toast('Focus stopped')},false)},
 blkMore:d=>{addFocus(+d.v);render(false);toast(`Focus is ${d.v} minutes longer`)},
 blkNew:d=>edOpen(blank(d.k)),
 blkEdit:d=>{const r=cfg().rules.find(x=>x.id===d.id);if(r)edOpen(r)},
 blkEd:d=>{const r=ED.r;if(d.f==='all')r.all=d.v==='1';else r[d.f]=isNaN(+d.v)?d.v:+d.v;edPaint()},
 blkWin:d=>{ED.r.from=d.a;ED.r.to=d.z;edPaint()},
 blkDay:d=>{const r=ED.r,i=+d.v;let D=(r.days||[]).length?r.days.slice():[0,1,2,3,4,5,6];D=D.includes(i)?D.filter(x=>x!==i):[...D,i].sort();if(!D.length)return toast('Keep at least one day');r.days=D.length===7?[]:D;edPaint()},
 blkSave:()=>{if(!edOk())return;const c=cfg(),r={...ED.r,u:Date.now()};r.name=String(r.name||'').trim();const i=c.rules.findIndex(x=>x.id===r.id),isNew=i<0;if(isNew)c.rules.push(r);else c.rules[i]=r;ED=null;closeSheet();saveAll();
  toast(isNew?`Added “${esc(title(r))}”`:'Saved')},
 blkDel:()=>{const c=cfg(),id=ED.r.id,i=c.rules.findIndex(x=>x.id===id);if(i<0)return;const r=c.rules[i];askConfirm('Delete this block?',`“${esc(title(r))}” stops blocking right away.`,'Delete',()=>{c.rules.splice(i,1);ED=null;closeSheet();saveAll();toast('Block deleted',()=>{c.rules.splice(Math.min(i,c.rules.length),0,r);saveAll()})})},
 blkPick:d=>{const c=cfg();if(d.for==='distract')pickOpen(c.distract,L=>{c.distract=L;save();render(false)},'Apps focus blocks');
  else if(d.for==='allow'){if(lockedNow())return toast('Focus is locked. You can add apps to Never blocked when it ends.');pickOpen(c.allow,L=>{if(lockedNow())L=L.filter(p=>c.allow.includes(p));c.allow=L;saveAll();if($('#sheet.on h2')&&/Settings/.test($('#sheet h2').textContent))setSheet()},'Never block these')}
  else if(d.for==='except')pickOpen(ED.r.allow||[],L=>{ED.r.allow=L;edPaint()},'Keep these open');
  else pickOpen(ED.r.apps,L=>{ED.r.apps=L;edPaint()},'Choose apps')},
 blkAllowDel:d=>{const c=cfg(),i=c.allow.indexOf(d.k);if(i<0)return;c.allow.splice(i,1);saveAll();if($('#sheet.on h2')&&/Settings/.test($('#sheet h2').textContent))setSheet();toast(`${esc(lab(d.k))} can be blocked again`,()=>{c.allow.splice(i,0,d.k);saveAll()})},
 blkQuick:d=>{const c=cfg(),r=startFocus({min:+d.v,mode:c.distract.length?c.fdef.mode:'all',lock:false,fr:c.fdef.fr});if(r.err){go('blocks');return toast(esc(r.err))}render(false);toast(`Focus until ${new Date(r.f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`)},
 blkPickOk:()=>{const d=document.querySelector('.blk-dlg');if(!d||!PK)return;const L=[...PK.sel],f=PK.done;PK=null;d.remove();f(L)},
 blkPickNo:()=>{document.querySelector('.blk-dlg')?.remove();PK=null},
 blkSet:()=>setSheet(),
 blkHabit:()=>{focusHabit();closeSheet()},
 blkScreen:d=>{/* from Screen time: block an app at its daily limit */const c=cfg(),lim=(S.settings.act&&S.settings.act.scx&&S.settings.act.scx.lim||{})[d.k]||60;const ex=c.rules.find(r=>r.kind==='limit'&&r.apps.length===1&&r.apps[0]===d.k);closeSheet();
  if(ex){ex.min=lim;ex.on=true;saveAll();go('blocks');return toast(`${esc(lab(d.k))} is blocked after ${mm(lim)} a day`)}
  const r={...blank('limit'),apps:[d.k],min:lim};c.rules.push(r);saveAll();go('blocks');toast(`${esc(lab(d.k))} is blocked after ${mm(lim)} a day`)}
});
function setSheet(){const c=cfg();openSheet(`<div class="data">Blocks</div><h2 style="margin-top:6px">Settings</h2>
 <div class="field"><label>Never block</label><div class="blk-apps">${c.allow.length?c.allow.slice(0,10).map(pk=>icoHTML(pk)).join(''):'<span class="small muted">Only calls, Settings and the home screen</span>'}<button class="btn sm" data-act="blkPick" data-for="allow">${c.allow.length?'Change':'Choose apps'}</button></div><small class="muted">Apps like Maps, banking or your authenticator that should always open. Calls, Settings and Plotlines are never blocked.</small></div>
 <div class="field"><label>Focus blocks</label><div class="blk-apps">${c.distract.length?c.distract.slice(0,10).map(pk=>icoHTML(pk)).join(''):'<span class="small muted">None yet</span>'}<button class="btn sm" data-act="blkPick" data-for="distract">${c.distract.length?'Change':'Choose apps'}</button></div></div>
 <div class="field"><label>Focus habit</label><p class="small muted" style="margin:0 0 8px">A habit that fills in with your focus minutes each day.</p><button class="btn sm" data-act="blkHabit">${ic('habit')}Make a focus habit</button></div>
 <p class="small muted">To stop blocking altogether, turn the blocks off, or take away Plotlines’ usage access in Android’s settings. A block screen can always be closed with Home.</p>
 <div class="actions"><button class="btn pri" data-act="close">Done</button></div>`)}
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;
 if(t.dataset.blkon){const r=cfg().rules.find(x=>x.id===t.dataset.blkon);if(!r)return;r.on=t.checked;r.u=Date.now();saveAll();toast(`${esc(title(r))} ${r.on?'on':'off'}`);return}
 if(t.dataset.blkf){const f=cfg().fdef;if(t.dataset.blkf==='lock')f.lock=t.checked;else{const v=Math.max(1,Math.min(720,Math.round(+t.value||25)));f.min=v}save();render(false);return}
 if(t.dataset.blke&&ED){const k=t.dataset.blke;if(k==='min'){const v=Math.max(1,Math.min(1440,Math.round(+t.value||0)));ED.r.min=v}else ED.r[k]=t.value;if(k!=='name')edPaint();else{const b=$('#blkEdit .btn.pri');if(b)b.disabled=!edOk()}}});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.blke==='name'&&ED)ED.r.name=t.value});

VIEWS.blocks=()=>{setTimeout(()=>{if(focusNow())tickStart()},0);return vBlocks()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;settle();push(true);credit();if(cur.p==='blocks')render(false)});
setTimeout(()=>{settle();push(true);credit()},3000);
/* rules that arrive from another device by sync */
{const _s=window.syncNative;if(typeof _s==='function')window.syncNative=function(){const x=_s.apply(this,arguments);try{push(false)}catch(e){}return x}}

/* Screen time: a way in from the page, and "Block it" on an app */
{const _v=VIEWS.screen;if(_v)VIEWS.screen=function(){const h=_v.apply(this,arguments),i=h.indexOf('</header>');if(i<0)return h;const c=cfg(),n=c.rules.filter(r=>r.on).length,f=focusNow();
 return h.slice(0,i+9)+`<a class="panel rv blk-in" href="#/blocks"><span class="blk-fi">${ic('shield')}</span><span><b>Blocks</b><small>${f?'Focus is on':n?`${n} on`:'Limits, focus and schedules that stop you'}</small></span>${ic('next','ico-s')}</a>`+h.slice(i+9)}}

/* ---------------- the assistant: "block Instagram for an hour" ---------------- */
const ALIAS={insta:'instagram',ig:'instagram',yt:'youtube',fb:'facebook',twitter:'x',snap:'snapchat',wa:'whatsapp',reddit:'reddit',tiktok:'tiktok'};
const nrm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function findApps(txt){const A=apps(),out=[],miss=[];const parts=nrm(txt).replace(/\b(the|my|app|apps)\b/g,' ').split(/\s*(?:,|\band\b|&|\bor\b)\s*/).map(s=>s.trim()).filter(Boolean);
 for(let p of parts){p=ALIAS[p]||p;const hit=A.find(a=>nrm(a.name)===p)||A.find(a=>nrm(a.name).startsWith(p))||A.find(a=>nrm(a.name).split(' ').some(w=>w===p))||(p.length>=4&&A.find(a=>nrm(a.name).includes(p)));if(hit){if(!out.includes(hit.pk))out.push(hit.pk)}else miss.push(p)}
 return{apps:out,miss}}
const durMin=(n,u)=>/^h/.test(u)?Math.round(+n*60):Math.round(+n);
const DUR='(\\d+(?:\\.\\d+)?|an?|half an?)\\s*(hours?|hrs?|h|minutes?|mins?|m)\\b';
const numOf=s=>/^half/.test(s)?0.5:/^an?$/.test(s)?1:+s;
function atTime(s){const m=/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i.exec(s||'');if(!m)return null;let h=+m[1],mi=+(m[2]||0);const ap=(m[3]||'').toLowerCase();if(ap.startsWith('p')&&h<12)h+=12;if(ap.startsWith('a')&&h===12)h=0;if(h>23||mi>59)return null;return`${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`}
const untilMs=t=>{const[h,m]=t.split(':').map(Number),d=new Date();d.setHours(h,m,0,0);if(d<=new Date())d.setDate(d.getDate()+1);return d.getTime()};
const OPEN=[['Open Blocks','blocks']];
function voice(raw){const t=nrm(raw).replace(/^(please|can you|could you|hey \w+)\s+/,'');let m;
 if(/^(what s|whats|what is|show|list)( my)? (blocked|blocks)|^what (apps )?(are|is) blocked/.test(t)){state();const c=cfg(),f=focusNow(),on=c.rules.filter(r=>r.on);
  if(!f&&!on.length)return{say:'Nothing is blocked. You can say “block Instagram for an hour” or “limit YouTube to 30 minutes a day”.',chips:OPEN};
  const now=on.filter(r=>status(r).now);return{say:[f?`Focus is on until ${new Date(f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.`:'',on.length?`${on.length} block${on.length===1?' is':'s are'} on${now.length?`, and ${now.map(title).join(', ')} ${now.length===1?'is':'are'} blocking now`:''}.`:''].filter(Boolean).join(' '),chips:OPEN}}
 if(/^(stop|end|cancel|finish) (the )?focus/.test(t)){const f=focusNow();if(!f)return{say:'There’s no focus session running.'};if(f.lock)return{say:`Focus is locked until ${new Date(f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.`};endFocus(true);if(cur.p==='blocks')render(false);return{say:'Focus stopped. Your apps are open again.'}}
 if((m=new RegExp('^(?:start |begin |turn on )?focus(?: mode)?(?: for)? '+DUR).exec(t))){const min=durMin(numOf(m[1]),m[2]);const c=cfg();const r=startFocus({min,mode:c.distract.length?c.fdef.mode:'all',lock:false,fr:c.fdef.fr});if(r.err)return{say:r.err,chips:OPEN};if(cur.p==='blocks')render(false);return{say:`Focus for ${say(min)}, until ${new Date(r.f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.${r.f.all?' Everything except calls and your never-blocked apps is blocked.':` ${appsTxt(r.f.apps,4)} ${r.f.apps.length===1?'is':'are'} blocked.`}`,chips:OPEN}}
 if((m=new RegExp('^(?:limit|cap|restrict) (.+?) to '+DUR+'(?: a| per| each)? ?(?:day|daily)?$').exec(t))){const F=findApps(m[1]);if(!F.apps.length)return{say:`I couldn’t find ${raw.replace(/^.*?(limit|cap|restrict)\s+/i,'').split(/\s+to\s+/i)[0]} on this phone.`,chips:OPEN};
  const min=durMin(numOf(m[2]),m[3]),c=cfg();const ex=c.rules.find(r=>r.kind==='limit'&&r.apps.length===F.apps.length&&F.apps.every(p=>r.apps.includes(p)));if(ex){ex.min=min;ex.on=true;ex.u=Date.now()}else c.rules.push({...blank('limit'),apps:F.apps,min});saveAll();
  return{say:`${appsTxt(F.apps,4)} ${F.apps.length===1?'is':'are'} now limited to ${say(min)} a day${F.apps.length>1?' together':''}.${F.miss.length?` I couldn’t find ${F.miss.join(', ')}.`:''}`,chips:OPEN}}
 if((m=/^(?:block|no) (.+?) (?:from|between) (.+?) (?:to|and|until|till) (.+)$/.exec(t))){const a=atTime(m[2]),z=atTime(m[3]);const all=/^(everything|all( apps)?|my phone|the phone)$/.test(m[1]);const F=all?{apps:[],miss:[]}:findApps(m[1]);
  if(!a||!z)return null;if(!all&&!F.apps.length)return{say:`I couldn’t find ${m[1]} on this phone.`,chips:OPEN};cfg().rules.push({...blank('sched'),apps:F.apps,all,from:a,to:z});saveAll();
  return{say:`${all?'Every app':appsTxt(F.apps,4)} will be blocked from ${t12(a)} to ${t12(z)} every day.`,chips:OPEN}}
 if((m=new RegExp('^block (.+?) (?:for '+DUR+'|until (.+))$').exec(t))){const all=/^(everything|all( apps)?|my phone|the phone|distractions|distracting apps)$/.test(m[1]);const F=all?{apps:[],miss:[]}:findApps(m[1]);if(!all&&!F.apps.length)return{say:`I couldn’t find ${m[1]} on this phone.`,chips:OPEN};
  let min,until=0;if(m[2])min=durMin(numOf(m[2]),m[3]);else{const at=atTime(m[4]);if(!at)return null;until=untilMs(at);min=Math.ceil((until-Date.now())/60000)}
  const f0=focusNow();if(f0&&f0.lock)return{say:'A locked focus session is already running.'};
  const isD=/^(distractions|distracting apps)$/.test(m[1]);const r=startFocus({min,until,mode:all&&!isD?'all':'apps',apps:isD?cfg().distract:F.apps,lock:false,fr:'hard',name:all?'':'Block'});if(r.err)return{say:r.err,chips:OPEN};if(cur.p==='blocks')render(false);
  return{say:`${all&&!isD?'Everything except calls and your never-blocked apps':appsTxt(r.f.apps,4)} ${(all&&!isD)||r.f.apps.length!==1?'are':'is'} blocked until ${new Date(r.f.until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.${F.miss.length?` I couldn’t find ${F.miss.join(', ')}.`:''}`,chips:OPEN}}
 if((m=/^(?:unblock|stop blocking|remove (?:the )?(?:limit|block)s? (?:on|for|from)) (.+)$/.exec(t))){const c=cfg();if(/^(everything|all|all apps)$/.test(m[1])){const f=focusNow();if(f&&f.lock)return{say:'Focus is locked until it ends.'};if(f)endFocus(true);c.rules.forEach(r=>r.on=false);saveAll();return{say:'Everything is unblocked. Your blocks are off; turn them back on in Blocks.',chips:OPEN}}
  const F=findApps(m[1]);if(!F.apps.length)return{say:`I couldn’t find ${m[1]} on this phone.`};let n=0;
  c.rules=c.rules.filter(r=>{if(r.all||r.kind==='total')return true;const had=r.apps.length;r.apps=r.apps.filter(p=>!F.apps.includes(p));if(r.apps.length<had){n++;r.u=Date.now()}return r.apps.length>0});
  const f=LS('plotline.focus');if(f&&f.until>Date.now()&&!f.all){if(f.lock)return{say:'Focus is locked until it ends, so that stays blocked.'};f.apps=f.apps.filter(p=>!F.apps.includes(p));n++;if(f.apps.length)LS('plotline.focus',f);else endFocus(true)}
  saveAll();push(true);return{say:n?`${appsTxt(F.apps,4)} ${F.apps.length===1?'isn’t':'aren’t'} blocked anymore.`:`${appsTxt(F.apps,4)} wasn’t in any block.`,chips:OPEN}}
 return null}
/* Home: a Blocks card of its own (Customize Home moves or hides it): focus with time left, or quick starts, and what's blocking */
window.blkHome=()=>{const c=cfg(),f=focusNow(),on=c.rules.filter(r=>r.on);if(!(typeof NATIVE!=="undefined"&&NATIVE)&&!on.length&&!f)return'';if(ON())state();
 const now=on.filter(r=>status(r).now),t=x=>new Date(x).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 const body=f?`<div class="blk-hc"><span class="blk-fi">${ic('hourglass')}</span><div><b>${esc(f.name||'Focus')} · ${mm((f.until-Date.now())/60000)} left</b><small>Until ${t(f.until)} · ${f.all?'everything blocked':esc(appsTxt(f.apps,3))+' blocked'}</small></div></div><div class="blk-hb"><button class="btn sm" data-act="blkMore" data-v="15">+15 min</button><a class="btn sm ghost" href="#/blocks">Open</a></div>`
  :`<div class="blk-hc"><span class="blk-fi">${ic('shield')}</span><div><b>${now.length?esc(now.map(title).join(', '))+(now.length===1?' is':' are')+' blocked now':on.length?`${on.length} block${on.length===1?'':'s'} on`:'Stay off the apps that pull you in'}</b><small>${on.length?esc(on.slice(0,2).map(r=>title(r)+' · '+status(r).sub.split(' · ')[0]).join('  ·  ')):'Limits, focus and schedules that really block'}</small></div></div><div class="blk-hb"><button class="btn sm pri" data-act="blkQuick" data-v="25">Focus 25 min</button><button class="btn sm" data-act="blkQuick" data-v="60">1 hour</button><a class="btn sm ghost" href="#/blocks">${on.length?'Blocks':'Set up'}</a></div>`;
 return`<section class="rv hblk" data-hk="blk"><div class="st-h"><h3>Blocks</h3><a class="link" href="#/blocks">All blocks</a></div><div class="panel blk-home">${body}</div></section>`};
/* Settings: Blocks gets its own entry (and in Find anything) */
try{const T=window.FF_SETS;if(T&&!T.some(x=>x[0]==='blocks'))T.splice(T.findIndex(x=>x[0]==='auto')+1||T.length,0,['blocks','Blocks','App limits, focus, schedules, never-blocked apps'])}catch(e){}
if(typeof setSecs==='function'){const _ss=setSecs;setSecs=function(){const a=_ss.apply(this,arguments),i=a.findIndex(x=>x.k==='auto');a.splice(i<0?a.length:i+1,0,{k:'blocks',t:'Blocks',ic:'shield',sub:()=>{const c=cfg(),n=c.rules.filter(r=>r.on).length,f=focusNow();return f?'Focus is on':n?`${n} block${n===1?'':'s'} on`:'App limits, focus and schedules'},
 html:()=>{if(ON())state();return`<section class="panel rv"><h3>Blocks</h3><p class="small muted">Limits, focus sessions and schedules that cover an app with a Plotlines screen when it’s blocked.</p><div class="actions left"><a class="btn pri" href="#/blocks">${ic('shield')}Open Blocks</a></div></section>${needHTML()}${allowHTML()}<section class="panel rv"><h3>Focus habit</h3><p class="small muted">A habit that fills in with your focus minutes each day.</p><div class="actions left"><button class="btn sm" data-act="blkHabit">${ic('habit')}Make a focus habit</button></div></section>`}});return a}}
/* the rules travel with your other synced settings (Drive); a phone that gets new rules hands them to its blocker */
if(typeof syncPref==='function')syncPref('blk',()=>S.settings.blk||null,v=>{if(!v)return;S.settings.blk=v;try{push(false)}catch(e){}if(cur.p==='blocks')render(false)});
window.BLOCKS={voice,push,state,cfg,startFocus,endFocus,focusNow,findApps};

const css=document.createElement('style');css.textContent=`
.blk-need{padding:16px;margin-bottom:12px}.blk-need h3{margin:0 0 4px}
.blk-steps{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:10px}
.blk-steps li{display:flex;align-items:center;gap:12px}.blk-steps li>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.blk-steps small{color:var(--muted);font-size:12.5px}
.blk-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none;font:700 13px var(--f-body);background:var(--surface-2,var(--line));color:var(--text)}.blk-steps li.ok .blk-n{background:var(--accent);color:var(--on-accent,#111)}.blk-n .ico{width:15px;height:15px}
.blk-focus{padding:16px;margin-bottom:14px}.blk-focus .field{margin-top:14px}
.blk-fh{display:flex;align-items:center;gap:12px}.blk-fh>div{display:flex;flex-direction:column;gap:2px;min-width:0}.blk-fh b{font-size:17px}.blk-fh small{color:var(--muted);font-size:13px}
.blk-fi{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}.blk-fi .ico{width:21px;height:21px}
.blk-focus.on{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.blk-clock{display:flex;align-items:baseline;gap:10px;margin:16px 0 8px}.blk-clock b{font:800 44px/1 var(--f-display);font-variant-numeric:tabular-nums;letter-spacing:-.01em}.blk-clock small{color:var(--muted)}
.blk-bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin-bottom:14px}.blk-bar i{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .6s}
.blk-lk{display:inline-flex;align-items:center;gap:5px}
.blk-num{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:0 10px 0 4px;background:var(--surface)}.blk-num input{width:58px;min-height:0;border:0;border-radius:0;background:none;box-shadow:none;color:var(--text);font:500 14px var(--f-body);padding:7px 4px;text-align:right}.blk-num:focus-within{border-color:var(--accent)}.blk-num span{color:var(--muted);font-size:13px}
.blk-seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--surface-2,var(--surface));border:1px solid var(--line);margin-bottom:8px;max-width:100%}
.blk-seg button{border:0;background:none;color:var(--muted);font:600 13.5px var(--f-body);padding:7px 14px;border-radius:999px;cursor:pointer;white-space:nowrap}.blk-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18)}
.blk-apps{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:6px}.blk-apps .btn{margin-left:4px}
.blk-ai{width:30px;height:30px;border-radius:9px;flex:none;object-fit:cover;display:inline-grid;place-items:center}.blk-ai.sm{width:22px;height:22px;border-radius:7px}
.blk-al{background:var(--surface-2,var(--line));color:var(--muted);font:700 13px var(--f-body)}.blk-al .ico{width:17px;height:17px}
.blk-more{font:600 12.5px var(--f-body);color:var(--muted);padding:0 4px}
.blk-add{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.blk-ab{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:14px;border-radius:18px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;cursor:pointer;min-width:0}
.blk-ab>span{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent);margin-bottom:4px}.blk-ab>span .ico{width:18px;height:18px}
.blk-ab b{font-size:14.5px}.blk-ab small{color:var(--muted);font-size:12.5px;line-height:1.35}
@media(max-width:560px){.blk-add{grid-template-columns:1fr}.blk-ab{flex-direction:row;align-items:center;gap:12px;padding:12px 14px}.blk-ab>span{margin:0}.blk-ab b{flex:none}.blk-ab small{flex:1}}
.blk-list{display:flex;flex-direction:column;padding:4px}
.blk-r{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 0}.blk-r+.blk-r{border-top:1px solid var(--line)}
.blk-rb{display:flex;align-items:center;gap:12px;flex:1;min-width:0;padding:10px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:12px}
.blk-rt{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.blk-rt b{font-size:15px;overflow:hidden;text-overflow:ellipsis}.blk-rt small{color:var(--muted);font-size:12.5px}
.blk-rt em{font-style:normal;font:700 11px var(--f-body);text-transform:uppercase;letter-spacing:.04em;color:var(--accent);margin-left:6px;white-space:nowrap}.blk-rt em.g{color:var(--muted)}
.blk-fr{opacity:.8}
.blk-pb{display:block;height:4px;border-radius:2px;background:var(--line);overflow:hidden;margin:2px 0}.blk-pb i{display:block;height:100%;background:var(--accent);border-radius:2px}
.blk-r.off .blk-rb{opacity:.55}.blk-r.now .blk-ai{box-shadow:0 0 0 2px var(--accent)}
.blk-stack{display:flex;flex:none}.blk-stack .blk-ai+.blk-ai{margin-left:-10px;box-shadow:0 0 0 2px var(--surface)}
.blk-tg{position:relative;flex:none;width:44px;height:26px;cursor:pointer}.blk-tg input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.blk-tg i{position:absolute;inset:0;border-radius:13px;background:var(--line);transition:background .2s}.blk-tg i::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.blk-tg input:checked+i{background:var(--accent)}.blk-tg input:checked+i::after{transform:translateX(18px)}.blk-tg input:focus-visible+i{outline:2px solid var(--accent);outline-offset:2px}
.blk-st{margin-bottom:10px}
.blk-ev{display:flex;flex-direction:column;padding:6px 12px}.blk-ev>div{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:14px;min-width:0}.blk-ev>div+div{border-top:1px solid var(--line)}
.blk-ev span{color:var(--muted);font-variant-numeric:tabular-nums;width:66px;flex:none;font-size:13px}.blk-ev b{font-weight:600;flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.blk-ev small{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.blk-times{display:flex;gap:10px;margin-top:10px}.blk-times label{flex:1;display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}.blk-times input{width:100%}
.blk-days{display:flex;gap:6px;margin-bottom:6px}.blk-days button{flex:1;max-width:44px;aspect-ratio:1;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:700 13px var(--f-body);cursor:pointer}.blk-days button.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#111)}
.blk-frs{display:flex;flex-direction:column;gap:6px}
.blk-fro{display:flex;gap:12px;align-items:flex-start;padding:11px 13px;border:1px solid var(--line);border-radius:14px;cursor:pointer}.blk-fro.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
.blk-fro input,.blk-pa input{-webkit-appearance:auto;appearance:auto;width:18px;height:18px;flex:none;padding:0;margin:2px 0 0;border:0;border-radius:0;background:none;box-shadow:none;accent-color:var(--accent)}.blk-fro span{display:flex;flex-direction:column;gap:2px}.blk-fro b{font-size:14.5px}.blk-fro small{color:var(--muted);font-size:12.5px}
.blk-pick{display:flex;flex-direction:column;max-height:min(640px,88vh)}.blk-pick h3{margin:0 0 10px}
.blk-q{width:100%;margin-bottom:8px}
.blk-pl{overflow:auto;flex:1;min-height:120px;margin:0 -6px;padding:0 6px}
.blk-pa{display:flex;align-items:center;gap:12px;padding:8px 4px;cursor:pointer;border-radius:10px}.blk-pa+.blk-pa{border-top:1px solid var(--line)}
.blk-pa input{margin:0}.blk-pa span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}.blk-pa em{font-style:normal;font-size:11.5px;color:var(--muted);margin-left:4px}
.blk-pick .actions{align-items:center;margin-top:10px}.blk-pick .actions .small{margin-right:auto}
.blk-allow{padding:12px 14px}.blk-chips{display:flex;flex-wrap:wrap;gap:8px}
.blk-chip{display:inline-flex;align-items:center;gap:8px;padding:5px 6px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2,var(--surface));font:inherit;color:var(--text);max-width:100%}.blk-chip b{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.blk-chip.add{cursor:pointer;padding:6px 14px 6px 10px;color:var(--accent);border-style:dashed}.blk-chip.add .ico{width:16px;height:16px;flex:none}.blk-chip.add b{overflow:visible;flex:none}
.blk-x{width:26px;height:26px;border-radius:50%;border:0;background:none;color:var(--muted);display:grid;place-items:center;cursor:pointer;flex:none}.blk-x .ico{width:15px;height:15px}
.blk-empty{display:flex;align-items:center;gap:12px;width:100%;padding:4px 0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}.blk-empty>span:last-child{display:flex;flex-direction:column;gap:2px}.blk-empty small{color:var(--muted);font-size:12.5px}
.blk-an{margin:10px 0 0}
.hblk{margin-bottom:18px}.blk-home{padding:14px}.blk-hc{display:flex;align-items:center;gap:12px}.blk-hc>div{display:flex;flex-direction:column;gap:2px;min-width:0}.blk-hc b{font-size:15.5px}.blk-hc small{color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.blk-hb{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.blk-in{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:12px;color:inherit;text-decoration:none}.blk-in>span:nth-child(2){display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.blk-in small{color:var(--muted);font-size:12.5px}`;
document.head.appendChild(css);
})();
