/* Plotlines: what's scheduled, and charts of your own data.
   - Reminders the assistant, Live and Ask make from plain words. The AI fills in the timing ("tomorrow, every 2 hours,
     drink water" → date, first time, every 120 min, until 21:00) and SCHED.make turns it into reminders, timers, goal
     check-ins or a habit with a reminder. A repeating reminder is a day goal with rep {m: minutes apart, to: last time,
     n: how many}; schedAlarms() gives each repeat to Android's alarm clock (syncNative) and schedTick() shows them here
     on the web while the app is open.
   - Home: a Scheduled card (every reminder, check-in, timer and agent task coming up) and a Trends card. */
(()=>{
const pad=n=>String(n).padStart(2,'0');
const hm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const okT=s=>/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s||'').trim());
const normT=s=>{s=String(s||'').trim();if(!okT(s))return'';const[h,m]=s.split(':');return pad(+h)+':'+m};
const okD=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!isNaN(new Date(s+'T12:00'));
const atOf=(date,time)=>{const[y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);return new Date(y,m-1,d,hh,mm).getTime()};
const cap=s=>{s=String(s||'').replace(/^[\s,:;-]+|[\s,.!?]+$/g,'').trim();return s.charAt(0).toUpperCase()+s.slice(1)};
const every=m=>m%60===0?(m===60?'hour':m/60+' hours'):m===30?'half hour':m===1?'minute':m+' minutes';
const everyS=m=>m%60===0?m/60+' h':m+' min';
const sync=()=>{try{syncNative()}catch(e){}};
const redraw=()=>{try{render(false)}catch(e){}};

/* the times a repeating reminder goes off on its day */
function occ(x){if(!x.rep||!okD(x.date)||!okT(x.time))return[];const m=Math.max(1,+x.rep.m||60),st=atOf(x.date,x.time);let end=atOf(x.date,okT(x.rep.to)?x.rep.to:'21:00');if(end<st)end+=864e5;
 const L=[];for(let t=st;t<=end&&L.length<1440;t+=m*6e4)L.push(t);if(+x.rep.n>0)L.length=Math.min(L.length,+x.rep.n);return L}
const oneAt=x=>+x.at>0?+x.at:null;

/* repeats (and timers) for the phone's alarm list; plain day reminders stay with syncNative's own loop. The phone gets only
   the next time of each repeat, with rpm (ms apart) and end: RepAlarm.java arms the one after when it rings, so a reminder
   every 2 minutes takes one of Android's 60 alarm slots, not hundreds. all: every time, for the Scheduled card. */
window.schedAlarms=(now,L,all)=>{S.days.forEach(x=>{if(x.done)return;
 if(x.rep){const O=occ(x),i=O.findIndex(t=>t>now);if(i<0)return;const m=+x.rep.m,last=O[O.length-1];
  if(all)O.slice(i).forEach(t=>L.push({at:t,title:x.title,body:'',k:'rem',id:x.id,d:x.date}));
  else L.push({at:O[i],title:x.title,body:`Every ${every(m)} until ${new Date(last).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`,k:'rem',id:x.id,d:x.date,rpm:m*6e4,end:last})}
 else{const t=oneAt(x);if(t&&t>now)L.push({at:t,title:x.title,body:x.tmr?`Your ${x.tmr} min timer is done`:'Reminder',k:'rem',id:x.id,d:x.date,rp:!x.tmr})}})};
const own=x=>!!(x.rep||oneAt(x));
/* in the browser (and as a toast in the app) while it's open */
window.schedTick=now=>{let ch=false;S.days.forEach(x=>{if(x.done||!own(x))return;const O=x.rep?occ(x):[oneAt(x)];let t=0;O.forEach(v=>{if(v<=now)t=v});
 if(t&&t>(x.repAt||x.createdAt||0)){x.repAt=t;ch=true;if(now-t<15*6e4){if(!NATIVE)notify(x.title,x.tmr?`${x.tmr} min timer`:x.rep?'Every '+every(+x.rep.m):'');else{try{vib()}catch(e){}}}
  if(x.tmr&&!x.rep){x.done=true;x.doneAt=now}}});return ch};

/* ---------------- making things from what the AI understood ---------------- */
function addItem(o){const x={id:uid(),title:o.title,date:o.date,time:o.time,dur:15,goalId:null,done:false,doneAt:null,createdAt:Date.now(),remind:'0',src:'plot',u:Date.now()};
 if(o.rep)x.rep=o.rep;if(o.at){x.at=o.at;x.tmr=o.tmr||0}S.days.push(x);return x}
function drop(ids){S.days=S.days.filter(y=>!ids.includes(y.id));save();sync();redraw()}
const dayWord=d=>d===ymd()?'today':d===addDays(1)?'tomorrow':(typeof dayName==='function'?dayName(d):d);
const lc=s=>(s.charAt(0).toLowerCase()+s.slice(1)).replace(/\bmy\b/gi,'your').replace(/\bmyself\b/gi,'yourself').replace(/\bI\b/g,'you');

/* o: {title, date, time, every (minutes), until (HH:MM), times, days, repeat: daily|weekdays|weekly} */
function remind(o){const title=cap(String(o.title||'').replace(/^(?:(?:please|remind|set|a|an|reminder|alarm|me|to|that|about|for)\s+)+/i,'')).slice(0,90)||'Reminder',now=new Date();
 let m=Math.round(+o.every||0);if(m<0)m=0;if(m>=1440){o.repeat=o.repeat||(m>=10080?'weekly':'daily');m=0}
 const rpt=['daily','weekdays','weekly'].includes(o.repeat)?o.repeat:'';let date=okD(o.date)&&o.date>=ymd()?o.date:'',time=normT(o.time);
 /* every day / weekday / week with no end: that's a habit with a reminder, so it keeps going and keeps a streak */
 if(rpt&&!m&&!(+o.days>1)){const t=time||'09:00',dw=new Date((date||ymd())+'T12:00').getDay();
  const h=normHabit({title,id:uid(),createdAt:Date.now(),startDate:ymd(),remind:true,time:t,freq:rpt==='daily'?'daily':'days',days:rpt==='weekdays'?[1,2,3,4,5]:rpt==='weekly'?[dw]:[0,1,2,3,4,5,6]});
  S.habits.push(h);save();sync();redraw();
  return{say:`Okay, I'll remind you to ${lc(title)} ${rpt==='daily'?'every day':rpt==='weekdays'?'every weekday':'every '+new Date(2024,0,7+dw).toLocaleDateString(undefined,{weekday:'long'})} at ${fmtTime(t)}. It's a habit now, so you can tick it off and keep a streak.`,
   undo:()=>{S.habits=S.habits.filter(y=>y.id!==h.id);save();sync();redraw()},chips:[['Open habit','habit/'+h.id]]}}
 if(!date)date=ymd();
 /* "3 times tomorrow" with no interval: spread them across the day (or the window they gave) */
 const n0=Math.round(+o.times||0);if(!m&&n0>1){const a=time||(date===ymd()?hm(new Date(Math.ceil((now.getTime()+6e4)/3e5)*3e5)):'09:00'),b=normT(o.until)||'21:00',span=(+b.slice(0,2)*60+ +b.slice(3))-(+a.slice(0,2)*60+ +a.slice(3));if(span>0){m=Math.max(1,Math.floor(span/(n0-1)));time=a}}
 /* the first time: what they said; for repeats with no start, soon (today) or the morning (another day) */
 if(!time){if(m&&date===ymd()){const t=new Date(Math.ceil((now.getTime()+Math.min(m,60)*6e4)/6e4)*6e4);time=hm(t)}else time='09:00'}
 let until=m?(normT(o.until)||'21:00'):'';
 if(!m&&date===ymd()&&atOf(date,time)<=now.getTime())date=addDays(1);
 if(m&&date===ymd()&&atOf(date,until)<=now.getTime()&&atOf(date,time)<=now.getTime())date=addDays(1);
 if(m&&date===ymd()&&atOf(date,time)<=now.getTime()){const t=new Date(Math.ceil((now.getTime()+6e4)/3e5)*3e5);time=hm(t)}
 const n=Math.max(0,Math.round(+o.times||0)),days=Math.min(14,Math.max(1,Math.round(+o.days||0)||(rpt&&m?7:1)));
 const ds=[];for(let k=0,d=new Date(date+'T12:00');ds.length<days&&k<30;k++,d.setDate(d.getDate()+1)){const w=d.getDay(),s=ymd(d);if(rpt==='weekdays'&&(w===0||w===6))continue;if(rpt==='weekly'&&k%7)continue;ds.push(s)}
 const t1=normT(o.time)||'09:00',made=ds.map((d,i)=>addItem({title,date:d,time:i?t1:time,rep:m?{m,to:until,...(n?{n}:{})}:null}));save();sync();redraw();
 const ids=made.map(x=>x.id),cnt=m?occ(made[made.length>1?1:0]).length:0;
 const when=ds.length>1?`${dayWord(ds[0])} and the next ${ds.length-1} day${ds.length>2?'s':''}`:dayWord(date);
 const say=m?`Okay, ${when} I'll remind you to ${lc(title)} every ${every(m)}${n?`, ${cnt} time${cnt===1?'':'s'}`:''} from ${fmtTime(time)} until ${fmtTime(until)}${!n&&cnt?` (${cnt} reminder${cnt===1?'':'s'}${ds.length>1?' a day':''})`:''}.`
  :`Okay, I'll remind you ${dayWord(date)} at ${fmtTime(time)}${ds.length>1?` and the next ${ds.length-1} day${ds.length>2?'s':''}`:''}: “${title}”.`;
 return{say:say+(NATIVE?'':' Keep Plotlines open in this browser for the reminders to show.'),undo:()=>drop(ids),chips:[['See what’s scheduled','sched'],['Open calendar','cal-'+date]]}}

function timer(o){const mn=Math.max(1,Math.min(24*60,Math.round(+o.minutes||+o.every||0)));if(!mn)return null;const at=Date.now()+mn*6e4,d=new Date(at);
 const what=cap(String(o.title||'').replace(/^(?:a\s+)?timer\b\s*(?:for\s+)?/i,'').replace(/^\d+\s*(?:min(?:ute)?s?|hours?)\b\s*/i,''));
 const x=addItem({title:'⏱ '+(what||`${mn} min timer`),date:ymd(d),time:hm(d),at,tmr:mn});save();sync();redraw();
 return{say:`Timer set for ${mn>=60&&mn%60===0?mn/60+' hour'+(mn===60?'':'s'):mn+' minute'+(mn===1?'':'s')}${what?` for ${lc(what)}`:''}. It goes off at ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`,undo:()=>drop([x.id]),chips:[['See what’s scheduled','sched']]}}

function checkin(o){const L=active();if(!L.length)return{say:'You don’t have an active goal to check in on yet.',chips:[['Open goals','goals']]};
 const g=(window.PlotDo&&PlotDo.pick(L,String(o.title||''),y=>y.title))||(L.length===1?L[0]:null);
 if(!g)return{say:`Which goal should I check in on? I couldn't find “${String(o.title||'').trim()}”.`,chips:[['Open goals','goals']]};
 const prev={c:g.checkin,t:g.checkinTime,d:g.checkinDay},wk=o.repeat==='weekly',t=normT(o.time)||g.checkinTime||'19:00';
 g.checkin=wk?'weekly':'daily';g.checkinTime=t;if(wk)g.checkinDay=new Date((okD(o.date)?o.date:ymd())+'T12:00').getDay();g.u=Date.now();save();sync();redraw();
 return{say:`Okay, I'll check in on “${g.title}” ${wk?'every '+new Date(2024,0,7+g.checkinDay).toLocaleDateString(undefined,{weekday:'long'}):'every day'} at ${fmtTime(t)}. Reply right in the notification to tell me how it's going.`,
  undo:()=>{g.checkin=prev.c;g.checkinTime=prev.t;g.checkinDay=prev.d;save();sync();redraw()},chips:[['Open goal','goal/'+g.id]]}}

/* when there's no AI (or an ACTION line only gave words): "every 2 hours", "hourly", "until 9pm", "3 times", "for 3 days" */
const NUMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12,fifteen:15,twenty:20,thirty:30,'forty-five':45,ninety:90,half:.5,couple:2,few:3};
const nv=w=>{const n=parseFloat(w);return isNaN(n)?NUMW[String(w).toLowerCase().replace(/\s+of$/,'')]||1:n};
function words(src){let s=' '+String(src||'').replace(/\b([ap])\.\s?m\.?/gi,'$1m')+' ',m,o={};const cut=rx=>{const r=rx.exec(s);if(r)s=s.replace(r[0],' ');return r};
 const N='(\\d+(?:\\.\\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty-five|ninety|half|couple(?:\\s+of)?|few)';
 const hr=(h,mi,ap,ctx)=>{h=+h;ap=(ap||'').toLowerCase();if(ap==='pm'&&h<12)h+=12;else if(ap==='am'&&h===12)h=0;else if(!ap&&ctx&&h<ctx)h+=12;return pad(h%24)+':'+pad(+(mi||0))};
 /* the window: "from 9 to 5", "between 8am and 10pm" */
 if((m=cut(/\s(?:from|between)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|and|until|till|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=[\s,.!?])/i))){o.time=hr(m[1],m[2],m[3],7);o.until=hr(m[4],m[5],m[6],+o.time.slice(0,2)+1)}
 /* how often: "every 2 minutes", "every couple of hours", "every 90 mins", "every other hour", "twice an hour", "hourly" */
 if((m=cut(new RegExp('\\s(?:every|each)\\s+(?:'+N+'\\s*(?:an?\\s+)?)?(seconds?|secs?|minutes?|mins?|m|hours?|hrs?|h)\\b','i'))))o.every=Math.max(1,Math.round(nv(m[1]||1)*(/^h/i.test(m[2])?60:/^s/i.test(m[2])?1/60:1)));
 else if(cut(/\severy\s+other\s+hour\b/i))o.every=120;
 else if(cut(/\s(?:every\s+half\s+(?:an\s+)?hour|half[\s-]hourly|twice\s+an\s+hour)\b/i))o.every=30;else if(cut(/\s(?:hourly|every\s+hour|once\s+an\s+hour)\b/i))o.every=60;
 else if((m=cut(new RegExp('\\s'+N+'\\s+times\\s+(?:an|per|each|every)\\s+hour\\b','i'))))o.every=Math.max(1,Math.round(60/nv(m[1])));
 if(!o.until&&(m=cut(/\s(?:until|till|til|to|through|up\s+to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=[\s,.!?])/i)))o.until=hr(m[1],m[2],m[3],10);
 if(!o.until&&cut(/\s(?:until|till|til|to)\s+(?:the\s+)?(?:evening|tonight)\b/i))o.until='21:00';else if(!o.until&&cut(/\s(?:until|till|til|to)\s+(?:bed(?:time)?|night|midnight)\b/i))o.until='23:00';
 /* how many: "3 times", "twice", "5 times tomorrow" */
 if((m=cut(new RegExp('\\s'+N+'\\s+times\\b(?:\\s+(?:a|per|each)\\s+day)?','i'))))o.times=Math.round(nv(m[1]));else if(cut(/\stwice\b(?:\s+(?:a|per)\s+day)?/i))o.times=2;else if(cut(/\sthrice\b/i))o.times=3;
 if((m=cut(new RegExp('\\sfor\\s+(?:the\\s+)?(?:next\\s+)?'+N+'\\s+days\\b','i'))))o.days=Math.round(nv(m[1]));else if(cut(/\s(?:all|this|the\s+whole)\s+week\b/i)){o.days=7}
 /* for how long: "for the next 2 hours", "for an hour" (from now) */
 if((m=cut(new RegExp('\\sfor\\s+(?:the\\s+)?(?:next\\s+)?'+N+'\\s*(hours?|hrs?|minutes?|mins?)\\b','i')))){const mn=nv(m[1])*(/^h/i.test(m[2])?60:1),t=new Date(Date.now()+mn*6e4);o.until=hm(t);o.soon=1}
 if((m=cut(/\s(?:every|each)\s+(morning|afternoon|evening|night)\b/i))){o.repeat='daily';o.time={morning:'08:00',afternoon:'14:00',evening:'19:00',night:'21:00'}[m[1].toLowerCase()]}
 else if(cut(/\s(?:every\s+day|daily|each\s+day|every\s+single\s+day)\b/i))o.repeat='daily';else if(cut(/\s(?:every\s+weekday|on\s+weekdays|weekdays)\b/i))o.repeat='weekdays';else if(cut(/\s(?:every\s+week|weekly)\b/i))o.repeat='weekly';
 o.rest=s.replace(/\s+/g,' ').trim();return o}

/* one item from AGENT.decide (or an ACTION line) */
function make(it){const ty=it.type==='alarm'?'reminder':it.type;
 if(ty==='timer')return timer({minutes:it.minutes||(/(\d+)/.exec(String(it.detail||it.title||''))||[])[1],title:it.title});
 if(ty==='checkin')return checkin(it);
 if(ty!=='reminder')return null;
 const has=['date','time','every','until','times','days','repeat'].some(k=>it[k]!=null&&it[k]!==''&&it[k]!==0);
 /* the AI's fields first; words it left in the title ("Drink water every 2 hours"), or in what they said (q, when this
    was the only reminder in the message), fill the gaps. A small model often gets the date right and drops the repeat. */
 const wq=it.q?words(it.q):{};
 if(has||wq.every||wq.repeat||wq.days||wq.times){const wt=words(it.title||''),wx=words(it.detail||''),f=k=>it[k]||wt[k]||wx[k]||wq[k]||'';it={...it,time:f('time'),date:it.date||(wq.soon?ymd():'')};
  if(!has&&window.PlotDo){const w=PlotDo.parseWhen(wq.rest||'');if(w.found){it={...it,date:w.date,time:/\d|noon|midnight|morning|afternoon|evening|night/i.test(it.q)?w.time:''}}}return remind({...it,title:wt.rest||it.title,every:f('every'),until:f('until'),times:f('times'),days:f('days'),repeat:f('repeat')})}
 /* only words: read them here */
 const txt=[it.title,it.detail].filter(Boolean).join(' '),wd=words(txt),w=window.PlotDo?PlotDo.parseWhen(wd.rest):{found:false};
 const title=w.found?(w.rest||it.title):wd.rest||it.title;
 return remind({...wd,title,date:w.found?w.date:wd.soon?ymd():'',time:wd.time||(w.found&&(/\d|noon|midnight|morning|afternoon|evening|night/i.test(txt))?w.time:'')})}
/* the assistant's quick path: only a reminder that repeats needs this; a plain one stays as it was */
function fromText(x){const wd=words(x);if(!wd.every&&!wd.repeat&&!wd.days&&!(wd.times>1))return null;return make({type:'reminder',title:x})}

/* ---------------- Home: what's scheduled ---------------- */
const KIND={rem:['bell','Reminder'],day:['bell','Reminder'],step:['target','Step'],checkin:['goals','Check-in'],habit:['rep','Habit'],timer:['timer','Focus timer'],litem:['checklist','List'],wrap:['journal','Day wrap-up'],agent:['agent','Agent'],mile:['flag','Milestone']};
function upcoming(now,span){let L=[];try{L=alarmList(now,true)}catch(e){}return L.filter(x=>x.at>now&&x.at<=now+span).sort((a,b)=>a.at-b.at)}
function rows(L){const out=[],seen={};L.forEach(x=>{const key=x.k==='rem'&&x.id?'r'+x.id:x.k==='habit'?'h'+x.hid+x.hd:'';if(key&&seen[key]){seen[key].more++;return}const r={...x,more:0};if(key)seen[key]=r;out.push(r)});return out}
const tWhen=t=>{const d=new Date(t),ds=ymd(d);return{day:ds===ymd()?'Today':ds===addDays(1)?'Tomorrow':d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),time:d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}};
function rowHTML(r){const x=r.id&&(r.k==='rem'||r.k==='day')?S.days.find(y=>y.id===r.id):null,[icon,lab]=x&&x.tmr?['timer','Timer']:KIND[r.k]||['bell','Reminder'],w=tWhen(r.at);
 const sub=x&&x.rep?`Every ${everyS(+x.rep.m)} until ${fmtTime(x.rep.to||'21:00')}${r.more?` · ${r.more} more`:''}`:r.more?`${lab} · ${r.more+1} times`:lab+(r.body&&r.k!=='rem'&&r.k!=='day'?' · '+r.body:'');
 const off=x?`<button class="ibtn sm" data-act="schedOff" data-id="${x.id}" aria-label="Cancel ${esc(r.title)}">${ic('plus')}</button>`:'';
 return`<li class="sc-r"><span class="sc-i">${ic(icon)}</span><span class="sd-t"><b>${esc(r.title)}</b><small>${esc(sub)}</small></span><span class="sc-w"><b>${esc(w.time)}</b><small>${esc(w.day)}</small></span>${off}</li>`}
function schedHTML(){const now=Date.now(),R=rows(upcoming(now,48*36e5)),N=6;
 const body=R.length?`<ul class="sc-l">${R.slice(0,N).map(rowHTML).join('')}</ul>`:`<p class="small muted" style="margin:6px 0 2px">Nothing in the next two days. Try telling your assistant “remind me tomorrow to drink water every 2 hours”.</p>`;
 return`<section class="rv hsched"><div class="st-h"><h3>Scheduled</h3><button class="link" data-act="schedAll">${R.length>N?`All ${R.length}`:'This week'}</button></div><div class="panel sc-p">${body}</div></section>`}
function schedAllHTML(){const now=Date.now(),R=rows(upcoming(now,7*864e5));let last='';
 return`<div class="data">Next 7 days</div><h2 style="margin-top:6px">Scheduled</h2>${R.length?`<ul class="sc-l">${R.map(r=>{const d=tWhen(r.at).day,h=d!==last?`<li class="sc-d data">${esc(d)}</li>`:'';last=d;return h+rowHTML(r)}).join('')}</ul>`:'<p class="muted">Nothing scheduled this week.</p>'}
 <p class="small muted">Reminders, timers, goal check-ins, habit reminders and agent tasks. Ask your assistant to add or change any of them.</p><div class="actions"><button class="btn pri" data-act="close">Done</button></div>`}
Object.assign(ACT,{schedAll:()=>openSheet(schedAllHTML()),
 schedOff:d=>{const x=S.days.find(y=>y.id===d.id);if(!x)return;const prev={...x},plot=x.src==='plot';
  if(plot)S.days=S.days.filter(y=>y!==x);else{x.remind='';delete x.rep;x.u=Date.now()}save();sync();
  if($('#sheet').classList.contains('on')&&$('#sheet .sc-l'))openSheet(schedAllHTML());redraw();
  toast(`Cancelled “${esc(prev.title)}”`,()=>{if(plot)S.days.push(prev);else Object.assign(x,prev);save();sync();redraw();if($('#sheet .sc-l'))openSheet(schedAllHTML())})}});
/* the assistant's "See what's scheduled" chip */
if(typeof window.__route==='function'){const _r=window.__route;window.__route=r=>{if(r==='sched'){go('today');setTimeout(()=>ACT.schedAll(),350);return}return _r(r)}}

/* ---------------- Home: trends ---------------- */
function bars(vals,o={}){const mx=o.max||Math.max(1,...vals.map(v=>v||0));const tn=dnum(ymd());
 return`<div class="tr-b" role="img" aria-label="${esc(o.label||'')}">${vals.map((v,i)=>{const d=fromN(tn-vals.length+1+i);return`<span title="${esc((typeof dayName==='function'?dayName(d):d)+': '+(v==null?'nothing due':(o.fmt?o.fmt(v):v)))}" class="${v==null?'nil':''}${i===vals.length-1?' tdy':''}"><i style="height:${v==null?0:Math.max(v?6:2,Math.round(v/mx*100))}%"></i></span>`}).join('')}</div>`}
function trendsHTML(){const tn=dnum(ymd()),N=14,K=[...Array(N)].map((_,i)=>fromN(tn-N+1+i)),cards=[];
 if(S.habits.some(h=>h.status!=='archived'&&h.kind!=='quit')){const v=K.map(d=>{const r=dayRatio(d);return r.due?Math.round(r.dn/r.due*100):null}),w=v.slice(-7).filter(x=>x!=null);
  cards.push(`<div class="tr-c"><div class="tr-h"><span class="data">Habits kept</span><b>${w.length?Math.round(w.reduce((a,x)=>a+x,0)/w.length)+'%':'–'}</b><small>last 7 days</small></div>${bars(v,{max:100,fmt:x=>x+'%',label:'Share of habits kept each day for 14 days'})}</div>`)}
 const done={};S.goals.forEach(g=>g.steps.forEach(s=>{if(s.done&&s.doneAt){const d=ymd(new Date(s.doneAt));done[d]=(done[d]||0)+1}}));S.days.forEach(x=>{if(x.done&&x.doneAt&&!x.tmr){const d=ymd(new Date(x.doneAt));done[d]=(done[d]||0)+1}});
 const dv=K.map(d=>done[d]||0),dt=dv.reduce((a,x)=>a+x,0);
 if(dt||S.goals.length)cards.push(`<div class="tr-c"><div class="tr-h"><span class="data">Things done</span><b>${dt}</b><small>steps and day goals, 14 days</small></div>${bars(dv,{label:'Steps and goals finished each day for 14 days'})}</div>`);
 const jn={};(S.entries||[]).forEach(e=>{if(e.type==='note'&&e.t){const d=ymd(new Date(e.t));jn[d]=(jn[d]||0)+1}});const jv=K.map(d=>jn[d]||0),jt=jv.filter(Boolean).length;
 if((S.entries||[]).some(e=>e.type==='note'))cards.push(`<div class="tr-c"><div class="tr-h"><span class="data">Journal</span><b>${jt}</b><small>day${jt===1?'':'s'} written, of 14</small></div>${bars(jv,{label:'Journal entries each day for 14 days',fmt:x=>x+' entr'+(x===1?'y':'ies')})}</div>`);
 const G=active().sort((a,b)=>(b.pinned-a.pinned)||(a.priority-b.priority)).slice(0,4);
 if(G.length)cards.push(`<div class="tr-c"><div class="tr-h"><span class="data">Goal progress</span><b>${Math.round(G.reduce((a,g)=>a+pct(g),0)/G.length)}%</b><small>average of ${G.length}</small></div><ul class="tr-g">${G.map(g=>`<li style="${typeof cvar==='function'?cvar(g):''}"><span>${esc(g.title)}</span><i><u style="width:${pct(g)}%"></u></i><b>${pct(g)}%</b></li>`).join('')}</ul></div>`);
 if(!cards.length)return'';
 return`<section class="rv hcharts"><div class="st-h"><h3>Trends</h3><a class="link" href="#/activity">More</a></div><div class="tr-w">${cards.join('')}</div></section>`}
if(typeof homeTop==='function'){const _ht=homeTop;homeTop=function(){let a='',b='';try{a=schedHTML()}catch(e){}try{b=trendsHTML()}catch(e){}return _ht()+a+b}}

window.SCHED={make,remind,timer,checkin,fromText,words,occ,upcoming};

const css=document.createElement('style');css.textContent=`
.sc-p{padding:4px 14px}.sc-l{list-style:none;margin:0;padding:0}
.sc-r{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid color-mix(in srgb,var(--text) 8%,transparent)}.sc-r:first-child,.sc-d+.sc-r{border-top:0}
.sc-i{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)}.sc-i svg{width:18px;height:18px}
.sd-t{flex:1;min-width:0;display:flex;flex-direction:column}.sd-t b{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sd-t small,.sc-w small{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-w{flex:none;display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}.sc-w b{font-size:14px;font-weight:600}
.sc-r .ibtn svg{transform:rotate(45deg)}.sc-d{padding:14px 0 2px;color:var(--muted)}
.tr-w{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}
.tr-c{padding:14px;border-radius:18px;background:var(--surface);border:1px solid var(--line);min-width:0}
.tr-h{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:0 8px;margin-bottom:10px}.tr-h b{grid-row:1/span 2;grid-column:2;font:700 24px/1 var(--f-body);font-variant-numeric:tabular-nums}.tr-h small{color:var(--muted);font-size:12px}
.tr-b{display:flex;align-items:flex-end;gap:3px;height:56px}.tr-b span{flex:1;height:100%;display:flex;align-items:flex-end;border-radius:4px;background:color-mix(in srgb,var(--text) 5%,transparent)}
.tr-b i{display:block;width:100%;border-radius:4px;background:color-mix(in srgb,var(--accent) 60%,transparent)}.tr-b span.tdy i{background:var(--accent)}.tr-b span.nil{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--text) 6%,transparent) 0 3px,transparent 3px 6px)}
.tr-g{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.tr-g li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;font-size:13px}.tr-g span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tr-g b{font-variant-numeric:tabular-nums;font-size:12.5px}
.tr-g i{grid-column:1/-1;grid-row:2;height:6px;border-radius:3px;background:color-mix(in srgb,var(--text) 8%,transparent);overflow:hidden}.tr-g u{display:block;height:100%;border-radius:3px;background:var(--c,var(--accent))}`;
document.head.appendChild(css);
if(typeof booted!=='undefined'&&booted&&typeof cur!=='undefined'&&cur.p==='today')redraw();
})();
