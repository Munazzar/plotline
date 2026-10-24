/* ================= Hey Plot: the voice assistant =================
   Say "Hey Plot" (or tap the orb in the top bar) and ask in your own words:
   - do things: add to today's journal, start a thread or add to one, set a reminder, add to a list,
     add a goal for today, mark a habit done, open a page, rename the assistant;
   - ask things: "when did I last change my oil?", "what's on my groceries list?", "what do I have today?".
     Facts like these are looked up in your own data on the phone, with no AI needed. Anything more open goes to
     the AI picked for Ask (on-device or your own server), told to answer in a sentence or two.
   Replies show as text and are read out (Android's text-to-speech, or the browser's).
   The name is yours to pick (Settings › AI & voice): "Hey Nova", "Hey Jarvis"…
   Wake word on Android (PlotlineAssist, Assist.java): the phone's speech recognizer runs in a loop and listens
   for "hey <name>" while Plotlines is open, or, if you turn it on, in the background with a "Listening"
   notification (Android only lets the system's own assistant listen for free, without one).
   The last exchange is sent to the "Plotlines · Assistant" home-screen widget. */
(()=>{
'use strict';
const NA=!window.PLOT_DEMO&&window.PlotlineAssist||null;
const ADEF={name:'Plot',wake:false,bg:false,speak:'voice',btn:true,talk:true,fast:true};
/* instant mode (Settings › AI & voice): commands and simple lookups are answered on the phone without the AI, questions skip
   the extra AI routing call, spoken answers get a short prompt, and speech starts with the first sentence */
const fastOn=()=>aset().fast!==false;
const aset=()=>({...ADEF,...(S.settings.assist||{})});
const aname=()=>String(aset().name||'').replace(/[^\p{L}\p{N} '\-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24)||'Plot';
const wakeWord=()=>'Hey '+aname();
const AS={turns:[],busy:false,listening:false,await:null,undo:{},spoken:false,after:null,ctl:null,cid:null,kind:'chat',last:0};
/* every chat and talk is kept as its own conversation (convs.js): AS.cid is the one on screen. After a long pause the next
   message starts a new one; the earlier one stays in Conversations, where it can be read and continued. */
const CV_GAP=30*60e3;
function convSync(){if(!window.CONV)return;const L=AS.turns.filter(t=>!t.wait&&t.a);if(!L.length)return;AS.cid=CONV.sync(AS.cid,AS.kind,L);AS.last=Date.now()}
function convFresh(kind){AS.turns=[];AS.await=null;AS.undo={};AS.cid=null;AS.kind=kind||'chat'}
const nst=()=>{if(!NA||!NA.state)return{};try{return JSON.parse(NA.state())}catch(e){return{}}};
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const lcs=s=>String(s||'').toLowerCase();

Object.assign(IC,{speak:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',orb:'<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2c1.2-2.6 2.3-2.6 3.5 0s2.3 2.6 3.5 0"/>',kb:'<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>'});

/* ---------------- words ---------------- */
const SW=new Set('a an the and or to of in on at for with about my me i im i\'m you your it its is are was were be been do did does done have has had when what which who how last time ever please can could would will should just that this these those there then than from by into up out so some any much many'.split(' '));
const stem=w=>w.length>3?w.replace(/(ing|ings|ed|es|s|e)$/,''):w;
const toks=s=>(lcs(s).match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>!SW.has(w)).map(stem).filter(w=>w.length>1);
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return m||n;let p=[...Array(n+1).keys()];for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
/* best match for a spoken name among titles (lists, threads, habits) */
function pick(arr,name,get){const q=lcs(name).replace(/^(my|the)\s+/,'').replace(/\s+(list|thread|habit)$/,'').trim();if(!q)return null;const qt=toks(q);let best=null,bs=0;
 arr.forEach(o=>{const t=lcs(get(o)).trim();if(!t)return;let s=0;if(t===q)s=10;else if(t.replace(/[^\p{L}\p{N} ]/gu,'').trim()===q)s=9;else if(t.includes(q)||q.includes(t))s=6;else{const tt=toks(t);const hit=qt.filter(w=>tt.some(x=>x===w||(w.length>3&&lev(x,w)<=1))).length;if(hit)s=4*hit/Math.max(qt.length,tt.length)}if(s>bs){bs=s;best=o}});
 return bs>=2?best:null}
const relDay=t=>{const n=dnum(ymd())-dnum(ymd(new Date(t)));if(n<=0)return'today';if(n===1)return'yesterday';if(n<14)return n+' days ago';if(n<60)return Math.round(n/7)+' weeks ago';if(n<730)return Math.round(n/30.4)+' months ago';return Math.round(n/365)+' years ago'};
const longDate=t=>new Date(t).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',...(new Date(t).getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})});
const atTxt=(date,time)=>`${date===ymd()?'today':date===addDays(1)?'tomorrow':longDate(new Date(date+'T12:00'))}${time?' at '+fmtTime(time):''}`;
const quote=s=>'“'+trunc(String(s||'').replace(/\s+/g,' ').trim(),140)+'”';

/* ---------------- when: "at 5pm", "in 20 minutes", "tomorrow morning", "on Friday at 9" ---------------- */
const WD=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MO=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const NUMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,thirty:30,forty:40,'forty-five':45,half:.5,couple:2,few:3};
function parseWhen(src){let s=' '+String(src||'').replace(/\b([ap])\.\s?m\.?/gi,'$1m').replace(/\s+/g,' ')+' ';const now=new Date();let date=null,time=null,found=false;
 const cut=re=>{const m=re.exec(s);if(!m)return null;s=s.slice(0,m.index)+' '+s.slice(m.index+m[0].length);found=true;return m};
 let m=cut(/\s(?:in|after)\s+(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty-five|half an?|a couple of|a few)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)(?:\s+and\s+a\s+half)?(?=[\s,.!?])/i);
 if(m){let n=parseFloat(m[1]);if(isNaN(n))n=NUMW[lcs(m[1]).split(' ')[0]]||1;if(/half/i.test(m[1]))n=.5;if(/and a half/i.test(m[0]))n+=.5;const u=lcs(m[2])[0],ms=u==='m'?6e4:u==='h'?36e5:u==='d'?864e5:6048e5;const d=new Date(Date.now()+n*ms);if(u==='m'||u==='h'){date=ymd(d);time=pad2(d.getHours())+':'+pad2(d.getMinutes())}else date=ymd(d)}
 if(cut(/\s(?:the\s+)?day after tomorrow(?=[\s,.!?])/i))date=addDays(2);
 let part=null;
 if((m=cut(/\s(tomorrow|tonight|today|this)\s*(morning|afternoon|evening|night)?(?=[\s,.!?])/i))){const w=lcs(m[1]);if(w==='tomorrow')date=addDays(1);else if(w!=='this'||m[2])date=date||ymd();if(w==='tonight')part='night';if(m[2])part=lcs(m[2])}
 if((m=cut(/\s(?:on\s+|this\s+|next\s+|coming\s+)?(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?(?=[\s,.!?])/i))){const k=WD.findIndex(d=>d.startsWith(lcs(m[1]).slice(0,3)));let add=(k-now.getDay()+7)%7;if(add===0||/next/i.test(m[0])&&add<7)add=add||7;date=addDays(add)}
 if((m=cut(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?=[\s,.!?])/i))||(m=cut(/\s(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?=[\s,.!?])/i))){const a=isNaN(+m[1])?[m[2],m[1]]:[m[1],m[2]];const mo=MO.indexOf(lcs(a[1]).slice(0,3));let d=new Date(now.getFullYear(),mo,+a[0]);if(ymd(d)<ymd())d=new Date(now.getFullYear()+1,mo,+a[0]);date=ymd(d)}
 else if((m=cut(/\son\s+the\s+(\d{1,2})(?:st|nd|rd|th)(?=[\s,.!?])/i))){let d=new Date(now.getFullYear(),now.getMonth(),+m[1]);if(ymd(d)<ymd())d=new Date(now.getFullYear(),now.getMonth()+1,+m[1]);date=ymd(d)}
 if(cut(/\s(?:at\s+)?noon(?=[\s,.!?])/i))time='12:00';else if(cut(/\s(?:at\s+)?midnight(?=[\s,.!?])/i))time='23:59';
 else if((m=cut(/\s(?:at|by|around|for)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'?clock)(?=[\s,.!?])/i))||(m=cut(/\s(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?(?=[\s,.!?])/i))||(m=cut(/\s(\d{1,2}):(\d{2})(?=[\s,.!?])/i))){let h=+m[1];const mi=+(m[2]||0),ap=lcs(m[3]||'');if(h<=23&&mi<=59){if(ap==='pm'&&h<12)h+=12;else if(ap==='am'&&h===12)h=0;else if(ap!=='am'&&ap!=='pm'){if(part&&/afternoon|evening|night/.test(part)&&h<12)h+=12;else if(!part&&h>=1&&h<=7)h+=12}time=pad2(h)+':'+pad2(mi)}}
 if(!time&&part)time={morning:'09:00',afternoon:'15:00',evening:'19:00',night:'20:00'}[part];
 if(time&&!date){date=ymd();const[h,mi]=time.split(':').map(Number);const t=new Date();t.setHours(h,mi,0,0);if(t<=now){if(h<12&&!/am/i.test(src)&&h+12<24&&new Date(new Date().setHours(h+12,mi,0,0))>now)time=pad2(h+12)+':'+pad2(mi);else date=addDays(1)}}
 if(date&&!time)time='09:00';
 return{date,time,found,rest:s.replace(/\s+/g,' ').trim()}}

/* ---------------- doing things ---------------- */
const PRE=/^(?:(?:hey|hi|ok(?:ay)?)\s+\S+[,!.]?\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|please\s+|i\s+(?:want|need|would like|'d like)\s+(?:you\s+)?to\s+|i\s+wanna\s+|let'?s\s+|go\s+ahead\s+and\s+)*/i;
const clean=s=>String(s||'').replace(/^[\s,:;-]+|[\s,.!?]+$/g,'').trim();
const strip=s=>clean(String(s||'').replace(PRE,''));
const today=()=>ymd();
function addJournal(text){text=cap(clean(text));const t=today();
 let e=S.entries.filter(x=>x.type==='note'&&!x.private&&ymd(new Date(x.t))===t&&x.va).sort((a,b)=>b.t-a.t)[0];const id=e&&e.id,prev=e&&{text:e.text,html:e.html};
 if(e){e.html=(e.html||(e.text?`<p>${esc(e.text).replace(/\n/g,'<br>')}</p>`:''))+`<p>${esc(text)}</p>`;e.text=htmlText(e.html);e.u=Date.now()}
 else{e={id:uid(),t:Date.now(),type:'note',goalId:null,title:'',text,html:`<p>${esc(text)}</p>`,mood:'',private:false,sid:null,img:null,va:1};S.entries.push(e)}
 save();rerender();const eid=e.id;
 return{say:`Added to today's journal: ${quote(text)}`,undo:()=>{const x=S.entries.find(y=>y.id===eid);if(!x)return;if(id){x.text=prev.text;x.html=prev.html}else S.entries=S.entries.filter(y=>y.id!==eid);save();rerender()},chips:[['Open journal','journal']]}}
function newThread(title,first){title=cap(clean(title)).slice(0,80);const now=Date.now(),t={id:uid(),title,link:null,status:'open',created:now,u:now,ups:[]};if(first)t.ups.push({id:uid(),t:now,k:'note',x:cap(clean(first)),u:now});threads().push(t);save();rerender();
 return{say:`Started a new thread, ${quote(title)}${first?', with your first update':''}.`,undo:()=>{S.threads=threads().filter(x=>x.id!==t.id);save();rerender()},chips:[['Open thread','thread/'+t.id]]}}
function addToThread(th,x){x=cap(clean(x));const now=Date.now(),u={id:uid(),t:now,k:'note',x,u:now};th.ups.push(u);if(th.status==='done')th.status='open';th.u=now;save();rerender();
 return{say:`Added to your ${th.title} thread: ${quote(x)}`,undo:()=>{th.ups=th.ups.filter(y=>y.id!==u.id);save();rerender()},chips:[['Open thread','thread/'+th.id]]}}
function addToList(L,items){const its=items.map(x=>cap(clean(x))).filter(Boolean);if(!its.length)return null;const ids=[];
 its.forEach(t=>{const i=uid();ids.push(i);cardsFromQueue({src:'list',id:L.id,i,op:'add',t})});save();rerender();
 const n=its.length;return{say:`Added ${n===1?quote(its[0]):n+' items'} to your ${L.title} list.`,undo:()=>{ids.forEach(i=>cardsFromQueue({src:'list',id:L.id,i,op:'del'}));save();rerender()},chips:[['Open list','list/'+L.id]]}}
function addToday(title){title=cap(clean(title)).slice(0,90);const x={id:uid(),title,date:today(),time:'',goalId:null,done:false,doneAt:null,createdAt:Date.now()};S.days.push(x);save();rerender();
 return{say:`Added ${quote(title)} to today's goals.`,undo:()=>{S.days=S.days.filter(y=>y.id!==x.id);save();rerender()},chips:[['Open today','today']]}}
function addReminder(title,w){title=cap(clean(title).replace(/^(?:(?:me|to|that|about|for)\s+)+/i,'')).slice(0,90);const x={id:uid(),title,date:w.date,time:w.time,dur:15,goalId:null,done:false,doneAt:null,createdAt:Date.now(),remind:'0'};S.days.push(x);save();try{syncNative()}catch(e){}rerender();
 return{say:`Okay, I'll remind you ${atTxt(w.date,w.time)}: ${quote(title)}.${NATIVE?'':' Keep Plotlines open in this browser for the reminder to show.'}`,undo:()=>{S.days=S.days.filter(y=>y.id!==x.id);save();try{syncNative()}catch(e){}rerender()},chips:[['Open calendar','cal-'+w.date]]}}
function markDone(name){const h=pick(S.habits.filter(x=>!x.archived),name,x=>x.title);
 if(h){const d=today(),prev=hVal(h,d);hSetVal(h,d,hTarget(h));h.u=Date.now();save();try{checkMilestones()}catch(e){}rerender();return{say:`Nice. Marked ${quote(h.title)} done for today.`,undo:()=>{hSetVal(h,d,prev);save();rerender()},chips:[['Open habit','habit/'+h.id]]}}
 const x=pick(S.days.filter(y=>y.date===today()&&!y.done),name,y=>y.title);
 if(x){x.done=true;x.doneAt=Date.now();save();rerender();return{say:`Done: ${quote(x.title)}.`,undo:()=>{x.done=false;x.doneAt=null;save();rerender()},chips:[['Open today','today']]}}
 const st=[];active().forEach(g=>(g.steps||[]).forEach(s=>{if(!s.done)st.push({g,s})}));const o=pick(st,name,y=>y.s.title);
 if(o&&ACT.toggleStep){const d={g:o.g.id,s:o.s.id};ACT.toggleStep(d);return{say:`Done: ${quote(o.s.title)}, a step in ${o.g.title}.`,undo:()=>{if(o.s.done)ACT.toggleStep(d)},chips:[['Open goal','goal/'+o.g.id]]}}
 return{say:`I couldn't find a habit or goal for today called ${quote(name)}.`}}
/* trackers (trackers.js): "log 20 minutes of yoga", "I drank 2 glasses of water", "I meditated for 10 minutes" */
const NUMRX='(\\d+(?:\\.\\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty-five|sixty|half an?)';
const UNITRX='(minutes?|mins?|hours?|hrs?|km|kilomet(?:er|re)s?|miles?|pages?|glass(?:es)?|cups?|reps?|times?|steps?)';
const num=w=>{const n=parseFloat(w);if(!isNaN(n))return n;const l=lcs(w);return/^half/.test(l)?.5:l==='sixty'?60:NUMW[l]||1};
const RX_TRK=new RegExp(`^(?:log|add|track|record|count|i\\s+(?:did|drank|had|read|ran|walked|cycled|rode|swam|practi[cs]ed|meditated|played))\\s+${NUMRX}\\s*${UNITRX}?\\s+(?:of\\s+)?(.+?)(?:\\s+(?:today|just now|this morning))?$`,'i');
const RX_TRK2=new RegExp(`^i\\s+(?:just\\s+)?([a-z]+?)(?:ed)?\\s+for\\s+${NUMRX}\\s*${UNITRX}(?:\\s+today)?$`,'i');
const trkPick=name=>{if(!window.TRK)return null;const L=TRK.list();if(!L.length)return null;const q=lcs(name).replace(/^(?:of|my|the)\s+/,'').trim();return L.find(t=>lcs(t.n)===q)||L.find(t=>q&&lcs(t.n).includes(q))||pick(L,q,t=>t.n)};
function trkLog(id,n,u){const T=window.TRK&&TRK.list().find(t=>t.id===id);if(!T)return null;const lu=lcs(u||'');
 if(/^h/.test(lu)&&T.u==='min')n*=60;else if(/^m(?:in|$)/.test(lu)&&T.u==='h')n/=60;
 const d=today(),prev=TRK.man(T.id,d);TRK.setVal(T.id,d,prev+n);rerender();const v=TRK.val(T.id,d);
 return{say:`Logged ${TRK.fmt(n,T.u)} of ${T.n}. ${T.g?v>=T.g?`That’s ${TRK.fmt(v,T.u)} today, goal reached.`:`That’s ${TRK.fmt(v,T.u)} of ${TRK.fmt(T.g,T.u)} today.`:`That’s ${TRK.fmt(v,T.u)} today.`}`,undo:()=>{TRK.setVal(T.id,d,prev);rerender()},chips:[['Open activity','activity']]}}
/* "snooze", "snooze it for an hour", "snooze my reminder until 6pm": the reminder that just went off, or else the next one */
function snooze(x){const now=Date.now(),R=S.days.filter(d=>!d.done&&d.time&&d.remind!=null&&d.remind!=='').map(d=>({d,t:new Date(d.date+'T'+d.time).getTime()}));
 const o=R.filter(z=>z.t<=now+5*6e4&&z.t>now-12*36e5).sort((a,b)=>b.t-a.t)[0]||R.filter(z=>z.t>now).sort((a,b)=>a.t-b.t)[0];
 if(!o)return{say:'There’s no reminder to snooze right now.'};
 const m=new RegExp(NUMRX+'\\s*(minutes?|mins?|hours?|hrs?)','i').exec(x||'');let w=null;
 if(m){const t=new Date(now+num(m[1])*(/^h/i.test(m[2])?36e5:6e4));w={date:ymd(t),time:pad2(t.getHours())+':'+pad2(t.getMinutes())}}
 else{const p=parseWhen(x||'');if(p.found)w={date:p.date,time:p.time}}
 if(!w){const t=new Date(now+10*6e4);w={date:ymd(t),time:pad2(t.getHours())+':'+pad2(t.getMinutes())}}
 const it=o.d,prev={date:it.date,time:it.time};it.date=w.date;it.time=w.time;save();try{syncNative()}catch(e){}rerender();
 return{say:`Snoozed ${quote(it.title)} until ${atTxt(w.date,w.time)}.`,undo:()=>{it.date=prev.date;it.time=prev.time;save();try{syncNative()}catch(e){}rerender()}}}
const PAGES={trackers:'activity',today:'today',home:'today',goals:'goals',habits:'habits',journal:'journal',thread:'threads',threads:'threads',lists:'lists',calendar:'cal',settings:'settings',ask:'ask',insights:'ask',activity:'activity',timeline:'road',vista:'road',map:'map',agent:'agent'};

/* "add X to Y": Y can be a list, a thread, the journal or today */
function addTo(what,where){const w=lcs(where).replace(/^(?:my|the)\s+/,'').trim();
 if(/^(?:today'?s\s+)?journal(?:\s+(?:entry\s+)?(?:for\s+)?today)?$|^(?:my\s+)?diary$/.test(w))return addJournal(what);
 if(/^(?:today'?s\s+goals?|goals?\s+for\s+today|today|my\s+day|today'?s\s+list|to-?dos?\s+for\s+today)$/.test(w))return addToday(what);
 const isThr=/\sthread$/.test(w),isList=/\slist$/.test(w)||/^(?:shopping|grocery|groceries|packing|to-?do)/.test(w);
 if(!isList){const th=pick(threads().filter(t=>t.status!=='archived'),w,t=>t.title||t.name);if(th)return addToThread(th,what);if(isThr)return{say:`I couldn't find a thread called ${quote(where.replace(/\s*thread$/i,''))}. Should I start it?`,chips:[['Start it','',()=>run(`new thread ${where.replace(/\s*thread$/i,'')}`)]],await:{k:'yesno',yes:()=>newThread(where.replace(/\s*thread$/i,''),what)}}}
 const L=pick(S.lists||[],w,l=>l.title);if(L)return addToList(L,splitItems(what));
 if(isList)return{say:`I couldn't find a list called ${quote(where.replace(/\s*list$/i,''))}.`,chips:[['Open lists','lists']]};
 return null}
const splitItems=s=>String(s).split(/\s*,\s*(?:and\s+)?|\s+and\s+(?=\S)/i).map(clean).filter(Boolean);

/* typed or misheard keywords: "jounel", "journel", "general entry", "liost", "lsit", "thred". Only the command words get fixed,
   only near the start or end where commands live, and only when the word isn't a real word of its own ("lost", "threat") */
function osa(a,b){const m=a.length,n=b.length,d=[];for(let i=0;i<=m;i++){d[i]=[i];for(let j=1;j<=n;j++)d[i][j]=i?0:j}
 for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[m][n]}
const KEYW=['journal','diary','entry','thread','list','reminder','remind','habit'];
const REALW=new Set('lost last least lust lint lift list lists mist fist gist entre enter entire entity threat threats three tread treat thready dairy dear diet habitat rabbit remain remained remains reminds remainder journey journals tourney entry entries'.split(' '));
const KFIX={jounel:'journal',jounal:'journal',journl:'journal',jurnal:'journal',jornal:'journal',jornel:'journal',jurnel:'journal',jernal:'journal',journall:'journal',jouranl:'journal',joural:'journal',journa:'journal',jounral:'journal',dairy_entry:'diary',thred:'thread',threed:'thread',therad:'thread',thead:'thread',trhead:'thread',liost:'list',lsit:'list',lst:'list',lis:'list',lisst:'list',listt:'list',ilst:'list',entery:'entry',enrty:'entry',entyr:'entry',entree:'entry',entri:'entry',entrie:'entry',remidner:'reminder',reminer:'reminder',remider:'reminder'};
function fixWord(w){const lw=lcs(w);if(KFIX[lw])return KFIX[lw];if(lw.length<4||REALW.has(lw)||KEYW.includes(lw))return w;
 let best=null,bd=9;KEYW.forEach(k=>{const d=osa(lw,k),ok=k.length>=6?2:1;if(d<=ok&&d<bd&&lw[0]===k[0]){bd=d;best=k}});return best||w}
function normCmd(t){t=String(t||'').replace(/\b(?:general|journey|germinal)\s+(entry|entries|note)\b/gi,'journal $1').replace(/\bdairy\s+(entry|note)\b/gi,'diary $1').replace(/\bjournal\s+(?:and\s+)?tree\b/gi,'journal entry');
 const parts=t.split(/(\s+)/),words=parts.filter((_,i)=>i%2===0),n=words.length;let wi=0;
 return parts.map((p,i)=>{if(i%2)return p;const k=wi++;if(k>7&&k<n-4)return p;const m=/^([^\p{L}]*)([\p{L}']+)([^\p{L}]*)$/u.exec(p);if(!m)return p;const f=fixWord(m[2]);return f===m[2]?p:m[1]+f+m[3]}).join('')}
/* what's left after the command words: "make a journal entry that says I ran 5k" → "I ran 5k" */
const SAYS=/^(?:(?:that|which)\s+(?:says?|reads?|goes)|saying|says|reading|with(?:\s+the\s+text)?|that|about|of|on|re|regarding|like)\b\s*[:,\-–—]?\s*|^[:,\-–—]\s*/i;
const body=s=>{s=clean(s);for(let i=0;i<3;i++){const n=s.replace(SAYS,'');if(n===s)break;s=n}return clean(s.replace(/\s+(?:to|in|into|on)\s+(?:my\s+|the\s+)?(?:today'?s\s+)?(?:journal|diary)(?:\s+entry)?$/i,''))};
const VERB='(?:add|put|write|save|log|note(?:\\s+down)?|jot(?:\\s+down)?|record|make|create|start|begin|open|do|take|type|enter|compose|draft|set\\s+up|kick\\s+off|new)';
const DET='(?:(?:a|an|the|my|new|today\'?s|another|one|quick|fresh|brand\\s+new)\\s+)*';
const RX_J1=new RegExp(`^(?:${VERB}\\s+)?(?:(?:in|into|to|on)\\s+)?${DET}(?:journal|diary)(?:\\s+(?:entry|entries|note|post|page|log))?(?:\\s+for\\s+today|\\s+today(?=$|\\s*[:,\\-–—]))?(?=$|[\\s:,\\-–—])\\s*(.*)$`,'i');
const RX_J2=new RegExp(`^(?:${VERB}\\s+)${DET}(?:entry|diary\\s+note)(?:\\s+(?:in|into|to|on)\\s+(?:my\\s+|the\\s+)?(?:journal|diary))?(?:\\s+for\\s+today|\\s+today(?=$|\\s*[:,\\-–—]))?(?=$|[\\s:,\\-–—])\\s*(.*)$`,'i');
const RX_T=new RegExp(`^(?:(?:${VERB}|add)\\s+${DET}|${DET}new\\s+)thread(?=$|[\\s:,\\-–—])\\s*(?:(?:called|named|titled|about|for|on|regarding)\\s+)?[:,\\-–—]?\\s*(.*)$`,'i');
const RX_L=new RegExp(`^(?:${VERB}|add)\\s+${DET}(?:(.{1,40}?)\\s+)?(?:list|checklist)(?=$|[\\s:,\\-–—])\\s*(?:(?:called|named|titled|for|of)\\s+(.*?))?\\s*(?:(?::|,|-|–|—|\\bwith\\b|\\bcontaining\\b|\\bincluding\\b|\\bthat\\s+has\\b|\\bhaving\\b)\\s*(.*))?$`,'i');
function newList(title,items){title=cap(clean(title).replace(/^(?:a|an|the|my)\s+/i,'')).slice(0,60)||'New list';const now=Date.now(),L={id:uid(),title,emoji:/groc|shop|food/i.test(title)?'🛒':/pack|trip|travel/i.test(title)?'🎒':/to-?do|task/i.test(title)?'✅':'📝',due:'',items:{},u:now,mu:now,created:now,cloud:null};
 (items||[]).map(x=>cap(clean(x))).filter(Boolean).forEach((x,i)=>{const id=uid();L.items[id]={id,t:x,done:false,due:'',o:i,u:now}});(S.lists||(S.lists=[])).unshift(L);save();rerender();const n=Object.keys(L.items).length;
 return{say:`Made a new list, ${quote(L.title)}${n?` with ${n} item${n===1?'':'s'}`:''}.`,undo:()=>{S.lists=S.lists.filter(x=>x.id!==L.id);save();rerender()},chips:[['Open list','list/'+L.id]]}}
function parse(raw){const t=strip(normCmd(raw)),l=lcs(t);let m;if(!t)return null;
 if(/^(?:cancel|stop|never ?mind|nothing|forget it|that'?s all|no thanks?)$/i.test(t))return{k:'cancel'};
 if(/^(?:what can you do|help|what do you do|how do i use you|what can i say)/i.test(t))return{k:'help'};
 if(/^(?:let'?s|can we|could we|i (?:want|need|would like|'d like) to)\s+(?:talk|chat|have a (?:chat|talk|conversation))\b|^(?:start|open|begin)\s+(?:a\s+)?(?:conversation|live (?:mode|chat|conversation)|voice (?:chat|conversation)|conversation mode)|^talk to me$|^conversation mode$|^go live$/i.test(t))return{k:'live'};
 if((m=/^(?:call yourself|your name is(?: now)?|change your name to|rename yourself(?: to)?|i(?:'ll| will) call you)\s+(.+)$/i.exec(t)))return{k:'name',v:m[1]};
 if(/^(?:what'?s|what is) your name|who are you$/i.test(t))return{k:'whoami'};
 if(/^(?:hi|hello|hey|yo|good (?:morning|afternoon|evening))(?:\s+there)?$/i.test(t))return{k:'hello'};
 if(/^(?:thanks?(?: you)?|thank you so much|cheers|great|awesome|perfect|cool)$/i.test(t))return{k:'thanks'};
 if(/^what(?:'s| is) the time|^what time is it/i.test(t))return{k:'time'};
 if(/^what(?:'s| is) (?:the |today'?s )?date|^what day is (?:it|today)/i.test(t))return{k:'date'};
 if((m=/^(?:open|show(?: me)?|go to|take me to)\s+(?:my\s+|the\s+)?(\w+)(?:\s+page)?$/i.exec(t))&&PAGES[lcs(m[1])])return{k:'open',r:PAGES[lcs(m[1])]};
 /* journal, any phrasing: "make a journal entry that says…", "new jounel entry: …", "write in my diary about…", "journal that…" */
 if((m=/^(?:add|put|write|save|log|note|jot(?:\s+down)?|record)\s+(.+?)\s+(?:to|in|into|on)\s+(?:my\s+)?(?:today'?s\s+)?(?:journal|diary)(?:\s+(?:entry\s+)?(?:for\s+)?today)?$/i.exec(t))&&!/^(?:this|that|it|something|an?\s+entry|a\s+new\s+entry)$/i.test(m[1]))return{k:'journal',x:body(m[1])};
 if((m=/^(.+?)[,.;]?\s+(?:(?:please\s+)?(?:add|put|save|write|log|jot|note)(?:\s+down)?)\s+(?:that|this|it)\s+(?:down\s+)?(?:to|in|into|on)\s+(?:my\s+)?(?:today'?s\s+)?(?:journal|diary)(?:\s+entry)?$/i.exec(t)))return{k:'journal',x:body(m[1])};
 if((m=RX_J1.exec(t))||(m=RX_J2.exec(t)))return{k:'journal',x:body(m[1])};
 /* lists: "make a grocery list with milk, eggs", "create a new list called packing: passport, charger" */
 if((m=RX_L.exec(t))&&!/\s(?:to|on|in|into)\s+(?:my\s+|the\s+)?\S.*\blist$/i.test(t)&&!/^add\s+.+\s+to\s/i.test(t)){const title=clean(m[2]||m[1]||'').replace(/^(?:a|an|the|my|new)\s+/i,'').replace(/^(?:of\s+)?/i,'');return{k:'listnew',title,items:m[3]?splitItems(m[3]):[]}}
 /* journal */
 if((m=/^(?:add|put|write|save|log|note|jot(?:\s+down)?|record)\s+(?:this|that|it|the following|something)?\s*(?:to|in|into|on)\s+(?:my\s+)?(?:today'?s\s+)?(?:journal|diary)(?:\s+(?:entry\s+)?for\s+today)?(?:\s+(?:that|saying))?\s*[:,\-]?\s*(.*)$/i.exec(t)))return{k:'journal',x:m[1]};
 if((m=/^(?:add|put|write|save|log|note|jot(?:\s+down)?|record)\s+(.+?)\s+(?:to|in|into|on)\s+(?:my\s+)?(?:today'?s\s+)?(?:journal|diary)(?:\s+(?:entry\s+)?for\s+today)?$/i.exec(t)))return{k:'journal',x:m[1]};
 if((m=/^(?:journal|dear diary|diary|journal entry|new journal entry)\s*[:,\-]?\s*(.*)$/i.exec(t)))return{k:'journal',x:m[1]};
 if((m=/^(?:make a note|take a note|note down|write down|note)\s+(?:that\s+)?(.+)$/i.exec(t)))return{k:'journal',x:m[1]};
 /* threads */
 if((m=RX_T.exec(t))&&!/^add\s+(?!a\s|an\s|new\s)/i.test(t)){const p=m[1].split(/\s*(?::|\s+(?:with|saying)\s+(?:the\s+)?(?:first\s+)?(?:update|note)?\s*)\s*/i);return{k:'thrnew',title:p[0]||'',x:p.slice(1).join(' ')}}
 if((m=/^(?:add|start|create|make|open|begin)\s+(?:a\s+)?new\s+thread\s*(?:called|named|titled|about|for|on)?\s*[:,\-]?\s*(.*)$/i.exec(t))||(m=/^(?:start|create|make|begin)\s+(?:a\s+)?thread\s*(?:called|named|titled|about|for|on)?\s*[:,\-]?\s*(.*)$/i.exec(t))||(m=/^new\s+thread\s*(?:called|named|titled|about|for|on)?\s*[:,\-]?\s*(.*)$/i.exec(t))){const p=m[1].split(/\s*(?::|\s+(?:with|saying)\s+(?:the\s+)?(?:first\s+)?(?:update|note)?\s*)\s*/i);return{k:'thrnew',title:p[0]||'',x:p.slice(1).join(' ')}}
 if((m=/^update\s+(?:my\s+|the\s+)?(.+?)\s+thread\s*(?:with|:|,|saying)\s*(.+)$/i.exec(t)))return{k:'add',x:m[2],to:m[1]+' thread'};
 /* trackers and snoozing */
 if((m=RX_TRK.exec(t))){const T=trkPick(m[3]);if(T)return{k:'trk',id:T.id,n:num(m[1]),u:m[2]||''}}
 if((m=RX_TRK2.exec(t))){const T=trkPick(m[1]);if(T)return{k:'trk',id:T.id,n:num(m[2]),u:m[3]}}
 if((m=/^snooze\b\s*(?:it|that|this|the|my)?\s*(?:reminder|alarm)?\s*(.*)$/i.exec(t)))return{k:'snooze',x:m[1]};
 /* reminders */
 if((m=/^(?:remind me|set (?:a |an |me a )?(?:reminder|alarm)|create (?:a )?reminder|add (?:a )?reminder|reminder|don'?t let me forget)\b\s*(.*)$/i.exec(t))){/* a repeat the quick reader understands is done here, at once; other repeat wording goes to the AI */if(aiReady()&&window.SCHED){const w=SCHED.words(m[1]);if(!(w.every||w.repeat||w.days||w.times)&&/\b(?:every|each|until|till|between|times|hourly|daily|weekly|other)\b/i.test(m[1]))return null}return{k:'remind',x:m[1]}}
 /* agent tasks: "every morning summarise my emails", "each Friday look at my calendar and plan the weekend" */
 /* a schedule for the agent, unless it's a habit, routine or reminder they're making ("a habit to read every night") */
 if(!/\b(?:habits?|routines?|goals?|lists?|remind(?:er)?s?|journal|thread)\b/i.test(t)&&/\b(?:every|each)\s+(?:day|morning|afternoon|evening|night|weekday|week|hour|\d+\s+hours|other\s+day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i.test(t)&&/\b(?:summari[sz]e|check|look|review|brief|tell|go through|scan|watch|plan|suggest|find|read|see|give|send|catch me up|keep an eye)\b/i.test(t))return{k:'agent',x:t};
 if((m=/^(?:keep an eye on|watch|monitor)\s+(.+)$/i.exec(t)))return{k:'agent',x:t};
 /* done */
 if((m=/^(?:mark|log|check(?:\s+off)?|tick(?:\s+off)?)\s+(?:my\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)(?:\s+for\s+today)?$/i.exec(t))||(m=/^i\s+(?:just\s+)?(?:did|finished|completed|done)\s+(?:my\s+)?(.+?)(?:\s+today)?$/i.exec(t)))return{k:'done',x:m[1]};
 /* today's goals */
 if((m=/^(?:add|set|create)\s+(?:a\s+)?(?:goal|to-?do|task)\s+(?:for\s+today\s+)?(?:to\s+)?(.+?)(?:\s+for\s+today)?$/i.exec(t))&&!/\s(?:to|on|in)\s+(?:my\s+|the\s+)?\S+\s+list$/i.test(t))return{k:'today',x:m[1]};
 /* add X to Y */
 if((m=/^(?:add|put|throw|stick)\s+(.+)\s+(?:to|on|in|onto|into)\s+(?:my\s+|the\s+)?(.+?)$/i.exec(t)))return{k:'add',x:m[1],to:m[2]};
 return null}

/* things the AI decided to make, done now: "make a packing list with socks, charger and passport" */
function doItem(it){const t=clean(it.title||''),x=clean(it.detail||'');if(!t&&!x&&!(it.type==='timer'&&it.minutes))return null;
 switch(it.type){
  case'list':return newList(t||'New list',x?splitItems(x):[]);
  case'list_add':{const L=pick(S.lists||[],t,l=>l.title);return L?addToList(L,splitItems(x||t)):newList(t||'New list',x?splitItems(x):[])}
  case'journal':return addJournal(x||t);
  case'today':return addToday(t||x);
  case'thread':return newThread(t||x,t?x:'');
  case'thread_update':{const th=pick(threads().filter(z=>z.status!=='archived'),t,z=>z.title||z.name);return th?addToThread(th,x||t):newThread(t,x)}
  case'reminder':case'alarm':case'timer':case'checkin':{if(window.SCHED){const r=SCHED.make(it);if(r)return r}if(it.type==='checkin')return null;const w=parseWhen((t+' '+x).trim());return addReminder(w.found?(w.rest||t):t,w.found?w:{date:addDays(1),time:'09:00'})}
  case'goal':case'habit':case'routine':{if(!window.AIX)return null;const r=AIX.doAct({k:it.type,t:t||x,x:it.type==='routine'?x:''});return r&&{say:r.say,undo:r.undo,chips:r.go?[['Open',r.go]]:[]}}}
 return null}
function doItems(items){const said=[],undos=[],chips=[];
 for(const it of(items||[]).slice(0,8)){let x=null;try{x=doItem(it)}catch(e){}if(!x||!x.say)continue;said.push(x.say);if(x.undo)undos.push(x.undo);if(x.chips)chips.push(...x.chips)}
 if(!said.length)return null;
 return{say:said.join(' '),undo:undos.length?()=>undos.reverse().forEach(f=>{try{f()}catch(e){}}):null,chips:chips.slice(0,3)}}
window.PlotDo={doItems,addJournal,newThread,addToThread,addToday,addReminder,addTo,newList,parseWhen,pick,splitItems,body,aiReady:()=>aiReady()};
function exec(p,raw){const A=aset();switch(p.k){
 case'agentNow':return{agent:p.x};
 case'agent':return window.agentFromVoice?agentFromVoice(p.x):{say:'The agent isn’t available here.'};
 case'cancel':return{say:'Okay.'};
 case'live':setTimeout(()=>{if(window.liveOpen)liveOpen()},60);return{say:'Sure, let’s talk.',quiet:1};
 case'hello':return{say:`Hi! What can I do for you?`,listen:true};
 case'thanks':return{say:pickOne(['Anytime.','You got it.','Happy to help.'])};
 case'whoami':return{say:`I'm ${aname()}, your assistant in Plotlines. You can rename me in Settings or by saying “call yourself” and a new name.`};
 case'time':return{say:`It's ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`};
 case'date':return{say:`It's ${longDate(Date.now())}.`};
 case'help':return{say:`Try “add went for a long walk to my journal”, “start a thread called car maintenance”, “remind me to call mom at 6pm”, “add milk and eggs to my groceries list”, “mark reading done”, or ask “when did I last change my oil?”`};
 case'name':{const n=clean(p.v).replace(/[^\p{L}\p{N} '\-]/gu,'').slice(0,24);if(!n)return{say:'What should I be called?'};const old=aname();S.settings.assist={...A,name:cap(n)};save();wakeSync();paintHead();return{say:`Okay, call me ${aname()}. Say “Hey ${aname()}” from now on.`,undo:()=>{S.settings.assist={...aset(),name:old};save();wakeSync();paintHead()}}}
 case'open':setTimeout(()=>{go(p.r)},500);return{say:`Opening ${({cal:'your calendar',road:'your timeline',map:'your life map',threads:'your threads'})[p.r]||p.r}.`};
 case'journal':return p.x?addJournal(p.x):{say:'What should I add to today’s journal?',listen:true,await:{k:'journal'}};
 case'listnew':if(!p.title&&!p.items.length)return{say:'What should I call the new list?',listen:true,await:{k:'listnew'}};return newList(p.title||'New list',p.items);
 case'thrnew':if(!p.title)return{say:'What should I call the new thread?',listen:true,await:{k:'thrnew'}};return newThread(p.title,p.x);
 case'today':return p.x?addToday(p.x):{say:'What’s the goal for today?',listen:true,await:{k:'today'}};
 case'done':return markDone(p.x);
 case'trk':return trkLog(p.id,p.n,p.u);
 case'snooze':return snooze(p.x);
 case'remind':{if(window.SCHED){const rr=SCHED.fromText(p.x);if(rr)return rr}const w=parseWhen(p.x),title=clean(w.rest.replace(/^(?:(?:me|to|that|about|for)\s+)+/i,''));
  if(!title&&!w.found)return{say:'What should I remind you about?',listen:true,await:{k:'remind'}};
  if(!title)return{say:`What should I remind you about ${atTxt(w.date,w.time)}?`,listen:true,await:{k:'remwhat',w}};
  if(!w.found)return{say:`When should I remind you to ${title.replace(/^to\s+/i,'')}?`,listen:true,await:{k:'remwhen',title}};
  return addReminder(title,w)}
 case'add':{const r=addTo(p.x,p.to);if(r)return r;return{say:`I'm not sure where ${quote(p.to)} is. Should I add ${quote(p.x)} to today's journal instead?`,listen:true,await:{k:'yesno',yes:()=>addJournal(p.x)}}}}
 return null}
const pickOne=a=>a[Math.floor(Math.random()*a.length)];

/* a follow-up to the assistant's own question */
function answerAwait(a,t){const x=clean(t);if(/^(?:cancel|stop|never ?mind|no|nope|forget it)$/i.test(x))return{say:'Okay, never mind.'};
 if(a.k==='yesno')return/^(?:yes|yeah|yep|sure|ok(?:ay)?|please|do it|go ahead)\b/i.test(x)?a.yes():null;
 if(a.k==='journal')return addJournal(body(x));if(a.k==='listnew'){const q=x.split(/\s*(?::|\bwith\b)\s*/i);return newList(q[0],q[1]?splitItems(q[1]):[])}if(a.k==='thrnew')return newThread(x);if(a.k==='today')return addToday(x);
 if(a.k==='remind'){const p=exec({k:'remind',x},x);return p}
 if(a.k==='remwhat')return addReminder(x,a.w);
 if(a.k==='share')return shareTo(a.text,x);
 if(a.k==='remwhen'){const w=parseWhen(x);if(!w.found)return{say:'Sorry, when? You can say something like “at 5pm” or “tomorrow morning”.',listen:true,await:a};return addReminder(a.title,w)}
 return null}

/* text shared in from another app: the reply says where it goes */
function shareTo(text,x){const l=lcs(x),first=text.split(/\n/)[0].slice(0,80);
 if(/\b(?:ask|explain|summari[sz]e|what|why|who|how|tell me|meaning)\b/.test(l)&&!/\b(?:add|put|save)\b/.test(l))return{ask:(/^ask(?: about it)?$/.test(l)?'Tell me about this':x)+':\n\n'+text};
 if(/\bremind/.test(l)){const w=parseWhen(x);if(w.found)return addReminder(first,w);return{say:'Sure. When should I remind you?',listen:true,await:{k:'remwhen',title:first}}}
 if(/\b(?:new|start|create|make)\b.*\bthread\b|^thread$/.test(l)){const m=x.match(/\b(?:called|named|titled)\s+(.+)$/i);return m?newThread(m[1],text):newThread(first,text===first?'':text)}
 if(/\b(?:journal|diary)\b/.test(l))return addJournal(text);
 if(/^(?:today|(?:to\s+)?(?:my\s+)?today'?s\s+goals?|goals?\s+for\s+today|my day)$/.test(l.replace(/^(?:(?:add|put|save)\s+(?:it|this)\s+)?(?:to|on|in|for)\s+/,'')))return addToday(first);
 const m=l.match(/\b(?:to|in|on|into)\s+(.+)$/)||l.match(/^(.+)$/);
 if(m){const r=addTo(text,m[1]);if(r)return r}
 return{say:`I'm not sure where that is. Should I add it to today's journal?`,listen:true,await:{k:'yesno',yes:()=>addJournal(text)}}}
function shareIn(){if(!NA||!NA.takeShare)return false;let t='';try{t=NA.takeShare()||''}catch(e){}t=t.trim();if(!t)return false;
 const turn={q:'Shared: '+(t.length>220?t.slice(0,220)+'…':t),a:'Where should this go?',t:Date.now(),id:uid(),chips:[]};
 const go=q=>()=>{if(!AS.busy){AS.await={k:'share',text:t};run(q)}};
 turn.chips=[{t:'Add to journal',fn:go('Add it to my journal')},{t:'Start a thread',fn:go('Start a new thread')},{t:'Add to today',fn:go('Add it to today')},{t:'Ask about it',fn:go('Ask about it')}];
 AS.turns.push(turn);AS.turns=AS.turns.slice(-30);AS.await={k:'share',text:t};paint(true);$('#asIn')?.setAttribute('placeholder','Say where, like “my car thread”');return true}

/* ---------------- asking things ---------------- */
/* everything with a date and some words, to answer "when did I last…" without an AI */
function facts(){const out=[],th=threads();
 S.entries.forEach(e=>{if(e.type==='token'||!e.text&&!e.title)return;const g=e.goalId&&G(e.goalId);out.push({t:e.t,x:(e.title?e.title+'. ':'')+(e.text||''),ctx:g?g.title:'',src:e.type==='note'?(e.private?'a private journal entry':'your journal'):g?`your goal ${g.title}`:'your log',priv:!!e.private,r:e.type==='note'?'journal':g?'goal/'+g.id:''})});
 th.forEach(t=>(t.ups||[]).forEach(u=>{if(!u.del&&u.x)out.push({t:u.t,x:u.x,ctx:t.title||'',src:`your ${t.title} thread`,r:'thread/'+t.id})}));
 (S.lists||[]).forEach(L=>Object.values(L.items||{}).forEach(i=>{if(i.del||!i.done)return;const t=i.dt?new Date(i.dt+'T12:00').getTime():i.u;out.push({t,x:i.t,ctx:L.title,src:`your ${L.title} list`,r:'list/'+L.id})}));
 S.days.forEach(d=>{if(d.done)out.push({t:d.doneAt||new Date(d.date+'T12:00').getTime(),x:d.title,ctx:'',src:'your goals for the day',r:'day/'+d.date})});
 S.goals.forEach(g=>(g.steps||[]).forEach(s=>{if(s.done&&s.doneAt)out.push({t:s.doneAt,x:s.title,ctx:g.title,src:`your goal ${g.title}`,r:'goal/'+g.id})}));
 S.habits.forEach(h=>{if(h.kind==='quit')return;const ds=Object.keys(h.log||{}).concat(Object.keys(h.rs||{})).filter(d=>validDate(d)&&hVal(h,d)>0).sort();if(ds.length)out.push({t:new Date(ds[ds.length-1]+'T12:00').getTime(),x:h.title,ctx:'',src:`your ${h.title} habit`,r:'habit/'+h.id,all:ds})});
 return out}
function matches(q){const qt=[...new Set(toks(q))];if(!qt.length)return[];const need=qt.length<=2?qt.length:Math.ceil(qt.length*.67);
 return facts().map(f=>{const ft=new Set(toks(f.x+' '+f.ctx));const hit=qt.filter(w=>ft.has(w)||[...ft].some(x=>w.length>4&&x.length>4&&(x.startsWith(w)||w.startsWith(x)))).length;return{...f,hit}}).filter(f=>f.hit>=need)}
function lastTime(topic){const M=matches(topic).sort((a,b)=>b.t-a.t);if(!M.length)return null;const f=M[0];
 return{say:`The last time was ${longDate(f.t)}, ${relDay(f.t)}. ${f.priv?'It’s in a private journal entry.':`From ${f.src}: ${quote(f.x)}`}`,chips:f.r?[['Open','~'+f.r]]:[]}}
function countTimes(topic,win){const days=win==='week'?7:win==='month'?30:win==='year'?365:0,from=days?Date.now()-days*864e5:0;let n=0;
 matches(topic).forEach(f=>{if(f.all)n+=f.all.filter(d=>new Date(d+'T12:00').getTime()>=from).length;else if(f.t>=from)n++});
 return n?{say:`${n} time${n===1?'':'s'}${days?` in the last ${win}`:''}, from what I can find in your notes.`}:null}
function listRead(L){const its=Object.values(L.items||{}).filter(i=>!i.del&&!i.done).sort((a,b)=>(!!b.pin-!!a.pin)||(a.o||0)-(b.o||0));
 return{say:its.length?`Your ${L.title} list has ${its.length} open item${its.length===1?'':'s'}: ${its.slice(0,8).map(i=>i.t).join(', ')}${its.length>8?', and more':''}.`:`Your ${L.title} list has nothing left on it.`,chips:[['Open list','~list/'+L.id]]}}
function todayRead(){const td=today(),D=S.days.filter(x=>x.date===td&&!x.done).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));const st=[];active().forEach(g=>(g.steps||[]).forEach(s=>{if(!s.done&&s.due===td)st.push(s.title)}));
 const all=[...D.map(x=>x.title+(x.time?' at '+fmtTime(x.time):'')),...st];
 return{say:all.length?`Today you have ${all.length} thing${all.length===1?'':'s'}: ${all.slice(0,8).join(', ')}.`:'Nothing is planned for today yet. Say “add a goal for today” to add one.',chips:[['Open today','~today']]}}
function journalRead(when){const d=when==='yesterday'?addDays(-1):today();const E=S.entries.filter(e=>e.type==='note'&&ymd(new Date(e.t))===d).sort((a,b)=>a.t-b.t);
 if(!E.length)return{say:`There's nothing in your journal for ${when||'today'} yet.`};const pub=E.filter(e=>!e.private);
 return{say:pub.length?`${cap(when||'today')} you wrote: ${pub.map(e=>trunc(((e.title?e.title+'. ':'')+(e.text||'')).replace(/\s+/g,' '),220)).join(' … ')}`:'Your journal entries for that day are private, so I won’t read them out.',chips:[['Open journal','~day/'+d]]}}
/* ---------------- activity: steps, sleep, screen time, workouts, by day ---------------- */
const MONS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],WDS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
/* a day or span in the past: "this tuesday", "yesterday", "3 days ago", "oct 12", "last week" → {a,b} as day numbers */
function pastSpan(t){const l=lcs(t),tn=dnum(ymd()),wd=new Date().getDay();let m;
 const one=(n,lab)=>({a:n,b:n,one:1,lab});
 if(/\b(?:day before yesterday)\b/.test(l))return one(tn-2);
 if(/\byesterday\b|\blast night\b/.test(l))return one(tn-1);
 if((m=/\b(\d+|a|one|two|three|four|five|six|seven)\s+days?\s+ago\b/.exec(l))){const n={a:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[m[1]]||+m[1];return one(tn-n)}
 if((m=/\b(?:(this|last|past|previous)\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/.exec(l))&&!/\b(?:sat(?:isf|ur(?!day)))/.test(m[0])){const d=['sun','mon','tue','wed','thu','fri','sat'].indexOf(m[2]);let back=(wd-d+7)%7;if(m[1]&&m[1]!=='this'&&back===0)back=7;if(m[1]==='last'&&/\blast\s+week\b/.test(l))back+=7;return one(tn-back)}
 if((m=new RegExp('\\b(?:('+MONS.join('|')+')[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?('+MONS.join('|')+')[a-z]*)\\b').exec(l))){const mo=MONS.indexOf(m[1]||m[4]),dd=+(m[2]||m[3]),y=new Date().getFullYear();let ds=y+'-'+String(mo+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');if(dnum(ds)>tn)ds=(y-1)+ds.slice(4);return one(dnum(ds))}
 if((m=/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/.exec(l))){const d=new Date();let ds=ymd(new Date(d.getFullYear(),d.getMonth(),+m[1]));if(dnum(ds)>tn)ds=ymd(new Date(d.getFullYear(),d.getMonth()-1,+m[1]));return one(dnum(ds))}
 const mon=(wd+6)%7;
 if(/\blast\s+week\b/.test(l))return{a:tn-mon-7,b:tn-mon-1,lab:'last week'};
 if(/\bthis\s+week\b/.test(l))return{a:tn-mon,b:tn,lab:'this week'};
 if((m=/\b(?:last|past)\s+(\d+|seven|fourteen|thirty)\s+days\b/.exec(l))){const n={seven:7,fourteen:14,thirty:30}[m[1]]||+m[1];return{a:tn-n+1,b:tn,lab:`the last ${n} days`}}
 if(/\b(?:past|last)\s+week\b/.test(l))return{a:tn-6,b:tn,lab:'the last 7 days'};
 if(/\bthis\s+month\b/.test(l)){const d=new Date();return{a:dnum(ymd(new Date(d.getFullYear(),d.getMonth(),1))),b:tn,lab:'this month'}}
 if(/\blast\s+month\b/.test(l)){const d=new Date();return{a:dnum(ymd(new Date(d.getFullYear(),d.getMonth()-1,1))),b:dnum(ymd(new Date(d.getFullYear(),d.getMonth(),0))),lab:'last month'}}
 if(/\b(?:lately|recently|these days|this past week)\b/.test(l))return{a:tn-6,b:tn,lab:'the last 7 days'};
 if(/\btoday\b|\bso far\b/.test(l))return one(tn);
 return null}
const ACTM=[
 {k:'s',rx:/\bsteps?\b|\bwalk(?:ed|ing)?\b/,get:o=>o.s!=null&&+o.s>0?+o.s:null,say:v=>`${Math.round(v).toLocaleString()} steps`,sum:1},
 {k:'z',rx:/\bsle(?:ep|pt)\b/,get:o=>+o.z>0?+o.z:null,say:v=>spMin(v)+' of sleep'},
 {k:'m',rx:/\bscreen\s*time\b|\bon my phone\b/,get:o=>o.m!=null?+o.m:null,say:v=>spMin(v)+' of screen time',sum:1},
 {k:'x',rx:/\bwork(?:ed)?\s*out\b|\bworkouts?\b|\bexercis/,get:o=>{const w=typeof wkMin==='function'?wkMin(o):+o.x;return w>0?w:null},say:v=>spMin(v)+' of exercise',sum:1},
 {k:'dm',rx:/\bdistance\b|\bhow far\b|\b(?:km|kilomet|miles?)\b/,get:o=>+o.dm>0?+o.dm:null,say:v=>(v/1000).toFixed(1)+' km',sum:1},
 {k:'c',rx:/\bcalories?\b|\bkcal\b/,get:o=>+o.c>0?+o.c:null,say:v=>Math.round(v).toLocaleString()+' calories',sum:1}];
function spMin(m){m=Math.round(m||0);const h=Math.floor(m/60),r=m%60;return h?`${h} hour${h>1?'s':''}${r?` ${r} minute${r>1?'s':''}`:''}`:`${r} minute${r===1?'':'s'}`}
function spDay(n){const tn=dnum(ymd());if(n===tn)return'today';if(n===tn-1)return'yesterday';const[y,mo,d]=fromN(n).split('-').map(Number);return'on '+new Date(y,mo-1,d).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
function actAsk(t){const l=lcs(t);if(!/^(?:how|what|did|when|which|was|were|tell|show|give)\b/.test(l))return null;const M=ACTM.find(x=>x.rx.test(l));if(!M)return null;
 const L=(S.settings&&S.settings.actLog)||{},keys=Object.keys(L);if(!keys.length)return{say:'I don’t have any activity from your phone yet. Turn on activity in Plotlines’ settings and I can tell you your steps, sleep and screen time.',chips:[['Open activity','activity']]};
 let sp=pastSpan(l);const best=/\b(?:most|best|highest|max(?:imum)?)\b/.test(l),avg=/\baverage|\bper day\b|\ba day\b/.test(l);
 if(!sp)sp=best||avg?{a:dnum(ymd())-6,b:dnum(ymd()),lab:'the last 7 days'}:{a:dnum(ymd()),b:dnum(ymd()),one:1};
 if(sp.one){const ds=fromN(sp.a),o=L[ds],v=o?M.get(o):null,when=spDay(sp.a);
  if(v==null)return{say:`I don’t have ${M.k==='s'?'step':M.k==='z'?'sleep':M.k==='m'?'screen time':M.k==='x'?'workout':M.k==='dm'?'distance':'calorie'} data for ${when.replace(/^on /,'')}.`,chips:[['Open activity','activity']]};
  const goal=M.k==='s'?+((S.settings.act||{}).goal)||8000:0;
  return{say:`${cap(when)} you ${M.k==='z'?'got':M.k==='m'?'had':M.k==='x'?'did':M.k==='s'?'walked':'logged'} ${M.say(v)}${goal?v>=goal?', past your goal of '+goal.toLocaleString()+'.':', '+(goal-v).toLocaleString()+' short of your '+goal.toLocaleString()+' goal.':'.'}`,chips:[['Open that day','activity']]}}
 const vals=[];for(let n=sp.a;n<=sp.b;n++){const o=L[fromN(n)];const v=o?M.get(o):null;if(v!=null)vals.push([n,v])}
 if(!vals.length)return{say:`I don’t have that for ${sp.lab}.`};
 const tot=vals.reduce((a,x)=>a+x[1],0),av=tot/vals.length,top=vals.reduce((a,x)=>x[1]>a[1]?x:a);
 if(best)return{say:`Your best day ${sp.lab==='this week'||sp.lab==='last week'?sp.lab:'in '+sp.lab} was ${spDay(top[0]).replace(/^on /,'')}, with ${M.say(top[1])}.`};
 const days=vals.length+' day'+(vals.length>1?'s':'');
 return{say:M.sum&&!avg?`${cap(sp.lab)}: ${M.say(tot)} over ${days}, about ${M.say(av)} a day. ${M.k==='m'?'Most':'Best'} was ${spDay(top[0]).replace(/^on /,'')}.`:`${cap(sp.lab)} you averaged ${M.say(av)} a day over ${days}.`}}

function localAsk(q){const t=strip(q);let m;
 {const a=actAsk(t);if(a)return a}
 /* trackers: "how much water today", "how long did I meditate" */
 if(window.TRK&&TRK.list().length&&/^(?:how\s+(?:much|many|long|far)|what(?:'s| is)\s+my)\b/i.test(t)){const l=lcs(t),T=TRK.list().find(x=>l.includes(lcs(x.n)))||TRK.list().find(x=>toks(x.n).some(w=>w.length>3&&toks(t).some(y=>y.length>3&&(y.startsWith(w.slice(0,5))||w.startsWith(y.slice(0,5))))));
  if(T){const v=TRK.val(T.id,today());return{say:`${v?`${cap(T.n)}: ${TRK.fmt(v,T.u)} today`:`Nothing logged for ${T.n} today yet`}${T.g?`, your goal is ${TRK.fmt(T.g,T.u)}`:''}.`,chips:[['Open activity','~activity']]}}}
 if((m=/^(?:when|what day)\s+(?:did|was|were|have)\s+(?:i|we)\s+(?:last\s+)?(.+?)(?:\s+last)?\??$/i.exec(t))||(m=/^when\s+was\s+the\s+last\s+time\s+(?:i|we)\s+(.+?)\??$/i.exec(t))||(m=/^(?:the\s+)?last\s+time\s+(?:i|we)\s+(.+?)\??$/i.exec(t))||(m=/^when\s+was\s+(?:my|the)\s+last\s+(.+?)\??$/i.exec(t)))return lastTime(m[1])||{miss:m[1]};
 if((m=/^how\s+(?:many\s+times|often)\s+(?:did|have|do)\s+(?:i|we)\s+(.+?)(?:\s+(?:this|in the (?:last|past)|over the (?:last|past))\s+(week|month|year))?\??$/i.exec(t)))return countTimes(m[1],m[2]&&lcs(m[2]))||{miss:m[1]};
 if((m=/^what(?:'s| is| do i have)\s+(?:on|in)\s+(?:my\s+|the\s+)?(.+?)(?:\s+list)?\??$/i.exec(t))||(m=/^(?:read|show)\s+(?:me\s+)?(?:my\s+|the\s+)?(.+?)\s+list\??$/i.exec(t))){if(/^(?:today|my day|the agenda|my plate|for today)$/i.test(m[1]))return todayRead();const L=pick(S.lists||[],m[1],l=>l.title);if(L)return listRead(L)}
 if(/^what(?:'s| is| do i have)\s+(?:on\s+)?(?:for\s+)?(?:today|my plan|on my plate|planned today)|^what(?:'s| are) my goals for today|^what do i (?:have|need) to do today/i.test(t))return todayRead();
 if((m=/^what did i (?:write|journal|say)\s+(?:in my journal\s+)?(today|yesterday)?/i.exec(t)))return journalRead(m[1]&&lcs(m[1]));
 return null}
function aiReady(){const e=typeof planEngine==='function'?planEngine():'';if(!e)return false;if(e!=='api'&&typeof isLrtM==='function'&&isLrtM(llmOf(insSet().llm))&&(e==='wasm'||lrtOn()))return!!(insSet().dl||{})[llmOf(insSet().llm)[0]];if(e==='wasm'){const s=insSet(),m=llmOf(s.llm);return!!(s.dl||{})[m[0]]}if(e==='native'){const m=llmOf(insSet().llm);return typeof natHave!=='function'||natHave(m)}return true}
/* what the assistant's AI gets to see: the date, recent activity day by day, today's plan, threads, lists, and the notes that match */
function actLines(n){const L=(S.settings&&S.settings.actLog)||{},tn=dnum(ymd()),out=[];
 for(let k=tn;k>tn-n;k--){const ds=fromN(k),o=L[ds];if(!o)continue;const[y,mo,d]=ds.split('-').map(Number);const w=typeof wkMin==='function'?wkMin(o):+o.x;
  const b=[+o.s>0&&`${(+o.s).toLocaleString()} steps`,+o.dm>0&&`${(o.dm/1000).toFixed(1)} km`,+o.z>0&&`slept ${spMin(o.z)}`,w>0&&`exercise ${spMin(w)}`,o.m!=null&&`screen time ${spMin(o.m)}`,(o.w||[]).length&&`workouts: ${(o.w||[]).map(x=>x?((typeof ACT_EX!=='undefined'&&ACT_EX[x.k])||'workout')+(x.m?' '+spMin(x.m):''):'').filter(Boolean).join(', ')}`].filter(Boolean);
  if(b.length)out.push(`- ${new Date(y,mo-1,d).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}${k===tn?' (today, so far)':k===tn-1?' (yesterday)':''}: ${b.join(', ')}`)}
 return out}
/* ---------------- everything Plot knows: the user's whole app, picked to fit the question ---------------- */
const asDay=ds=>{const[y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})};
const moodName=m=>{const x=(typeof MOODS!=='undefined'?MOODS:[]).find(z=>z[0]===m);return x?x[1].toLowerCase():String(m||'')};
const tsDay=t=>ymd(new Date(t));
const tr=(x,n)=>{x=String(x||'').replace(/\s+/g,' ').trim();return x.length>n?x.slice(0,n-1)+'…':x};
/* days the question is about: the past day or span it names, and the next such day if it reads like a plan */
function askDays(q){const out=[],tn=dnum(ymd()),sp=pastSpan(q);
 if(sp)for(let n=Math.max(sp.a,sp.b-13);n<=sp.b;n++)out.push(fromN(n));
 if(/\b(?:tomorrow|tonight|next|coming|upcoming|plan(?:ned)?|schedule[d]?|will|going to|do i have|have i got|is on|what's on|whats on)\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(q)){try{const w=parseWhen(q);if(w&&w.found&&w.date&&dnum(w.date)>=tn&&!out.includes(w.date))out.push(w.date)}catch(e){}}
 return out}
/* one day, across the whole app */
function daySummary(ds){const L=[],o=((S.settings&&S.settings.actLog)||{})[ds],n=dnum(ds),tn=dnum(ymd());
 if(o){const w=typeof wkMin==='function'?wkMin(o):+o.x;const b=[+o.s>0&&`${(+o.s).toLocaleString()} steps`,+o.dm>0&&`${(o.dm/1000).toFixed(1)} km`,+o.z>0&&`slept ${spMin(o.z)}`,w>0&&`exercise ${spMin(w)}`,o.m!=null&&`screen time ${spMin(o.m)}`].filter(Boolean);if(b.length)L.push('activity: '+b.join(', '))}
 if(n<=tn){const dn=[],ms=[];S.habits.forEach(h=>{if(h.status!=='active'||h.kind==='quit')return;try{if(hDone(h,ds))dn.push(h.title);else if(hDue(h,ds)&&!(h.skip||{})[ds]&&n<tn)ms.push(h.title)}catch(e){}});if(dn.length)L.push('habits done: '+dn.join(', '));if(ms.length)L.push('habits missed: '+ms.join(', '))}
 const D=S.days.filter(x=>x.date===ds).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));if(D.length)L.push('plan: '+D.map(x=>`${x.time?x.time+' ':''}${x.title}${x.done?' (done)':n<tn?' (not done)':''}${x.remind!=null&&x.remind!==''?' (reminder)':''}`).join('; '));
 const st=[];S.goals.forEach(g=>(g.steps||[]).forEach(x=>{if(x.done&&x.doneAt&&tsDay(x.doneAt)===ds)st.push(`${x.title} (goal ${g.title})`);else if(!x.done&&x.due===ds)st.push(`${x.title} due (goal ${g.title})`)}));if(st.length)L.push('goal steps: '+st.join('; '));
 const E=S.entries.filter(e=>e.type==='note'&&tsDay(e.t)===ds).sort((a,b)=>a.t-b.t);if(E.length)L.push('journal: '+E.map(e=>e.private?'a private entry':`${e.mood?'['+moodName(e.mood)+'] ':''}${tr((e.title?e.title+'. ':'')+(e.text||''),220)}`).join(' | '));
 const U=[];threads().forEach(t=>(t.ups||[]).forEach(u=>{if(!u.del&&u.x&&tsDay(u.t)===ds)U.push(`${t.title}: ${tr(u.x,120)}`)}));if(U.length)L.push('thread updates: '+U.join('; '));
 const I=[];(S.lists||[]).forEach(l=>Object.values(l.items||{}).forEach(x=>{if(!x.del&&x.done&&x.dt===ds)I.push(`${x.t} (${l.title})`)}));if(I.length)L.push('list items done: '+I.join(', '));
 return`${asDay(ds)}${n===tn?' (today)':n===tn-1?' (yesterday)':n===tn+1?' (tomorrow)':''}: ${L.join('. ')||'nothing recorded'}`}
function habitLine(h,full){const td=ymd(),tn=dnum(td);if(h.kind==='quit')return`- ${h.title}: quitting${typeof qDays==='function'?', '+qDays(h)+' days free':''}`;
 let wk='';for(let k=tn-6;k<=tn;k++){const ds=fromN(k);let c='·';try{c=hDone(h,ds)?'✓':hDue(h,ds)?(k===tn?'…':'✗'):'·'}catch(e){}wk+=c}
 let last='';try{const ds=Object.keys(h.log||{}).concat(Object.keys(h.rs||{})).filter(d=>/^\d{4}-\d\d-\d\d$/.test(d)&&hVal(h,d)>0).sort().pop();if(ds)last=asDay(ds)}catch(e){}
 let streak='';try{streak=hStreak(h)}catch(e){}
 return`- ${h.title}: ${typeof freqText==='function'?freqText(h).toLowerCase():''}${h.time?' at '+h.time:''}, streak ${streak}, today ${(()=>{try{return hDone(h,td)?'done':hDue(h,td)?'not done yet':'not due'}catch(e){return'?'}})()}, last 7 days ${wk}${last?', last done '+last:''}${full&&h.cue?', cue: '+h.cue:''}${full&&h.why?', why: '+tr(h.why,120):''}`}
function goalLine(g,full){const nx=typeof nextStep==='function'?nextStep(g):null,open=(g.steps||[]).filter(x=>!x.done);
 return`- ${g.title}: ${g.status}${typeof pct==='function'?', '+pct(g)+'% done':''}${g.targetDate?', target '+asDay(g.targetDate):''}${nx?`, next step: ${nx.title}${nx.due?' (due '+asDay(nx.due)+')':''}`:''}${full&&open.length>1?`, other open steps: ${open.slice(1,6).map(x=>x.title+(x.due?' ('+x.due+')':'')).join('; ')}`:''}${full&&g.why?', why: '+tr(g.why,140):''}`}
/* names from the user's data that the question mentions: those get the full detail */
const GEN=new Set(['go','do','get','make','have','day','time','take','new','my','daily','every','week','month','thing','stuff','work','start','stop','more','less','good','one','two','three']);
function named(q){const qt=new Set(toks(q)),hit=t=>{const tt=toks(t);if(!tt.length)return 0;const m=tt.filter(w=>qt.has(w)||w.length>=4&&[...qt].some(x=>x.length>=4&&(x.startsWith(w)||w.startsWith(x)))),real=m.filter(w=>!GEN.has(w)&&!/^\d+$/.test(w));return real.length&&m.length>=Math.ceil(tt.length*.3)?m.length/tt.length:0};
 const by=(xs,f)=>xs.map(x=>[x,hit(f(x))]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
 return{h:by(S.habits.filter(h=>h.status!=='archived'),h=>h.title),g:by(S.goals,g=>g.title),t:by(threads().filter(t=>t.status!=='archived'),t=>t.title),l:by(S.lists||[],l=>l.title)}}
function asCtx(q,r,hint,big,small){const now=new Date(),tn=dnum(ymd()),lq=lcs(q),N=named(q),days=askDays(q);
 const head=`TODAY IS ${now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}, ${now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}.${S.settings.name?` The user's name is ${S.settings.name}.`:''} Words like "this Tuesday", "last week" or "yesterday" are dates relative to today. In habit rows, "last 7 days" runs oldest to today: ✓ done, ✗ missed, · not due, … due today and not done yet.`;
 const sec=[];const add=(title,lines,score)=>{lines=lines.filter(Boolean);if(lines.length)sec.push({title,lines,score})};
 if(hint)add('LOOKED UP BY THE APP (exact, trust this)',[hint],100);
 add('THE DAYS ASKED ABOUT',days.map(daySummary),days.length?90:0);
 add('MENTIONED BY NAME',[...N.h.map(h=>habitLine(h,1)),...N.g.map(g=>goalLine(g,1)),...N.t.map(t=>{const U=thrUps(t).slice(0,8);return`- thread ${t.title} (${t.status||'open'}): ${U.map(u=>tsDay(u.t)+' '+tr(u.x,140)).join(' · ')||'no updates'}`}),...N.l.map(l=>{const I=Object.values(l.items||{}).filter(x=>!x.del);return`- list ${l.title}: to do: ${I.filter(x=>!x.done).map(x=>x.t).join(', ')||'nothing'}; done: ${I.filter(x=>x.done).length}`})],85);
 const kw=(rx,b)=>rx.test(lq)?b:0;
 add('TODAY',[daySummary(ymd())],kw(/\btoday|tonight|now|so far|left|agenda|plate\b/,70)+20);
 add('HABITS',S.habits.filter(h=>h.status==='active').map(h=>habitLine(h,0)),kw(/habit|streak|routine|did i|have i|miss|skip|quit|every ?day|consisten|daily/,60)+12);
 add('GOALS',S.goals.filter(g=>g.status==='active').map(g=>goalLine(g,0)).concat(S.goals.filter(g=>g.status==='done').length?[`- achieved so far: ${S.goals.filter(g=>g.status==='done').slice(-8).map(g=>g.title).join(', ')}`]:[]),kw(/goal|plan|progress|step|next|target|achiev|working on|focus/,60)+11);
 const up=S.days.filter(x=>!x.done&&dnum(x.date)>=tn-7&&dnum(x.date)<=tn+21).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time||'99').localeCompare(b.time||'99'));
 add('PLANS AND REMINDERS (not done)',up.map(x=>`- ${asDay(x.date)}${x.time?' '+x.time:''}: ${x.title}${dnum(x.date)<tn?' (overdue)':''}`),kw(/remind|plan|schedul|tomorrow|week|upcoming|coming|calendar|appointment|meeting|todo|to-do|to do|overdue|due/,60)+10);
 const M=[];S.entries.filter(e=>e.type==='note'&&e.mood&&!e.private&&dnum(tsDay(e.t))>tn-21).sort((a,b)=>b.t-a.t).forEach(e=>M.push(`- ${asDay(tsDay(e.t))}: ${moodName(e.mood)}`));
 add('MOODS (last 3 weeks)',M,kw(/mood|feel|felt|happy|sad|stress|anxi|tired|energ|emotion|week been|been doing/,60)+6);
 add('ACTIVITY FROM THE PHONE (newest first)',actLines(big?30:14),kw(/step|walk|sleep|slept|screen|phone|exercis|workout|run|distance|calor|active|activity|health|fit/,60)+8);
 const J=S.entries.filter(e=>e.type==='note'&&!e.private).sort((a,b)=>b.t-a.t).slice(0,big?12:5).map(e=>`- ${asDay(tsDay(e.t))}${e.mood?' ['+moodName(e.mood)+']':''}: ${tr((e.title?e.title+'. ':'')+(e.text||''),big?400:160)}`);
 add('RECENT JOURNAL',J,kw(/journal|wrote|write|diary|note|entry|said|thought|remember/,60)+7);
 add('MATCHING NOTES FROM ALL MY DATA',(r&&r.srcs||[]).map(d=>'- '+tr(d.text,big?600:260)),45);
 add('THREADS',threads().filter(t=>t.status!=='archived').sort((a,b)=>(b.u||0)-(a.u||0)).slice(0,big?20:8).map(t=>{const u=thrUps(t)[0];return`- ${t.title}${t.status==='done'?' (done)':''}${u?`: last update ${asDay(tsDay(u.t))}, ${tr(u.x,big?160:80)}`:''}`}),kw(/thread|project|car|house|update|status|progress|last time|when did/,50)+5);
 add('LISTS',(S.lists||[]).map(l=>{const I=Object.values(l.items||{}).filter(x=>!x.del),o=I.filter(x=>!x.done);return`- ${l.title}: ${o.length} to do${o.length?': '+o.slice(0,big?15:6).map(x=>x.t).join(', '):''}`}),kw(/list|grocer|shopping|buy|pack|to-?do|items?/,60)+4);
 sec.sort((a,b)=>b.score-a.score);
 const budget=big?30000:small?1800:5200;let used=head.length+q.length+40;const parts=[head];
 for(const s of sec){let block=`\n${s.title}\n`;for(const l of s.lines){if(used+block.length+l.length+1>budget)break;block+=l+'\n'}if(block.split('\n').length>3||s.lines.length&&block.length>s.title.length+3){used+=block.length;parts.push(block)}if(used>=budget)break}
 return parts.join('\n')+`\nQUESTION\n${q}`}
async function aiAnswer(q,onP,hint){if(!aiReady())return null;const e=planEngine(),loc=e!=='api'&&e!=='native',X=window.AIX,spoken=AS.spoken,pr=insSet().profile;
 const quick=spoken&&fastOn();
 const r=(AS.rag&&AS.rag.q===q&&await AS.rag.p)||await ragRetrieve(q,{win:0,goal:'',broad:insFocus(q).broad},onP);AS.srcs=r&&r.srcs||null;const prompt=asCtx(q,r,hint,!loc&&e==='api',quick&&e!=='api');tmMark('ctx');
 /* spoken, instant mode: a short system prompt that never changes between turns (the engine keeps it prefilled), a small
    slice of their data, and short answers */
 const sys=quick?`You are ${aname()}, the voice assistant in Plotlines, the user's app for goals, habits, a journal, lists, threads and reminders. Your answer is read aloud: one to three short, natural sentences, no lists, no markdown, no note numbers. For questions about their life, use the data given, and if it isn't there, say what you do know. For anything else, just answer it well.${window.AGENT&&AGENT.connected().length?'\n\n'+AGENT.sys():''}${pr&&pr.text?'\n\nABOUT THEM\n'+tr(pr.text,500):''}${X?'\n\n'+X.safety():''}`:`You are ${aname()}, the assistant inside the Plotlines app: a personal assistant that knows the user's own data and can talk about anything. Work out what they mean, even when it's phrased loosely or misheard by speech recognition. ${spoken?'Your answer is read aloud: one to three short, natural sentences. No lists, no markdown, no note numbers like [2].':'Answer clearly and briefly: a few sentences, or a few short bullets when that really helps. No note numbers like [2].'} When the question is about their life, use the data given (dates, activity numbers, plans, threads, lists and notes); if the app looked something up, use that answer, and if the data doesn't have it, say what you do know. For anything else (the world, ideas, advice, writing, feelings), just answer it well.${window.AGENT?'\n\n'+AGENT.sys():''}${pr&&pr.text?'\n\nWHAT YOU KNOW ABOUT THEM\n'+pr.text:''}${X?'\n\n'+X.ACT_SYS+'\n\n'+X.safety():''}`;
 const hist=[];AS.turns.filter(t=>!t.wait&&t.a&&!t.sys).slice(quick?-2:-3).forEach(t=>hist.push({role:'user',content:t.q},{role:'assistant',content:quick?tr(t.a,240):t.a}));
 const msgs=[{role:'system',content:sys},...hist,{role:'user',content:prompt}];if(TM)TM.pc=msgs.reduce((a,m)=>a+m.content.length,0);
 let out='';const on=x=>{tmMark('tok');out+=x;sqFeed(out);liveFeed(out);onP&&onP('')};const opts={max_tokens:quick?180:spoken?260:(loc?450:700),reading:'Thinking…',temperature:.5};
 if(e==='api')await apiChat(msgs,on,AS.ctl.signal,opts);else if(e==='native')await natChat(msgs,on,onP,()=>{out=''},opts);else await localChat(msgs,on,onP,0,()=>{out=''},false,opts);
 out=out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'');
 const ag=window.AGENT&&AGENT.parse(out);if(ag){AS.srcs=null;return{agent:ag}}
 if(X){const P=X.parseActs(out);out=P.clean;AS.acts=X.keepActs(P.acts)}
 out=(spoken?out.replace(/[*#_`]/g,''):out.replace(/\*\*|__|`|^#+\s*/gm,'')).trim();
 if(X){const c=X.care(q,out);if(c)out+=' '+c}
 if(out)AS.wrote=true;return out||null}
async function llmIntent(t){const e=typeof planEngine==='function'?planEngine():'',fast=e!=='api'&&isLrtM(llmOf(insSet().llm));if(e!=='api'&&e!=='native'&&!fast||!aiReady())return null;
 const schema={type:'object',properties:{action:{enum:['journal','new_thread','thread_update','reminder','new_list','list_add','today_goal','habit_done','agent_task','agent_now','question']},text:{type:'string'},target:{type:'string'},when:{type:'string'}},required:['action','text'],additionalProperties:false};
 const msgs=[{role:'system',content:'You turn one spoken or typed request to a personal journal and habits app into JSON. Requests can be phrased any way, misspelled ("jounel", "liost", "thred") or misheard ("general entry" means journal entry). Reply with JSON only. The text field holds only what should be saved: never the command words ("make a journal entry", "add to my list", "that says"), never the target name.'},{role:'user',content:`Request: "${t}"\n\nactions: journal (save text to today's journal), new_thread (start a thread; text is its title), thread_update (target is the thread name; text is the update), reminder (when is the time words like "tomorrow at 5pm"), new_list (text is the list name; target is its items separated by commas, or empty), list_add (target is the list name; text is the items), today_goal, habit_done (text is the habit), agent_task (only for something to repeat on a schedule or keep an eye on, like "every morning summarise my emails"; text is the task), agent_now (something to look up or do right now in their email, calendar, Google Drive or Notion, like "check if Sam replied" or "put lunch with Ana on my calendar Friday"; text is the whole request), question (anything asked).`}];
 let out='';try{if(e==='api')await apiChat(msgs,x=>{out+=x},AS.ctl.signal,{schema,max_tokens:160,temperature:0});else if(e==='wasm')await localChat(msgs,x=>{out+=x},null,0,null,false,{schema,max_tokens:160,temperature:0});else await natChat(msgs,x=>{out+=x},null,null,{schema,max_tokens:160,temperature:0});const j=JSON.parse(out.slice(out.indexOf('{'),out.lastIndexOf('}')+1));
  const x=String(j.text||''),tg=String(j.target||''),w=String(j.when||'');
  return{journal:{k:'journal',x:body(x)},new_thread:{k:'thrnew',title:x},thread_update:{k:'add',x,to:tg+' thread'},reminder:{k:'remind',x:x+(w?' '+w:'')},list_add:{k:'add',x,to:tg+' list'},new_list:{k:'listnew',title:x,items:tg?splitItems(tg):[]},today_goal:{k:'today',x},habit_done:{k:'done',x},agent_task:{k:'agent',x},agent_now:window.AGENT&&AGENT.connected().length?{k:'agentNow',x:t}:null}[j.action]||null}catch(err){return null}}

/* ---------------- speed ----------------
   The instant path: a request the parser fully understands, or a simple lookup in their own data, is answered here in a few
   milliseconds; only the rest goes to the AI. Each turn's timings are kept on this device (Settings › AI & voice › Speed)
   and logged as [plot-speed]: from the last word heard to the mic closing, the route, the first token, the first word spoken. */
const DONE_K=new Set(['cancel','help','hello','thanks','time','date','whoami','open','live','name','done','trk','snooze','add','listnew','thrnew','today']);
/* a parse that needs nothing more said: the mic can close now (a journal entry or a reminder without a time can go on) */
function complete(p){if(!p||!DONE_K.has(p.k)&&p.k!=='remind')return false;if(p.k==='remind'){const w=parseWhen(p.x);return w.found&&!!clean(w.rest)}
 if(p.k==='add'||p.k==='today')return!!clean(p.x);if(p.k==='listnew'||p.k==='thrnew')return!!clean(p.title);return true}
/* a lookup that is short and plain enough to trust without the AI ("how many steps today", "when did I last change my oil") */
const DEEP=/\b(?:why|compare[ds]?|versus|vs|than|should|advice|suggest|explain|better|worse|trend|pattern|improve|tips?|plan|think)\b/i;
function quickAsk(t){const s=strip(t);if(s.split(/\s+/).length>14||DEEP.test(s))return null;const L=localAsk(s);return L&&L.say&&!L.miss&&!L.ask&&!L.await?L:null}
/* does this need the AI's routing call (agent, web, schedule, several things to make)? Plain questions go straight to the answer */
const NEEDS_DECIDE=/\b(?:e-?mails?|mail|inbox|repl(?:y|ied|ies)|messages?|calendar|meetings?|events?|appointments?|drive|docs?|files?|notion|weather|forecast|rain|open now|hours|near me|nearby|news|prices?|every|each|keep an eye|monitor|watch)\b/i;
const MAKE=/^(?:add|make|create|start|set|log|save|put|remind|schedule|track|new|write|note|jot|mark|turn|plan|book|send)\b/i;
const needsDecide=t=>!fastOn()||NEEDS_DECIDE.test(t)||MAKE.test(strip(t))||/\b(?:can|could|would|will)\s+you\b/i.test(t);
window.__vDone=(el,text)=>{if(!fastOn()||!el||(el.id!=='asIn'&&el.id!=='lvIn'))return false;const tx=String(text||'').replace(new RegExp('^(?:(?:hey|hi|ok(?:ay)?)\\s+)?'+aname().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[,.!]?\\s*','i'),'');
 try{const p=parse(tx);if(p)return complete(p)||p.k==='journal'&&!!p.x&&/\b(?:journal|diary)(?:\s+entry)?$/i.test(tx);return el.id==='asIn'&&!!quickAsk(tx)}catch(e){return false}};
const TM_KEY='plotline.speed';let TM=null;
const tmMark=k=>{if(TM&&TM[k]==null)TM[k]=Date.now()};
function tmBegin(text,o){let m='';try{const e=planEngine();m=e==='api'?'own server':e?llmOf(insSet().llm)[1].split(' · ')[0]+(e==='native'?(lrtOn()?' (GPU)':' (llama.cpp)'):''):'no AI'}catch(e){}TM={q:tr(text,60),t0:o.heard||Date.now(),mic:Date.now(),spoken:!!o.spoken,model:m}}
function tmEnd(){if(!TM)return;const x=TM;TM=null;x.done=Date.now();const d=k=>x[k]!=null?x[k]-x.t0:null;
 const row={t:x.mic,q:x.q,path:x.path||'',model:x.model,spoken:x.spoken,pc:x.pc||0,mic:d('mic'),routed:d('routed'),ctx:d('ctx'),tok:d('tok'),say:d('say'),done:d('done')};
 try{console.log('[plot-speed]',JSON.stringify(row))}catch(e){}
 try{const L=JSON.parse(localStorage.getItem(TM_KEY)||'[]');L.unshift(row);localStorage.setItem(TM_KEY,JSON.stringify(L.slice(0,20)))}catch(e){}}
const speedRows=()=>{try{return JSON.parse(localStorage.getItem(TM_KEY)||'[]')}catch(e){return[]}};
window.PLOT_SPEED=speedRows;
const sec=ms=>ms==null?'–':(ms/1000).toFixed(ms<10000?2:1)+'s';
function speedHTML(){const L=speedRows();if(!L.length)return'<p class="small muted">Talk to me once and the timings show here.</p>';
 return`<ul class="as-spd">${L.slice(0,8).map(r=>`<li><b>${esc(r.q)}</b><small>${r.path==='fast'?'instant':esc(r.path||'')} · ${esc(r.model)}${r.pc?` · ${Math.round(r.pc/4)} tokens in`:''}</small><span>${r.spoken?`mic ${sec(r.mic)} · `:''}${r.path!=='fast'&&r.tok!=null?`first token ${sec(r.tok)} · `:''}${r.say!=null?`first word ${sec(r.say)} · `:''}done ${sec(r.done)}</span></li>`).join('')}</ul><p class="small muted">Times count from your last word.${L.length?' <button class="btn sm ghost" data-act="asSpdClear">Clear</button>':''}</p>`}
/* streamed speech: each full sentence is spoken while the AI is still writing the rest */
const SQ={on:false,q:[],said:'',last:'',busy:false,end:false,done:null,first:null};
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const spText=raw=>norm((window.AIX?AIX.hideActs:x=>x)(String(raw||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'')).replace(/[*#_`]/g,''));
function sqStart(o){Object.assign(SQ,{on:true,q:[],said:'',last:'',busy:false,end:false,done:o&&o.done||null,first:o&&o.first||null})}
function sqFeed(raw){if(!SQ.on||SQ.end)return;const v=spText(raw);if(/^\{|^A(?:G(?:E(?:N(?:T)?)?)?)?$|AGENT\s*:/i.test(v)){if(!SQ.said)SQ.on=false;return}
 const rest=v.slice(SQ.said.length);let cut=-1;const rx=/[.!?…]["”')\]]?(?= )/g;let m;while((m=rx.exec(rest)))cut=m.index+m[0].length;
 if(cut<0)return;const ch=rest.slice(0,cut);if(ch.trim().split(' ').length<3&&!SQ.said)return;SQ.said+=ch;SQ.last=ch.trim();SQ.q.push(ch.trim());sqPump()}
function sqPump(){if(SQ.busy)return;if(!SQ.q.length){if(SQ.end){SQ.on=false;const f=SQ.done;SQ.done=null;if(f)f();else afterSpeak()}return}
 SQ.busy=true;if(SQ.first){const f=SQ.first;SQ.first=null;f()}window.asHum(false);tmMark('say');speak(SQ.q.shift(),()=>{SQ.busy=false;sqPump()})}
/* the answer is complete: speak what's left; false when nothing was streamed (the caller speaks it the usual way) */
function sqEnd(final){if(!SQ.on||!SQ.said){SQ.on=false;return false}const f=norm(final).replace(/[“”]/g,'"'),s=SQ.said.replace(/[“”]/g,'"');let rem='';
 if(f.startsWith(s))rem=f.slice(s.length);else{const i=f.indexOf(SQ.last.replace(/[“”]/g,'"'));rem=i>=0?f.slice(i+SQ.last.length):''}
 rem=rem.trim();if(rem)SQ.q.push(rem);SQ.end=true;sqPump();return true}
function sqStop(){SQ.on=false;SQ.q=[];SQ.done=null;SQ.first=null;SQ.busy=false}
/* load the model while they're still talking: at the wake word, when the sheet opens */
function asWarm(){try{if(/^kokoro:/.test(aset().voice||'')&&window.KOKORO)KOKORO.warm()}catch(e){}if(!fastOn())return;try{if(typeof natWarm==='function')natWarm()}catch(e){}}

/* ---------------- one request, start to finish ---------------- */
const QRX=/^(?:who|what|when|where|why|how|which|is|are|was|were|do|does|did|have|has|had|can i|should i|tell me|show me|list|summari[sz]e|give me)\b/i;
async function run(raw,o={}){const text=String(raw||'').trim().replace(new RegExp('^(?:(?:hey|hi|ok(?:ay)?)\\s+)?'+aname().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[,.!]?\\s*','i'),'');
 if(!text){listen();return}
 if(AS.busy){toast('Still working on the last one');return}
 if(AS.turns.length&&AS.last&&Date.now()-AS.last>CV_GAP)convFresh('chat');
 asOpen();wakePause(true);$('#asIn')?.setAttribute('placeholder','Ask or tell me something…');const turn={q:o.show||text,a:'',chips:[],t:Date.now(),id:uid(),wait:true};AS.turns.push(turn);AS.turns=AS.turns.slice(-30);AS.spoken=!!o.spoken;AS.busy=true;AS.ctl=new AbortController();paint(true);if(AS.spoken)window.asHum(true);
 let r=null;AS.acts=null;AS.srcs=null;AS.wrote=false;AS.liveT=turn;tmBegin(text,o);sqStop();
 /* spoken answers from the AI start talking at the first full sentence */
 if(fastOn()&&(aset().speak==='always'||aset().speak==='voice'&&AS.spoken))sqStart();
 try{const aw=AS.await;AS.await=null;const blk=window.AIX&&AIX.block(text);if(blk)r={say:blk};
  /* a question from Ask's suggestions, Home insights or "Ask about this": straight to the AI with their notes (a suggestion reads a wider slice) */
  if(!r&&o.ask&&aiReady()){const P=o.pre;if(P)AS.rag={q:text,p:ragRetrieve(text+' '+(P.kw||''),{win:P.win||0,goal:'',all:P.all,kinds:P.kinds,broad:true},null).catch(()=>null)};status('Searching your notes…');const a=await aiAnswer(text,status).catch(e=>{if(e&&e.name==='AbortError')throw e;return null});r=a?{say:a}:{say:'Sorry, I couldn’t answer that right now.'}}
  if(aw&&!r)r=answerAwait(aw,text);
  if(!r){const p=parse(text);if(p)r=exec(p,text)}
  if(!r&&fastOn()&&aiReady())r=quickAsk(text);
  if(!r&&!aiReady())r=localAsk(text);
  if(TM){TM.path=r?'fast':'model';tmMark('routed')}
  if(!r&&aiReady())asWarm();
  /* the AI decides: make it now, ask the agent, schedule it, or just talk */
  let dec=null;if(!r&&aiReady()&&window.AGENT&&needsDecide(text)){status('Thinking…');/* the note search runs while the AI decides */AS.rag={q:text,p:ragRetrieve(text,{win:0,goal:'',broad:insFocus(text).broad},null).catch(()=>null)};dec=await AGENT.decide(text,AS.turns.filter(t=>!t.wait&&t.a));if(dec&&dec.agent)r={agent:dec.agent,web:dec.web};else if(dec&&dec.items)r=doItems(dec.items);else if(dec&&dec.schedule)r=exec({k:'agent',x:dec.schedule},text)}
  if(!r&&aiReady()){const st=strip(text),cmd=!dec&&(!QRX.test(st)||/^(?:can|could|would|will) you\b|\b(?:please|i want to|i need to|i'd like to)\b/i.test(st));
   if(cmd&&!/^(?:can|could|would|will) you (?:tell|show|explain|remind me (?:what|when|how))/i.test(st)){status('Working it out…');const p=await llmIntent(st);if(p&&p.k)r=exec(p,text)}
   if(!r){const L=localAsk(text);if(L&&(L.ask||L.await))r=L;
    else{status('Thinking…');const a=await aiAnswer(text,status,L&&!L.miss?L.say:'').catch(e=>{if(e&&e.name==='AbortError')throw e;return null});
     r=a?{say:a,chips:L&&L.chips||[]}:L&&!L.miss?L:{say:'Sorry, I couldn’t answer that right now.',chips:[['Try again','?'+text]]}}}}
  if(r&&r.ask){const q=r.ask;status('Thinking…');const a=await aiAnswer(q,status).catch(e=>{if(e&&e.name==='AbortError')throw e;return null});r=a?{say:a}:{say:aiReady()?'Sorry, I couldn’t answer that right now.':'To answer questions like that I need an AI. Set one up once (it can run privately on this device) and I’ll answer from your notes.',chips:aiChips(q)}}
  if(r&&r.miss){const miss=r.miss;r=null;status('Thinking…');const a=await aiAnswer(text,status).catch(()=>null);r=a?{say:a}:{say:`I couldn't find anything about ${quote(miss)} in your journal, threads, lists or habits.`}}
  if(!r&&!dec&&!QRX.test(strip(text))&&/^(?:add|put|write|log|create|start|make|set|remind|schedule|note|save|mark|record|jot|track|new)\b/i.test(strip(text))){status('Working it out…');const p=await llmIntent(strip(text));if(p&&p.k)r=exec(p,text)}
  if(!r){status('Thinking…');const a=await aiAnswer(text,status).catch(e=>{if(e&&e.name==='AbortError')throw e;return null});
   r=a?{say:a}:{say:aiReady()?'Sorry, I couldn’t answer that right now.':'I can add things and look up when you last did something. For other questions, set up an AI once (it can run privately on this device), and after that I’ll answer from your notes too.',chips:aiReady()?[['Try again','?'+text]]:aiChips(text)}}
  if(r&&r.say&&r.say.agent)r={agent:r.say.agent};
  if(r&&r.agent)r=await agentRun(r.agent,r.web);}
 catch(e){r={say:e&&e.name==='AbortError'?'Stopped.':'Something went wrong: '+(e&&e.message||e)}}
 status('');window.asHum(false);AS.liveT=null;turn.wait=false;turn.live='';turn.a=r.say||'';if(AS.srcs&&AS.srcs.length&&turn.a)turn.srcs=AS.srcs;if(AS.wrote&&turn.a&&!r.chips?.some?.(c=>c[1]==='agent'))turn.ai=1;AS.srcs=null;AS.wrote=false;turn.chips=(r.chips||[]).map(c=>({t:c[0],r:c[1],fn:c[2]}));if(r.undo){AS.undo[turn.id]=r.undo;turn.chips.unshift({t:'Undo',undo:1})}
 if(AS.acts&&AS.acts.length&&window.AIX){const A=AS.acts;AS.acts=null;turn.chips.unshift(...A.map(a=>{const c={t:'+ '+AIX.actLabel(a),act:1};c.fn=()=>{let x;try{x=AIX.doAct(a)}catch(e){return toast('Couldn’t add that')}c.t='✓ '+AIX.actLabel(a);c.fn=()=>x&&x.go&&(asClose(),setTimeout(()=>go(x.go),380));paint();toast(esc((x&&x.say)||'Added'))};return c}))}
 AS.await=r.await||null;AS.busy=false;AS.ctl=null;paint(true);pushWidget2();
 const talk=!r.quiet&&(aset().speak==='always'||aset().speak==='voice'&&AS.spoken);AS.after=(r.listen||AS.await)&&AS.spoken?'listen':null;
 if(talk&&turn.a){if(!sqEnd(r.speak||turn.a))speak(r.speak||turn.a)}else{sqStop();afterSpeak()}tmEnd()}
/* the assistant's AI asked for its agent (email, calendar, Drive, Notion): the agent's answer becomes this turn, its suggestions one-tap chips */
async function agentRun(task,web){if(!window.AGENT)return{say:'The agent isn’t available here.'};
 if(!AGENT.connected().length)return{say:'I can read your email, calendar, Google Drive and Notion once you connect them on the Agent page.',chips:[['Connect on the Agent page','agent']]};
 status('Asking your agent…');
 try{const x=await AGENT.ask(task,{onStep:status,web});return{say:x.md||'Done.',speak:x.say,chips:[...x.chips.map(c=>[c.t,'',agentChip(c.fn)]),['See it in the agent inbox','agent']]}}
 catch(e){return{say:'My agent couldn’t do that: '+(e&&e.message||e),chips:[['Open the agent','agent']]}}}
const agentChip=f=>async c=>{if(c.done)return;try{await f();c.done=1;c.t='✓ '+c.t;paint()}catch(e){}};

/* ---------------- speaking ---------------- */
let SPK=null,SPK_CB=null;
/* the voice, speed and pitch picked in Settings › Voice; done (optional) runs instead of the assistant's own follow-up */
function speak(text,done,ov){const t=String(text).replace(/[“”]/g,'"').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu,'').replace(/[*#_`]/g,'').trim();SPK_CB=done||null;if(!t)return spoke();const id='s'+uid();SPK=id;paintHead();tmMark('say');
 const A={...aset(),...(ov||{})},rate=+A.rate||1,pitch=+A.pitch||1;let voice=A.voice||'';
 /* a natural (Kokoro) voice speaks English; anything else, or if it fails before a word, the system voice does */
 if(/^kokoro:/.test(voice)){const kv=voice.slice(7);voice='';if(window.KOKORO&&KOKORO.can(t,vset().lang)){KOKORO.speak(t,{voice:kv,rate}).then(()=>{if(SPK===id){SPK=null;spoke()}},()=>{if(SPK===id)sysSpeak(id,t,rate,pitch,'')});return}}
 sysSpeak(id,t,rate,pitch,voice)}
function sysSpeak(id,t,rate,pitch,voice){
 if(NA&&NA.speak2){try{NA.speak2(id,t,vset().lang||'',rate,pitch,voice);return}catch(e){}}
 if(NA&&NA.speak){try{NA.speak(id,t,vset().lang||'',rate);return}catch(e){}}
 if(window.speechSynthesis){try{const u=new SpeechSynthesisUtterance(t);if(vset().lang)u.lang=vset().lang;const v=voice&&speechSynthesis.getVoices().find(x=>x.name===voice);if(v){u.voice=v;u.lang=v.lang}u.rate=rate;u.pitch=pitch;u.onend=u.onerror=()=>{if(SPK===id){SPK=null;spoke()}};speechSynthesis.cancel();speechSynthesis.speak(u);return}catch(e){}}
 SPK=null;spoke()}
function spoke(){const f=SPK_CB;SPK_CB=null;if(f){paintHead();f();return}afterSpeak()}
function hush(){sqStop();SPK=null;SPK_CB=null;try{if(window.KOKORO)KOKORO.stop()}catch(e){}try{if(NA&&NA.stopSpeaking)NA.stopSpeaking();else if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}paintHead()}
function afterSpeak(){paintHead();const a=AS.after;AS.after=null;if(a==='listen'&&AS.open)setTimeout(()=>listen(),250);else{wakePause(false);handsOff()}}
/* woken by "Hey Plot" while Plotlines was closed or the phone locked: once the answer is spoken and nothing follows, step aside again */
function handsOff(){if(!AS.bg||!NA||!NA.background)return;clearTimeout(AS.bgT);AS.bgT=setTimeout(()=>{if(!AS.bg||AS.busy||AS.listening||AS.await||SPK)return;AS.bg=false;asClose();try{NA.background()}catch(e){}},2500)}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(AS.bg){AS.bg=false;clearTimeout(AS.bgT)}},true));

/* ---------------- listening (the same mic as the rest of the app) ---------------- */
function listen(pre){if(!(AS.min&&$('#asv')))asOpen();const el=$('#asIn'),b=$('#asv .as-mic');if(!el||!b)return;if(typeof voiceAvail==='function'&&!voiceAvail()){toast('Voice isn’t available here. Type instead.');el.focus();return}hush();wakePause(true);el.value=typeof pre==='string'?pre:'';AS.listening=true;paintHead();voiceStart(el,b)}
{const _vs=voiceStart;voiceStart=function(el,btn){wakePause(true);return _vs(el,btn)}}
{const _vx=voiceStop;voiceStop=function(silent,keep){const c=VC;_vx(silent,keep);if(!c)return;if(c.el&&c.el.id==='asIn'){AS.listening=false;paintHead();const v=c.el.value.trim();if(keep&&v){c.el.value='';run(v,{spoken:true,heard:c.heard})}else wakePause(false)}else wakePause(false)}}

/* ---------------- wake word (Android) ---------------- */
function wakePause(p){if(!NA||!NA.wakePause)return;try{NA.wakePause(!!p)}catch(e){}}
function wakeSync(){if(!NA||!NA.wake)return;const a=aset(),v=vset();try{NA.wake(JSON.stringify({on:!!(a.wake||a.bg),bg:!!a.bg,name:aname(),lang:v.lang||'',cloud:!!v.cloud,quiet:a.quiet!==false,cues:a.cues!==false,cueStart:cueOf('start'),cueDone:cueOf('done')}))}catch(e){}}
window.__assist=(k,a,b)=>{
 if(k==='tts'){if(window.KOKORO&&KOKORO.tts(a,b))return;if(a===SPK&&(b==='done'||b==='err')){SPK=null;spoke()}return}
 if(k==='kokoro'){if(window.KOKORO)KOKORO.ev(a,b);return}
 if(k==='voices'){window.dispatchEvent(new Event('plot-voices'));return}
 /* "Hey Plot" on its own: the page's own mic takes over, with room to pause and think (the wake loop would stop at the first pause) */
 if(k==='wake'){asWarm();if(window.liveOpen&&document.getElementById('live'))return;asOpen();vib();AS.nlis=false;listen();return}
 if(k==='partial'){const i=$('#asIn');if(AS.nlis&&i)i.value=a;return}
 /* "Hey Plot, …" in one breath: a clear command runs now; anything else keeps listening in case there's more to say */
 if(k==='cmd'){asWarm();if(VC&&VC.el&&(VC.el.id==='asIn'||VC.el.id==='lvIn'))return;if(AS.nlis){AS.listening=AS.nlis=false;const i=$('#asIn');if(i)i.value=''}const tx=String(a||'').trim();if(!tx||parse(tx)||AS.busy){run(tx,{spoken:true});return}asOpen();listen(tx);return}
 if(k==='wstate'){AS.wst=a;if(a==='timeout'&&AS.nlis){AS.listening=AS.nlis=false;const i=$('#asIn');if(i)i.value=''}paintHead();return}};
function takePending(){if(!NA||!NA.takePending)return;let p='';try{p=NA.takePending()||''}catch(e){}if(p)setTimeout(()=>run(p,{spoken:true}),350)}

/* listening cues: a chime when it starts listening and another when it stops, loud enough to hear across a room (the
   phone's own recognizer beeps are hushed). Pick each one in Settings › AI & voice. Android plays the same sounds natively
   for the wake word (Chime.java has the same table); this one is for the mic button, conversation mode and the browser.
   n: notes [Hz, start s]; h: overtone ratio; hv: overtone level; d: decay (s); w: main wave */
const CUES={rise:{n:'Rising',f:[[784,0],[1175,.11]],h:2,hv:.18,d:.26},fall:{n:'Falling',f:[[1047,0],[659,.12]],h:2,hv:.18,d:.26},
 bell:{n:'Bell',f:[[1319,0]],h:2.76,hv:.35,d:.7},glass:{n:'Glass',f:[[2093,0]],h:3,hv:.15,d:.5},
 soft:{n:'Soft',f:[[523,0],[659,.14]],h:2,hv:.08,d:.4},pop:{n:'Pop',f:[[988,0]],h:2,hv:.1,d:.09},
 tap:{n:'Double tap',f:[[880,0],[880,.11]],h:2,hv:.12,d:.08},marimba:{n:'Marimba up',f:[[523,0],[659,.09],[784,.18]],h:3.9,hv:.3,d:.22},
 marimbad:{n:'Marimba down',f:[[784,0],[659,.09],[523,.18]],h:3.9,hv:.3,d:.22},low:{n:'Low hum',f:[[330,0]],h:2,hv:.25,d:.35},
 chirp:{n:'Chirp',f:[[1568,0],[2093,.06]],h:2,hv:.05,d:.07},none:{n:'Silent (buzz only)',f:[]}};
window.CUES=CUES;
const cueOf=k=>{const a=aset(),id=k==='start'?(a.cueStart||'soft'):(a.cueDone||'low');return CUES[id]?id:k==='start'?'soft':'low'};
let ACX=null;
function cuePlay(id){const q=CUES[id];if(!q||!q.f.length)return;try{ACX=ACX||new(window.AudioContext||window.webkitAudioContext)();const c=ACX;if(c.state==='suspended')c.resume();const t0=c.currentTime+.02,g=c.createGain();g.connect(c.destination);g.gain.value=1;
 q.f.forEach(([f,d])=>{[1,q.h].forEach((h,j)=>{const o=c.createOscillator(),e=c.createGain();o.type=j?'triangle':'sine';o.frequency.value=f*h;o.connect(e);e.connect(g);const a=t0+d,v=j?q.hv:.75,dd=j?q.d*.6:q.d;e.gain.setValueAtTime(0,a);e.gain.linearRampToValueAtTime(v,a+.008);e.gain.exponentialRampToValueAtTime(.001,a+dd);o.start(a);o.stop(a+dd+.04)})})}catch(e){}}
/* while the AI thinks in a spoken conversation, a quiet sound that feels like thinking, so you know it's working
   (Settings › AI & voice). All made here with Web Audio: little sparkles and runs of notes from a pentatonic scale
   (never a clash), soft ticks and blips, a slow breath. Nothing low or droning, and all of it quiet. */
const PENTA=[523.25,587.33,659.25,783.99,880];
const THINK={shimmer:{n:'Shimmer'},ripple:{n:'Ripple of notes'},ticks:{n:'Soft ticks'},bubbles:{n:'Bubbles'},compute:{n:'Computing'},breath:{n:'Breathing'},none:{n:'Silent'}};
const thinkOf=()=>{const a=aset();if(a.think&&THINK[a.think])return a.think;return a.hum===false||a.think==='none'?'none':'bubbles'};
/* one soft note: sine body plus a quick bright partial for the pluck */
function pluck(c,out,f,t,o={}){const d=o.d||1.4,v=o.v||.5;[[1,v,'sine',d],[o.h||4.01,v*(o.hv||.16),'sine',d*.25]].forEach(([m,vv,w,dd])=>{const x=c.createOscillator(),g=c.createGain();x.type=o.w&&m===1?o.w:w;x.frequency.value=f*m;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vv,t+(o.a||.006));g.gain.exponentialRampToValueAtTime(.0001,t+dd);x.connect(g);g.connect(out);x.start(t);x.stop(t+dd+.05)})}
let NOISE=null;const noiseBuf=c=>{if(NOISE&&NOISE.sampleRate===c.sampleRate)return NOISE;const n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let p=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;p=.97*p+.03*w;d[i]=w*.5+p*2}return NOISE=b};
function noiseSrc(c,out,type,freq,q){const s=c.createBufferSource();s.buffer=noiseBuf(c);s.loop=true;const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q||.7;s.connect(f);f.connect(out);s.start();return{s,f}}
const rnd=a=>a[Math.floor(Math.random()*a.length)];
/* a gentle swell on top, so a sound rises and settles like a thought taking shape */
function swell(c,out,hz,depth){const g=c.createGain();g.gain.value=1-depth;g.connect(out);const l=c.createOscillator(),lg=c.createGain();l.frequency.value=hz;lg.gain.value=depth;l.connect(lg);lg.connect(g.gain);l.start();return{g,stop:()=>{try{l.stop()}catch(e){}}}}
/* each sound starts on the master gain and returns its stop */
const TSTART={
 shimmer:(c,out)=>{const w=swell(c,out,.3,.45);let T=0;const tick=()=>{pluck(c,w.g,rnd(PENTA)*rnd([2,2,4]),c.currentTime+.02,{v:.3,d:.7,h:2.01,hv:.2});T=setTimeout(tick,110+Math.random()*170)};tick();return()=>{clearTimeout(T);w.stop()}},
 ripple:(c,out)=>{let T=0,up=true;const tick=()=>{const t=c.currentTime+.02,s=Math.floor(Math.random()*3);for(let k=0;k<5;k++){const i=s+(up?k:4-k),f=PENTA[i%5]*(i>=5?4:2);pluck(c,out,f,t+k*.085,{v:.22-k*.02,d:.8,h:3,hv:.12})}up=!up;T=setTimeout(tick,1400)};tick();return()=>clearTimeout(T)},
 ticks:(c,out)=>{let T=0,i=0;const tick=()=>{const t=c.currentTime+.02,s=c.createBufferSource(),f=c.createBiquadFilter(),e=c.createGain();s.buffer=noiseBuf(c);f.type='bandpass';f.frequency.value=i++%2?2400:3100;f.Q.value=6;e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(3,t+.002);e.gain.exponentialRampToValueAtTime(.0001,t+.035);s.connect(f);f.connect(e);e.connect(out);s.start(t,Math.random());s.stop(t+.05);T=setTimeout(tick,i%4?300:520)};tick();return()=>clearTimeout(T)},
 bubbles:(c,out)=>{let T=0;const tick=()=>{const n=1+Math.floor(Math.random()*3);for(let k=0;k<n;k++){const t=c.currentTime+.02+k*.09,x=c.createOscillator(),e=c.createGain(),f=380+Math.random()*420;x.frequency.setValueAtTime(f,t);x.frequency.exponentialRampToValueAtTime(f*2.2,t+.09);e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(.5,t+.012);e.gain.exponentialRampToValueAtTime(.0001,t+.13);x.connect(e);e.connect(out);x.start(t);x.stop(t+.15)}T=setTimeout(tick,350+Math.random()*700)};tick();return()=>clearTimeout(T)},
 compute:(c,out)=>{const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;lp.connect(out);let T=0;const tick=()=>{const n=3+Math.floor(Math.random()*5),t0=c.currentTime+.02;for(let k=0;k<n;k++){const t=t0+k*.07,x=c.createOscillator(),e=c.createGain();x.type='triangle';x.frequency.value=rnd(PENTA)*rnd([2,4]);e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(.26,t+.004);e.gain.setValueAtTime(.26,t+.035);e.gain.linearRampToValueAtTime(0,t+.05);x.connect(e);e.connect(lp);x.start(t);x.stop(t+.06)}T=setTimeout(tick,n*70+350+Math.random()*600)};tick();return()=>clearTimeout(T)},
 breath:(c,out)=>{const g=c.createGain();g.gain.value=0;g.connect(out);const a=noiseSrc(c,g,'bandpass',900,.6);let T=0;const cyc=()=>{const t=c.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(.7,t+1.8);g.gain.linearRampToValueAtTime(.04,t+4.2);a.f.frequency.setValueAtTime(700,t);a.f.frequency.linearRampToValueAtTime(1300,t+1.8);a.f.frequency.linearRampToValueAtTime(700,t+4.2);T=setTimeout(cyc,4400)};cyc();return()=>{clearTimeout(T);try{a.s.stop()}catch(e){}}}};
let HUM=null;
function thinkPlay(id){const s=TSTART[id];if(!s)return null;try{ACX=ACX||new(window.AudioContext||window.webkitAudioContext)();const c=ACX;if(c.state==='suspended')c.resume();const t=c.currentTime,g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.3,t+.6);g.connect(c.destination);return{c,g,stop:s(c,g)}}catch(e){return null}}
function thinkStop(h){if(!h)return;try{h.stop();const t=h.c.currentTime;h.g.gain.cancelScheduledValues(t);h.g.gain.setValueAtTime(h.g.gain.value,t);h.g.gain.linearRampToValueAtTime(0,t+.4);setTimeout(()=>{try{h.g.disconnect()}catch(e){}},600)}catch(e){}}
window.asHum=on=>{const id=thinkOf();if(on&&id==='none')on=false;if(!on){thinkStop(HUM);HUM=null;return}if(HUM)return;HUM=thinkPlay(id)};
let THTRY=null;function thinkTry(){thinkStop(THTRY);const h=THTRY=thinkPlay(thinkOf());setTimeout(()=>{if(THTRY===h){thinkStop(h);THTRY=null}},5000)}
window.asCue=k=>{if(aset().cues===false)return;cuePlay(cueOf(k));try{navigator.vibrate&&navigator.vibrate(k==='start'?[18]:[10,60,10])}catch(e){}};

/* ---------------- the sheet ---------------- */
function headSub(){if(AS.busy)return AS.prog||'Thinking…';if(AS.listening)return'Listening…';if(SPK)return'Speaking…';const a=aset();if(NA&&(a.wake||a.bg)){const w=AS.wst||'';return w==='err'?'Can’t hear the wake word right now':w==='perm'?'Allow the microphone for the wake word':w==='unavailable'?'The wake word needs online speech allowed':w==='lang'?'The phone’s on-device speech can’t do your language yet. Allow online speech in Settings › Voice':`Say “${wakeWord()}” anytime`}return'Ask or tell me anything'}
function asOpen(){AS.open=true;if(AS.min){AS.min=false;miniPaint()}let el=$('#asv');if(el){el.classList.remove('min');el.classList.add('on')}else{el=document.createElement('div');el.id='asv';el.className='aov asv';
 el.innerHTML=`<div class="aov-dim" data-act="asClose"></div><section class="aov-s" role="dialog" aria-modal="true" aria-label="Assistant"><div class="aov-h"><span class="aov-grab" aria-hidden="true"></span><div class="aov-t"><span class="as-av" aria-hidden="true"><i></i></span><span class="as-tt"><b class="as-nm"></b><small class="as-st"></small></span></div><button class="as-stop" data-act="asStop" aria-label="Stop talking">■ Stop</button><button class="ibtn sm" data-act="liveOpen" aria-label="Talk out loud" title="Talk out loud">${ic('live')}</button><button class="ibtn sm" data-act="convGo" aria-label="Conversation history" title="History">${ic('hist')}</button><button class="ibtn sm" data-act="asClear" aria-label="New conversation" title="New conversation">${ic('plus')}</button><button class="ibtn sm" data-act="asSet" aria-label="Assistant settings" title="Settings">${ic('settings')}</button><button class="ibtn sm" data-act="asMin" aria-label="Minimize" title="Minimize">${ic('minz')}</button><button class="ibtn sm" data-act="asClose" aria-label="Close" title="Close">✕</button></div><div class="as-qs" role="toolbar" aria-label="Quick settings"></div><div class="aov-b as-b"></div><div class="ask-comp aov-comp"><form class="ask-row as-row" data-form="asSend" autocomplete="off"><input id="asIn" maxlength="500" placeholder="Ask or tell me something…" aria-label="Message" enterkeyhint="send"><button type="submit" class="as-send" aria-label="Send" title="Send">${ic('up')}</button><button type="button" class="as-mic" data-act="asMic" aria-label="Talk">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'}<i></i></button></form>${window.AIX?AIX.note('as-note'):''}</div></section>`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'))}
 document.documentElement.classList.add('aov-on');paint(true);return el}
function asClose(){AS.open=false;if(AS.min){AS.min=false;miniPaint()}$('#asv')?.classList.remove('min');if(VC&&VC.el&&VC.el.id==='asIn')voiceStop(true);hush();const el=$('#asv');document.documentElement.classList.remove('aov-on');if(!el)return;el.classList.remove('on');setTimeout(()=>{if(!AS.open)el.remove()},360);wakePause(false)}
function paintHead(){const el=$('#asv');if(!el)return;el.querySelector('.as-nm').textContent=aname();el.querySelector('.as-st').textContent=headSub();el.classList.toggle('lis',AS.listening);el.classList.toggle('spk',!!SPK);el.classList.toggle('busy',AS.busy);miniPaint()}
IC.minz='<path d="M7 9l5 5 5-5"/><path d="M6 19h12"/>';
/* minimized: the conversation keeps going (listening, thinking, talking) behind a small bubble */
function asMin(){const el=$('#asv');if(!el||!AS.open)return;AS.min=true;document.activeElement?.blur?.();el.classList.remove('on');el.classList.add('min');document.documentElement.classList.remove('aov-on');miniPaint()}
function miniPaint(){aiMini('asMini',AS.min&&AS.open?{open:'asBack',end:'asClose',name:aname(),st:headSub(),state:AS.listening?'lis':SPK?'spk':AS.busy?'busy':''}:null)}
function aiMini(id,o){let el=document.getElementById(id);if(!o){if(el){el.classList.remove('on');setTimeout(()=>{if(!el.classList.contains('on'))el.remove()},320)}return}
 if(!el){el=document.createElement('div');el.id=id;el.className='ai-mini';el.innerHTML=`<button class="ai-mi" data-act="${o.open}" aria-label="Open the conversation"><span class="as-av" aria-hidden="true"><i></i></span><span class="ai-mt"><b></b><small></small></span></button><button class="ai-mx" data-act="${o.end}" aria-label="End the conversation" title="End">${ic('x')}</button>`;document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'))}
 else el.classList.add('on');el.querySelector('.ai-mt b').textContent=o.name;el.querySelector('.ai-mt small').textContent=o.st||'';el.dataset.st=o.state||''}
window.aiMini=aiMini;
function status(t){AS.prog=t||'';paintHead()}
/* answers read like a chat: "* item" / "- item" lines become a list, **bold** stays bold, paragraphs stay apart */
function ansHTML(a){if(window.AIX&&AIX.md)return`<div class="ai-md">${AIX.md(a)}</div>`;const L=String(a||'').replace(/\r/g,'').split('\n');let o='',ul=false;const inl=x=>esc(x).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
 for(const raw of L){const l=raw.trim();const m=/^(?:[*\-•]|\d+[.)])\s+(.*)$/.exec(l);if(m){if(!ul){o+='<ul>';ul=true}o+=`<li>${inl(m[1])}</li>`;continue}if(ul){o+='</ul>';ul=false}if(l)o+=`<p>${inl(l)}</p>`}
 if(ul)o+='</ul>';return o||'<p></p>'}
function chipHTML(t,c,i){return c.undo?`<button class="btn sm ghost" data-act="asUndo" data-id="${t.id}">Undo</button>`:`<button class="btn sm ghost" data-act="asChip" data-id="${t.id}" data-i="${i}">${esc(c.t)}</button>`}
/* ---------------- Ask and the chat are one ----------------
   The Ask page, its suggestions, Home insights and "Ask about this" all open this one conversation. The orb opens it over
   the page you're on; the Ask tab opens it full height. Talk out loud (Live) stays its own button. */
/* the answer so far, while the AI is still writing it */
function liveText(t){const v=String(t&&t.live||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'').replace(/^\s*AGENT\s*:.*$/gim,'');const sh=(window.AIX?AIX.hideActs(v):v).trim();return!sh||/^\{|^A(?:G(?:E(?:N(?:T)?)?)?)?$/i.test(sh)?'':sh}
let LVF=0;
function liveFeed(raw){const t=AS.liveT;if(!t||!t.wait)return;t.live=raw;if(LVF)return;LVF=requestAnimationFrame(()=>{LVF=0;const el=$('#asv'),sh=liveText(t);if(!el||!t.wait||!sh)return;const w=el.querySelectorAll('.as-a.wait'),a=w[w.length-1];if(!a)return;const b=el.querySelector('.as-b'),near=b.scrollHeight-b.scrollTop-b.clientHeight<160;a.classList.add('live');a.querySelector('.as-ab').innerHTML=ansHTML(sh);if(near)b.scrollTop=b.scrollHeight})}
/* under a written answer: copy it, keep it in the journal, see the notes it used */
function actsHTML(t){if(!t.a||!t.ai&&!t.srcs)return'';const n=t.srcs?t.srcs.length:0;
 return`<div class="as-acts"><button class="as-ac" data-act="asCopy" data-id="${t.id}">${ic('copy')}Copy</button><button class="as-ac" data-act="asSave" data-id="${t.id}">${ic('journal')}Save to journal</button>${n?`<button class="as-ac" data-act="asSrcs" data-id="${t.id}">${ic('search')}${n} note${n===1?'':'s'}</button>`:''}</div>`}
/* Ask's ready-made questions (weekly reflection, mood patterns…) */
function preHTML(){if(typeof INS_PRE==='undefined')return'';return`<div class="ask-sugs as-pre"><div class="as-pre-h">Ask about your life</div>${INS_PRE.map(p=>`<button class="ask-sug" data-act="asPre" data-k="${p.k}"><b>${esc(p.n)}</b><small>${esc(p.d)}</small></button>`).join('')}</div>`}
/* no AI yet: set one up, or take the question (with their notes) to any AI */
function aiChips(q){const c=[['Set up the AI','',()=>window.aiQuick?aiQuick():go('settings/voice')]];
 if(insSet().engine==='copy')c.push(['Copy it as a prompt for any AI','',async()=>{const r=await ragRetrieve(q,{win:0,goal:'',broad:true},null).catch(()=>null);toast(await copyText(asCtx(q,r))?'Copied. Paste it into any AI':'Copy failed. Try again')}]);return c}
/* quick settings, right in the chat; the rest are one tap away under More */
function qsBar(){const a=aset(),ready=aiReady(),lbl=typeof askEngineLabel==='function'?askEngineLabel().split(' · ')[0]:'AI';
 return`<label class="as-qc" title="Read replies out loud">${ic('speak')}<select data-assist="speak" aria-label="Read replies out loud">${[['voice','Read aloud when I talk'],['always','Always read aloud'],['never','Never read aloud']].map(([k,n])=>`<option value="${k}" ${(a.speak||'voice')===k?'selected':''}>${n}</option>`).join('')}</select></label>`+
 `<button class="as-qc${ready?'':' warn'}" data-act="asQsModel" title="AI model">${ic('ai')}<span>${ready?esc(lbl):'Set up the AI'}</span></button>`+
 (NA?`<label class="as-qc tg${a.wake?' on':''}" title="Wake word"><input type="checkbox" data-assist="wake" ${a.wake?'checked':''}>${ic('mic')}<span>“${esc(wakeWord())}” ${a.wake?'on':'off'}</span></label>`:'')+
 `<label class="as-qc tg${a.fast!==false?' on':''}" title="Instant mode"><input type="checkbox" data-assist="fast" ${a.fast!==false?'checked':''}><span>⚡ Instant ${a.fast!==false?'on':'off'}</span></label>`+
 `<button class="as-qc" data-act="asSet" title="All assistant settings">${ic('tune')}<span>More</span></button>`}
function qsPaint(){const q=$('#asv .as-qs');if(q)q.innerHTML=qsBar()}
document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('.as-qs'))setTimeout(qsPaint,60)});
function openAsk(){asOpen();$('#asv')?.classList.add('full');asWarm()}
Object.assign(ACT,{
 asCopy:async d=>{const t=AS.turns.find(x=>x.id===d.id);if(!t)return;toast(await copyText(String(t.a).replace(/\*\*/g,''))?'Copied':'Copy failed')},
 asSave:d=>{const t=AS.turns.find(x=>x.id===d.id);if(!t||!t.a)return;const html=cleanHTML(mdLite(t.a,0));S.entries.push({id:uid(),t:Date.now(),type:'note',goalId:null,title:'Insight · '+trunc(t.q,60),text:htmlText(html),html,mood:'',private:false,sid:null,img:null});save();toast('Saved to your journal')},
 asSrcs:d=>{const t=AS.turns.find(x=>x.id===d.id);if(!t||!t.srcs)return;AS.srcT=t;openSheet(`<h2>Notes used</h2><p class="small muted">From your own data, on this device.</p><ol class="ins-src-l">${t.srcs.map((x,i)=>`<li><button class="ins-si" data-act="asSrc" data-i="${i}"><span class="n">${i+1}</span><span class="t"><b>${esc(trunc(x.label||'',70))}</b><small>${esc(({entry:'Journal',goal:'Goal',habit:'Habit',day:'Day plan'})[x.kind]||'')}${(x.kind==='entry'||x.kind==='day')&&x.date?' · '+fmtDate(x.date):''}</small></span></button></li>`).join('')}</ol><div class="actions"><button class="btn" data-act="close">Done</button></div>`)},
 asSrc:d=>{const x=AS.srcT&&AS.srcT.srcs[+d.i];if(!x)return;closeSheet();asClose();setTimeout(()=>{if(x.kind==='entry'){if(S.entries.some(e=>e.id===x.ref))ACT.viewEntry({id:x.ref})}else if(x.kind==='goal')go('goal/'+x.ref);else if(x.kind==='habit')go('habit/'+x.ref);else if(x.kind==='day'){CAL.d=x.ref;S.settings.layout.cal='day';go('cal')}},380)},
 asPre:d=>{const p=typeof INS_PRE!=='undefined'&&INS_PRE.find(x=>x.k===d.k);if(p)run(p.q,{ask:1,pre:p,show:p.n})},
 asQsModel:()=>window.aiQuick?aiQuick():go('settings/voice'),
 askGo:()=>{asOpen();asWarm();setTimeout(()=>$('#asIn')?.focus(),300)},
 askOpen:()=>{openAsk();setTimeout(()=>$('#asIn')?.focus(),300)}});
/* everything that used to open the Ask page or its overlay asks here instead */
askWith=function(q){if(AS.busy)return toast('Still working on the last one');run(q,{ask:1})};
{const _go=go;go=function(h){if(h==='ask'||h==='insights'){if(typeof closeSheet==='function'&&$('#sheet')?.classList.contains('on'))closeSheet();openAsk();return}return _go.apply(this,arguments)}}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href="#/ask"],a[href="#/insights"]');if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey)return;e.preventDefault();e.stopPropagation();go('ask')},true);
/* an old link, the start page or Back landing on #/ask: show Home under the chat */
/* (set once every script has loaded, since Conversations wraps the Ask page too) */
{const f=()=>{VIEWS.ask=function(){setTimeout(()=>{if(cur.p!=='ask')return;history.replaceState(null,'','#/today');route();openAsk()},0);return VIEWS.today.apply(this,arguments)}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',f);else f()}
function paint(scroll){const el=$('#asv');if(!el)return;paintHead();const b=el.querySelector('.as-b');
 b.innerHTML=AS.turns.length?AS.turns.map(t=>`<div class="as-t"><div class="as-qr">${t.wait?'':`<button class="as-tx" data-act="asDel" data-id="${t.id}" aria-label="Remove this message and its answer" title="Remove">${ic('x')}</button>`}<p class="as-q">${esc(t.q)}</p></div><div class="as-a${t.wait?' wait':''}${t.wait&&liveText(t)?' live':''}"><span class="as-dot" aria-hidden="true"></span><div class="as-ab">${t.wait?(liveText(t)?ansHTML(liveText(t)):'<p><i></i><i></i><i></i></p>'):ansHTML(t.a)}${t.chips&&t.chips.length?`<div class="as-ch">${t.chips.map((c,i)=>chipHTML(t,c,i)).join('')}</div>`:''}${t.wait?'':actsHTML(t)}</div></div></div>`).join(''):
 `<div class="as-empty"><button class="as-big" data-act="asMic" aria-label="Talk"><i></i></button><p><b>Hi, I’m ${esc(aname())}.</b> Tap and talk${NA&&(aset().wake||aset().bg)?`, or say “${esc(wakeWord())}”`:''}. Ask me anything.</p><div class="as-go"><button class="btn sm pri" data-act="liveOpen">${ic('live')}Talk out loud</button><a class="btn sm" href="#/agent">${ic('agent')}Agent</a><button class="btn sm" data-act="aiStart">${ic('ai')}Plan with AI</button></div>${window.AIX&&AIX.modelCard&&insSet().engine!=='api'&&!AIX.ready()?`<div class="as-mc">${AIX.modelCard('chat')}</div>`:''}${NA&&!aset().wake&&!aset().bg?`<button class="btn sm" data-act="asWakeOn" style="margin:4px 0 6px">Turn on “${esc(wakeWord())}”</button>`:''}${window.AIX&&AIX.sugs?(setTimeout(()=>AIX.sugAuto('chat'),0),AIX.sugs('chat','asTry')):`<div class="as-sugs">${['Add “had a great workout” to my journal','When did I last change my oil?','Remind me to call mom at 6pm','What do I have today?'].map(s=>`<button class="as-sug" data-act="asTry" data-q="${esc(s.replace(/[“”]/g,''))}">${esc(s)}</button>`).join('')}</div>`}${preHTML()}</div>`;
 qsPaint();if(scroll)b.scrollTop=b.scrollHeight;convSync()}
Object.assign(ACT,{
 asOpen:()=>{asOpen();asWarm();setTimeout(()=>{if(!AS.turns.length&&NA&&typeof voiceAvail==='function'&&voiceAvail())listen();else $('#asIn')?.focus()},300)},
 asClose:()=>asClose(),asMin:()=>asMin(),asBack:()=>asOpen(),asSet:()=>{if(window.aiQuick)aiQuick();else go('settings/voice')},
 asMic:()=>{if(VC&&VC.el&&VC.el.id==='asIn'){voiceStop(false,true);return}if(AS.busy){AS.ctl&&AS.ctl.abort();return}AS.nlis=false;listen()},
 asStop:()=>{AS.after=null;if(AS.busy&&AS.ctl)AS.ctl.abort();if(VC&&VC.el&&VC.el.id==='asIn')voiceStop(true);AS.listening=AS.nlis=false;hush();wakePause(false)},
 asTry:d=>run(d.q),
 asDel:d=>{const i=AS.turns.findIndex(t=>t.id===d.id);if(i<0)return;const t=AS.turns[i],cid=AS.cid;AS.turns.splice(i,1);if(window.CONV&&CONV.removeTurn&&cid)CONV.removeTurn(cid,t.id);if(!AS.turns.length)AS.cid=null;paint();pushWidget2();
  toast('Message removed',()=>{AS.turns.splice(Math.min(i,AS.turns.length),0,t);if(!AS.cid)AS.cid=cid;paint();convSync()})},
 asClear:()=>{convFresh('chat');hush();paint();pushWidget2()},
 asUndo:d=>{const f=AS.undo[d.id];if(!f)return;delete AS.undo[d.id];try{f()}catch(e){}const t=AS.turns.find(x=>x.id===d.id);if(t){t.chips=t.chips.filter(c=>!c.undo);t.a+=' (undone)'}paint();pushWidget2();toast('Undone')},
 asChip:d=>{const t=AS.turns.find(x=>x.id===d.id),c=t&&t.chips[+d.i];if(!c)return;if(c.fn)return c.fn(c);const r=c.r||'';if(r[0]==='?'){if(!aiReady())return window.aiQuick?aiQuick():go('settings/voice');run(r.slice(1),{ask:1});return}asClose();setTimeout(()=>window.__route(r.replace(/^~/,'')),380)}});
Object.assign(FORM,{asSend:f=>{const i=f.querySelector('input'),v=i.value.trim();if(!v)return listen();i.value='';sendState();run(v,{spoken:false})}});
function sendState(){const i=$('#asIn'),r=$('#asv .as-row');if(i&&r)r.classList.toggle('typed',!!i.value.trim()&&!AS.listening)}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='asIn')sendState()});
/* was a sheet open when Escape was pressed? (the sheet's own handler closes it first) */
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.__escSheet=$('#sheet').classList.contains('on')},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AS.open&&!AS.min&&!window.__escSheet)asClose()});
window.addEventListener('hashchange',()=>{if(AS.open&&!AS.min)asClose()});
{const _b=window.__back;window.__back=()=>{if(AS.open&&!AS.min){asClose();return true}return _b?_b():false}}

/* routes from the widget, the app shortcut and the wake word: assistant, assistant-listen, assistant-type; the wake word heard in the background adds -bg */
{const _r=window.__route;window.__route=r=>{if(/^assistant/.test(r||'')){if(/-bg$/.test(r))AS.bg=true;asOpen();const k=r.split('-')[1];setTimeout(()=>{if(k==='share'){if(shareIn())return;}takePending();if(k==='listen')listen();else if(k==='type')$('#asIn')?.focus()},450);return}return _r&&_r(r)}}

/* the orb in every page's top bar */
{const _g=gear;gear=function(){return(aset().talk!==false&&window.liveOpen?`<button class="ibtn lv-btn" data-act="liveOpen" aria-label="Talk out loud with ${esc(aname())}" title="Talk out loud">${ic('live')}</button>`:'')+(aset().btn?`<button class="ibtn as-btn" data-act="asOpen" aria-label="Ask ${esc(aname())}" title="Ask ${esc(aname())}"><span class="as-av"><i></i></span></button>`:'')+_g()}}

/* the home-screen widget gets the last exchange */
function pushWidget2(){if(!NA||!NA.widget)return;const L=AS.turns.filter(t=>!t.wait).slice(-2).map(t=>({q:t.q,a:t.a,t:t.t}));try{NA.widget(JSON.stringify({name:aname(),wake:NA&&(aset().wake||aset().bg)?wakeWord():'',turns:L}))}catch(e){}}

/* ---------------- settings: AI & voice ---------------- */
function assistHTML(){const a=aset(),st=nst(),v=vset();
 const row=(k,t,sub,on,dis)=>`<label class="sw"><span>${t}<small>${sub}</small></span><input type="checkbox" data-assist="${k}" ${on?'checked':''} ${dis?'disabled':''}><i></i></label>`;
 return`<section class="panel rv" id="assistPanel"><h3>Hey ${esc(aname())}</h3><p class="small muted">Your voice assistant. Ask it to add to today’s journal, start or update a thread, set a reminder, add to a list or mark a habit done, or ask things like “when did I last change my oil?”.</p>
 <div class="field"><label>Assistant’s name</label><input data-assist="name" maxlength="24" value="${esc(aname())}" placeholder="Plot"><small class="muted">You’ll say “Hey ${esc(aname())}”.</small></div>
 ${NA?row('wake',`Listen for “${esc(wakeWord())}” while Plotlines is open`,'The phone’s speech recognizer listens in short rounds while the app is on screen',a.wake)+
 row('bg','Keep listening in the background',`Hands-free, even with the phone locked: say it and it answers out loud. Android needs a small silent notification while it listens, and it uses more battery.${st.onDevice===false&&!v.cloud?' This phone has no on-device speech, so it needs online speech allowed.':''}`,a.bg)+
 row('cues','Listening sounds','A clear chime when I start listening and another when I stop',a.cues!==false)+

 row('quiet','Quiet listening','Mutes the speech recognizer’s start and stop beeps (and other notification sounds for that moment) so it doesn’t chime while it listens',a.quiet!==false)+
 (a.bg&&st.overlay===false?`<div class="rm-snz mute" style="margin-top:10px">${ic('bell')}<div><b>Let ${esc(aname())} pop up</b><small>So “${esc(wakeWord())}” can open Plotlines over other apps. Without it you’ll get a notification to tap instead.</small></div><button class="btn sm" data-act="asOverlay">Allow</button></div>`:''):`<p class="small muted">The “${esc(wakeWord())}” wake word works in the Android app. Here, tap the orb at the top to talk.</p>`}
<div class="field"><label>While I think in a conversation</label><div class="as-cue"><select data-assist="think">${Object.entries(THINK).map(([id,q])=>`<option value="${id}" ${thinkOf()===id?'selected':''}>${q.n}</option>`).join('')}</select><button class="ibtn" data-act="asThinkTry" aria-label="Play this sound">${ic('play')}</button></div><small class="muted">A quiet sound so you know I’m working on an answer.</small></div>
${a.cues!==false?`<div class="as-cues">${[['cueStart','When I start listening','start'],['cueDone','When I stop listening','done']].map(([k,l,w])=>`<div class="field"><label>${l}</label><div class="as-cue"><select data-assist="${k}">${Object.entries(CUES).map(([id,q])=>`<option value="${id}" ${cueOf(w)===id?'selected':''}>${q.n}</option>`).join('')}</select><button class="ibtn" data-act="asCueTry" data-w="${w}" aria-label="Play this sound">${ic('play')}</button></div></div>`).join('')}</div>`:''}
 <div class="field"><label>Read replies out loud</label><select data-assist="speak">${[['voice','When I talk to it'],['always','Always'],['never','Never']].map(([k,n])=>`<option value="${k}" ${a.speak===k?'selected':''}>${n}</option>`).join('')}</select></div>
 ${NA&&NA.openAssistSettings?`<div class="rm-snz mute" style="margin-top:10px">${ic('bell')}<div><b>${st.assistRole?`${esc(aname())} is your phone’s assistant`:`Use ${esc(aname())} as your phone’s assistant`}</b><small>${st.assistRole?'Press and hold the side button to talk to it from anywhere.':'Pick Plotlines as the digital assistant app, then press and hold the side button to talk from anywhere. On Samsung: Settings › Advanced features › Side button › Press and hold › Digital assistant. This replaces Gemini on that button.'} You can also share text from any app to Plotlines, or select text and tap Send to Plotlines.</small></div><button class="btn sm" data-act="asRole">${st.assistRole?'Change':'Set up'}</button></div>`:''}
 ${row('fast','Instant mode','Commands and simple lookups (“add milk to groceries”, “log 2 glasses of water”, “how many steps today”) are done on the phone at once, without the AI. Questions skip an extra AI step, spoken answers stay short, and I start talking at the first sentence.',a.fast!==false)}
 ${row('btn','Ask button in the top bar','The orb next to search and settings opens the chat',a.btn)}
 ${row('talk','Talk button in the top bar','Starts a spoken conversation straight away',a.talk!==false)}
 <details class="as-sd"><summary>Speed of my last answers</summary>${speedHTML()}</details>
 <div class="actions left"><button class="btn sm pri" data-act="asOpen">Try it</button></div></section>`}
{const _vh=voiceHTML;voiceHTML=function(){return _vh()+assistHTML()}}
/* the few that matter mid-conversation, for the quick settings sheet */
function quickHTML(){const a=aset();return`<div class="field"><label>Read replies out loud</label><select data-assist="speak">${[['voice','When I talk to it'],['always','Always'],['never','Never']].map(([k,n])=>`<option value="${k}" ${(a.speak||'voice')===k?'selected':''}>${n}</option>`).join('')}</select></div>
 <div class="field"><label>While I think</label><div class="as-cue"><select data-assist="think">${Object.entries(THINK).map(([id,q])=>`<option value="${id}" ${thinkOf()===id?'selected':''}>${q.n}</option>`).join('')}</select><button class="ibtn" data-act="asThinkTry" aria-label="Play this sound">${ic('play')}</button></div></div>
 <label class="sw"><span>Listening sounds<small>A chime when I start and stop listening</small></span><input type="checkbox" data-assist="cues" ${a.cues!==false?'checked':''}><i></i></label>`}
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.assist)return;const k=t.dataset.assist;let v=t.type==='checkbox'?t.checked:t.value;
 if(k==='name'){v=String(v).replace(/[^\p{L}\p{N} '\-]/gu,'').trim().slice(0,24)||'Plot';v=cap(v)}
 if((k==='wake'||k==='bg')&&v){const st=typeof vstate==='function'?vstate():{};if(!st.onDevice&&!vset().cloud){const ok=await voiceConsent();if(!ok){t.checked=false;return}}if(!(await permAsk('mic','android.permission.RECORD_AUDIO'))){t.checked=false;return toast('Allow the microphone to use the wake word')}if(k==='bg')askNotif()}
 S.settings.assist={...aset(),[k]:v};save();wakeSync();render(false);if(k==='cueStart'||k==='cueDone')cuePlay(v);if(k==='think')thinkTry();if((k==='wake'||k==='bg')&&v)toast(`Say “${wakeWord()}” to try it`)});
Object.assign(ACT,{asSpdClear:()=>{try{localStorage.removeItem(TM_KEY)}catch(e){}rerender()},asThinkTry:()=>thinkTry(),asCueTry:d=>cuePlay(cueOf(d.w)),asWakeOn:async()=>{const st=typeof vstate==='function'?vstate():{};if(!st.onDevice&&!vset().cloud&&!(await voiceConsent()))return;if(!(await permAsk('mic','android.permission.RECORD_AUDIO')))return toast('Allow the microphone to use the wake word');S.settings.assist={...aset(),wake:true};save();wakeSync();paint();toast(`Say “${wakeWord()}” while Plotlines is open`)},asOverlay:()=>{try{NA.openOverlaySettings()}catch(e){}},asRole:()=>{try{NA.openAssistSettings()}catch(e){}}});

/* ---------------- start ---------------- */
function rerender(){try{render(false)}catch(e){}}
function bgCheck(){if(nst().bgOff&&aset().bg){S.settings.assist={...aset(),bg:false};save();rerender()}}
/* a talk over the screen that closed early can't leave the wake word paused */
setTimeout(()=>{if(cur.p==='ask'&&!document.documentElement.classList.contains('talk')){history.replaceState(null,'','#/today');route();openAsk()}if(!document.documentElement.classList.contains('talk')&&!AS.open&&!document.getElementById('live')&&!(VC&&VC.el))wakePause(false);bgCheck();wakeSync();pushWidget2();takePending();if(NA&&(aset().wake||aset().bg))setTimeout(asWarm,4000)},1200);
window.addEventListener('app-resume',()=>{setTimeout(()=>{bgCheck();wakeSync();takePending()},300)});
window.PLOT_ASSIST={quickHTML,run,asCtx,parse,parseWhen,localAsk,aname,ctx:asCtx,
 /* for the live conversation (ai.js) */
 command:t=>{const p=parse(t);if(!p||['hello','thanks','cancel','help','whoami','live'].includes(p.k))return null;if(p.k==='done'){const r=exec(p,t);return r&&r.undo?r:null}const r=exec(p,t);return r&&!r.await?r:null},
 lookup:t=>localAsk(t),say:(t,done,ov)=>speak(t,done||(()=>{}),ov),hush:()=>hush(),close:()=>{if(AS.open)asClose()},
 addTurn:(q,a)=>{AS.turns.push({q,a,chips:[],t:Date.now(),id:uid(),live:1});AS.turns=AS.turns.slice(-30);convSync();pushWidget2()},
 /* conversations: talk mode joins the one on screen if it was just used, else starts its own; resume loads a saved one */
 begin:kind=>{if(!(AS.turns.length&&AS.last&&Date.now()-AS.last<CV_GAP/2))convFresh(kind);return AS.turns.filter(t=>!t.wait&&t.a).map(t=>({q:t.q,a:t.a}))},
 resume:id=>{const c=window.CONV&&CONV.get(id);if(!c)return false;hush();AS.turns=c.turns.map(t=>({q:t.q,a:t.a,chips:[],t:t.t,id:t.id})).slice(-30);AS.cid=c.id;AS.kind=c.k==='ask'?'chat':c.k;AS.await=null;AS.undo={};AS.last=Date.now();if(AS.open)paint(true);return true},
 current:()=>AS.cid,
 doItems:items=>doItems(items),
 /* streamed speech for Live: start({first,done}), feed(text so far), end(final) → false when nothing was streamed */
 needsDecide:t=>needsDecide(t),
 stream:{start:o=>{if(fastOn())sqStart(o)},feed:t=>sqFeed(t),end:t=>sqEnd(t),stop:()=>sqStop()},fast:()=>fastOn(),warm:()=>asWarm(),
 dropTurn:tid=>{AS.turns=AS.turns.filter(t=>t.id!==tid);delete AS.undo[tid];if(AS.open)paint()},
 /* an agent result continued in chat (Agent page › Continue in chat) */
 inject:(q,a,chips)=>{if(!(AS.turns.length&&AS.last&&Date.now()-AS.last<CV_GAP))convFresh('chat');AS.turns.push({q,a,chips:(chips||[]).map(c=>({t:c.t,fn:agentChip(c.fn)})),t:Date.now(),id:uid()});AS.turns=AS.turns.slice(-30);asOpen();paint(true);setTimeout(()=>$('#asIn')?.focus(),300)}};

const css=document.createElement('style');css.textContent=`
.as-sd{margin:12px 0 4px}.as-sd summary{cursor:pointer;font:600 14px var(--f-body);color:var(--accent);padding:6px 0}.as-spd{list-style:none;margin:6px 0;padding:0}.as-spd li{display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--line);min-width:0}.as-spd b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.as-spd small{color:var(--muted);font-size:12px}.as-spd span{font-size:13px;font-variant-numeric:tabular-nums}
.as-cues{display:grid;gap:0}.as-cue{display:flex;gap:8px;align-items:center}.as-cue select{flex:1;min-width:0}.as-cue .ibtn{flex:none}

.as-av{position:relative;width:30px;height:30px;border-radius:50%;flex:none;display:block;isolation:isolate;box-shadow:0 0 0 1px var(--line-2),0 6px 18px -6px var(--accent)}
/* the colours circle slowly round the orb; the shine stays put */
.as-av::before{content:'';position:absolute;inset:0;border-radius:50%;z-index:-1;background:conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));animation:asOrb 12s linear infinite}
.as-av::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7 0,transparent 42%);pointer-events:none}
@keyframes asOrb{to{transform:rotate(1turn)}}
.as-av i{position:absolute;inset:7px;border-radius:50%;background:var(--bg-2);opacity:.86;z-index:1;transition:transform .3s var(--spring)}
.as-btn .as-av{width:24px;height:24px}.as-btn .as-av i{inset:6px}
.asv .aov-s{height:min(70vh,640px)}
.as-tt{display:flex;flex-direction:column;min-width:0}.as-tt b{font:700 17px var(--f-body)}.as-tt small{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.asv.lis .aov-t .as-av,.asv.spk .aov-t .as-av{animation:asPulse 1.4s ease-in-out infinite}.asv.busy .aov-t .as-av{animation:asSpin 1.2s linear infinite}
.asv.lis .aov-t .as-av i{transform:scale(.55)}
@keyframes asPulse{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 22%,transparent),0 6px 18px -6px var(--accent)}}
@keyframes asSpin{to{transform:rotate(360deg)}}
.as-t{margin:4px 0 16px}
.as-go{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:4px 0 6px}
.as-qr{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin:0 0 10px}.as-qr .as-q{margin:0}.as-tx{flex:none;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--muted);opacity:.5;cursor:pointer;padding:0}.as-tx svg{width:15px;height:15px}.as-tx:hover,.as-tx:focus-visible{opacity:1;background:color-mix(in srgb,var(--text) 8%,transparent)}
.as-q{margin:0 0 10px auto;max-width:82%;width:fit-content;padding:10px 14px;border-radius:18px 18px 6px 18px;background:var(--surface-2);font-size:15px;line-height:1.4}
.as-a{display:flex;gap:10px;align-items:flex-start;min-width:0}.as-ab{flex:1;min-width:0;overflow-wrap:anywhere}.as-a p{margin:0 0 8px;font-size:16px;line-height:1.5}.as-a p:last-child{margin-bottom:0}
.as-ab ul{margin:4px 0 10px;padding-left:20px}.as-ab li{font-size:16px;line-height:1.5;margin:2px 0}.as-ab li::marker{color:var(--accent)}
.as-dot{width:10px;height:10px;margin-top:8px;border-radius:50%;flex:none;background:conic-gradient(var(--accent),var(--c-learning),var(--c-career),var(--accent))}
.as-a.wait p i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:var(--muted);animation:asDot 1s ease-in-out infinite}.as-a.wait p i:nth-child(2){animation-delay:.15s}.as-a.wait p i:nth-child(3){animation-delay:.3s}
@keyframes asDot{50%{opacity:.25;transform:translateY(-3px)}}
.as-ch{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;min-width:0}.as-ch .btn{white-space:normal;text-align:left;max-width:100%;height:auto;min-height:36px;padding:8px 14px;line-height:1.3;justify-content:flex-start}.as-ch .btn.ghost{border:1px solid var(--line-2,var(--line));background:var(--surface)}
.as-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:10px 0}.as-empty p{color:var(--muted);margin:14px 0 4px}.as-empty p b{color:var(--text)}
.as-big{width:92px;height:92px;border-radius:50%;border:0;cursor:pointer;position:relative;background:radial-gradient(circle at 35% 30%,#fff8 0,transparent 40%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 14px 40px -12px var(--accent);animation:breathe 4s ease-in-out infinite}
.as-big i{position:absolute;inset:22px;border-radius:50%;background:var(--bg-2);opacity:.85}
.as-sugs{display:grid;gap:8px;width:100%;margin-top:14px}
.as-sug{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:500 14px var(--f-body);cursor:pointer}
.as-row{display:flex;align-items:center;gap:8px}.as-row input,.as-row input:focus{flex:1;min-width:0;background:none!important;border:0!important;outline:none!important;box-shadow:none!important;color:var(--text);font:500 16px var(--f-body);padding:10px 4px}
.as-send{display:none;flex:none;width:44px;height:44px;border-radius:50%;border:0;place-items:center;background:var(--accent);color:var(--on-accent);cursor:pointer}.as-send svg{width:20px;height:20px}
.as-row.typed .as-send{display:grid}.as-row.typed .as-mic{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);width:40px;height:40px}
.as-mic{position:relative;flex:none;width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);cursor:pointer}
.as-mic svg{width:22px;height:22px}
.as-mic i{position:absolute;inset:0;border-radius:50%;pointer-events:none}
.as-mic.rec i{box-shadow:0 0 0 calc(3px + var(--lv,0) * 10px) color-mix(in srgb,var(--accent) 30%,transparent);transition:box-shadow .12s}
.asv.lis .as-row{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 45%,transparent)}
.as-stop{display:none;flex:none;height:34px;padding:0 14px;border-radius:17px;border:0;background:var(--accent);color:var(--on-accent);font:700 13px var(--f-body);cursor:pointer}
.asv.spk .as-stop,.asv.busy .as-stop,.asv.lis .as-stop{display:block}
.asv.min{visibility:hidden;transition:visibility 0s .36s}
.ai-mini{position:fixed;z-index:125;right:16px;bottom:calc(86px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:2px;max-width:min(300px,calc(100vw - 32px));padding:6px;border-radius:999px;background:var(--bg-2);border:1px solid var(--line-2);box-shadow:0 14px 36px -12px rgba(0,0,0,.45),0 0 0 1px color-mix(in srgb,var(--accent) 18%,transparent);opacity:0;transform:translateY(14px) scale(.94);transition:opacity .25s,transform .35s var(--spring,ease);pointer-events:none}
.ai-mini.on{opacity:1;transform:none;pointer-events:auto}
@media(min-width:821px){.ai-mini{bottom:24px;right:24px}}
.ai-mi{display:flex;align-items:center;gap:10px;min-width:0;border:0;background:none;color:var(--text);font:inherit;text-align:left;padding:0 4px 0 0;cursor:pointer}
.ai-mini .as-av{width:40px;height:40px}.ai-mini .as-av i{inset:9px}
.ai-mt{display:flex;flex-direction:column;min-width:0}.ai-mt b{font:700 14px var(--f-body)}.ai-mt small{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
.ai-mx{flex:none;width:32px;height:32px;border-radius:50%;border:0;background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--muted);display:grid;place-items:center;cursor:pointer}.ai-mx svg{width:14px;height:14px}
.ai-mini[data-st=lis] .as-av,.ai-mini[data-st=spk] .as-av{animation:asPulse 1.4s ease-in-out infinite}.ai-mini[data-st=busy] .as-av i{animation:asPulse 1.4s ease-in-out infinite}.ai-mini[data-st=lis] .as-av i{transform:scale(.55)}
@media(max-width:400px){.asv .aov-h{gap:4px;padding-left:14px;padding-right:10px}.asv .aov-h .ibtn.sm{width:33px;height:33px;border-radius:11px}.asv .aov-h .ibtn.sm svg{width:16px;height:16px}.asv .aov-t{gap:8px}}
.as-qs{display:flex;gap:6px;overflow-x:auto;padding:0 14px 10px 18px;scrollbar-width:none;flex:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}.as-qs::-webkit-scrollbar{display:none}
.as-qc{position:relative;flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;border:1px solid var(--line-2);background:var(--surface);color:var(--text);font:600 12.5px var(--f-body);cursor:pointer;white-space:nowrap;margin:0}
.as-qc:last-child{margin-right:28px}.as-qc svg{width:15px;height:15px;flex:none;color:var(--muted)}
.as-qc select{appearance:none;-webkit-appearance:none;background:none!important;border:0!important;padding:0!important;margin:0;color:inherit;font:inherit;height:auto;min-height:0;box-shadow:none!important;cursor:pointer;width:auto;outline:none}
.as-qc input{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;margin:0}
.as-qc.tg.on{border-color:color-mix(in srgb,var(--accent) 55%,transparent);background:color-mix(in srgb,var(--accent) 14%,var(--surface))}.as-qc.tg.on svg{color:var(--accent)}
.as-qc.warn{border-color:var(--accent);color:var(--accent)}.as-qc.warn svg{color:var(--accent)}
.as-qc:focus-within,.as-qc:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 60%,transparent);outline-offset:1px}
.as-acts{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.as-ac{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0;border-radius:15px;background:transparent;color:var(--muted);font:600 12.5px var(--f-body);cursor:pointer}.as-ac svg{width:14px;height:14px}.as-ac:hover,.as-ac:focus-visible{background:color-mix(in srgb,var(--text) 7%,transparent);color:var(--text)}
.as-pre{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:8px;width:100%;margin-top:18px;text-align:left}.as-pre-h{grid-column:1/-1;font:700 12px var(--f-body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.as-mc{width:100%;margin-top:14px;text-align:left}
.asv.full .aov-s{height:calc(100vh - var(--sat,0px) - 12px);max-height:none}
.as-a.live .as-dot{animation:asPulse 1.4s ease-in-out infinite}
.lv-btn svg{color:var(--accent)}
@media (prefers-reduced-motion:reduce){.as-big,.asv .as-av,.as-av::before,.ai-mini .as-av{animation:none!important}}`;
document.head.appendChild(css);
})();
