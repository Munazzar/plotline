/* 1.42: your own activity trackers on the Activity page (meditation, yoga, reading, cycling...).
   - A tracker is {id,n:name,e:emoji,u:unit,g:daily goal (0 = none),st:step for +/-}, kept in S.settings.act.trk.
   - Values live next to the phone's numbers: actLog()[day].cu[id], so they sync the same way.
   - AI help (on-device or your own AI server, whatever is set up): suggests trackers from your goals and habits, and
     reads today's journal, thread notes and day goals to propose values. Nothing is saved until you tap it.
     Without an AI it falls back to plain matching ("yoga 30 min" in a journal entry). */
(()=>{
const trk=()=>{const a=S.settings.act||(S.settings.act={});return a.trk||(a.trk=[])};
const TK=id=>trk().find(t=>t.id===id);
const dayCu=(ds,mk)=>{const L=actLog(),o=L[ds]||(mk?(L[ds]={}):null);if(!o)return null;return o.cu||(mk?(o.cu={}):null)};
const val=(id,ds)=>+((dayCu(ds)||{})[id])||0;
const setVal=(id,ds,v)=>{const c=dayCu(ds,true);v=Math.max(0,Math.round(v*100)/100);if(v)c[id]=v;else delete c[id];const L=actLog();L[ds].u=Date.now();save()};
const UNITS=[['min','minutes'],['times','times'],['km','km'],['pages','pages'],['glasses','glasses'],['reps','reps'],['h','hours']];
const fmtV=(v,u)=>u==='min'?fmtMin(v):u==='h'?(+v).toFixed(v%1?1:0)+' h':(+v).toLocaleString()+(u&&u!=='times'?' '+u:v===1?' time':' times');
const PRESETS=[['🧘','Meditation','min',10,5],['🧘‍♀️','Yoga','min',20,10],['📖','Reading','pages',20,5],['🚴','Cycling','km',10,1],['🏊','Swimming','min',30,10],['🤸','Stretching','min',10,5],['💧','Water','glasses',8,1],['🏋️','Strength','min',30,10],['🎸','Practice an instrument','min',20,10],['🗣️','Language practice','min',20,10],['🐕','Dog walk','min',30,10],['🤲','Prayer','times',5,1]];
const today=()=>ymd();

/* ---------- the card on the Activity page ---------- */
function bars(t){const n=dnum(today()),V=[...Array(7)].map((_,i)=>val(t.id,fromN(n-6+i))),mx=Math.max(t.g||0,...V,1);
 return`<span class="tk-bars" aria-hidden="true">${V.map((v,i)=>`<i class="${t.g&&v>=t.g?'ok':''}${i===6?' td':''}" style="--h:${v?Math.max(8,v/mx*100):0}%"></i>`).join('')}</span>`}
function row(t){const v=val(t.id,today()),p=t.g?Math.min(1,v/t.g):0;
 return`<div class="tk-r" style="--p:${p}"><span class="tk-e">${esc(t.e||'⭐')}</span><button class="tk-m" data-act="tkOpen" data-id="${t.id}"><b>${esc(t.n)}</b><small>${v?fmtV(v,t.u):'Nothing yet today'}${t.g?` · goal ${fmtV(t.g,t.u)}`:''}</small><span class="tk-p"><i></i></span></button>${bars(t)}
 <span class="tk-q"><button class="ibtn sm" data-act="tkAdd" data-id="${t.id}" data-n="-1" aria-label="Less ${esc(t.n)}" ${v?'':'disabled'}>${ic('minus')}</button><button class="ibtn sm tk-plus" data-act="tkAdd" data-id="${t.id}" data-n="1" aria-label="Add ${fmtV(t.st||1,t.u)} of ${esc(t.n)}">${ic('plus')}</button></span></div>`}
function card(){const T=trk(),ai=window.AIX&&AIX.ready&&AIX.ready();
 return`<section class="panel axcard tk rv" id="act-trk"><div class="axh"><span class="act-i">⭐</span><b>Your trackers</b><span class="tk-h">${T.length?`<button class="btn sm ghost" data-act="tkFill">${ic('ai')}Fill in today</button>`:''}<button class="btn sm" data-act="tkNew">${ic('plus')}Add</button></span></div>
 ${T.length?`<div class="tk-l">${T.map(row).join('')}</div>`:`<p class="small muted">Track anything your phone doesn’t: meditation, yoga, reading, cycling, practice. Tap + to log, and ${ai?'your on-device AI':'Plotlines'} can fill in today from your journal.</p><div class="chips tk-pre">${PRESETS.slice(0,6).map(([e,n],i)=>`<button class="chip" data-act="tkPreset" data-i="${i}">${e} ${esc(n)}</button>`).join('')}<button class="chip" data-act="tkSuggest">${ic('ai')}Suggest for me</button></div>`}</section>`}
{const _va=vActivity;vActivity=function(){const o=_va.apply(this,arguments),c=card();
 const i=o.indexOf('<div class="axgrid');if(i>=0){const j=o.indexOf('>',i)+1;return o.slice(0,j)+c+o.slice(j)}
 const h=o.indexOf('</header>');return h>=0?o.slice(0,h+9)+c+o.slice(h+9):c+o};VIEWS.activity=vActivity}

/* ---------- add / edit ---------- */
function form(t){t=t||{n:'',e:'⭐',u:'min',g:0,st:10};const ai=window.AIX&&AIX.ready&&AIX.ready();
 return`<div class="data">Activity</div><h2 style="margin-top:6px">${t.id?'Edit tracker':'Track something new'}</h2>
 ${t.id?'':`<div class="chips tk-pre">${PRESETS.map(([e,n],i)=>`<button type="button" class="chip" data-act="tkPreset" data-i="${i}" data-f="1">${e} ${esc(n)}</button>`).join('')}</div><button type="button" class="link small" data-act="tkSuggest" style="margin:4px 0 6px">${ic('ai')}${ai?'Suggest trackers from my goals and habits':'Suggest from my goals and habits'}</button><div id="tkSug"></div>`}
 <form data-form="tkSave" ${t.id?`data-id="${t.id}"`:''} autocomplete="off"><div class="two"><div class="field" style="flex:0 0 76px"><label>Icon</label><input name="e" maxlength="4" value="${esc(t.e||'⭐')}" style="text-align:center;font-size:20px"></div><div class="field"><label>Name</label><input name="n" maxlength="40" required value="${esc(t.n)}" placeholder="Yoga, reading, cycling…"></div></div>
 <div class="field"><label>Measured in</label><div class="radios sm wrap">${UNITS.map(([k,l])=>`<label><input type="radio" name="u" value="${k}" ${t.u===k?'checked':''}><span>${l}</span></label>`).join('')}</div></div>
 <div class="two"><div class="field"><label>Daily goal · optional</label><input name="g" type="number" min="0" step="any" inputmode="decimal" value="${t.g||''}" placeholder="None"></div><div class="field"><label>Each + adds</label><input name="st" type="number" min="0.1" step="any" inputmode="decimal" value="${t.st||1}"></div></div>
 <div class="actions">${t.id?`<button type="button" class="btn ghost" data-act="tkDel" data-id="${t.id}" style="color:#FF7A7A">${ic('trash')}Delete</button>`:''}<button class="btn pri">${t.id?'Save':'Add tracker'}</button></div></form>`}
function fill(t){const f=$('#sheet form[data-form="tkSave"]');if(!f)return;const E=f.elements;E.e.value=t.e;E.n.value=t.n;const r=f.querySelector(`input[name=u][value="${t.u}"]`);if(r)r.checked=true;E.g.value=t.g||'';E.st.value=t.st||1}
function sheetDay(t){const ds=today(),v=val(t.id,ds);
 openSheet(`<div class="data">${esc(t.e)} Today</div><h2 style="margin-top:6px">${esc(t.n)}</h2><form data-form="tkSet" data-id="${t.id}"><div class="field"><label>Today, in ${esc((UNITS.find(u=>u[0]===t.u)||[,t.u])[1])}</label><input name="v" type="number" min="0" step="any" inputmode="decimal" value="${v||''}" placeholder="0" autofocus></div>
 <div class="tk-wk">${[...Array(7)].map((_,i)=>{const d=fromN(dnum(ds)-6+i),x=val(t.id,d);return`<div><small>${esc(new Date(d+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'}))}</small><b>${x?fmtV(x,t.u).replace(/ (times?|minutes)$/,''):'—'}</b></div>`}).join('')}</div>
 <div class="actions"><button type="button" class="btn ghost" data-act="tkEdit" data-id="${t.id}">${ic('edit')}Edit tracker</button><button class="btn pri">Save</button></div></form>`)}

/* ---------- AI help ---------- */
const aiOn=()=>window.AIX&&AIX.ready&&AIX.ready();
async function ask(sys,user){let out='';await AIX.chat([{role:'system',content:sys},{role:'user',content:user}],t=>{out+=t},{});return out}
const jsonOf=s=>{const m=String(s).match(/\[[\s\S]*\]/);if(!m)return null;try{return JSON.parse(m[0])}catch(e){return null}};
function localSug(){const txt=[...S.goals.filter(g=>g.status==='active').map(g=>g.title),...S.habits.map(h=>h.title)].join(' ').toLowerCase(),have=new Set(trk().map(t=>t.n.toLowerCase()));
 const KW=[[/run|marathon|10k|fit|health|weight/,'Strength'],[/stress|calm|mind|anx|sleep/,'Meditation'],[/read|book/,'Reading'],[/bike|cycl/,'Cycling'],[/swim/,'Swimming'],[/french|ielts|language|english|spanish|study|exam/,'Language practice'],[/pray|faith|quran|bible/,'Prayer'],[/water|hydrat/,'Water'],[/guitar|piano|music|instrument/,'Practice an instrument'],[/flex|back|stretch|posture/,'Stretching'],[/yoga/,'Yoga'],[/dog/,'Dog walk']];
 const out=KW.filter(([r])=>r.test(txt)).map(([,n])=>PRESETS.find(p=>p[1]===n)).filter(p=>p&&!have.has(p[1].toLowerCase()));
 return(out.length?out:PRESETS.filter(p=>!have.has(p[1].toLowerCase()))).slice(0,4).map(([e,n,u,g,st])=>({e,n,u,g,st}))}
async function suggest(){const box=$('#tkSug');if(!box){openSheet(form());return setTimeout(suggest,60)}
 box.innerHTML=`<p class="small muted tk-busy">${ic('ai')}Thinking about your goals and habits…</p>`;let L=null;
 if(aiOn()){try{const goals=S.goals.filter(g=>g.status==='active').slice(0,12).map(g=>'- '+g.title).join('\n'),habs=S.habits.filter(h=>h.status!=='archived').slice(0,12).map(h=>'- '+h.title).join('\n');
  L=jsonOf(await ask('You suggest simple daily activity trackers for a personal goals app. Reply with only a JSON array of up to 4 objects: {"e":"one emoji","n":"short name","u":"min|times|km|pages|glasses|reps|h","g":daily goal number,"st":step number}. Skip things a phone already counts (steps, sleep, screen time).',`My goals:\n${goals||'none'}\nMy habits:\n${habs||'none'}\nAlready tracking: ${trk().map(t=>t.n).join(', ')||'nothing'}`))}catch(e){L=null}}
 L=(Array.isArray(L)?L:[]).filter(x=>x&&x.n).map(x=>({e:String(x.e||'⭐').slice(0,4),n:String(x.n).slice(0,40),u:UNITS.some(u=>u[0]===x.u)?x.u:'min',g:Math.max(0,+x.g||0),st:Math.max(.1,+x.st||1)})).slice(0,4);
 if(!L.length)L=localSug();SUG=L;
 box.innerHTML=`<div class="tk-sug">${L.map((t,i)=>`<button type="button" class="tk-s" data-act="tkSugPick" data-i="${i}"><span>${esc(t.e)}</span><b>${esc(t.n)}</b><small>${t.g?'goal '+esc(fmtV(t.g,t.u)):'no goal'}</small></button>`).join('')}</div><p class="small muted">${aiOn()?'Suggested by your AI from your goals and habits.':'Picked from your goals and habits. Set up on-device AI in Settings › AI & voice for smarter ideas.'}</p>`}
let SUG=[],FILL=[];
/* no AI: the amount nearest the activity's name ("25 min yoga", "read 12 pages"), skipping amounts in the wrong unit */
const UN='(min|minutes|mins|h|hrs?|hours?|km|pages|glasses|reps|times)';
const unitOk=(un,u)=>!un||(/^(min|h)/.test(u)?/^(m|h)/.test(un):un.startsWith(u.slice(0,3)));
function localFill(txt){const out=[];trk().forEach(t=>{const w0=t.n.toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g,''),nm=w0.length>5?w0.slice(0,4):w0;if(!nm)return;const C=[];
 for(const m of txt.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UN}?([^.\\n\\d]{0,24}?)\\b${nm}`,'gi')))C.push({v:+m[1],un:(m[2]||'').toLowerCase(),gap:m[3].length});
 for(const m of txt.matchAll(new RegExp(`\\b${nm}\\w*([^.\\n\\d]{0,24}?)(\\d+(?:\\.\\d+)?)\\s*${UN}?`,'gi')))C.push({v:+m[2],un:(m[3]||'').toLowerCase(),gap:m[1].length});
 const b=C.filter(c=>c.v>0&&unitOk(c.un,t.u)).sort((a,b)=>a.gap-b.gap)[0];if(!b)return;let v=b.v;if(/^h/.test(b.un)&&t.u==='min')v*=60;out.push({id:t.id,v})});return out}
function todayText(){const ds=today(),d0=new Date(ds+'T00:00').getTime(),strip=x=>String(x||'').replace(/<[^>]+>/g,' ');
 const J=S.entries.filter(e=>e.t>=d0&&!e.private&&(e.type==='note'||e.text)).map(e=>strip(e.title)+' '+strip(e.text)),T=(S.threads||[]).flatMap(t=>(t.ups||[]).filter(u=>u.t>=d0).map(u=>t.title+': '+strip(u.x))),D=S.days.filter(x=>x.date===ds&&x.done).map(x=>'Done: '+x.title);
 const W=((actLog()[ds]||{}).w||[]).map(w=>'Workout: '+(typeof wkName==='function'?wkName(w):'')+' '+(w.m||0)+' min');
 return[...J,...T,...D,...W].join('\n').slice(0,4000)}
async function fillToday(){const T=trk();if(!T.length)return;const txt=todayText();
 openSheet(`<div class="data">Fill in today</div><h2 style="margin-top:6px">From what you wrote today</h2><div id="tkFill"><p class="small muted tk-busy">${ic('ai')}${aiOn()?'Reading today’s journal, threads and goals…':'Looking through today’s journal, threads and goals…'}</p></div>`);
 let L=null;if(!txt.trim()){$('#tkFill').innerHTML=`<p class="small muted">Nothing written today yet. Add a journal entry like “30 min yoga, read 15 pages” and try again, or tap + on a tracker.</p><div class="actions"><button class="btn pri" data-act="close">OK</button></div>`;return}
 if(aiOn()){try{L=jsonOf(await ask('You read a person’s notes from today and fill in their activity trackers. Only use amounts the notes clearly state. Reply with only a JSON array of {"id":tracker id,"v":number in the tracker’s unit}. Empty array if nothing matches.',`Trackers:\n${T.map(t=>`${t.id}: ${t.n} (${t.u})`).join('\n')}\n\nToday’s notes:\n${txt}`))}catch(e){L=null}}
 if(!Array.isArray(L))L=localFill(txt);L=L.filter(x=>x&&TK(x.id)&&+x.v>0).map(x=>({id:x.id,v:+x.v}));FILL=L;
 $('#tkFill').innerHTML=L.length?`<div class="tk-sug">${L.map((x,i)=>{const t=TK(x.id),cur=val(t.id,today());return`<button class="tk-s" data-act="tkFillPick" data-i="${i}"><span>${esc(t.e)}</span><b>${esc(t.n)}</b><small>${esc(fmtV(x.v,t.u))}${cur?` · now ${esc(fmtV(cur,t.u))}`:''}</small></button>`}).join('')}</div><p class="small muted">Tap one to save it for today. ${aiOn()?'Found by your AI':'Found by matching your notes'}, so check the numbers.</p><div class="actions"><button class="btn" data-act="close">Close</button><button class="btn pri" data-act="tkFillAll">Save all</button></div>`
  :`<p class="small muted">Couldn’t find amounts for your trackers in today’s notes. Write something like “yoga 20 min” in your journal, or tap + on a tracker.</p><div class="actions"><button class="btn pri" data-act="close">OK</button></div>`}

Object.assign(ACT,{
 tkNew:()=>openSheet(form()),
 tkEdit:d=>{const t=TK(d.id);if(t)openSheet(form(t))},
 tkOpen:d=>{const t=TK(d.id);if(t)sheetDay(t)},
 tkPreset:d=>{const[e,n,u,g,st]=PRESETS[+d.i];if(d.f)return fill({e,n,u,g,st});openSheet(form());setTimeout(()=>fill({e,n,u,g,st}),30)},
 tkSuggest:()=>suggest(),
 tkSugPick:d=>{const t=SUG[+d.i];if(t)fill(t)},
 tkAdd:d=>{const t=TK(d.id);if(!t)return;const v=val(t.id,today())+(+d.n)*(t.st||1);setVal(t.id,today(),v);if(+d.n>0){vib();if(t.g&&v>=t.g&&v-(t.st||1)<t.g)toast(`${esc(t.e)} ${esc(t.n)} · goal reached`)}render(false)},
 tkDel:d=>{const t=TK(d.id);if(!t)return;askConfirm('Delete this tracker?',`“${esc(t.n)}” goes away. What you logged stays in your history.`,'Delete',()=>{S.settings.act.trk=trk().filter(x=>x.id!==t.id);save();closeSheet();render(false)})},
 tkFill:()=>fillToday(),
 tkFillPick:(d,el)=>{const x=FILL[+d.i];if(!x)return;setVal(x.id,today(),x.v);if(el){el.classList.add('done');el.disabled=true}render(false)},
 tkFillAll:()=>{FILL.forEach(x=>setVal(x.id,today(),x.v));closeSheet();render(false);toast('Saved for today')}});
Object.assign(FORM,{
 tkSave:f=>{const E=f.elements,n=E.n.value.trim();if(!n)return;const o={e:(E.e.value.trim()||'⭐').slice(0,4),n,u:(f.querySelector('input[name=u]:checked')||{}).value||'min',g:Math.max(0,+E.g.value||0),st:Math.max(.1,+E.st.value||1)};
  const id=f.dataset.id;if(id)Object.assign(TK(id)||{},o);else trk().push({id:uid(),...o});save();closeSheet();render(false);toast(id?'Saved':`${esc(o.e)} ${esc(n)} added`)},
 tkSet:f=>{setVal(f.dataset.id,today(),+f.elements.v.value||0);closeSheet();render(false)}});

/* for Insights and the assistant */
window.TRK={list:trk,val,fmt:fmtV};

/* ---------- Insights, read by your AI ----------
   A compact digest of the last two weeks goes to whichever AI is set up (on-device by default); it writes three
   specific insights. Kept for the day in S.settings.aiIns; the rule-based insights stay underneath. */
let INS_BUSY=false;
function digest(){const td=today(),tn=dnum(td),A=actLog(),L=[];const av=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
 L.push(`Today is ${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}.${S.settings.name?' Name: '+S.settings.name+'.':''}`);
 S.habits.filter(h=>h.status==='active'&&h.kind!=='quit').slice(0,12).forEach(h=>{let due=0,dn=0;for(let k=tn-7;k<tn;k++){const ds=fromN(k);if(hDue(h,ds)){due++;if(hDone(h,ds))dn++}}L.push(`Habit [habit:${h.id}] "${h.title}": kept ${dn}/${due} of the last 7 days, streak ${typeof hStreak==='function'?hStreak(h):'?'}, ${hDone(h,td)?'done today':'not done today'}.`)});
 S.goals.filter(g=>g.status==='active').slice(0,10).forEach(g=>{const nx=nextStep(g),last=Math.max(dnum(g.startDate||td),...g.steps.filter(s=>s.doneAt).map(s=>dnum(ymd(new Date(s.doneAt)))));L.push(`Goal [goal:${g.id}] "${g.title}": ${pct(g)}% done, ${tn-last} days since progress${nx?`, next step "${nx.title}"${nx.due?' due '+nx.due:''}`:''}.`)});
 const st=k=>av([...Array(7)].map((_,i)=>A[fromN(tn-k-i)]).filter(o=>o&&+o.s>0).map(o=>+o.s)),sl=av([...Array(7)].map((_,i)=>A[fromN(tn-i)]).filter(o=>o&&+o.z>0).map(o=>+o.z)),sc=av([...Array(7)].map((_,i)=>A[fromN(tn-i)]).filter(o=>o&&o.m!=null).map(o=>+o.m));
 if(st(0)!=null)L.push(`Steps: ${Math.round(st(0))} a day this week${st(7)!=null?`, ${Math.round(st(7))} last week`:''}.`);if(sl!=null)L.push(`Sleep: ${fmtMin(sl)} a night on average this week.`);if(sc!=null)L.push(`Screen time: ${fmtMin(sc)} a day.`);
 trk().forEach(t=>{let s=0,hit=0;for(let k=tn-6;k<=tn;k++){const v=val(t.id,fromN(k));s+=v;if(t.g&&v>=t.g)hit++}L.push(`Tracker "${t.n}": ${fmtV(s,t.u)} over 7 days${t.g?`, goal met ${hit}/7 days`:''}.`)});
 const dd=S.days.filter(x=>x.date===td);if(dd.length)L.push(`Today's goals: ${dd.filter(x=>x.done).length} of ${dd.length} done.`);
 S.entries.filter(e=>e.type==='note'&&!e.private&&e.t>Date.now()-14*864e5).sort((a,b)=>b.t-a.t).slice(0,5).forEach(e=>L.push(`Journal ${ymd(new Date(e.t))}${e.mood?' '+e.mood:''}: ${String((e.title||'')+' '+(e.text||'')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,220)}`));
 return L.join('\n')}
async function insRun(){if(INS_BUSY||!aiOn())return;INS_BUSY=true;S.settings.aiInsAuto=1;if(cur.p==='today')render(false);
 try{const raw=await ask('You are Plot, a warm, sharp coach inside a goals, habits and journal app. From the person’s data, write exactly 3 insights they would not easily notice themselves: connect habits, goals, sleep, steps, trackers and what they wrote. Each must cite a concrete number or detail from the data and end with one small doable action. No medical or financial advice, no guilt. Reply with only a JSON array of 3 objects: {"e":"one emoji","t":"the insight, at most 32 words","link":"habit:<id>" or "goal:<id>" from the data, or "","q":"a follow-up question the person might ask you"}.',digest());
  const L=(jsonOf(raw)||[]).filter(x=>x&&x.t).slice(0,3).map(x=>({e:String(x.e||'✨').slice(0,4),t:String(x.t).slice(0,240),link:/^(habit|goal):[\w-]+$/.test(x.link||'')?x.link:'',q:String(x.q||'').slice(0,240)}));
  if(L.length){S.settings.aiIns={d:today(),L,at:Date.now()};save()}else toast('Plot couldn’t read your week just now')}
 catch(e){toast('Plot couldn’t read your week: '+esc(String(e.message||e).slice(0,80)))}
 finally{INS_BUSY=false;if(cur.p==='today')render(false)}}
function aiInsHTML(){const C=S.settings.aiIns,fresh=C&&C.d===today()&&C.L&&C.L.length;
 if(!aiOn())return`<div class="hin ai-ins-off"><span class="hin-e">✨</span><div class="hin-b"><p>Turn on on-device AI and Plot will read your habits, goals, activity and journal each day and point out what you’d miss.</p><div class="hin-a"><a class="btn sm" href="#/settings/voice">Set up AI</a></div></div></div>`;
 if(INS_BUSY)return`<div class="hin ai-ins"><span class="hin-e">✨</span><div class="hin-b"><p class="tk-busy">${ic('ai')}Plot is reading your last two weeks…</p></div></div>`;
 if(!fresh){if(S.settings.aiInsAuto)setTimeout(insRun,1200);return`<div class="hin ai-ins"><span class="hin-e">✨</span><div class="hin-b"><p>Let Plot read your last two weeks and tell you what stands out. It runs ${NATIVE?'on this phone':'with your AI'}; nothing leaves ${NATIVE?'the phone':'your setup'}.</p><div class="hin-a"><button class="btn sm" data-act="aiInsRun">${ic('ai')}Get Plot’s read</button></div></div></div>`}
 const btn=l=>{const[k,id]=l.split(':');return k==='habit'&&H(id)?`<button class="btn sm" data-act="openHabit" data-id="${id}">Open habit</button>`:k==='goal'&&G(id)?`<button class="btn sm" data-act="open" data-id="${id}">Open goal</button>`:''};
 return C.L.map(x=>`<div class="hin ai-ins"><span class="hin-e">${esc(x.e)}</span><div class="hin-b"><p>${esc(x.t)}</p><div class="hin-a">${x.link?btn(x.link):''}${x.q?`<button class="btn sm ghost" data-act="askQ" data-q="${esc(x.q)}">${ic('ai')}Ask about this</button>`:''}</div></div></div>`).join('')+`<div class="ai-ins-f"><span>✨ Plot’s read · ${esc(tShort?tShort(C.at):'')}</span><button class="link" data-act="aiInsRun">Refresh</button></div>`}
ACT.aiInsRun=()=>insRun();
/* tracker insight next to the rule-based ones */
{const _hi=homeInsights;homeInsights=function(){const L=_hi.apply(this,arguments),tn=dnum(today());
 trk().filter(t=>t.g).forEach(t=>{let hit=0;for(let k=tn-7;k<tn;k++)if(val(t.id,fromN(k))>=t.g)hit++;if(hit>=5)L.push({p:5,e:t.e||'⭐',t:`${t.n}: goal met ${hit} of the last 7 days. That’s a habit forming.`,q:`I hit my ${t.n} goal ${hit} of the last 7 days. Should I make it a habit, and how would I keep it going?`});else if(hit<=1&&val(t.id,fromN(tn-1))+val(t.id,today())===0)L.push({p:2,e:t.e||'⭐',t:`${t.n} has been quiet lately (${hit} of 7 days at goal).`,q:`I haven’t done much ${t.n} lately. What’s a tiny version I could do today?`})});
 return L.sort((a,b)=>b.p-a.p).slice(0,3)}}
{const _hh=homeInsightsHTML;homeInsightsHTML=function(){const r=_hh.apply(this,arguments),ai=aiInsHTML();
 if(!r)return`<section class="rv"><div class="st-h"><h3>Insights</h3><button class="link" data-act="askGo">Ask AI</button></div><div class="hins">${ai}</div></section>`;
 return r.replace('<div class="hins">','<div class="hins">'+ai)}}
})();
