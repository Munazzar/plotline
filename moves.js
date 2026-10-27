/* ================= Activity in detail (1.55): steps, workouts, sleep and places =================
   The same kind of report as Screen time (screen.js), for what the phone already records each day in the activity
   log: steps by hour (Health Connect's hourly counts, or the phone counter's running totals: hrOf), each workout's
   type, start and length (w: [{k, m, t}]), sleep sessions (ss: [[start, end]]) and minutes at saved places (p:
   {place id: minutes}; the phone keeps how long, not when). Nothing new is read from the phone.
   #/moves/<day>: a Day shows one 24-hour timeline (sleep, workouts, steps, screen time, side by side), then the
   chosen metric; Week, Month and All show that metric per day (per week for long spans) with what stands out. */
(()=>{
'use strict';
const SC=window.SCREEN;if(!SC)return;
const NA=!window.PLOT_DEMO&&window.PlotlineAssist||null;
/* 1.56: steps per hour counted by this phone (StepHours.java), for step apps that give Health Connect only a day total.
   Stored as actLog()[day].hs (24 numbers), which hrOf prefers over evenly spread Health Connect hours. */
const SH={at:0,perm:null};
function stepPull(force){if(!(NA&&NA.stepHours))return;if(!force&&Date.now()-SH.at<60e3)return;SH.at=Date.now();let j=null;try{j=JSON.parse(NA.stepHours(10))}catch(e){return}
 if(!j)return;SH.perm=!!j.perm;let ch=false;const L=actLog();
 const f0=+j.from||0,fd=f0?ymd(new Date(f0)):'',fh=f0?new Date(f0).getHours():0;
 for(const[d,m]of Object.entries(j.days||{})){const a=Array.from({length:24},(_,h)=>Math.round(+m[h]||0)),hf=d===fd?fh:0;const o=L[d]||(L[d]={});if(JSON.stringify(o.hs)!==JSON.stringify(a)||(o.hsFrom||0)!==hf){o.hs=a;o.hsFrom=hf;if(d===fd)o.hsAt=f0;else delete o.hsAt;o.u=Date.now();ch=true}}
 if(fd&&L[fd]&&!L[fd].hs){L[fd].hs=Array(24).fill(0);L[fd].hsFrom=fh;L[fd].hsAt=f0;L[fd].u=Date.now();ch=true}
 if(ch)save()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){stepPull(true);if(cur.p==='moves')setTimeout(()=>render(false),300)}});
if(NATIVE)setTimeout(()=>stepPull(true),5000);
const PAL=SC.PAL,MV={m:'steps',range:'day',ds:''};
const METRICS=[['steps','👟','Steps'],['work','🏋️','Workouts'],['sleep','😴','Sleep'],['places','📍','Places']];
const day=ds=>actLog()[ds]||{};
const hrsSrc=o=>{const hr=(o.hr||[]).map(Number),hs=hr.reduce((a,b)=>a+(b||0),0);return hs>0&&!(window.flatHr&&flatHr(hr))&&hs>=(+o.s||0)*.8?'hc':Array.isArray(o.hs)&&o.hs.some(x=>+x>0)?'phone':'est'};
const hrs=o=>{const h=typeof hrOf==='function'?hrOf(o):window.flatHr&&flatHr(o.hr)?null:o.hr;return Array.isArray(h)&&h.some(x=>x!=null)?h.map(x=>x==null?null:Math.round(+x||0)):null};
const hmax=H=>Math.max(1,...H.filter(x=>x!=null));
const wName=w=>(typeof ACT_EX!=='undefined'&&ACT_EX[w.k])||'Workout',wEm=w=>(typeof ACT_EI!=='undefined'&&ACT_EI[w.k])||'💪';
const goalSteps=()=>+((S.settings.act||{}).goal)||8000,goalSleep=()=>(+((S.settings.act||{}).sleep)||7.5)*60;
const n2=v=>Math.round(v).toLocaleString();
const t0=ds=>new Date(ds+'T00:00').getTime();
/* the sleep that belongs to a day is the one that ended that morning (or any that ended that day) */
const sleepOf=ds=>{const a=t0(ds),b=a+864e5;return(day(ds).ss||[]).filter(([s,e])=>e>a&&e<=b+6*36e5)};
const span=(range,ds)=>{const n=dnum(ds),t=dnum(ymd());if(range==='day')return[n,n];if(range==='week'){const off=(new Date(ds+'T12:00').getDay()+6)%7;return[n-off,Math.min(n-off+6,t)]}
 if(range==='month'){const a=dnum(ds.slice(0,8)+'01'),d=new Date(ds+'T12:00');return[a,Math.min(a+new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1,t)]}
 const ks=Object.keys(actLog()).sort();return[ks.length?dnum(ks[0]):t,t]};
const ttl=(range,a,b)=>{if(range==='day')return dayName(fromN(a));if(range==='all')return'Everything recorded';const f=n=>new Date(fromN(n)+'T12:00');
 return range==='month'?f(a).toLocaleDateString(undefined,{month:'long',year:'numeric'}):`${f(a).toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${f(b).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`};
const dl=(ds,n)=>n<=8?new Date(ds+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'}):(+ds.slice(8)%5===1?+ds.slice(8):'');
const hm=t=>tShort(t);

/* ---------------- one day: everything on a 24-hour line ---------------- */
function lineHTML(ds){const o=day(ds),a=t0(ds),pct=t=>Math.max(0,Math.min(100,(t-a)/864e5*100)),H=hrs(o),sd=SC.dayData(ds),rows=[];
 const blocks=L=>L.map(x=>`<i class="mv-b ${x.c}" style="left:${pct(x.s)}%;width:${Math.max(.6,pct(x.e)-pct(x.s))}%" title="${esc(x.t)}"></i>`).join('');
 const sl=(o.ss||[]).filter(([s,e])=>e>a&&s<a+864e5).map(([s,e])=>({s,e,c:'sl',t:`Asleep ${hm(s)} – ${hm(e)}`}));
 rows.push(['sleep','😴','Sleep',sl.length?blocks(sl):'']);
 const wk=(o.w||[]).filter(w=>w.t).map(w=>({s:w.t,e:w.t+(+w.m||0)*6e4,c:'wk',t:`${wName(w)} ${hm(w.t)} · ${fmtMin(w.m)}`}));
 rows.push(['work','🏋️','Workouts',wk.length?blocks(wk):'']);
 const cells=(v,mx,c)=>v.map((x,h)=>x==null?`<i class="mv-h nr" title="${SC.hName(h)}: not recorded"></i>`:`<i class="mv-h ${c}" style="opacity:${x?.15+.85*Math.min(1,x/mx):.05}" title="${SC.hName(h)}: ${c==='st'?n2(x)+' steps':fmtMin(x)}"></i>`).join('');
 rows.push(['steps','👟','Steps',H?`<div class="mv-hs">${cells(H,hmax(H),'st')}</div>`:+o.s?`<em class="muted small">${n2(o.s)} steps · no hourly detail</em>`:'']);
 if(sd.hrs){const v=sd.hrs.map(m=>Object.values(m).reduce((x,y)=>x+y,0));rows.push(['screen','📱','Screen',`<div class="mv-hs">${cells(v,Math.max(...v,1),'sc')}</div>`])}
 const ax=Array.from({length:9},(_,i)=>`<small style="left:${i*12.5}%">${SC.hLab(i*3%24)}</small>`).join('');
 return`<section class="panel rv mv-line"><div class="sc-cht"><b>Your day</b><small class="muted">Tap a row for detail.</small></div>${rows.map(([k,e,n,body])=>`<button class="mv-r${MV.m===k?' on':''}" data-act="${k==='screen'?'mvScreen':'mvM'}" data-v="${k}"><span class="mv-rl">${e} ${n}</span><span class="mv-tr">${body||'<em class="muted small">nothing recorded</em>'}</span></button>`).join('')}<div class="mv-ax"><span></span><span class="mv-axs">${ax}</span></div></section>`}

/* ---------------- each metric ---------------- */
const G1=(k,c)=>({raw:1,top:[k],col:{[k]:c}});
function stepsHTML(R,A){const g=goalSteps();
 if(R==='day'){const o=day(A[0]),H=hrs(o),s=+o.s||0,mH=H?Math.max(...H.filter(x=>x!=null)):0,peak=H&&mH>0?H.indexOf(mH):-1,act=H?H.filter(x=>x!=null&&x>=250).length:0,nr=H?H.findIndex(x=>x!=null):0;
  return stat([[s?n2(s):'—','steps',s?`${Math.round(s/g*100)}% of ${n2(g)}`:''],...(o.dm!=null?[[(o.dm/1000).toFixed(1)+' km','distance']]:[]),[peak>=0?SC.hName(peak):'—','busiest hour',nr>0?'of the hours counted':''],[H?act+' h':'—','active hours',nr>0?'250+ steps, of the hours counted':'250+ steps']])+
   (H?chart('Steps by hour',(hrsSrc(o)==='phone'?(o.hsAt?`Counted by this phone from ${tShort(o.hsAt)}${nr>0?'; striped hours weren’t recorded':''}. `:'Counted by this phone. '):'')+'Faded = a quiet hour. Tap a bar.',SC.bars(H.map((v,h)=>({m:{steps:v||0},off:v==null,v:h,lab:h%3===0?SC.hLab(h):'',aria:SC.hName(h),sel:MV.h===h})),G1('steps',PAL[4]),{act:'mvH',fade:1,fmt:v=>n2(v)+' steps',axis:v=>v>=1000?(v/1000)+'k':v,h:160,min:200}))+(MV.h>=0&&H?`<p class="small mv-hd"><b>${SC.hName(MV.h)} – ${SC.hName((MV.h+1)%24)}</b> · ${H[MV.h]==null?'not recorded':n2(H[MV.h])+' steps'}</p>`:''):`<p class="small muted rv">${s&&window.flatHr&&flatHr(o.hr)?'Your step app gives Health Connect one total for the whole day (Samsung Health does this), so it can’t say which hours you walked. '+(NA&&NA.stepHours?(SH.perm===false?'Allow “Physical activity” and Plotlines counts steps by hour with this phone from now on.</p><div class="actions left"><button class="btn sm pri" data-act="mvStepPerm">Count steps by hour</button></div><p class="small muted">It reads the phone’s step counter about every 15 minutes. Nothing leaves the phone except to your own Drive if sync is on.':'Plotlines now counts steps by hour with this phone, from when you installed this version: hours fill in as you go.'):'The Android app counts steps by hour with the phone; with sync on they show here too.'):'No steps by hour were recorded for this day.'}</p>`)}
 const D=A.map(ds=>({ds,s:+day(ds).s||0})),v=D.filter(x=>x.s),avg=v.length?v.reduce((a,x)=>a+x.s,0)/v.length:0,best=v.reduce((a,x)=>!a||x.s>a.s?x:a,null),hit=v.filter(x=>x.s>=g).length;
 const typ=Array(24).fill(0),tn=Array(24).fill(0);let hd=0;A.forEach(ds=>{const H=hrs(day(ds));if(H){hd++;H.forEach((x,h)=>{if(x!=null){typ[h]+=x;tn[h]++}})}});
 return stat([[avg?n2(avg):'—','steps a day'],[best?n2(best.s):'—','best day',best?dayName(best.ds):''],[`${hit}/${v.length}`,'days at goal',n2(g)+' steps']])+
  chart(R==='all'&&D.length>62?'Each week':'Each day','The line is your goal. Tap a day.',SC.bars(cols(D,R,x=>({steps:x.s})),G1('steps',PAL[4]),{act:'mvDay',goal:R==='all'&&D.length>62?0:g,fmt:v=>n2(v)+' steps',axis:v=>v>=1000?(v/1000)+'k':v,h:150,min:1000}))+
  (hd?chart('A typical day','Average steps in each hour, over the days it was recorded.',SC.bars(typ.map((x,h)=>({m:{steps:tn[h]?x/tn[h]:0},off:!tn[h],v:h,lab:h%3===0?SC.hLab(h):'',aria:SC.hName(h)})),G1('steps',PAL[4]),{fade:1,fmt:v=>n2(v)+' steps',axis:v=>v>=1000?(v/1000)+'k':v,h:130,min:100})):'')}
function workHTML(R,A){const W=A.flatMap(ds=>(day(ds).w||[]).map(w=>({...w,ds}))),types={};W.forEach(w=>{const n=wName(w);types[n]=(types[n]||0)+(+w.m||0)});
 const T=Object.entries(types).sort((a,b)=>b[1]-a[1]),G={raw:1,top:T.slice(0,8).map(x=>x[0]),col:Object.fromEntries(T.slice(0,8).map((x,i)=>[x[0],PAL[i]]))},tot=W.reduce((a,w)=>a+(+w.m||0),0);
 const list=W.length?`<div class="panel rv mv-list">${W.sort((a,b)=>(b.t||0)-(a.t||0)).slice(0,40).map(w=>`<div class="mv-li"><span class="mv-e">${wEm(w)}</span><span><b>${esc(wName(w))}</b><small>${R==='day'?'':esc(dayName(w.ds))+' · '}${w.t?`${hm(w.t)} – ${hm(w.t+(+w.m||0)*6e4)}`:'time not recorded'}</small></span><b class="mv-v">${fmtMin(w.m)}</b></div>`).join('')}</div>`:`<p class="small muted rv">No workouts recorded${R==='day'?' this day':''}. They come from apps that write to Health Connect, like Samsung Health, Fitbit or Strava.</p>`;
 if(R==='day')return stat([[tot?fmtMin(tot):'—','exercise'],[W.length,'workouts']])+list;
 const leg=T.length?`<div class="sc-leg rv">${G.top.map(k=>`<span class="sc-lg"><i style="background:${G.col[k]}"></i>${esc(k)}</span>`).join('')}</div>`:'';
 const hrsW=Array(24).fill(0);W.forEach(w=>{if(w.t)hrsW[new Date(w.t).getHours()]+=+w.m||0});const when=hrsW.indexOf(Math.max(...hrsW));
 const D=A.map(ds=>{const m={};(day(ds).w||[]).forEach(w=>{const n=wName(w);m[n]=(m[n]||0)+(+w.m||0)});return{ds,m}});
 return stat([[tot?fmtMin(tot/Math.max(1,A.length)*7):'—','a week on average'],[W.length,'workouts'],[T[0]?T[0][0]:'—','most done'],[W.some(w=>w.t)&&hrsW[when]?SC.hName(when):'—','usual start']])+leg+
  (W.length?chart(R==='all'&&D.length>62?'Each week':'Each day','Minutes by type. Tap a day.',SC.bars(cols(D,R,x=>x.m),G,{act:'mvDay',h:150,min:30})):'')+
  (W.some(w=>w.t)?chart('When you work out','Minutes started in each hour.',SC.bars(hrsW.map((x,h)=>({m:{when:x},v:h,lab:h%3===0?SC.hLab(h):'',aria:SC.hName(h)})),G1('when',PAL[0]),{fade:1,h:120,min:30})):'')+list}
function sleepHTML(R,A){const g=goalSleep();
 if(R==='day'){const L=sleepOf(A[0]),tot=L.reduce((a,[s,e])=>a+(e-s)/6e4,0)||+day(A[0]).z||0;
  return stat([[tot?fmtMin(tot):'—','asleep',tot?`${Math.round(tot/g*100)}% of ${fmtMin(g)}`:''],[L[0]?hm(L[0][0]):'—','fell asleep'],[L.length?hm(L[L.length-1][1]):'—','woke up'],[L.length>1?L.length:L.length?'1':'—','sessions']])+
   (L.length?`<div class="panel rv mv-list">${L.map(([s,e])=>`<div class="mv-li"><span class="mv-e">😴</span><span><b>${hm(s)} – ${hm(e)}</b><small>${new Date(s).toLocaleDateString(undefined,{weekday:'short'})} night</small></span><b class="mv-v">${fmtMin((e-s)/6e4)}</b></div>`).join('')}</div>`:`<p class="small muted rv">No sleep recorded for this night. It comes from Health Connect (a watch, Samsung Health, Sleep as Android…).</p>`)}
 /* a schedule chart: each night is a bar from falling asleep to waking, on a 6 PM to noon scale */
 const D=A.map(ds=>({ds,L:sleepOf(ds),z:+day(ds).z||0})),lo=t=>{const d=new Date(t);let h=d.getHours()+d.getMinutes()/60;if(h<12)h+=24;return(h-18)/18*100};
 const v=D.filter(x=>x.L.length),avgM=v.length?v.reduce((a,x)=>a+x.L.reduce((b,[s,e])=>b+(e-s)/6e4,0),0)/v.length:0;
 const clock=xs=>{if(!xs.length)return'—';const m=xs.reduce((a,t)=>{const d=new Date(t);let h=d.getHours()*60+d.getMinutes();if(h<12*60)h+=1440;return a+h},0)/xs.length;return new Date(2000,0,1,0,Math.round(m)%1440).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
 const beds=v.map(x=>x.L[0][0]),wakes=v.map(x=>x.L[x.L.length-1][1]),sd=xs=>{if(xs.length<2)return 0;const m=xs.map(t=>{const d=new Date(t);let h=d.getHours()*60+d.getMinutes();if(h<720)h+=1440;return h}),a=m.reduce((x,y)=>x+y,0)/m.length;return Math.sqrt(m.reduce((x,y)=>x+(y-a)**2,0)/m.length)};
 const spread=Math.round(sd(beds));
 const grid=[18,21,24,27,30,33,36].map(h=>`<i style="top:${(h-18)/18*100}%"><b>${SC.hLab(h%24)}</b></i>`).join('');
 const bars=D.map(x=>`<div class="mv-sc" data-act="mvDay" data-v="${x.ds}" title="${esc(dayName(x.ds))}: ${x.L.length?x.L.map(([s,e])=>hm(s)+'–'+hm(e)).join(', '):'no sleep recorded'}"><div class="mv-sin">${x.L.map(([s,e])=>`<span class="${(e-s)/6e4>=g?'ok':''}" style="top:${lo(s)}%;height:${Math.max(1,lo(e)-lo(s))}%"></span>`).join('')}</div><small>${dl(x.ds,D.length)}</small></div>`).join('');
 return stat([[avgM?fmtMin(avgM):'—','a night on average',`goal ${fmtMin(g)}`],[clock(beds),'usual bedtime'],[clock(wakes),'usual wake-up'],[v.length>1?(spread<=30?'Steady':spread<=60?'Varies':'All over'):'—','bedtime',v.length>1?`± ${spread} min`:'']])+
  (v.length?chart('Your sleep schedule','Each night from falling asleep to waking. Green = met your goal.',`<div class="mv-sch"><div class="mv-sg">${grid}</div><div class="mv-sb${D.length>40?' thin':''}">${bars}</div></div>`):'<p class="small muted rv">No sleep recorded in this span.</p>')}
function placesHTML(R,A){const P=places(),nm=id=>{const p=P.find(x=>x.id===id);return p?`${p.emoji||'📍'} ${p.name}`:'A removed place'},tot={};
 A.forEach(ds=>{for(const[id,m]of Object.entries(day(ds).p||{}))tot[id]=(tot[id]||0)+(+m||0)});const T=Object.entries(tot).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
 const G={raw:1,top:T.slice(0,8).map(x=>x[0]),col:Object.fromEntries(T.slice(0,8).map((x,i)=>[x[0],PAL[i]]))};
 const note=`<p class="small muted rv">How long you were at each saved place, from the phone. It records how long, not when you arrived or left.${P.length?'':' Save places from a habit’s ⚡ (time at a place).'}</p>`;
 const list=T.length?`<div class="panel rv mv-list">${T.map(([id,m])=>`<div class="mv-li"><span class="mv-e" style="color:${G.col[id]||'inherit'}">●</span><span><b>${esc(nm(id))}</b><small>${R==='day'?'':fmtMin(m/Math.max(1,A.length))+' a day on average'}</small></span><b class="mv-v">${fmtMin(m)}</b></div>`).join('')}</div>`:'';
 if(R==='day')return(list||'<p class="small muted rv">No time at saved places this day.</p>')+note;
 const D=A.map(ds=>({ds,m:Object.fromEntries(Object.entries(day(ds).p||{}).map(([k,v])=>[k,+v||0]))}));
 return(T.length?`<div class="sc-leg rv">${G.top.map(k=>`<span class="sc-lg"><i style="background:${G.col[k]}"></i>${esc(nm(k))}</span>`).join('')}</div>`+chart('Each day','Minutes at each place. Tap a day.',SC.bars(cols(D,R,x=>x.m),G,{act:'mvDay',h:150,min:30})):'')+list+note}
function cols(D,R,m){if(R==='all'&&D.length>62){const out=[];for(let i=0;i<D.length;i+=7){const ch=D.slice(i,i+7),s={};ch.forEach(x=>{for(const[k,v]of Object.entries(m(x)))s[k]=(s[k]||0)+v});out.push({m:s,v:ch[0].ds,lab:i%28===0?new Date(ch[0].ds+'T12:00').toLocaleDateString(undefined,{month:'short'}):'',aria:'Week of '+dayName(ch[0].ds)})}return out}
 return D.map(x=>({m:m(x),v:x.ds,lab:dl(x.ds,D.length),aria:dayName(x.ds),sel:x.ds===ymd()}))}
const stat=L=>`<div class="sc-stats rv">${L.map(([b,s,x])=>`<div><b>${esc(String(b))}</b><small>${esc(s)}${x?` · ${esc(x)}`:''}</small></div>`).join('')}</div>`;
const chart=(t,s,body)=>`<section class="panel rv sc-ch"><div class="sc-cht"><b>${t}</b><small class="muted">${s}</small></div>${body}</section>`;

function vMoves(id){if(typeof actLoad==='function')actLoad(false);if(NATIVE)stepPull(false);const ds=/^\d{4}-\d{2}-\d{2}$/.test(id||'')?id:(MV.ds||ymd());MV.ds=ds;const R=MV.range,[a,b]=span(R,ds),A=[];for(let n=a;n<=b;n++)A.push(fromN(n));
 const M=METRICS.find(x=>x[0]===MV.m)||METRICS[0];
 const head=`<header class="ph"><div><h1>Activity in detail</h1><div class="data">${esc(ttl(R,a,b))}</div></div><div class="ph-r">${typeof gear==='function'?gear():''}</div></header>`;
 const tabs=`<div class="sc-top rv"><div class="seg sc-seg" role="tablist">${[['day','Day'],['week','Week'],['month','Month'],['all','All']].map(([k,n])=>`<button role="tab" aria-selected="${R===k}" class="${R===k?'on':''}" data-act="mvRange" data-v="${k}">${n}</button>`).join('')}</div>${R==='all'?'':`<div class="sc-nav"><button class="ibtn sm" data-act="mvMove" data-v="-1" aria-label="Earlier">${ic('back')}</button><button class="ibtn sm" data-act="mvMove" data-v="1" aria-label="Later" ${b>=dnum(ymd())?'disabled':''}>${ic('back','flip')}</button></div>`}</div>`;
 const chips=`<div class="chips mv-ms rv" role="tablist">${METRICS.map(([k,e,n])=>`<button class="chip${MV.m===k?' on':''}" role="tab" aria-selected="${MV.m===k}" data-act="mvM" data-v="${k}">${e} ${n}</button>`).join('')}<button class="chip" data-act="mvScreen">📱 Screen time</button></div>`;
 const body={steps:stepsHTML,work:workHTML,sleep:sleepHTML,places:placesHTML}[M[0]](R,A);
 const none=!Object.keys(actLog()).length?`<div class="panel rv sc-need"><p class="small">${NATIVE?'Turn on activity in the Activity page to fill this in.':'Activity comes from the Plotlines Android app. Open it on your phone with sync on, and it shows up here too.'}</p></div>`:'';
 return head+tabs+none+(R==='day'?lineHTML(A[0]):'')+chips+body}
VIEWS.moves=vMoves;
Object.assign(ACT,{
 mvRange:d=>{MV.range=d.v;MV.h=-1;render(false)},
 mvM:d=>{MV.m=d.v;MV.h=-1;if(cur.p==='moves')render(false);else go('moves')},
 mvMove:d=>{const n=+d.v,ds=MV.ds||ymd();let x;if(MV.range==='day')x=fromN(dnum(ds)+n);else if(MV.range==='week')x=fromN(dnum(ds)+7*n);else{const t=new Date(ds+'T12:00');t.setDate(1);t.setMonth(t.getMonth()+n);x=ymd(t)}if(dnum(x)>dnum(ymd()))x=ymd();MV.ds=x;MV.h=-1;go('moves/'+x)},
 mvDay:d=>{if(!d.v)return;MV.range='day';MV.h=-1;go('moves/'+d.v)},
 mvH:d=>{MV.h=MV.h===+d.v?-1:+d.v;render(false)},
 mvScreen:()=>go('screen/'+(MV.ds||ymd())),
 mvStepPerm:async()=>{try{await ACT.autoPerm({t:'steps'})}catch(e){}SH.at=0;setTimeout(()=>{stepPull(true);render(false)},800)}
});
MV.h=-1;

/* links in: each activity card gets "In detail" (steps, sleep, workouts, places) */
{const _va=VIEWS.activity;if(_va)VIEWS.activity=function(){let h=_va.apply(this,arguments);
 for(const[id,m]of[['steps','steps'],['sleep','sleep'],['work','work'],['places','places']]){const a=h.indexOf(`id="act-${id}"`),e=a<0?-1:h.indexOf('</section>',a);if(e>0)h=h.slice(0,e)+`<button class="btn sm scr-in" data-act="mvM" data-v="${m}">${ic('chart')}In detail</button>`+h.slice(e)}return h}}

/* the assistant reads it too: "when did I work out", "what time did I sleep", "when did I walk the most" */
/* 1.61.0: a Home card with today's steps hour by hour, only hours that were measured (an unmeasured hour shows as not recorded) */
/* 1.62.0: today's steps for the Steps home-screen widget: -1 is an hour nothing measured */
window.stepsWidget=()=>{const o=day(ymd()),H=hrs(o);if(!(+o.s)&&!H)return null;return{d:ymd(),t:Math.round(+o.s||0),g:goalSteps(),h:H?H.map(v=>v==null?-1:v):null}};
window.stepsHome=()=>{const o=day(ymd()),t=+o.s||0,H=hrs(o);if(!t&&!H)return'';const g=goalSteps(),SC=window.SCREEN;let top=-1;(H||[]).forEach((v,h)=>{if(v!=null&&v>0&&(top<0||v>H[top]))top=h});
 const stats=`<div class="sc-stats"><div><b>${n2(t)}</b><small>steps · ${Math.round(t/g*100)}% of ${n2(g)}</small></div>${top>=0?`<div><b>${SC?SC.hName(top):top+":00"}</b><small>most steps · ${n2(H[top])}</small></div>`:''}</div>`;
 const G={top:['s'],col:{s:'#59A14F'},rest:[],raw:1},ch=H&&SC?SC.bars(H.map((v,h)=>({m:v?{s:v}:{},off:v==null,v:h,lab:h%3===0?SC.hLab(h):'',aria:SC.hName(h)})),G,{act:'',h:120,min:100,fmt:v=>n2(v)+' steps',axis:v=>v>=1000?(v/1000)+'k':String(v)}):'';
 return`<section class="rv hstp"><div class="st-h"><h3>Steps</h3><a class="link" href="#/activity">Details</a></div><a class="panel hw" href="#/activity" aria-label="Steps today: ${n2(t)}. Open details">${stats}${ch}${H?'':'<p class="small muted" style="margin:2px 4px 6px">No hour-by-hour steps recorded today.</p>'}</a></section>`};
window.actDetail=ds=>{const o=day(ds),out=[],H=hrs(o);
 if(H){const top=H.map((v,h)=>[h,v]).filter(x=>x[1]!=null&&x[1]>=100).sort((a,b)=>b[1]-a[1]).slice(0,6).sort((a,b)=>a[0]-b[0]);if(top.length)out.push('steps by hour: '+top.map(([h,v])=>`${SC.hName(h)} ${n2(v)}`).join(', '))}
 if((o.w||[]).length)out.push('workouts: '+o.w.map(w=>`${wName(w)}${w.t?' '+hm(w.t)+'–'+hm(w.t+(+w.m||0)*6e4):''} (${fmtMin(w.m)})`).join(', '));
 const L=sleepOf(ds);if(L.length)out.push('sleep: '+L.map(([s,e])=>`asleep ${hm(s)} to ${hm(e)}`).join(', '));
 const P=places(),pl=Object.entries(o.p||{}).filter(x=>+x[1]>0);if(pl.length)out.push('time at places: '+pl.map(([id,m])=>`${(P.find(x=>x.id===id)||{}).name||'a place'} ${fmtMin(m)}`).join(', '));
 return out.length?out.join('; ')+' (Activity in detail shows this as charts)':''};

const css=document.createElement('style');css.textContent=`
.mv-ms{margin:4px 0 12px}
.mv-line{padding:14px 12px 10px;margin-bottom:12px}
.mv-r{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:8px;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:6px 4px;border-radius:10px;cursor:pointer}
.mv-r.on{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.mv-rl{font:600 13px var(--f-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-tr{position:relative;height:20px;border-radius:6px;background:color-mix(in srgb,var(--text) 5%,transparent);overflow:hidden;display:block}
.mv-tr em{position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-style:normal}
.mv-b{position:absolute;top:3px;bottom:3px;border-radius:5px}.mv-b.sl{background:#7B6CF6}.mv-b.wk{background:#F28E2B}
.mv-hs{display:grid;grid-template-columns:repeat(24,1fr);gap:1px;height:100%}.mv-h{display:block}.mv-h.st{background:#59A14F}.mv-h.nr{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--muted) 30%,transparent) 0 3px,transparent 3px 6px)}.mv-h.sc{background:#4E79A7}
.mv-ax{display:grid;grid-template-columns:96px 1fr;gap:8px;padding:2px 4px 0}.mv-axs{position:relative;height:14px}
.mv-axs small{position:absolute;transform:translateX(-50%);font:500 10.5px var(--f-body);color:var(--muted)}.mv-axs small:first-child{transform:none}.mv-axs small:last-child{transform:translateX(-100%)}
.mv-hd{margin:6px 6px 0}
.mv-list{display:flex;flex-direction:column;padding:4px;margin-bottom:12px}
.mv-li{display:flex;align-items:center;gap:12px;padding:10px}.mv-li+.mv-li{border-top:1px solid var(--line)}
.mv-li>span:nth-child(2){display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.mv-li small{color:var(--muted);font-size:12.5px}
.mv-e{font-size:20px;width:26px;text-align:center}.mv-v{font-variant-numeric:tabular-nums}
.sc-c.ok .sc-st{filter:saturate(1.15)}
.mv-sch{position:relative;height:200px;margin:4px 2px 0 38px}
.mv-sg{position:absolute;inset:0 0 18px 0;pointer-events:none}.mv-sg i{position:absolute;left:0;right:0;border-top:1px dashed var(--line)}
.mv-sg b{position:absolute;right:100%;margin-right:6px;transform:translateY(-50%);font:500 10.5px var(--f-body);color:var(--muted)}
.mv-sb{position:absolute;inset:0;display:flex;gap:3px}.mv-sb.thin{gap:1px}
.mv-sc{flex:1;min-width:0;position:relative;cursor:pointer}
.mv-sin{position:absolute;inset:0 0 18px 0}.mv-sc span{position:absolute;left:12%;right:12%;border-radius:4px;background:#7B6CF6}.mv-sc span.ok{background:#59A14F}
.mv-sc small{position:absolute;bottom:0;left:-6px;right:-6px;text-align:center;font:500 10.5px var(--f-body);color:var(--muted)}
`;
document.head.appendChild(css);
})();
