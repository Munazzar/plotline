/* ================= Agent: tasks Plot runs for you, with your other apps =================
   You give the agent tasks in your own words ("every morning, look at my calendar and unread email and tell me what
   matters"), pick when they run and what they may read, and it does them with the AI picked in Settings › AI & voice
   (Gemma 4 on this device, or your own server). Each run reads the sources the task allows, then writes a short
   summary and up to six suggestions: add a goal for today, set a reminder, add to the journal, a list or a thread,
   or put an event on your Google Calendar. Suggestions wait in the agent's inbox for a tap, unless the task is set to
   "Do it", which adds the Plotline ones straight away (calendar events always wait for you).
   Connections:
   - Google Calendar (read and add events), Gmail (read only), Google Drive (file names and dates): the same Google
     sign-in as Drive sync, with the extra permission asked for when you turn one on.
   - Notion: an internal integration token you paste in. Notion's API doesn't answer web pages, so the Android app sends
     those requests itself (PlotlineAssist.http); in a browser it needs a small proxy address of your own.
   When it runs: tasks run while Plotline is open (checked every minute and when you come back to the app). A task
   that comes due while the app is closed shows a notification at its time; opening Plotline runs it.
   Everything here (tasks, inbox, connections) is a setting of this device: it isn't synced, so each device's agent
   has its own. */
(()=>{
'use strict';
Object.assign(IC,{agent:'<path d="M12 3v2.5"/><circle cx="12" cy="2.6" r=".9"/><rect x="4.5" y="6" width="15" height="11.5" rx="4"/><path d="M9.2 11.2v.6M14.8 11.2v.6M9.5 14.5c1.6 1 3.4 1 5 0M2.5 11v3M21.5 11v3M9 17.5V21M15 17.5V21"/>',plug:'<path d="M9 2v5M15 2v5M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v6"/>'});
const now=()=>Date.now(),NA=window.PlotlineAssist||null;
const ADEF={on:true,tasks:[],inbox:[]};
const ag=()=>S.settings.agent=Object.assign({},ADEF,S.settings.agent||{});
const CDEF={gcal:false,gmail:false,gdrive:false,notion:false,proxy:''};
const cset=()=>S.settings.conn=Object.assign({},CDEF,S.settings.conn||{});
const NOTK='plotline.notion';
const notionKey=()=>{try{return localStorage.getItem(NOTK)||''}catch(e){return''}};

/* ---------------- connections ---------------- */
const SC={gcal:'https://www.googleapis.com/auth/calendar.events',gmail:'https://www.googleapis.com/auth/gmail.readonly',gdrive:'https://www.googleapis.com/auth/drive.metadata.readonly'};
const CN={plot:['Plotline','Your goals, habits, journal, threads and lists'],gcal:['Google Calendar','Your events, and adding new ones'],gmail:['Gmail','Searches and reads your email when a task needs it. Read only'],gdrive:['Google Drive','Finds files by name'],notion:['Notion','Pages you shared with your integration']};
window.connScopes=()=>{const c=cset();return Object.keys(SC).filter(k=>c[k]).map(k=>' '+SC[k]).join('')};
const connOn=k=>k==='plot'||(k==='notion'?!!(cset().notion&&notionKey()):!!cset()[k]);
async function googleConsent(){tokDrop();scopeSync();if(NATIVE&&NATIVE.googleToken){S.settings.sync.native=true;return nativeAuth(true)}return webAuth('consent')}
async function gapi(url,opt={}){let t=tokGet();
 if(!t){if(NATIVE&&S.settings.sync.native)t=await token(false);else throw new Error('Sign in to Google again in Agent › Connections')}
 const r=await fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+t}});
 if(r.status===401){tokDrop();try{NATIVE&&NATIVE.invalidateToken&&NATIVE.invalidateToken(t)}catch(e){}throw new Error('Sign in to Google again in Agent › Connections')}
 if(r.status===403){let m='';try{m=(await r.json()).error.message}catch(e){}throw new Error(/not been used|disabled/i.test(m)?'This Google API isn’t turned on for Plotline’s Google project yet':'Plotline needs permission for this. Turn the connection off and on again')}
 if(!r.ok)throw new Error('Google said '+r.status);return r.json()}
const iso=d=>new Date(d).toISOString();
async function calAdd(x){let body;if(x.time){const st=new Date(x.date+'T'+x.time);body={summary:x.title,start:{dateTime:iso(st)},end:{dateTime:iso(st.getTime()+(x.dur||60)*6e4)}}}
 else{const e=new Date(x.date+'T12:00');e.setDate(e.getDate()+1);body={summary:x.title,start:{date:x.date},end:{date:ymd(e)}}}
 return gapi('https://www.googleapis.com/calendar/v3/calendars/primary/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
/* ---------------- lookups the AI asks for ----------------
   The agent doesn't guess what to read from keywords: the AI is told which lookups exist, writes its own Gmail search,
   date range or search words, reads what comes back, may look again (say, open the two emails that matter), then answers. */
const b64=s=>{try{const b=atob(String(s||'').replace(/-/g,'+').replace(/_/g,'/'));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)))}catch(e){return''}};
const unhtml=h=>String(h||'').replace(/<(style|script)[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
async function mailSearch(q,n){const j=await gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${n}&q=${encodeURIComponent(q||'newer_than:2d')}`);const out=[];
 await Promise.all((j.messages||[]).map(async m0=>{try{const m=await gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m0.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);const h=k=>(((m.payload||{}).headers||[]).find(x=>x.name===k)||{}).value||'';
  out.push({id:m0.id,from:h('From').replace(/\s*<[^>]*>/,'').replace(/"/g,'').trim(),subject:h('Subject'),t:+m.internalDate,unread:(m.labelIds||[]).includes('UNREAD'),snippet:unhtml(m.snippet||'')})}catch(e){}}));return out.sort((a,b)=>b.t-a.t)}
async function mailRead(id){const m=await gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`);const P=m.payload||{},h=k=>((P.headers||[]).find(x=>x.name===k)||{}).value||'';
 let plain='',html='';const walk=p=>{if(!p)return;if(p.mimeType==='text/plain'&&p.body&&p.body.data&&!plain)plain=b64(p.body.data);else if(p.mimeType==='text/html'&&p.body&&p.body.data&&!html)html=b64(p.body.data);(p.parts||[]).forEach(walk)};walk(P);
 return{id,from:h('From').replace(/\s*<[^>]*>/,'').replace(/"/g,'').trim(),to:h('To'),subject:h('Subject'),t:+m.internalDate,text:(plain||unhtml(html)||m.snippet||'').replace(/\n{3,}/g,'\n\n').trim()}}
async function calRange(from,to,q){const a=/^\d{4}-\d{2}-\d{2}$/.test(from||'')?new Date(from+'T00:00'):new Date(new Date().setHours(0,0,0,0)),b=/^\d{4}-\d{2}-\d{2}$/.test(to||'')?new Date(to+'T23:59:59'):new Date(a.getTime()+7*864e5);
 const j=await gapi(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${iso(a)}&timeMax=${iso(b)}${q?'&q='+encodeURIComponent(q):''}`);
 return(j.items||[]).filter(e=>e.status!=='cancelled').map(e=>({title:e.summary||'(no title)',start:e.start.dateTime||e.start.date,all:!e.start.dateTime,where:e.location||'',who:(e.attendees||[]).slice(0,6).map(x=>x.displayName||x.email).join(', ')}))}
async function driveSearch(q){const w=String(q||'').replace(/'/g,"\\'").trim();const f="trashed=false and mimeType!='application/vnd.google-apps.folder'"+(w?` and name contains '${w}'`:'');
 const j=await gapi(`https://www.googleapis.com/drive/v3/files?pageSize=20&orderBy=modifiedTime%20desc&q=${encodeURIComponent(f)}&fields=files(name,mimeType,modifiedTime)`);return(j.files||[]).map(x=>({name:x.name,kind:(x.mimeType||'').split(/[./]/).pop().replace('vnd-google-apps-',''),t:Date.parse(x.modifiedTime)}))}
async function notionSearch(q){const j=await nfetch('search',{query:q||'',page_size:8,sort:{direction:'descending',timestamp:'last_edited_time'},filter:{property:'object',value:'page'}});const out=[];
 for(const p of(j.results||[]).slice(0,8)){const o={title:ntitle(p),t:Date.parse(p.last_edited_time),text:''};if(out.length<3){try{const b=await nfetch(`blocks/${p.id}/children?page_size=30`);o.text=(b.results||[]).map(x=>((x[x.type]||{}).rich_text||[]).map(r=>r.plain_text).join('')).filter(Boolean).join(' · ').slice(0,900)}catch(e){}}out.push(o)}return out}
const TOOLS={gmail:[['gmail_search','{"tool":"gmail_search","query":"<Gmail search, e.g. is:unread newer_than:1d, from:amazon, subject:invoice>","max":20}','find emails; returns id, sender, subject, date, unread, preview'],['gmail_read','{"tool":"gmail_read","id":"<id from gmail_search>"}','the full text of one email']],
 gcal:[['calendar','{"tool":"calendar","from":"YYYY-MM-DD","to":"YYYY-MM-DD","query":"<optional words>"}','events between two dates']],
 gdrive:[['drive_search','{"tool":"drive_search","query":"<words in the file name, or empty for recent>"}','files by name, newest first']],
 notion:[['notion_search','{"tool":"notion_search","query":"<words>"}','Notion pages and their text']]};
async function lookup(x,raw,small){const k=x.tool,n=Math.max(1,Math.min(+x.max||15,small?15:30));
 if(k==='gmail_search'){const M=await mailSearch(x.query,n);raw.mail.push(...M.filter(m=>!raw.mail.some(y=>y.id===m.id)));return`gmail_search "${x.query||''}": ${M.length} email${M.length===1?'':'s'}\n`+M.map(m=>`- id ${m.id} · ${dd(m.t)} ${tm(m.t)} · ${m.unread?'UNREAD · ':''}from ${tr(m.from,40)} · ${tr(m.subject,100)} · ${tr(m.snippet,small?90:160)}`).join('\n')}
 if(k==='gmail_read'){const m=await mailRead(x.id);return`gmail_read ${x.id}: from ${m.from} · ${dd(m.t)} ${tm(m.t)} · ${m.subject}\n${tr(m.text,small?1200:3500)}`}
 if(k==='calendar'){const E=await calRange(x.from,x.to,x.query);raw.cal.push(...E);return`calendar ${x.from||'today'} to ${x.to||'+7 days'}${x.query?' "'+x.query+'"':''}: ${E.length} event${E.length===1?'':'s'}\n`+E.map(e=>`- ${dd(e.start)}${e.all?' all day':' '+tm(e.start)} ${e.title}${e.where?' @ '+tr(e.where,50):''}${e.who?' with '+tr(e.who,80):''}`).join('\n')}
 if(k==='drive_search'){const F=await driveSearch(x.query);return`drive_search "${x.query||''}": ${F.length} file${F.length===1?'':'s'}\n`+F.map(f=>`- ${dd(f.t)} ${f.name} (${f.kind})`).join('\n')}
 if(k==='notion_search'){const P=await notionSearch(x.query);return`notion_search "${x.query||''}": ${P.length} page${P.length===1?'':'s'}\n`+P.map(p=>`- ${dd(p.t)} ${p.title}${p.text?': '+tr(p.text,small?300:700):''}`).join('\n')}
 return`${k}: not available`}
const HTTPCB={};window.__http=(id,st,b)=>{const f=HTTPCB[id];if(f)f(st,b)};
function nfetch(path,body){return new Promise((res,rej)=>{const key=notionKey();if(!key)return rej(new Error('Add your Notion token in Agent › Connections'));
 const url='https://api.notion.com/v1/'+path,headers={Authorization:'Bearer '+key,'Notion-Version':'2022-06-28','Content-Type':'application/json'},done=(st,txt)=>{let j=null;try{j=JSON.parse(txt)}catch(e){}st>=200&&st<300&&j?res(j):rej(new Error('Notion said '+(st||'no answer')+((j&&j.message)?': '+j.message:'')))};
 if(NA&&NA.http){const id='h'+uid();const t=setTimeout(()=>{delete HTTPCB[id];rej(new Error('Notion didn’t answer'))},45000);HTTPCB[id]=(st,b)=>{clearTimeout(t);delete HTTPCB[id];done(st,b)};NA.http(id,JSON.stringify({url,method:body?'POST':'GET',headers,body:body?JSON.stringify(body):''}));return}
 const px=cset().proxy.trim();if(!px)return rej(new Error('Notion works in the Android app. In a browser it needs a proxy address (Agent › Connections)'));
 fetch(px.replace(/\/+$/,'')+'/'+url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}).then(async r=>done(r.status,await r.text())).catch(e=>rej(new Error('Couldn’t reach your Notion proxy')))})}
const ntitle=p=>{const pr=p.properties||{};for(const k in pr){const v=pr[k];if(v&&v.type==='title')return(v.title||[]).map(t=>t.plain_text).join('')||'Untitled'}return'Untitled'};
/* ---------------- what the agent reads ---------------- */
const tm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const dd=t=>{const d=new Date(t),k=dnum(ymd(d))-dnum(ymd());return k===0?'today':k===1?'tomorrow':k===-1?'yesterday':d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})};
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
function plotLines(big){const td=ymd(),L=[];const days=S.days.filter(x=>x.date>=td&&x.date<=addDays(2)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
 if(days.length)L.push('Plan: '+days.map(x=>`${dd(x.date+'T12:00')}${x.time?' '+fmtTime(x.time):''} ${x.title}${x.done?' (done)':''}`).join('; '));
 const hs=S.habits.filter(h=>h.status==='active'&&h.kind!=='quit');if(hs.length)L.push('Habits today: '+hs.slice(0,12).map(h=>`${h.title} ${typeof hDone==='function'&&hDone(h,td)?'done':'not yet'}`).join('; '));
 const gs=S.goals.filter(g=>g.status==='active').slice(0,big?12:6);if(gs.length)L.push('Active goals: '+gs.map(g=>{const n=typeof nextStep==='function'&&nextStep(g);return`${g.title}${n?' (next: '+n.title+')':''}`}).join('; '));
 const th=(S.threads||[]).filter(t=>t.status!=='archived'&&t.status!=='done').sort((a,b)=>(b.u||0)-(a.u||0)).slice(0,big?10:5);if(th.length)L.push('Threads: '+th.map(t=>t.title).join('; '));
 const ls=(S.lists||[]).slice(0,big?10:5);if(ls.length)L.push('Lists: '+ls.map(l=>l.title).join('; '));
 const je=S.entries.filter(e=>e.type==='note'&&!e.private&&now()-e.t<3*864e5).sort((a,b)=>b.t-a.t).slice(0,3);if(je.length)L.push('Recent journal: '+je.map(e=>`${dd(e.t)}: ${tr(e.text||e.title,big?240:120)}`).join(' | '));
 return L}

/* ---------------- one run ---------------- */
const SUGT=['today','reminder','journal','list_add','thread_update','new_thread','calendar_event','goal','habit'];
const SCHEMA={type:'object',properties:{summary:{type:'string'},suggestions:{type:'array',maxItems:6,items:{type:'object',properties:{type:{enum:SUGT},text:{type:'string'},target:{type:'string'},date:{type:'string'},time:{type:'string'}},required:['type','text'],additionalProperties:false}}},required:['summary','suggestions'],additionalProperties:false};
const SCHEMA_STEP=names=>({type:'object',properties:{lookups:{type:'array',maxItems:4,items:{type:'object',properties:{tool:{enum:names},query:{type:'string'},max:{type:'integer'},id:{type:'string'},from:{type:'string'},to:{type:'string'}},required:['tool'],additionalProperties:false}},summary:{type:'string'},suggestions:SCHEMA.properties.suggestions},required:['lookups','summary','suggestions'],additionalProperties:false});
async function llm1(msgs,opts){const e=planEngine();let out='';const on=x=>{out+=x};const onP=x=>{if(x)step(x)};
 if(e==='api')await apiChat(msgs,on,null,opts);else if(e==='native')await natChat(msgs,on,onP,()=>{out=''},opts);else if(e==='wasm')await localChat(msgs,on,onP,0,()=>{out=''},false,opts);else throw new Error('Pick an AI for the agent in Settings › AI & voice');
 return out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').trim()}
/* JSON with the schema first; if the engine refuses the schema or the answer isn't JSON, once more asking for plain JSON */
async function llm(msgs,opts){let raw='',err=null;try{raw=await llm1(msgs,opts)}catch(e){err=e}
 if(parseJSON(raw))return raw;if(err&&/Pick an AI|download|memory|stopped/i.test(err.message||''))throw err;
 step('Trying again…');const o={...opts};delete o.schema;const m2=msgs.map((m,i)=>i===0?{...m,content:m.content+'\n\nReply with only the JSON object, starting with { and ending with }.'}:m);
 try{const r2=await llm1(m2,o);return r2||raw}catch(e){if(raw)return raw;throw err||e}}
let STEP='';const step=t=>{STEP=t;const el=document.getElementById('agStep');if(el)el.textContent=t;else paintSoon()};
/* an AI is picked as soon as Settings › AI & voice has an engine; an on-device model may still need its one-time
   download, which a manual run (or Download now) does. Scheduled runs wait for it, so nothing downloads gigabytes unasked. */
const aiPicked=()=>!!planEngine();
const aiOk=()=>window.AIX?AIX.ready():window.PlotDo&&PlotDo.aiReady?PlotDo.aiReady():aiPicked();
const aiModel=()=>{try{return llmOf(insSet().llm)}catch(e){return null}};
function parseJSON(s){try{return JSON.parse(s)}catch(e){}const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch(e){}}return null}
let BUSY=null,AGDL='',AGERR='',AGQ='';
async function runTask(t,manual){if(BUSY)return manual&&toast('The agent is busy with “'+BUSY+'”');if(!aiPicked()){if(manual)toast('Pick an AI first: Settings › AI & voice');return}
 if(manual&&!aiOk()){if(window.AIX){toast('Setting up the AI first. This happens once.');await AIX.setup({quiet:true});if(!aiOk())return}else aiMark()}
 BUSY=t.title;AGERR='';STEP='Starting…';paintSoon();const A=ag(),e=planEngine(),big=e==='api'||!IS_PHONE;
 try{const src=t.src&&t.src.length?t.src:['plot'],small=!big,d=new Date(),raw={mail:[],cal:[]},errs=[];
  const T=src.filter(k=>TOOLS[k]&&connOn(k)).flatMap(k=>TOOLS[k]),names=T.map(x=>x[0]);
  step('Reading your plan…');const plot=plotLines(big).map(x=>'- '+x).join('\n');
  const who=String((S.settings.assist||{}).name||'Plot').slice(0,24),today=d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const SUGS=`"suggestions" are 0 to 6 things the app can do for them, grounded in what you found: today (a goal for today; text is the goal), reminder (text, date YYYY-MM-DD, time HH:MM), journal (text to save), list_add (target is a list name, text the items), thread_update (target is a thread name, text the update), new_thread (text is its title), calendar_event (text is the title, date, time), goal (a new goal), habit (something to do regularly). Don't suggest what's already in the plan.`;
  const ANS=`"summary" is your answer, written freely in Markdown on an open canvas: build whatever layout fits the request best, using ## headings, - bullet lists, 1. numbered lists, **bold**, and tables (| col | col | with a |---| row) when comparing or listing things with several details. Answer the task fully and specifically, with the real names, subjects, dates and numbers from what you found. If you list things, list every one. Don't pad, and never invent anything that isn't in the data.
How a great answer reads: open with one bold line that gives the takeaway (e.g. "**5 unread today, 2 need a reply.**"). Then the details, grouped so they're easy to scan (by what needs action, by person, by day: whatever fits), with what's urgent or important called out in bold. End with a short "## What I'd do" list of 1 to 3 concrete next steps, and offer those same steps as suggestions so they're one tap away. Sound like a sharp, friendly assistant, not a report.`;
  const base=`You are ${who}, the user's personal agent inside the Plotline app. Today is ${today}, ${tm(d)}. ${window.AIX?AIX.safety():''}`;
  let found='',j=null;
  /* up to three rounds of lookups, each one chosen by the AI from what it has seen so far */
  for(let round=0;T.length&&round<3;round++){
   const left=3-round;
   const sys=`${base}\nYou can look things up before you answer. Lookups available:\n${T.map(x=>`- ${x[0]}: ${x[2]}. Ask with ${x[1]}`).join('\n')}\nReply with one JSON object. To look things up, put up to 4 lookups in "lookups" and leave "summary" empty and "suggestions" empty; write the queries yourself from the task (Gmail search syntax works in gmail_search). You have ${left} lookup round${left===1?'':'s'} left. When you have what you need (or nothing more would help), put [] in "lookups" and answer: ${ANS} ${SUGS}`;
   const user=`TASK: ${t.prompt}\n\nPLOTLINE (their plan)\n${plot||'(empty)'}\n\n${found?'WHAT YOU LOOKED UP SO FAR\n'+found:'You have not looked anything up yet.'}`;
   step(round?'Looking further…':'Deciding what to look up…');
   const r=parseJSON(await llm([{role:'system',content:sys},{role:'user',content:user}],{schema:SCHEMA_STEP(names),max_tokens:big?1400:900,temperature:.2,reading:'Thinking…'}))||{};
   const L=(Array.isArray(r.lookups)?r.lookups:[]).filter(x=>x&&names.includes(x.tool)).slice(0,4);
   if(!L.length){if(String(r.summary||'').trim())j=r;break}
   for(const x of L){step(`Looking up: ${x.tool.replace('_',' ')}${x.query?' “'+tr(x.query,40)+'”':''}…`);try{found+=(await lookup(x,raw,small))+'\n\n'}catch(e){errs.push(`${x.tool}: ${e.message||e}`);found+=`${x.tool} failed: ${e.message||e}\n\n`}}
   const cap=big?16000:6000;if(found.length>cap)found=found.slice(0,cap)+'\n(cut short)'}
  if(!j){step('Writing the answer…');
   const sys=`${base}\nDo the TASK using the data below. Reply with one JSON object. ${ANS} ${SUGS}`;
   const msgs=[{role:'system',content:sys},{role:'user',content:`TASK: ${t.prompt}\n\nPLOTLINE (their plan)\n${plot||'(empty)'}${found?'\n\nWHAT YOU LOOKED UP\n'+found:''}${errs.length?'\n\nCouldn’t read: '+errs.join('; '):''}`}];
   const raw2=await llm(msgs,{schema:SCHEMA,max_tokens:big?1400:900,temperature:.2,reading:'Thinking…'});j=parseJSON(raw2);
   /* not JSON: keep the words as the answer, and pick up any "ACTION: type | text" lines */
   if(!j){const P=window.AIX?AIX.parseActs(raw2,6):{clean:raw2,acts:[]},map={goal:'goal',habit:'habit',routine:'habit',list:'list_add',journal:'journal',reminder:'reminder',today:'today',thread:'new_thread'};j={summary:P.clean.replace(/^\s*\{?\s*"?summary"?\s*:\s*"?/,'').replace(/"?\s*\}?\s*$/,'').slice(0,4000),suggestions:P.acts.map(a=>({type:map[a.k],text:a.k==='list'?a.x||a.t:a.t,target:a.k==='list'?a.t:''}))}}}
  const g={errs,raw};
  if(!String(j.summary||'').trim()&&!(j.suggestions||[]).length)throw new Error('The AI gave an empty answer. Try again, or pick another model in Settings › AI & voice.');
  const sugs=(Array.isArray(j.suggestions)?j.suggestions:[]).filter(x=>x&&SUGT.includes(x.type)&&String(x.text||'').trim()).slice(0,6).map(x=>({id:uid(),type:x.type,text:tr(x.text,200),target:tr(x.target||'',60),date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:'',time:/^\d{2}:\d{2}$/.test(x.time||'')?x.time:'',st:''}));
  const item={id:uid(),t:now(),task:t.id,title:t.title,summary:String(j.summary||'').trim().slice(0,4000),data:g.raw,sugs,errs:g.errs,seen:false};
  if(t.mode==='do')for(const s of sugs)if(s.type!=='calendar_event'){try{await apply(s,true)}catch(e){}}
  A.inbox.unshift(item);A.inbox=A.inbox.slice(0,40);t.last=now();t.err='';save();
  if(!manual&&document.hidden&&typeof notify==='function')notify('Plot · '+t.title,tr(item.summary,140));
  return item}
 catch(e){t.err=String(e&&e.message||e);t.last=now();save();if(manual){AGERR=`“${t.title}” couldn’t finish: ${t.err}`;toast('The agent couldn’t finish')}}
 finally{BUSY=null;STEP='';t.next=nextAt(t,now());save();paintSoon();try{syncNative()}catch(e){}}}

/* a suggestion becomes the real thing */
async function apply(s,quiet){const D=window.PlotDo;if(!D)throw new Error('not ready');let r=null;
 const w=s.date?{date:s.date,time:s.time||'09:00',found:true}:D.parseWhen(s.text);
 switch(s.type){
  case'today':r=D.addToday(s.text);break;
  case'reminder':r=D.addReminder(w.found?(s.date?s.text:w.rest||s.text):s.text,w.found?w:{date:addDays(1),time:'09:00'});break;
  case'journal':r=D.addJournal(s.text);break;
  case'list_add':{const L=s.target&&D.pick(S.lists||[],s.target,l=>l.title);r=L?D.addTo(s.text,L.title+' list'):D.newList(s.target||'New list',D.splitItems(s.text));break}
  case'thread_update':{const T=s.target&&D.pick((S.threads||[]).filter(t=>t.status!=='archived'),s.target,t=>t.title);r=T?D.addToThread(T,s.text):D.newThread(s.target||s.text,s.target?s.text:'');break}
  case'new_thread':r=D.newThread(s.text);break;
  case'calendar_event':await calAdd({title:s.text,date:s.date||ymd(),time:s.time||''});r={say:'Added to your Google Calendar'};break;
  case'goal':case'habit':r=window.AIX?AIX.doAct({k:s.type,t:s.text,x:''}):null;break}
 s.st='done';save();if(!quiet&&r&&r.say)toast(esc(r.say));return r}

/* ---------------- when tasks run ---------------- */
const WHEN=[['open','Each time I open Plotline'],['hourly','Every hour'],['3h','Every 3 hours'],['daily','Every day at…'],['weekdays','Weekdays at…'],['weekly','Every week on…'],['manual','Only when I tap Run']];
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function nextAt(t,from){const k=t.when||'daily';if(k==='manual')return 0;if(k==='open')return(t.last||0)+4*36e5;if(k==='hourly')return from+36e5;if(k==='3h')return from+3*36e5;
 const[h,m]=(t.at||'08:00').split(':').map(Number);const d=new Date(from);d.setSeconds(0,0);d.setHours(h,m);
 for(let i=0;i<9;i++){if(d.getTime()>from&&(k==='daily'||(k==='weekdays'&&d.getDay()%6!==0)||(k==='weekly'&&d.getDay()===+(t.dow||0))))return d.getTime();d.setDate(d.getDate()+1);d.setHours(h,m)}return from+864e5}
const whenTxt=t=>{const k=t.when||'daily',at=fmtTime(t.at||'08:00');return k==='daily'?'Every day at '+at:k==='weekdays'?'Weekdays at '+at:k==='weekly'?`${DOW[+(t.dow||0)]}s at ${at}`:(WHEN.find(x=>x[0]===k)||[0,''])[1]};
async function due(){if(BUSY||!ag().on||typeof S==='undefined')return;const A=ag(),t0=now();
 for(const t of A.tasks){if(!t.on||(t.when||'daily')==='manual')continue;if(!t.next)t.next=t.when==='open'?t0:nextAt(t,t.created||t0);
  if(t.next<=t0){if(!aiOk())return;if((typeof IN!=='undefined'&&IN.busy)||(window.AS_BUSY))return;await runTask(t,false);return}}}
window.agentAlarms=(n,L)=>{if(!ag().on)return;ag().tasks.forEach(t=>{if(!t.on||!['daily','weekdays','weekly'].includes(t.when))return;const at=t.next&&t.next>n?t.next:nextAt(t,n);L.push({at,title:'Plot · '+t.title,body:'Open Plotline and I’ll run it',k:'agent',id:t.id})})};
setInterval(()=>{if(!document.hidden)due()},60e3);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(due,2500)});
window.addEventListener('app-resume',()=>setTimeout(due,2500));
setTimeout(due,6000);

/* ---------------- ready-made tasks ---------------- */
const TPL=[
 {k:'brief',title:'Morning brief',prompt:'Look at my calendar for today, my unread email and today’s plan. Tell me what matters today and what to watch out for. Suggest goals for today and reminders for anything with a time.',when:'daily',at:'07:30',src:['plot','gcal','gmail']},
 {k:'mail',title:'Email to tasks',prompt:'Go through my recent email. Find anything that needs me to do something or has a deadline, and suggest a goal for today or a reminder for each. Skip newsletters and receipts.',when:'3h',src:['gmail','plot']},
 {k:'evening',title:'Evening review',prompt:'Look at what I did today: goals done and not done, habits, and my journal. Write a short, kind review, and suggest what to carry over to tomorrow as reminders.',when:'daily',at:'21:00',src:['plot']},
 {k:'week',title:'Plan my week',prompt:'Look at my calendar for the next 7 days and my active goals. Point out busy days and free time, and suggest goals and reminders that move my goals forward in the free time.',when:'weekly',dow:0,at:'18:00',src:['plot','gcal']},
 {k:'notion',title:'Notion catch-up',prompt:'Look at the Notion pages I edited recently. Summarise what changed, and suggest thread updates or goals for today that follow from them.',when:'daily',at:'12:00',src:['notion','plot']},
 {k:'deadlines',title:'Spot deadlines',prompt:'Find dates and deadlines mentioned in my email, calendar and plan in the next two weeks that I don’t have reminders for yet, and suggest reminders for them.',when:'daily',at:'09:00',src:['gmail','gcal','plot']}];
function addTask(o){const t={id:uid(),title:o.title||'New task',prompt:o.prompt||'',when:o.when||'daily',at:o.at||'08:00',dow:o.dow||0,src:o.src||['plot'],mode:o.mode||'suggest',on:true,created:now(),last:0,next:0,err:''};t.next=t.when==='open'?now():nextAt(t,now());ag().tasks.push(t);save();try{syncNative()}catch(e){}return t}

/* "Hey Plot, every morning summarise my emails" */
window.agentFromVoice=x=>{const s=String(x||'');let when='daily',at='08:00',dow=0;const l=s.toLowerCase();
 const W=window.PlotDo&&PlotDo.parseWhen(s);if(W&&W.time&&/\d|noon|midnight/.test(l))at=W.time;
 if(/every\s+evening|each\s+evening|every\s+night/.test(l))at=W&&W.time&&/\d/.test(l)?at:'19:00';else if(/every\s+afternoon/.test(l))at=/\d/.test(l)?at:'14:00';else if(/every\s+morning|each\s+morning/.test(l))at=/\d/.test(l)?at:'08:00';
 if(/every\s+hour/.test(l))when='hourly';else if(/every\s+\d+\s+hours/.test(l))when='3h';else if(/every\s+weekday/.test(l))when='weekdays';else{const m=/every\s+(sun|mon|tues|wednes|thurs|fri|satur)day/.exec(l);if(m){when='weekly';dow=['sun','mon','tues','wednes','thurs','fri','satur'].indexOf(m[1])}else if(/every\s+week/.test(l)){when='weekly';dow=1}else if(/^(keep an eye on|watch|monitor)/.test(l))when='3h'}
 const src=['plot',...['gcal','gmail','gdrive','notion'].filter(connOn)];
 const title=tr(s.replace(/^(?:every|each)\s+\S+(?:\s+at\s+\S+(?:\s*[ap]m)?)?\s*,?\s*/i,'').replace(/^(?:keep an eye on|watch|monitor)\s+/i,'Watch ').replace(/^./,c=>c.toUpperCase()),50);
 const t=addTask({title,prompt:s,when,at,dow,src});const miss=src.filter(k=>k!=='plot'&&!connOn(k)).map(k=>CN[k][0]);
 return{say:`Okay, I'll do that ${whenTxt(t).replace(/^Every/,'every').replace(/^Weekdays/,'on weekdays')}.${miss.length?` Connect ${miss.join(' and ')} on the Agent page so I can read ${miss.length>1?'them':'it'}.`:''}`,undo:()=>{ag().tasks=ag().tasks.filter(x=>x.id!==t.id);save()},chips:[['Open agent','agent']]}};

/* ---------------- the Agent page ---------------- */
const SUGN={today:'Goal for today',reminder:'Reminder',journal:'Journal',list_add:'Add to list',thread_update:'Thread update',new_thread:'New thread',calendar_event:'Calendar event',goal:'New goal',habit:'New habit'};
const sugLine=s=>`${(s.type==='list_add'||s.type==='thread_update')&&s.target?`<b>${esc(s.target)}</b>: `:''}${esc(s.text)}${s.date||s.time?` <span class="muted">· ${esc(s.date?dd(s.date+'T12:00'):'')}${s.time?' '+esc(fmtTime(s.time)):''}</span>`:''}`;
/* a task that asks to list or show email or events also gets the actual items under the answer, straight from the data */
function dataHTML(d,sum){if(!d)return'';let o='';const op=/^\s*[-*•]\s/m.test(sum||'')?'':' open';
 if(d.mail&&d.mail.length)o+=`<details class="ag-d"${op}><summary>Looked at ${d.mail.length} email${d.mail.length===1?'':'s'}</summary><ul>${d.mail.map(m=>`<li${m.unread?' class="un"':''}><b>${esc(m.from||'(unknown)')}</b><span>${esc(m.subject||'(no subject)')}</span><small>${esc(dd(m.t))} · ${esc(tm(m.t))}${m.snippet?' · '+esc(m.snippet):''}</small></li>`).join('')}</ul></details>`;
 if(d.cal&&d.cal.length)o+=`<details class="ag-d"><summary>Looked at ${d.cal.length} event${d.cal.length===1?'':'s'}</summary><ul>${d.cal.map(e=>`<li><b>${esc(e.title)}</b><small>${esc(dd(e.start))}${e.all?' · all day':' · '+esc(tm(e.start))}${e.where?' · '+esc(e.where):''}</small></li>`).join('')}</ul></details>`;
 return o}
const sumHTML=t=>{const L=String(t||'').split('\n');let o='',ul=false;for(const r of L){const l=r.trim(),m=/^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l);if(m){if(!ul){o+='<ul class="ag-ul">';ul=true}o+=`<li>${esc(m[1]).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</li>`;continue}if(ul){o+='</ul>';ul=false}if(l)o+=`<p>${esc(l).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</p>`}return o+(ul?'</ul>':'')};
const sumHTML2=t=>window.AIX&&AIX.md?`<div class="ai-md">${AIX.md(t)}</div>`:sumHTML(t);
function inboxHTML(){const I=ag().inbox;if(!I.length)return'';
 return`<section class="rv ag-inbox"><div class="st-h"><h3>Inbox</h3>${I.length?`<button class="link" data-act="agClear">Clear</button>`:''}</div>${I.slice(0,12).map(it=>`<article class="panel ag-it${it.seen?'':' new'}"><div class="ag-h"><b>${esc(it.title)}</b><small class="muted">${esc(dd(it.t))} · ${esc(tm(it.t))}</small></div>${it.summary?sumHTML2(it.summary):''}${dataHTML(it.data,it.summary)}
  ${it.sugs.length?`<ul class="ag-s">${it.sugs.map(s=>`<li class="${s.st}"><span class="ag-k">${SUGN[s.type]}</span><span class="ag-x">${sugLine(s)}</span>${s.st==='done'?`<span class="ag-ok">${ic('check')}</span>`:s.st==='no'?'<span class="muted small">Skipped</span>':`<span class="ag-b"><button class="ibtn sm" data-act="agYes" data-i="${it.id}" data-s="${s.id}" aria-label="Do it" title="Do it">${ic('check')}</button><button class="ibtn sm" data-act="agNo" data-i="${it.id}" data-s="${s.id}" aria-label="Skip" title="Skip">${ic('plus')}</button></span>`}</li>`).join('')}</ul>${it.sugs.filter(s=>!s.st).length>1?`<div class="actions left"><button class="btn sm" data-act="agAll" data-i="${it.id}">Do all</button></div>`:''}`:''}
  ${it.errs&&it.errs.length?`<p class="small muted">Couldn’t read: ${esc(it.errs.join('; '))}</p>`:''}</article>`).join('')}</section>`}
function tasksHTML(){const T=ag().tasks;
 return`<section class="rv"><div class="st-h"><h3>Tasks</h3><button class="link" data-act="agNew">New task</button></div>${T.length?`<div class="ag-tl">${T.map(t=>`<div class="panel ag-t${t.on?'':' off'}"><div class="ag-h"><b>${esc(t.title)}</b><label class="sw ag-sw"><input type="checkbox" data-agon="${t.id}" ${t.on?'checked':''} aria-label="Run this task"><i></i></label></div>
  <p class="small">${esc(tr(t.prompt,160))}</p><p class="small muted">${esc(whenTxt(t))} · ${t.src.map(k=>CN[k]?CN[k][0]+(k!=='plot'&&!connOn(k)?' (not connected)':''):'').join(', ')}${t.mode==='do'?' · adds things itself':''}${t.last?' · last ran '+esc(dd(t.last))+' '+esc(tm(t.last)):''}</p>${t.err?`<p class="small" style="color:var(--danger,#e66)">${esc(t.err)}</p>`:''}
  <div class="actions left"><button class="btn sm pri" data-act="agRun" data-id="${t.id}" ${BUSY?'disabled':''}>${BUSY===t.title?'Running…':'Run now'}</button><button class="btn sm ghost" data-act="agEdit" data-id="${t.id}">Edit</button></div></div>`).join('')}</div>`:`<p class="small muted">No tasks yet. Start from one of these, or write your own.</p>`}
 <div class="chips" style="margin-top:10px">${TPL.map(x=>`<button class="chip" data-act="agTpl" data-k="${x.k}">${ic('plus')}${esc(x.title)}</button>`).join('')}</div></section>`}
function connHTML(){const c=cset(),nk=notionKey();
 const row=k=>{const on=connOn(k);return`<div class="ag-c"><span><b>${CN[k][0]}</b><small>${CN[k][1]}</small></span>${on?`<button class="btn sm ghost" data-act="agDisc" data-k="${k}">Disconnect</button>`:`<button class="btn sm" data-act="agConn" data-k="${k}">Connect</button>`}</div>`};
 return`<section class="panel rv" id="agConn"><h3>Connections</h3><p class="small muted">What the agent may read. Google uses the same sign-in as Drive sync and asks for the extra permission when you connect. Nothing is sent anywhere except to the AI you picked.</p>${['gcal','gmail','gdrive','notion'].map(row).join('')}
  ${c.notion||nk?`<div class="field"><label>Notion integration token</label><input type="password" data-agk="notion" value="${esc(nk)}" placeholder="ntn_…" autocomplete="off"><small class="muted">Make one at notion.so/my-integrations, then share the pages you want with it. The token stays on this device.</small></div>${NA&&NA.http?'':`<div class="field"><label>Proxy for Notion in a browser</label><input data-agk="proxy" value="${esc(c.proxy)}" placeholder="https://your-proxy.example" autocomplete="off" spellcheck="false"><small class="muted">Notion doesn’t answer web pages directly. The Android app doesn’t need this.</small></div>`}`:''}</section>`}
function aiMark(){const s=insSet(),m=aiModel();if(m&&planEngine()!=='api'){s.dl={...(s.dl||{}),[m[0]]:1};save()}}
function vAgent(){const A=ag(),e=planEngine(),picked=aiPicked(),ready=picked;const m=aiModel(),dl=picked&&!aiOk()&&e!=='api'&&m;const unseen=A.inbox.filter(i=>!i.seen).length;
 if(unseen)setTimeout(()=>{A.inbox.forEach(i=>i.seen=true);save()},1500);
 return`<header class="ph"><div><h1>Agent</h1><div class="data">${ready?`Runs on this device with ${esc(planEngineName())}`:'Pick an AI to start'}</div></div><div class="ph-r"><button class="btn pri" data-act="agNew">${ic('plus')}<span>Task</span></button>${typeof gear==='function'?gear():''}</div></header>
 ${ready?'':`<div class="panel rv"><p>${insSet().engine==='copy'?'“Copy to any AI” can’t run tasks on its own. Pick On this device or Your AI server in Settings › AI & voice.':'The agent thinks with the AI from Settings › AI & voice. Gemma 4 runs on this device; your own server works too.'}</p><div class="actions left"><a class="btn pri" href="#/settings/voice">Pick an AI</a></div></div>`}
 ${dl&&window.AIX?`<div class="rv">${AIX.modelCard('agent')}<p class="small muted">Scheduled tasks wait until the model is set up. Tasks you run yourself set it up first.</p></div>`:dl?`<div class="panel rv"><p><b>${esc(String(m[1]).split(' · ')[0])}</b> downloads once (${m[3]} GB) the first time it runs, then works offline.</p><div class="actions left"><button class="btn pri" data-act="agDl" ${AGDL?'disabled':''}>${AGDL?esc(AGDL):'Download now'}</button></div></div>`:''}
 ${BUSY?`<div class="panel rv ag-run"><span class="ag-spin" aria-hidden="true"></span><span><b>Working on “${esc(BUSY)}”</b><small id="agStep">${esc(STEP||'Starting…')}</small></span></div>`:''}
 ${AGERR?`<div class="panel rv ag-err"><p>${esc(AGERR)}</p><div class="actions left"><button class="btn sm ghost" data-act="agErrX">Dismiss</button><a class="btn sm ghost" href="#/settings/voice">AI settings</a></div></div>`:''}
 <section class="panel rv ag-ask"><div class="field"><label for="agQ">Ask the agent to do something now</label><textarea id="agQ" rows="2" placeholder="Look at my email and calendar and tell me what I’m forgetting">${esc(AGQ)}</textarea></div><div class="ag-src">${Object.keys(CN).map(k=>`<label class="chip${connOn(k)?'':' dim'}"><input type="checkbox" data-agsrc="${k}" ${connOn(k)?'checked':''} ${connOn(k)?'':'disabled'}>${CN[k][0]}</label>`).join('')}</div><div class="actions left"><button class="btn pri" data-act="agAsk" ${BUSY?'disabled':''}>${BUSY?'Working…':'Go'}</button></div></section>
 ${inboxHTML()}${tasksHTML()}${connHTML()}
 <label class="sw rv" style="margin-top:14px"><span>Run tasks on their own<small>Off pauses every task. They still run when you tap Run now.</small></span><input type="checkbox" data-agon="all" ${A.on?'checked':''}><i></i></label>`}
VIEWS.agent=vAgent;
let PT=0;function paintSoon(){clearTimeout(PT);PT=setTimeout(()=>{if(cur.p==='agent'&&!$('#sheet').classList.contains('on'))render(false)},60)}

function editSheet(t){const n=!t;t=t||{title:'',prompt:'',when:'daily',at:'08:00',dow:1,src:['plot'],mode:'suggest'};
 openSheet(`<div class="data">Agent</div><h2 style="margin-top:6px">${n?'New task':'Edit task'}</h2>
 <div class="field"><label for="agT">Name</label><input id="agT" value="${esc(t.title)}" placeholder="Morning brief" maxlength="60"></div>
 <div class="field"><label for="agP">What should it do?</label><textarea id="agP" rows="4" placeholder="Look at my calendar and email and tell me what matters today">${esc(t.prompt)}</textarea></div>
 <div class="field"><label for="agW">When</label><select id="agW">${WHEN.map(([k,l])=>`<option value="${k}" ${t.when===k?'selected':''}>${l}</option>`).join('')}</select></div>
 <div class="field ag-at"><label for="agAt">Time</label><input id="agAt" type="time" value="${esc(t.at||'08:00')}"></div>
 <div class="field ag-dow"><label for="agD">Day</label><select id="agD">${DOW.map((d,i)=>`<option value="${i}" ${+t.dow===i?'selected':''}>${d}</option>`).join('')}</select></div>
 <div class="field"><label>It may read</label><div class="ag-src">${Object.keys(CN).map(k=>`<label class="chip"><input type="checkbox" data-agt="${k}" ${t.src.includes(k)?'checked':''}>${CN[k][0]}${k!=='plot'&&!connOn(k)?' · connect first':''}</label>`).join('')}</div></div>
 <div class="field"><label>With what it finds</label><div class="radios sm wrap"><label><input type="radio" name="agM" value="suggest" ${t.mode!=='do'?'checked':''}><span>Suggest, I’ll tap</span></label><label><input type="radio" name="agM" value="do" ${t.mode==='do'?'checked':''}><span>Do it: add goals, reminders and notes itself</span></label></div></div>
 <div class="actions">${n?'':`<button class="btn danger" data-act="agDel" data-id="${t.id}">Delete</button>`}<button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="agSave" data-id="${n?'':t.id}">Save</button></div>`);
 const sync=()=>{const w=$('#agW').value;$('.ag-at').hidden=!['daily','weekdays','weekly'].includes(w);$('.ag-dow').hidden=w!=='weekly'};$('#agW').addEventListener('change',sync);sync()}
const findIt=d=>{const it=ag().inbox.find(x=>x.id===d.i);return[it,it&&it.sugs.find(s=>s.id===d.s)]};
Object.assign(ACT,{
 agNew:()=>editSheet(null),
 agEdit:d=>{const t=ag().tasks.find(x=>x.id===d.id);if(t)editSheet(t)},
 agTpl:d=>{const x=TPL.find(y=>y.k===d.k);if(!x)return;const t=addTask(x);const miss=t.src.filter(k=>k!=='plot'&&!connOn(k)).map(k=>CN[k][0]);toast(`Added “${esc(t.title)}” · ${esc(whenTxt(t))}${miss.length?' · connect '+esc(miss.join(' and ')):''}`);render(false)},
 agSave:d=>{const title=$('#agT').value.trim(),prompt=$('#agP').value.trim();if(!prompt)return toast('Say what the task should do');
  const o={title:title||tr(prompt,40),prompt,when:$('#agW').value,at:$('#agAt').value||'08:00',dow:+$('#agD').value,src:[...document.querySelectorAll('[data-agt]:checked')].map(x=>x.dataset.agt),mode:(document.querySelector('input[name=agM]:checked')||{}).value||'suggest'};if(!o.src.length)o.src=['plot'];
  if(d.id){const t=ag().tasks.find(x=>x.id===d.id);if(t){Object.assign(t,o);t.next=t.when==='open'?now():nextAt(t,now());save()}}else addTask(o);try{syncNative()}catch(e){}closeSheet();render(false)},
 agDel:d=>askConfirm('Delete this task?','Its results in the inbox stay.','Delete',()=>{const A=ag();A.tasks=A.tasks.filter(x=>x.id!==d.id);save();try{syncNative()}catch(e){}closeSheet();render(false)}),
 agRun:async d=>{const t=ag().tasks.find(x=>x.id===d.id);if(!t)return;const it=await runTask(t,true);if(it)toast('Done. See the inbox')},
 agDl:async()=>{if(AGDL)return;AGDL='Starting…';render(false);const e=planEngine(),msgs=[{role:'user',content:'Reply with OK.'}],on=()=>{},p=x=>{AGDL=(typeof x==='string'?x:x&&x.text)||AGDL;const b=document.querySelector('[data-act=agDl]');if(b)b.textContent=AGDL};
  try{aiMark();if(e==='native')await natChat(msgs,on,p,null,{});else await localChat(msgs,on,p,0,null,false,{});AGDL='';toast('Ready. The agent runs on this device now')}catch(x){AGDL='';toast('Couldn’t download: '+esc(x&&x.message||x))}render(false)},
 agAsk:async()=>{const q=($('#agQ')||{}).value||'';if(!q.trim())return toast('Say what you’d like done');AGQ=q;const src=[...document.querySelectorAll('[data-agsrc]:checked')].map(x=>x.dataset.agsrc);
  const t={id:'ask',title:tr(q,50),prompt:q,src:src.length?src:['plot'],mode:'suggest',when:'manual'};const it=await runTask(t,true);if(it){AGQ='';toast('Done. See the inbox');render(false)}},
 agYes:async d=>{const[it,s]=findIt(d);if(!s||s.st)return;try{await apply(s)}catch(e){toast('Couldn’t do that: '+esc(e.message||e))}render(false)},
 agErrX:()=>{AGERR='';render(false)},
 agNo:d=>{const[it,s]=findIt(d);if(!s)return;s.st='no';save();render(false)},
 agAll:async d=>{const it=ag().inbox.find(x=>x.id===d.i);if(!it)return;let n=0;for(const s of it.sugs)if(!s.st){try{await apply(s,true);n++}catch(e){}}toast(`Done ${n} of them`);render(false)},
 agClear:()=>askConfirm('Clear the inbox?','Suggestions you haven’t acted on are dropped.','Clear',()=>{ag().inbox=[];save();render(false)}),
 agConn:async d=>{const k=d.k,c=cset();
  if(k==='notion'){c.notion=true;save();render(false);setTimeout(()=>{const i=document.querySelector('[data-agk=notion]');if(i)i.focus()},120);return}
  if(!cfg().clientId)return toast('Set up Google sign-in in Settings › You & sync first');
  c[k]=true;save();try{await googleConsent();toast(`${CN[k][0]} connected`)}catch(e){c[k]=false;save();scopeSync();toast('Google sign-in didn’t finish: '+esc(e&&e.message||'cancelled'))}render(false)},
 agDisc:d=>{const c=cset();c[d.k]=false;if(d.k==='notion'){try{localStorage.removeItem(NOTK)}catch(e){}}save();scopeSync();toast(CN[d.k][0]+' disconnected');render(false)}});
document.addEventListener('change',e=>{const x=e.target;if(!x.dataset)return;
 if(x.dataset.agon){if(x.dataset.agon==='all')ag().on=x.checked;else{const t=ag().tasks.find(y=>y.id===x.dataset.agon);if(t){t.on=x.checked;if(t.on)t.next=t.when==='open'?now():nextAt(t,now())}}save();try{syncNative()}catch(_){}render(false)}
 else if(x.dataset.agk==='notion'){try{x.value.trim()?localStorage.setItem(NOTK,x.value.trim()):localStorage.removeItem(NOTK)}catch(_){}cset().notion=!!x.value.trim();save();if(x.value.trim())nfetch('users/me').then(()=>toast('Notion connected')).catch(err=>toast(esc(err.message)));render(false)}
 else if(x.dataset.agk==='proxy'){cset().proxy=x.value.trim();save()}});

/* the agent in the app: a page in More (PG in index.html), a section in Settings, new results on Home */
{const _ss=setSecs;setSecs=function(){const L=_ss(),i=L.findIndex(x=>x.k==='voice');L.splice(i<0?L.length:i+1,0,{k:'agent',t:'Agent & connections',ic:'agent',sub:()=>{const n=ag().tasks.filter(t=>t.on).length,c=['gcal','gmail','gdrive','notion'].filter(connOn).length;return`${n} task${n===1?'':'s'} · ${c} connection${c===1?'':'s'}`},html:()=>connHTML()+`<div class="actions left rv" style="margin-top:12px"><a class="btn" href="#/agent">${ic('agent')}Open the Agent</a></div>`});return L}}
if(typeof homeTop==='function'){const _ht=homeTop;homeTop=function(){const n=ag().inbox.filter(i=>!i.seen).length;return(n?`<a class="panel rv ag-home" href="#/agent"><span class="ag-hi">${ic('agent')}</span><span><b>Plot has ${n} new result${n===1?'':'s'}</b><small>${esc(tr(ag().inbox[0].summary||ag().inbox[0].title,90))}</small></span>${ic('next','ico-s')}</a>`:'')+_ht()}}

const css=document.createElement('style');css.textContent=`
.ag-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.ag-it .ag-h b{font:700 16px/1.3 var(--f-body);text-transform:none;letter-spacing:0;min-width:0}
.ag-ul{margin:6px 0 10px;padding-left:20px}.ag-ul li{margin:3px 0;line-height:1.45}
.ag-d{margin:10px 0;border:1px solid var(--line);border-radius:14px;padding:4px 12px}.ag-d summary{cursor:pointer;padding:8px 0;font:600 13px var(--f-body);color:var(--accent)}.ag-d ul{list-style:none;margin:0 0 6px;padding:0}.ag-d li{display:flex;flex-direction:column;padding:8px 0;border-top:1px solid var(--line);min-width:0}.ag-d li b{font-size:14px}.ag-d li span{font-size:14px;overflow-wrap:anywhere}.ag-d li small{color:var(--muted);font-size:12px;overflow-wrap:anywhere}.ag-d li.un b::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:1px}.ag-h small{white-space:nowrap}
.ag-it{margin-bottom:12px}.ag-it.new{box-shadow:inset 3px 0 0 var(--accent)}.ag-it p{margin:8px 0}
.ag-s{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.ag-s li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 10px;padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--text) 5%,transparent)}.ag-s li>:nth-child(n+3){grid-column:2;grid-row:1/span 2}
.ag-s li.done,.ag-s li.no{opacity:.6}.ag-k{grid-column:1;font:700 10.5px var(--f-body);text-transform:uppercase;letter-spacing:.07em;color:var(--accent)}
.ag-x{grid-column:1;min-width:0;overflow-wrap:anywhere;font-size:14.5px;line-height:1.4}.ag-b{display:flex;gap:4px}.ag-b .ibtn:last-child svg{transform:rotate(45deg)}.ag-ok{color:var(--accent)}
.ag-tl{display:flex;flex-direction:column;gap:10px}.ag-t.off{opacity:.55}.ag-t p{margin:6px 0}
.ag-c{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid color-mix(in srgb,var(--text) 8%,transparent)}.ag-c span{display:flex;flex-direction:column}.ag-c small{color:var(--muted);font-size:12px}
.ag-src{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}.ag-src .chip{position:relative;color:var(--muted)}.ag-src .chip input{position:absolute;opacity:0;pointer-events:none}.ag-src .chip::before{content:'';width:8px;height:8px;border-radius:50%;border:1.5px solid currentColor;box-sizing:border-box}.ag-src .chip:has(input:checked){color:var(--text);background:color-mix(in srgb,var(--accent) 14%,var(--surface));border-color:color-mix(in srgb,var(--accent) 55%,transparent)}.ag-src .chip:has(input:checked)::before{background:var(--accent);border-color:var(--accent)}.ag-src .chip:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}.ag-src .chip.dim{opacity:.45}
.ag-home{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;margin-bottom:12px}.ag-home span:nth-child(2){flex:1;display:flex;flex-direction:column;min-width:0}.ag-home small{color:var(--muted);font-size:12px}
.ag-hi{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}
.sw.ag-sw{margin:0;padding:0;border:0}
.ag-run{display:flex;align-items:center;gap:12px;margin-bottom:12px}.ag-run>span:last-child{display:flex;flex-direction:column;min-width:0}.ag-run small{color:var(--muted);font-size:12.5px}
.ag-spin{width:22px;height:22px;border-radius:50%;flex:none;border:2.5px solid color-mix(in srgb,var(--accent) 25%,transparent);border-top-color:var(--accent);animation:mmSpin .8s linear infinite}
.ag-err{margin-bottom:12px;border-color:color-mix(in srgb,var(--danger,#e66) 45%,transparent)}.ag-err p{margin:0 0 4px}`;
document.head.appendChild(css);
if(typeof booted!=='undefined'&&booted&&/^#\/agent(\/|$)/.test(location.hash)&&cur.p!=='agent')route();
})();
