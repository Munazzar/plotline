/* ================= Plot's AI: setup, safety, voices and live conversation =================
   - Model setup: the picked on-device model gets a card with its state, a Download button, a progress bar, and then
     the steps that get it ready (load it, read your plan, write a short private profile of you), each shown as it runs.
   - Safety: Plot talks about anything. Two hard lines stay (sexual content involving minors, and help making weapons
     that can kill many people), care when someone may be in danger, and an optional family-safe mode for children.
     Every chat surface says that this is AI and can make mistakes.
   - Actions: any answer can offer to turn what was said into a goal, habit, routine, list, journal entry, reminder,
     goal for today or thread ("ACTION: habit | Read 10 pages"). They show as chips, and in a conversation "yes" does them.
   - Voices: every voice the phone's text-to-speech has (or the browser's), with speed, pitch and a few styles.
   - Live: a full-screen voice conversation with Plot. It listens with room to pause and think, answers out loud,
     then listens again, until you end it. Open it from the assistant, Ask, Home, a long press on the orb, or by
     saying "let's talk". */
(()=>{
'use strict';
const NA=window.PlotlineAssist||null;
const nm=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
Object.assign(IC,{live:'<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10.5v3M21.5 12h-.5"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',micoff:'<path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18"/>',chat:'<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.4A7.5 7.5 0 1 1 20 12.5z"/>',play:'<path d="M8 5.5v13l10.5-6.5z"/>'});

/* ---------------- safety ---------------- */
const SAFE_SYS='You can talk about anything the user wants, openly and without lecturing. Only two hard lines: never write sexual content involving anyone under 18, and never give real help making weapons that can kill many people (biological, chemical, nuclear, or bombs). If the user may be in danger or thinking about hurting themselves, respond with warmth, take them seriously, and gently suggest talking to someone they trust or a crisis line (in the US, call or text 988; elsewhere, findahelpline.com).';
const FAMILY_SYS='Family-safe mode is on: the user may be a child. Keep every answer age-appropriate: no sexual content, no graphic violence, no drugs or alcohol how-tos, nothing frightening. Be kind and encouraging.';
const HARD=[/\b(child|children|kid|kids|minor|minors|underage|under-age|preteen|toddler|little (girl|boy)|(1[0-7]|[1-9])[- ]?(yo|y\/o|year[- ]old))\b.{0,50}\b(sex|sexual|nude|naked|porn|erotic|lewd|explicit)/i,
 /\b(sex|sexual|nude|naked|porn|erotic|lewd|explicit)\b.{0,50}\b(child|children|kid|kids|minor|minors|underage|preteen|toddler|(1[0-7]|[1-9])[- ]?(yo|y\/o|year[- ]old))\b/i,
 /\b(make|build|synthesi[sz]e|produce|manufacture|weaponi[sz]e|culture|grow|enrich|assemble)\b.{0,50}\b(nerve agent|sarin|soman|tabun|vx gas|novichok|anthrax|smallpox|plague|botulinum|ricin|bio-?weapon|chemical weapon|dirty bomb|nuclear (bomb|weapon|device)|pipe ?bomb|ied|car bomb|explosive device|suicide vest)\b/i];
const FAMILY_RX=/\b(porn|sex|sexy|nude|naked|hentai|onlyfans|cocaine|heroin|meth|get high|gore|behead)/i;
const SELF_RX=/\b(kill myself|killing myself|suicid|end my life|end it all|self[- ]harm|cut myself|hurt myself|want to die|don'?t want to (live|be alive|be here))\b/i;
const fam=()=>!!(typeof insSet==='function'&&insSet().family);
function aiSafety(){return SAFE_SYS+(fam()?' '+FAMILY_SYS:'')}
function aiBlock(q){const s=String(q||'');if(HARD.some(r=>r.test(s)))return'I can’t help with that one. Happy to talk about anything else.';if(fam()&&FAMILY_RX.test(s))return'That’s not something I can talk about in family-safe mode. Want to ask me something else?';return''}
const CARE='You don’t have to go through this alone. If you might hurt yourself, please reach out now: in the US call or text 988, or find a line near you at findahelpline.com.';
function aiCare(q,a){return SELF_RX.test(String(q||''))&&!/988|findahelpline|crisis/i.test(String(a||''))?CARE:''}
const NOTE=()=>`${esc(nm())} is AI and can make mistakes. Check anything important.`;
const noteHTML=cls=>`<p class="ai-note ${cls||''}">${ic('ai','ico-s')}<span>${NOTE()}</span></p>`;

/* ---------------- things the AI can offer to make ----------------
   The model ends a reply with lines like "ACTION: habit | Read 10 pages before bed". Each becomes a chip. */
const AK={goal:'Goal',habit:'Habit',routine:'Routine',list:'List',journal:'Journal',reminder:'Reminder',today:'Today',thread:'Thread'};
const ACT_SYS=`When something the user says could become part of their plan in Plotline, offer it, and add one line at the very end of your reply in exactly this form:
ACTION: habit | Read 10 pages before bed
Types: goal (something to achieve), habit (something to do regularly), routine (a short sequence; add | and the steps separated by commas), list (add | and the items separated by commas), journal (the text to save in today's journal), reminder (add | and when, like "tomorrow at 9am"), today (a goal for today), thread (something to keep track of over time). At most two ACTION lines, only when they would really help, and never for things already in their plan.`;
const ACT_RX=/^[ \t>*-]*ACTION\s*:\s*([a-z_ ]+?)\s*\|\s*([^|\n]+?)(?:\s*\|\s*([^\n]*?))?\s*$/gim;
function parseActs(text){const acts=[];const clean=String(text||'').replace(ACT_RX,(m,k,a,b)=>{k=k.toLowerCase().replace(/\s+/g,'');if(k==='todo'||k==='todaygoal')k='today';if(AK[k]&&a.trim()&&acts.length<3)acts.push({id:uid(),k,t:tr(a,120),x:tr(b||'',300),st:''});return''}).replace(/\n{3,}/g,'\n\n').trim();return{clean,acts}}
/* the half-written "ACTI…" line at the end of a streaming answer stays hidden */
const hideActs=s=>String(s||'').replace(ACT_RX,'').replace(/(^|\n)[ \t>*-]*A(?:C(?:T(?:I(?:O(?:N(?:\s*:[^\n]*)?)?)?)?)?)?$/,'$1').replace(/\s+$/,'');
const actLabel=a=>`${AK[a.k]}: ${a.t}`;
function doAct(a){const D=window.PlotDo;let r=null;const t=a.t,x=a.x;
 switch(a.k){
  case'goal':{const g=newGoal({title:t});S.goals.push(g);log('goal-new',g.id,g.title);save();r={say:`Added the goal “${t}”.`,go:'goal/'+g.id,undo:()=>{S.goals=S.goals.filter(y=>y.id!==g.id);save()}};break}
  case'habit':case'routine':{const steps=a.k==='routine'?parseSteps(String(x||'').split(/\s*,\s*|\n/).join('\n'),[]):[];
   const h=normHabit({kind:a.k==='routine'&&steps.length?'routine':'build',title:t,steps,id:uid(),createdAt:Date.now(),startDate:ymd()});S.habits.push(h);save();
   r={say:`Added the ${h.kind==='routine'?'routine':'habit'} “${t}”.`,go:'habit/'+h.id,undo:()=>{S.habits=S.habits.filter(y=>y.id!==h.id);save()}};break}
  case'list':r=D&&D.newList(t,x?D.splitItems(x):[]);break;
  case'journal':r=D&&D.addJournal(x?t+'. '+x:t);break;
  case'today':r=D&&D.addToday(t);break;
  case'thread':r=D&&D.newThread(t);break;
  case'reminder':{const w=D.parseWhen(x?t+' '+x:t);r=D.addReminder(w.found?(w.rest||t):t,w.found?w:{date:addDays(1),time:'09:00'});break}}
 a.st='done';try{render(false)}catch(e){}return r}
const actChips=(acts,act)=>acts.length?`<div class="ai-acts">${acts.map(a=>a.st==='done'?`<span class="ai-act done">${ic('check','ico-s')}${esc(actLabel(a))}</span>`:`<button class="ai-act" data-act="${act||'aiAct'}" data-id="${a.id}">${ic('plus','ico-s')}${esc(actLabel(a))}</button>`).join('')}</div>`:'';
const ACTS=new Map();const keepActs=acts=>{acts.forEach(a=>ACTS.set(a.id,a));return acts};
Object.assign(ACT,{aiAct:(d,el)=>{const a=ACTS.get(d.id);if(!a||a.st)return;let r;try{r=doAct(a)}catch(e){return toast('Couldn’t add that: '+esc(e.message||e))}
 if(el)el.outerHTML=`<span class="ai-act done">${ic('check','ico-s')}${esc(actLabel(a))}</span>`;toast(esc((r&&r.say)||'Added'),r&&r.undo?()=>{r.undo();a.st='';try{render(false)}catch(e){}}:null)}});

/* ---------------- one call to whichever AI is picked ---------------- */
function aiReady(){return window.PlotDo&&PlotDo.aiReady?PlotDo.aiReady():!!planEngine()}
async function aiChat(msgs,onTok,o={}){const e=planEngine();if(!e)throw new Error('Pick an AI in Settings › AI & voice');
 const prev=IN.ctl;if(o.ctl&&!IN.busy)IN.ctl=o.ctl;
 try{if(e==='api')await apiChat(msgs,onTok,o.ctl&&o.ctl.signal,o);else if(e==='native')await natChat(msgs,onTok,o.onP||null,o.reset||null,o);else await localChat(msgs,onTok,o.onP||null,0,o.reset||null,false,o)}
 finally{if(o.ctl&&IN.ctl===o.ctl)IN.ctl=prev}}

/* ---------------- model setup ---------------- */
const MM={busy:false,steps:[],pct:-1,msg:'',err:'',id:''};
function mInfo(){const s=insSet();if(s.engine==='api'||s.engine==='copy'&&!NAT_OK())return null;const m=llmOf(s.llm),rt=lrtOn()?'lrt':NAT_OK()?'native':'wasm';
 return{s,m,rt,name:String(m[1]).split(' · ')[0],gb:rt==='native'?(m[5]||m[3]):m[3]}}
function mHave(i){i=i||mInfo();if(!i)return true;if(i.rt==='native')return natHave(i.m);return!!(i.s.dl||{})[i.m[0]]}
const counts=()=>{const n=S.entries.filter(e=>e.type==='note').length;return`${S.goals.length} goal${S.goals.length===1?'':'s'}, ${S.habits.length} habit${S.habits.length===1?'':'s'}, ${n} journal entr${n===1?'y':'ies'}`};
function mmSteps(i){return[['dl',`Download ${i.name} (${i.gb} GB, once)`],['load','Load it into memory'],['read',`Read your plan: ${counts()}`],['prof','Write a short private profile of you'],['ok','Ready to talk']].map(([k,t])=>({k,t,st:''}))}
function mmPaint(){document.querySelectorAll('.mm').forEach(el=>{const w=el.dataset.w||'';el.outerHTML=modelCard(w)})}
const mbOf=s=>{const m=/(\d+)\s+of\s+(\d+)\s*MB/.exec(String(s||''));return m?[+m[1],+m[2]]:null};
function mmProg(t){const mb=mbOf(t);MM.msg=String(t||'').replace(/\s*·\s*once, then offline/,'');if(mb&&mb[1])MM.pct=Math.min(100,Math.round(mb[0]/mb[1]*100));const b=document.querySelector('.mm .mm-bar i'),p=document.querySelector('.mm .mm-msg');if(b&&MM.pct>=0)b.style.width=MM.pct+'%';if(p)p.textContent=MM.msg;else mmPaint()}
async function mmDownload(i){const m=i.m;
 if(i.rt==='native'){const f=natFile(m);if(!natHave(m)){if(!(natSt().dl||{}).busy)NATIVE.llmDownload(m[4]||m[2],f);
   for(;;){await sleep(700);const st=natSt();if(st.have&&st.have[f])break;const d=st.dl||{};if(!d.busy&&d.err)throw new Error('The download stopped ('+d.err+'). Check your connection and try again.');
    mmProg(`Downloading · ${Math.round((d.loaded||0)/1048576)} of ${d.total?Math.round(d.total/1048576):Math.round(i.gb*1024)} MB`)}}}
 else if(i.rt==='lrt'){if(!(await lrtHave(m)))await lrtDownload(m,mmProg)}
 else await localLLM(mmProg);
 const s=insSet();s.dl={...(s.dl||{}),[m[0]]:1};save()}
async function mmLoad(i){if(i.rt==='native')await natEnsure(i.m,mmProg);else if(i.rt==='lrt')await lrtEngine(mmProg);else await localLLM(mmProg)}
async function mmProfile(){if(!S.goals.length&&!S.habits.length&&!S.entries.length)return'skip';let out='';
 await aiChat([{role:'system',content:'You write a short private profile of a person from their own goals, habits, moods and journal, so an assistant can know them. Four or five plain sentences: what they are working towards, their routines and habits, how they have been feeling, and what seems to matter to them. Facts only from the data. No lists, no markdown.'},{role:'user',content:insOverview(2400,'')}],x=>{out+=x},{max_tokens:260,temperature:.3,reading:'Writing your profile…',onP:mmProg});
 out=out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/[*#_`]/g,'').trim();if(out.length>40){insSet().profile={t:Date.now(),text:tr(out,900)};save()}return out}
async function mmRun(o={}){if(MM.busy)return;const i=mInfo();if(!i)return;MM.busy=true;if(!IN.busy)IN.ctl=new AbortController();MM.err='';MM.id=i.m[0];MM.steps=mmSteps(i);MM.pct=-1;MM.msg='';mmPaint();
 const step=async(k,fn)=>{const x=MM.steps.find(y=>y.k===k);x.st='on';MM.pct=-1;MM.msg='';mmPaint();try{const r=await fn();x.st=r==='skip'?'skip':'done'}catch(e){x.st='err';throw e}mmPaint()};
 try{await step('dl',()=>mHave(i)?'skip':mmDownload(i));await step('load',()=>mmLoad(i));
  await step('read',async()=>{const docs=ragDocs();mmProg(`Read ${docs.length} passages from your goals, habits and journal`);if(insSet().smart)await ensureVecs(docs,mmProg);await sleep(400)});
  await step('prof',async()=>{try{return await mmProfile()}catch(e){return'skip'}});await step('ok',async()=>{});
  toast(`${esc(i.name)} is ready. ${o.quiet?'':'Talk to '+esc(nm())+' any time.'}`)}
 catch(e){MM.err=String(e&&e.message||e)}
 finally{MM.busy=false;mmPaint();try{if(typeof askSetRefresh==='function')askSetRefresh()}catch(e){}if(typeof o.then==='function'&&!MM.err)o.then()}}
function modelCard(w){const i=mInfo();if(!i)return'';const have=mHave(i),busy=MM.busy&&MM.id===i.m[0],s=i.s,pr=s.profile;
 const where=i.rt==='native'?'runs on this phone':i.rt==='lrt'?'runs on this device’s GPU':'runs in this '+(NATIVE?'app':'browser');
 const tag=busy?'Setting up':MM.err&&MM.id===i.m[0]?'Needs attention':have?'Ready':'Not downloaded';
 let body='';
 if(busy||MM.err&&MM.id===i.m[0]&&MM.steps.length){body=`<ol class="mm-st">${MM.steps.map(x=>`<li class="${x.st}"><i>${x.st==='done'?ic('check','ico-s'):x.st==='err'?'!':x.st==='skip'?'–':''}</i><span>${esc(x.t)}</span></li>`).join('')}</ol>${busy?`<div class="mm-bar ${MM.pct<0?'ind':''}"><i style="width:${MM.pct<0?30:MM.pct}%"></i></div><p class="small muted mm-msg">${esc(MM.msg||'Working…')}</p>`:''}${MM.err&&!busy?`<p class="small err">${esc(MM.err)}</p>`:''}`}
 else if(!have)body=`<p class="small muted">Not on this ${NATIVE?'phone':'device'} yet. It’s a ${i.gb} GB download from Hugging Face, once, then it works offline and nothing you say leaves the ${NATIVE?'phone':'device'}. Use Wi-Fi.</p>`;
 else body=`<p class="small muted">Downloaded and ${where}. ${pr?'It has read your plan and keeps a short private profile of you.':'Set it up to let it read your plan and get to know you.'}</p>${pr&&w!=='live'?`<details class="mm-pr"><summary>What ${esc(nm())} knows about you</summary><p class="small">${esc(pr.text)}</p></details>`:''}`;
 const btns=busy?'':!have?`<button class="btn pri sm" data-act="mmGo">${ic('down')}Download and set up</button>`:MM.err&&MM.id===i.m[0]?`<button class="btn pri sm" data-act="mmGo">Try again</button>`:`${w==='live'?'':`<button class="btn sm ghost" data-act="mmGo">${pr?'Read my plan again':'Set it up'}</button><button class="btn sm ghost" data-act="insDelModel">Delete from this ${NATIVE?'phone':'device'}</button>`}`;
 return`<div class="mm" data-w="${w||''}"><div class="mm-h"><span class="mm-ic">${ic('ai')}</span><span class="mm-t"><b>${esc(i.name)}</b><small>${esc(i.gb+' GB · '+where)}</small></span><span class="mm-tag ${have&&!busy?'ok':''}">${tag}</span></div>${body}${btns?`<div class="actions left">${btns}</div>`:''}</div>`}
Object.assign(ACT,{mmGo:()=>mmRun()});
/* other parts of the app ask: is it ready, and if not, show this card */
window.AIX={safety:aiSafety,block:aiBlock,care:aiCare,note:noteHTML,parseActs,hideActs,actChips,keepActs,doAct,actLabel,chat:aiChat,modelCard,setup:mmRun,ready:()=>aiReady()&&!MM.busy,ACT_SYS};

/* ---------------- voices ---------------- */
const VSTY=[['natural','Natural',1,1],['calm','Calm',.9,.94],['bright','Bright',1.05,1.15],['deep','Deep',.95,.8],['quick','Quick',1.25,1.02]];
const vpick=()=>{const a=S.settings.assist||{};return{voice:a.voice||'',rate:+a.rate||1,pitch:+a.pitch||1,all:!!a.vall}};
let VL=null;
function voiceList(){if(NA&&NA.voices){let j='';try{j=NA.voices()}catch(e){}if(!j)return null;try{return JSON.parse(j).map(v=>({n:v.n,l:v.l,q:v.q,net:v.net}))}catch(e){return[]}}
 if(window.speechSynthesis){const v=speechSynthesis.getVoices();if(!v.length)return null;return v.map(x=>({n:x.name,l:x.lang,q:x.localService?300:400,net:!x.localService}))}return[]}
if(window.speechSynthesis&&!NA)try{speechSynthesis.onvoiceschanged=()=>{VL=null;if(document.getElementById('vpPanel'))render(false)}}catch(e){}
window.addEventListener('plot-voices',()=>{VL=null;if(document.getElementById('vpPanel'))render(false)});
const lname=l=>{try{return new Intl.DisplayNames([navigator.language||'en'],{type:'language'}).of(l)}catch(e){return l}};
function vName(v,i){if(!NA)return v.n;const m=/^([a-z]{2,3})-([a-z]{2,3})-x-([a-z]{3})/i.exec(v.n);return`${lname(v.l)} · ${m?m[3].toUpperCase():'Voice '+(i+1)}`}
function voicePickHTML(){const p=vpick(),lang=(vset().lang||navigator.language||'en').toLowerCase().split('-')[0];if(!VL)VL=voiceList();
 const L=(VL||[]).filter(v=>p.all||String(v.l).toLowerCase().startsWith(lang)).sort((a,b)=>(a.net-b.net)||(b.q-a.q)||a.n.localeCompare(b.n)).slice(0,80),sty=VSTY.find(x=>Math.abs(x[2]-p.rate)<.01&&Math.abs(x[3]-p.pitch)<.01);
 return`<section class="panel rv" id="vpPanel"><h3>${esc(nm())}’s voice</h3><p class="small muted">How ${esc(nm())} sounds when it talks back. Tap ${ic('play','ico-s')} to hear one.</p>
 <div class="chips vp-sty">${VSTY.map(([k,n,r,pi])=>`<button class="chip ${sty&&sty[0]===k?'on':''}" data-act="vpStyle" data-r="${r}" data-p="${pi}">${n}</button>`).join('')}</div>
 <div class="two"><div class="field"><label>Speed · <output id="vpR">${p.rate.toFixed(2)}×</output></label><input type="range" min="0.6" max="1.6" step="0.05" value="${p.rate}" data-vp="rate"></div><div class="field"><label>Pitch · <output id="vpP">${p.pitch.toFixed(2)}</output></label><input type="range" min="0.6" max="1.5" step="0.05" value="${p.pitch}" data-vp="pitch"></div></div>
 ${VL===null?`<p class="small muted">Loading the voices on this ${NATIVE?'phone':'device'}…</p>`:L.length?`<div class="vp-l" role="radiogroup" aria-label="Voice"><label class="vp-r"><input type="radio" name="vpV" value="" ${p.voice?'':'checked'} data-vp="voice"><span><b>Default</b><small>The ${NATIVE?'phone':'browser'}’s usual voice for this language</small></span><button class="ibtn sm" data-act="vpHear" data-v="" aria-label="Hear the default voice">${ic('play')}</button></label>${L.map((v,i)=>`<label class="vp-r"><input type="radio" name="vpV" value="${esc(v.n)}" ${p.voice===v.n?'checked':''} data-vp="voice"><span><b>${esc(vName(v,i))}</b><small>${esc([NA?'':lname(v.l),v.net?'Needs internet':'Works offline',v.q>=400?'High quality':''].filter(Boolean).join(' · '))}</small></span><button class="ibtn sm" data-act="vpHear" data-v="${esc(v.n)}" aria-label="Hear this voice">${ic('play')}</button></label>`).join('')}</div>`:`<p class="small muted">No voices found for this language.</p>`}
 <label class="sw"><span>Show voices in every language<small>${VL?VL.length+' voices on this '+(NATIVE?'phone':'device'):''}</small></span><input type="checkbox" data-vp="all" ${p.all?'checked':''}><i></i></label>
 ${NA&&NA.openTtsSettings?`<div class="actions left"><button class="btn sm ghost" data-act="vpMore">Get more voices</button></div><p class="small muted">Opens Android’s text-to-speech settings. In Google’s speech engine, Install voice data adds more voices and languages.</p>`:''}</section>`}
{const _vh=voiceHTML;voiceHTML=function(){return _vh()+voicePickHTML()}}
const vpSave=o=>{S.settings.assist={...(S.settings.assist||{}),...o};save()};
function hear(v){const p=vpick();const t=`Hi, I’m ${nm()}. This is how I sound.`;if(window.PLOT_ASSIST&&PLOT_ASSIST.say)PLOT_ASSIST.say(t,null,{voice:v,rate:p.rate,pitch:p.pitch})}
Object.assign(ACT,{vpHear:(d,el,ev)=>{ev&&ev.preventDefault();hear(d.v||'')},vpStyle:d=>{vpSave({rate:+d.r,pitch:+d.p});render(false);setTimeout(()=>hear(vpick().voice),150)},vpMore:()=>{try{NA.openTtsSettings()}catch(e){}}});
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.vp)return;if(t.dataset.vp==='rate'){const o=$('#vpR');if(o)o.textContent=(+t.value).toFixed(2)+'×'}if(t.dataset.vp==='pitch'){const o=$('#vpP');if(o)o.textContent=(+t.value).toFixed(2)}});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.vp)return;const k=t.dataset.vp;
 if(k==='voice'){vpSave({voice:t.value});hear(t.value);return}if(k==='rate'||k==='pitch'){vpSave({[k]:+t.value});hear(vpick().voice);return}if(k==='all'){vpSave({vall:t.checked});render(false)}});

/* ---------------- Live: a voice conversation ---------------- */
const LV={open:false,st:'idle',hist:[],pend:[],muted:false,gen:0,ctl:null,you:'',ai:'',typing:false};
const LV_SYS=()=>{const s=insSet(),pr=s.profile&&s.profile.text,name=S.settings.name;return`You are ${nm()}, ${name?name+'’s':'the user’s'} friendly, curious companion inside Plotline, their app for goals, habits, routines, a journal, lists and threads. You are in a live voice conversation, so talk like a real person: warm, natural, one to three short sentences, no lists, no markdown, no emojis. Ask a short follow-up question when it keeps the conversation going, and give people room to think. Talk about anything they bring up: their day, feelings, ideas, plans, questions about the world, advice. Use the DATA about them when it helps, and never invent facts about them.${pr?`\n\nWHAT YOU KNOW ABOUT THEM\n${pr}`:''}\n\n${ACT_SYS} In your spoken sentence, ask before adding, like "Want me to make that a habit?".\n\n${aiSafety()}`};
const BYE=/^(?:ok(?:ay)?\s*,?\s*)?(?:bye|goodbye|good bye|see you|see ya|talk (?:to you )?later|that'?s all|that'?s it|i'?m done|we'?re done|end (?:the )?(?:conversation|chat|call)|stop (?:talking|listening|the conversation)|goodnight|good night)\b/i;
const YES=/^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|please|please do|do it|go ahead|add (?:it|them|that|those|both)|sounds good|let'?s do it|absolutely|of course|definitely)\b/i;
const NO=/^(?:no|nope|nah|not now|no thanks|don'?t|skip it|never ?mind)\b/i;
function lvEl(){let el=$('#live');if(el)return el;el=document.createElement('div');el.id='live';el.className='lv';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Talk with '+nm());
 el.innerHTML=`<div class="lv-glow" aria-hidden="true"></div><header class="lv-h"><span class="lv-nm"><b></b><small id="lvSt"></small></span><button class="ibtn" data-act="lvChat" aria-label="Open as chat" title="Open as chat">${ic('chat')}</button><button class="ibtn" data-act="lvEnd" aria-label="End conversation" title="End">✕</button></header>
 <div class="lv-mid"><button class="lv-orb" id="lvOrb" data-act="lvOrb" aria-label="Talk"><span class="lv-o1"></span><span class="lv-o2"></span><span class="lv-o3"></span></button><p class="lv-hint" id="lvHint"></p></div>
 <div class="lv-cap" id="lvCap" aria-live="polite"></div>
 <form class="lv-type" data-form="lvSend" autocomplete="off" hidden><input id="lvTxt" maxlength="600" placeholder="Type instead…" enterkeyhint="send"><button class="btn pri sm">Send</button></form>
 <div class="lv-ctl"><button class="lv-b" data-act="lvMute" id="lvMute" aria-label="Mute the mic">${ic('mic')}</button><button class="lv-b lv-end" data-act="lvEnd" aria-label="End">End</button><button class="lv-b" data-act="lvType" aria-label="Type instead">${ic('kb')}</button></div>
 ${noteHTML('lv-note')}<input id="lvIn" type="text" tabindex="-1" aria-hidden="true" class="lv-hid">`;
 document.body.appendChild(el);return el}
function lvState(st,hint){LV.st=st;const el=$('#live');if(!el)return;el.dataset.st=st;el.querySelector('.lv-nm b').textContent=nm();
 $('#lvSt').textContent={listen:'Listening… take your time',think:'Thinking…',speak:'Speaking',idle:LV.muted?'Mic is off':'Tap the orb to talk',setup:'Getting ready'}[st]||'';
 $('#lvHint').textContent=hint!=null?hint:st==='listen'?'Tap the orb when you’re done':st==='speak'?'Tap the orb to interrupt':st==='think'?'':LV.muted?'Turn the mic on to talk':'';
 const m=$('#lvMute');if(m){m.innerHTML=ic(LV.muted?'micoff':'mic');m.classList.toggle('off',LV.muted)}}
function lvCap(){const c=$('#lvCap');if(!c)return;const ready=aiReady()&&!MM.busy;
 c.innerHTML=`${LV.you?`<p class="lv-you">${esc(LV.you)}</p>`:''}${LV.ai?`<p class="lv-ai">${esc(LV.ai)}</p>`:''}${actChips(LV.pend,'lvAct')}${ready||LV.you||LV.ai?'':modelCard('live')||''}`;c.scrollTop=c.scrollHeight}
function liveOpen(first){if(window.PLOT_ASSIST&&PLOT_ASSIST.close)PLOT_ASSIST.close();const el=lvEl();LV.open=true;LV.you='';LV.ai=aiReady()?'':`To talk about anything, ${nm()} needs its AI on this ${NATIVE?'phone':'device'}. You can still ask me to add things.`;LV.pend=[];
 document.documentElement.classList.add('lv-on');requestAnimationFrame(()=>el.classList.add('on'));try{NA&&NA.wakePause&&NA.wakePause(true)}catch(e){}lvState('idle');lvCap();
 if(first)setTimeout(()=>lvHeard(first),350);else if(!aiReady()&&!MM.busy)lvState('idle','');else setTimeout(()=>lvGreet(),350)}
function lvGreet(){const h=new Date().getHours(),n=S.settings.name;const g=LV.hist.length?'I’m listening.':`${h<12?'Good morning':h<17?'Hey':'Good evening'}${n?', '+n:''}. What’s on your mind?`;LV.ai=g;lvCap();lvSay(g)}
function liveClose(){if(!LV.open)return;LV.open=false;LV.gen++;if(document.querySelector('.vdlg')&&ACT.vcNo)ACT.vcNo();try{LV.ctl&&LV.ctl.abort()}catch(e){}if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);if(window.PLOT_ASSIST)PLOT_ASSIST.hush();
 const el=$('#live');document.documentElement.classList.remove('lv-on');if(el){el.classList.remove('on');setTimeout(()=>{if(!LV.open)el.remove()},380)}try{NA&&NA.wakePause&&NA.wakePause(false)}catch(e){}}
function lvListen(){if(!LV.open||LV.muted)return lvState('idle');if(typeof voiceAvail==='function'&&!voiceAvail()){LV.typing=true;$('.lv-type').hidden=false;lvState('idle','Voice isn’t available here. Type instead.');return}
 if(window.PLOT_ASSIST)PLOT_ASSIST.hush();const i=$('#lvIn');i.value='';LV.you='';lvCap();lvState('listen');if(window.asCue)asCue('start');voiceStart(i,$('#lvOrb'))}
/* after the voice loop closes: what was said goes to the conversation; nothing heard leaves the orb waiting */
{const _vx=voiceStop;voiceStop=function(silent,keep){const c=VC;_vx(silent,keep);if(!c||!c.el||c.el.id!=='lvIn')return;try{NA&&NA.wakePause&&NA.wakePause(LV.open)}catch(e){}
 const v=c.el.value.trim();c.el.value='';if(!LV.open)return;if(keep&&v)lvHeard(v);else if(LV.st==='listen')lvState('idle',silent?'':'I didn’t hear anything. Tap the orb to talk.')}}
/* the words as they're heard */
document.addEventListener('input',e=>{if(e.target&&e.target.id==='lvIn'&&LV.open){LV.you=e.target.value;const c=$('#lvCap');if(c){let p=c.querySelector('.lv-you');if(!p){c.innerHTML='<p class="lv-you"></p>'}c.querySelector('.lv-you').textContent=LV.you}}});
function lvSay(text,then){const t=String(text||'').trim();if(!t||!LV.open)return then?then():lvListen();lvState('speak');
 if(window.PLOT_ASSIST&&PLOT_ASSIST.say)PLOT_ASSIST.say(t,()=>{if(!LV.open)return;if(LV.st==='speak')(then||lvListen)()});else(then||lvListen)()}
async function lvHeard(text){const g=++LV.gen,t=String(text).trim();if(!t)return lvListen();LV.you=t;LV.ai='';lvCap();lvState('think');
 const done=(say,acts,extra)=>{if(g!==LV.gen||!LV.open)return;LV.ai=say;if(acts)LV.pend=keepActs(acts);lvCap();LV.hist.push({role:'user',content:t},{role:'assistant',content:say});LV.hist=LV.hist.slice(-12);
  try{PLOT_ASSIST.addTurn(t,say)}catch(e){}if(extra==='bye'){lvSay(say,()=>liveClose());return}lvSay(say)};
 if(BYE.test(t))return done(['Bye for now.','Talk soon.','Okay, bye!'][Math.floor(Math.random()*3)],[],'bye');
 const blocked=aiBlock(t);if(blocked)return done(blocked,[]);
 /* "yes" to what was offered */
 const open=LV.pend.filter(a=>!a.st);if(open.length&&YES.test(t)){const said=[];open.forEach(a=>{try{const r=doAct(a);said.push(actLabel(a).toLowerCase())}catch(e){}});LV.pend=[...LV.pend];return done(`Done. I added the ${said.join(' and the ')}.`,LV.pend)}
 if(open.length&&NO.test(t)&&t.split(/\s+/).length<=4){LV.pend=[];return done('Okay, I’ll leave it.',[])}
 /* clear commands: "add milk to my groceries list", "remind me at 6 to call mom" */
 try{const r=PLOT_ASSIST.command(t);if(r&&r.say)return done(r.say,[])}catch(e){}
 if(!aiReady()){const L=PLOT_ASSIST.lookup(t);return done(L&&L.say?L.say:`I can add things to your plan right now. To talk about anything, set up ${nm()}’s AI first.`,[])}
 const ctl=LV.ctl=new AbortController();let out='';
 try{const q=t;let ctx='';try{const r=await ragRetrieve(q,{win:0,goal:'',broad:insFocus(q).broad},null);ctx=PLOT_ASSIST.ctx(q,r,'',planEngine()==='api')}catch(e){ctx='QUESTION\n'+q}
  const msgs=[{role:'system',content:LV_SYS()},...LV.hist.slice(-8),{role:'user',content:`DATA ABOUT ME (use only if it helps)\n${ctx.replace(/\nQUESTION\n[\s\S]*$/,'')}\n\nWHAT I JUST SAID\n${q}`}];
  await aiChat(msgs,x=>{if(g!==LV.gen)return;out+=x;const v=hideActs(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,''));if(v){LV.ai=v;const c=$('#lvCap');const p=c&&c.querySelector('.lv-ai');if(p)p.textContent=v;else lvCap()}},{ctl,max_tokens:planEngine()==='api'?400:260,temperature:.7,reading:'Thinking…',onP:x=>{if(x&&g===LV.gen)lvState('think',x)},reset:()=>{out=''}})}
 catch(e){if(g!==LV.gen)return;if(e&&e.name==='AbortError')return;return done('Sorry, I couldn’t think that through: '+(e&&e.message||e),[])}
 if(g!==LV.gen)return;const P=parseActs(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/[*#_`]/g,''));let say=P.clean.replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'').trim()||'Hmm, I’m not sure. Can you say that another way?';const care=aiCare(t,say);if(care)say+=' '+care;done(say,P.acts)}
Object.assign(ACT,{
 liveOpen:()=>liveOpen(),lvEnd:()=>liveClose(),
 lvOrb:()=>{if(LV.st==='listen'){if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(false,true);return}if(LV.st==='speak'){if(window.PLOT_ASSIST)PLOT_ASSIST.hush();lvListen();return}if(LV.st==='think'){LV.gen++;try{LV.ctl&&LV.ctl.abort()}catch(e){}lvState('idle','Stopped. Tap to talk.');return}if(LV.muted){LV.muted=false}lvListen()},
 lvMute:()=>{LV.muted=!LV.muted;if(LV.muted&&VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);lvState(LV.st==='listen'?'idle':LV.st);if(!LV.muted&&LV.st==='idle')lvListen()},
 lvType:()=>{const f=$('.lv-type');if(!f)return;f.hidden=!f.hidden;if(!f.hidden){LV.muted=true;if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);lvState('idle','');setTimeout(()=>$('#lvTxt').focus(),50)}},
 lvChat:()=>{liveClose();setTimeout(()=>{if(window.ACT.asOpen)ACT.asOpen()},380)},
 lvAct:(d,el)=>{const a=LV.pend.find(x=>x.id===d.id);if(!a||a.st)return;try{const r=doAct(a);toast(esc((r&&r.say)||'Added'))}catch(e){toast('Couldn’t add that')}lvCap()}});
Object.assign(FORM,{lvSend:f=>{const i=f.querySelector('input'),v=i.value.trim();if(!v)return;i.value='';lvHeard(v)}});
window.liveOpen=liveOpen;
{const _b=window.__back;window.__back=()=>{if(LV.open){liveClose();return true}return _b?_b():false}}
window.addEventListener('hashchange',()=>{if(LV.open)liveClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&LV.open)liveClose()});
/* a long press on the orb in the top bar starts a conversation */
{let lp=0,lpx=null;document.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('.as-btn');if(!b)return;lpx=b;clearTimeout(lp);lp=setTimeout(()=>{lpx=null;vib();liveOpen()},520)},true);
 ['pointerup','pointercancel','pointerleave'].forEach(k=>document.addEventListener(k,()=>clearTimeout(lp),true));
 document.addEventListener('click',e=>{if(!lpx&&e.target.closest&&e.target.closest('.as-btn')&&LV.open){e.stopPropagation();e.preventDefault()}},true)}
/* Home: a way in */
if(typeof homeTop==='function'){const _ht=homeTop;homeTop=function(){return _ht()+`<button class="lv-home rv" data-act="liveOpen"><span class="lv-hor" aria-hidden="true"></span><span><b>Talk it through with ${esc(nm())}</b><small>A voice conversation about anything. ${esc(nm())} can turn it into goals, habits and lists.</small></span>${ic('live')}</button>`}}
/* routes from the widget or a shortcut: assistant-live */
{const _r=window.__route;window.__route=r=>{if(r==='assistant-live'){liveOpen();return}return _r&&_r(r)}}

const css=document.createElement('style');css.textContent=`
.ai-note{display:flex;align-items:center;gap:6px;justify-content:center;margin:8px 0 0;font-size:11.5px;line-height:1.3;color:var(--muted);text-align:center}.ai-note svg{width:13px;height:13px;flex:none;opacity:.8}
.ai-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ai-act{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border-radius:18px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--text);font:600 13px var(--f-body);cursor:pointer;text-align:left}
.ai-act svg{width:15px;height:15px;flex:none;color:var(--accent)}.ai-act.done{opacity:.7;cursor:default;border-style:dashed}
.mm{border:1px solid var(--line);border-radius:18px;padding:14px;margin:12px 0;background:color-mix(in srgb,var(--accent) 5%,var(--surface))}
.mm-h{display:flex;align-items:center;gap:10px}.mm-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;flex:none;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}.mm-ic svg{width:20px;height:20px}
.mm-t{flex:1;min-width:0;display:flex;flex-direction:column}.mm-t b{font-size:15px}.mm-t small{color:var(--muted);font-size:12px}
.mm-tag{flex:none;font:700 11px var(--f-body);padding:4px 9px;border-radius:10px;background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--muted)}.mm-tag.ok{background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent)}
.mm p{margin:10px 0 0}.mm .actions{margin-top:12px}
.mm-st{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}.mm-st li{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--muted)}
.mm-st li i{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;flex:none;border:1.5px solid color-mix(in srgb,var(--text) 22%,transparent);font:700 11px var(--f-body);font-style:normal}
.mm-st li.on{color:var(--text);font-weight:600}.mm-st li.on i{border-color:var(--accent);border-top-color:transparent;animation:mmSpin .8s linear infinite}
.mm-st li.done,.mm-st li.skip{color:var(--text)}.mm-st li.done i{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}.mm-st li.done i svg{width:12px;height:12px}.mm-st li.err i{border-color:var(--danger,#e66);color:var(--danger,#e66)}
@keyframes mmSpin{to{transform:rotate(360deg)}}
.mm-bar{height:6px;border-radius:3px;margin-top:12px;overflow:hidden;background:color-mix(in srgb,var(--text) 10%,transparent)}.mm-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--c-learning,var(--accent)));transition:width .4s}
.mm-bar.ind i{animation:mmInd 1.3s ease-in-out infinite}@keyframes mmInd{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}
.mm-pr{margin-top:10px}.mm-pr summary{cursor:pointer;font-size:13px;color:var(--accent);font-weight:600}
.vp-sty{margin:10px 0 4px}.vp-l{display:flex;flex-direction:column;gap:2px;margin:10px 0;max-height:360px;overflow:auto;border-radius:14px;border:1px solid var(--line)}
.vp-r{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer}.vp-r+.vp-r{border-top:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.vp-r input{accent-color:var(--accent);width:18px;height:18px;flex:none}.vp-r span{flex:1;min-width:0;display:flex;flex-direction:column}.vp-r small{color:var(--muted);font-size:12px}.vp-r:has(input:checked){background:color-mix(in srgb,var(--accent) 10%,transparent)}
input[data-vp=rate],input[data-vp=pitch]{width:100%;accent-color:var(--accent)}
.lv-home{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 12px;padding:14px 16px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface));color:var(--text);text-align:left;cursor:pointer;font:inherit}
.lv-home>span:nth-child(2){flex:1;display:flex;flex-direction:column;min-width:0}.lv-home small{color:var(--muted);font-size:12.5px;margin-top:2px}.lv-home>svg{width:22px;height:22px;color:var(--accent);flex:none}
.lv-hor{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 35% 30%,#fff8 0,transparent 42%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 8px 22px -8px var(--accent);animation:lvBreathe 4s ease-in-out infinite}
.lv{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;padding:max(14px,env(safe-area-inset-top)) 18px max(16px,env(safe-area-inset-bottom));background:var(--bg);color:var(--text);opacity:0;transform:scale(1.03);transition:opacity .3s,transform .35s var(--spring,ease)}
.lv.on{opacity:1;transform:none}html.lv-on body{overflow:hidden}
.lv-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 45% at 50% 38%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 70%),radial-gradient(50% 40% at 30% 80%,color-mix(in srgb,var(--c-learning,var(--accent)) 16%,transparent),transparent 70%);transition:opacity .5s}
.lv[data-st=idle] .lv-glow{opacity:.55}
.lv-h{position:relative;display:flex;align-items:center;gap:8px}.lv-nm{flex:1;display:flex;flex-direction:column}.lv-nm b{font:700 18px var(--f-body)}.lv-nm small{color:var(--muted);font-size:13px}
.lv-mid{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px}
.lv-orb{position:relative;width:min(56vw,230px);aspect-ratio:1;border:0;padding:0;border-radius:50%;background:none;cursor:pointer;--lv:0}
.lv-orb span{position:absolute;inset:0;border-radius:50%}
.lv-o1{background:radial-gradient(circle at 35% 30%,#fff9 0,transparent 40%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 30px 80px -24px var(--accent);transform:scale(calc(.86 + var(--lv) * .2));transition:transform .12s}
.lv-o2{inset:-14px!important;border:2px solid color-mix(in srgb,var(--accent) 35%,transparent);opacity:0}
.lv-o3{inset:18%!important;background:var(--bg);opacity:.18;filter:blur(8px)}
.lv[data-st=idle] .lv-o1{animation:lvBreathe 4s ease-in-out infinite}
@keyframes lvBreathe{0%,100%{transform:scale(.86)}50%{transform:scale(.8)}}
.lv[data-st=listen] .lv-o2{opacity:1;animation:lvRing 1.6s ease-out infinite}
.lv[data-st=think] .lv-o1{animation:lvSpin 1.6s linear infinite}
.lv[data-st=speak] .lv-o1{animation:lvTalk .9s ease-in-out infinite}
@keyframes lvRing{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.25);opacity:0}}
@keyframes lvSpin{to{transform:rotate(360deg) scale(.9)}}
@keyframes lvTalk{50%{transform:scale(.97)}0%,100%{transform:scale(.88)}}
.lv-hint{margin:22px 0 0;color:var(--muted);font-size:13.5px;min-height:1.3em;text-align:center}
.lv-cap{position:relative;max-height:34vh;overflow:auto;padding:4px 2px;text-align:center}
.lv-you{margin:0 0 10px;color:var(--muted);font-size:16px;line-height:1.45}
.lv-ai{margin:0;font:600 clamp(19px,5.2vw,24px)/1.4 var(--f-body);letter-spacing:-.01em}
.lv-cap .ai-acts{justify-content:center}.lv-cap .mm{text-align:left}
.lv-type{position:relative;display:flex;gap:8px;margin-top:12px}.lv-type input{flex:1;min-width:0;border-radius:22px;border:1px solid var(--line);background:var(--surface);color:var(--text);padding:12px 16px;font:500 16px var(--f-body)}
.lv-ctl{position:relative;display:flex;align-items:center;justify-content:center;gap:18px;margin-top:16px}
.lv-b{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font:700 14px var(--f-body)}.lv-b svg{width:24px;height:24px}
.lv-b.off{background:color-mix(in srgb,var(--danger,#e66) 18%,var(--surface));color:var(--danger,#e66)}
.lv-end{width:auto;padding:0 26px;border-radius:28px;background:var(--danger,#e5484d);border-color:transparent;color:#fff}
.lv-note{position:relative;margin-top:12px}.lv-hid{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
@media (prefers-reduced-motion:reduce){.lv-orb span,.lv-hor{animation:none!important}}`;
document.head.appendChild(css);
})();
