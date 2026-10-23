/* ================= Canvas =================
   Build things with the AI, one step at a time: reports and dashboards from your own data, small apps and tools,
   websites, and designs. You ask in chat or with the mic; the AI writes one self-contained web page and then changes it
   step by step (whole page, or SEARCH/REPLACE edits for small changes). The page runs in a sandboxed frame with no
   access to the app. Your data reaches it only as a read-only snapshot (window.PLOT_DATA), and only when "Use my data"
   is on. An app the AI builds can keep its own things with localStorage: the frame's copy is stored with the canvas.
   Every change is a version you can go back to. Canvases are saved on this device (IndexedDB key "canvases"),
   with rename, reset, delete, full screen, code view (editable) and download as an .html file.
   Works with any AI the app can use, and best with a big model on your own AI server (Ollama, LM Studio). */
(()=>{
'use strict';
const nm=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const clip=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n):s};
const MAXV=40,MAXM=80;
Object.assign(IC,{cvs:'<rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M3 8h18M8 21h8M12 18v3"/><path d="M7.5 12.5l2 1.5-2 1.5M12 15.5h3.5"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
 phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',desk:'<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
 dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',vers:'<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.3 7.2l7.4 3.6"/>'});

/* ---------------- the store ---------------- */
let CS=[],saveT=0;
const LOADED=DB.get('canvases').then(v=>{if(Array.isArray(v))CS=[...CS,...v.filter(c=>c&&c.id&&!CS.some(x=>x.id===c.id))].sort((a,b)=>b.t1-a.t1);if(cur.p==='canvas')render(false)}).catch(()=>{});
const persist=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{DB.set('canvases',CS).catch(()=>toast('Couldn’t save the canvas on this device'))},300)};
const get=id=>CS.find(c=>c.id===id)||null;
function make(title){const c={id:uid(),title:title||'Untitled canvas',named:!!title,t0:Date.now(),t1:Date.now(),html:'',ver:[],msgs:[],store:{},data:true,w:'full'};CS.unshift(c);persist();return c}
const touch=c=>{c.t1=Date.now();CS=[c,...CS.filter(x=>x!==c)];persist()};
/* a new version of the page; the old one stays in the history */
function commit(c,html,note,by){c.html=html;c.ver.push({t:Date.now(),html,note:tr(note||'',140),by:by||'ai'});if(c.ver.length>MAXV)c.ver=c.ver.slice(-MAXV);c.vi=c.ver.length-1;touch(c)}

/* ---------------- your data, as the page sees it ---------------- */
const dayOf=t=>ymd(new Date(t));
function plotData(){const td=ymd(),tn=dnum(td),priv=insSet().priv,from=tn-119;
 const habits=S.habits.filter(h=>h.status!=='archived').map(h=>{const hist=[];
  for(let k=Math.max(from,dnum(h.startDate||td));k<=tn;k++){const ds=fromN(k);let due=false,done=false,v=0;try{due=hCounts(h,ds);done=hDone(h,ds);v=hVal(h,ds)}catch(e){}if(due||v||h.skip[ds])hist.push({date:ds,due,done,value:v,skipped:!!h.skip[ds]})}
  return{id:h.id,title:h.title,icon:h.icon||'',kind:h.kind,area:areaName(h.area),status:h.status,freq:h.freq,timesPerWeek:h.freq==='times'?h.times:null,target:hTarget(h),unit:h.unit||'',time:h.time||'',startDate:h.startDate,
   steps:(h.steps||[]).map(s=>s.title||s.t||''),history:hist,slips:h.kind==='quit'?(h.slips||[]).map(s=>dayOf(s.t||s)):undefined}});
 const goals=S.goals.map(g=>({id:g.id,title:g.title,why:g.why||'',area:areaName(g.area),horizon:g.horizon,priority:g.priority,status:g.status,parent:g.parent||'',startDate:g.startDate,targetDate:g.targetDate||'',
  created:dayOf(g.createdAt||Date.now()),completed:g.completedAt?dayOf(g.completedAt):'',steps:(g.steps||[]).map(s=>({title:s.title,done:!!s.done,doneDate:s.doneAt?dayOf(s.doneAt):'',due:s.due||''}))}));
 const journal=S.entries.filter(e=>e.type==='note'&&(!e.private||priv)).sort((a,b)=>b.t-a.t).slice(0,300).map(e=>({date:dayOf(e.t),time:new Date(e.t).toTimeString().slice(0,5),title:e.title||'',text:clip(e.text||'',800),mood:e.mood?(MOODN[e.mood]||e.mood):''}));
 const plans=S.days.filter(x=>dnum(x.date)>=tn-90&&dnum(x.date)<=tn+60).map(x=>({date:x.date,time:x.time||'',title:x.title,done:!!x.done}));
 const threadsOut=threads().filter(t=>t.status!=='archived').map(t=>({title:t.title,status:t.status||'active',updates:thrUps(t).slice(0,30).map(u=>({date:dayOf(u.t),text:clip(u.x,400)}))}));
 const lists=(S.lists||[]).map(l=>({title:l.title,items:Object.values(l.items||{}).filter(x=>!x.del).map(x=>({text:x.t,done:!!x.done}))}));
 const AL=S.settings.actLog||{},activity=[];for(let k=tn-60;k<=tn;k++){const o=AL[fromN(k)];if(o)activity.push({date:fromN(k),steps:+o.s||0,sleepMinutes:+o.z||0,screenMinutes:o.m==null?null:+o.m,workouts:(o.w||[]).filter(Boolean).map(w=>w.k||'workout')})}
 return{today:td,name:S.settings.name||'',goals,habits,journal,plans,threads:threadsOut,lists,activity}}
const DATA_SHAPE=`window.PLOT_DATA = {
  today: "YYYY-MM-DD", name: string,
  goals: [{id, title, why, area, horizon: "week"|"month"|"quarter"|"year"|..., priority: 1-3, status: "active"|"done"|..., parent: goal id or "", startDate, targetDate, created, completed, steps: [{title, done, doneDate, due}]}],
  habits: [{id, title, icon, kind: "build"|"quit"|"routine", area, status, freq: "daily"|"days"|"times", timesPerWeek, target, unit, time, startDate, steps: [string],
            history: [{date, due: bool, done: bool, value: number, skipped: bool}] (last 120 days, only days that were due or had a value), slips: [date] (quit habits)}],
  journal: [{date, time: "HH:MM", title, text, mood}] (newest first),
  plans: [{date, time, title, done}] (reminders and goals for a day, last 90 days to 60 days ahead),
  threads: [{title, status, updates: [{date, text}]}],
  lists: [{title, items: [{text, done}]}],
  activity: [{date, steps, sleepMinutes, screenMinutes, workouts: [string]}] (last 60 days, may be empty)
}  (dates are "YYYY-MM-DD" strings)`;
function dataNow(){const D=plotData(),hab=D.habits.map(h=>h.title).slice(0,25),gl=D.goals.filter(g=>g.status!=='done').map(g=>g.title).slice(0,20);
 return`Right now: ${D.goals.length} goals${gl.length?' ('+gl.join('; ')+')':''}; ${D.habits.length} habits${hab.length?' ('+hab.join('; ')+')':''}; ${D.journal.length} journal entries; ${D.plans.length} plans; ${D.threads.length} threads; ${D.lists.length} lists; ${D.activity.length} days of phone activity.`}

/* ---------------- the page in its frame ---------------- */
const J=o=>JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
/* runs first inside the frame: the data, a localStorage that's kept with the canvas, and errors reported back */
function boot(c,data,live){return`<script>window.PLOT_DATA=${data?J(data):'null'};(function(){var S=${J(c.store||{})},live=${live?1:0},send=function(){if(live)try{parent.postMessage({cvs:${J(c.id)},store:S},'*')}catch(e){}};
var L={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(S,k)?String(S[k]):null},setItem:function(k,v){S[String(k)]=String(v);send()},removeItem:function(k){delete S[String(k)];send()},clear:function(){for(var k in S)delete S[k];send()},key:function(i){return Object.keys(S)[i]||null}};
Object.defineProperty(L,'length',{get:function(){return Object.keys(S).length}});try{Object.defineProperty(window,'localStorage',{value:L,configurable:true})}catch(e){}
window.addEventListener('error',function(e){if(live)try{parent.postMessage({cvs:${J(c.id)},err:String(e.message||'Script error')+(e.lineno?' (line '+e.lineno+')':'')},'*')}catch(x){}});})();</`+`script>`}
function docOf(c,o={}){const h=c.html||'',b=boot(c,c.data&&(o.data!==false)?plotData():null,!o.file);
 if(/<head[^>]*>/i.test(h))return h.replace(/<head[^>]*>/i,m=>m+b);if(/<html[^>]*>/i.test(h))return h.replace(/<html[^>]*>/i,m=>m+'<head>'+b+'</head>');return'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+b+h}
const SANDBOX='allow-scripts allow-forms allow-modals allow-popups allow-downloads';
let FR_ERR=null;
addEventListener('message',e=>{const d=e.data;if(!d||!d.cvs)return;const fr=[...document.querySelectorAll('iframe.cvs-fr')].find(f=>f.contentWindow===e.source);if(!fr||fr.dataset.id!==d.cvs)return;const c=get(d.cvs);if(!c)return;
 if(d.store&&typeof d.store==='object'){c.store=d.store;persist()}
 if(d.err){FR_ERR={id:c.id,v:c.vi,x:tr(d.err,200)};errPaint()}});

/* ---------------- talking to the AI ---------------- */
const SYS=c=>`You are ${nm()}'s Canvas inside the Plotlines app. You build and change one web page at a time together with the user: reports and dashboards from their own data, small apps and tools, websites, and designs like posters, cards or slides. Work step by step: do what they ask now, keep everything else as it is, and end with one short line suggesting a next step when it helps.

HOW TO ANSWER
Start with one or two short sentences saying what you did, in plain words. Then give either:
A) the whole page, in one block:
\`\`\`html
<!doctype html>
...
\`\`\`
B) or, when a page already exists and the change is small, only the changes, as one or more blocks exactly like this:
<<<<<<< SEARCH
(lines copied exactly from the current page)
=======
(the new lines)
>>>>>>> REPLACE
The SEARCH part must match the current page character for character and be unique. If you are not sure, send the whole page.
If the user only asks a question or wants ideas, just answer, with no code.

THE PAGE
- One self-contained HTML file with inline <style> and <script>. It is shown in a frame that can be phone-sized or full width, so make it responsive. Make it polished and modern: generous spacing, clear type (system-ui font), a calm palette, rounded cards, and both light and dark (prefers-color-scheme).
- Libraries only from https://cdn.jsdelivr.net/npm/ with an exact version, for example charts: https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js. Prefer plain JS, CSS and inline SVG.
- No other network requests, and no forms that send anywhere. For images use inline SVG, CSS shapes or emoji.
- An app can remember things (its items, settings, scores) with localStorage; it is kept with the canvas.
${c.data?`
THE USER'S DATA
Only when they ask for something built from their data (a report, chart, summary, tracker...): window.PLOT_DATA is already set on the page before your script runs. Read it in your script and compute everything from it. Never type their numbers, names or entries into the page by hand, so the page stays right as their data changes. Handle empty arrays gracefully.
${DATA_SHAPE}
${dataNow()}`:`
The user turned off "Use my data" for this canvas: window.PLOT_DATA is null. Don't build from their Plotlines data.`}
${window.AIX?AIX.safety():''}`;
/* earlier turns, without their code: the current page is always sent in full instead */
function history(c){return c.msgs.filter(m=>!m.err).slice(-8).map(m=>({role:m.r==='u'?'user':'assistant',content:m.r==='u'?m.x:(m.x||'(updated the page)')+(m.v!=null?'\n(page updated)':'')}))}
function userMsg(c,q){const n=c.ver.length;return(c.html?`CURRENT PAGE (version ${n}):\n\`\`\`html\n${c.html}\n\`\`\`\n\n`:'There is no page yet.\n\n')+'REQUEST: '+q}

/* reading the answer */
const unthink=s=>String(s||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'');
const EDIT_RX=/<{5,9} ?SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9} ?REPLACE[^\n]*/g;
function parse(raw){const s=unthink(raw);let html='',edits=[];
 const blocks=[...s.matchAll(/```[ \t]*(html|htm)?[^\n]*\n([\s\S]*?)(?:```|$)/gi)].map(m=>m[2]).filter(b=>/<[a-z!]/i.test(b)&&!/<{5,9} ?SEARCH/.test(b));
 if(blocks.length)html=blocks.sort((a,b)=>b.length-a.length)[0].trim();
 else{const i=s.search(/<!doctype html|<html[\s>]/i);if(i>=0)html=s.slice(i).trim()}
 for(const m of s.matchAll(EDIT_RX))edits.push([m[1],m[2]]);
 let note=s.replace(EDIT_RX,'').replace(/```[\s\S]*?(```|$)/g,'');const k=note.search(/<!doctype html|<html[\s>]/i);if(k>=0)note=note.slice(0,k);
 return{html:edits.length&&!/<!doctype|<html[\s>]/i.test(html)?'':html,edits,note:note.replace(/\n{3,}/g,'\n\n').trim()}}
/* small changes: exact text first, then the same lines ignoring indentation and trailing spaces */
function applyEdits(src,edits){let out=src;for(const[a,b]of edits){if(!a.trim()){out+='\n'+b;continue}
  const i=out.indexOf(a);if(i>=0){out=out.slice(0,i)+b+out.slice(i+a.length);continue}
  const L=out.split('\n'),A=a.split('\n').map(x=>x.trim()),n=A.length;let at=-1;
  for(let j=0;j+n<=L.length&&at<0;j++){let ok=true;for(let k=0;k<n;k++)if(L[j+k].trim()!==A[k]){ok=false;break}if(ok)at=j}
  if(at<0)return null;L.splice(at,n,...b.split('\n'));out=L.join('\n')}return out}
/* while it streams: what it's saying, and how far into the page it is */
function live(raw){const s=unthink(raw),i=s.search(/```|<{5,9} ?SEARCH|<!doctype html|<html[\s>]/i),code=i>=0?s.slice(i):'';
 return{note:(i>=0?s.slice(0,i):s).trim(),lines:code?code.split('\n').length:0,edit:/<{5,9} ?SEARCH/.test(code),thinking:/<think>(?![\s\S]*<\/think>)/.test(raw)}}

let RUN=null;
async function send(c,q,o={}){if(RUN)return toast('Still working on the last one');if(!window.AIX||!AIX.ready())return toast('Set up the AI first in Settings › AI & voice');
 const blk=AIX.block(q);if(blk){c.msgs.push({id:uid(),r:'u',x:q,t:Date.now()},{id:uid(),r:'a',x:blk,t:Date.now()});touch(c);return logPaint()}
 if(!o.retry)c.msgs.push({id:uid(),r:'u',x:q,t:Date.now()});if(c.msgs.length>MAXM)c.msgs=c.msgs.slice(-MAXM);
 if(!c.named&&!c.html&&c.msgs.filter(m=>m.r==='u').length===1)c.title=tr(q,48);
 const ctl=new AbortController();RUN={id:c.id,ctl,out:'',t:Date.now()};touch(c);if(TAB==='code')TAB='view';paint();
 const msgs=[{role:'system',content:SYS(c)},...history(c).slice(0,o.retry?undefined:-1),{role:'user',content:o.retry?o.retry:userMsg(c,q)}];
 let err='';
 try{await AIX.chat(msgs,t=>{if(RUN&&RUN.ctl===ctl){RUN.out+=t;livePaint()}},{max_tokens:planEngine()==='api'?16000:3000,temperature:.35,ctl,reading:'Reading the canvas…'})}
 catch(e){if(!ctl.signal.aborted)err=String(e&&e.message||e)+(planEngine()==='api'&&/fetch|network|load/i.test(String(e&&e.message))?' · Check the AI server address, that it’s running, and that it allows this app (CORS).':'')}
 const raw=RUN?RUN.out:'';RUN=null;
 if(err){c.msgs.push({id:uid(),r:'a',x:err,err:1,t:Date.now()});touch(c);return paint()}
 if(ctl.signal.aborted&&!raw.trim()){touch(c);return paint()}
 const P=parse(raw);let html=P.html,note=P.note;
 if(!html&&P.edits.length){html=applyEdits(c.html||'',P.edits);
  if(html==null){/* the edit didn't line up with the page: ask once for the whole page instead */
   if(!o.retry&&!ctl.signal.aborted){c.msgs.push({id:uid(),r:'a',x:(note?note+'\n\n':'')+'That change didn’t line up with the page, so I’m writing the whole page again.',t:Date.now(),sys:1});touch(c);
    return send(c,q,{retry:userMsg(c,q)+'\n\nSend the whole updated page as one ```html block.'})}
   c.msgs.push({id:uid(),r:'a',x:'I couldn’t apply that change. Try asking again, maybe in smaller steps.',err:1,t:Date.now()});touch(c);return paint()}}
 if(ctl.signal.aborted&&html&&!/<\/html>\s*$/i.test(html))html='';/* a stopped page is half a page: keep the last whole one */
 const m={id:uid(),r:'a',x:note||(html?'Done.':tr(unthink(raw),2000)||'The AI didn’t answer. Try again.'),t:Date.now()};
 if(html&&html!==c.html){commit(c,html,note||q);m.v=c.vi;FR_ERR=null}
 c.msgs.push(m);touch(c);
 if(window.AIX&&AIX.care){const care=AIX.care(q,m.x);if(care)m.x+='\n\n'+care}
 if(html&&TAB==='chat'&&!wide())TAB='view';paint();if(html&&cur.p==='canvas'&&cur.id!==c.id)toast(`“${esc(tr(c.title,40))}” is ready`)}

/* ---------------- the pages ---------------- */
let TAB='chat',FULL=false;
const wide=()=>matchMedia('(min-width:900px)').matches;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<2?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString([],{month:'short',day:'numeric'})};
const IDEAS=[['A report on my habits this month','report'],['A dashboard of my goals and their steps','report'],['My moods and journal over time, as charts','report'],['A focus timer app with a task list','app'],['A landing page for my side project','site'],['A poster of my goals for this year','design']];
const KIND_IC={report:'ai',app:'checklist',site:'ext',design:'pen'};
function engineHint(){if(!window.AIX||!AIX.ready())return`<div class="panel rv cvs-setup">${window.AIX?AIX.modelCard('canvas'):''}<p class="small muted">Canvas needs an AI. It works best with a big model on your own AI server: pick “Your AI server” in Settings › AI &amp; voice and point it at Ollama or LM Studio.</p><div class="actions left"><a class="btn sm" href="#/settings">Open settings</a></div></div>`;
 return planEngine()==='api'?'':`<p class="small muted cvs-hint">${ic('ai','ico-s')} You’re on a small on-device model, so pages will be simple. For real apps and reports, use a big model on your own AI server (Settings › AI &amp; voice › Your AI server).</p>`}
function vList(){return`<header class="ph"><div><h1>Canvas</h1><div class="data">${CS.length?`${CS.length} saved on this device`:`Build reports, apps, sites and designs with ${esc(nm())}`}</div></div><div class="ph-r"><button class="ibtn" data-act="cvsNew" aria-label="New canvas" title="New canvas">${ic('plus')}</button>${gear()}</div></header>
 ${engineHint()}
 <form class="cvs-start rv" data-form="cvsStart" autocomplete="off"><div class="field"><textarea id="cvsFirst" name="q" rows="3" maxlength="4000" placeholder="What should we build? “A report of my habits this month”, “a budget app”, “a website for my bakery”…" aria-label="What should we build?"></textarea></div><div class="actions left"><button class="btn pri">${ic('ai')}Start building</button></div></form>
 <div class="cvs-ideas rv">${IDEAS.map(([t,k])=>`<button class="cvs-idea" data-act="cvsIdea" data-q="${esc(t)}">${ic(KIND_IC[k],'ico-s')}<span>${esc(t)}</span></button>`).join('')}</div>
 ${CS.length?`<h4 class="cv-g">Your canvases</h4><div class="cvs-grid rv">${CS.map(c=>`<button class="cvs-card" data-act="cvsOpen" data-id="${c.id}"><span class="cvs-thumb">${c.html?ic('cvs'):ic('ai')}</span><span class="cvs-cb"><b>${esc(c.title)}</b><small>${c.ver.length?`${c.ver.length} version${c.ver.length===1?'':'s'}`:'Nothing built yet'} · ${ago(c.t1)}</small></span>${RUN&&RUN.id===c.id?'<i class="cvs-dot" title="Working"></i>':''}</button>`).join('')}</div>`:''}
 <p class="small muted me-priv">${ic('lock','ico-s')} Canvases are kept on this device. Pages run in a closed box: they can read a snapshot of your data when you allow it, and can’t change anything in the app.${planEngine()==='api'?' Your requests and the page go to the AI server you picked.':''}</p>`}
function msgHTML(c,m){if(m.r==='u')return`<div class="cv-q"><p>${esc(m.x).replace(/\n/g,'<br>')}</p></div>`;
 return`<div class="cv-a${m.err?' cvs-err':''}"><span class="cv-av" aria-hidden="true"></span><div>${m.err?`<p class="small err">${esc(m.x)}</p>`:`<div class="ai-md">${window.AIX&&AIX.md?AIX.md(m.x):esc(m.x)}</div>`}${m.v!=null&&c.ver[m.v]?`<button class="cvs-vtag" data-act="cvsVer" data-id="${c.id}" data-v="${m.v}">${ic('cvs','ico-s')}Version ${m.v+1}${c.vi===m.v?' · showing':''}</button>`:''}</div></div>`}
function runHTML(){if(!RUN)return'';const L=live(RUN.out),secs=Math.round((Date.now()-RUN.t)/1e3);
 return`<div class="cv-a cvs-run" id="cvsRun"><span class="cv-av" aria-hidden="true"></span><div>${L.note?`<div class="ai-md">${window.AIX&&AIX.md?AIX.md(L.note):esc(L.note)}</div>`:''}<p class="cvs-st"><i></i>${L.lines?(L.edit?`Making the change · ${L.lines} lines`:`Writing the page · ${L.lines} lines`):L.thinking?'Thinking…':RUN.out?'Answering…':secs>4?'Waiting for the AI…':'Starting…'}</p></div></div>`}
function logHTML(c){const L=c.msgs.map(m=>msgHTML(c,m)).join('')+runHTML();
 return L||`<div class="cvs-empty"><span class="cvs-orb"></span><p><b>Tell ${esc(nm())} what to build.</b></p><p class="small muted">Then keep going one step at a time: “make the chart weekly”, “add a dark mode”, “put my streaks at the top”.</p></div>`}
function frameHTML(c){if(!c.html)return`<div class="cvs-blank">${RUN&&RUN.id===c.id?`<span class="cvs-orb"></span><p class="muted">Building…</p>`:`${ic('cvs')}<p class="muted">The page shows up here.</p>`}</div>`;
 return`<div class="cvs-fw ${c.w==='phone'?'ph':''}"><iframe class="cvs-fr" data-id="${c.id}" sandbox="${SANDBOX}" title="${esc(c.title)}" referrerpolicy="no-referrer"></iframe></div>`}
function errHTML(c){return FR_ERR&&FR_ERR.id===c.id&&FR_ERR.v===c.vi?`<div class="cvs-ferr"><span>${ic('flag','ico-s')}The page hit an error: ${esc(FR_ERR.x)}</span><button class="btn sm" data-act="cvsFix" data-id="${c.id}">Fix it</button></div>`:''}
function vEdit(id){const c=get(id);if(!c)return`<header class="ph"><div><a class="link" href="#/canvas">${ic('back','ico-s')} Canvas</a><h1>Not found</h1></div></header><p class="muted">This canvas was deleted or is on another device.</p>`;
 const n=c.ver.length,busy=RUN&&RUN.id===c.id;
 return`<div class="cvs" data-tab="${TAB}" id="cvs" data-id="${c.id}">
 <div class="crumb cvs-top"><a href="#/canvas" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a><button class="cvs-ti" data-act="cvsRename" data-id="${c.id}" title="Rename"><b>${esc(c.title)}</b><small id="cvsVl">${n?`Version ${(c.vi??n-1)+1} of ${n}`:'New canvas'}</small></button>
 <div class="ph-r"><button class="ibtn" data-act="cvsUndo" data-id="${c.id}" aria-label="Back one version" title="Back one version" ${n>1&&(c.vi??n-1)>0&&!busy?'':'disabled'}>${ic('undo')}</button><button class="ibtn" data-act="cvsMore" data-id="${c.id}" aria-label="More">${ic('more')}</button></div></div>
 <div class="cvs-tabs" role="tablist">${[['chat','Chat','chat'],['view','Canvas','cvs'],['code','Code','code']].map(([k,t,i])=>`<button role="tab" class="${TAB===k?'on':''}" aria-selected="${TAB===k}" data-act="cvsTab" data-k="${k}">${ic(i,'ico-s')}${t}</button>`).join('')}</div>
 <div class="cvs-body">
  <section class="cvs-chat"><div class="cvs-log" id="cvsLog">${logHTML(c)}</div>${engineHint()}
   <form class="cvs-in" data-form="cvsSend" data-id="${c.id}" autocomplete="off"><textarea id="cvsIn" name="q" rows="1" maxlength="6000" placeholder="${c.html?'What should change?':'What should we build?'}" aria-label="Message"></textarea>
   ${busy?`<button type="button" class="btn sm cvs-go" data-act="cvsStop" aria-label="Stop">${ic('stop')}</button>`:`<button class="btn pri sm cvs-go" aria-label="Send">${ic('send')}</button>`}</form>
   <label class="cvs-data"><input type="checkbox" data-cvsdata="${c.id}" ${c.data?'checked':''}><span>Use my data</span><small>goals, habits, journal, plans, threads, lists</small></label></section>
  <section class="cvs-view"><div class="cvs-bar"><div class="seg-s">${[['full','desk','Full width'],['phone','phone','Phone size']].map(([k,i,t])=>`<button class="ibtn sm ${(c.w||'full')===k?'on':''}" data-act="cvsW" data-id="${c.id}" data-w="${k}" aria-label="${t}" title="${t}">${ic(i)}</button>`).join('')}</div>
   <span class="cvs-sp"></span><button class="ibtn sm" data-act="cvsReload" data-id="${c.id}" aria-label="Run again" title="Run again" ${c.html?'':'disabled'}>${ic('reset')}</button><button class="ibtn sm" data-act="cvsFull" data-id="${c.id}" aria-label="Full screen" title="Full screen" ${c.html?'':'disabled'}>${ic('full')}</button></div>
   <div id="cvsErr">${errHTML(c)}</div><div class="cvs-stage" id="cvsStage">${frameHTML(c)}</div></section>
  <section class="cvs-code"><p class="small muted">The page’s code. Edit it by hand if you like; applying it makes a new version.</p><textarea id="cvsCode" spellcheck="false" autocapitalize="off" aria-label="Page code">${esc(c.html||'')}</textarea>
   <div class="actions left"><button class="btn sm pri" data-act="cvsCodeSave" data-id="${c.id}">Apply my edits</button><button class="btn sm" data-act="cvsCopy" data-id="${c.id}">${ic('copy')}Copy</button></div></section>
 </div></div>${FULL?`<div class="cvs-full" id="cvsFull"><button class="ibtn cvs-fx" data-act="cvsFullX" aria-label="Close full screen">${ic('unfull')}</button><iframe class="cvs-fr" data-id="${c.id}" sandbox="${SANDBOX}" title="${esc(c.title)}"></iframe></div>`:''}`}
function vCanvas(id){if(id)return vEdit(id);if(TAB==='code')TAB='chat';FULL=false;return vList()}
VIEWS.canvas=vCanvas;
VOICE_SEL.push('#cvsIn','#cvsFirst');

/* targeted repaints: a full render reloads the frame, which would reset an app the user is trying out */
function fillFrames(){const c=cur.p==='canvas'&&get(cur.id);if(!c)return;document.querySelectorAll('iframe.cvs-fr').forEach(f=>{const k=c.id+':'+(c.vi??'')+':'+c.html.length;if(f.dataset.k===k)return;f.dataset.k=k;f.srcdoc=docOf(c)})}
function logPaint(stick){const el=$('#cvsLog'),c=get(cur.id);if(!el||!c)return;const near=stick||el.scrollHeight-el.scrollTop-el.clientHeight<120;el.innerHTML=logHTML(c);if(near)el.scrollTop=el.scrollHeight}
let lpT=0;function livePaint(){if(lpT)return;lpT=setTimeout(()=>{lpT=0;const r=$('#cvsRun');if(!r||!RUN)return logPaint();const L=$('#cvsLog'),near=L.scrollHeight-L.scrollTop-L.clientHeight<120;r.outerHTML=runHTML();if(near)L.scrollTop=L.scrollHeight},160)}
function errPaint(){const e=$('#cvsErr'),c=get(cur.id);if(e&&c)e.innerHTML=errHTML(c)}
function paint(){if(cur.p!=='canvas')return;const inp=$('#cvsIn'),keep=inp&&inp.value,foc=document.activeElement===inp;render(false);const n=$('#cvsIn');if(n&&keep){n.value=keep;grow(n)}if(n&&foc)n.focus();logPaint(true)}
const grow=t=>{t.style.height='auto';t.style.height=Math.min(180,t.scrollHeight)+'px'};
{const _r=render;render=function(){const x=_r.apply(this,arguments);if(cur.p==='canvas'&&cur.id){fillFrames();const L=$('#cvsLog');if(L)L.scrollTop=L.scrollHeight}return x}}
document.addEventListener('input',e=>{if(e.target.id==='cvsIn')grow(e.target)});
document.addEventListener('keydown',e=>{if(e.target.id==='cvsIn'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&wide()){e.preventDefault();e.target.form.requestSubmit()}
 if(e.key==='Escape'&&FULL){FULL=false;paint()}});
document.addEventListener('change',e=>{const id=e.target.dataset&&e.target.dataset.cvsdata;if(!id)return;const c=get(id);if(!c)return;c.data=e.target.checked;touch(c);const f=document.querySelectorAll('iframe.cvs-fr');f.forEach(x=>x.dataset.k='');fillFrames();toast(c.data?'The page can read your data':'The page no longer gets your data')});
setInterval(()=>{if(RUN&&cur.p==='canvas'&&cur.id===RUN.id&&!RUN.out)livePaint()},1000);

/* ---------------- actions ---------------- */
function startWith(q){q=String(q||'').trim();if(!q)return;const c=make();TAB='chat';go('canvas/'+c.id);setTimeout(()=>send(c,q),60)}
function setVer(c,i){if(!c.ver[i])return;c.vi=i;c.html=c.ver[i].html;touch(c);FR_ERR=null;paint()}
Object.assign(ACT,{
 cvsNew:()=>{const c=make();TAB='chat';go('canvas/'+c.id);setTimeout(()=>$('#cvsIn')?.focus(),300)},
 cvsIdea:d=>startWith(d.q),
 cvsOpen:d=>{TAB=get(d.id)&&get(d.id).html&&!wide()?'view':'chat';go('canvas/'+d.id)},
 cvsTab:d=>{TAB=d.k;const r=$('#cvs');if(!r)return;r.dataset.tab=TAB;r.querySelectorAll('.cvs-tabs button').forEach(b=>{const on=b.dataset.k===TAB;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});if(TAB==='code'){const c=get(cur.id),t=$('#cvsCode');if(c&&t&&!t.matches(':focus'))t.value=c.html||''}if(TAB==='chat')logPaint(true)},
 cvsStop:()=>{if(RUN)RUN.ctl.abort()},
 cvsW:d=>{const c=get(d.id);if(!c)return;c.w=d.w;touch(c);const w=$('.cvs-fw');if(w)w.classList.toggle('ph',c.w==='phone');document.querySelectorAll('[data-act=cvsW]').forEach(b=>b.classList.toggle('on',b.dataset.w===c.w))},
 cvsReload:()=>{document.querySelectorAll('iframe.cvs-fr').forEach(x=>x.dataset.k='');FR_ERR=null;errPaint();fillFrames()},
 cvsFull:()=>{FULL=true;paint()},cvsFullX:()=>{FULL=false;paint()},
 cvsFix:d=>{const c=get(d.id);if(!c||!FR_ERR)return;const x=FR_ERR.x;FR_ERR=null;errPaint();send(c,`The page shows this error: “${x}”. Please fix it.`)},
 cvsUndo:d=>{const c=get(d.id);if(!c||RUN)return;const i=(c.vi??c.ver.length-1)-1;if(i<0)return;setVer(c,i);toast(`Back to version ${i+1}`,()=>setVer(c,i+1))},
 cvsVer:d=>{const c=get(d.id);if(!c||RUN)return;setVer(c,+d.v);if(!wide())ACT.cvsTab({k:'view'});closeSheet()},
 cvsVers:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>Versions</h2><p class="small muted">Every change is kept. Pick one to show it; asking for a change carries on from the one showing.</p><div class="cvs-vl">${c.ver.map((v,i)=>({v,i})).reverse().map(({v,i})=>`<button class="cvs-vi ${c.vi===i?'on':''}" data-act="cvsVer" data-id="${c.id}" data-v="${i}"><b>Version ${i+1}${c.vi===i?' · showing':''}</b><small>${esc(v.by==='you'?'Your edit':v.note||'Change')} · ${ago(v.t)}</small></button>`).join('')||'<p class="muted">Nothing built yet.</p>'}</div>`)},
 cvsMore:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>${esc(c.title)}</h2><div class="cv-menu">
  <button class="btn" data-act="cvsRename" data-id="${c.id}">${ic('edit')}Rename</button>
  <button class="btn" data-act="cvsVers" data-id="${c.id}" ${c.ver.length?'':'disabled'}>${ic('vers')}Versions (${c.ver.length})</button>
  <button class="btn" data-act="cvsDl" data-id="${c.id}" ${c.html?'':'disabled'}>${ic('dl')}Download as a web page</button>
  <button class="btn" data-act="cvsDup" data-id="${c.id}" ${c.html?'':'disabled'}>${ic('copy')}Make a copy</button>
  <button class="btn" data-act="cvsReset" data-id="${c.id}">${ic('reset')}Reset the canvas</button>
  <button class="btn danger" data-act="cvsDel" data-id="${c.id}">${ic('trash')}Delete</button></div>`)},
 cvsRename:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>Rename</h2><form data-form="cvsName" data-id="${c.id}"><div class="field"><input name="t" maxlength="80" value="${esc(c.title)}" aria-label="Name" required></div><div class="actions"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn pri">Save</button></div></form>`);setTimeout(()=>{const i=$('#sheet input');if(i){i.focus();i.select()}},80)},
 cvsDl:d=>{const c=get(d.id);if(!c||!c.html)return;closeSheet();const withData=c.data&&/PLOT_DATA/.test(c.html);
  download((c.title.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'canvas')+'.html',docOf(c,{file:true,data:withData}),'text/html');toast(withData?'Saved, with a snapshot of the data it uses':'Saved')},
 cvsDup:d=>{const c=get(d.id);if(!c)return;const n={...JSON.parse(JSON.stringify(c)),id:uid(),title:tr(c.title,70)+' copy',named:true,t0:Date.now()};CS.unshift(n);touch(n);closeSheet();go('canvas/'+n.id);toast('Copy made')},
 cvsReset:d=>{const c=get(d.id);if(!c)return;askConfirm('Reset this canvas?','The page, the chat, every version and anything its app saved are cleared. The name stays.','Reset',()=>{if(RUN&&RUN.id===c.id)RUN.ctl.abort();Object.assign(c,{html:'',ver:[],vi:undefined,msgs:[],store:{}});FR_ERR=null;TAB='chat';touch(c);closeSheet();paint();toast('Canvas reset')})},
 cvsDel:d=>{const c=get(d.id);if(!c)return;askConfirm('Delete this canvas?','The page, its versions and its chat are deleted from this device.','Delete',()=>{if(RUN&&RUN.id===c.id)RUN.ctl.abort();const i=CS.indexOf(c);CS=CS.filter(x=>x!==c);persist();closeSheet();if(cur.p==='canvas'&&cur.id===c.id)go('canvas');else render(false);
  toast('Canvas deleted',()=>{CS.splice(Math.max(0,i),0,c);persist();if(cur.p==='canvas')render(false)})})},
 cvsCodeSave:d=>{const c=get(d.id),t=$('#cvsCode');if(!c||!t)return;const v=t.value;if(v===c.html)return toast('No changes');commit(c,v,'Your edit','you');FR_ERR=null;c.msgs.push({id:uid(),r:'a',x:'You edited the code by hand.',v:c.vi,t:Date.now()});ACT.cvsTab({k:wide()?'chat':'view'});fillFrames();logPaint(true);const vl=$('#cvsVl');if(vl)vl.textContent=`Version ${c.vi+1} of ${c.ver.length}`;toast('Applied')},
 cvsCopy:async d=>{const c=get(d.id);if(!c)return;toast(await copyText(c.html||'')?'Code copied':'Copy failed')}
});
Object.assign(FORM,{
 cvsStart:f=>startWith(new FormData(f).get('q')),
 cvsSend:f=>{const c=get(f.dataset.id),t=f.querySelector('textarea'),q=String(t.value||'').trim();if(!c||!q)return;if(window.VC&&VC.el===t&&typeof voiceStop==='function')voiceStop(true);t.value='';grow(t);send(c,q)},
 cvsName:f=>{const c=get(f.dataset.id),t=String(new FormData(f).get('t')||'').trim();if(!c||!t)return;c.title=tr(t,80);c.named=true;touch(c);closeSheet();paint()}
});

/* others (the assistant, the agent, the How-to demos) can start a canvas */
window.CANVAS={list:()=>CS.slice(),get,start:startWith,send:(id,q)=>{const c=get(id);if(c)send(c,q)},plotData,parse,applyEdits,ready:()=>LOADED};

const css=document.createElement('style');css.textContent=`
.cvs-start{margin:4px 0 10px}.cvs-start textarea{min-height:84px}
.cvs-ideas{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.cvs-idea{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:500 13.5px var(--f-body);cursor:pointer;text-align:left}
.cvs-idea:hover,.cvs-idea:focus-visible{border-color:var(--accent)}.cvs-idea .ico-s{color:var(--accent);flex:none}
.cvs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:12px}
.cvs-card{position:relative;display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-align:left;cursor:pointer;min-width:0}
.cvs-card:hover,.cvs-card:focus-visible{border-color:var(--accent)}
.cvs-thumb{width:48px;height:48px;flex:none;border-radius:14px;display:grid;place-items:center;color:var(--accent);background:color-mix(in srgb,var(--accent) 13%,var(--surface))}.cvs-thumb svg{width:24px;height:24px}
.cvs-cb{display:flex;flex-direction:column;gap:2px;min-width:0}.cvs-cb b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cvs-cb small{color:var(--muted);font-size:12.5px}
.cvs-dot{position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:50%;background:var(--accent);animation:meBl 1s ease-in-out infinite}
.cvs-hint{display:flex;gap:6px;align-items:flex-start;margin:6px 2px 8px}.cvs-hint .ico-s{flex:none;margin-top:2px}
.cvs-setup{margin-bottom:12px}
.cvs-top{display:flex;align-items:center;gap:8px}.cvs-top .ph-r{margin-left:auto;display:flex;gap:4px}
.cvs-ti{display:flex;flex-direction:column;align-items:flex-start;min-width:0;flex:1;background:none;border:0;color:var(--ink);text-align:left;cursor:pointer;padding:2px 4px;border-radius:10px}
.cvs-ti b{font:700 18px/1.2 var(--f-body);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cvs-ti small{color:var(--muted);font-size:12px}
.cvs-tabs{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--surface);border:1px solid var(--line);margin:6px 0 10px}
.cvs-tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:0;border-radius:10px;background:none;color:var(--muted);font:600 13.5px var(--f-body);cursor:pointer}
.cvs-tabs button.on{background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--ink)}
.cvs-body{display:block}.cvs-chat,.cvs-view,.cvs-code{display:none}
.cvs[data-tab=chat] .cvs-chat,.cvs[data-tab=view] .cvs-view,.cvs[data-tab=code] .cvs-code{display:flex}
.cvs-chat{flex-direction:column;gap:8px;height:calc(100dvh - 255px);min-height:340px}
.cvs-log{flex:1;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:12px;padding:4px 2px 8px}
.cvs-log .cv-q{align-self:flex-end;max-width:86%;padding:10px 14px;border-radius:18px 18px 6px 18px;background:color-mix(in srgb,var(--accent) 15%,var(--surface))}.cvs-log .cv-q p{margin:0}
.cvs-log .cv-a{display:flex;gap:10px;align-items:flex-start}.cvs-log .cv-a>div{min-width:0;flex:1}
.cvs-vtag{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:600 12px var(--f-body);cursor:pointer}.cvs-vtag:hover{color:var(--ink);border-color:var(--accent)}
.cvs-st{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;margin:4px 0}.cvs-st i{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:meBl 1s ease-in-out infinite}
.cvs-empty{margin:auto;text-align:center;max-width:340px;padding:20px}.cvs-empty p{margin:6px 0}
.cvs-orb{display:block;margin:0 auto 10px;width:44px;height:44px;border-radius:50%;background:conic-gradient(from 0deg,var(--accent),var(--c-learning,var(--accent)),var(--c-health,var(--accent)),var(--accent));animation:mmSpin 2.4s linear infinite}
.cvs-in{display:flex;align-items:flex-end;gap:8px;padding:6px;border-radius:20px;border:1px solid var(--line);background:var(--surface)}
.cvs .cvs-in textarea{flex:1;min-width:0;min-height:0;height:40px;border:0;box-shadow:none;background:none;resize:none;padding:9px 8px;font:15px/1.4 var(--f-body);color:var(--ink);max-height:180px;outline:none}
.cvs-in.has-mic,.cvs-in{padding-right:6px}.cvs-in .mic{position:static;flex:none;transform:none;align-self:flex-end;margin-bottom:2px}.cvs-go{flex:none;min-width:40px;height:40px;padding:0 12px;border-radius:14px}
.cvs-data{display:flex;align-items:center;gap:8px;font-size:13px;padding:0 6px;cursor:pointer}.cvs-data small{color:var(--muted)}.cvs .cvs-data input{appearance:auto;-webkit-appearance:checkbox;width:16px;height:16px;min-height:0;margin:0;padding:0;flex:none;accent-color:var(--accent)}.cvs-data small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cvs-view{flex-direction:column;gap:8px}
.cvs-bar{display:flex;align-items:center;gap:4px}.cvs-bar .seg-s{display:flex;gap:2px;padding:2px;border-radius:12px;border:1px solid var(--line)}.cvs-bar .ibtn.on{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--ink)}.cvs-sp{flex:1}
.cvs-stage{height:calc(100dvh - 300px);min-height:360px;border-radius:20px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 4%,var(--surface));overflow:hidden;display:flex}
.cvs-fw{flex:1;display:flex;justify-content:center;min-width:0}.cvs-fw.ph{padding:12px 0}.cvs-fw.ph iframe{width:390px;max-width:100%;border-radius:24px;box-shadow:0 10px 40px rgba(0,0,0,.18);border:1px solid var(--line)}
.cvs-fr{width:100%;height:100%;border:0;background:#fff;display:block}
.cvs-blank{margin:auto;text-align:center;color:var(--muted)}.cvs-blank svg{width:40px;height:40px;opacity:.5}
.cvs-ferr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:14px;background:color-mix(in srgb,#ff7a7a 14%,var(--surface));font-size:13.5px}.cvs-ferr span{flex:1;min-width:180px;display:flex;gap:6px;align-items:flex-start}
.cvs-code{flex-direction:column;gap:8px}.cvs-code textarea{width:100%;height:calc(100dvh - 300px);min-height:320px;font:12.5px/1.5 var(--f-mono,ui-monospace,monospace);padding:12px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);resize:vertical;white-space:pre;tab-size:2}
.cvs-full{position:fixed;inset:0;z-index:300;background:#fff}.cvs-full iframe{width:100%;height:100%}
.cvs-fx{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;z-index:301;background:rgba(20,20,24,.6);color:#fff;backdrop-filter:blur(10px)}
.cvs-vl{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.cvs-vi{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}.cvs-vi.on{border-color:var(--accent)}.cvs-vi small{color:var(--muted)}
@media(min-width:900px){
 .cvs-tabs{max-width:240px;margin-left:auto}.cvs-tabs button[data-k=chat]{display:none}
 .cvs-body{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:16px;align-items:start}
 .cvs .cvs-chat{display:flex;height:calc(100dvh - 185px)}
 .cvs[data-tab=chat] .cvs-view{display:flex}
 .cvs-stage{height:calc(100dvh - 215px)}.cvs-code textarea{height:calc(100dvh - 275px)}
}
@media(prefers-reduced-motion:reduce){.cvs-orb,.cvs-st i,.cvs-dot{animation:none}}
`;document.head.appendChild(css);
})();
