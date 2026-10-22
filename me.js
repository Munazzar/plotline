/* Picture of me: the AI reads everything in the app (goals, habits, journal, moods, reminders and plans, threads, lists,
   life chapters, phone activity, every conversation with the assistant and the agent's tasks and results) and writes a
   detailed picture of the user: who they are, what they are working towards, their rhythms, how they have been feeling,
   what keeps coming up, their strengths, where they get stuck, and what to try next. The AI picks the sections; the app
   only gathers the data. It rewrites itself when the data has changed since the last picture, and the user can tell it
   things it should know or got wrong. Its short version becomes the profile every assistant reads.
   Kept on this device only (IndexedDB key "me"), never synced. */
(()=>{
'use strict';
const nm=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const dayOf=t=>ymd(new Date(t));
const dlab=ds=>{const[y,m,d]=String(ds).split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})};
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
Object.assign(IC,{me:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'});

/* ---------------- the store ---------------- */
let ME={t:0,sig:'',text:'',head:'',secs:[],prof:'',by:'',counts:null,prev:[],notes:[]};
let BUSY=false,ERR='',CTL=null,OUT='',paintT=0;
DB.get('me').then(v=>{if(v&&typeof v==='object')ME={...ME,...v};if(cur.p==='me')render(false)}).catch(()=>{});
const persist=()=>DB.set('me',ME).catch(()=>{});

/* what's in the app right now: the picture is stale once any of this moves */
const notes=()=>S.entries.filter(e=>e.type==='note');
function counts(){const A=S.settings.agent||{},C=window.CONV?CONV.list():[];
 return{j:notes().length,h:S.habits.filter(h=>h.status!=='archived').length,ck:S.habits.reduce((a,h)=>a+Object.keys(h.log||{}).length,0),g:S.goals.length,gd:S.goals.filter(g=>g.status==='done').length,
  st:S.goals.reduce((a,g)=>a+(g.steps||[]).filter(x=>x.done).length,0),d:S.days.length,dd:S.days.filter(x=>x.done).length,th:threads().length,tu:threads().reduce((a,t)=>a+(t.ups||[]).length,0),
  l:(S.lists||[]).length,c:C.length,ct:C.reduce((a,c)=>a+c.turns.length,0),a:(A.inbox||[]).length,n:ME.notes.length}}
function sigNow(){const c=counts(),u=Math.max(0,...[...S.goals,...S.habits,...S.entries,...S.days,...threads(),...(S.lists||[])].map(o=>+o.u||0));return JSON.stringify(c)+':'+u}
const stale=()=>!!ME.text&&ME.sig!==sigNow();
/* in words: what has been added since the picture was written */
function since(){const a=ME.counts,b=counts();if(!a)return'';const L=[],d=(k,one,many)=>{const n=(b[k]||0)-(a[k]||0);if(n>0)L.push(`${n} ${n===1?one:many}`)};
 d('j','journal entry','journal entries');d('ck','habit check-in','habit check-ins');d('st','goal step done','goal steps done');d('gd','goal reached','goals reached');d('g','new goal','new goals');
 d('dd','plan done','plans done');d('d','new plan or reminder','new plans and reminders');d('tu','thread update','thread updates');d('ct','message with '+nm(),'messages with '+nm());d('a','agent result','agent results');d('n','note from you','notes from you');
 return L.slice(0,4).join(', ')}

/* ---------------- everything the AI reads ---------------- */
function rhythm(){const tn=dnum(ymd()),due=Array(7).fill(0),done=Array(7).fill(0);
 S.habits.filter(h=>h.status==='active'&&h.kind!=='quit').forEach(h=>{for(let k=tn-55;k<tn;k++){const ds=fromN(k);try{if(hCounts(h,ds)){const w=new Date(ds+'T12:00').getDay();due[w]++;if(hDone(h,ds))done[w]++}}catch(e){}}});
 return due.map((n,i)=>({w:i,n,p:n?Math.round(done[i]/n*100):null}))}
function moodMix(days){const tn=dnum(ymd()),c={};notes().forEach(e=>{if(!e.mood||e.private&&!insSet().priv)return;if(dnum(dayOf(e.t))>tn-days)c[e.mood]=(c[e.mood]||0)+1});return c}
function digest(max){const td=ymd(),tn=dnum(td),priv=insSet().priv,f=Math.max(.2,Math.min(1,max/26000)),parts=[];
 const sec=(title,lines,cap)=>{lines=lines.filter(Boolean);if(!lines.length)return;cap=Math.max(240,Math.round(cap*f));let b=`\n${title}\n`;for(const l of lines){if(b.length+l.length+1>cap)break;b+=l+'\n'}parts.push(b)};
 const now=new Date();
 sec('WHAT THE USER TOLD YOU ABOUT THEMSELVES (always true, overrides anything else)',ME.notes.map(n=>'- '+tr(n.x,400)),3000);
 const first=Math.min(Date.now(),...S.goals.map(g=>+g.createdAt||Infinity),...S.entries.map(e=>+e.t||Infinity),...S.habits.map(h=>h.startDate?new Date(h.startDate).getTime():Infinity));
 sec('BASICS',[`Today is ${now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`,S.settings.name?`Their name is ${S.settings.name}.`:'',
  `Using Plotlines for ${Math.max(1,Math.round((Date.now()-first)/864e5))} days.`],600);
 try{sec('GOALS, HABITS AND MOODS',[insOverview(Math.round(7000*f),'')],7200)}catch(e){}
 const R=rhythm();if(R.some(x=>x.n))sec('HABITS BY WEEKDAY (last 8 weeks, share of due habits done)',[[1,2,3,4,5,6,0].map(i=>`${WD[i]} ${R[i].p==null?'–':R[i].p+'%'}`).join(' · ')],400);
 const tim=S.habits.filter(h=>h.status==='active'&&h.time).map(h=>`${h.title} at ${h.time}`);if(tim.length)sec('HABIT TIMES',[tim.join('; ')],500);
 const all=notes().filter(e=>!e.private||priv).sort((a,b)=>b.t-a.t),n30=all.filter(e=>dnum(dayOf(e.t))>tn-30).length,n90=all.filter(e=>dnum(dayOf(e.t))>tn-90).length;
 if(all.length){const hr=[0,0,0,0];all.forEach(e=>{const h=new Date(e.t).getHours();hr[h<5?3:h<12?0:h<18?1:h<23?2:3]++});
  const old=all.slice(14),pick=old.length>10?Array.from({length:10},(_,i)=>old[Math.floor(i*old.length/10)]):old;
  sec('JOURNAL',[`${all.length} entries, ${n30} in the last 30 days, ${n90} in the last 90. Written mornings ${hr[0]}, afternoons ${hr[1]}, evenings ${hr[2]}, late at night ${hr[3]}.`,
   ...[...all.slice(0,14),...pick].map(e=>`- ${dlab(dayOf(e.t))}${e.mood?' ['+(MOODN[e.mood]||e.mood)+']':''}: ${tr((e.title?e.title+'. ':'')+(e.text||''),420)}`)],9000)}
 const up=S.days.filter(x=>!x.done&&dnum(x.date)>=tn-7&&dnum(x.date)<=tn+21).sort((a,b)=>(a.date+(a.time||'99')).localeCompare(b.date+(b.time||'99')));
 const doneN=S.days.filter(x=>x.done&&dnum(x.date)>tn-30).length,missN=S.days.filter(x=>!x.done&&dnum(x.date)<tn&&dnum(x.date)>tn-30).length;
 const rem=S.habits.filter(h=>h.status==='active'&&h.remind&&h.time).map(h=>h.title+' '+h.time);
 sec('PLANS AND REMINDERS',[doneN||missN?`Last 30 days: ${doneN} done, ${missN} left undone.`:'',rem.length?`Daily habit reminders: ${rem.join(', ')}.`:'',
  ...up.map(x=>`- ${dlab(x.date)}${x.time?' '+x.time:''}: ${x.title}${x.rep&&x.rep.m?` (every ${x.rep.m} min${x.rep.to?' until '+x.rep.to:''})`:''}${dnum(x.date)<tn?' (overdue)':''}`)],3000);
 sec('THREADS (running logs)',threads().filter(t=>t.status!=='archived').sort((a,b)=>(b.u||0)-(a.u||0)).slice(0,20).map(t=>{const U=thrUps(t);return`- ${t.title}${t.status==='done'?' (done)':''}: ${U.length} updates${U[0]?`, latest ${dlab(dayOf(U[0].t))}: ${tr(U[0].x,180)}`:''}`}),2600);
 sec('LISTS',(S.lists||[]).map(l=>{const I=Object.values(l.items||{}).filter(x=>!x.del),o=I.filter(x=>!x.done);return`- ${l.title}: ${o.length} to do${o.length?': '+o.slice(0,8).map(x=>x.t).join(', '):''}`}),1500);
 sec('LIFE CHAPTERS',(S.chapters||[]).map(c=>`- ${c.title} (${c.start} to ${c.end||'now'})`),800);
 const AL=S.settings.actLog||{},av=[];let sd=0,s=0,zd=0,z=0,md=0,m=0;const wk={};
 for(let k=tn-30;k<tn;k++){const o=AL[fromN(k)];if(!o)continue;if(+o.s>0){sd++;s+=+o.s}if(+o.z>0){zd++;z+=+o.z}if(o.m!=null){md++;m+=+o.m}(o.w||[]).forEach(x=>{if(x)wk[x.k||'workout']=(wk[x.k||'workout']||0)+1})}
 if(sd)av.push(`average ${Math.round(s/sd).toLocaleString()} steps a day`);if(zd)av.push(`average sleep ${(z/zd/60).toFixed(1)} hours`);if(md)av.push(`average screen time ${(m/md/60).toFixed(1)} hours`);
 if(Object.keys(wk).length)av.push('workouts: '+Object.entries(wk).map(([k,n])=>`${(typeof ACT_EX!=='undefined'&&ACT_EX[k])||k} ${n}×`).join(', '));
 if(av.length)sec('PHONE ACTIVITY (last 30 days)',[av.join('; ')],600);
 const C=window.CONV?CONV.list():[];
 if(C.length)sec(`CONVERSATIONS WITH ${nm().toUpperCase()} (${C.length} saved; what the user said, newest first)`,C.slice(0,40).flatMap(c=>c.turns.slice(-3).reverse().map(t=>`- ${dlab(dayOf(t.t||c.t1))}: ${tr(t.q,160)}`)),4500);
 const A=S.settings.agent||{};
 sec('AGENT TASKS THEY SET UP',(A.tasks||[]).map(t=>`- ${t.title}${t.prompt?': '+tr(t.prompt,120):''} (${t.when||''})`),900);
 sec('AGENT RESULTS (what it found in their email, calendar and other apps)',(A.inbox||[]).slice(0,6).map(i=>`- ${dlab(dayOf(i.t))} ${i.title}: ${tr(i.summary,260)}`),1800);
 if(ME.head)sec('YOUR LAST PICTURE OF THEM',[`${dlab(dayOf(ME.t))}: ${tr(ME.head,300)}`],400);
 let o=parts.join('');if(o.length>max)o=o.slice(0,max-1)+'…';return o}

/* ---------------- writing it ---------------- */
const SYS=small=>`You are ${nm()}, the assistant inside Plotlines, the user's app for goals, habits, a journal, reminders, lists and threads. From everything below, write a detailed, honest and warm picture of who this person is, speaking to them as "you".
- Use only what the data shows. Be specific: name their real goals, habits, threads, times and numbers. When something is a guess, say "it looks like".
- Look across everything for patterns: moods next to habits and sleep, what they plan versus what they do, what they keep asking ${nm()} about, the days and times they are at their best.
- What the user told you about themselves is always true and beats anything else.
- Be kind about struggles. Never diagnose or label them.
FORMAT: Start with one line that sums them up, with no heading. Then ${small?'four to six':'six to ten'} sections, each starting with "## " and a short heading of your own, for example what you're working towards, your days and rhythms, how you've been feeling, what's on your mind, what matters to you, your strengths, where you get stuck, patterns I noticed, what I'd try next. Skip any the data can't support and add others it calls for. Short paragraphs or "- " bullets.
Finish with one line that starts "PROFILE:" and holds four or five plain sentences an assistant should always know about them.
${window.AIX?AIX.safety():''}`;
function parse(raw){let t=String(raw||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/\r/g,'').trim(),prof='';
 const pm=/^\**\s*PROFILE\s*:?\**\s*:?\s*([\s\S]*)$/im.exec(t);if(pm){prof=pm[1].replace(/[*#_`]/g,'').trim();t=t.slice(0,pm.index).trim()}
 const ch=t.split(/^#{1,3}\s+/m),head=ch.shift().replace(/^#+\s*/,'').replace(/\*\*/g,'').trim();
 const secs=ch.map(c=>{const i=c.indexOf('\n');return{h:(i<0?c:c.slice(0,i)).replace(/[*#:]/g,'').trim(),b:i<0?'':c.slice(i+1).trim()}}).filter(x=>x.h||x.b);
 return{head,secs,prof}}
async function build(o={}){if(BUSY)return;if(!(window.AIX&&AIX.ready())){if(!o.quiet)toast('Set up the AI first');return}
 const e=planEngine(),big=e==='api',sig=sigNow();BUSY=true;ERR='';OUT='';CTL=new AbortController();if(cur.p==='me')render(false);
 try{await AIX.chat([{role:'system',content:SYS(!big)},{role:'user',content:`EVERYTHING IN THE APP\n${digest(big?26000:IS_PHONE?5200:7000)}`}],x=>{OUT+=x;outPaint()},{max_tokens:big?1800:900,temperature:.5,reading:'Reading everything…',ctl:CTL});
  const P=parse(OUT);if(P.head.length+P.secs.length*40<80)throw new Error('The AI gave a very short answer. Try again, or pick a bigger model in Settings › AI & voice.');
  if(ME.head)ME.prev=[{t:ME.t,head:ME.head},...(ME.prev||[])].slice(0,8);
  Object.assign(ME,{t:Date.now(),sig,text:OUT,head:P.head,secs:P.secs,prof:P.prof,by:planEngineName(),counts:counts()});persist();
  const pt=P.prof||[P.head,...P.secs.map(s=>s.b)].join(' ').replace(/[*#_`]/g,'');if(pt.length>40){insSet().profile={t:Date.now(),text:tr(pt,900)};save()}
  if(!o.quiet&&cur.p!=='me')toast('Your picture of you is updated')}
 catch(err){if(!(CTL&&CTL.signal.aborted))ERR=String(err&&err.message||err)}
 finally{BUSY=false;CTL=null;OUT='';if(cur.p==='me')render(false)}}
function outPaint(){if(paintT)return;paintT=setTimeout(()=>{paintT=0;const el=$('#meLive');if(!el)return;const P=parse(OUT);el.innerHTML=picHTML(P,true)},220)}

/* ---------------- the page ---------------- */
const md=t=>window.AIX&&AIX.md?`<div class="ai-md">${AIX.md(t)}</div>`:`<p>${esc(t).replace(/\n+/g,'<br>')}</p>`;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<2?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString([],{month:'short',day:'numeric'})};
function picHTML(P,live){return`${P.head?`<p class="me-head">${esc(P.head)}</p>`:''}${P.secs.map((s,i)=>`<section class="panel me-s" style="--i:${i}"><div class="me-sh"><h3>${esc(s.h)}</h3>${live?'':`<button class="ibtn sm" data-act="meFix" data-h="${esc(s.h)}" aria-label="Not quite right? Tell ${esc(nm())}" title="Not quite right?">${ic('edit')}</button>`}</div>${md(s.b)}</section>`).join('')}${live?'<p class="me-cur"><i></i>Writing…</p>':''}`}
function stats(){const tn=dnum(ymd()),c=counts();let due=0,dn=0;S.habits.filter(h=>h.status==='active'&&h.kind!=='quit').forEach(h=>{for(let k=tn-29;k<tn;k++){const ds=fromN(k);try{if(hCounts(h,ds)){due++;if(hDone(h,ds))dn++}}catch(e){}}});
 const first=Math.min(Date.now(),...S.goals.map(g=>+g.createdAt||Infinity),...S.entries.map(e=>+e.t||Infinity));
 const T=[[Math.max(1,Math.round((Date.now()-first)/864e5)),'days with Plotlines'],[c.j,'journal entries'],[due?Math.round(dn/due*100)+'%':'–','habits kept (30 days)'],[c.gd,'goals reached'],[c.ct,'messages with '+esc(nm())]];
 const R=rhythm(),M=moodMix(30),mt=Object.values(M).reduce((a,b)=>a+b,0);
 return`<div class="me-st rv">${T.map(([n,l])=>`<div><b>${n}</b><small>${l}</small></div>`).join('')}</div>
 ${R.some(x=>x.n)||mt?`<div class="me-viz rv">${R.some(x=>x.n)?`<div class="panel"><h4>Your week</h4><div class="me-wk">${[1,2,3,4,5,6,0].map(i=>`<div title="${R[i].p==null?'No habits due':R[i].p+'% done'}"><i style="height:${R[i].p==null?4:Math.max(6,R[i].p)}%"></i><small>${WD[i][0]}</small></div>`).join('')}</div><p class="small muted">Habits done on each weekday, last 8 weeks</p></div>`:''}
 ${mt?`<div class="panel"><h4>Your moods</h4><div class="me-md">${Object.entries(M).sort((a,b)=>b[1]-a[1]).map(([k,n],i)=>`<i style="flex:${n};--o:${1-i*.12}" title="${esc(MOODN[k]||k)} ${n}"></i>`).join('')}</div><p class="small muted">${Object.entries(M).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>`${esc(MOODN[k]||k)} ${n}`).join(' · ')} in the last 30 days</p></div>`:''}</div>`:''}`}
function vMe(){const ready=window.AIX&&AIX.ready(),has=!!ME.text,st=stale(),sn=st?since():'';
 /* the picture keeps up: opening the page rewrites it once the data has moved on */
 if(ready&&!BUSY&&!ERR&&(!has&&hasAny()||st&&Date.now()-ME.t>2*36e5))setTimeout(()=>build({quiet:true}),300);
 return`<header class="ph"><div><h1>Picture of me</h1><div class="data">${has?`Updated ${ago(ME.t)}`:`Written by ${esc(nm())} from everything you add`}</div></div><div class="ph-r">${has&&!BUSY?`<button class="ibtn" data-act="meMore" aria-label="More">${ic('more')}</button>`:''}${gear()}</div></header>
 ${stats()}
 ${!ready?`<div class="rv">${window.AIX?AIX.modelCard('me'):''}<p class="small muted">${esc(nm())} needs the AI to write your picture. Your stats above come straight from your data.</p></div>`:''}
 ${BUSY?`<div class="me-busy rv"><span class="me-orb"></span><div><b>${has?'Updating your picture':'Getting to know you'}</b><small>Reading your goals, habits, journal, reminders, threads and conversations</small></div><button class="btn sm ghost" data-act="meStop">Stop</button></div><div id="meLive"></div>`:''}
 ${ERR&&!BUSY?`<div class="panel rv"><p class="small err">${esc(ERR)}</p><div class="actions left"><button class="btn sm pri" data-act="meGo">Try again</button></div></div>`:''}
 ${!BUSY&&st&&ready?`<div class="me-new rv"><span>${sn?`New since then: ${esc(sn)}.`:'Your data has changed since this was written.'}</span><button class="btn sm pri" data-act="meGo">${ic('ai')}Update</button></div>`:''}
 ${!BUSY&&has?`<div class="rv">${picHTML({head:ME.head,secs:ME.secs})}</div>`:''}
 ${!BUSY&&!has&&ready&&!ERR?`<div class="empty rv"><h3>${hasAny()?'Ready when you are':'Nothing to read yet'}</h3><p class="muted">${hasAny()?`${esc(nm())} reads everything in Plotlines and writes who you are, what you’re working towards and the patterns it sees.`:'Add a few habits, goals or journal entries, or chat with '+esc(nm())+', and your picture starts to fill in.'}</p>${hasAny()?`<div class="actions"><button class="btn pri" data-act="meGo">${ic('ai')}Write my picture</button></div>`:''}</div>`:''}
 <section class="panel rv me-notes"><h3>Tell ${esc(nm())} about you</h3><p class="small muted">Anything it should know or got wrong. It always goes by what you say here.</p>
 ${ME.notes.length?`<ul class="me-nl">${ME.notes.map(n=>`<li><span>${esc(n.x)}</span><button class="ibtn sm" data-act="meNoteX" data-id="${n.id}" aria-label="Remove">${ic('x')}</button></li>`).join('')}</ul>`:''}
 <form data-form="meNote"><div class="field"><textarea name="x" rows="2" maxlength="600" placeholder="I’m a night owl. I work in design. My sister Sara keeps me going…" aria-label="Something about you"></textarea></div><div class="actions left"><button class="btn sm pri">Add</button></div></form></section>
 ${(ME.prev||[]).length?`<details class="panel rv me-prev"><summary>How your picture has changed</summary>${ME.prev.map(p=>`<p class="small"><b>${new Date(p.t).toLocaleDateString([],{month:'short',day:'numeric'})}</b> ${esc(p.head)}</p>`).join('')}</details>`:''}
 <p class="small muted me-priv">${ic('lock','ico-s')} ${has?`Written by ${esc(ME.by||planEngineName())}. `:''}Kept on this device only and never synced.${planEngine()==='api'?' To write it, your data goes to the AI server you picked.':''}</p>`}
const hasAny=()=>S.goals.length||S.habits.length||S.entries.length||threads().length||(window.CONV&&CONV.list().length)||ME.notes.length;
VIEWS.me=vMe;

/* ---------------- actions ---------------- */
Object.assign(ACT,{
 meGo:()=>{ERR='';build()},
 meStop:()=>{if(CTL)CTL.abort()},
 meFix:d=>{openSheet(`<h2>Not quite right?</h2><p class="small muted">Tell ${esc(nm())} what it got wrong or missed about “${esc(d.h)}”. It goes by this from now on.</p><form data-form="meNote" data-go="1"><div class="field"><textarea name="x" rows="3" maxlength="600" aria-label="What to change"></textarea></div><div class="actions"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn pri">Save and update</button></div></form>`);setTimeout(()=>$('#sheet textarea')?.focus(),80)},
 meNoteX:d=>{ME.notes=ME.notes.filter(n=>n.id!==d.id);persist();render(false)},
 meMore:()=>openSheet(`<h2>Picture of me</h2><div class="cv-menu"><button class="btn" data-act="meGo2">${ic('ai')}Write it again</button><button class="btn" data-act="meCopy">${ic('copy')}Copy</button><button class="btn danger" data-act="meDel">${ic('trash')}Delete the picture</button></div>`),
 meGo2:()=>{closeSheet();ERR='';build()},
 meCopy:async()=>{const t=[ME.head,...ME.secs.map(s=>`${s.h}\n${s.b}`)].join('\n\n');toast(await copyText(t)?'Copied':'Copy failed');closeSheet()},
 meDel:()=>askConfirm('Delete your picture?','It’s removed from this device. What you told '+esc(nm())+' about you stays.','Delete',()=>{Object.assign(ME,{t:0,sig:'',text:'',head:'',secs:[],prof:'',counts:null,prev:[]});persist();closeSheet();render(false);toast('Picture deleted')})
});
Object.assign(FORM,{meNote:f=>{const x=String(new FormData(f).get('x')||'').trim();if(!x)return;ME.notes.push({id:uid(),t:Date.now(),x:tr(x,600)});persist();
 const again=f.dataset&&f.dataset.go;closeSheet();if(again&&window.AIX&&AIX.ready()){ERR='';build()}else{render(false);toast('Got it. It’s in your next picture.')}}});

/* a quiet daily refresh when the AI runs on your own server, so the picture (and the profile assistants read) keeps up */
function quiet(){if(!ME.text||BUSY||planEngine()!=='api'||!stale()||Date.now()-ME.t<20*36e5||document.hidden)return;if(window.AIX&&AIX.ready())build({quiet:true})}
setTimeout(quiet,60000);window.addEventListener('app-resume',()=>setTimeout(quiet,30000));
window.ME_PIC={get:()=>ME,build,stale};

const css=document.createElement('style');css.textContent=`
.me-st{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin:4px 0 12px}
.me-st div{padding:12px 14px;border-radius:18px;border:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;gap:2px}
.me-st b{font:800 26px/1 var(--f-display);color:var(--accent)}.me-st small{font-size:12px;color:var(--muted);line-height:1.25}
.me-viz{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:14px}.me-viz .panel{padding:16px 18px}.me-viz h4{margin:0 0 10px;font:700 13px var(--f-body);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.me-wk{display:flex;align-items:flex-end;gap:8px;height:84px}.me-wk div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
.me-wk i{display:block;width:100%;max-width:26px;border-radius:8px 8px 4px 4px;background:linear-gradient(to top,var(--accent),color-mix(in srgb,var(--accent) 55%,var(--c-learning,var(--accent))));transition:height .6s cubic-bezier(.2,.8,.2,1)}.me-wk small{font-size:11px;color:var(--muted)}
.me-md{display:flex;gap:3px;height:14px;border-radius:8px;overflow:hidden;margin:6px 0 10px}.me-md i{display:block;background:var(--accent);opacity:var(--o)}
.me-head{font:700 clamp(20px,5.2vw,26px)/1.3 var(--f-body);margin:6px 2px 16px;text-wrap:pretty}
.me-s{margin-bottom:10px;padding:18px 20px;animation:meIn .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i)*60ms)}
.me-sh{display:flex;align-items:center;justify-content:space-between;gap:8px}.me-s h3{margin:0 0 6px;font-size:17px}.me-sh .ibtn{opacity:.55}.me-sh .ibtn:hover,.me-sh .ibtn:focus-visible{opacity:1}
.me-busy{display:flex;align-items:center;gap:14px;padding:16px 18px;margin-bottom:12px;border-radius:22px;border:1px solid var(--line);background:var(--surface)}.me-busy div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.me-busy small{color:var(--muted);font-size:13px}
.me-orb{width:34px;height:34px;flex:none;border-radius:50%;background:conic-gradient(from 0deg,var(--accent),var(--c-learning,var(--accent)),var(--c-health,var(--accent)),var(--accent));animation:mmSpin 2.4s linear infinite;filter:saturate(1.2)}
.me-cur{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}.me-cur i{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:meBl 1s ease-in-out infinite}
.me-new{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;margin-bottom:14px;border-radius:18px;background:color-mix(in srgb,var(--accent) 12%,var(--surface))}.me-new span{flex:1;min-width:180px;font-size:14px}
.me-notes{margin:18px 0 10px}.me-notes h3{margin:0 0 4px}.me-nl{list-style:none;padding:0;margin:12px 0}.me-nl li{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}.me-nl span{flex:1;font-size:14px;line-height:1.45}
.me-prev summary{cursor:pointer;font-weight:600}.me-prev p{margin:10px 0 0}
.me-priv{display:flex;align-items:center;gap:6px;margin:12px 4px 28px}.me-priv .ico-s{width:14px;height:14px;flex:none}
@keyframes meIn{from{opacity:0;transform:translateY(10px)}}@keyframes meBl{50%{opacity:.25}}
@media(prefers-reduced-motion:reduce){.me-s,.me-orb,.me-cur i{animation:none}}
`;document.head.appendChild(css);
})();
