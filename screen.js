/* ================= Screen time, hour by hour (1.54) =================
   Where it comes from: Android's own usage timeline (the one Digital Wellbeing reads), through
   PlotlineAssist.usageHours (android/.../UsageHours.java), once "Usage access" is allowed. Android keeps that timeline
   for about a week, so every read is stored per day in the activity log (actLog()[day].hu = {hour: {package: minutes}},
   .un = {hour: unlocks}) and syncs to the web like the rest of activity. Days from before 1.54 only have the phone's
   daily per-app totals (.a), so they show per day but not per hour.
   The page (#/screen, #/screen/<day>): Day, Week, Month and All. A day is 24 hourly bars stacked by app, faded when
   the hour was light; a week is a day-by-hour heat map plus a bar per day; a month and All show a bar per day (per
   week for All) and "a typical day" by hour. The legend hides and shows apps; an app can be skipped (unavoidable ones
   like Maps or banking: left out of every total), get a daily limit (a nudge when it's passed) or become a habit
   that checks itself off when you stay under it. Settings live in S.settings.act.scx (act.scr is the daily screen-time goal), which syncs. */
(()=>{
'use strict';
const NA=!window.PLOT_DEMO&&window.PlotlineAssist||null;
Object.assign(IC,{scr:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5.5h3"/><path d="M10 12v4M12 10v6M14 13v3"/>'});
const PAL=['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7'],OTHER='#9AA0A6';
const scfg=()=>{const a=S.settings.act||(S.settings.act={}),c=a.scx||(a.scx={});c.skip=c.skip||[];c.hide=c.hide||[];c.lim=c.lim||{};c.lab=c.lab||{};return c};
const lab=k=>k.startsWith('n:')?k.slice(2):scfg().lab[k]||(typeof appName==='function'?appName(k):k.split('.').pop());
const ST={perm:null,at:0,range:'day',hour:-1,only:''};
const hasHours=()=>!!(NA&&NA.usageHours);

/* ---------------- reading the phone ---------------- */
function pull(force){if(!hasHours())return false;if(!force&&Date.now()-ST.at<60e3)return ST.perm;ST.at=Date.now();
 let j=null;try{j=JSON.parse(NA.usageHours(10))}catch(e){return false}
 if(!j||j.err){return false}ST.perm=!!j.perm;if(!j.perm)return false;
 const L=actLog(),c=scfg();Object.assign(c.lab,j.labels||{});
 for(const[d,v]of Object.entries(j.days||{})){const o=L[d]||(L[d]={});o.hu=v.h||{};o.un=v.u||{};o.u=Date.now()}
 save();limitNudge();return true}

/* ---------------- the numbers for a span of days ---------------- */
/* per day: {d, hrs:[{key:min}x24] or null, apps:{key:min}, un:[x24]} with skipped apps left out */
function dayData(ds){const o=actLog()[ds]||{},skip=new Set(scfg().skip),apps={};let hrs=null,un=null;
 if(o.hu&&Object.keys(o.hu).length){hrs=Array.from({length:24},()=>({}));
  for(const[h,m]of Object.entries(o.hu))for(const[k,v]of Object.entries(m||{})){if(skip.has(k))continue;hrs[+h][k]=(hrs[+h][k]||0)+v;apps[k]=(apps[k]||0)+v}
  un=Array.from({length:24},(_,h)=>+(o.un||{})[h]||0)}
 else (o.a||[]).forEach(([n,m])=>{const k='n:'+n;if(!skip.has(k)&&!skip.has(pkOf(n)))apps[k]=(apps[k]||0)+(+m||0)});
 return{d:ds,hrs,apps,un}}
const pkOf=n=>{const L=scfg().lab;for(const k in L)if(L[k]===n)return k;return''};
/* the same app can be a package (hourly days) or a name (older days): fold names into packages we know */
function fold(apps){const o={};for(const[k,v]of Object.entries(apps)){const kk=k.startsWith('n:')&&pkOf(k.slice(2))||k;o[kk]=(o[kk]||0)+v}return o}
function spanOf(range,ds){const n=dnum(ds),t=dnum(ymd());
 if(range==='day')return[n,n];
 if(range==='week'){const d=new Date(ds+'T12:00'),off=(d.getDay()+6)%7;return[n-off,Math.min(n-off+6,t)]}
 if(range==='month'){const a=dnum(ds.slice(0,8)+'01'),d=new Date(ds+'T12:00'),last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return[a,Math.min(a+last-1,t)]}
 const ks=Object.keys(actLog()).filter(k=>{const o=actLog()[k];return o&&(o.hu||o.a)}).sort();return[ks.length?dnum(ks[0]):t,t]}
function agg(a,b){const days=[],apps={},hour=Array.from({length:24},()=>({})),un=Array(24).fill(0);let hd=0;
 for(let n=a;n<=b;n++){const D=dayData(fromN(n));D.apps=fold(D.apps);days.push(D);for(const[k,v]of Object.entries(D.apps))apps[k]=(apps[k]||0)+v;
  if(D.hrs){hd++;D.hrs.forEach((m,h)=>{for(const[k,v]of Object.entries(m))hour[h][k]=(hour[h][k]||0)+v;un[h]+=D.un[h]})}}
 const total=Object.values(apps).reduce((x,y)=>x+y,0),withData=days.filter(d=>Object.keys(d.apps).length).length;
 return{days,apps,hour,un,hd,total,withData}}
/* colours: the 8 biggest apps of the span, the rest are Other */
function legendOf(apps){const ks=Object.entries(apps).sort((x,y)=>y[1]-x[1]).map(x=>x[0]),top=ks.slice(0,8),col={};top.forEach((k,i)=>col[k]=PAL[i]);return{top,col,rest:ks.slice(8)}}
const keyOf=(k,G)=>G.col[k]?k:'other';
const shown=k=>!scfg().hide.includes(k)&&(!ST.only||ST.only===k);
const tot=m=>Object.entries(m).reduce((s,[k,v])=>s+v,0);

/* ---------------- charts ---------------- */
const hLab=h=>h===0?'12a':h===12?'12p':h<12?h+'a':(h-12)+'p';
const hName=h=>new Date(2000,0,1,h).toLocaleTimeString([],{hour:'numeric'});
function stack(m,G){const s={};for(const[k,v]of Object.entries(m)){const kk=keyOf(k,G);if(!G.raw&&!shown(kk))continue;s[kk]=(s[kk]||0)+v}return[...G.top,'other'].filter(k=>s[k]).map(k=>[k,s[k]])}
const colOf=(k,G)=>k==='other'?OTHER:G.col[k];
/* bars of stacked values (minutes unless o.fmt says otherwise), drawn with HTML so labels stay crisp at any width;
   light ones fade (o.fade); o.goal draws a dashed goal line. Activity in detail (moves.js) uses it too. */
function barsSVG(cols,G,o){const sums=cols.map(c=>stack(c.m,G)),mx0=Math.max(o.min||1,o.goal||0,...sums.map(S2=>S2.reduce((a,x)=>a+x[1],0)));
 const F=o.fmt||fmtMin,step=o.fmt?(p=>[1,2,2.5,5,10].map(x=>x*p).find(x=>mx0/x<=4))(Math.pow(10,Math.floor(Math.log10(mx0/4)||0))):mx0>240?120:mx0>120?60:mx0>60?30:mx0>20?10:5,mx=Math.ceil(mx0/step)*step,gl=[];for(let v=step;v<=mx;v+=step)gl.push(v);
 const fl=o.axis||(v=>v>=60?(v%60?(v/60).toFixed(1):v/60)+'h':v+'m');
 const grid=gl.map(v=>`<i class="sc-g" style="bottom:${v/mx*100}%"><b>${fl(v)}</b></i>`).join('')+(o.goal?`<i class="sc-g goal" style="bottom:${o.goal/mx*100}%"></i>`:'');
 const bars=cols.map((c,i)=>{if(c.off)return`<div class="sc-c off na" title="${esc(c.aria)}: not recorded" aria-label="${esc(c.aria)}: not recorded"><div class="sc-st"></div><small>${c.lab||''}</small></div>`;
  const S2=sums[i],t=S2.reduce((a,x)=>a+x[1],0),op=o.fade?Math.max(.3,Math.min(1,t/Math.max(mx0*.5,1))):1;
  return`<div class="sc-c${c.sel?' sel':''}${o.act?'':' na'}${o.goal&&t>=o.goal?' ok':''}"${o.act?` data-act="${o.act}" data-v="${c.v}" role="button" tabindex="0"`:''} aria-label="${esc(c.aria)}: ${t?F(t):'none'}" title="${esc(c.aria)}: ${t?F(t):'none'}"><div class="sc-st" style="height:${t/mx*100}%;opacity:${op}">${S2.map(([k,v])=>`<span style="flex:${v};background:${colOf(k,G)}"></span>`).join('')}</div><small>${c.lab||''}</small></div>`}).join('');
 return`<div class="sc-bw" style="--h:${o.h||150}px"><div class="sc-ax">${grid}</div><div class="sc-bs${cols.length>40?' thin':''}">${bars}</div></div>`}
/* a day-by-hour grid: darker = more minutes in that hour */
function heatSVG(A,G){const rows=A.days,mx=Math.max(1,...rows.flatMap(d=>d.hrs?d.hrs.map(m=>tot(Object.fromEntries(stack(m,G)))):[0])),hd=Array.from({length:24},(_,h)=>`<small>${h%3===0?hLab(h):''}</small>`).join('');
 return`<div class="sc-hg"><span></span>${hd}${rows.map(d=>`<b>${new Date(d.d+'T12:00').toLocaleDateString(undefined,{weekday:'short'})}</b>${Array.from({length:24},(_,h)=>{const v=d.hrs?tot(Object.fromEntries(stack(d.hrs[h],G))):0;
  return`<i class="${d.hrs?'':'na'}" style="opacity:${d.hrs?(v?.18+.82*Math.min(1,v/mx):.07):.04}" data-act="scDay" data-v="${d.d}" title="${esc(dayName(d.d))} ${hName(h)}: ${d.hrs?fmtMin(v):'no hourly data'}"></i>`}).join('')}`).join('')}</div>`}

/* ---------------- the page ---------------- */
const RANGES=[['day','Day'],['week','Week'],['month','Month'],['all','All']];
function title(range,a,b){if(range==='day')return dayName(fromN(a));if(range==='all')return'Everything recorded';
 const f=n=>new Date(fromN(n)+'T12:00');if(range==='month')return f(a).toLocaleDateString(undefined,{month:'long',year:'numeric'});
 return`${f(a).toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${f(b).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`}
function vScreen(id){if(NATIVE)pull(false);const ds=/^\d{4}-\d{2}-\d{2}$/.test(id||'')?id:(ST.ds||ymd());ST.ds=ds;
 const[a,b]=spanOf(ST.range,ds),A=agg(a,b),G=legendOf(A.apps),c=scfg(),R=ST.range;
 const head=`<header class="ph"><div><h1>Screen time</h1><div class="data">${esc(title(R,a,b))}</div></div><div class="ph-r"><button class="ibtn" data-act="scSet" aria-label="Screen time settings" title="Skipped apps and limits">${ic('tune')}</button>${typeof gear==='function'?gear():''}</div></header>`;
 const tabs=`<div class="scr-top rv"><div class="seg sc-seg" role="tablist">${RANGES.map(([k,n])=>`<button role="tab" aria-selected="${R===k}" class="${R===k?'on':''}" data-act="scRange" data-v="${k}">${n}</button>`).join('')}</div>${R==='all'?'':`<div class="sc-nav"><button class="ibtn sm" data-act="scMove" data-v="-1" aria-label="Earlier">${ic('back')}</button><button class="ibtn sm" data-act="scMove" data-v="1" aria-label="Later" ${b>=dnum(ymd())?'disabled':''}>${ic('back','scr-flip')}</button></div>`}</div>`;
 let need='';
 if(NATIVE&&!hasHours())need=`<div class="panel rv sc-need"><p class="small">Update the Plotlines app to see screen time hour by hour. Until then you get each day’s totals.</p></div>`;
 else if(NATIVE&&ST.perm===false)need=`<div class="panel rv sc-need"><h3>See when you use your phone</h3><p class="small">Plotlines can read which apps you used and when, from Android’s own usage data (the same data Digital Wellbeing uses), to draw this report and help with phone habits. It stays on this phone, and in your own Google Drive if you turn on sync. It’s never sent to us or anyone else, and you can turn it off any time in Android’s settings.</p><div class="actions left"><button class="btn pri" data-act="scAllow">Allow usage access</button></div></div>`;
 else if(!NATIVE&&!A.hd&&!A.withData)need=`<div class="panel rv sc-need"><p class="small">Screen time comes from the Plotlines Android app. Open it on your phone with sync on, and it shows up here too.</p></div>`;
 const days=A.withData||1,avg=R==='day'?A.total:A.total/days;
 const busy=A.hd?A.hour.map((m,h)=>[h,tot(m)]).sort((x,y)=>y[1]-x[1])[0]:null,unl=A.un.reduce((x,y)=>x+y,0);
 const prev=(()=>{if(R==='all')return null;const len=b-a+1,P=agg(a-len,a-1);return P.withData?P.total/(R==='day'?1:P.withData):null})();
 const delta=prev?Math.round((avg-prev)/prev*100):null;
 const stats=`<div class="sc-stats rv"><div><b>${A.total?fmtMin(avg):'—'}</b><small>${R==='day'?'screen time':'a day on average'}${delta!=null&&A.total?` · <span class="${delta>0?'up':'dn'}">${delta>0?'+':''}${delta}%</span>`:''}</small></div>${A.hd?`<div><b>${R==='day'?unl:Math.round(unl/Math.max(1,A.hd))}</b><small>unlocks${R==='day'?'':' a day'}</small></div>`:''}${busy&&busy[1]?`<div><b>${hName(busy[0])}</b><small>busiest hour</small></div>`:''}${G.top[0]?`<div><b>${esc(lab(G.top[0]))}</b><small>top app</small></div>`:''}</div>`;
 const legend=G.top.length?`<div class="sc-leg rv" role="group" aria-label="Apps: tap to hide or show">${[...G.top,...(G.rest.length?['other']:[])].map(k=>{const on=!c.hide.includes(k);return`<button class="sc-lg${on?'':' off'}${ST.only===k?' only':''}" data-act="scHide" data-k="${esc(k)}" aria-pressed="${on}"><i style="background:${colOf(k,G)}"></i>${esc(k==='other'?`Other (${G.rest.length})`:lab(k))}</button>`}).join('')}${ST.only?`<button class="link small" data-act="scOnly" data-k="">Show all apps</button>`:''}</div>`:'';
 let charts='';
 if(R==='day'){const D=A.days[0];
  if(D.hrs){charts=`<section class="panel rv sc-ch"><div class="sc-cht"><b>Hour by hour</b><small class="muted">Faded = a light hour. Tap a bar.</small></div>${barsSVG(D.hrs.map((m,h)=>({m,v:h,sel:ST.hour===h,lab:h%3===0?hLab(h):'',aria:hName(h)})),G,{act:'scHour',fade:1,cw:12,gap:3,h:170,min:15})}${hourHTML(D,G)}</section>`}
  else if(A.total)charts=`<p class="small muted rv">Only the day’s totals were recorded${NATIVE?'':' on the phone'} for this day, so there’s no hour-by-hour chart.</p>`}
 else{const cols=R==='all'&&A.days.length>62?weeks(A.days):A.days.map(D=>({m:D.apps,v:D.d,lab:A.days.length<=8?new Date(D.d+'T12:00').toLocaleDateString(undefined,{weekday:'narrow'}):(+D.d.slice(8)%5===1?+D.d.slice(8):''),aria:dayName(D.d),sel:D.d===ymd()}));
  charts=`<section class="panel rv sc-ch"><div class="sc-cht"><b>${R==='all'&&A.days.length>62?'Each week':'Each day'}</b><small class="muted">Tap a ${R==='all'&&A.days.length>62?'week':'day'} to open it.</small></div>${barsSVG(cols,G,{act:'scDay',cw:R==='week'?26:A.days.length>40?6:10,gap:R==='week'?10:3,h:150,min:30})}</section>`;
  if(A.hd){charts+=R==='week'?`<section class="panel rv sc-ch"><div class="sc-cht"><b>When you used your phone</b><small class="muted">Darker = more minutes in that hour.</small></div>${heatSVG(A,G)}</section>`:'';
   charts+=`<section class="panel rv sc-ch"><div class="sc-cht"><b>A typical day</b><small class="muted">Average minutes in each hour, over ${A.hd} day${A.hd===1?'':'s'} with hourly data.</small></div>${barsSVG(A.hour.map((m,h)=>({m:Object.fromEntries(Object.entries(m).map(([k,v])=>[k,v/A.hd])),v:h,lab:h%3===0?hLab(h):'',aria:hName(h)})),G,{act:'',fade:1,cw:12,gap:3,h:140,min:5})}</section>`}}
 const list=Object.keys(A.apps).length?`<section class="rv"><div class="st-h"><h3>Apps</h3>${c.skip.length?`<button class="link" data-act="scSet">${c.skip.length} skipped</button>`:''}</div><div class="panel sc-apps">${Object.entries(A.apps).sort((x,y)=>y[1]-x[1]).slice(0,30).map(([k,v])=>{const L2=c.lim[k],per=R==='day'?v:v/days,over=L2&&per>L2;
   return`<button class="sc-ar" data-act="scApp" data-k="${esc(k)}"><i style="background:${G.col[k]||OTHER}"></i><span><b>${esc(lab(k))}</b><small>${fmtMin(v)}${R==='day'?'':` · ${fmtMin(per)} a day`}${L2?` · limit ${fmtMin(L2)}${over?' · over':''}`:''}</small><em style="--p:${Math.round(v/Math.max(1,A.total)*100)}%;--c:${G.col[k]||OTHER}"></em></span><small class="sc-pc">${Math.round(v/Math.max(1,A.total)*100)}%</small></button>`}).join('')}</div></section>`:'';
 const tips=tipsHTML(A,G,R);
 return head+tabs+need+stats+legend+charts+tips+list+`<p class="small muted rv me-priv">${ic('lock','ico-s')} From Android’s usage data on your phone. Skipped apps aren’t counted anywhere.</p>`}
function weeks(days){const out=[];for(let i=0;i<days.length;i+=7){const ch=days.slice(i,i+7),m={};ch.forEach(D=>{for(const[k,v]of Object.entries(D.apps))m[k]=(m[k]||0)+v});out.push({m,v:ch[0].d,lab:i%28===0?new Date(ch[0].d+'T12:00').toLocaleDateString(undefined,{month:'short'}):'',aria:'Week of '+dayName(ch[0].d)})}return out}
function hourHTML(D,G){const h=ST.hour;if(h<0||!D.hrs)return`<p class="small muted sc-hh">Tap an hour to see which apps.</p>`;
 const L=Object.entries(D.hrs[h]).sort((x,y)=>y[1]-x[1]),t=L.reduce((a,x)=>a+x[1],0);
 return`<div class="sc-hh"><b>${hName(h)} – ${hName((h+1)%24)}</b> · ${t?fmtMin(t):'phone not used'}${D.un[h]?` · ${D.un[h]} unlock${D.un[h]===1?'':'s'}`:''}${L.length?`<ul>${L.map(([k,v])=>`<li><i style="background:${G.col[k]||OTHER}"></i>${esc(lab(k))}<span>${fmtMin(v)}</span></li>`).join('')}</ul>`:''}</div>`}
/* habit help: what stands out, each with one tap to act on it */
function tipsHTML(A,G,R){if(!A.total)return'';const out=[],c=scfg(),days=A.withData||1;
 const late=A.hd?[22,23,0,1,2,3,4].reduce((s,h)=>s+tot(A.hour[h]),0)/A.hd:0;
 if(late>=20)out.push(`<li>📵 ${fmtMin(late)} a night on your phone after 10 PM. <button class="link" data-act="scHabitAll" data-v="late">Make a “phone down by 10” habit</button></li>`);
 const top=G.top[0];if(top){const per=A.apps[top]/days;if(per>=45&&!c.lim[top])out.push(`<li>⏳ ${esc(lab(top))} takes ${fmtMin(per)} a day. <button class="link" data-act="scLim" data-k="${esc(top)}">Set a limit</button> or <button class="link" data-act="scHabit" data-k="${esc(top)}">make it a habit</button></li>`)}
 const goal=+((S.settings.act||{}).scr)||0,avg=A.total/days;if(goal&&avg>goal)out.push(`<li>🎯 ${fmtMin(avg-goal)} over your ${fmtMin(goal)} daily screen-time goal${R==='day'?'':' on average'}.</li>`);
 if(A.hd&&R!=='day'){const un=A.un.reduce((x,y)=>x+y,0)/A.hd;if(un>=60)out.push(`<li>🔓 ${Math.round(un)} unlocks a day. Try leaving the phone in another room for an hour.</li>`)}
 return out.length?`<section class="panel rv sc-tips"><b>Phone habits</b><ul>${out.join('')}</ul></section>`:''}

/* ---------------- limits: a nudge once a day when an app passes its limit ---------------- */
function limitNudge(){const c=scfg(),D=dayData(ymd()),A=fold(D.apps),seen=c.nudged&&c.nudged.d===ymd()?c.nudged.k:[];const hit=[];
 for(const[k,l]of Object.entries(c.lim))if(l&&(A[k]||0)>=l&&!seen.includes(k))hit.push(k);if(!hit.length)return;
 c.nudged={d:ymd(),k:[...seen,...hit]};save();const t=hit.map(k=>`${lab(k)} (${fmtMin(A[k])})`).join(', ');
 if(document.hidden&&typeof notify==='function')notify('Screen time limit',`You’re past your limit on ${t}.`);else toast(`⏳ Past your limit: ${esc(t)}`)}

/* ---------------- sheets ---------------- */
const LIMS=[[0,'No limit'],[15,'15 min'],[30,'30 min'],[45,'45 min'],[60,'1 hour'],[90,'1½ hours'],[120,'2 hours']];
function appSheet(k){const c=scfg(),sk=c.skip.includes(k),hid=c.hide.includes(k);
 openSheet(`<div class="data">Screen time</div><h2 style="margin-top:6px">${esc(lab(k))}</h2>
 <div class="field"><label>Daily limit</label><div class="chips">${LIMS.map(([v,n])=>`<button class="chip${(c.lim[k]||0)===v?' on':''}" data-act="scLimSet" data-k="${esc(k)}" data-v="${v}">${n}</button>`).join('')}</div><small class="muted">A nudge when you pass it while Plotlines is open.</small></div>
 <div class="actions left wrap">${k.startsWith('n:')?'':`<button class="btn" data-act="scHabit" data-k="${esc(k)}">${ic('habit')}Make it a habit</button>`}<button class="btn" data-act="scOnly" data-k="${esc(k)}">Show only this app</button><button class="btn" data-act="scHide" data-k="${esc(k)}">${hid?'Show in charts':'Hide from charts'}</button><button class="btn ${sk?'':'ghost'}" data-act="scSkip" data-k="${esc(k)}">${sk?'Count it again':'Skip: don’t count it'}</button></div>
 <p class="small muted">Skip apps you can’t avoid (Maps, banking, work chat): they’re left out of every total, chart and limit.</p><div class="actions"><button class="btn pri" data-act="close">Done</button></div>`)}
function setSheet(){const c=scfg(),g=+((S.settings.act||{}).scr)||180;
 openSheet(`<div class="data">Screen time</div><h2 style="margin-top:6px">Skipped apps and limits</h2>
 <div class="field"><label>Daily screen-time goal</label><div class="chips">${[[60,'1 h'],[120,'2 h'],[180,'3 h'],[240,'4 h'],[300,'5 h']].map(([v,n])=>`<button class="chip${g===v?' on':''}" data-act="scGoal" data-v="${v}">${n}</button>`).join('')}</div></div>
 <div class="field"><label>Skipped (not counted)</label>${c.skip.length?`<div class="chips">${c.skip.map(k=>`<button class="chip on" data-act="scSkip" data-k="${esc(k)}" aria-label="Count ${esc(lab(k))} again">${esc(lab(k))} ${ic('plus','x45')}</button>`).join('')}</div>`:'<p class="small muted">None. Open an app in the list to skip it.</p>'}</div>
 <div class="field"><label>Limits</label>${Object.keys(c.lim).filter(k=>c.lim[k]).length?`<ul class="sc-ll">${Object.entries(c.lim).filter(x=>x[1]).map(([k,v])=>`<li>${esc(lab(k))}<span>${fmtMin(v)} a day</span><button class="link" data-act="scLimSet" data-k="${esc(k)}" data-v="0">Remove</button></li>`).join('')}</ul>`:'<p class="small muted">None yet.</p>'}</div>
 ${c.hide.length?`<div class="actions left"><button class="btn sm ghost" data-act="scShowAll">Show every app in charts again</button></div>`:''}
 <div class="actions"><button class="btn pri" data-act="close">Done</button></div>`)}
const redraw=()=>{if($('#sheet').classList.contains('on')){const h=$('#sheet h2');if(h&&/Skipped apps/.test(h.textContent))setSheet()}if(cur.p==='screen')render(false)};
/* a habit that checks itself off when the app stays under its limit (the existing screen-time automation) */
function habitFor(k){const l=scfg().lim[k]||60,t=`Under ${fmtMin(l)} on ${lab(k)}`;if(S.habits.some(h=>h.title===t))return toast('You already have that habit');
 S.habits.push(normHabit({id:uid(),kind:'build',title:t,icon:'📵',area:'personal',why:'Less time on my phone',startDate:ymd(),auto:{type:'screen',apps:[k],max:l,at:'21:00',tell:true},u:Date.now()}));save();try{syncNative()}catch(e){}
 closeSheet();toast(`Added “${esc(t)}” · it checks itself off at 9 PM when you stay under`)}

Object.assign(ACT,{
 scRange:d=>{ST.range=d.v;ST.hour=-1;render(false)},
 scMove:d=>{const n=+d.v,ds=ST.ds||ymd();let x;if(ST.range==="day")x=fromN(dnum(ds)+n);else if(ST.range==="week")x=fromN(dnum(ds)+7*n);else{const t=new Date(ds+'T12:00');t.setDate(1);t.setMonth(t.getMonth()+n);x=ymd(t)}
  if(dnum(x)>dnum(ymd()))x=ymd();ST.ds=x;ST.hour=-1;go('screen/'+x)},
 scDay:d=>{if(!d.v)return;ST.range='day';ST.hour=-1;go('screen/'+d.v)},
 scHour:d=>{ST.hour=ST.hour===+d.v?-1:+d.v;render(false)},
 scHide:d=>{const c=scfg(),i=c.hide.indexOf(d.k);if(i>=0)c.hide.splice(i,1);else c.hide.push(d.k);if(ST.only===d.k)ST.only='';save();closeSheet();render(false)},
 scOnly:d=>{ST.only=d.k||'';if(d.k){const c=scfg();c.hide=c.hide.filter(x=>x!==d.k)}closeSheet();render(false)},
 scShowAll:()=>{scfg().hide=[];ST.only='';save();redraw()},
 scApp:d=>appSheet(d.k),
 scSet:()=>setSheet(),
 scSkip:d=>{const c=scfg(),i=c.skip.indexOf(d.k);if(i>=0)c.skip.splice(i,1);else c.skip.push(d.k);save();if($('#sheet h2')&&/Skipped apps/.test($('#sheet h2').textContent))setSheet();else closeSheet();render(false);toast(i>=0?`Counting ${esc(lab(d.k))} again`:`${esc(lab(d.k))} won’t be counted`,()=>{const j=c.skip.indexOf(d.k);if(i>=0)c.skip.push(d.k);else if(j>=0)c.skip.splice(j,1);save();redraw()})},
 scLim:d=>appSheet(d.k),
 scLimSet:d=>{const c=scfg();if(+d.v)c.lim[d.k]=+d.v;else delete c.lim[d.k];save();if($('#sheet h2')&&/Skipped apps/.test($('#sheet h2').textContent))setSheet();else appSheet(d.k);render(false)},
 scGoal:d=>{S.settings.act=S.settings.act||{};S.settings.act.scr=+d.v;save();setSheet();render(false)},
 scHabit:d=>habitFor(d.k),
 scHabitAll:()=>{const t='Phone down by 10 PM';if(S.habits.some(h=>h.title===t))return toast('You already have that habit');S.habits.push(normHabit({id:uid(),kind:'build',title:t,icon:'🌙',area:'health',why:'Better sleep, less scrolling',startDate:ymd(),time:'22:00',remind:true,u:Date.now()}));save();try{syncNative()}catch(e){}toast(`Added “${t}” with a reminder at 10 PM`)},
 scAllow:()=>{try{NATIVE.openUsageAccess()}catch(e){}ST.at=0}
});
VIEWS.screen=vScreen;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&NATIVE){ST.at=0;if(pull(true)&&cur.p==='screen')render(false)}});
if(NATIVE)setTimeout(()=>pull(true),4000);

/* the assistant and the agent read the hours too: "what times did I use my phone yesterday" */
window.scrHours=ds=>{const D=dayData(ds);if(!D.hrs)return'';const parts=[];D.hrs.forEach((m,h)=>{const L=Object.entries(fold(m)).sort((x,y)=>y[1]-x[1]),t=L.reduce((a,x)=>a+x[1],0);if(t>=1)parts.push(`${hName(h)} ${Math.round(t)}m (${L.slice(0,3).map(([k,v])=>`${lab(k)} ${Math.round(v)}m`).join(', ')})`)});
 return parts.length?'screen time by hour (the app shows this as a chart in Screen time): '+parts.join('; '):''};
window.SCREEN={pull,dayData,lab,bars:barsSVG,hName,hLab,PAL};
/* 1.61.0: a Home card with today hour by hour (Customize Home shows, hides and moves it). Nothing recorded today: no card */
window.scrHome=()=>{if(NATIVE)pull(false);const n=dnum(ymd()),A=agg(n,n),D=A.days[0];if(!A.total)return'';const G=legendOf(A.apps),unl=A.un.reduce((x,y)=>x+y,0),P=agg(n-1,n-1);
 const stats=`<div class="sc-stats"><div><b>${fmtMin(A.total)}</b><small>today so far${P.total?` · ${fmtMin(P.total)} yesterday`:''}</small></div>${A.hd?`<div><b>${unl}</b><small>unlocks</small></div>`:''}${G.top[0]?`<div><b>${esc(lab(G.top[0]))}</b><small>top app</small></div>`:''}</div>`;
 const ch=D.hrs?barsSVG(D.hrs.map((m,h)=>({m,v:h,lab:h%3===0?hLab(h):'',aria:hName(h)})),G,{act:'',fade:1,cw:12,gap:3,h:120,min:15}):'';
 return`<section class="rv hscr"><div class="st-h"><h3>Screen time</h3><a class="link" href="#/screen">Details</a></div><a class="panel hw" href="#/screen" aria-label="Screen time today: ${fmtMin(A.total)}. Open details">${stats}${ch}</a></section>`};

/* links in: the Activity page's screen tile and a day's activity */
{const _va=VIEWS.activity;if(_va)VIEWS.activity=function(){const h=_va.apply(this,arguments),a=h.indexOf('id="act-screen"'),e=a<0?-1:h.indexOf('</section>',a);
 return e<0?h:h.slice(0,e)+`<a class="btn sm scr-in" href="#/screen">${ic('scr')}Hour by hour, by app</a>`+h.slice(e)}}

const css=document.createElement('style');css.textContent=`
.scr-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 12px;flex-wrap:wrap}
.sc-seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--surface-2,var(--surface));border:1px solid var(--line)}
.sc-seg button{border:0;background:none;color:var(--muted);font:600 13.5px var(--f-body);padding:7px 14px;border-radius:999px;cursor:pointer}
.sc-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18)}
.sc-nav{display:flex;gap:6px}.scr-flip{transform:scaleX(-1)}
.hw{display:block;padding:12px 12px 6px;color:inherit;text-decoration:none}.hw .sc-stats{margin-bottom:8px;grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}.hw .sc-stats div{padding:9px 12px}.hw .sc-stats b{font-size:18px}.hw .sc-stats small{font-size:12px}
.sc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px}
.sc-stats div{padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;gap:2px;min-width:0}
.sc-stats b{font:800 22px/1.1 var(--f-display);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-stats small{color:var(--muted);font-size:12.5px}
.sc-stats .up{color:var(--danger,#e66)}.sc-stats .dn{color:var(--ok,#3a9)}
.sc-leg{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;align-items:center}
.sc-lg{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:5px 11px;font:500 13px var(--f-body);cursor:pointer}
.sc-lg i{width:10px;height:10px;border-radius:3px;flex:none}.sc-lg.off{opacity:.45;text-decoration:line-through}.sc-lg.off i{background:transparent!important;border:1.5px solid var(--muted)}.sc-lg.only{border-color:var(--accent)}
.sc-ch{padding:14px 12px 8px;margin-bottom:12px}.sc-cht{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 4px 8px;flex-wrap:wrap}.sc-cht small{font-size:12px}
.sc-bw{position:relative;height:var(--h);margin:4px 2px 0 30px}
.sc-ax{position:absolute;inset:0 0 18px 0;pointer-events:none}.sc-g.goal{border-top:1.5px dashed var(--accent);z-index:1}.sc-g{position:absolute;left:0;right:0;border-top:1px dashed var(--line)}.sc-g b{position:absolute;right:100%;margin-right:6px;transform:translateY(-50%);font:500 10.5px var(--f-body);color:var(--muted);white-space:nowrap}
.sc-bs{position:absolute;inset:0;display:flex;gap:3px;align-items:stretch}.sc-bs.thin{gap:1px}
.sc-c{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;outline:none;border-radius:6px}.sc-c.na{cursor:default}
.sc-c:focus-visible{box-shadow:0 0 0 2px var(--accent)}
.sc-st{display:flex;flex-direction:column-reverse;border-radius:4px 4px 2px 2px;overflow:hidden;min-height:0;margin-bottom:18px;transition:opacity .2s}
.sc-st span{display:block;min-height:1px}
.sc-c{position:relative}.sc-c small{position:absolute;bottom:0;left:-6px;right:-6px;text-align:center;font:500 10.5px var(--f-body);color:var(--muted);white-space:nowrap;height:16px}
.sc-c.sel .sc-st{box-shadow:0 0 0 2px var(--text)}.sc-c.off .sc-st{height:100%;opacity:1;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--muted) 22%,transparent) 0 3px,transparent 3px 7px);border-radius:4px}.sc-c.sel small{color:var(--text);font-weight:700}
.sc-hg{display:grid;grid-template-columns:34px repeat(24,1fr);gap:3px;align-items:center}
.sc-hg>small{font:500 10.5px var(--f-body);color:var(--muted);text-align:left;white-space:nowrap;overflow:visible}
.sc-hg>b{font:600 12px var(--f-body);color:var(--muted)}
.sc-hg>i{display:block;aspect-ratio:1;max-height:22px;border-radius:4px;background:var(--accent);cursor:pointer}.sc-hg>i.na{background:var(--muted)}
.sc-hh{margin:10px 4px 6px;font-size:14px}.sc-hh ul{list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px}
.sc-hh li{display:flex;align-items:center;gap:8px}.sc-hh li i{width:10px;height:10px;border-radius:3px}.sc-hh li span{margin-left:auto;color:var(--muted)}
.sc-apps{display:flex;flex-direction:column;padding:4px}
.sc-ar{display:flex;align-items:center;gap:12px;padding:10px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:12px}
.sc-ar+.sc-ar{border-top:1px solid var(--line);border-radius:0}.sc-ar>i{width:12px;height:12px;border-radius:4px;flex:none}
.sc-ar>span{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.sc-ar small{color:var(--muted);font-size:12.5px}
.sc-ar em{display:block;height:4px;border-radius:2px;background:var(--line);position:relative;overflow:hidden}.sc-ar em::after{content:'';position:absolute;inset:0 auto 0 0;width:var(--p);background:var(--c);border-radius:2px}
.sc-pc{font-variant-numeric:tabular-nums}
.sc-tips{padding:14px 16px;margin-bottom:12px}.sc-tips ul{margin:8px 0 0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px;font-size:14px}
.sc-need{padding:16px;margin-bottom:12px}.sc-need h3{margin:0 0 6px}
.sc-ll{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}.sc-ll li{display:flex;gap:10px;align-items:center}.sc-ll li span{color:var(--muted);margin-left:auto}
.scr-in{display:inline-flex;align-items:center;gap:4px;margin-top:8px}.x45{transform:rotate(45deg)}`;
document.head.appendChild(css);
})();
