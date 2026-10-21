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
function parseActs(text,max=3){const acts=[];const clean=String(text||'').replace(ACT_RX,(m,k,a,b)=>{k=k.toLowerCase().replace(/\s+/g,'');if(k==='todo'||k==='todaygoal')k='today';if(AK[k]&&a.trim()&&acts.length<max)acts.push({id:uid(),k,t:tr(a,120),x:tr(b||'',300),st:''});return''}).replace(/\n{3,}/g,'\n\n').trim();return{clean,acts}}
/* the half-written "ACTI…" line at the end of a streaming answer stays hidden */
const hideActs=s=>String(s||'').replace(ACT_RX,'').replace(/(^|\n)[ \t>*-]*A(?:C(?:T(?:I(?:O(?:N(?:\s*:[^\n]*)?)?)?)?)?)?$/,'$1').replace(/\s+$/,'');
const actLabel=a=>a.fn?a.t:`${AK[a.k]}: ${a.t}`;
/* a.fn: a suggestion from the agent, which knows how to do itself */
function doAct(a){const D=window.PlotDo;let r=null;const t=a.t,x=a.x;if(a.fn){a.st='done';Promise.resolve(a.fn()).catch(()=>{a.st=''});return{say:'Done: '+t}}
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
/* progress lands on every open card: the bar switches from the sliding "working" stripe to a real fill once sizes are known */
function mmProg(t){const mb=mbOf(t);MM.msg=String(t||'').replace(/\s*·\s*once, then offline/,'');if(mb&&mb[1])MM.pct=Math.min(100,Math.round(mb[0]/mb[1]*100));
 const cards=document.querySelectorAll('.mm');if(!cards.length)return;let miss=false;
 cards.forEach(c=>{const b=c.querySelector('.mm-bar'),p=c.querySelector('.mm-msg'),pc=c.querySelector('.mm-pct');if(!b||!p){miss=true;return}
  if(MM.pct>=0){b.classList.remove('ind');b.firstChild.style.width=MM.pct+'%'}else{b.classList.add('ind');b.firstChild.style.width='30%'}p.textContent=MM.msg||'Working…';if(pc)pc.textContent=MM.pct>=0?MM.pct+'%':''});if(miss)mmPaint()}
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
 if(busy||MM.err&&MM.id===i.m[0]&&MM.steps.length){body=`<ol class="mm-st">${MM.steps.map(x=>`<li class="${x.st}"><i>${x.st==='done'?ic('check','ico-s'):x.st==='err'?'!':x.st==='skip'?'–':''}</i><span>${esc(x.t)}</span></li>`).join('')}</ol>${busy?`<div class="mm-bar ${MM.pct<0?'ind':''}"><i style="width:${MM.pct<0?30:MM.pct}%"></i></div><div class="mm-m"><p class="small muted mm-msg">${esc(MM.msg||'Working…')}</p><b class="mm-pct">${MM.pct>=0?MM.pct+'%':''}</b></div><p class="small muted mm-keep">You can leave this page. Setup keeps going${NATIVE?' while the app is open':''}.</p>`:''}${MM.err&&!busy?`<p class="small err">${esc(MM.err)}</p>`:''}`}
 else if(!have)body=`<p class="small muted">Not on this ${NATIVE?'phone':'device'} yet. It’s a ${i.gb} GB download from Hugging Face, once, then it works offline and nothing you say leaves the ${NATIVE?'phone':'device'}. Use Wi-Fi.</p>`;
 else body=`<p class="small muted">Downloaded and ${where}. ${pr?'It has read your plan and keeps a short private profile of you.':'Set it up to let it read your plan and get to know you.'}</p>${pr&&w!=='live'?`<details class="mm-pr"><summary>What ${esc(nm())} knows about you</summary><p class="small">${esc(pr.text)}</p></details>`:''}`;
 const btns=busy?'':!have?`<button class="btn pri sm" data-act="mmGo">${ic('down')}Download and set up</button>`:MM.err&&MM.id===i.m[0]?`<button class="btn pri sm" data-act="mmGo">Try again</button>`:`${w==='live'?'':`<button class="btn sm ghost" data-act="mmGo">${pr?'Read my plan again':'Set it up'}</button><button class="btn sm ghost" data-act="insDelModel">Delete from this ${NATIVE?'phone':'device'}</button>`}`;
 return`<div class="mm" data-w="${w||''}"><div class="mm-h"><span class="mm-ic">${ic('ai')}</span><span class="mm-t"><b>${esc(i.name)}</b><small>${esc(i.gb+' GB · '+where)}</small></span><span class="mm-tag ${have&&!busy?'ok':''}">${tag}</span></div>${body}${btns?`<div class="actions left">${btns}</div>`:''}</div>`}
Object.assign(ACT,{mmGo:()=>mmRun()});
/* other parts of the app ask: is it ready, and if not, show this card */
/* ---------------- the answer canvas ----------------
   AI answers are free-form Markdown, and this lays them out: headings, bullet and numbered lists, tables, bold, italic,
   inline code and links. Everything is escaped first, so a model can't inject HTML. */
function mdCanvas(src){const L=String(src||'').replace(/\r/g,'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').split('\n');let o='',list='',i=0;
 const inl=x=>esc(x).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])[*_](?!\s)([^*_\n]+?)[*_](?=[\s).,;:!?]|$)/g,'$1<i>$2</i>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/(^|\s)(https?:\/\/[^\s<]+)/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');
 const close=()=>{if(list){o+=`</${list}>`;list=''}};const cells=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 while(i<L.length){const raw=L[i],l=raw.trim();let m;
  if(/^\|.*\|$/.test(l)&&i+1<L.length&&/^\|?\s*:?-{2,}/.test(L[i+1].trim())){close();const h=cells(l);i+=2;const R=[];while(i<L.length&&/^\|.*\|$/.test(L[i].trim())){R.push(cells(L[i]));i++}
   o+=`<div class="md-tw"><table class="md-t"><thead><tr>${h.map(c=>`<th>${inl(c)}</th>`).join('')}</tr></thead><tbody>${R.map(r=>`<tr>${h.map((_,k)=>`<td>${inl(r[k]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;continue}
  if((m=/^(#{1,4})\s+(.*)$/.exec(l))){close();o+=`<h${Math.min(6,m[1].length+2)} class="md-h">${inl(m[2])}</h${Math.min(6,m[1].length+2)}>`}
  else if((m=/^[-*•]\s+(.*)$/.exec(l))){if(list!=='ul'){close();o+='<ul>';list='ul'}o+=`<li>${inl(m[1])}</li>`}
  else if((m=/^\d+[.)]\s+(.*)$/.exec(l))){if(list!=='ol'){close();o+='<ol>';list='ol'}o+=`<li>${inl(m[1])}</li>`}
  else if(/^(-{3,}|\*{3,})$/.test(l)){close();o+='<hr>'}
  else if(/^>\s?/.test(l)){close();o+=`<blockquote>${inl(l.replace(/^>\s?/,''))}</blockquote>`}
  else if(l){close();o+=`<p>${inl(l)}</p>`}else close();i++}
 close();return o}
window.AIX={sugs:(k,act,title)=>sugHTML(k,act,title),sugAuto:k=>sugAuto(k),md:mdCanvas,safety:aiSafety,block:aiBlock,care:aiCare,note:noteHTML,parseActs,hideActs,actChips,keepActs,doAct,actLabel,chat:aiChat,modelCard,setup:mmRun,ready:()=>aiReady()&&!MM.busy,ACT_SYS};

/* ---------------- voices ---------------- */
const VSTY=[['natural','Natural',1,1],['calm','Calm',.9,.94],['bright','Bright',1.05,1.15],['deep','Deep',.95,.8],['quick','Quick',1.25,1.02]];
const vpick=()=>{const a=S.settings.assist||{};return{voice:a.voice||'',rate:+a.rate||1,pitch:+a.pitch||1,all:!!a.vall}};
let VL=null;
function voiceList(){if(NA&&NA.voices){let j='';try{j=NA.voices()}catch(e){}if(!j)return null;try{return JSON.parse(j).map(v=>({n:v.n,l:v.l,q:v.q,net:v.net,f:v.f||''}))}catch(e){return[]}}
 if(window.speechSynthesis){const v=speechSynthesis.getVoices();if(!v.length)return null;return v.map(x=>({n:x.name,l:x.lang,q:x.localService?300:400,net:!x.localService}))}return[]}
if(window.speechSynthesis&&!NA)try{speechSynthesis.onvoiceschanged=()=>{VL=null;if(document.getElementById('vpPanel'))render(false)}}catch(e){}
window.addEventListener('plot-voices',()=>{VL=null;if(document.getElementById('vpPanel'))render(false)});
/* male or female, where we can tell. Google's Android voices are named like en-us-x-iom-local, so a table of the known
   ids does most of it; some engines say it in the name (#male_1, SMTm00) or in the voice's features; browsers name them. */
const VG_M='iol iom tpd gbb gbd rjs aub aud end ene',VG_F='iob iog sfg tpc tpf gba gbc gbg aua auc ena ahp cxx';
function vGender(v){const n=String(v.n||''),f=String(v.f||'').toLowerCase(),low=n.toLowerCase();
 if(/(^|[^a-z])female/.test(f)||/#female|smtf\d|(^|[^a-z])female\b/.test(low))return'f';if(/(^|[^a-z])male/.test(f)||/#male|smtm\d|(^|[^a-z])male\b/.test(low))return'm';
 const m=/^[a-z]{2,3}-[a-z]{2,3}-x-([a-z]{3})/i.exec(n);if(m&&String(v.l||'').toLowerCase().startsWith('en')){const id=m[1].toLowerCase();if(VG_M.split(' ').includes(id))return'm';if(VG_F.split(' ').includes(id))return'f'}
 if(/\b(david|mark|daniel|alex|fred|george|james|guy|ryan|thomas|aaron|arthur|rishi|oliver|eddy|reed|rocko|grandpa|ravi|hemant|prabhat|liam|william|eric|christopher|andrew|brian|roger|steffan|tony|jacob|davis|jason)\b/i.test(n))return'm';
 if(/\b(zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|kate|serena|aria|jenny|michelle|emma|ava|sonia|libby|heera|kalpana|veena|flo|sandy|shelley|grandma|catherine|natasha|clara|ana|nancy|sara|amber|ashley|cora|elizabeth|monica|jane)\b/i.test(n))return'f';return''}
const lname=l=>{try{return new Intl.DisplayNames([navigator.language||'en'],{type:'language'}).of(l)}catch(e){return l}};
function vName(v,i){if(!NA)return v.n;const m=/^([a-z]{2,3})-([a-z]{2,3})-x-([a-z]{3})/i.exec(v.n),g=/#(fe)?male_?(\d*)/i.exec(v.n);return`${lname(v.l)} · ${m?m[3].toUpperCase():'Voice '+(i+1)}${g?' '+(g[2]||''):''}`.trim()}
function voicePickHTML(){const p=vpick(),lang=(vset().lang||navigator.language||'en').toLowerCase().split('-')[0];if(!VL)VL=voiceList();
 const G=S.settings.assist&&S.settings.assist.vg||'',inL=(VL||[]).filter(v=>p.all||String(v.l).toLowerCase().startsWith(lang)),nM=inL.filter(v=>vGender(v)==='m').length,nF=inL.filter(v=>vGender(v)==='f').length;
 const L=inL.filter(v=>!G||vGender(v)===G).sort((a,b)=>(a.net-b.net)||(b.q-a.q)||a.n.localeCompare(b.n)).slice(0,80),sty=VSTY.find(x=>Math.abs(x[2]-p.rate)<.01&&Math.abs(x[3]-p.pitch)<.01);
 return`<section class="panel rv" id="vpPanel"><h3>${esc(nm())}’s voice</h3><p class="small muted">How ${esc(nm())} sounds when it talks back. Tap ${ic('play','ico-s')} to hear one.</p>
 <div class="chips vp-sty">${VSTY.map(([k,n,r,pi])=>`<button class="chip ${sty&&sty[0]===k?'on':''}" data-act="vpStyle" data-r="${r}" data-p="${pi}">${n}</button>`).join('')}</div>
 <div class="chips vp-g" role="group" aria-label="Show voices">${[['','All voices'],['m',`Male${nM?' · '+nM:''}`],['f',`Female${nF?' · '+nF:''}`]].map(([k,n])=>`<button class="chip ${G===k?'on':''}" data-act="vpG" data-g="${k}">${n}</button>`).join('')}</div>
 ${G==='m'&&VL&&!nM?`<div class="vp-none"><p class="small">No male voice is installed for this language yet.${NA&&NA.openTtsSettings?' Tap Get more voices below: in Google’s speech engine, open Install voice data, pick your language and download the voices there (several are male; tap one to hear it). Then come back here.':' Try “Show voices in every language”, or add voices in your system’s speech settings.'} Meanwhile, “Deep” lowers the pitch of the voice you have.</p></div>`:''}
 <div class="two"><div class="field"><label>Speed · <output id="vpR">${p.rate.toFixed(2)}×</output></label><input type="range" min="0.6" max="1.6" step="0.05" value="${p.rate}" data-vp="rate"></div><div class="field"><label>Pitch · <output id="vpP">${p.pitch.toFixed(2)}</output></label><input type="range" min="0.6" max="1.5" step="0.05" value="${p.pitch}" data-vp="pitch"></div></div>
 ${VL===null?`<p class="small muted">Loading the voices on this ${NATIVE?'phone':'device'}…</p>`:L.length?`<div class="vp-l" role="radiogroup" aria-label="Voice"><label class="vp-r"><input type="radio" name="vpV" value="" ${p.voice?'':'checked'} data-vp="voice"><span><b>Default</b><small>The ${NATIVE?'phone':'browser'}’s usual voice for this language</small></span><button class="ibtn sm" data-act="vpHear" data-v="" aria-label="Hear the default voice">${ic('play')}</button></label>${L.map((v,i)=>`<label class="vp-r"><input type="radio" name="vpV" value="${esc(v.n)}" ${p.voice===v.n?'checked':''} data-vp="voice"><span><b>${esc(vName(v,i))}</b><small>${esc([vGender(v)==='m'?'Male':vGender(v)==='f'?'Female':'',NA?'':lname(v.l),v.net?'Needs internet':'Works offline',v.q>=400?'High quality':''].filter(Boolean).join(' · '))}</small></span><button class="ibtn sm" data-act="vpHear" data-v="${esc(v.n)}" aria-label="Hear this voice">${ic('play')}</button></label>`).join('')}</div>`:`<p class="small muted">${G?'None of the voices here are marked '+(G==='m'?'male':'female')+'.':'No voices found for this language.'}</p>`}
 <label class="sw"><span>Show voices in every language<small>${VL?VL.length+' voices on this '+(NATIVE?'phone':'device'):''}</small></span><input type="checkbox" data-vp="all" ${p.all?'checked':''}><i></i></label>
 ${NA&&NA.openTtsSettings?`<div class="actions left"><button class="btn sm ghost" data-act="vpMore">Get more voices</button></div><p class="small muted">Opens Android’s text-to-speech settings. In Google’s speech engine, Install voice data adds more voices and languages.</p>`:''}</section>`}
{const _vh=voiceHTML;voiceHTML=function(){return _vh()+voicePickHTML()}}
const vpSave=o=>{S.settings.assist={...(S.settings.assist||{}),...o};save()};
function hear(v){const p=vpick();const t=`Hi, I’m ${nm()}. This is how I sound.`;if(window.PLOT_ASSIST&&PLOT_ASSIST.say)PLOT_ASSIST.say(t,null,{voice:v,rate:p.rate,pitch:p.pitch})}
Object.assign(ACT,{vpHear:(d,el,ev)=>{ev&&ev.preventDefault();hear(d.v||'')},vpStyle:d=>{vpSave({rate:+d.r,pitch:+d.p});render(false);setTimeout(()=>hear(vpick().voice),150)},vpMore:()=>{try{NA.openTtsSettings()}catch(e){}},vpG:d=>{const g=d.g||'';vpSave({vg:g});
  /* picking Male or Female also switches to the best voice of that kind, unless the current one already is */
  if(g){const p=vpick(),lang=(vset().lang||navigator.language||'en').toLowerCase().split('-')[0],cur=(VL||[]).find(v=>v.n===p.voice);
   if(!cur||vGender(cur)!==g){const best=(VL||[]).filter(v=>vGender(v)===g&&(p.all||String(v.l).toLowerCase().startsWith(lang))).sort((a,b)=>(a.net-b.net)||(b.q-a.q))[0];if(best){vpSave({voice:best.n});setTimeout(()=>hear(best.n),150)}}}
  render(false)}});
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.vp)return;if(t.dataset.vp==='rate'){const o=$('#vpR');if(o)o.textContent=(+t.value).toFixed(2)+'×'}if(t.dataset.vp==='pitch'){const o=$('#vpP');if(o)o.textContent=(+t.value).toFixed(2)}});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.vp)return;const k=t.dataset.vp;
 if(k==='voice'){vpSave({voice:t.value});hear(t.value);return}if(k==='rate'||k==='pitch'){vpSave({[k]:+t.value});hear(vpick().voice);return}if(k==='all'){vpSave({vall:t.checked});render(false)}});

/* ---------------- Live: a voice conversation ---------------- */
const LV={open:false,st:'idle',hist:[],pend:[],muted:false,gen:0,ctl:null,you:'',ai:'',typing:false};
const LV_SYS=()=>{const s=insSet(),pr=s.profile&&s.profile.text,name=S.settings.name;return`You are ${nm()}, ${name?name+'’s':'the user’s'} friendly, curious companion inside Plotline, their app for goals, habits, routines, a journal, lists and threads. You are in a live voice conversation, so talk like a real person: warm, natural, one to three short sentences, no lists, no markdown, no emojis. Ask a short follow-up question when it keeps the conversation going, and give people room to think. Talk about anything they bring up: their day, feelings, ideas, plans, questions about the world, advice. Use the DATA about them when it helps, and never invent facts about them.${pr?`\n\nWHAT YOU KNOW ABOUT THEM\n${pr}`:''}\n\n${ACT_SYS} When you offer something on your own, ask in your spoken sentence, like "Want me to make that a habit?". When they ask you to make something, it's already been done for them.${window.AGENT?'\n\n'+AGENT.sys():''}\n\n${aiSafety()}`};
const BYE=/^(?:ok(?:ay)?\s*,?\s*)?(?:bye|goodbye|good bye|see you|see ya|talk (?:to you )?later|that'?s all|that'?s it|i'?m done|we'?re done|end (?:the )?(?:conversation|chat|call)|stop (?:talking|listening|the conversation)|goodnight|good night)\b/i;
const YES=/^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|please|please do|do it|go ahead|add (?:it|them|that|those|both)|sounds good|let'?s do it|absolutely|of course|definitely)\b/i;
const NO=/^(?:no|nope|nah|not now|no thanks|don'?t|skip it|never ?mind)\b/i;
function lvEl(){let el=$('#live');if(el)return el;el=document.createElement('div');el.id='live';el.className='lv';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Talk with '+nm());
 el.innerHTML=`<div class="lv-glow" aria-hidden="true"></div><header class="lv-h"><span class="lv-nm"><b></b><small id="lvSt"></small></span><button class="ibtn" data-act="lvChat" aria-label="Open as chat" title="Open as chat">${ic('chat')}</button><button class="ibtn" data-act="lvEnd" aria-label="End conversation" title="End">✕</button></header>
 <div class="lv-mid"><button class="lv-orb" id="lvOrb" data-act="lvOrb" aria-label="Talk"><span class="lv-o2"></span><span class="lv-o1"><span class="lv-o3"></span></span></button><p class="lv-hint" id="lvHint"></p></div>
 <div class="lv-cap" id="lvCap" aria-live="polite"></div>
 <form class="lv-type" data-form="lvSend" autocomplete="off" hidden><input id="lvTxt" maxlength="600" placeholder="Type instead…" enterkeyhint="send"><button class="btn pri sm">Send</button></form>
 <div class="lv-ctl"><button class="lv-b" data-act="lvMute" id="lvMute" aria-label="Mute the mic">${ic('mic')}</button><button class="lv-b lv-end" data-act="lvEnd" aria-label="End">End</button><button class="lv-b" data-act="lvType" aria-label="Type instead">${ic('kb')}</button></div>
 ${noteHTML('lv-note')}<input id="lvIn" type="text" tabindex="-1" aria-hidden="true" class="lv-hid">`;
 document.body.appendChild(el);return el}
function lvState(st,hint){LV.st=st;if(window.asHum)asHum(st==='think'&&LV.open);const el=$('#live');if(!el)return;el.dataset.st=st;el.querySelector('.lv-nm b').textContent=nm();
 $('#lvSt').textContent={listen:'Listening… take your time',think:'Thinking…',speak:'Speaking',idle:LV.muted?'Mic is off':'Tap the orb to talk',setup:'Getting ready'}[st]||'';
 $('#lvHint').textContent=hint!=null?hint:st==='listen'?'Tap the orb when you’re done':st==='speak'?'Tap the orb to interrupt':st==='think'?'':LV.muted?'Turn the mic on to talk':'';
 const m=$('#lvMute');if(m){m.innerHTML=ic(LV.muted?'micoff':'mic');m.classList.toggle('off',LV.muted)}}
function lvCap(){const c=$('#lvCap');if(!c)return;const ready=aiReady()&&!MM.busy;
 c.innerHTML=`${LV.you?`<p class="lv-you">${esc(LV.you)}</p>`:''}${LV.ai?`<p class="lv-ai">${esc(LV.ai)}</p>`:''}${actChips(LV.pend,'lvAct')}${ready||LV.you||LV.ai?'':modelCard('live')||''}`;c.scrollTop=c.scrollHeight}
function liveOpen(first,o){if(window.PLOT_ASSIST&&PLOT_ASSIST.close)PLOT_ASSIST.close();
 /* talk mode is one conversation in Conversations: it carries on the one just used (or a resumed one), else starts fresh */
 if(o&&o.resume&&window.PLOT_ASSIST&&PLOT_ASSIST.resume)PLOT_ASSIST.resume(o.resume);LV.resumed=!!(o&&o.resume);
 const prev=window.PLOT_ASSIST&&PLOT_ASSIST.begin?PLOT_ASSIST.begin('talk'):[];LV.hist=prev.slice(-6).flatMap(t=>[{role:'user',content:t.q},{role:'assistant',content:t.a}]);
 const el=lvEl();LV.open=true;LV.you='';LV.ai=aiReady()?'':`To talk about anything, ${nm()} needs its AI on this ${NATIVE?'phone':'device'}. You can still ask me to add things.`;LV.pend=[];
 document.documentElement.classList.add('lv-on');requestAnimationFrame(()=>el.classList.add('on'));try{NA&&NA.wakePause&&NA.wakePause(true)}catch(e){}lvState('idle');lvCap();
 if(first)setTimeout(()=>lvHeard(first),350);else if(!aiReady()&&!MM.busy)lvState('idle','');else setTimeout(()=>lvGreet(),350)}
function lvGreet(){const h=new Date().getHours(),n=S.settings.name;const g=LV.resumed?'Let’s pick up where we left off. Go ahead.':LV.hist.length?'I’m listening.':`${h<12?'Good morning':h<17?'Hey':'Good evening'}${n?', '+n:''}. What’s on your mind?`;LV.ai=g;lvCap();lvSay(g)}
function liveClose(){if(!LV.open)return;LV.open=false;if(window.asHum)asHum(false);LV.gen++;const vno=()=>{if(!LV.open&&document.querySelector('.vdlg')&&ACT.vcNo)ACT.vcNo()};vno();setTimeout(vno,500);setTimeout(vno,1500);try{LV.ctl&&LV.ctl.abort()}catch(e){}if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);if(window.PLOT_ASSIST)PLOT_ASSIST.hush();
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
 const done=(say,acts,extra,full)=>{if(g!==LV.gen||!LV.open)return;LV.ai=say;if(acts)LV.pend=keepActs(acts);lvCap();LV.hist.push({role:'user',content:t},{role:'assistant',content:full||say});LV.hist=LV.hist.slice(-12);
  try{PLOT_ASSIST.addTurn(t,full||say)}catch(e){}if(extra==='bye'){lvSay(say,()=>liveClose());return}lvSay(say)};
 if(BYE.test(t))return done(['Bye for now.','Talk soon.','Okay, bye!'][Math.floor(Math.random()*3)],[],'bye');
 const blocked=aiBlock(t);if(blocked)return done(blocked,[]);
 /* "yes" to what was offered */
 const open=LV.pend.filter(a=>!a.st);if(open.length&&YES.test(t)){const said=[];open.forEach(a=>{try{const r=doAct(a);said.push(actLabel(a).toLowerCase())}catch(e){}});LV.pend=[...LV.pend];return done(`Done. I added the ${said.join(' and the ')}.`,LV.pend)}
 if(open.length&&NO.test(t)&&t.split(/\s+/).length<=4){LV.pend=[];return done('Okay, I’ll leave it.',[])}
 /* clear commands: "add milk to my groceries list", "remind me at 6 to call mom" */
 try{const r=PLOT_ASSIST.command(t);if(r&&r.say)return done(r.say,[])}catch(e){}
 if(!aiReady()){const L=PLOT_ASSIST.lookup(t);return done(L&&L.say?L.say:`I can add things to your plan right now. To talk about anything, set up ${nm()}’s AI first.`,[])}
 const ctl=LV.ctl=new AbortController();let out='';
 /* the AI decides first (while the note search runs): make it now, ask the agent, schedule it, or talk */
 const rp=ragRetrieve(t,{win:0,goal:'',broad:insFocus(t).broad},null).catch(()=>null);
 if(window.AGENT){const d=await AGENT.decide(t,LV.hist.reduce((a,m,i,A)=>(m.role==='user'&&A[i+1]?a.concat({q:m.content,a:A[i+1].content}):a),[]));if(g!==LV.gen)return;
  LV.web=d&&d.agent?d.web:undefined;
  if(d&&d.agent)out='AGENT: '+d.agent;
  else if(d&&d.items){const r=PLOT_ASSIST.doItems(d.items);if(r)return done(r.say.replace(/[“”]/g,''),[])}
  else if(d&&d.schedule&&window.agentFromVoice){const r=agentFromVoice(d.schedule);return done(r.say,[])}}
 if(!out) try{const q=t;let ctx='';try{const r=(await rp)||await ragRetrieve(q,{win:0,goal:'',broad:insFocus(q).broad},null);ctx=PLOT_ASSIST.ctx(q,r,'',planEngine()==='api')}catch(e){ctx='QUESTION\n'+q}
  const msgs=[{role:'system',content:LV_SYS()},...LV.hist.slice(-8),{role:'user',content:`DATA ABOUT ME (use only if it helps)\n${ctx.replace(/\nQUESTION\n[\s\S]*$/,'')}\n\nWHAT I JUST SAID\n${q}`}];
  await aiChat(msgs,x=>{if(g!==LV.gen)return;out+=x;let v=hideActs(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,''));if(/^\W*AG?E?N?T?$|AGENT\s*:/.test(v))v='';if(v){LV.ai=v;const c=$('#lvCap');const p=c&&c.querySelector('.lv-ai');if(p)p.textContent=v;else lvCap()}},{ctl,max_tokens:planEngine()==='api'?400:260,temperature:.7,reading:'Thinking…',onP:x=>{if(x&&g===LV.gen)lvState('think',x)},reset:()=>{out=''}})}
 catch(e){if(g!==LV.gen)return;if(e&&e.name==='AbortError')return;return done('Sorry, I couldn’t think that through: '+(e&&e.message||e),[])}
 if(g!==LV.gen)return;
 /* the AI asked for the agent: it reads email, calendar, Drive or Notion, and the takeaway is said out loud */
 const ag=window.AGENT&&AGENT.parse(out);if(ag){if(!AGENT.connected().length)return done('I can read your email, calendar, Drive and Notion once you connect them on the Agent page.',[]);
  lvState('think','Asking your agent…');try{const x=await AGENT.ask(ag,{web:LV.web,onStep:s=>{if(g===LV.gen)lvState('think',s)}});if(g!==LV.gen)return;return done(x.say,x.chips.slice(0,3).map(c=>({id:uid(),k:'agent',t:c.t,x:'',st:'',fn:c.fn})),'',x.md)}
  catch(e){if(g!==LV.gen)return;return done('My agent couldn’t do that: '+(e&&e.message||e),[])}}
 const P=parseActs(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/[*#_`]/g,''));let say=P.clean.replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'').trim()||'Hmm, I’m not sure. Can you say that another way?';const care=aiCare(t,say);if(care)say+=' '+care;done(say,P.acts)}
Object.assign(ACT,{
 liveOpen:()=>liveOpen(),lvEnd:()=>liveClose(),
 lvOrb:()=>{if(LV.st==='listen'){if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(false,true);return}if(LV.st==='speak'){if(window.PLOT_ASSIST)PLOT_ASSIST.hush();lvListen();return}if(LV.st==='think'){LV.gen++;try{LV.ctl&&LV.ctl.abort()}catch(e){}lvState('idle','Stopped. Tap to talk.');return}if(LV.muted){LV.muted=false}lvListen()},
 lvMute:()=>{LV.muted=!LV.muted;if(LV.muted&&VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);lvState(LV.st==='listen'?'idle':LV.st);if(!LV.muted&&LV.st==='idle')lvListen()},
 lvType:()=>{const f=$('.lv-type');if(!f)return;f.hidden=!f.hidden;if(!f.hidden){LV.muted=true;if(VC&&VC.el&&VC.el.id==='lvIn')voiceStop(true);lvState('idle','');setTimeout(()=>$('#lvTxt').focus(),50)}},
 lvChat:()=>{liveClose();setTimeout(()=>{if(ACT.asOpen)ACT.asOpen()},380)},
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

/* ---------------- ideas: what to ask the assistant or the agent, written by the AI from their plan ----------------
   Kept in settings (aiSugs) so they show at once; Refresh asks for fresh ones, and they renew on their own twice a day
   when the AI is quick (your own server). Until then, sensible defaults. */
Object.assign(IC,{renew:'<path d="M20 11a8 8 0 0 0-14.9-3.9L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3.9L20 15"/><path d="M20 20v-5h-5"/>'});
const SUGD={chat:['What do I have today?','Remind me to call mom at 6pm','Add “had a great workout” to my journal','Give me a 10-minute plan to get unstuck'],
 agent:['Look at my email and calendar and tell me what I’m forgetting','What in my inbox needs a reply?','Plan my week around my calendar','Find deadlines in my email for the next two weeks']};
const SUGB={};
const sugAll=()=>S.settings.aiSugs||(S.settings.aiSugs={});
const sugGet=k=>{const c=sugAll()[k];return c&&c.l&&c.l.length?c.l:SUGD[k]};
const sugOld=k=>{const c=sugAll()[k];return!c||Date.now()-(c.t||0)>12*36e5};
async function sugMake(k){if(SUGB[k])return SUGB[k];if(!aiReady()||MM.busy)throw new Error('Set up the AI first');
 return SUGB[k]=(async()=>{const d=new Date(),part=d.getHours()<12?'morning':d.getHours()<17?'afternoon':'evening',
  plot=(window.AGENT&&AGENT.plot?AGENT.plot():[]).map(x=>'- '+x).join('\n')||'(their plan is still empty)',conn=window.AGENT?AGENT.names():[],prev=sugGet(k);
  const what=k==='agent'?`things the user could ask their agent to do right now. The agent can read ${conn.length?conn.join(', ')+' and ':''}their Plotline plan, then answer and suggest goals, reminders and notes.${conn.length?'':' Nothing else is connected yet, so keep to their plan.'} Each one is a clear task, like "Find emails from this week I haven’t replied to".`
   :`things the user could say to ${nm()}, their assistant in the Plotline app (goals, habits, journal, lists, threads, reminders${conn.length?', and '+conn.join(', ')+' through its agent':''}). Mix it up: one that adds or logs something, one question about their own plan or data, one that asks for an idea, advice or a plan, and one wildcard.`;
  const msgs=[{role:'system',content:`You write short suggestions for buttons in an app. Reply with exactly 4 lines and nothing else: each line one suggestion, under 60 characters, written as the user would say it (first person), no numbering, no quotes, no emojis.`},
   {role:'user',content:`It’s ${d.toLocaleDateString(undefined,{weekday:'long'})} ${part}. Suggest ${what} Make them specific to this plan and the time of day, and different from these: ${prev.join(' / ')}.\n\nTHEIR PLAN\n${plot}`}];
  let out='';await aiChat(msgs,x=>{out+=x},{max_tokens:200,temperature:.9});
  const L=[...new Set(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').split('\n').map(x=>x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').replace(/^["“'”]+|["“”']+$/g,'').replace(/\*\*/g,'').trim()).filter(x=>x.length>=6&&x.length<=90&&!/^(here|sure|suggestions?)\b/i.test(x)))].slice(0,4);
  if(L.length<2)throw new Error('The AI didn’t come up with any. Try again.');
  sugAll()[k]={l:L,t:Date.now()};save();return L})().finally(()=>{delete SUGB[k]})}
/* the row of ideas with its refresh button; act is the data-act each idea runs with data-q */
function sugHTML(k,act,title){const b=!!SUGB[k];return`<div class="ai-sg${k==='agent'?' cmp':''}" data-sg="${k}"><div class="ai-sgh"><span>${esc(title||'Try asking')}</span><button class="ibtn sm ai-sgr${b?' spin':''}" data-act="aiSugNew" data-k="${k}" aria-label="New ideas" title="New ideas" ${b?'disabled':''}>${ic('renew')}</button></div><div class="ai-sgl">${sugGet(k).map(s=>`<button class="ai-sgi" data-act="${act}" data-q="${esc(s.replace(/[“”]/g,''))}">${ic('ai','ico-s')}<span>${esc(s)}</span></button>`).join('')}</div></div>`}
function sugPaint(k){document.querySelectorAll(`.ai-sg[data-sg="${k}"]`).forEach(el=>{const p=el.parentNode,act=el.querySelector('.ai-sgi')?.dataset.act||'asTry',t=el.querySelector('.ai-sgh span')?.textContent;const w=document.createElement('div');w.innerHTML=sugHTML(k,act,t);p.replaceChild(w.firstChild,el)})}
async function sugNew(k,quiet){const p=sugMake(k);sugPaint(k);try{await p;if(!quiet)toast('Fresh ideas')}catch(e){if(!quiet)toast(esc(e.message||e))}sugPaint(k)}
/* shown: renew stale ideas quietly when the AI answers fast */
const sugAuto=k=>{if(sugOld(k)&&!SUGB[k]&&aiReady()&&!MM.busy&&planEngine()==='api')setTimeout(()=>sugNew(k,true),600)};
Object.assign(ACT,{aiSugNew:d=>sugNew(d.k)});
const css=document.createElement('style');css.textContent=`
.ai-md{min-width:0;overflow-wrap:anywhere}.ai-md p{margin:0 0 8px;line-height:1.5}.ai-md p:last-child{margin-bottom:0}.ai-md .md-h{margin:14px 0 6px;font:700 15px/1.3 var(--f-body);text-transform:none;letter-spacing:0}.ai-md h3.md-h{font-size:16.5px}.ai-md .md-h:first-child{margin-top:0}
.ai-md ul,.ai-md ol{margin:4px 0 10px;padding-left:22px}.ai-md li{margin:3px 0;line-height:1.45}.ai-md li::marker{color:var(--accent)}.ai-md code{font:500 .9em var(--f-mono,monospace);padding:1px 5px;border-radius:6px;background:color-mix(in srgb,var(--text) 8%,transparent)}
.ai-md a{color:var(--accent)}.ai-md hr{border:0;border-top:1px solid var(--line);margin:12px 0}.ai-md blockquote{margin:8px 0;padding:4px 12px;border-left:3px solid var(--accent);color:var(--muted)}
.md-tw{overflow-x:auto;margin:8px 0 12px;border:1px solid var(--line);border-radius:12px}.md-t{border-collapse:collapse;width:100%;font-size:13.5px}.md-t th,.md-t td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}.md-t th{font-weight:700;background:color-mix(in srgb,var(--accent) 8%,transparent);white-space:nowrap}.md-t tr:last-child td{border-bottom:0}
.ai-note{display:block;margin:8px 0 0;font-size:11.5px;line-height:1.3;color:var(--muted);text-align:center}.ai-note svg{width:13px;height:13px;opacity:.8;vertical-align:-2px;margin-right:5px}
.ai-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ai-act{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border-radius:18px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--text);font:600 13px var(--f-body);cursor:pointer;text-align:left}
.ai-act svg{width:15px;height:15px;flex:none;color:var(--accent)}.ai-act.done{opacity:.7;cursor:default;border-style:dashed}
.mm{border:1px solid var(--line);border-radius:18px;padding:14px;margin:12px 0;background:color-mix(in srgb,var(--accent) 5%,var(--surface))}
.mm-h{display:flex;align-items:center;gap:10px}.mm-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;flex:none;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}.mm-ic svg{width:20px;height:20px}
.mm-t{flex:1;min-width:0;display:flex;flex-direction:column}@media(max-width:420px){.mm-h{display:grid;grid-template-columns:auto minmax(0,1fr);row-gap:4px}.mm-h .mm-ic{grid-row:span 2}.mm-tag{grid-column:2;justify-self:start}}.mm-t b{font-size:15px}.mm-t small{color:var(--muted);font-size:12px}
.mm-tag{flex:none;font:700 11px var(--f-body);padding:4px 9px;border-radius:10px;background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--muted)}.mm-tag.ok{background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent)}
.mm p{margin:10px 0 0}.mm .actions{margin-top:12px}
.mm-st{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}.mm-st li{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--muted)}
.mm-st li i{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;flex:none;border:1.5px solid color-mix(in srgb,var(--text) 22%,transparent);font:700 11px var(--f-body);font-style:normal}
.mm-st li.on{color:var(--text);font-weight:600}.mm-st li.on i{border-color:var(--accent);border-top-color:transparent;animation:mmSpin .8s linear infinite}
.mm-st li.done,.mm-st li.skip{color:var(--text)}.mm-st li.done i{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}.mm-st li.done i svg{width:12px;height:12px}.mm-st li.err i{border-color:var(--danger,#e66);color:var(--danger,#e66)}
@keyframes mmSpin{to{transform:rotate(360deg)}}
.mm-bar{height:6px;border-radius:3px;margin-top:12px;overflow:hidden;background:color-mix(in srgb,var(--text) 10%,transparent)}.mm-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--c-learning,var(--accent)));transition:width .4s}
.mm-bar.ind i{animation:mmInd 1.3s ease-in-out infinite}@keyframes mmInd{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}
.mm-m{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:8px}.mm-m .mm-msg{margin:0;min-width:0;overflow-wrap:anywhere}.mm-pct{flex:none;font:700 13px var(--f-mono,monospace);color:var(--accent)}.mm-keep{opacity:.8;margin-top:4px!important;font-size:12px}
.mm-st li span{min-width:0;overflow-wrap:anywhere}.mm-t small{overflow-wrap:anywhere}
.mm-pr{margin-top:10px}.mm-pr summary{cursor:pointer;font-size:13px;color:var(--accent);font-weight:600}
.vp-sty{margin:10px 0 4px}.vp-g{margin:14px 0 4px}.vp-none{margin:8px 0;padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--accent) 9%,transparent)}.vp-none p{margin:0}.vp-l{display:flex;flex-direction:column;gap:2px;margin:10px 0;max-height:360px;overflow:auto;border-radius:14px;border:1px solid var(--line)}
.vp-r{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer}.vp-r+.vp-r{border-top:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.vp-r input{accent-color:var(--accent);width:18px;height:18px;flex:none}.vp-r span{flex:1;min-width:0;display:flex;flex-direction:column}.vp-r small{color:var(--muted);font-size:12px}.vp-r:has(input:checked){background:color-mix(in srgb,var(--accent) 10%,transparent)}
input[data-vp=rate],input[data-vp=pitch]{width:100%;accent-color:var(--accent)}
.lv-home{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 12px;padding:14px 16px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 16%,var(--surface)),var(--surface));color:var(--text);text-align:left;cursor:pointer;font:inherit}
.lv-home>span:nth-child(2){flex:1;display:flex;flex-direction:column;min-width:0}.lv-home small{color:var(--muted);font-size:12.5px;margin-top:2px}.lv-home>svg{width:22px;height:22px;color:var(--accent);flex:none}
.lv-hor{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 35% 30%,#fff8 0,transparent 42%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 8px 22px -8px var(--accent);will-change:transform;animation:lvBreathe 2.8s cubic-bezier(.37,0,.63,1) infinite alternate}
.lv{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;padding:max(14px,env(safe-area-inset-top)) 18px max(16px,env(safe-area-inset-bottom));background:var(--bg);color:var(--text);opacity:0;transform:scale(1.03);transition:opacity .3s,transform .35s var(--spring,ease)}
.lv.on{opacity:1;transform:none}html.lv-on body{overflow:hidden}
.lv-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 45% at 50% 38%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 70%),radial-gradient(50% 40% at 30% 80%,color-mix(in srgb,var(--c-learning,var(--accent)) 16%,transparent),transparent 70%);transition:opacity .5s}
.lv[data-st=idle] .lv-glow{opacity:.55}
.lv-h{position:relative;display:flex;align-items:center;gap:8px}.lv-nm{flex:1;display:flex;flex-direction:column}.lv-nm b{font:700 18px var(--f-body)}.lv-nm small{color:var(--muted);font-size:13px}
.lv-mid{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px}
.lv-orb{position:relative;width:min(56vw,230px);aspect-ratio:1;border:0;padding:0;border-radius:50%;background:none;cursor:pointer;--lv:0;will-change:transform;animation:lvBreathe 5.6s cubic-bezier(.37,0,.63,1) infinite alternate;-webkit-tap-highlight-color:transparent}
.lv-orb span{position:absolute;inset:0;border-radius:50%}
.lv-o1{background:radial-gradient(circle at 35% 30%,#fff9 0,transparent 40%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 30px 80px -24px var(--accent);transform:scale(calc(.9 + var(--lv) * .16));will-change:transform;overflow:hidden}
.lv-o2{inset:-14px!important;border:2px solid color-mix(in srgb,var(--accent) 35%,transparent);opacity:0;transition:opacity .6s;animation:lvRing 2.2s cubic-bezier(.2,.6,.4,1) infinite;will-change:transform,opacity}
.lv-o3{background:conic-gradient(from 0deg,transparent 0 55%,rgba(255,255,255,.55) 75%,transparent 92%);opacity:0;transition:opacity .6s;animation:lvSpin 1.8s linear infinite;will-change:transform}
/* breathing lives on the button itself and never stops, so moving between idle, listening, thinking and speaking never jumps */
@keyframes lvBreathe{from{transform:scale(.94)}to{transform:scale(1)}}
.lv[data-st=listen] .lv-o2{opacity:1}
.lv[data-st=think] .lv-o3{opacity:1}
.lv[data-st=speak] .lv-o1{animation:lvTalk .8s cubic-bezier(.37,0,.63,1) infinite alternate}
@keyframes lvRing{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.22);opacity:0}}
@keyframes lvSpin{to{transform:rotate(360deg)}}
@keyframes lvTalk{from{transform:scale(.9)}to{transform:scale(.97)}}
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
.ai-sg{margin-top:10px;width:100%}.ai-sgh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ai-sgh span{font:700 11px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.ai-sg.cmp .ai-sgl{display:flex;flex-wrap:wrap;gap:6px}.ai-sg.cmp .ai-sgi{padding:7px 12px;border-radius:999px;font-size:13px}.ai-sg.cmp .ai-sgi svg{display:none}
.ai-sgr.spin svg{animation:mmSpin 1s linear infinite}
.ai-sgl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:6px}
.ai-sgi{display:flex;align-items:flex-start;gap:8px;min-width:0;text-align:left;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:500 14px/1.35 var(--f-body);cursor:pointer}.ai-sgi svg{flex:none;color:var(--accent);margin-top:2px}.ai-sgi span{min-width:0;overflow-wrap:anywhere}.ai-sgi:active{transform:scale(.98)}
@media (prefers-reduced-motion:reduce){.lv-orb,.lv-orb span,.lv-hor{animation:none!important}}`;
document.head.appendChild(css);
})();
