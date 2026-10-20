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
   for "hey <name>" while Plotline is open, or, if you turn it on, in the background with a "Listening"
   notification (Android only lets the system's own assistant listen for free, without one).
   The last exchange is sent to the "Plotline · Assistant" home-screen widget. */
(()=>{
'use strict';
const NA=window.PlotlineAssist||null;
const ADEF={name:'Plot',wake:false,bg:false,speak:'voice',btn:true};
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

Object.assign(IC,{orb:'<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2c1.2-2.6 2.3-2.6 3.5 0s2.3 2.6 3.5 0"/>',kb:'<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>'});

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
 return{say:`Okay, I'll remind you ${atTxt(w.date,w.time)}: ${quote(title)}.${NATIVE?'':' Keep Plotline open in this browser for the reminder to show.'}`,undo:()=>{S.days=S.days.filter(y=>y.id!==x.id);save();try{syncNative()}catch(e){}rerender()},chips:[['Open calendar','cal-'+w.date]]}}
function markDone(name){const h=pick(S.habits.filter(x=>!x.archived),name,x=>x.title);
 if(h){const d=today(),prev=hVal(h,d);hSetVal(h,d,hTarget(h));h.u=Date.now();save();try{checkMilestones()}catch(e){}rerender();return{say:`Nice. Marked ${quote(h.title)} done for today.`,undo:()=>{hSetVal(h,d,prev);save();rerender()},chips:[['Open habit','habit/'+h.id]]}}
 const x=pick(S.days.filter(y=>y.date===today()&&!y.done),name,y=>y.title);
 if(x){x.done=true;x.doneAt=Date.now();save();rerender();return{say:`Done: ${quote(x.title)}.`,undo:()=>{x.done=false;x.doneAt=null;save();rerender()},chips:[['Open today','today']]}}
 return{say:`I couldn't find a habit or goal for today called ${quote(name)}.`}}
const PAGES={today:'today',home:'today',goals:'goals',habits:'habits',journal:'journal',thread:'threads',threads:'threads',lists:'lists',calendar:'cal',settings:'settings',ask:'ask',insights:'ask',activity:'activity',timeline:'road',vista:'road',map:'map',agent:'agent'};

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
 /* reminders */
 if((m=/^(?:remind me|set (?:a |an |me a )?(?:reminder|alarm)|create (?:a )?reminder|add (?:a )?reminder|reminder|don'?t let me forget)\b\s*(.*)$/i.exec(t)))return{k:'remind',x:m[1]};
 /* agent tasks: "every morning summarise my emails", "each Friday look at my calendar and plan the weekend" */
 if(/\b(?:every|each)\s+(?:day|morning|afternoon|evening|night|weekday|week|hour|\d+\s+hours|other\s+day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i.test(t)&&/\b(?:summari[sz]e|check|look|review|brief|tell|go through|scan|watch|plan|suggest|find|read|see|give|send|catch me up|keep an eye)\b/i.test(t))return{k:'agent',x:t};
 if((m=/^(?:keep an eye on|watch|monitor)\s+(.+)$/i.exec(t)))return{k:'agent',x:t};
 /* done */
 if((m=/^(?:mark|log|check(?:\s+off)?|tick(?:\s+off)?)\s+(?:my\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)(?:\s+for\s+today)?$/i.exec(t))||(m=/^i\s+(?:just\s+)?(?:did|finished|completed|done)\s+(?:my\s+)?(.+?)(?:\s+today)?$/i.exec(t)))return{k:'done',x:m[1]};
 /* today's goals */
 if((m=/^(?:add|set|create)\s+(?:a\s+)?(?:goal|to-?do|task)\s+(?:for\s+today\s+)?(?:to\s+)?(.+?)(?:\s+for\s+today)?$/i.exec(t))&&!/\s(?:to|on|in)\s+(?:my\s+|the\s+)?\S+\s+list$/i.test(t))return{k:'today',x:m[1]};
 /* add X to Y */
 if((m=/^(?:add|put|throw|stick)\s+(.+)\s+(?:to|on|in|onto|into)\s+(?:my\s+|the\s+)?(.+?)$/i.exec(t)))return{k:'add',x:m[1],to:m[2]};
 return null}

window.PlotDo={addJournal,newThread,addToThread,addToday,addReminder,addTo,newList,parseWhen,pick,splitItems,body,aiReady:()=>aiReady()};
function exec(p,raw){const A=aset();switch(p.k){
 case'agent':return window.agentFromVoice?agentFromVoice(p.x):{say:'The agent isn’t available here.'};
 case'cancel':return{say:'Okay.'};
 case'live':setTimeout(()=>{if(window.liveOpen)liveOpen()},60);return{say:'Sure, let’s talk.',quiet:1};
 case'hello':return{say:`Hi! What can I do for you?`,listen:true};
 case'thanks':return{say:pickOne(['Anytime.','You got it.','Happy to help.'])};
 case'whoami':return{say:`I'm ${aname()}, your assistant in Plotline. You can rename me in Settings or by saying “call yourself” and a new name.`};
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
 case'remind':{const w=parseWhen(p.x),title=clean(w.rest.replace(/^(?:(?:me|to|that|about|for)\s+)+/i,''));
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
 const L=(S.settings&&S.settings.actLog)||{},keys=Object.keys(L);if(!keys.length)return{say:'I don’t have any activity from your phone yet. Turn on activity in Plotline’s settings and I can tell you your steps, sleep and screen time.',chips:[['Open activity','activity']]};
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
function asCtx(q,r,hint,big){const now=new Date(),tn=dnum(ymd()),lq=lcs(q),N=named(q),days=askDays(q);
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
 const budget=big?30000:5200;let used=head.length+q.length+40;const parts=[head];
 for(const s of sec){let block=`\n${s.title}\n`;for(const l of s.lines){if(used+block.length+l.length+1>budget)break;block+=l+'\n'}if(block.split('\n').length>3||s.lines.length&&block.length>s.title.length+3){used+=block.length;parts.push(block)}if(used>=budget)break}
 return parts.join('\n')+`\nQUESTION\n${q}`}
async function aiAnswer(q,onP,hint){if(!aiReady())return null;const e=planEngine(),loc=e!=='api'&&e!=='native',X=window.AIX,spoken=AS.spoken,pr=insSet().profile;
 const r=await ragRetrieve(q,{win:0,goal:'',broad:insFocus(q).broad},onP);const prompt=asCtx(q,r,hint,!loc&&e==='api');
 const sys=`You are ${aname()}, the assistant inside the Plotline app: a personal assistant that knows the user's own data and can talk about anything. Work out what they mean, even when it's phrased loosely or misheard by speech recognition. ${spoken?'Your answer is read aloud: one to three short, natural sentences. No lists, no markdown, no note numbers like [2].':'Answer clearly and briefly: a few sentences, or a few short bullets when that really helps. No note numbers like [2].'} When the question is about their life, use the data given (dates, activity numbers, plans, threads, lists and notes); if the app looked something up, use that answer, and if the data doesn't have it, say what you do know. For anything else (the world, ideas, advice, writing, feelings), just answer it well.${pr&&pr.text?'\n\nWHAT YOU KNOW ABOUT THEM\n'+pr.text:''}${X?'\n\n'+X.ACT_SYS+'\n\n'+X.safety():''}`;
 const hist=[];AS.turns.filter(t=>!t.wait&&t.a&&!t.sys).slice(-3).forEach(t=>hist.push({role:'user',content:t.q},{role:'assistant',content:t.a}));
 const msgs=[{role:'system',content:sys},...hist,{role:'user',content:prompt}];
 let out='';const on=x=>{out+=x;onP&&onP('')};const opts={max_tokens:spoken?260:(loc?450:700),reading:'Thinking…',temperature:.5};
 if(e==='api')await apiChat(msgs,on,AS.ctl.signal,opts);else if(e==='native')await natChat(msgs,on,onP,()=>{out=''},opts);else await localChat(msgs,on,onP,0,()=>{out=''},false,opts);
 out=out.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').replace(/\s*\[\d+(?:,\s*\d+)*\]/g,'');
 if(X){const P=X.parseActs(out);out=P.clean;AS.acts=X.keepActs(P.acts)}
 out=(spoken?out.replace(/[*#_`]/g,''):out.replace(/\*\*|__|`|^#+\s*/gm,'')).trim();
 if(X){const c=X.care(q,out);if(c)out+=' '+c}
 return out||null}
async function llmIntent(t){const e=typeof planEngine==='function'?planEngine():'',fast=e!=='api'&&isLrtM(llmOf(insSet().llm));if(e!=='api'&&e!=='native'&&!fast||!aiReady())return null;
 const schema={type:'object',properties:{action:{enum:['journal','new_thread','thread_update','reminder','new_list','list_add','today_goal','habit_done','agent_task','question']},text:{type:'string'},target:{type:'string'},when:{type:'string'}},required:['action','text'],additionalProperties:false};
 const msgs=[{role:'system',content:'You turn one spoken or typed request to a personal journal and habits app into JSON. Requests can be phrased any way, misspelled ("jounel", "liost", "thred") or misheard ("general entry" means journal entry). Reply with JSON only. The text field holds only what should be saved: never the command words ("make a journal entry", "add to my list", "that says"), never the target name.'},{role:'user',content:`Request: "${t}"\n\nactions: journal (save text to today's journal), new_thread (start a thread; text is its title), thread_update (target is the thread name; text is the update), reminder (when is the time words like "tomorrow at 5pm"), new_list (text is the list name; target is its items separated by commas, or empty), list_add (target is the list name; text is the items), today_goal, habit_done (text is the habit), agent_task (something to do on a schedule or keep an eye on, like "every morning summarise my emails"; text is the task), question (anything asked).`}];
 let out='';try{if(e==='api')await apiChat(msgs,x=>{out+=x},AS.ctl.signal,{schema,max_tokens:160,temperature:0});else if(e==='wasm')await localChat(msgs,x=>{out+=x},null,0,null,false,{schema,max_tokens:160,temperature:0});else await natChat(msgs,x=>{out+=x},null,null,{schema,max_tokens:160,temperature:0});const j=JSON.parse(out.slice(out.indexOf('{'),out.lastIndexOf('}')+1));
  const x=String(j.text||''),tg=String(j.target||''),w=String(j.when||'');
  return{journal:{k:'journal',x:body(x)},new_thread:{k:'thrnew',title:x},thread_update:{k:'add',x,to:tg+' thread'},reminder:{k:'remind',x:x+(w?' '+w:'')},list_add:{k:'add',x,to:tg+' list'},new_list:{k:'listnew',title:x,items:tg?splitItems(tg):[]},today_goal:{k:'today',x},habit_done:{k:'done',x},agent_task:{k:'agent',x}}[j.action]||null}catch(err){return null}}

/* ---------------- one request, start to finish ---------------- */
const QRX=/^(?:who|what|when|where|why|how|which|is|are|was|were|do|does|did|have|has|had|can i|should i|tell me|show me|list|summari[sz]e|give me)\b/i;
async function run(raw,o={}){const text=String(raw||'').trim().replace(new RegExp('^(?:(?:hey|hi|ok(?:ay)?)\\s+)?'+aname().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[,.!]?\\s*','i'),'');
 if(!text){listen();return}
 if(AS.busy){toast('Still working on the last one');return}
 if(AS.turns.length&&AS.last&&Date.now()-AS.last>CV_GAP)convFresh('chat');
 asOpen();wakePause(true);$('#asIn')?.setAttribute('placeholder','Ask or tell me something…');const turn={q:text,a:'',chips:[],t:Date.now(),id:uid(),wait:true};AS.turns.push(turn);AS.turns=AS.turns.slice(-30);AS.spoken=!!o.spoken;AS.busy=true;AS.ctl=new AbortController();paint(true);
 let r=null;AS.acts=null;
 try{const aw=AS.await;AS.await=null;const blk=window.AIX&&AIX.block(text);if(blk)r={say:blk};
  if(aw)r=answerAwait(aw,text);
  if(!r){const p=parse(text);if(p)r=exec(p,text)}
  if(!r&&!aiReady())r=localAsk(text);
  if(!r&&aiReady()){const st=strip(text),cmd=!QRX.test(st)||/^(?:can|could|would|will) you\b|\b(?:please|i want to|i need to|i'd like to)\b/i.test(st);
   if(cmd&&!/^(?:can|could|would|will) you (?:tell|show|explain|remind me (?:what|when|how))/i.test(st)){status('Working it out…');const p=await llmIntent(st);if(p&&p.k)r=exec(p,text)}
   if(!r){const L=localAsk(text);if(L&&(L.ask||L.await))r=L;
    else{status('Thinking…');const a=await aiAnswer(text,status,L&&!L.miss?L.say:'').catch(e=>{if(e&&e.name==='AbortError')throw e;return null});
     r=a?{say:a,chips:L&&L.chips||[['Ask more','?'+text]]}:L&&!L.miss?L:{say:'Sorry, I couldn’t answer that right now.',chips:[['Open in Ask','?'+text]]}}}}
  if(r&&r.ask){const q=r.ask;status('Thinking…');const a=await aiAnswer(q,status).catch(e=>{if(e&&e.name==='AbortError')throw e;return null});r=a?{say:a}:{say:aiReady()?'Sorry, I couldn’t answer that right now.':'To ask about things, open Ask once to set up the AI.',chips:[['Open in Ask','?'+q]]}}
  if(r&&r.miss){const miss=r.miss;r=null;status('Thinking…');const a=await aiAnswer(text,status).catch(()=>null);r=a?{say:a}:{say:`I couldn't find anything about ${quote(miss)} in your journal, threads, lists or habits.`}}
  if(!r&&!QRX.test(strip(text))&&/^(?:add|put|write|log|create|start|make|set|remind|schedule|note|save|mark|record|jot|track|new)\b/i.test(strip(text))){status('Working it out…');const p=await llmIntent(strip(text));if(p&&p.k)r=exec(p,text)}
  if(!r){status('Thinking…');const a=await aiAnswer(text,status).catch(e=>{if(e&&e.name==='AbortError')throw e;return null});
   r=a?{say:a,chips:[['Ask more','?'+text]]}:{say:aiReady()?'Sorry, I couldn’t answer that right now.':'I can add things and look up when you last did something. For other questions, open this in Ask once to set up the AI, and after that I’ll answer from your notes too.',chips:[['Open in Ask','?'+text]]}}}
 catch(e){r={say:e&&e.name==='AbortError'?'Stopped.':'Something went wrong: '+(e&&e.message||e)}}
 status('');turn.wait=false;turn.a=r.say||'';turn.chips=(r.chips||[]).map(c=>({t:c[0],r:c[1],fn:c[2]}));if(r.undo){AS.undo[turn.id]=r.undo;turn.chips.unshift({t:'Undo',undo:1})}
 if(AS.acts&&AS.acts.length&&window.AIX){const A=AS.acts;AS.acts=null;turn.chips.unshift(...A.map(a=>{const c={t:'+ '+AIX.actLabel(a),act:1};c.fn=()=>{let x;try{x=AIX.doAct(a)}catch(e){return toast('Couldn’t add that')}c.t='✓ '+AIX.actLabel(a);c.fn=()=>x&&x.go&&(asClose(),setTimeout(()=>go(x.go),380));paint();toast(esc((x&&x.say)||'Added'))};return c}))}
 AS.await=r.await||null;AS.busy=false;AS.ctl=null;paint(true);pushWidget2();
 const talk=!r.quiet&&(aset().speak==='always'||aset().speak==='voice'&&AS.spoken);AS.after=(r.listen||AS.await)&&AS.spoken?'listen':null;
 if(talk&&turn.a)speak(turn.a);else afterSpeak()}

/* ---------------- speaking ---------------- */
let SPK=null,SPK_CB=null;
/* the voice, speed and pitch picked in Settings › Voice; done (optional) runs instead of the assistant's own follow-up */
function speak(text,done,ov){const t=String(text).replace(/[“”]/g,'"').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu,'').replace(/[*#_`]/g,'').trim();SPK_CB=done||null;if(!t)return spoke();const id='s'+uid();SPK=id;paintHead();
 const A={...aset(),...(ov||{})},rate=+A.rate||1,pitch=+A.pitch||1,voice=A.voice||'';
 if(NA&&NA.speak2){try{NA.speak2(id,t,vset().lang||'',rate,pitch,voice);return}catch(e){}}
 if(NA&&NA.speak){try{NA.speak(id,t,vset().lang||'',rate);return}catch(e){}}
 if(window.speechSynthesis){try{const u=new SpeechSynthesisUtterance(t);if(vset().lang)u.lang=vset().lang;const v=voice&&speechSynthesis.getVoices().find(x=>x.name===voice);if(v){u.voice=v;u.lang=v.lang}u.rate=rate;u.pitch=pitch;u.onend=u.onerror=()=>{if(SPK===id){SPK=null;spoke()}};speechSynthesis.cancel();speechSynthesis.speak(u);return}catch(e){}}
 SPK=null;spoke()}
function spoke(){const f=SPK_CB;SPK_CB=null;if(f){paintHead();f();return}afterSpeak()}
function hush(){SPK=null;SPK_CB=null;try{if(NA&&NA.stopSpeaking)NA.stopSpeaking();else if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}paintHead()}
function afterSpeak(){paintHead();const a=AS.after;AS.after=null;if(a==='listen'&&AS.open)setTimeout(()=>listen(),250);else{wakePause(false);handsOff()}}
/* woken by "Hey Plot" while Plotline was closed or the phone locked: once the answer is spoken and nothing follows, step aside again */
function handsOff(){if(!AS.bg||!NA||!NA.background)return;clearTimeout(AS.bgT);AS.bgT=setTimeout(()=>{if(!AS.bg||AS.busy||AS.listening||AS.await||SPK)return;AS.bg=false;asClose();try{NA.background()}catch(e){}},2500)}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(AS.bg){AS.bg=false;clearTimeout(AS.bgT)}},true));

/* ---------------- listening (the same mic as the rest of the app) ---------------- */
function listen(pre){asOpen();const el=$('#asIn'),b=$('#asv .as-mic');if(!el||!b)return;if(typeof voiceAvail==='function'&&!voiceAvail()){toast('Voice isn’t available here. Type instead.');el.focus();return}hush();wakePause(true);el.value=typeof pre==='string'?pre:'';AS.listening=true;paintHead();voiceStart(el,b)}
{const _vs=voiceStart;voiceStart=function(el,btn){wakePause(true);return _vs(el,btn)}}
{const _vx=voiceStop;voiceStop=function(silent,keep){const c=VC;_vx(silent,keep);if(!c)return;if(c.el&&c.el.id==='asIn'){AS.listening=false;paintHead();const v=c.el.value.trim();if(keep&&v){c.el.value='';run(v,{spoken:true})}else wakePause(false)}else wakePause(false)}}

/* ---------------- wake word (Android) ---------------- */
function wakePause(p){if(!NA||!NA.wakePause)return;try{NA.wakePause(!!p)}catch(e){}}
function wakeSync(){if(!NA||!NA.wake)return;const a=aset(),v=vset();try{NA.wake(JSON.stringify({on:!!(a.wake||a.bg),bg:!!a.bg,name:aname(),lang:v.lang||'',cloud:!!v.cloud,quiet:a.quiet!==false,cues:a.cues!==false,cueStart:cueOf('start'),cueDone:cueOf('done')}))}catch(e){}}
window.__assist=(k,a,b)=>{
 if(k==='tts'){if(a===SPK&&(b==='done'||b==='err')){SPK=null;spoke()}return}
 if(k==='voices'){window.dispatchEvent(new Event('plot-voices'));return}
 /* "Hey Plot" on its own: the page's own mic takes over, with room to pause and think (the wake loop would stop at the first pause) */
 if(k==='wake'){if(window.liveOpen&&document.getElementById('live'))return;asOpen();vib();AS.nlis=false;listen();return}
 if(k==='partial'){const i=$('#asIn');if(AS.nlis&&i)i.value=a;return}
 /* "Hey Plot, …" in one breath: a clear command runs now; anything else keeps listening in case there's more to say */
 if(k==='cmd'){if(VC&&VC.el&&(VC.el.id==='asIn'||VC.el.id==='lvIn'))return;if(AS.nlis){AS.listening=AS.nlis=false;const i=$('#asIn');if(i)i.value=''}const tx=String(a||'').trim();if(!tx||parse(tx)||AS.busy){run(tx,{spoken:true});return}asOpen();listen(tx);return}
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
const cueOf=k=>{const a=aset(),id=k==='start'?(a.cueStart||'rise'):(a.cueDone||'fall');return CUES[id]?id:k==='start'?'rise':'fall'};
let ACX=null;
function cuePlay(id){const q=CUES[id];if(!q||!q.f.length)return;try{ACX=ACX||new(window.AudioContext||window.webkitAudioContext)();const c=ACX;if(c.state==='suspended')c.resume();const t0=c.currentTime+.02,g=c.createGain();g.connect(c.destination);g.gain.value=1;
 q.f.forEach(([f,d])=>{[1,q.h].forEach((h,j)=>{const o=c.createOscillator(),e=c.createGain();o.type=j?'triangle':'sine';o.frequency.value=f*h;o.connect(e);e.connect(g);const a=t0+d,v=j?q.hv:.75,dd=j?q.d*.6:q.d;e.gain.setValueAtTime(0,a);e.gain.linearRampToValueAtTime(v,a+.008);e.gain.exponentialRampToValueAtTime(.001,a+dd);o.start(a);o.stop(a+dd+.04)})})}catch(e){}}
window.asCue=k=>{if(aset().cues===false)return;cuePlay(cueOf(k));try{navigator.vibrate&&navigator.vibrate(k==='start'?[18]:[10,60,10])}catch(e){}};

/* ---------------- the sheet ---------------- */
function headSub(){if(AS.busy)return AS.prog||'Thinking…';if(AS.listening)return'Listening…';if(SPK)return'Speaking…';const a=aset();if(NA&&(a.wake||a.bg)){const w=AS.wst||'';return w==='err'?'Can’t hear the wake word right now':w==='perm'?'Allow the microphone for the wake word':w==='unavailable'?'The wake word needs online speech allowed':`Say “${wakeWord()}” anytime`}return'Talk or type'}
function asOpen(){AS.open=true;let el=$('#asv');if(!el){el=document.createElement('div');el.id='asv';el.className='aov asv';
 el.innerHTML=`<div class="aov-dim" data-act="asClose"></div><section class="aov-s" role="dialog" aria-modal="true" aria-label="Assistant"><div class="aov-h"><span class="aov-grab" aria-hidden="true"></span><div class="aov-t"><span class="as-av" aria-hidden="true"><i></i></span><span class="as-tt"><b class="as-nm"></b><small class="as-st"></small></span></div><button class="as-stop" data-act="asStop" aria-label="Stop talking">■ Stop</button><button class="ibtn sm" data-act="liveOpen" aria-label="Talk out loud" title="Talk out loud">${ic('live')}</button><button class="ibtn sm" data-act="convGo" aria-label="Conversation history" title="History">${ic('hist')}</button><button class="ibtn sm" data-act="asClear" aria-label="New conversation" title="New conversation">${ic('plus')}</button><button class="ibtn sm" data-act="asClose" aria-label="Close" title="Close">✕</button></div><div class="aov-b as-b"></div><div class="ask-comp aov-comp"><form class="ask-row as-row" data-form="asSend" autocomplete="off"><input id="asIn" maxlength="500" placeholder="Ask or tell me something…" aria-label="Message" enterkeyhint="send"><button type="button" class="as-mic" data-act="asMic" aria-label="Talk">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'}<i></i></button></form>${window.AIX?AIX.note('as-note'):''}</div></section>`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'))}
 document.documentElement.classList.add('aov-on');paint(true);return el}
function asClose(){AS.open=false;if(VC&&VC.el&&VC.el.id==='asIn')voiceStop(true);hush();const el=$('#asv');document.documentElement.classList.remove('aov-on');if(!el)return;el.classList.remove('on');setTimeout(()=>{if(!AS.open)el.remove()},360);wakePause(false)}
function paintHead(){const el=$('#asv');if(!el)return;el.querySelector('.as-nm').textContent=aname();el.querySelector('.as-st').textContent=headSub();el.classList.toggle('lis',AS.listening);el.classList.toggle('spk',!!SPK);el.classList.toggle('busy',AS.busy)}
function status(t){AS.prog=t||'';paintHead()}
function chipHTML(t,c,i){return c.undo?`<button class="btn sm ghost" data-act="asUndo" data-id="${t.id}">Undo</button>`:`<button class="btn sm ghost" data-act="asChip" data-id="${t.id}" data-i="${i}">${esc(c.t)}</button>`}
function paint(scroll){const el=$('#asv');if(!el)return;paintHead();const b=el.querySelector('.as-b');
 b.innerHTML=AS.turns.length?AS.turns.map(t=>`<div class="as-t"><p class="as-q">${esc(t.q)}</p><div class="as-a${t.wait?' wait':''}"><span class="as-dot" aria-hidden="true"></span><div><p>${t.wait?'<i></i><i></i><i></i>':esc(t.a).replace(/\n+/g,'<br>')}</p>${t.chips&&t.chips.length?`<div class="as-ch">${t.chips.map((c,i)=>chipHTML(t,c,i)).join('')}</div>`:''}</div></div></div>`).join(''):
 `<div class="as-empty"><button class="as-big" data-act="asMic" aria-label="Talk"><i></i></button><p><b>Hi, I’m ${esc(aname())}.</b> Tap and talk${NA&&(aset().wake||aset().bg)?`, or say “${esc(wakeWord())}”`:''}. Ask me anything.</p><button class="btn sm pri" data-act="liveOpen" style="margin:4px 0 6px">${ic('live')}Start a conversation</button>${NA&&!aset().wake&&!aset().bg?`<button class="btn sm" data-act="asWakeOn" style="margin:4px 0 6px">Turn on “${esc(wakeWord())}”</button>`:''}<div class="as-sugs">${['Add “had a great workout” to my journal','When did I last change my oil?','Remind me to call mom at 6pm','What do I have today?'].map(s=>`<button class="as-sug" data-act="asTry" data-q="${esc(s.replace(/[“”]/g,''))}">${esc(s)}</button>`).join('')}</div></div>`;
 if(scroll)b.scrollTop=b.scrollHeight;convSync()}
Object.assign(ACT,{
 asOpen:()=>{asOpen();setTimeout(()=>{if(!AS.turns.length&&NA&&typeof voiceAvail==='function'&&voiceAvail())listen();else $('#asIn')?.focus()},300)},
 asClose:()=>asClose(),
 asMic:()=>{if(VC&&VC.el&&VC.el.id==='asIn'){voiceStop(false,true);return}if(AS.busy){AS.ctl&&AS.ctl.abort();return}AS.nlis=false;listen()},
 asStop:()=>{AS.after=null;if(AS.busy&&AS.ctl)AS.ctl.abort();if(VC&&VC.el&&VC.el.id==='asIn')voiceStop(true);AS.listening=AS.nlis=false;hush();wakePause(false)},
 asTry:d=>run(d.q),
 asClear:()=>{convFresh('chat');hush();paint();pushWidget2()},
 asUndo:d=>{const f=AS.undo[d.id];if(!f)return;delete AS.undo[d.id];try{f()}catch(e){}const t=AS.turns.find(x=>x.id===d.id);if(t){t.chips=t.chips.filter(c=>!c.undo);t.a+=' (undone)'}paint();pushWidget2();toast('Undone')},
 asChip:d=>{const t=AS.turns.find(x=>x.id===d.id),c=t&&t.chips[+d.i];if(!c)return;if(c.fn)return c.fn();const r=c.r||'';if(r[0]==='?'){asClose();askWith(r.slice(1));return}asClose();setTimeout(()=>window.__route(r.replace(/^~/,'')),380)}});
Object.assign(FORM,{asSend:f=>{const i=f.querySelector('input'),v=i.value.trim();if(!v)return listen();i.value='';run(v,{spoken:false})}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AS.open&&!$('#sheet').classList.contains('on'))asClose()});
window.addEventListener('hashchange',()=>{if(AS.open)asClose()});
{const _b=window.__back;window.__back=()=>{if(AS.open){asClose();return true}return _b?_b():false}}

/* routes from the widget, the app shortcut and the wake word: assistant, assistant-listen, assistant-type; the wake word heard in the background adds -bg */
{const _r=window.__route;window.__route=r=>{if(/^assistant/.test(r||'')){if(/-bg$/.test(r))AS.bg=true;asOpen();const k=r.split('-')[1];setTimeout(()=>{if(k==='share'){if(shareIn())return;}takePending();if(k==='listen')listen();else if(k==='type')$('#asIn')?.focus()},450);return}return _r&&_r(r)}}

/* the orb in every page's top bar */
{const _g=gear;gear=function(){return(aset().btn?`<button class="ibtn as-btn" data-act="asOpen" aria-label="Talk to ${esc(aname())}" title="Talk to ${esc(aname())}"><span class="as-av"><i></i></span></button>`:'')+_g()}}

/* the home-screen widget gets the last exchange */
function pushWidget2(){if(!NA||!NA.widget)return;const L=AS.turns.filter(t=>!t.wait).slice(-2).map(t=>({q:t.q,a:t.a,t:t.t}));try{NA.widget(JSON.stringify({name:aname(),wake:NA&&(aset().wake||aset().bg)?wakeWord():'',turns:L}))}catch(e){}}

/* ---------------- settings: AI & voice ---------------- */
function assistHTML(){const a=aset(),st=nst(),v=vset();
 const row=(k,t,sub,on,dis)=>`<label class="sw"><span>${t}<small>${sub}</small></span><input type="checkbox" data-assist="${k}" ${on?'checked':''} ${dis?'disabled':''}><i></i></label>`;
 return`<section class="panel rv" id="assistPanel"><h3>Hey ${esc(aname())}</h3><p class="small muted">Your voice assistant. Ask it to add to today’s journal, start or update a thread, set a reminder, add to a list or mark a habit done, or ask things like “when did I last change my oil?”.</p>
 <div class="field"><label>Assistant’s name</label><input data-assist="name" maxlength="24" value="${esc(aname())}" placeholder="Plot"><small class="muted">You’ll say “Hey ${esc(aname())}”.</small></div>
 ${NA?row('wake',`Listen for “${esc(wakeWord())}” while Plotline is open`,'The phone’s speech recognizer listens in short rounds while the app is on screen',a.wake)+
 row('bg','Keep listening in the background',`Hands-free, even with the phone locked: say it and it answers out loud. Android needs a small silent notification while it listens, and it uses more battery.${st.onDevice===false&&!v.cloud?' This phone has no on-device speech, so it needs online speech allowed.':''}`,a.bg)+
 row('cues','Listening sounds','A clear chime when I start listening and another when I stop',a.cues!==false)+
 row('quiet','Quiet listening','Mutes the speech recognizer’s start and stop beeps (and other notification sounds for that moment) so it doesn’t chime while it listens',a.quiet!==false)+
 (a.bg&&st.overlay===false?`<div class="rm-snz mute" style="margin-top:10px">${ic('bell')}<div><b>Let ${esc(aname())} pop up</b><small>So “${esc(wakeWord())}” can open Plotline over other apps. Without it you’ll get a notification to tap instead.</small></div><button class="btn sm" data-act="asOverlay">Allow</button></div>`:''):`<p class="small muted">The “${esc(wakeWord())}” wake word works in the Android app. Here, tap the orb at the top to talk.</p>`}
${a.cues!==false?`<div class="as-cues">${[['cueStart','When I start listening','start'],['cueDone','When I stop listening','done']].map(([k,l,w])=>`<div class="field"><label>${l}</label><div class="as-cue"><select data-assist="${k}">${Object.entries(CUES).map(([id,q])=>`<option value="${id}" ${cueOf(w)===id?'selected':''}>${q.n}</option>`).join('')}</select><button class="ibtn" data-act="asCueTry" data-w="${w}" aria-label="Play this sound">${ic('play')}</button></div></div>`).join('')}</div>`:''}
 <div class="field"><label>Read replies out loud</label><select data-assist="speak">${[['voice','When I talk to it'],['always','Always'],['never','Never']].map(([k,n])=>`<option value="${k}" ${a.speak===k?'selected':''}>${n}</option>`).join('')}</select></div>
 ${NA&&NA.openAssistSettings?`<div class="rm-snz mute" style="margin-top:10px">${ic('bell')}<div><b>${st.assistRole?`${esc(aname())} is your phone’s assistant`:`Use ${esc(aname())} as your phone’s assistant`}</b><small>${st.assistRole?'Press and hold the side button to talk to it from anywhere.':'Pick Plotline as the digital assistant app, then press and hold the side button to talk from anywhere. On Samsung: Settings › Advanced features › Side button › Press and hold › Digital assistant. This replaces Gemini on that button.'} You can also share text from any app to Plotline, or select text and tap Send to Plotline.</small></div><button class="btn sm" data-act="asRole">${st.assistRole?'Change':'Set up'}</button></div>`:''}
 ${row('btn','Assistant button in the top bar','The orb next to search and settings',a.btn)}
 <div class="actions left"><button class="btn sm pri" data-act="asOpen">Try it</button></div></section>`}
{const _vh=voiceHTML;voiceHTML=function(){return _vh()+assistHTML()}}
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.assist)return;const k=t.dataset.assist;let v=t.type==='checkbox'?t.checked:t.value;
 if(k==='name'){v=String(v).replace(/[^\p{L}\p{N} '\-]/gu,'').trim().slice(0,24)||'Plot';v=cap(v)}
 if((k==='wake'||k==='bg')&&v){const st=typeof vstate==='function'?vstate():{};if(!st.onDevice&&!vset().cloud){const ok=await voiceConsent();if(!ok){t.checked=false;return}}if(!(await permAsk('mic','android.permission.RECORD_AUDIO'))){t.checked=false;return toast('Allow the microphone to use the wake word')}if(k==='bg')askNotif()}
 S.settings.assist={...aset(),[k]:v};save();wakeSync();render(false);if(k==='cueStart'||k==='cueDone')cuePlay(v);if((k==='wake'||k==='bg')&&v)toast(`Say “${wakeWord()}” to try it`)});
Object.assign(ACT,{asCueTry:d=>cuePlay(cueOf(d.w)),asWakeOn:async()=>{const st=typeof vstate==='function'?vstate():{};if(!st.onDevice&&!vset().cloud&&!(await voiceConsent()))return;if(!(await permAsk('mic','android.permission.RECORD_AUDIO')))return toast('Allow the microphone to use the wake word');S.settings.assist={...aset(),wake:true};save();wakeSync();paint();toast(`Say “${wakeWord()}” while Plotline is open`)},asOverlay:()=>{try{NA.openOverlaySettings()}catch(e){}},asRole:()=>{try{NA.openAssistSettings()}catch(e){}}});

/* ---------------- start ---------------- */
function rerender(){try{render(false)}catch(e){}}
function bgCheck(){if(nst().bgOff&&aset().bg){S.settings.assist={...aset(),bg:false};save();rerender()}}
setTimeout(()=>{bgCheck();wakeSync();pushWidget2();takePending()},1200);
window.addEventListener('app-resume',()=>{setTimeout(()=>{bgCheck();wakeSync();takePending()},300)});
window.PLOT_ASSIST={run,asCtx,parse,parseWhen,localAsk,aname,ctx:asCtx,
 /* for the live conversation (ai.js) */
 command:t=>{const p=parse(t);if(!p||['hello','thanks','cancel','help','whoami','live'].includes(p.k))return null;if(p.k==='done'){const r=exec(p,t);return r&&r.undo?r:null}const r=exec(p,t);return r&&!r.await?r:null},
 lookup:t=>localAsk(t),say:(t,done,ov)=>speak(t,done||(()=>{}),ov),hush:()=>hush(),close:()=>{if(AS.open)asClose()},
 addTurn:(q,a)=>{AS.turns.push({q,a,chips:[],t:Date.now(),id:uid(),live:1});AS.turns=AS.turns.slice(-30);convSync();pushWidget2()},
 /* conversations: talk mode joins the one on screen if it was just used, else starts its own; resume loads a saved one */
 begin:kind=>{if(!(AS.turns.length&&AS.last&&Date.now()-AS.last<CV_GAP/2))convFresh(kind);return AS.turns.filter(t=>!t.wait&&t.a).map(t=>({q:t.q,a:t.a}))},
 resume:id=>{const c=window.CONV&&CONV.get(id);if(!c)return false;hush();AS.turns=c.turns.map(t=>({q:t.q,a:t.a,chips:[],t:t.t,id:t.id})).slice(-30);AS.cid=c.id;AS.kind=c.k==='ask'?'chat':c.k;AS.await=null;AS.undo={};AS.last=Date.now();if(AS.open)paint(true);return true},
 current:()=>AS.cid};

const css=document.createElement('style');css.textContent=`
.as-cues{display:grid;gap:0}.as-cue{display:flex;gap:8px;align-items:center}.as-cue select{flex:1;min-width:0}.as-cue .ibtn{flex:none}

.as-av{position:relative;width:30px;height:30px;border-radius:50%;flex:none;display:block;background:radial-gradient(circle at 35% 30%,#fff7 0,transparent 42%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 0 0 1px var(--line-2),0 6px 18px -6px var(--accent)}
.as-av i{position:absolute;inset:7px;border-radius:50%;background:var(--bg-2);opacity:.86;transition:transform .3s var(--spring)}
.as-btn .as-av{width:24px;height:24px}.as-btn .as-av i{inset:6px}
.asv .aov-s{height:min(70vh,640px)}
.as-tt{display:flex;flex-direction:column;min-width:0}.as-tt b{font:700 17px var(--f-body)}.as-tt small{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.asv.lis .aov-t .as-av,.asv.spk .aov-t .as-av{animation:asPulse 1.4s ease-in-out infinite}.asv.busy .aov-t .as-av{animation:asSpin 1.2s linear infinite}
.asv.lis .aov-t .as-av i{transform:scale(.55)}
@keyframes asPulse{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 22%,transparent),0 6px 18px -6px var(--accent)}}
@keyframes asSpin{to{transform:rotate(360deg)}}
.as-t{margin:4px 0 16px}
.as-q{margin:0 0 10px auto;max-width:82%;width:fit-content;padding:10px 14px;border-radius:18px 18px 6px 18px;background:var(--surface-2);font-size:15px;line-height:1.4}
.as-a{display:flex;gap:10px;align-items:flex-start}.as-a p{margin:0;font-size:16px;line-height:1.5}
.as-dot{width:10px;height:10px;margin-top:8px;border-radius:50%;flex:none;background:conic-gradient(var(--accent),var(--c-learning),var(--c-career),var(--accent))}
.as-a.wait p i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:var(--muted);animation:asDot 1s ease-in-out infinite}.as-a.wait p i:nth-child(2){animation-delay:.15s}.as-a.wait p i:nth-child(3){animation-delay:.3s}
@keyframes asDot{50%{opacity:.25;transform:translateY(-3px)}}
.as-ch{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.as-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:10px 0}.as-empty p{color:var(--muted);margin:14px 0 4px}.as-empty p b{color:var(--text)}
.as-big{width:92px;height:92px;border-radius:50%;border:0;cursor:pointer;position:relative;background:radial-gradient(circle at 35% 30%,#fff8 0,transparent 40%),conic-gradient(from 200deg,var(--accent),var(--c-learning),var(--c-career),var(--c-health),var(--accent));box-shadow:0 14px 40px -12px var(--accent);animation:breathe 4s ease-in-out infinite}
.as-big i{position:absolute;inset:22px;border-radius:50%;background:var(--bg-2);opacity:.85}
.as-sugs{display:grid;gap:8px;width:100%;margin-top:14px}
.as-sug{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:500 14px var(--f-body);cursor:pointer}
.as-row{display:flex;align-items:center;gap:8px}.as-row input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--text);font:500 16px var(--f-body);padding:10px 4px}
.as-mic{position:relative;flex:none;width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);cursor:pointer}
.as-mic svg{width:22px;height:22px}
.as-mic i{position:absolute;inset:0;border-radius:50%;pointer-events:none}
.as-mic.rec i{box-shadow:0 0 0 calc(3px + var(--lv,0) * 10px) color-mix(in srgb,var(--accent) 30%,transparent);transition:box-shadow .12s}
.asv.lis .as-row{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 45%,transparent)}
.as-stop{display:none;flex:none;height:34px;padding:0 14px;border-radius:17px;border:0;background:var(--accent);color:var(--on-accent);font:700 13px var(--f-body);cursor:pointer}
.asv.spk .as-stop,.asv.busy .as-stop,.asv.lis .as-stop{display:block}
@media (prefers-reduced-motion:reduce){.as-big,.asv .as-av{animation:none!important}}`;
document.head.appendChild(css);
})();
