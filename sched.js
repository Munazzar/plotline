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
function addItem(o){const x={id:uid(),title:o.title,date:o.date,time:o.time,dur:Math.min(1440,Math.max(5,Math.round(+o.dur||15))),goalId:null,done:false,doneAt:null,createdAt:Date.now(),remind:'0',src:'plot',u:Date.now()};
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
 const t1=normT(o.time)||'09:00',made=ds.map((d,i)=>addItem({title,date:d,time:i?t1:time,dur:o.dur,rep:m?{m,to:until,...(n?{n}:{})}:null}));save();sync();redraw();
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
 return`<section class="rv hsched"><div class="st-h"><h3>Scheduled</h3><span class="rm-h"><button class="link" data-act="remMgr">Manage</button><button class="link" data-act="schedAll">${R.length>N?`All ${R.length}`:'This week'}</button></span></div><div class="panel sc-p">${+S.settings.remPause>Date.now()?`<p class="small rm-pzl">${ic('bell','ico-s')} Reminders paused until ${esc(tWhen(+S.settings.remPause).day+' '+tWhen(+S.settings.remPause).time)} · <button class="link" data-act="remPause" data-m="0">Resume</button></p>`:''}${body}</div></section>`}
function schedAllHTML(){const now=Date.now(),R=rows(upcoming(now,7*864e5));let last='';
 return`<div class="data">Next 7 days</div><h2 style="margin-top:6px">Scheduled</h2>${R.length?`<ul class="sc-l">${R.map(r=>{const d=tWhen(r.at).day,h=d!==last?`<li class="sc-d data">${esc(d)}</li>`:'';last=d;return h+rowHTML(r)}).join('')}</ul>`:'<p class="muted">Nothing scheduled this week.</p>'}
 <p class="small muted">Reminders, timers, goal check-ins, habit reminders and agent tasks. Ask your assistant to add or change any of them.</p><div class="actions"><button class="btn pri" data-act="close">Done</button></div>`}
Object.assign(ACT,{schedAll:()=>openSheet(schedAllHTML()),
 schedOff:d=>{const x=S.days.find(y=>y.id===d.id);if(!x)return;const prev={...x},plot=x.src==='plot';
  if(plot)S.days=S.days.filter(y=>y!==x);else{x.remind='';delete x.rep;x.u=Date.now()}save();sync();
  if($('#sheet .rm-pz'))remRe();else if($('#sheet').classList.contains('on')&&$('#sheet .sc-l'))openSheet(schedAllHTML());redraw();
  toast(`Cancelled “${esc(prev.title)}”`,()=>{if(plot)S.days.push(prev);else Object.assign(x,prev);save();sync();redraw();if($('#sheet .rm-pz'))remRe();else if($('#sheet .sc-l'))openSheet(schedAllHTML())})}});
/* the assistant's "See what's scheduled" chip */
if(typeof window.__route==='function'){const _r=window.__route;window.__route=r=>{if(r==='sched'){go('today');setTimeout(()=>ACT.schedAll(),350);return}return _r(r)}}
/* 1.61.0: Reminders, all in one place. Every source that can notify (reminders, habits, goal steps, check-ins, target
   dates, agent tasks, wrap-up, lists) listed once with its next time, searchable, with Edit and Off on each, and a
   pause for all of them (S.settings.remPause: until when). A pause holds back both Android's alarms and in-app ones. */
const PZ=()=>{const p=+S.settings.remPause||0;return p>Date.now()?p:0};
const _al=alarmList;alarmList=function(now,all){const L=_al(now,all),p=PZ();return p?L.filter(x=>x.at>p):L};
const _nt=notify;notify=function(t,b){if(PZ()&&t!=='Focus session complete')return;return _nt(t,b)};
const rkey=x=>x.k==='rem'||x.k==='day'?'d'+x.id:x.k==='step'?'s'+x.s:x.k==='habit'?'h'+x.hid:x.k==='checkin'?(/^Target:/.test(x.title)?'t':'c')+x.g:x.k+':'+x.title;
const RGRP=[['habit','Habits'],['rem','Reminders'],['step','Goal steps'],['checkin','Goal check-ins and targets'],['other','Agent, lists and more']];
function remSrcs(){const L=_al(Date.now(),true).filter(x=>x.k!=='timer'&&x.k!=='mile').sort((a,b)=>a.at-b.at),seen={},out=[];
 L.forEach(x=>{const k=rkey(x);if(seen[k]){seen[k].n++;return}out.push(seen[k]={...x,key:k,n:1})});return out}
function remSub(r){if(r.k==='habit'){const h=H(r.hid);if(h)return`${freqText(h)} · ${habitRemTimes(h).map(fmtTime).join(', ')}${h.again?` · again after ${everyS(h.again)}`:''}`}
 if(r.k==='rem'||r.k==='day'){const x=S.days.find(y=>y.id===r.id);if(x&&x.rep)return`Every ${everyS(+x.rep.m)} until ${fmtTime(x.rep.to||'21:00')}`}
 if(r.k==='checkin'&&!/^Target:/.test(r.title)){const g=G(r.g);if(g)return g.checkin==='weekly'?`Weekly · ${new Date(2024,0,7+(+g.checkinDay||0)).toLocaleDateString(undefined,{weekday:'long'})} ${fmtTime(g.checkinTime||'19:00')}`:`Daily · ${fmtTime(g.checkinTime||'19:00')}`}
 return r.body||''}
function remBtns(r){const x=(r.k==='rem'||r.k==='day')&&S.days.find(y=>y.id===r.id),T=esc(r.title);
 const ed=r.k==='habit'?`data-k="habit" data-id="${r.hid}"`:r.k==='step'?`data-k="step" data-g="${r.g}" data-s="${r.s}"`:r.k==='checkin'?`data-k="goal" data-id="${r.g}"`:x&&!x.rep&&!(+x.at>0)?`data-k="day" data-id="${x.id}"`:'';
 const off=x&&x.src==='plot'?`<button class="btn sm ghost" data-act="schedOff" data-id="${x.id}" aria-label="Delete ${T}">Delete</button>`:ed?`<button class="btn sm ghost" data-act="remOff" data-key="${r.key}" aria-label="Turn off ${T}">Off</button>`:r.k==='agent'?`<a class="btn sm ghost" href="#/agent">Open</a>`:'';
 return(ed?`<button class="btn sm" data-act="remEdit" ${ed} aria-label="Edit ${T}">Edit</button>`:'')+off}
function remMgrHTML(){const R=remSrcs(),p=PZ(),w=t=>{const d=tWhen(t);return d.day+' '+d.time};
 const grp=k=>RGRP.some(g=>g[0]===k)?k:k==='day'?'rem':'other';
 const body=RGRP.map(([g,name])=>{const rs=R.filter(r=>grp(r.k)===g);return rs.length?`<div class="rm-g"><div class="sc-d data">${name} · ${rs.length}</div><ul class="sc-l">${rs.map(r=>{const[icon]=KIND[r.k]||['bell'];
  return`<li class="sc-r rm-r" data-q="${esc((r.title+' '+remSub(r)).toLowerCase())}"><span class="sc-i">${ic(icon)}</span><span class="sd-t"><b>${esc(r.title)}</b><small>${esc(remSub(r))}</small><small>Next: ${esc(w(r.at))}</small></span><span class="rm-a">${remBtns(r)}</span></li>`}).join('')}</ul></div>`:''}).join('');
 const pz=p?`<div class="panel rm-pz on">${ic('bell')}<span><b>Paused until ${esc(w(p))}</b><small>Nothing will notify you before then.</small></span><button class="btn sm pri" data-act="remPause" data-m="0">Resume</button></div>`
  :`<div class="rm-pz"><span class="small muted">Pause all</span>${[[60,'1 hour'],[180,'3 hours'],['tm','Until tomorrow'],[10080,'1 week']].map(([m,n])=>`<button class="chip" data-act="remPause" data-m="${m}">${n}</button>`).join('')}</div>`;
 return`<div class="data">Every reminder</div><h2 style="margin-top:6px">Reminders</h2>${pz}${R.length>5?`<div class="fnd-in rm-q">${ic('search')}<input type="search" data-remq placeholder="Search reminders" autocomplete="off"></div>`:''}
 ${R.length?body:'<p class="muted">No reminders yet. Turn one on from a habit or goal (the bell), or tell your assistant “remind me at 6 to stretch”.</p>'}
 <div class="actions"><button class="btn pri" data-act="close">Done</button></div>`}
const remRe=()=>{if($('#sheet').classList.contains('on')&&$('#sheet .rm-pz')){const sh=$('#sheet'),y=sh.scrollTop;openSheet(remMgrHTML());sh.scrollTop=y}};
function remOffOf(key){const R=remSrcs().find(r=>r.key===key);if(!R)return null;
 if(R.k==='habit'){const h=H(R.hid);return h&&[h,{remind:false,again:0}]}
 if(R.k==='step'){const g=G(R.g),s=g&&g.steps.find(x=>x.id===R.s);return s&&[s,{remind:''},g]}
 if(R.k==='day'||R.k==='rem'){const x=S.days.find(y=>y.id===R.id);return x&&[x,{remind:''}]}
 if(R.k==='checkin'){const g=G(R.g);return g&&[g,/^Target:/.test(R.title)?{remTarget:''}:{checkin:''}]}return null}
Object.assign(ACT,{remMgr:()=>openSheet(remMgrHTML()),
 remOff:d=>{const o=remOffOf(d.key);if(!o)return;const[x,ch,par]=o,prev={};for(const k in ch)prev[k]=x[k];Object.assign(x,ch);x.u=Date.now();if(par)par.u=Date.now();save();sync();redraw();remRe();
  toast(`Turned off “${esc(x.title)}”`,()=>{Object.assign(x,prev);x.u=Date.now();save();sync();redraw();remRe()})},
 remPause:d=>{if(d.m==='0'){delete S.settings.remPause}else{let t=Date.now()+(+d.m||0)*6e4;if(d.m==='tm'){const n=new Date();n.setDate(n.getDate()+1);n.setHours(7,0,0,0);t=n.getTime()}S.settings.remPause=t}
  save();sync();redraw();remRe();toast(PZ()?'Reminders paused':'Reminders back on')}});
document.addEventListener('input',e=>{if(!e.target.matches||!e.target.matches('[data-remq]'))return;const q=e.target.value.trim().toLowerCase();
 document.querySelectorAll('#sheet .rm-r').forEach(li=>li.hidden=!!q&&!li.dataset.q.includes(q));document.querySelectorAll('#sheet .rm-g').forEach(g=>g.hidden=![...g.querySelectorAll('.rm-r')].some(li=>!li.hidden))});
if(typeof window.__route==='function'){const _r2=window.__route;window.__route=r=>{if(r==='reminders'){go('today');setTimeout(()=>ACT.remMgr(),350);return}return _r2(r)}}

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
if(typeof homeTop==='function'){const _ht=homeTop;homeTop=function(){let b='';try{b=trendsHTML()}catch(e){}return _ht()+b}}

/* ---------------- Home: one Today (2026-11-04) ----------------
   "Your day", "Today's goals", "Scheduled" and "Habits" were four cards that repeated each other (a day goal with a
   reminder showed in three). Now one card holds all of it, each thing once: the add box, everything due today in time
   order (habits, day goals, goal steps, and reminders, timers, check-ins and agent tasks that aren't one of those),
   what's still open from earlier, what's scheduled next, and the habit week grid. "See everything for today" opens the
   day page, which shows the same plan. */
let HTO_ALL=false;
function todayItems(){const td=ymd(),now=Date.now();
 /* goals and steps come from the calendar's own list (calItems), so Home and the day page always agree: day goals,
    steps due, repeating steps that fall on today and goal target dates */
 const tn=dnum(td),ci=(calItems(tn,tn)[tn]||[]),seen=new Set();
 const hs=S.habits.filter(h=>h.status==='active'&&h.kind!=='quit'&&hDue(h,td)&&!(h.skip&&h.skip[td])&&!((h.ck||{})[td]||{}).sk),dg=ci.filter(x=>x.k==='day').map(x=>x.x),
  st=ci.filter(x=>(x.k==='step'||x.k==='rep')&&x.g&&x.g.status==='active'&&!seen.has(x.s.id)&&seen.add(x.s.id)).map(x=>({g:x.g,s:x.s,rep:x.k==='rep'})),tg=ci.filter(x=>x.k==='target');
 const I=[...hs.map(h=>({k:'h',done:hDone(h,td),t:hIcon(h)+' '+h.title,tm:h.time||'',h})),...dg.map(x=>({k:'d',done:!!x.done,t:x.title,tm:x.time||'',x})),...st.map(o=>({k:'s',done:!o.rep&&!!o.s.done,t:o.s.title,tm:o.s.time||'',o})),...tg.map(x=>({k:'t',done:x.done,t:x.g.title,tm:'',o:{g:x.g}}))];
 /* scheduled things for the rest of today that aren't already a row above */
 const have=x=>x.k==='habit'?hs.some(h=>h.id===x.hid):(x.k==='day'||x.k==='rem')&&x.id?dg.some(d=>d.id===x.id):x.k==='step'?st.some(o=>o.s.id===x.s):false;
 const U=rows(upcoming(now,48*36e5)),eod=new Date(td+'T23:59:59').getTime();
 U.filter(x=>x.at<=eod&&!have(x)).forEach(x=>{const d=new Date(x.at);I.push({k:'r',done:false,t:x.title,tm:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),r:x})});
 const carry=S.days.filter(x=>!x.done&&x.date<td&&daysUntil(x.date)>=-14).sort((a,b)=>a.date<b.date?1:-1);
 const late=active().flatMap(g=>g.steps.filter(s=>!s.done&&s.due&&s.due<td&&daysUntil(s.due)>=-14).map(s=>({g,s})));
 const later=U.filter(x=>x.at>eod);
 return{I,carry,late,later}}
/* v 'day': the day page's Plan for today (it has its own habit list below, so no habit rows, week grid or link to itself) */
function todayCard(v){const td=ymd(),T=todayItems(),{carry,late,later}=T,I=v==='day'?T.I.filter(i=>i.k!=='h'):T.I;
 const tick=I.filter(i=>i.k!=='r'&&i.k!=='t'),dn=tick.filter(i=>i.done).length,p=tick.length?dn/tick.length:0;
 const open=I.filter(i=>!i.done).sort((a,b)=>(a.tm||'99').localeCompare(b.tm||'99')),done=I.filter(i=>i.done);
 const tog=i=>i.k==='h'?(i.h.kind==='routine'&&i.h.steps&&i.h.steps.length&&!i.done?'data-act="routineGo" data-id="'+i.h.id+'"':'data-act="hTap" data-id="'+i.h.id+'"'):i.k==='d'?'data-act="toggleDay" data-id="'+i.x.id+'"':'data-act="toggleStep" data-g="'+i.o.g.id+'" data-s="'+i.o.s.id+'"';
 const opn=i=>i.k==='h'?'data-act="openHabit" data-id="'+i.h.id+'"':i.k==='d'?'data-act="editDay" data-id="'+i.x.id+'"':i.k==='s'||i.k==='t'?'data-act="open" data-id="'+i.o.g.id+'"':'data-act="schedAll"';
 const col=i=>i.k==='h'?cvar(i.h):i.k==='s'||i.k==='t'?cvar(i.o.g):i.k==='d'?'--c:'+colOf(i.x.goalId&&G(i.x.goalId)):'';
 const sub=i=>{if(i.k==='s')return esc(i.o.g.title)+(i.o.rep?' · repeats':'');if(i.k==='t')return i.done?'Goal achieved':'Goal target date · '+pct(i.o.g)+'% there';if(i.k==='d'){const g=i.x.goalId&&G(i.x.goalId);return g?esc(g.title):''}
  if(i.k==='r'){const x=i.r.id&&(i.r.k==='rem'||i.r.k==='day')?S.days.find(y=>y.id===i.r.id):null,lab=x&&x.tmr?'Timer':(KIND[i.r.k]||['','Reminder'])[1];return esc(lab+(i.r.body&&i.r.k!=='rem'&&i.r.k!=='day'?' · '+i.r.body:''))}
  if(i.k==='h'){const n=hTarget(i.h);return n>1&&!i.done?Math.min(n,+hVal(i.h,td)||0)+' of '+n+(i.h.unit?' '+esc(i.h.unit):''):''}return''};
 const tail=i=>i.k==='d'&&!i.done?(i.x.auto&&i.x.auto.type?autoBtn('day','data-id="'+i.x.id+'"',i.x,'ic'):'')+dayBell(i.x,'ic'):i.k==='r'&&i.r.id&&(i.r.k==='rem'||i.r.k==='day')?'<button class="ibtn sm hto-off" data-act="schedOff" data-id="'+i.r.id+'" aria-label="Cancel '+esc(i.t)+'">'+ic('plus')+'</button>':'';
 const row=i=>{const sb=sub(i);return'<div class="ud-r hto-r'+(i.done?' d':'')+'" data-k="'+i.k+'" style="'+col(i)+'">'+(i.k==='r'||i.k==='t'?'<span class="hto-i">'+ic(i.k==='t'?'flag':(KIND[i.r.k]||['bell'])[0])+'</span>':'<button class="chk'+(i.done?' on':'')+'" '+tog(i)+' aria-label="'+(i.done?'Mark not done':'Mark done')+': '+esc(i.t)+'">'+ic('check')+'</button>')+'<button class="ud-x" '+opn(i)+'><span class="hto-tt"><span class="ell">'+esc(i.t)+'</span>'+(sb?'<small class="ell">'+sb+'</small>':'')+'</span>'+(i.tm?'<small class="data">'+fmtTime(i.tm)+'</small>':'')+'</button>'+tail(i)+'</div>'};
 const N=v==='day'?6:Infinity,shown=HTO_ALL?open:open.slice(0,N),hid=open.length-shown.length;
 const seg=tick.length?(tick.length<=14?'<div class="ud-seg">'+[...tick.filter(i=>i.done),...tick.filter(i=>!i.done)].map(i=>'<i class="'+(i.done?'on':'')+'"></i>').join('')+'</div>':'<div class="ud-bar"><i style="width:'+Math.round(p*100)+'%"></i></div>'):'';
 const pz=+S.settings.remPause>Date.now()?'<p class="small rm-pzl">'+ic('bell','ico-s')+' Reminders paused until '+esc(tWhen(+S.settings.remPause).day+' '+tWhen(+S.settings.remPause).time)+' · <button class="link" data-act="remPause" data-m="0">Resume</button></p>':'';
 const earlier=carry.length||late.length?'<div class="hto-sub data">Still open from earlier</div><div class="hto-l">'
  +carry.slice(0,5).map(x=>'<div class="ud-r hto-r" style="--c:'+colOf(x.goalId&&G(x.goalId))+'"><button class="chk" data-act="toggleDay" data-id="'+x.id+'" aria-label="Mark done: '+esc(x.title)+'">'+ic('check')+'</button><button class="ud-x" data-act="editDay" data-id="'+x.id+'"><span class="hto-tt"><span class="ell">'+esc(x.title)+'</span><small class="ell">'+esc(dayName(x.date))+'</small></span></button><button class="chip sm" data-act="dayMove" data-id="'+x.id+'">Move to today</button></div>').join('')
  +late.slice(0,4).map(({g,s})=>'<div class="ud-r hto-r" style="'+cvar(g)+'"><button class="chk" data-act="toggleStep" data-g="'+g.id+'" data-s="'+s.id+'" aria-label="Mark done: '+esc(s.title)+'">'+ic('check')+'</button><button class="ud-x" data-act="open" data-id="'+g.id+'"><span class="hto-tt"><span class="ell">'+esc(s.title)+'</span><small class="ell">'+esc(g.title)+' · was due '+esc(dayName(s.due))+'</small></span></button></div>').join('')+'</div>':'';
 const nx=later.slice(0,3),lat=nx.length?'<div class="hto-sub data">Next up<button class="link" data-act="schedAll">'+(later.length>3?'All '+later.length:'This week')+'</button></div><ul class="sc-l hto-sc">'+nx.map(rowHTML).join('')+'</ul>':'';
 let grid='';try{grid=HSN_GRID?HSN_GRID():''}catch(e){}
 const t=dayRatio(td),wo=!!S.settings.htoWk,wk=grid?'<div class="hto-wk'+(wo?' on':'')+'"><button class="hto-sub data hto-wkb" data-act="htoWk" aria-expanded="'+wo+'">Habits this week'+(t.due?'<span>'+t.dn+' of '+t.due+' today</span>':'')+ic('down','ico-s')+'</button>'+(wo?grid.replace(/^<section class="hsnap rv"/,'<div class="hsnap"').replace(/<div class="st-h">[\s\S]*?All habits<\/a><\/div>/,'').replace(/<\/section>$/,'</div>')+'<a class="link hto-allh" href="#/habits">All habits</a>':'')+'</div>':'';
 const empty=!I.length&&!carry.length&&!late.length;
 return'<section class="hday ud hto rv"><div class="ud-h"><div><div class="data">Today · '+esc(new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))+'</div><b class="ud-t">'+(empty?'A clear day':p>=1&&tick.length?'All done today':tick.length?dn+' of '+tick.length+' done':'Nothing to tick yet')+'</b></div><span class="hto-hl"><a class="link" href="#/cal">Calendar</a><button class="link" data-act="remMgr">Reminders</button></span></div>'+seg+pz
  +'<div class="tg-box hto-box"><form class="tg-add" data-form="dayAdd" autocomplete="off"><input name="t" maxlength="90" placeholder="Add something for today…" aria-label="Add a goal for today"><button aria-label="Add">'+ic('plus')+'</button></form><div class="hto-clip">'
  +(p>=1&&tick.length?'<p class="ud-done">Everything for today is done. Well played.</p>':'')
  +'<div class="ud-l hto-l">'+shown.map(row).join('')+(hid>0?'<button class="hto-more" data-act="htoAll">Show '+hid+' more</button>':HTO_ALL&&open.length>N?'<button class="hto-more" data-act="htoAll">Show less</button>':'')+(done.length?'<div class="hto-dn">'+done.map(row).join('')+'</div>':'')+'</div>'
  +earlier+lat+(v==='day'?'':wk)+'</div></div><button class="hto-fold" data-act="htoFold" hidden><span></span>'+ic('down','ico-s')+'</button>'+(v==='day'?'':'<button class="ud-go" data-act="dayToday"><span>See everything for today</span>'+ic('next','ico-s')+'</button>')+'</section>'}
/* Home's Today folds once it runs long: one button opens all of it and closes it again, and it stays in reach while you scroll */
let HTO_OPEN=false;const HTO_MAX=380;
function htoFit(){const c=document.querySelector('#view .hday.hto .hto-clip'),b=c&&c.closest('.hto').querySelector('.hto-fold');if(!b)return;
 const long=c.scrollHeight>HTO_MAX+90;b.hidden=!long;c.classList.toggle('cl',long&&!HTO_OPEN);c.style.maxHeight=long&&!HTO_OPEN?HTO_MAX+'px':'';b.classList.toggle('on',HTO_OPEN);b.setAttribute('aria-expanded',HTO_OPEN);b.firstChild.textContent=HTO_OPEN?'Show less':'Show all'}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{htoFit()}catch(e){}return r}}
ACT.htoFold=(d,b)=>{const c=b.closest('.hto').querySelector('.hto-clip'),from=c.getBoundingClientRect().height;HTO_OPEN=!HTO_OPEN;b.classList.toggle('on',HTO_OPEN);b.setAttribute('aria-expanded',HTO_OPEN);b.firstChild.textContent=HTO_OPEN?'Show less':'Show all';
 const to=HTO_OPEN?c.scrollHeight:HTO_MAX;c.style.maxHeight=from+'px';c.classList.add('run');void c.offsetHeight;c.classList.toggle('cl',!HTO_OPEN);c.style.maxHeight=to+'px';
 clearTimeout(c._t);c._t=setTimeout(()=>{c.classList.remove('run');if(HTO_OPEN)c.style.maxHeight=''},560);
 if(!HTO_OPEN){const top=c.closest('.hto').getBoundingClientRect().top;if(top<0)scrollBy({top:top-20,behavior:'smooth'})}};
/* the day page for today shows the same plan, with what's open from earlier and what's scheduled */
{const _vd=vDay;vDay=function(ds){let o=_vd.apply(this,arguments);const d0=validDate(ds)||ymd();if(d0!==ymd())return o;
 const i=o.indexOf('<section class="rv dy-sec" id="dyG">'),j=i<0?-1:o.indexOf('</section>',i);if(j<0)return o;
 const c=todayCard('day').replace('<section class="hday ud hto rv">','<section class="rv dy-sec hto hto-day" id="dyG">').replace(/<div class="data">Today · [^<]*<\/div>/,'<h3 class="hto-ph">Plan</h3>');
 return o.slice(0,i)+c+o.slice(j+10)};VIEWS.day=vDay}
Object.assign(ACT,{htoAll:()=>{HTO_ALL=!HTO_ALL;render(false)},htoWk:()=>{S.settings.htoWk=!S.settings.htoWk;save();render(false);if(S.settings.htoWk)setTimeout(()=>{try{hsnScroll()}catch(e){}},60)}});
let HSN_GRID=null;
if(typeof homeDay==='function'){HSN_GRID=habitsStrip;homeDay=todayCard;todayGoals=()=>'';habitsStrip=()=>'';}


/* ---------------- Notifications page (#/notifs, 2026-11-04) ----------------
   Coming up: every notification due in the next 7 days, by day, each with Edit (its text and time, in the item's own
   editor), an on/off switch (Off has the same effect as in Reminders, and can be switched back on here) and Delete for
   reminders. History: what this device showed (kept on the device, the latest 300) plus, in the Android app, the phone's
   own log (sent, reminded again, done or replied from the notification). Clear history empties this device's list. */
const NLK='plotline.nlog',nlog=()=>{try{return JSON.parse(localStorage.getItem(NLK)||'[]')}catch(e){return[]}};
{const _n2=notify;notify=function(t,b){const paused=PZ()&&t!=='Focus session complete',r=_n2.apply(this,arguments);
 if(!paused)try{const L=nlog();L.unshift({t:Date.now(),title:String(t||'').slice(0,140),body:String(b||'').slice(0,240),kind:'shown'});localStorage.setItem(NLK,JSON.stringify(L.slice(0,300)))}catch(e){}return r}}
let NTAB='up';const NOFF={};
function ntHist(){const A=nlog(),P=typeof nhist==='function'?nhist('*').filter(e=>e&&e.t).map(e=>({t:+e.t,title:e.title||'',body:(typeof NH_TXT!=='undefined'&&NH_TXT[e.kind]||e.kind||'')+(e.text?' · '+e.text:''),kind:e.kind||'sent',ph:1})):[];
 return[...A,...P].sort((a,b)=>b.t-a.t)}
function ntEdit(r){return r.k==='habit'?`data-act="editHabit" data-id="${r.hid}"`:(r.k==='rem'||r.k==='day')&&r.id?`data-act="editDay" data-id="${r.id}"`:r.k==='step'?`data-act="editStep" data-g="${r.g}" data-s="${r.s}"`:r.k==='checkin'?`data-act="remEdit" data-k="goal" data-id="${r.g}"`:''}
function ntRow(r,off){const[icon,lab]=KIND[r.k]||['bell','Reminder'],w=tWhen(r.at),key=rkey(r),can=!!(off||remOffOf(key)),ed=ntEdit(r),x=(r.k==='rem'||r.k==='day')&&r.id&&S.days.find(y=>y.id===r.id);
 return`<li class="sc-r nt-r${off?' off':''}"><span class="sc-i">${ic(icon)}</span><span class="sd-t"><b>${esc(r.title)}</b><small>${esc(off?'Off':lab+(r.body&&r.k!=='rem'&&r.k!=='day'?' · '+r.body:''))}</small></span><span class="sc-w"><b>${esc(w.time)}</b><small>${esc(w.day)}</small></span>
  <span class="nt-a">${ed&&!off?`<button class="btn sm" ${ed}>Edit</button>`:''}${x&&!off?`<button class="btn sm ghost" data-act="schedOff" data-id="${x.id}">${x.src==='plot'?'Delete':'Remove'}</button>`:''}${r.k==='agent'?`<a class="btn sm ghost" href="#/agent">Open</a>`:''}${can?`<label class="sw nt-sw" title="${off?'Turn back on':'Turn off'}"><input type="checkbox" data-ntoff="${esc(key)}" ${off?'':'checked'} aria-label="${off?'Turn on':'Turn off'} ${esc(r.title)}"><i></i></label>`:''}</span></li>`}
function vNotifs(){const now=Date.now(),R=rows(upcoming(now,7*864e5)),H0=ntHist(),p=PZ();
 const seg=`<div class="seg-c nt-seg" role="tablist">${[['up',`Coming up · ${R.length}`],['hist',`History · ${H0.length}`]].map(([k,n])=>`<button role="tab" aria-selected="${NTAB===k}" class="${NTAB===k?'on':''}" data-act="ntTab" data-v="${k}">${n}</button>`).join('')}</div>`;
 const head=`<header class="ph"><div><h1>Notifications</h1><div class="data">${p?'Paused until '+esc(tWhen(p).day+' '+tWhen(p).time):R.length?`${R.length} in the next 7 days`:'Nothing due in the next 7 days'}</div></div><div class="ph-r"><button class="btn" data-act="remMgr">${ic('tune')}<span>Manage</span></button>${gear()}</div></header>`;
 let body='';
 if(NTAB==='up'){let last='';const off=Object.values(NOFF);
  body=(p?`<div class="panel rm-pz on rv">${ic('bell')}<span><b>Paused until ${esc(tWhen(p).day+' '+tWhen(p).time)}</b><small>Nothing will notify you before then.</small></span><button class="btn sm pri" data-act="remPause" data-m="0">Resume</button></div>`:'')
   +(R.length?`<ul class="sc-l nt-l panel rv">${R.map(r=>{const d=tWhen(r.at).day,h=d!==last?`<li class="sc-d data">${esc(d)}</li>`:'';last=d;return h+ntRow(r)}).join('')}</ul>`:`<p class="muted rv">Nothing is set to notify you in the next 7 days. Turn on a reminder from a habit, goal step or day goal (the bell), or tell your assistant “remind me at 6 to stretch”.</p>`)
   +(off.length?`<div class="st-h rv" style="margin-top:22px"><h3>Turned off here</h3></div><ul class="sc-l nt-l panel rv">${off.map(o=>ntRow(o.r,true)).join('')}</ul>`:'')}
 else{let last='';body=H0.length?`<ul class="sc-l nt-l panel rv">${H0.slice(0,300).map(e=>{const d=tWhen(e.t).day,h=d!==last?`<li class="sc-d data">${esc(d)}</li>`:'';last=d;return h+`<li class="sc-r nt-h"><span class="sc-i">${ic(e.kind==='done'?'check':/^reply/.test(e.kind)?'chat':'bell')}</span><span class="sd-t"><b>${esc(e.title||'Notification')}</b>${e.body?`<small>${esc(e.body)}</small>`:''}</span><span class="sc-w"><b>${esc(tWhen(e.t).time)}</b><small>${e.ph?'Phone':'This device'}</small></span></li>`}).join('')}</ul>${nlog().length?`<div class="actions left rv"><button class="btn ghost sm" data-act="ntClear">${ic('trash')}Clear this device’s history</button></div>`:''}`
  :`<p class="muted rv">No notifications yet. The ones you get show here${NATIVE&&NATIVE.notifLog?'':', with the time and what they said'}.</p>`}
 return head+seg+body}
VIEWS.notifs=vNotifs;
Object.assign(ACT,{ntTab:d=>{NTAB=d.v;render(false)},
 ntClear:()=>askConfirm('Clear notification history?','This empties the list on this device. Coming-up reminders are not touched.','Clear',()=>{const old=localStorage.getItem(NLK);localStorage.removeItem(NLK);render(false);toast('History cleared',()=>{if(old)localStorage.setItem(NLK,old);render(false)})})});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||t.dataset.ntoff==null)return;const key=t.dataset.ntoff;
 if(!t.checked){const o=remOffOf(key),r=remSrcs().find(x=>x.key===key);if(!o||!r){t.checked=true;return}const[x,ch,par]=o,prev={};for(const k in ch)prev[k]=x[k];Object.assign(x,ch);x.u=Date.now();if(par)par.u=Date.now();NOFF[key]={x,prev,par,r};save();sync();render(false);toast(`Turned off “${esc(r.title)}”`)}
 else{const o=NOFF[key];if(!o)return;Object.assign(o.x,o.prev);o.x.u=Date.now();if(o.par)o.par.u=Date.now();delete NOFF[key];save();sync();render(false);toast(`“${esc(o.r.title)}” is back on`)}});


/* ---------------- More ways to check things off by themselves (2026-11-04) ----------------
   The ⚡ sheet on any habit, goal step or day goal now also offers sources the app itself sees, on the web as well as
   on the phone: a focus session finished, a journal entry written, a note added to, a bill marked paid, a calendar
   event over (your own timed day goals, and Google Calendar when it's connected), a code scanned or an NFC tag tapped,
   and "ask me" at a time. Each fires once a day, only on something that really happened (nothing is estimated), says so
   with Undo, and manual check-off keeps working. Steps, workouts, sleep, places and screen time stay with the phone. */
Object.assign(AUTO_T,{
 focus:{n:'Focus session',e:'⏱️',x:'When I finish focus time',kinds:['habit','step','day'],app:1},
 journal:{n:'Journal entry',e:'📓',x:'When I write in my journal',kinds:['habit','step','day'],app:1},
 note:{n:'Note update',e:'📝',x:'When I add to a note',kinds:['habit','step','day'],app:1},
 bill:{n:'Bill paid',e:'🧾',x:'When I mark a bill paid',kinds:['habit','step','day'],app:1},
 event:{n:'Calendar event',e:'📅',x:'When an event with these words is over',kinds:['habit','step','day'],app:1},
 tag:{n:'Code or NFC tag',e:'🏷️',x:'When I scan a code or tap a tag',kinds:['habit','step','day'],app:1},
 ask:{n:'Ask me',e:'💬',x:'At a time, ask whether I did it',kinds:['habit','step','day'],app:1}});
const APP_T=k=>!!(AUTO_T[k]&&AUTO_T[k].app);
{const _g=autoGuess;autoGuess=function(t){const s=String(t||'').toLowerCase();if(/focus|deep work|study|revise|practi[cs]e/.test(s))return'focus';if(/journal|diary|gratitude|reflect|write/.test(s))return'journal';if(/bill|rent|pay /.test(s))return'bill';if(/meeting|class|lecture|appointment/.test(s))return'event';return _g.apply(this,arguments)}}
{const _l=autoLabel;autoLabel=function(a){if(!a||!APP_T(a.type))return _l.apply(this,arguments);const q=a.q?` “${a.q}”`:'';
 return a.type==='focus'?`${a.mins||25} min focus`:a.type==='journal'?'Journal entry'+q:a.type==='note'?(a.note&&TH(a.note)?'Note: '+TH(a.note).title:'Any note update'):a.type==='bill'?'Bill paid'+q:a.type==='event'?'Event over'+q:a.type==='tag'?'Code or tag':a.type==='ask'?'Ask at '+fmtTime(a.at||'21:00'):''}}
/* the phone only gets the rules it can check */
{const _r=autoRules;autoRules=function(){return _r.apply(this,arguments).filter(x=>!APP_T(x.type))}}
const tagCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,'0')).join('');
const tagUrl=c=>(PLOTLINE_CFG.webUrl||location.origin+location.pathname).replace(/#.*$/,'')+'#/tap/'+c;
const canScan=()=>'BarcodeDetector'in window&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
function appFields(t,D,o){const q=(ph,lab)=>`<div class="field"><label>${lab}</label><input type="text" data-au="q" maxlength="60" value="${esc(D.q||'')}" placeholder="${esc(ph)}"></div>`;
 if(t==='focus')return`<div class="field"><label>At least, in a day</label>${auChips('mins',[[10,'10 min'],[15,'15 min'],[25,'25 min'],[45,'45 min'],[60,'1 hour']],D.mins||25)}</div>${AU.k==='step'?`<label class="sw"><span>Only focus on this step<small>Off: any focus session counts</small></span><input type="checkbox" data-au="own" ${D.own?'checked':''}><i></i></label>`:''}<p class="small muted">Counts the focus timer’s finished sessions today.</p>`;
 if(t==='journal')return q('Any entry','Containing these words · optional')+`<p class="small muted">Any journal entry you write today, or only one that mentions these words.</p>`;
 if(t==='note'){const N=threads().filter(x=>x.status!=='done').slice(0,30);return`<div class="field"><label>Which note</label><select data-au="note"><option value="">Any note</option>${N.map(x=>`<option value="${x.id}" ${D.note===x.id?'selected':''}>${esc(trunc(x.title,50))}</option>`).join('')}</select></div><p class="small muted">When you add to it today, here or from the note.</p>`}
 if(t==='bill')return q('Any bill','From · optional (like “rent” or the shop)')+`<p class="small muted">When a bill is marked paid on the Bills page today.</p>`;
 if(t==='event')return q('like gym, class, standup','Event title has')+`<p class="small muted">Your own timed day goals, and Google Calendar events when it’s connected (Agent › Connections). It checks off once the event has ended.</p>`;
 if(t==='tag'){if(!D.code)D.code=tagCode();const u=tagUrl(D.code);return`<div class="field"><label>Its link</label><div class="au-tag"><code>${esc(u)}</code><button type="button" class="btn sm" data-act="auCopy" data-v="${esc(u)}">Copy</button></div></div>
  <p class="small muted">Put this link on an NFC tag (any NFC tag-writing app) or turn it into a QR code, and stick it where you do the thing: the gym bag, the pill box, the desk. Tapping or scanning it opens Plotlines and checks this off. With sync on it reaches all your devices.</p>
  ${canScan()?`<button type="button" class="btn sm" data-act="auScanSet">${ic('camera')}Use a code you already have</button>${D.raw?'<p class="small muted">Linked to a scanned code.</p>':''}`:''}`}
 if(t==='ask')return`<div class="field"><label>Ask at</label><input type="time" data-au="at" value="${esc(D.at||'21:00')}"></div><p class="small muted">At this time, if it isn’t done yet, Plotlines asks “Did you do it?” and checks it off when you say yes. While the app is closed it asks the next time you open it that day.</p>`;
 return''}
{const _ab=autoBody;autoBody=function(){const o=auItem();if(!o)return'';const a=o.auto&&o.auto.type?o.auto:null,D=AU.d||{},t=AU.pick||D.type||'',K=AU.k;
 if(NATIVE&&t&&!APP_T(t))return _ab.apply(this,arguments);
 const types=Object.entries(AUTO_T).filter(([k,v])=>v.kinds.includes(K)&&(NATIVE||v.app)&&!(k==='screen'&&o.kind==='routine'));
 let b=`<div class="au-types">${types.map(([k,v])=>`<button class="au-t${t===k?' on':''}${!a&&k===autoGuess(o.title)?' ai':''}" data-act="autoPick" data-t="${k}"><span>${v.e}</span><b>${v.n}</b><small>${v.x}</small></button>`).join('')}</div>`;
 if(!NATIVE)b+=`<p class="small muted" style="margin-top:10px">Steps, workouts, sleep, places and screen time check things off in the Android app, from the phone’s sensors.</p>`;
 if(!t)return b+`<p class="small muted" style="margin-top:12px">Pick what should check it off. You can still tick it yourself any time.</p>`;
 if(!APP_T(t))return b+`<p class="small muted">${esc(AUTO_T[t]?AUTO_T[t].n:'This')} works in the Android app. Set it up there.</p>`;
 const cur=auDraft();cur.type=t;b+=appFields(t,cur,o);
 b+=`<label class="sw"><span>Tell me when it’s done<small>A note with Undo</small></span><input type="checkbox" data-au="tell" ${cur.tell===false?'':'checked'}><i></i></label>`;
 return b+`<div class="actions">${a?`<button class="btn danger" data-act="autoOff">Turn off</button>`:''}<button class="btn pri" data-act="autoSave">${a?'Save':'Turn on'}</button></div>`}}
Object.assign(ACT,{auCopy:async d=>{try{await navigator.clipboard.writeText(d.v);toast('Link copied')}catch(e){toast('Couldn’t copy. Press and hold the link to copy it.')}},
 auScanSet:()=>scanCode(v=>{const D=auDraft();D.raw=v;autoPaintD();toast('Code linked')}),
 auScan:()=>scanCode(v=>{if(!autoTap(null,v))toast('No item is linked to that code yet')})});
/* scanning with the camera where the browser can (BarcodeDetector); the camera is used only while the scanner is open */
async function scanCode(done){if(!canScan())return toast('This browser can’t scan codes. Use the link on an NFC tag or in a QR code instead.');let st=null,stop=false;
 openSheet(`<div class="data">Scan</div><h2 style="margin-top:6px">Point at the code</h2><video id="auVid" playsinline muted style="width:100%;border-radius:16px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><div class="actions"><button class="btn" data-act="close">Cancel</button></div>`);
 try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('#auVid');if(!v){st.getTracks().forEach(x=>x.stop());return}v.srcObject=st;await v.play();const det=new BarcodeDetector();
  const end=()=>{stop=true;st&&st.getTracks().forEach(x=>x.stop())};const obs=new MutationObserver(()=>{if(!document.getElementById('auVid')){end();obs.disconnect()}});obs.observe(document.body,{childList:true,subtree:true});
  while(!stop){const r=await det.detect(v).catch(()=>[]);if(r&&r[0]&&r[0].rawValue){end();obs.disconnect();closeSheet();const raw=String(r[0].rawValue),m=/#\/tap\/([0-9a-f]{12})/.exec(raw);done(m?'tap:'+m[1]:raw.slice(0,500));return}await new Promise(x=>setTimeout(x,250))}}
 catch(e){st&&st.getTracks().forEach(x=>x.stop());toast('Couldn’t open the camera')}}
/* every item with a rule, with how to check it off */
function autoItems(){const td=ymd(),L=[];
 S.habits.forEach(h=>{if(h.status==='active'&&h.auto&&APP_T(h.auto.type)&&hDue(h,td))L.push({a:h.auto,o:h,title:h.title,done:()=>hDone(h,td),set:on=>{const was=hDone(h,td);hSetVal(h,td,on?hTarget(h):0);if(typeof ckH==='function')ckH(h,td,was)}})});
 S.goals.forEach(g=>{if(g.status!=='active')return;g.steps.forEach(s=>{if(s.auto&&APP_T(s.auto.type))L.push({a:s.auto,o:s,g,title:s.title,done:()=>!!s.done,set:on=>{if(!!s.done!==on)ACT.toggleStep({g:g.id,s:s.id})}})})});
 S.days.forEach(x=>{if(x.auto&&APP_T(x.auto.type)&&x.date===td)L.push({a:x.auto,o:x,title:x.title,done:()=>!!x.done,set:on=>{x.done=on;x.doneAt=on?Date.now():null}})});
 return L}
const fire=(it,why)=>{const td=ymd();it.a.fired=td;it.o.u=Date.now();if(it.g)it.g.u=Date.now();it.set(true);save();render(false);if(it.a.tell!==false)toast(`⚡ ${esc(it.title)} checked off · ${esc(why)}`,()=>{it.set(false);save();render(false)});return true};
const has=(s,q)=>!q||String(s||'').toLowerCase().includes(String(q).toLowerCase().trim());
let CALT=0,CALE=null;
function autoApp(){if(typeof S==='undefined'||!S.habits)return;const td=ymd(),now=Date.now(),day0=new Date(td+'T00:00').getTime();
 const L=autoItems().filter(it=>it.a.fired!==td&&!it.done());if(!L.length)return;
 const ents=S.entries.filter(e=>e.t>=day0);
 if(L.some(it=>it.a.type==='event')&&now-CALT>15*6e4&&window.AGENT&&AGENT.calToday){CALT=now;AGENT.calToday().then(E=>{CALE=E;if(E&&E.length)setTimeout(autoApp,50)}).catch(()=>{})}
 for(const it of L){const a=it.a;
  if(a.type==='focus'){const F=ents.filter(e=>e.type==='focus'&&(!a.own||e.sid===it.o.id)),m=F.reduce((x,e)=>x+(+e.m||+((/(\d+)\s*min/.exec(e.text||'')||[])[1])||0),0);if(m>=(+a.mins||25)&&fire(it,`${m} min of focus today`))return}
  if(a.type==='journal'){const e=ents.find(e=>e.type==='note'&&has((e.title||'')+' '+(e.text||''),a.q)&&String(e.text||e.title||'').trim());if(e&&fire(it,'you wrote in your journal'))return}
  if(a.type==='note'){const N=a.note?[TH(a.note)].filter(Boolean):threads();if(N.some(t=>thrUps(t).some(u=>+u.t>=day0)||(+t.created>=day0&&t.ups.length))&&fire(it,'you added to your note'))return}
  if(a.type==='bill'&&window.BILLS_PAID){const b=BILLS_PAID().find(b=>b.at>=day0&&has(b.m,a.q));if(b&&fire(it,`${b.m||'a bill'} marked paid`))return}
  if(a.type==='event'&&a.q){const own=S.days.find(x=>x.date===td&&x.time&&x!==it.o&&has(x.title,a.q)&&new Date(td+'T'+x.time).getTime()+(+x.dur||30)*6e4<=now);
   const g=(CALE||[]).find(e=>!e.all&&e.end&&has(e.title,a.q)&&Date.parse(e.end)<=now);if((own||g)&&fire(it,`“${(own||g).title}” is over`))return}
  if(a.type==='ask'&&a.asked!==td&&(a.at||'21:00')<=new Date().toTimeString().slice(0,5)&&!$('#sheet').classList.contains('on')){a.asked=td;save();askDid(it);return}}}
function askDid(it){try{notify('Did you do it?',it.title)}catch(e){}
 openSheet(`<div class="data">⚡ Quick check</div><h2 style="margin-top:6px">Did you ${esc(it.title.charAt(0).toLowerCase()+it.title.slice(1))}?</h2><p class="muted">Say yes and it’s checked off for today.</p><div class="actions"><button class="btn" data-act="close">Not yet</button><button class="btn pri" data-act="auYes">Yes, done</button></div>`);
 ACT.auYes=()=>{closeSheet();fire(it,'you said you did')}}
/* a code or tag: from the link (#/tap/<code>) or the scanner */
function autoTap(code,raw){const td=ymd(),k=code?'tap:'+code:raw,it=autoItems().find(x=>x.a.type==='tag'&&('tap:'+x.a.code===k||x.a.raw&&x.a.raw===k));
 if(!it)return false;if(it.done()){toast(`${esc(it.title)} is already done today`);return true}return fire(it,'code scanned')}
window.autoApp=autoApp;
addEventListener('hashchange',()=>{const m=/^#\/tap\/([0-9a-f]{12})$/.exec(location.hash);if(!m)return;history.replaceState(null,'','#/today');go('today');setTimeout(()=>{if(!autoTap(m[1]))toast('No item is linked to that tag on this device yet. With sync on, open the app once so the rule arrives.')},300)});
if(/^#\/tap\//.test(location.hash))setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')),1500);
{const _sv=save;let AT=0;save=function(){const r=_sv.apply(this,arguments);clearTimeout(AT);AT=setTimeout(autoApp,600);return r}}
setInterval(autoApp,30000);setTimeout(autoApp,3000);

window.remFind=()=>remSrcs().map(r=>({t:r.title,s:remSub(r)}));
window.SCHED={make,remind,timer,checkin,fromText,words,occ,upcoming,todayItems};

const css=document.createElement('style');css.textContent=`
.rm-h{display:flex;gap:14px}
.rm-pz{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:10px 0 12px}
.rm-pz.on{padding:10px 12px;gap:10px;flex-wrap:nowrap}.rm-pz.on>span{flex:1;display:flex;flex-direction:column;min-width:0}.rm-pz.on small{color:var(--muted)}
.rm-pzl{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:2px 0 8px}
.rm-q{margin:0 0 6px}
.rm-r{flex-wrap:wrap}.rm-r .sd-t{flex:1;min-width:0}.rm-r .sd-t small{display:block}
.rm-a{display:flex;gap:6px;margin-left:auto}
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
