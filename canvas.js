/* ================= Canvas =================
   Build things with the AI, one step at a time: reports and dashboards from your own data, small apps and tools,
   websites, and designs. You ask in chat or with the mic; the AI writes one self-contained web page and then changes it
   step by step (whole page, or SEARCH/REPLACE edits for small changes). The page runs in a sandboxed frame with no
   access to the app. Your data reaches it only as a read-only snapshot (window.PLOT_DATA), and only when "Use my data"
   is on. An app the AI builds can keep its own things with localStorage: the frame's copy is stored with the canvas.
   Every change is a version you can go back to. Canvases are saved on this device (IndexedDB key "canvases"),
   with rename, reset, delete, full screen, code view (editable) and download as an .html file.
   Works with any AI the app can use, and best with a big model on your own AI server (Ollama, LM Studio).
   1.65: a canvas can also be a part of one of the app's own pages ("parts", near the end). */
(()=>{
'use strict';
const nm=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const clip=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n):s};
const MAXV=40,MAXM=80;
Object.assign(IC,{cvs:'<rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M3 8h18M8 21h8M12 18v3"/><path d="M7.5 12.5l2 1.5-2 1.5M12 15.5h3.5"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
 phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',desk:'<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
 dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',vers:'<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.3 7.2l7.4 3.6"/>'});

/* ---------------- the store ---------------- */
let CS=[],saveT=0;
/* a part that was never kept lasts until the app closes: the ones left from an earlier run are dropped here */
const SESS=uid(),stale=c=>c.slot&&!c.keep&&c.sess!==SESS;
const LOADED=DB.get('canvases').then(v=>{if(Array.isArray(v))CS=[...CS,...v.filter(c=>c&&c.id&&!CS.some(x=>x.id===c.id))].sort((a,b)=>b.t1-a.t1);if(CS.some(stale)){CS=CS.filter(c=>!stale(c));persist()}if(cur.p==='canvas'||SLOTS[cur.p])render(false)}).catch(()=>{});
const persist=quiet=>{clearTimeout(saveT);saveT=setTimeout(()=>{DB.set('canvases',CS).catch(()=>toast('Couldn’t save the canvas on this device'))},300);if(!quiet&&window.syncTouch)syncTouch()};
/* 1.53: canvases sync through your own Drive file: the page, its chat and its saved data; the version history stays on
   each device, and a page that arrives from another device becomes a new version here */
if(window.syncList)syncList('canvases',{load:LOADED,get:()=>CS,set:x=>{CS=x.sort((a,b)=>b.t1-a.t1);persist(1);if(cur.p==='canvas'&&!document.activeElement?.matches('input,textarea'))render(false)},
 out:c=>{const{ver,vi,...r}=c;return r},
 inn:(r,l)=>{const ver=[...(l&&l.ver||[])];if(r.html&&(!ver.length||ver[ver.length-1].html!==r.html)){ver.push({t:r.t1||Date.now(),html:r.html,note:'From your other device',by:'sync'});if(ver.length>MAXV)ver.splice(0,ver.length-MAXV)}return{...r,ver,vi:ver.length-1}}});
const get=id=>CS.find(c=>c.id===id)||null;
function make(title){const c={id:uid(),title:title||'Untitled canvas',named:!!title,t0:Date.now(),t1:Date.now(),html:'',ver:[],msgs:[],store:{},data:true,w:'full'};CS.unshift(c);persist();return c}
const touch=c=>{c.t1=Date.now();CS=[c,...CS.filter(x=>x!==c)];persist()};
/* a new version of the page; the old one stays in the history */
function commit(c,html,note,by){c.html=html;c.ver.push({t:Date.now(),html,note:tr(note||'',140),by:by||'ai'});if(c.ver.length>MAXV)c.ver=c.ver.slice(-MAXV);c.vi=c.ver.length-1;touch(c)}

/* ---------------- your data, as the page sees it ---------------- */
const dayOf=t=>ymd(new Date(t));
function plotData(){const td=ymd(),tn=dnum(td),priv=insSet().priv,from=tn-119;
 const habits=S.habits.filter(h=>h.status!=='archived').map(h=>{const hist=[];
  for(let k=Math.max(from,dnum(h.startDate||td));k<=tn;k++){const ds=fromN(k);let due=false,done=false,v=0;try{due=hCounts(h,ds);done=hDone(h,ds);v=hVal(h,ds)}catch(e){}if(due||v||h.skip[ds])hist.push({date:ds,due,done,value:v,skipped:!!h.skip[ds]})}
  return{id:h.id,title:h.title,icon:h.icon||'',kind:h.kind,area:areaName(h.area),status:h.status,freq:h.freq,timesPerWeek:h.freq==='times'?h.times:null,target:hTarget(h),unit:h.unit||'',time:h.time||'',startDate:h.startDate,
   steps:(h.steps||[]).map(s=>s.title||s.t||''),history:hist,slips:h.kind==='quit'?(h.slips||[]).map(s=>dayOf(s.t||s)):undefined}});
 const goals=S.goals.map(g=>({id:g.id,title:g.title,why:g.why||'',area:areaName(g.area),horizon:g.horizon,priority:g.priority,status:g.status,parent:g.parent||'',startDate:g.startDate,targetDate:g.targetDate||'',
  created:dayOf(g.createdAt||Date.now()),completed:g.completedAt?dayOf(g.completedAt):'',steps:(g.steps||[]).map(s=>({title:s.title,done:!!s.done,doneDate:s.doneAt?dayOf(s.doneAt):'',due:s.due||''}))}));
 const journal=S.entries.filter(e=>e.type==='note'&&(!e.private||priv)).sort((a,b)=>b.t-a.t).slice(0,300).map(e=>({date:dayOf(e.t),time:new Date(e.t).toTimeString().slice(0,5),title:e.title||'',text:clip(e.text||'',800),mood:e.mood?(MOODN[e.mood]||e.mood):''}));
 const plans=S.days.filter(x=>dnum(x.date)>=tn-90&&dnum(x.date)<=tn+60).map(x=>({date:x.date,time:x.time||'',title:x.title,done:!!x.done}));
 const threadsOut=threads().filter(t=>t.status!=='archived').map(t=>({title:t.title,status:t.status||'active',updates:thrUps(t).slice(0,30).map(u=>({date:dayOf(u.t),text:clip(u.x,400)}))}));
 const lists=(S.lists||[]).map(l=>({title:l.title,items:Object.values(l.items||{}).filter(x=>!x.del).map(x=>({text:x.t,done:!!x.done}))}));
 /* 1.65: by the hour too, as measured only: an hour or a day with no record is null ("not recorded"), never a guess */
 const AL=S.settings.actLog||{},activity=[],SC=window.SCREEN,hm=t=>{const d=new Date(t);return isNaN(d)?'':ymd(d)+' '+d.toTimeString().slice(0,5)};
 for(let k=tn-100;k<=tn;k++){const ds=fromN(k),o=AL[ds];if(!o)continue;let st=null,sh=null,un=null,apps=null;
  try{const h=window.hrOf?hrOf(o):null;if(Array.isArray(h))st=h.map(v=>v==null?null:Math.round(+v||0))}catch(e){}
  try{const x=SC&&SC.dayData(ds);if(x&&x.hrs){sh=x.hrs.map(m=>Math.round(Object.values(m).reduce((a,b)=>a+(+b||0),0)));un=x.un}
   if(x&&Object.keys(x.apps).length)apps=Object.entries(x.apps).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,m])=>({app:SC.lab?SC.lab(k):k,minutes:Math.round(m)}))}catch(e){}
  const W=(o.w||[]).filter(Boolean);
  activity.push({date:ds,steps:+o.s||0,stepsByHour:st,sleepMinutes:+o.z||0,sleep:(o.ss||[]).filter(x=>Array.isArray(x)&&x[1]>x[0]).map(([a,b])=>({start:hm(a),end:hm(b)})),
   screenMinutes:o.m==null?null:+o.m,screenByHour:sh,unlocksByHour:un,apps,workouts:W.map(w=>w.k||'workout'),workoutDetails:W.map(w=>({type:w.k||'workout',minutes:+w.m||null,start:w.t?hm(w.t):''}))})}
 return{today:td,name:S.settings.name||'',goals,habits,journal,plans,threads:threadsOut,lists,activity}}
const DATA_SHAPE=`window.PLOT_DATA = {
  today: "YYYY-MM-DD", name: string,
  goals: [{id, title, why, area, horizon: "week"|"month"|"quarter"|"year"|..., priority: 1-3, status: "active"|"done"|..., parent: goal id or "", startDate, targetDate, created, completed, steps: [{title, done, doneDate, due}]}],
  habits: [{id, title, icon, kind: "build"|"quit"|"routine", area, status, freq: "daily"|"days"|"times", timesPerWeek, target, unit, time, startDate, steps: [string],
            history: [{date, due: bool, done: bool, value: number, skipped: bool}] (last 120 days, only days that were due or had a value), slips: [date] (quit habits)}],
  journal: [{date, time: "HH:MM", title, text, mood}] (newest first),
  plans: [{date, time, title, done}] (reminders and goals for a day, last 90 days to 60 days ahead),
  threads: [{title, status, updates: [{date, text}]}],  (these are the user's Notes)
  lists: [{title, items: [{text, done}]}],
  activity: [{date, steps, stepsByHour: [24 numbers, null = not recorded] or null, sleepMinutes, sleep: [{start: "YYYY-MM-DD HH:MM", end}],
             screenMinutes, screenByHour: [24 minutes] or null, unlocksByHour: [24] or null, apps: [{app, minutes}] (top apps that day) or null,
             workouts: [string], workoutDetails: [{type, minutes, start}]}] (last 100 days, only days with a record, may be empty)
}  (dates are "YYYY-MM-DD" strings)`;
function dataNow(){const D=plotData(),hab=D.habits.map(h=>h.title).slice(0,25),gl=D.goals.filter(g=>g.status!=='done').map(g=>g.title).slice(0,20);
 return`Right now: ${D.goals.length} goals${gl.length?' ('+gl.join('; ')+')':''}; ${D.habits.length} habits${hab.length?' ('+hab.join('; ')+')':''}; ${D.journal.length} journal entries; ${D.plans.length} plans; ${D.threads.length} notes; ${D.lists.length} lists; ${D.activity.length} days of phone activity.`}

/* ---------------- the page in its frame ---------------- */
const J=o=>JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
/* 1.66: what the page really shows, measured inside its frame, for any page whatever it is. It runs in the hidden
   check frame (never the one you use): it reports layout problems a person would see (wider than the screen, a
   sideways-scrolling box whose far part is empty, text cut off or on top of other text, grid rows that don't line up,
   text too small, buttons that change nothing when tapped) and a short outline of what's on screen, top to bottom.
   The AI gets this so it can see what it built. Kept to plain ES2017: it's injected as source into the frame. */
function cvsLook(done,tries){
 /* a frame that has no size yet (the app is in the background, say) can't be measured: wait for it, then give up */
 if(!innerWidth||!document.documentElement.clientHeight){if((tries||0)<12)setTimeout(function(){cvsLook(done,(tries||0)+1)},500);else done(null);return}
 var W=innerWidth,P=[],M=[],N=[],R=function(e){return e.getBoundingClientRect()};
 var txt=function(e){return String(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()};
 var nm=function(e){var s=e.tagName.toLowerCase();if(e.id)s+='#'+e.id;else if(e.classList&&e.classList.length)s+='.'+[].slice.call(e.classList,0,2).join('.');var t=txt(e).slice(0,32);return s+(t?' "'+t+(txt(e).length>32?'…':'')+'"':'')};
 var vis=function(e){var r=R(e);if(r.width<1||r.height<1)return false;var c=getComputedStyle(e);return c.visibility!=='hidden'&&c.display!=='none'&&+c.opacity>.05};
 var ALL=[].slice.call(document.body?document.body.querySelectorAll('*'):[]).filter(function(e){return !/^(SCRIPT|STYLE|META|LINK|BR|TEMPLATE|NOSCRIPT|HEAD|TITLE)$/.test(e.tagName)&&!(e.closest&&e.closest('svg')&&e.tagName.toLowerCase()!=='svg')}).slice(0,4000);
 var V=ALL.filter(vis),media=function(e){return /^(CANVAS|SVG|IMG|VIDEO|svg)$/.test(e.tagName)};
 var painted=function(e){var c=getComputedStyle(e);return c.backgroundColor!=='rgba(0, 0, 0, 0)'&&c.backgroundColor!=='transparent'||c.backgroundImage!=='none'||parseFloat(c.borderTopWidth)>0};
 var LEAF=V.filter(function(e){return !media(e)&&![].some.call(e.children,function(k){return vis(k)&&txt(k)})&&txt(e)}).slice(0,600);
 var clipAnc=function(e){for(var p=e.parentElement;p&&p!==document.documentElement;p=p.parentElement){var c=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(c.overflowX+c.overflowY))return p}return null};
 /* wider than the screen */
 var sw=document.documentElement.scrollWidth;
 if(sw>W+2){var out=V.filter(function(e){return R(e).right>W+2&&!clipAnc(e)});var top0=out.filter(function(e){return !out.some(function(o){return o!==e&&o.contains(e)})}),byP=new Map();top0.forEach(function(e){var p=e.parentElement;byP.set(p,(byP.get(p)||[]).concat([e]))});
  var top=[];byP.forEach(function(K,p){if(K.length>=3&&p&&p!==document.body)top.push({n:nm(p).split(' ')[0]+' ('+K.length+' of its items go past the right edge, out to '+Math.round(Math.max.apply(null,K.map(function(k){return R(k).right})))+' px)'});else K.forEach(function(k){top.push({n:nm(k)+' (right edge at '+Math.round(R(k).right)+' px)'})})});top=top.slice(0,3);
  P.push('The page is '+sw+' px wide but the screen is '+W+' px, so the whole page scrolls sideways. Sticking out: '+(top.map(function(x){return x.n}).join('; ')||'something positioned off the right edge'))}
 /* boxes that scroll sideways: is there anything in the part you scroll to? */
 V.forEach(function(e){var c=getComputedStyle(e);if(!/(auto|scroll)/.test(c.overflowX)||e.scrollWidth<=e.clientWidth+4)return;var r=R(e);
  var far=[].slice.call(e.querySelectorAll('*')).filter(function(k){var q=R(k);return q.right>r.right+4&&q.width>0&&q.height>0&&(media(k)||painted(k)||k.children.length===0&&txt(k))});
  if(!far.length)P.push(nm(e)+' scrolls sideways ('+e.scrollWidth+' px of content in a '+e.clientWidth+' px box), but the part you scroll to is empty');
  else N.push(nm(e)+' scrolls sideways: '+e.scrollWidth+' px of content in a '+e.clientWidth+' px box')});
 /* text cut off: by its own box, or by a box around it that hides overflow */
 var cut=[];LEAF.forEach(function(e){if(cut.length>=4)return;var c=getComputedStyle(e);
  if(/(hidden|clip)/.test(c.overflowX)&&e.scrollWidth>e.clientWidth+2){cut.push(nm(e)+' (shows '+e.clientWidth+' of '+e.scrollWidth+' px)');return}
  var a=clipAnc(e);if(!a)return;var ac=getComputedStyle(a);if(/(auto|scroll)/.test(ac.overflowX)&&/(auto|scroll)/.test(ac.overflowY))return;var q=R(e),b=R(a);
  if(!/(auto|scroll)/.test(ac.overflowX)&&(q.right>b.right+3||q.left<b.left-3)||!/(auto|scroll)/.test(ac.overflowY)&&(q.bottom>b.bottom+3||q.top<b.top-3))cut.push(nm(e)+' (cut off by '+nm(a).split(' ')[0]+')')});
 if(cut.length)P.push('Text is cut off: '+cut.join('; '));
 /* text on top of other text */
 var ov=[];for(var i=0;i<LEAF.length&&ov.length<4;i++){var a=R(LEAF[i]);for(var j=i+1;j<LEAF.length&&ov.length<4;j++){var b=R(LEAF[j]),x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  if(x>2&&y>2&&x*y>.3*Math.min(a.width*a.height,b.width*b.height))ov.push(nm(LEAF[i])+' and '+nm(LEAF[j])+' at '+Math.round(b.left)+','+Math.round(b.top))}}
 if(ov.length)P.push('Text overlaps other text: '+ov.join('; '));
 /* grids and rows of items whose rows don't line up */
 V.forEach(function(e){var c=getComputedStyle(e);if(!/grid/.test(c.display)&&!(/flex/.test(c.display)&&/wrap/.test(c.flexWrap)))return;var K=[].filter.call(e.children,vis);if(K.length<8)return;
  var rows=[],key={};K.forEach(function(k){var t=Math.round(R(k).top/3);if(!(t in key)){key[t]=rows.length;rows.push([])}rows[key[t]].push(k)});if(rows.length<2)return;
  var cnt=rows.map(function(r){return r.length}),body=cnt.slice(0,-1),uneven=body.some(function(n){return n!==body[0]});
  var L0=rows[0].map(function(k){return Math.round(R(k).left)}),L1=rows[1].map(function(k){return Math.round(R(k).left)}),n=Math.min(L0.length,L1.length),off=0;for(var q=0;q<n;q++)if(Math.abs(L0[q]-L1[q])>3)off++;
  if(/grid/.test(c.display)&&(uneven||off>n/3))P.push(nm(e).split(' ')[0]+' is a grid whose rows don’t line up: '+rows.length+' rows with '+cnt.slice(0,6).join(', ')+(cnt.length>6?', …':'')+' items'+(off?', and '+off+' of the first '+n+' columns sit at different positions in row 2 than in row 1':''))});
 /* a row of short labels over a row of cells built apart from it (calendars, heat maps, tables): does every cell
    sit under a label? Matched by nearest label, so a week that starts mid-row is fine. */
 var SH=LEAF.filter(function(e){return txt(e).length<=3}),BX=V.filter(function(e){return e.children.length===0&&!txt(e)&&!media(e)&&painted(e)&&R(e).width*R(e).height<6400});
 var rowsOf=function(L){var m={};L.forEach(function(e){var k=Math.round(R(e).top/6);(m[k]=m[k]||[]).push(e)});return Object.keys(m).map(Number).sort(function(x,y){return x-y}).map(function(k){return m[k]}).filter(function(r){return r.length>=5})};
 var cx=function(e){var q=R(e);return(q.left+q.right)/2},LR=rowsOf(SH).filter(function(r){return r.length>=7}),CR=rowsOf(BX.concat(SH)),al=0;
 LR.forEach(function(lr){if(al>=2)return;var y=Math.max.apply(null,lr.map(function(e){return R(e).bottom}));
  var cr=CR.filter(function(r){var t=R(r[0]).top;return r!==lr&&t>=y-2&&t<y+160&&!r.some(function(e){return lr.indexOf(e)>=0})&&r[0].parentElement!==lr[0].parentElement})[0];if(!cr)return;
  var L=lr.map(cx),worst=0,wi=0,wl=0;cr.forEach(function(e,i){var x=cx(e),bi=0;L.forEach(function(v,j){if(Math.abs(v-x)<Math.abs(L[bi]-x))bi=j});var d=Math.abs(L[bi]-x);if(d>worst){worst=d;wi=i;wl=bi}});
  var w=Math.min.apply(null,cr.map(function(e){return R(e).width}));
  if(worst>Math.max(6,w*.5)){al++;P.push('A row of labels doesn’t line up with the row under it: '+lr.length+' labels ('+nm(lr[0].parentElement).split(' ')[0]+') over '+cr.length+' items ('+nm(cr[0].parentElement).split(' ')[0]+'). The item '+(wi+1)+' is centred at '+Math.round(cx(cr[wi]))+' px but the nearest label, “'+txt(lr[wl])+'”, is at '+Math.round(L[wl])+' px. Put the labels and the items in the same grid, or give both exactly the same column widths and gaps.')}});
 /* text too small to read */
 var tiny=LEAF.filter(function(e){return parseFloat(getComputedStyle(e).fontSize)<9}).slice(0,3);if(tiny.length)M.push('Text smaller than 9 px is hard to read: '+tiny.map(nm).join('; '));
 /* the outline: what's on screen, top to bottom */
 var CELL=V.filter(function(e){return e.children.length===0&&!txt(e)&&!media(e)&&painted(e)&&R(e).width*R(e).height<6400});
 var lines=[],bt={};LEAF.concat(V.filter(media),CELL).forEach(function(e){var r=R(e),k=Math.round(r.top/8);(bt[k]=bt[k]||[]).push([r.left,e])});
 Object.keys(bt).map(Number).sort(function(a,b){return a-b}).forEach(function(k){var row=bt[k].sort(function(a,b){return a[0]-b[0]}),parts=[],run=0,cells=0,x0=1e9,x1=0;
  row.forEach(function(x){var e=x[1],r=R(e);x0=Math.min(x0,r.left);x1=Math.max(x1,r.right);if(media(e)){parts.push('['+e.tagName.toLowerCase()+' '+Math.round(r.width)+'×'+Math.round(r.height)+']');return}if(!txt(e)){cells++;return}var t=txt(e);if(t.length<=3)run++;else parts.push((/^(BUTTON|A)$/.test(e.tagName)||e.closest('button')?'[button] ':'')+t.slice(0,40))});
  if(run)parts.push(run+' short labels');if(cells)parts.push(cells+' coloured boxes');if(parts.length)lines.push('y'+(k*8)+' x'+Math.round(x0)+'–'+Math.round(x1)+': '+parts.slice(0,8).join(' | '))});
 var ins=document.querySelectorAll('input,select,textarea').length,btn=document.querySelectorAll('button,[role=button],input[type=button],input[type=submit]').length;
 var outline=lines.slice(0,30).join('\n')+(lines.length>30?'\n… '+(lines.length-30)+' more lines':'')+'\n('+btn+' buttons, '+ins+' inputs, page height '+document.documentElement.scrollHeight+' px)';
 /* tap each button once (in this throwaway frame) and see that something changes */
 var B=V.filter(function(e){return e.matches('button,[role=button],input[type=button],input[type=submit]')&&!e.disabled}).slice(0,8),dead=[],i2=0;
 var snap=function(){return document.body.innerHTML.length+':'+txt(document.body).length+':'+txt(document.body).slice(0,2000)};
 (function next(){if(i2>=B.length){if(dead.length)M.push('Tapping '+(dead.length===1?'this button':'these buttons')+' changed nothing on the page: '+dead.join('; '));done({probs:P,minor:M,notes:N,outline:outline});return}
  var b=B[i2++];if(!b.isConnected)return next();var s=snap();try{b.click()}catch(x){}setTimeout(function(){if(snap()===s)dead.push(nm(b));next()},180)})()}
/* runs first inside the frame: the data, a localStorage that's kept with the canvas, and errors reported back */
function boot(c,data,live,o){return(c.slot?themeCSS():'')+`<script>(function(){['PlotlineNative','PlotlineAssist','PlotTalk'].forEach(function(k){try{delete window[k]}catch(e){}try{if(window[k])window[k]=undefined}catch(e){}})})();window.PLOT_DATA=${data?J(data):'null'};(function(){var S=${J(c.store||{})},live=${live?1:0},send=function(){if(live)try{parent.postMessage({cvs:${J(c.id)},store:S},'*')}catch(e){}};
var L={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(S,k)?String(S[k]):null},setItem:function(k,v){S[String(k)]=String(v);send()},removeItem:function(k){delete S[String(k)];send()},clear:function(){for(var k in S)delete S[k];send()},key:function(i){return Object.keys(S)[i]||null}};
Object.defineProperty(L,'length',{get:function(){return Object.keys(S).length}});try{Object.defineProperty(window,'localStorage',{value:L,configurable:true})}catch(e){}
var E=[],chk=${J(o&&o.chk||'')},post=function(m){try{parent.postMessage(m,'*')}catch(x){}};
/* the check frame is thrown away: dialogs, new windows and form posts would only block or break it */
if(chk){window.alert=function(){};window.confirm=function(){return true};window.prompt=function(){return null};window.open=function(){return null};window.print=function(){};addEventListener('submit',function(e){e.preventDefault()},true)}
var bad=function(m){m=String(m||'Script error');if(E.length<5)E.push(m);if(live)post({cvs:${J(c.id)},err:m})};
window.addEventListener('error',function(e){if(e.target&&e.target!==window&&(e.target.src||e.target.href))bad('Couldn’t load '+(e.target.src||e.target.href));else bad(String(e.message||'Script error')+(e.lineno?' (line '+e.lineno+')':''))},true);
window.addEventListener('unhandledrejection',function(e){bad('Unhandled error: '+String(e.reason&&e.reason.message||e.reason))});
/* a health check once the page has settled: did it throw, and does it show anything? */
${o&&o.part?`if(live){var lh=0,rp=function(){var b=document.body;if(!b)return;var s=getComputedStyle(b),h=Math.ceil(b.getBoundingClientRect().height+parseFloat(s.marginTop)+parseFloat(s.marginBottom));if(Math.abs(h-lh)>1){lh=h;post({cvs:${J(c.id)},h:h})}};document.addEventListener('DOMContentLoaded',rp);window.addEventListener('load',function(){rp();try{new ResizeObserver(rp).observe(document.body)}catch(x){}setTimeout(rp,500)})}`:''}
if(chk)window.addEventListener('load',function(){setTimeout(function(){var b=document.body||document.documentElement,t=(b.innerText||'').trim().length,m=document.querySelectorAll('canvas,svg,img,video,iframe,input,button').length,v=0;
 try{var r=b.getBoundingClientRect();v=r.width*r.height}catch(x){}var fin=function(L){post({cvsChk:chk,errs:E,txt:t,media:m,area:v,look:L})};try{(${cvsLook})(fin)}catch(x){fin(null)}},900)});})();</`+`script>`}
/* 1.50.1: a page that reads your data is kept off the network. It gets PLOT_DATA only if its code uses it, and then
   a Content Security Policy lets it load code, styles and fonts from jsDelivr (and Google Fonts) and nothing else:
   no fetch to other sites, no outside images, no frames, no forms. The app's Android bridges are removed from every
   frame first, so page code can't reach them. */
const LOCK=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; connect-src data: blob: https://cdn.jsdelivr.net; worker-src blob: https://cdn.jsdelivr.net; frame-src 'none'; form-action 'none'; base-uri 'none'">`;
const usesData=h=>/PLOT_DATA/.test(h);
function docOf(c,o={}){const h=o.html!=null?o.html:(c.html||''),withData=!!(c.data&&o.data!==false&&usesData(h)),b=(withData?LOCK:'')+boot(c,withData?(o.D||plotData()):null,!o.file&&!o.chk,o);
 if(/<head[^>]*>/i.test(h))return h.replace(/<head[^>]*>/i,m=>m+b);if(/<html[^>]*>/i.test(h))return h.replace(/<html[^>]*>/i,m=>m+'<head>'+b+'</head>');return'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+b+h}
const SANDBOX='allow-scripts allow-forms allow-modals allow-popups allow-downloads';
let FR_ERR=null;
/* Before saying a version is ready, run it once in a hidden frame and see that it loads, doesn't throw, and shows something. */
const CHK=new Map();
function check(c,html){return new Promise(res=>{const id=uid(),f=document.createElement('iframe');let done=false;
 const end=r=>{if(done)return;done=true;CHK.delete(id);clearTimeout(t);f.remove();res(r)};
 CHK.set(id,d=>end({errs:d.errs||[],blank:!d.txt&&!d.media,ok:true,look:d.look&&typeof d.look==='object'?d.look:null}));const t=setTimeout(()=>end({errs:[],blank:false,ok:false,slow:true,look:null}),14000);
 f.setAttribute('sandbox',SANDBOX);f.setAttribute('aria-hidden','true');f.tabIndex=-1;f.style.cssText='position:fixed;left:-10000px;top:0;width:390px;height:700px;border:0;opacity:0;pointer-events:none';
 f.srcdoc=docOf(c,{html,chk:id});document.body.appendChild(f)})}
addEventListener('message',e=>{const d=e.data;if(d&&d.cvsChk&&CHK.has(d.cvsChk)){CHK.get(d.cvsChk)(d);return}if(!d||!d.cvs)return;const fr=[...document.querySelectorAll('iframe.cvs-fr')].find(f=>f.contentWindow===e.source);if(!fr||fr.dataset.id!==d.cvs)return;const c=get(d.cvs);if(!c)return;
 if(d.store&&typeof d.store==='object'){c.store=d.store;persist()}
 if(fr.classList.contains('upt-fr')){ptMsg(fr,c,d);return}
 if(d.err){FR_ERR={id:c.id,v:c.vi,x:tr(d.err,200)};errPaint()}});

/* ---------------- talking to the AI ---------------- */
const SYS=c=>`You are ${nm()}'s AI canvas inside the Plotlines app. You build and change one web page at a time together with the user: reports and dashboards from their own data, small apps and tools, websites, and designs like posters, cards or slides. Work step by step: do what they ask now, keep everything else as it is, and end with one short line suggesting a next step when it helps.

HOW TO ANSWER
Give the code first, then end with one or two short sentences saying what changed, in plain words (the app checks the page runs before showing them). The code is either:
A) the whole page, in one block:
\`\`\`html
<!doctype html>
...
\`\`\`
B) or, when a page already exists and the change is small, only the changes, as one or more blocks exactly like this:
<<<<<<< SEARCH
(lines copied exactly from the current page)
=======
(the new lines)
>>>>>>> REPLACE
The SEARCH part must match the current page character for character and be unique. If you are not sure, send the whole page.
If the user only asks a question or wants ideas, just answer, with no code.
Prefer the whole page. Use SEARCH/REPLACE only for a small change of text, colour or a value; anything about layout or behaviour gets the whole page.
You can't see the page yourself, so after you send it the app runs it on a phone-sized screen and, when something looks wrong, sends you a report of what is really on screen. Fix exactly what it reports.

THE PAGE
- One self-contained HTML file with inline <style> and <script>. It is shown in a frame that can be phone-sized or full width, so make it responsive. Make it polished and modern: generous spacing, clear type (system-ui font), a calm palette, rounded cards, and both light and dark (prefers-color-scheme).
- Libraries only from https://cdn.jsdelivr.net/npm/ with an exact version, for example charts: https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js. Prefer plain JS, CSS and inline SVG.
- No other network requests, and no forms that send anywhere. For images use inline SVG, CSS shapes or emoji.
- An app can remember things (its items, settings, scores) with localStorage; it is kept with the canvas.
${c.data?`
THE USER'S DATA
Only when they ask for something built from their data (a report, chart, summary, tracker...): window.PLOT_DATA is already set on the page before your script runs. Read it in your script and compute everything from it. Never type their numbers, names or entries into the page by hand, so the page stays right as their data changes. A page that reads PLOT_DATA is kept offline to protect their data: only libraries from cdn.jsdelivr.net (and Google Fonts) load, and fetch, outside images, iframes and forms are blocked, so don't use them there. Handle empty arrays gracefully.
${DATA_SHAPE}
${dataNow()}`:`
The user turned off "Use my data" for this canvas: window.PLOT_DATA is null. Don't build from their Plotlines data.`}
${c.slot?partSys(c):''}
${window.AIX?AIX.safety():''}`;
/* earlier turns, without their code: the current page is always sent in full instead */
function history(c){return c.msgs.filter(m=>!m.err&&m.st!=='retry'&&m.st!=='stop').slice(-8).map(m=>({role:m.r==='u'?'user':'assistant',content:m.r==='u'?m.x:(m.x||'(updated the page)')+(m.v!=null?'\n(page updated)':'')}))}
/* 1.66: "start over" really starts over: no page and no chat, just what they've asked for so far. A request to fix
   something gets the whole page back, never a patch on a broken layout. The last check's report rides along, so the AI
   knows what the page looks like now. */
const FRESH=/\b(start(ing)? (it |this |all )?(over|fresh|again|anew|from scratch)|from scratch|begin again|redo (it|this|everything|the whole)|rebuild (it|this|everything)|scrap (it|this|that)|throw (it|this) away|completely new)\b/i;
const FIXY=/\b(fix|broken|break|bug|wrong|layout|align|overlap|cut off|scroll|messed|worse|ugly|doesn'?t work|does not work|not working|doesn'?t show|not show|nothing (shows|happens))/i;
const isFresh=(c,q)=>!!c.html&&FRESH.test(q);
function lookOf(c){const v=c.ver[c.vi??c.ver.length-1];return v&&v.html===c.html&&v.look||''}
function userMsg(c,q){if(isFresh(c,q)){const A=c.msgs.filter(m=>m.r==='u'&&m.x!==q).slice(-10).map(m=>'- '+tr(m.x,400)).join('\n');
  return`The user wants to START OVER. Ignore any earlier page and build a brand-new one from scratch, as one whole page in a \`\`\`html block.${A?`\nWhat they have asked for in this canvas so far, oldest first:\n${A}`:''}\n\nLATEST REQUEST: ${q}`}
 const n=c.ver.length,lk=c.html&&lookOf(c);
 return(c.html?`CURRENT PAGE (version ${n}):\n\`\`\`html\n${c.html}\n\`\`\`\n\n`:'There is no page yet.\n\n')+(lk?`HOW IT LOOKS NOW (automatic check on a 390 px wide screen):\n${lk}\n\n`:'')+'REQUEST: '+q+(c.html&&FIXY.test(q)?'\n\nSend the whole updated page as one ```html block, not SEARCH/REPLACE edits.':'')}
/* the check's findings, in words */
const probList=H=>[...(H.errs||[]).map(e=>'JavaScript error: '+e),...(H.blank?['The page shows nothing at all.']:[]),...(H.look?H.look.probs:[])];
const needFix=H=>probList(H).length>0;
const badness=H=>(H.errs||[]).length*10+(H.blank?10:0)+(H.look?H.look.probs.length*3+H.look.minor.length:0);
const lookTxt=H=>{if(!H||!H.look)return'';const P=probList(H),Mi=H.look.minor;return(P.length?'Problems:\n'+P.map(x=>'- '+x).join('\n')+'\n':'No layout problems found.\n')+(Mi.length?Mi.map(x=>'- '+x).join('\n')+'\n':'')+'On screen, top to bottom (y = px from the top, x = left–right extent):\n'+H.look.outline};
function fixMsg(c,html,H,q){return`CURRENT PAGE:\n\`\`\`html\n${html}\n\`\`\`\n\nWHAT THE USER ASKED FOR: ${q}\n\nAN AUTOMATIC CHECK ran this page on a phone-sized screen (390 px wide) and found what a person would see:\n${lookTxt(H)||probList(H).map(x=>'- '+x).join('\n')}\n\nFix every problem and keep everything the user asked for. Find the cause first (for example a header row built apart from the rows under it, widths that add up to more than the screen, a fixed size that is too small for its text, or content placed outside its box). Send the whole corrected page as one \`\`\`html block, then one short line saying what you fixed.`}

/* reading the answer */
const unthink=s=>String(s||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'');
const EDIT_RX=/<{5,9} ?SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9} ?REPLACE[^\n]*/g;
function parse(raw){const s=unthink(raw);let html='',edits=[];
 const blocks=[...s.matchAll(/```[ \t]*(html|htm)?[^\n]*\n([\s\S]*?)(?:```|$)/gi)].map(m=>m[2]).filter(b=>/<[a-z!]/i.test(b)&&!/<{5,9} ?SEARCH/.test(b));
 if(blocks.length)html=blocks.sort((a,b)=>b.length-a.length)[0].trim();
 else{const i=s.search(/<!doctype html|<html[\s>]/i);if(i>=0)html=s.slice(i).trim()}
 for(const m of s.matchAll(EDIT_RX))edits.push([m[1],m[2]]);
 let note=s.replace(EDIT_RX,'').replace(/```[\s\S]*?(```|$)/g,'');const k=note.search(/<!doctype html|<html[\s>]/i);if(k>=0)note=note.slice(0,k);
 return{html:edits.length&&!/<!doctype|<html[\s>]/i.test(html)?'':html,edits,note:note.replace(/\n{3,}/g,'\n\n').trim()}}
/* small changes: exact text first, then the same lines ignoring indentation and trailing spaces */
function applyEdits(src,edits){let out=src;for(const[a,b]of edits){if(!a.trim()){out+='\n'+b;continue}
  const i=out.indexOf(a);if(i>=0){out=out.slice(0,i)+b+out.slice(i+a.length);continue}
  const L=out.split('\n'),A=a.split('\n').map(x=>x.trim()),n=A.length;let at=-1;
  for(let j=0;j+n<=L.length&&at<0;j++){let ok=true;for(let k=0;k<n;k++)if(L[j+k].trim()!==A[k]){ok=false;break}if(ok)at=j}
  if(at<0)return null;L.splice(at,n,...b.split('\n'));out=L.join('\n')}return out}
/* while it streams: what it's saying, and how far into the page it is */
function live(raw){const s=unthink(raw),i=s.search(/```|<{5,9} ?SEARCH|<!doctype html|<html[\s>]/i),code=i>=0?s.slice(i):'';
 return{note:(i>=0?s.slice(0,i):s).trim(),lines:code?code.split('\n').length:0,edit:/<{5,9} ?SEARCH/.test(code),thinking:/<think>(?![\s\S]*<\/think>)/.test(raw)}}

/* One answer, kept alive through dropped connections. Long pages from a big model can take many minutes, and a phone,
   a tunnel or a proxy may cut the stream partway (Chrome then says just "network error"). When that happens after
   some of the answer has arrived, ask the model to carry on from the exact point it stopped and join the pieces,
   up to 4 times. A drop before anything arrived is tried once more. */
const CONT='Your last reply was cut off by a dropped connection. Continue it from exactly the last character you sent: no repeats, no preamble, no new code fence, just the rest.';
const MORE='Your last reply stopped before it was finished. Continue it from exactly the last character you sent: no repeats, no preamble, no new code fence, just the rest, and close any open code block.';
async function stream(msgs,ctl,more){let tries=0,cold=0;
 for(;;){const base=RUN.out;let got='';RUN.think='';
  const ask=base?[...msgs,{role:'assistant',content:base},{role:'user',content:more?MORE:CONT}]:msgs;
  try{await AIX.chat(ask,t=>{if(RUN&&RUN.ctl===ctl){got+=t;RUN.out=base?join(base,got):got;livePaint()}},{max_tokens:planEngine()==='api'?16000:3000,temperature:.35,ctl,think:insSet().cthink==='off'?'off':'on',reading:'Reading the canvas…',onThink:t=>{if(RUN&&RUN.ctl===ctl){RUN.think+=t;livePaint()}}});return}
  catch(e){if(ctl.signal.aborted||planEngine()!=='api'||!/network|fetch|load|reset|abort|terminated|stream/i.test(String(e&&e.message||e)))throw e;
   if(RUN.out){if(++tries>4)throw e}else if(++cold>1)throw e;
   RUN.drops=(RUN.drops||0)+1;livePaint();await new Promise(r=>setTimeout(r,1500))}}}
/* the continuation may repeat the end of what came before, or reopen the code block: drop the overlap */
function join(a,b){let x=b.replace(/^\s*```[a-z]*[ \t]*\n/i,m=>/```[a-z]*[ \t]*\n?[^`]*$/i.test(a.slice(-4000))&&!/```\s*$/.test(a)?'':m);
 const tail=a.slice(-600);for(let n=Math.min(tail.length,x.length);n>=12;n--)if(tail.endsWith(x.slice(0,n)))return a+x.slice(n);return a+x}
/* what went wrong, in words: never reached the server, or the connection dropped while it was writing */
function netErr(e,R){const m=String(e&&e.message||e),secs=R?Math.round((Date.now()-R.t)/1e3):0,dur=secs>=90?Math.round(secs/60)+' min':secs+' s';
 if(planEngine()!=='api'||!/network|fetch|load|reset|terminated|stream/i.test(m))return m;
 if(R&&(R.out||R.think||/network error/i.test(m)))return`The connection to your AI server dropped after ${dur}${R.out?`, ${R.out.split('\n').length} lines in`:''}, and it didn’t come back. The server answered, so the address and CORS are fine. Something between the phone and the server cut the long answer: the phone sleeping or leaving the app, switching networks, or a tunnel or proxy time limit. Try again with the app open and the screen on, or ask for the change in smaller steps.`;
 return m+' · Couldn’t reach your AI server. Check the address, that it’s running, and that it allows this app (CORS).'}
/* keep the screen on while it writes: a sleeping phone drops the connection */
let WL=null;
async function wake(on){try{if(on){if(!WL&&navigator.wakeLock)WL=await navigator.wakeLock.request('screen')}else if(WL){const w=WL;WL=null;await w.release()}}catch(e){WL=null}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&RUN)wake(true)});

let RUN=null;
/* pick a dropped or cut-off answer up where it stopped */
function resume(c,m){const part=m.part;delete m.part;touch(c);return send(c,m.q,{retry:userMsg(c,m.q),part})}
/* is the answer unfinished? a code block that never closed, a page without its end, or an edit block missing its end */
function cutOff(raw){const s=unthink(raw),fences=(s.match(/```/g)||[]).length,lastS=s.lastIndexOf('<<<<<<<'),lastR=s.lastIndexOf('>>>>>>>');
 return fences%2===1||/<!doctype html|<html[\s>]/i.test(s)&&!/<\/html>/i.test(s)||lastS>lastR}
const CLAIM=/\b(i'?ve|i have|i)\s+(created|built|made|added|updated|changed|redesigned|rewrote|rebuilt|fixed|improved|moved|removed|replaced|applied)\b|\b(here'?s|here is) (the|your) (updated|new)\b|\bdone\b/i;
const say=(c,m)=>{c.msgs.push({id:uid(),t:Date.now(),r:'a',...m});touch(c)};
async function send(c,q,o={}){if(RUN)return toast('Still working on the last one');if(!window.AIX||!AIX.ready())return toast('Set up the AI first in Settings › AI & voice');
 const last=c.msgs[c.msgs.length-1];if(!o.retry&&last&&last.part&&/^\s*(continue|go on|keep going|carry on|resume|finish( it)?)\W*$/i.test(q)){c.msgs.push({id:uid(),r:'u',x:q,t:Date.now()});return resume(c,last)}
 const blk=AIX.block(q);if(blk){c.msgs.push({id:uid(),r:'u',x:q,t:Date.now()});say(c,{x:blk});return logPaint()}
 if(!o.retry)c.msgs.push({id:uid(),r:'u',x:q,t:Date.now()});if(c.msgs.length>MAXM)c.msgs=c.msgs.slice(-MAXM);
 if(!c.named&&!c.html&&c.msgs.filter(m=>m.r==='u').length===1)c.title=tr(q,48);
 const gen=c.gen=(c.gen||0)+1,live_=()=>CS.includes(c)&&c.gen===gen;/* deleted or reset meanwhile: drop the result quietly */
 const ctl=new AbortController();RUN={id:c.id,ctl,out:o.part||'',t:Date.now(),phase:'ask'};touch(c);if(TAB==='code')TAB='view';paint();
 const msgs=[{role:'system',content:SYS(c)},...(isFresh(c,q)?[]:history(c).slice(0,o.retry?undefined:-1)),{role:'user',content:o.retry?o.retry:userMsg(c,q)}];
 let err='',cuts=0;wake(true);
 try{await stream(msgs,ctl);
  /* ran out of room mid-page (max tokens or context): ask it to finish, twice at most */
  while(!ctl.signal.aborted&&RUN&&RUN.out&&cutOff(RUN.out)&&cuts<2){cuts++;RUN.more=cuts;livePaint();await stream(msgs,ctl,true)}}
 catch(e){if(!ctl.signal.aborted)err=netErr(e,RUN)}
 finally{wake(false)}
 const R=RUN||{},raw=R.out||'';
 if(!live_()){RUN=null;return}
 const done=x=>{RUN=null;say(c,x);paint()};
 if(err)return done({x:err,err:1,...(raw.trim()?{part:raw,q}:{})});
 if(ctl.signal.aborted)return done({x:raw.trim()?'Stopped. The page wasn’t changed.':'Stopped before the AI wrote anything. The page wasn’t changed.',st:'stop',...(raw.trim()?{part:raw,q}:{})});
 if(!raw.trim())return done(R.think?{x:'The AI spent its whole answer thinking and didn’t write anything, so the page wasn’t changed. Try again, or turn Thinking off.',err:1}:{x:'The AI sent back an empty answer, so the page wasn’t changed. Try again.',err:1});
 if(cutOff(raw))return done({x:`The AI’s answer was cut off before the page was finished${(raw.match(/\n/g)||[]).length>20?` (about ${raw.split('\n').length} lines in)`:''}, so the page wasn’t changed. This usually means the model ran out of room: ask for the change in smaller steps, or give your server a bigger context.`,err:1,part:raw,q});
 const P=parse(raw);let html=P.html,note=P.note;
 if(!html&&P.edits.length){html=applyEdits(c.html||'',P.edits);
  if(html==null){/* the edit didn't line up with the page: ask once for the whole page instead */
   if(!o.retry){RUN=null;say(c,{x:'The change didn’t line up with the page, so the AI is writing the whole page again.',st:'retry'});
    return send(c,q,{retry:userMsg(c,q)+'\n\nSend the whole updated page as one ```html block.'})}
   return done({x:'The AI’s change didn’t fit the page, even on a second try, so nothing was changed. Try asking in smaller steps.',err:1})}}
 if(!html){/* a plain answer: fine for a question, but say so when it reads as if it changed something */
  const care=window.AIX&&AIX.care?AIX.care(q,note):'';const claims=CLAIM.test(note)&&!/\?\s*$/.test(note);
  return done({x:(note||tr(unthink(raw),2000))+(care?'\n\n'+care:''),st:claims?'none':''})}
 if(html===c.html)return done({x:note||'',st:'same'});
 /* a new version: run it once before calling it ready */
 /* 1.66: run it on a phone-sized screen. While the check finds problems a person would see, show the AI what is
    really on screen and let it repair them, twice at most; the best try is the one kept. */
 RUN.phase='check';livePaint();let H=await check(c,html),best={html,H},rounds=0;
 while(live_()&&!ctl.signal.aborted&&RUN&&needFix(best.H)&&rounds<2){rounds++;Object.assign(RUN,{phase:'fix',round:rounds,probs:probList(best.H).length,out:'',think:'',more:0});livePaint();
  const fm=[{role:'system',content:SYS(c)},{role:'user',content:fixMsg(c,best.html,best.H,q)}];
  try{await stream(fm,ctl);if(RUN&&RUN.out&&cutOff(RUN.out)&&!ctl.signal.aborted)await stream(fm,ctl,true)}catch(e){break}
  if(!live_()||ctl.signal.aborted||!RUN||!RUN.out||cutOff(RUN.out))break;
  const P2=parse(RUN.out),h2=P2.html||(P2.edits.length?applyEdits(best.html,P2.edits):null);if(!h2||h2===best.html)continue;
  RUN.phase='check';livePaint();const H2=await check(c,h2);if(badness(H2)<badness(best.H))best={html:h2,H:H2}}
 if(!live_()){RUN=null;return}
 html=best.html;H=best.H;
 commit(c,html,note||q);FR_ERR=null;const v=c.vi;c.ver[v].look=lookTxt(H);const left=(H.look?H.look.probs:[]);
 const m={x:note||'',v,fixed:rounds,looked:!!H.look,st:H.errs.length?'err':H.blank?'blank':left.length?'warn':H.slow?'slow':'ok',...(H.errs.length?{chk:tr(H.errs[0],200)}:left.length?{chk:left.slice(0,4).map(x=>tr(x,240)).join('\n')}:{})};
 if(m.st==='err')FR_ERR={id:c.id,v,x:m.chk};
 done(m);if(m.st!=='err'&&TAB==='chat'&&!wide()){TAB='view';paint()}
 if(cur.p!=='canvas'||cur.id!==c.id)toast(m.st==='ok'?`“${esc(tr(c.title,40))}” is ready`:`“${esc(tr(c.title,40))}” needs a look`)}

/* ---------------- the pages ---------------- */
let TAB='chat',FULL=false;
const wide=()=>matchMedia('(min-width:900px)').matches;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<2?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString([],{month:'short',day:'numeric'})};
const IDEAS=[['A report on my habits this month','report'],['A dashboard of my goals and their steps','report'],['My moods and journal over time, as charts','report'],['A focus timer app with a task list','app'],['A landing page for my side project','site'],['A poster of my goals for this year','design']];
const KIND_IC={report:'ai',app:'checklist',site:'ext',design:'pen'};
function engineHint(){if(!window.AIX||!AIX.ready())return`<div class="panel rv cvs-setup">${window.AIX?AIX.modelCard('canvas'):''}<p class="small muted">AI canvas needs an AI. It works best with a big model on your own AI server: pick “Your AI server” in Settings › AI &amp; voice and point it at Ollama or LM Studio.</p><div class="actions left"><a class="btn sm" href="#/settings">Open settings</a></div></div>`;
 return planEngine()==='api'?'':`<p class="small muted cvs-hint">${ic('ai','ico-s')} You’re on a small on-device model, so pages will be simple. For real apps and reports, use a big model on your own AI server (Settings › AI &amp; voice › Your AI server).</p>`}
function vList(){return`<header class="ph"><div><h1>AI canvas</h1><div class="data">${CS.length?`${CS.length} saved`:`Build reports, apps, sites and designs with ${esc(nm())}`}</div></div><div class="ph-r"><button class="ibtn" data-act="cvsNew" aria-label="New canvas" title="New canvas">${ic('plus')}</button>${gear()}</div></header>
 ${engineHint()}
 <form class="cvs-start rv" data-form="cvsStart" autocomplete="off"><div class="field"><textarea id="cvsFirst" name="q" rows="3" maxlength="4000" placeholder="What should we build? “A report of my habits this month”, “a budget app”, “a website for my bakery”…" aria-label="What should we build?"></textarea></div><div class="actions left"><button class="btn pri">${ic('ai')}Start building</button></div></form>
 <div class="cvs-ideas rv">${IDEAS.map(([t,k])=>`<button class="cvs-idea" data-act="cvsIdea" data-q="${esc(t)}">${ic(KIND_IC[k],'ico-s')}<span>${esc(t)}</span></button>`).join('')}</div>
 ${ptList()}${CS.some(c=>!c.slot)?`<h4 class="cv-g cvs-gh">Your canvases<button class="link" data-act="cvsDelAll">Delete all</button></h4><div class="cvs-grid rv">${CS.filter(c=>!c.slot).map(c=>`<button class="cvs-card" data-act="cvsOpen" data-id="${c.id}"><span class="cvs-thumb">${c.html?ic('cvs'):ic('ai')}</span><span class="cvs-cb"><b>${esc(c.title)}</b><small>${c.ver.length?`${c.ver.length} version${c.ver.length===1?'':'s'}`:'Nothing built yet'} · ${ago(c.t1)}</small></span>${RUN&&RUN.id===c.id?'<i class="cvs-dot" title="Working"></i>':''}</button>`).join('')}</div>`:''}
 <p class="small muted me-priv">${ic('lock','ico-s')} Canvases are kept on this device and, with sync on, in your own Google Drive. Pages run in a closed box: they can read a snapshot of your data when you allow it, and can’t change anything in the app.${planEngine()==='api'?' Your requests and the page go to the AI server you picked.':''}</p>`}
const md_=x=>window.AIX&&AIX.md?AIX.md(x):esc(x);
function stHTML(c,m){const V=`Version ${(m.v??0)+1}`,ok=c.ver[m.v];switch(m.st){
 case'ok':return`<p class="cvs-s ok">${ic('check','ico-s')}${V} is ready${m.fixed?` · the check found problems and the AI fixed them`:m.looked?` · checked on a phone-sized screen`:''}</p>`;
 case'warn':return`<p class="cvs-s warn">${ic('flag','ico-s')}${V} is saved, but the check still sees ${m.chk.split('\n').length===1?'a problem':'problems'}${m.fixed?` after ${m.fixed} ${m.fixed===1?'try':'tries'} to fix ${m.chk.split('\n').length===1?'it':'them'}`:''}:</p><ul class="cvs-pl">${m.chk.split('\n').map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${ok?`<div class="cvs-sa"><button class="btn sm" data-act="cvsFixMsg" data-id="${c.id}" data-k="warn" data-x="${esc(m.chk)}">Try again</button>${m.v>0?`<button class="btn sm ghost" data-act="cvsVer" data-id="${c.id}" data-v="${m.v-1}">Go back to version ${m.v}</button>`:''}</div>`:''}`;
 case'slow':return`<p class="cvs-s ok">${ic('check','ico-s')}${V} is saved. It was still loading when checked, so look it over.</p>`;
 case'blank':return`<p class="cvs-s warn">${ic('flag','ico-s')}${V} is saved, but the page shows nothing.</p>${ok?`<div class="cvs-sa"><button class="btn sm" data-act="cvsFixMsg" data-id="${c.id}" data-k="blank">Fix it</button>${m.v>0?`<button class="btn sm ghost" data-act="cvsVer" data-id="${c.id}" data-v="${m.v-1}">Go back to version ${m.v}</button>`:''}</div>`:''}`;
 case'err':return`<p class="cvs-s warn">${ic('flag','ico-s')}${V} is saved, but it hits an error when it runs: ${esc(m.chk||'')}</p>${ok?`<div class="cvs-sa"><button class="btn sm" data-act="cvsFixMsg" data-id="${c.id}" data-k="err" data-x="${esc(m.chk||'')}">Fix it</button>${m.v>0?`<button class="btn sm ghost" data-act="cvsVer" data-id="${c.id}" data-v="${m.v-1}">Go back to version ${m.v}</button>`:''}</div>`:''}`;
 case'same':return`<p class="cvs-s">${ic('x','ico-s')}The AI’s answer left the page exactly as it was, so there’s no new version.</p>`;
 case'none':return`<p class="cvs-s warn">${ic('flag','ico-s')}The AI described a change but didn’t send any code, so the page wasn’t changed. Ask again, or say “send the whole page”.</p>`;
 case'stop':case'retry':return'';}return''}
function msgHTML(c,m){if(m.r==='u')return`<div class="cv-q"><p>${esc(m.x).replace(/\n/g,'<br>')}</p></div>`;
 const head=m.v!=null||m.st==='same'||m.st==='none'?stHTML(c,m):'';
 return`<div class="cv-a${m.err?' cvs-err':''}${m.st==='retry'||m.st==='stop'?' cvs-sys':''}"><span class="cv-av" aria-hidden="true"></span><div>${m.err?`<p class="small err">${esc(m.x)}</p>`:`${head}${m.x?`<div class="ai-md">${md_(m.x)}</div>`:''}${m.v==null?'':''}`}
 ${m.part&&c.msgs[c.msgs.length-1]===m?`<button class="btn sm pri cvs-res" data-act="cvsResume" data-id="${c.id}" data-m="${m.id}">${ic('play')}Continue where it stopped</button>`:''}${m.v!=null&&c.ver[m.v]?`<button class="cvs-vtag" data-act="cvsVer" data-id="${c.id}" data-v="${m.v}">${ic('cvs','ico-s')}Version ${m.v+1}${c.vi===m.v?' · showing':''}</button>`:''}${m.st==='ok'&&m.v===c.vi&&!wide()?`<button class="cvs-vtag" data-act="cvsTab" data-k="view">${ic('eye','ico-s')}See it</button>`:''}</div></div>`}
function runHTML(){if(!RUN)return'';const L=live(RUN.out),secs=Math.round((Date.now()-RUN.t)/1e3),t=secs>=60?Math.floor(secs/60)+'m '+(secs%60)+'s':secs+'s';
 const st=RUN.phase==='check'?'Checking how it looks on a phone-sized screen…':RUN.phase==='fix'?(L.lines?`Fixing ${RUN.probs} problem${RUN.probs===1?'':'s'} the check found (try ${RUN.round} of 2) · ${L.lines} lines`:`The check found ${RUN.probs} problem${RUN.probs===1?'':'s'}, so the AI is fixing ${RUN.probs===1?'it':'them'} (try ${RUN.round} of 2)${L.thinking||RUN.think?' · thinking':''}`):RUN.more?`The answer was cut short, asking the AI to finish it (${RUN.more} of 2)… · ${L.lines} lines`
  :L.lines?(L.edit?`Writing the change · ${L.lines} lines`:`Writing the page · ${L.lines} lines`):L.thinking||RUN.think&&!RUN.out?'Thinking':RUN.out?'Writing its answer':secs>4?'Waiting for the AI':'Sending your request';
 return`<div class="cv-a cvs-run" id="cvsRun"><span class="cv-av" aria-hidden="true"></span><div><p class="cvs-st"><i></i><span>${RUN.drops?`Reconnected ${RUN.drops===1?'once':RUN.drops+' times'} · `:''}${st} · ${t}</span></p><p class="small muted cvs-st2">Nothing changes on the page until it’s finished and checked.</p></div></div>`}
function logHTML(c){const L=c.msgs.map(m=>msgHTML(c,m)).join('')+runHTML();
 return L||(c.slot?ptEmpty(c):'')||`<div class="cvs-empty"><span class="cvs-orb"></span><p><b>Tell ${esc(nm())} what to build.</b></p><p class="small muted">Then keep going one step at a time: “make the chart weekly”, “add a dark mode”, “put my streaks at the top”.</p></div>`}
function frameHTML(c){if(!c.html)return`<div class="cvs-blank">${RUN&&RUN.id===c.id?`<span class="cvs-orb"></span><p class="muted">Building…</p>`:`${ic('cvs')}<p class="muted">The page shows up here.</p>`}</div>`;
 return`<div class="cvs-fw ${c.w==='phone'?'ph':''}${c.slot?' upt-pv':''}"><iframe class="cvs-fr" data-id="${c.id}" sandbox="${SANDBOX}" title="${esc(c.title)}" referrerpolicy="no-referrer"></iframe></div>`}
function errHTML(c){return FR_ERR&&FR_ERR.id===c.id&&FR_ERR.v===c.vi?`<div class="cvs-ferr"><span>${ic('flag','ico-s')}The page hit an error: ${esc(FR_ERR.x)}</span><button class="btn sm" data-act="cvsFix" data-id="${c.id}">Fix it</button></div>`:''}
function vEdit(id){const c=get(id);if(!c)return`<header class="ph"><div><a class="link" href="#/canvas">${ic('back','ico-s')} AI canvas</a><h1>Not found</h1></div></header><p class="muted">This canvas was deleted or is on another device.</p>`;
 const n=c.ver.length,busy=RUN&&RUN.id===c.id;
 return`<div class="cvs" data-tab="${TAB}" id="cvs" data-id="${c.id}">
 <div class="crumb cvs-top"><a href="#/canvas" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a><button class="cvs-ti" data-act="cvsRename" data-id="${c.id}" title="Rename"><b>${esc(c.title)}</b><small id="cvsVl">${n?`Version ${(c.vi??n-1)+1} of ${n}`:c.slot?'New part':'New canvas'}</small></button>
 <div class="ph-r"><button class="ibtn" data-act="cvsUndo" data-id="${c.id}" aria-label="Back one version" title="Back one version" ${n>1&&(c.vi??n-1)>0&&!busy?'':'disabled'}>${ic('undo')}</button><button class="ibtn" data-act="cvsMore" data-id="${c.id}" aria-label="More">${ic('more')}</button></div></div>
 ${ptBar(c)}<div class="cvs-tabs" role="tablist">${[['chat','Chat','chat'],['view','Canvas','cvs'],['code','Code','code']].map(([k,t,i])=>`<button role="tab" class="${TAB===k?'on':''}" aria-selected="${TAB===k}" data-act="cvsTab" data-k="${k}">${ic(i,'ico-s')}${t}</button>`).join('')}</div>
 <div class="cvs-body">
  <section class="cvs-chat${window.AIX&&AIX.ready()?'':' noai'}"><div class="cvs-log" id="cvsLog">${logHTML(c)}</div>${engineHint()}
   <form class="cvs-in" data-form="cvsSend" data-id="${c.id}" autocomplete="off"><textarea id="cvsIn" name="q" rows="1" maxlength="6000" placeholder="${c.html?'What should change?':'What should we build?'}" aria-label="Message"></textarea>
   ${busy?`<button type="button" class="btn sm cvs-go" data-act="cvsStop" aria-label="Stop">${ic('stop')}</button>`:`<button class="btn pri sm cvs-go" aria-label="Send">${ic('send')}</button>`}</form>
   <div class="cvs-opts"><label class="cvs-data"><input type="checkbox" data-cvsdata="${c.id}" ${c.data?'checked':''}><span>Use my data</span><small>goals, habits, journal, plans, notes, lists</small></label>
   ${planEngine()==='api'?`<button type="button" class="cvs-think${insSet().cthink!=='off'?' on':''}" data-act="cvsThink" title="Thinking while building: on makes better pages and takes longer. Chat and voice aren’t affected.">${ic('ai','ico-s')}Thinking: ${insSet().cthink==='off'?'Off':'On'}</button>`:''}</div></section>
  <section class="cvs-view"><div class="cvs-bar"><div class="seg-s">${[['full','desk','Full width'],['phone','phone','Phone size']].map(([k,i,t])=>`<button class="ibtn sm ${(c.w||'full')===k?'on':''}" data-act="cvsW" data-id="${c.id}" data-w="${k}" aria-label="${t}" title="${t}">${ic(i)}</button>`).join('')}</div>
   <span class="cvs-sp"></span><button class="ibtn sm" data-act="cvsReload" data-id="${c.id}" aria-label="Run again" title="Run again" ${c.html?'':'disabled'}>${ic('reset')}</button><button class="ibtn sm" data-act="cvsFull" data-id="${c.id}" aria-label="Full screen" title="Full screen" ${c.html?'':'disabled'}>${ic('full')}</button></div>
   <div id="cvsErr">${errHTML(c)}</div><div class="cvs-stage" id="cvsStage">${frameHTML(c)}</div></section>
  <section class="cvs-code"><p class="small muted">The page’s code. Edit it by hand if you like; applying it makes a new version.</p><textarea id="cvsCode" spellcheck="false" autocapitalize="off" aria-label="Page code">${esc(c.html||'')}</textarea>
   <div class="actions left"><button class="btn sm pri" data-act="cvsCodeSave" data-id="${c.id}">Apply my edits</button><button class="btn sm" data-act="cvsCopy" data-id="${c.id}">${ic('copy')}Copy</button></div></section>
 </div></div>${FULL?`<div class="cvs-full${c.slot?' upt-pv':''}" id="cvsFull"><button class="ibtn cvs-fx" data-act="cvsFullX" aria-label="Close full screen">${ic('unfull')}</button><iframe class="cvs-fr" data-id="${c.id}" sandbox="${SANDBOX}" title="${esc(c.title)}"></iframe></div>`:''}`}
function vCanvas(id){if(id)return vEdit(id);if(TAB==='code')TAB='chat';FULL=false;return vList()}
VIEWS.canvas=vCanvas;
VOICE_SEL.push('#cvsIn','#cvsFirst');

/* targeted repaints: a full render reloads the frame, which would reset an app the user is trying out */
function fillFrames(){const c=cur.p==='canvas'&&get(cur.id);if(!c)return;document.querySelectorAll('iframe.cvs-fr').forEach(f=>{const k=c.id+':'+(c.vi??'')+':'+c.html.length;if(f.dataset.k===k)return;f.dataset.k=k;f.srcdoc=docOf(c)})}
function logPaint(stick){const el=$('#cvsLog'),c=get(cur.id);if(!el||!c)return;const near=stick||el.scrollHeight-el.scrollTop-el.clientHeight<120;el.innerHTML=logHTML(c);if(near)el.scrollTop=el.querySelector('.cvs-empty')?0:el.scrollHeight}
let lpT=0;function livePaint(){if(lpT)return;lpT=setTimeout(()=>{lpT=0;const r=$('#cvsRun');if(!r||!RUN)return logPaint();const L=$('#cvsLog'),near=L.scrollHeight-L.scrollTop-L.clientHeight<120;r.outerHTML=runHTML();if(near)L.scrollTop=L.scrollHeight},160)}
function errPaint(){const e=$('#cvsErr'),c=get(cur.id);if(e&&c)e.innerHTML=errHTML(c)}
function paint(){if(cur.p!=='canvas')return;const inp=$('#cvsIn'),keep=inp&&inp.value,foc=document.activeElement===inp;render(false);const n=$('#cvsIn');if(n&&keep){n.value=keep;grow(n)}if(n&&foc)n.focus();logPaint(true)}
const grow=t=>{t.style.height='auto';t.style.height=Math.min(180,t.scrollHeight)+'px'};
{const _r=render;render=function(){const x=_r.apply(this,arguments);if(cur.p==='canvas'&&cur.id){fillFrames();const L=$('#cvsLog');if(L)L.scrollTop=L.querySelector('.cvs-empty')?0:L.scrollHeight}return x}}
document.addEventListener('input',e=>{if(e.target.id==='cvsIn')grow(e.target)});
document.addEventListener('keydown',e=>{if(e.target.id==='cvsIn'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&wide()){e.preventDefault();e.target.form.requestSubmit()}
 if(e.key==='Escape'&&FULL){FULL=false;paint()}});
document.addEventListener('change',e=>{const id=e.target.dataset&&e.target.dataset.cvsdata;if(!id)return;const c=get(id);if(!c)return;c.data=e.target.checked;touch(c);const f=document.querySelectorAll('iframe.cvs-fr');f.forEach(x=>x.dataset.k='');fillFrames();toast(c.data?'The page can read your data':'The page no longer gets your data')});
setInterval(()=>{if(RUN&&cur.p==='canvas'&&cur.id===RUN.id)livePaint()},1000);

/* On a phone the keyboard covers the bottom of the screen: while typing, hide the tab bar and fit the chat (and its box)
   into what's really visible, so the box sits right on top of the keyboard. */
function fitChat(){const ch=$('.cvs-chat'),vv=window.visualViewport,on=document.documentElement.classList.contains('cvs-typing');if(!ch)return;
 if(!on||!vv||wide()){ch.style.height='';return}const top=ch.getBoundingClientRect().top,h=Math.round(vv.offsetTop+vv.height-top-8);
 ch.style.height=Math.max(150,h)+'px';const L=$('#cvsLog');if(L)L.scrollTop=L.scrollHeight}
document.addEventListener('focusin',e=>{if(e.target.id!=='cvsIn'||wide())return;document.documentElement.classList.add('cvs-typing');
 /* bring the top of the chat into view first, then size it once the keyboard is up */
 setTimeout(()=>{const ch=$('.cvs-chat');if(ch){const y=ch.getBoundingClientRect().top;if(y<0||y>innerHeight*.5)window.scrollBy(0,y-70)}fitChat()},60);setTimeout(fitChat,350);setTimeout(fitChat,700)});
document.addEventListener('focusout',e=>{if(e.target.id!=='cvsIn')return;setTimeout(()=>{if(document.activeElement&&document.activeElement.id==='cvsIn')return;
 document.documentElement.classList.remove('cvs-typing');fitChat()},120)});
if(window.visualViewport){visualViewport.addEventListener('resize',fitChat);visualViewport.addEventListener('scroll',fitChat)}

/* ---------------- actions ---------------- */
function startWith(q){q=String(q||'').trim();if(!q)return;const c=make();TAB='chat';go('canvas/'+c.id);setTimeout(()=>send(c,q),60)}
function setVer(c,i){if(!c.ver[i])return;c.vi=i;c.html=c.ver[i].html;touch(c);FR_ERR=null;paint()}
Object.assign(ACT,{
 cvsNew:()=>{const c=make();TAB='chat';go('canvas/'+c.id);setTimeout(()=>$('#cvsIn')?.focus(),300)},
 cvsIdea:d=>startWith(d.q),
 cvsOpen:d=>{TAB=get(d.id)&&get(d.id).html&&!wide()?'view':'chat';go('canvas/'+d.id)},
 cvsTab:d=>{TAB=d.k;const r=$('#cvs');if(!r)return;r.dataset.tab=TAB;r.querySelectorAll('.cvs-tabs button').forEach(b=>{const on=b.dataset.k===TAB;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});if(TAB==='code'){const c=get(cur.id),t=$('#cvsCode');if(c&&t&&!t.matches(':focus'))t.value=c.html||''}if(TAB==='chat')logPaint(true)},
 cvsStop:()=>{if(RUN)RUN.ctl.abort()},
 cvsFixMsg:d=>{const c=get(d.id);if(!c||RUN)return;send(c,d.k==='blank'?'The page shows nothing when it runs. Please find out why and fix it.':d.k==='warn'?`The automatic check still sees these problems. Please fix them:\n${d.x}`:`The page hits this error when it runs: “${d.x}”. Please fix it.`)},
 cvsThink:(d,el)=>{const s=insSet(),n=s.cthink==='off'?'':'off';s.cthink=n;save();if(el){el.classList.toggle('on',n!=='off');el.innerHTML=ic('ai','ico-s')+'Thinking: '+(n==='off'?'Off':'On')}toast(n==='off'?'Thinking off while building: quicker, rougher pages':'Thinking on while building: slower, better pages')},
 cvsResume:d=>{const c=get(d.id),m=c&&c.msgs.find(x=>x.id===d.m);if(c&&m&&m.part&&!RUN)resume(c,m)},
 cvsW:d=>{const c=get(d.id);if(!c)return;c.w=d.w;touch(c);const w=$('.cvs-fw');if(w)w.classList.toggle('ph',c.w==='phone');document.querySelectorAll('[data-act=cvsW]').forEach(b=>b.classList.toggle('on',b.dataset.w===c.w))},
 cvsReload:()=>{document.querySelectorAll('iframe.cvs-fr').forEach(x=>x.dataset.k='');FR_ERR=null;errPaint();fillFrames()},
 cvsFull:()=>{FULL=true;paint()},cvsFullX:()=>{FULL=false;paint()},
 cvsFix:d=>{const c=get(d.id);if(!c||!FR_ERR)return;const x=FR_ERR.x;FR_ERR=null;errPaint();send(c,`The page shows this error: “${x}”. Please fix it.`)},
 cvsUndo:d=>{const c=get(d.id);if(!c||RUN)return;const i=(c.vi??c.ver.length-1)-1;if(i<0)return;setVer(c,i);toast(`Back to version ${i+1}`,()=>setVer(c,i+1))},
 cvsVer:d=>{const c=get(d.id);if(!c||RUN)return;setVer(c,+d.v);if(!wide())ACT.cvsTab({k:'view'});closeSheet()},
 cvsVers:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>Versions</h2><p class="small muted">Every change is kept. Pick one to show it; asking for a change carries on from the one showing.</p><div class="cvs-vl">${c.ver.map((v,i)=>({v,i})).reverse().map(({v,i})=>`<button class="cvs-vi ${c.vi===i?'on':''}" data-act="cvsVer" data-id="${c.id}" data-v="${i}"><b>Version ${i+1}${c.vi===i?' · showing':''}</b><small>${esc(v.by==='you'?'Your edit':v.note||'Change')} · ${ago(v.t)}</small></button>`).join('')||'<p class="muted">Nothing built yet.</p>'}</div>`)},
 cvsMore:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>${esc(c.title)}</h2><div class="cv-menu">
  <button class="btn" data-act="cvsRename" data-id="${c.id}">${ic('edit')}Rename</button>
  <button class="btn" data-act="cvsVers" data-id="${c.id}" ${c.ver.length?'':'disabled'}>${ic('vers')}Versions (${c.ver.length})</button>
  <button class="btn" data-act="cvsDl" data-id="${c.id}" ${c.html?'':'disabled'}>${ic('dl')}Download as a web page</button>
  <button class="btn" data-act="cvsDup" data-id="${c.id}" ${c.html?'':'disabled'}>${ic('copy')}Make a copy</button>
  <button class="btn" data-act="cvsReset" data-id="${c.id}">${ic('reset')}Reset the canvas</button>
  <button class="btn danger" data-act="cvsDel" data-id="${c.id}">${ic('trash')}Delete</button></div>`)},
 cvsRename:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>Rename</h2><form data-form="cvsName" data-id="${c.id}"><div class="field"><input name="t" maxlength="80" value="${esc(c.title)}" aria-label="Name" required></div><div class="actions"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn pri">Save</button></div></form>`);setTimeout(()=>{const i=$('#sheet input');if(i){i.focus();i.select()}},80)},
 cvsDl:d=>{const c=get(d.id);if(!c||!c.html)return;closeSheet();const withData=c.data&&/PLOT_DATA/.test(c.html);
  download((c.title.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'canvas')+'.html',docOf(c,{file:true,data:withData}),'text/html');toast(withData?'Saved, with a snapshot of the data it uses':'Saved')},
 cvsDup:d=>{const c=get(d.id);if(!c)return;const n={...JSON.parse(JSON.stringify(c)),id:uid(),title:tr(c.title,70)+' copy',named:true,t0:Date.now()};CS.unshift(n);touch(n);closeSheet();go('canvas/'+n.id);toast('Copy made')},
 cvsReset:d=>{const c=get(d.id);if(!c)return;askConfirm('Reset this canvas?','The page, the chat, every version and anything its app saved are cleared. The name stays.','Reset',()=>{if(RUN&&RUN.id===c.id)RUN.ctl.abort();Object.assign(c,{html:'',ver:[],vi:undefined,msgs:[],store:{}});FR_ERR=null;TAB='chat';touch(c);closeSheet();paint();toast('Canvas reset')})},
 cvsDelAll:()=>askConfirm('Delete every canvas?','Every page, its versions and its chat are deleted from all your devices.','Delete all',()=>{if(RUN)try{RUN.ctl.abort()}catch(e){}CS=[];persist();render(false);toast('All canvases deleted')}),
 cvsDel:d=>{const c=get(d.id);if(!c)return;askConfirm('Delete this canvas?','The page, its versions and its chat are deleted from all your devices.','Delete',()=>{if(RUN&&RUN.id===c.id)RUN.ctl.abort();const i=CS.indexOf(c);CS=CS.filter(x=>x!==c);persist();closeSheet();if(cur.p==='canvas'&&cur.id===c.id)go('canvas');else render(false);
  toast(c.slot?'Part deleted':'Canvas deleted',()=>{CS.splice(Math.max(0,i),0,c);persist();if(cur.p==='canvas'||SLOTS[cur.p])render(false)})})},
 cvsCodeSave:d=>{const c=get(d.id),t=$('#cvsCode');if(!c||!t)return;const v=t.value;if(v===c.html)return toast('No changes');commit(c,v,'Your edit','you');FR_ERR=null;c.msgs.push({id:uid(),r:'a',x:'You edited the code by hand.',v:c.vi,t:Date.now()});ACT.cvsTab({k:wide()?'chat':'view'});fillFrames();logPaint(true);const vl=$('#cvsVl');if(vl)vl.textContent=`Version ${c.vi+1} of ${c.ver.length}`;toast('Applied')},
 cvsCopy:async d=>{const c=get(d.id);if(!c)return;toast(await copyText(c.html||'')?'Code copied':'Copy failed')}
});
Object.assign(FORM,{
 cvsStart:f=>startWith(new FormData(f).get('q')),
 cvsSend:f=>{const c=get(f.dataset.id),t=f.querySelector('textarea'),q=String(t.value||'').trim();if(!c||!q)return;if(window.VC&&VC.el===t&&typeof voiceStop==='function')voiceStop(true);t.value='';grow(t);send(c,q)},
 cvsName:f=>{const c=get(f.dataset.id),t=String(new FormData(f).get('t')||'').trim();if(!c||!t)return;c.title=tr(t,80);c.named=true;touch(c);closeSheet();paint();if(SLOTS[cur.p])render(false)}
});

/* ---------------- parts: build onto the app's own pages (1.65) ----------------
   "Build something here" at the foot of a page starts a canvas tied to that page (c.slot), in the same editor, with the
   same versions and Fix it. It's a draft until you tap Keep: a draft is dropped the next time the app starts. A kept part
   shows on its page in the app's colours (the theme's colours reach the frame as --pl-* variables), sized to what it
   shows, and reads a fresh snapshot of your data each time the page draws. A part that hits an error says so on the
   page, with Fix with AI. The ••• on a part: edit, move up or down, take it off the page (it stays in AI canvas), delete. */
const SLOTS={today:'Home',habits:'Habits',goals:'Goals',cal:'Calendar',journal:'Journal',threads:'Notes',lists:'Lists',bills:'Bills',activity:'Activity',moves:'Activity in detail',screen:'Screen time'};
const slotName=k=>SLOTS[k]||'app';
/* a mix on purpose: views of your data, and tools you use right there */
const PT_IDEAS={
 today:['A water tracker I tap through the day','This week at a glance: plans, habits done and steps','A quote that changes every day'],
 habits:['A 3-month heat map of all my habits','A breathing timer for my meditation habit','My best and worst weekdays for habits'],
 goals:['Progress bars for my active goals and their steps','A savings jar I add money to','Days left until each goal’s target date'],
 cal:['My busiest days of the week, from my plans','A countdown to a date I pick','A study timetable I can fill in'],
 journal:['My moods across the month as a chart','A gratitude log: three things a day','A random old entry to look back on'],
 threads:['A quick idea inbox','My notes, by when I last added to them'],
 lists:['A meal planner for the week','Progress on each of my lists','A shopping total calculator'],
 bills:['A monthly budget I fill in','A tip and split calculator'],
 activity:['My peak step hours, with Today, This week, This month and Last month','A workout log with sets and reps','Sleep each night this month against my goal'],
 moves:['Workouts per week, by type','A run pace calculator'],
 screen:['My busiest phone hours this week, as a heat map','A focus timer that logs my sessions']};
const PT_VARS=['bg','bg-2','surface','surface-2','line','line-2','text','muted','dim','accent','on-accent'];
function themeCSS(){const cs=getComputedStyle(document.documentElement),v=PT_VARS.map(k=>`--pl-${k}:${cs.getPropertyValue('--'+k).trim()||'initial'}`).join(';'),sch=/light/.test(cs.colorScheme||'')?'light':'dark';
 return`<style>:root{${v};--pl-font:${(cs.getPropertyValue('--f-body').trim()||'system-ui,sans-serif').replace(/[<>]/g,'')};color-scheme:${sch}}html,body{background:transparent;height:auto!important;min-height:0!important}body{margin:0;font-family:var(--pl-font);color:var(--pl-text)}</style>`}
function partSys(c){return`
THIS IS A PART OF THE APP, NOT A PAGE OF ITS OWN
It sits inside the user's ${slotName(c.slot)} page in Plotlines, under the app's own cards, as one block the full width of that page (about 340 to 900 px wide).
It can be anything the user asks for: a view of their data (chart, table, summary), or a tool they use right there (tracker or log they fill in, checklist, timer, counter, calculator, planner, quiz, game, notes board...). Build exactly what they describe; don't turn it into a chart unless they ask for one. Whatever the user enters is kept with localStorage, which is saved with the part. A part can read their Plotlines data but can't change it (their goals, habits, journal...): if they ask for that, say so in one line and keep the part's own record instead. So:
- No page header, hero, navigation or footer: at most a small title row. The app already shows the part's name above it.
- Never use 100vh, position:fixed or a fixed height on html or body: the frame grows to fit what you show. Nothing scrolls inside it.
- Keep html and body transparent, and use the app's colours, which are set on :root and follow the user's theme: var(--pl-surface) and var(--pl-surface-2) for cards, var(--pl-line) for borders, var(--pl-text), var(--pl-muted), var(--pl-accent) (with var(--pl-on-accent) for text on it), and font-family var(--pl-font). Don't use prefers-color-scheme, the theme already decides light or dark.
- When it shows data over time, give it a small switch for the span (for example Today, This week, This month, Last month) or to step back and forward, and remembers the choice with localStorage.
- Show only what the data really has. A day or hour with no record is "not recorded" (null), never a guessed or spread-out number.`}
const parts=k=>CS.filter(c=>c.slot===k&&c.keep).sort((a,b)=>(a.ord||0)-(b.ord||0)||a.t0-b.t0);
const PH={};/* each part's last height, so a redraw doesn't jump */
function zoneHTML(k){return`<section class="upz" data-slot="${k}" aria-label="Your parts">${parts(k).map(c=>`<div class="upt" data-id="${c.id}"><div class="upt-h"><b>${esc(c.title)}</b><button class="ibtn sm" data-act="ptMenu" data-id="${c.id}" aria-label="Options for ${esc(c.title)}">${ic('more')}</button></div>
 ${c.html?`<iframe class="cvs-fr upt-fr" data-id="${c.id}" sandbox="${SANDBOX}" title="${esc(c.title)}" referrerpolicy="no-referrer" style="height:${PH[c.id]||180}px"></iframe>`:`<p class="small muted">Nothing built yet. <button class="link" data-act="cvsOpen" data-id="${c.id}">Build it</button></p>`}<div class="upt-err" hidden></div></div>`).join('')}
 <button class="upt-add" data-act="ptNew" data-slot="${k}">${ic('plus','ico-s')}Build something here</button></section>`}
/* every page that can hold parts gets them at its foot; done when the page first draws, because other files wrap
   these views after this one loads */
{const _r=render;render=function(){const k=cur.p,f=VIEWS[k];
 if(SLOTS[k]&&f&&!f.upt){const g=function(id){const h=f.apply(this,arguments);return id||typeof h!=='string'||h.includes('class="upz"')?h:h+zoneHTML(k)};g.upt=1;VIEWS[k]=g}
 const x=_r.apply(this,arguments);fillParts();return x}}
/* The parts sit beside the page inside #view (#vpg holds the page, #upzH the parts), so a redraw of the page (ticking
   a habit, say) doesn't reload them. The parts are only rebuilt when they, their order or the theme change; when just
   your data changed, a fresh copy of a part loads behind the one showing and takes its place once it's ready. */
const zoneKey=()=>{const cs=getComputedStyle(document.documentElement);return[cur.p,cs.getPropertyValue('--surface'),cs.getPropertyValue('--accent'),cs.getPropertyValue('--text'),
 ...parts(cur.p).map(c=>[c.id,c.title,c.vi,c.html.length,c.data?1:0].join(':'))].join('|')};
{const _vs=viewSet;viewSet=function(v,h){const i=typeof h==='string'?h.lastIndexOf('<section class="upz"'):-1;if(i<0)return _vs(v,h);
 let pg=v.querySelector(':scope>#vpg'),z=v.querySelector(':scope>#upzH');
 if(!pg||!z){v.innerHTML='<div id="vpg"></div><div id="upzH"></div>';pg=v.firstElementChild;z=v.lastElementChild}
 _vs(pg,h.slice(0,i));const k=zoneKey();if(z.dataset.k!==k){z.innerHTML=h.slice(i);z.dataset.k=k}}}
function fillParts(){let D,ds;const data=()=>{if(D===undefined){D=plotData();ds=JSON.stringify(D)}};
 document.querySelectorAll('#view iframe.upt-fr').forEach(f=>{const c=get(f.dataset.id);if(!c||f.dataset.swap)return;const uses=c.data&&usesData(c.html);if(uses)data();
  if(!f.dataset.k){f.dataset.k='1';f._dv=uses?ds:'';f.srcdoc=docOf(c,{part:1,D:uses?D:null});return}
  if(!uses||f._dv===ds)return;
  const n=f.cloneNode(false),box=f.parentNode;n.removeAttribute('srcdoc');n._dv=ds;f.dataset.swap='1';box.style.position='relative';
  Object.assign(n.style,{position:'absolute',left:'0',top:f.offsetTop+'px',opacity:'0',pointerEvents:'none'});
  let done=false;const take=()=>{if(done)return;done=true;Object.assign(n.style,{position:'',left:'',top:'',opacity:'',pointerEvents:''});if(f.isConnected)f.remove()};
  n.addEventListener('load',()=>setTimeout(take,150));setTimeout(take,4000);f.after(n);n.srcdoc=docOf(c,{part:1,D})})}
function ptMsg(fr,c,d){if(d.h){const h=Math.max(48,Math.min(2400,Math.ceil(+d.h)||0));PH[c.id]=h;fr.style.height=h+'px'}
 if(d.err){const e=fr.parentNode&&fr.parentNode.querySelector('.upt-err');if(!e||!e.hidden)return;e.hidden=false;
  e.innerHTML=`<span>${ic('flag','ico-s')}This part hit an error: ${esc(tr(d.err,160))}</span><button class="btn sm" data-act="ptFix" data-id="${c.id}" data-x="${esc(tr(d.err,200))}">${ic('ai','ico-s')}Fix with AI</button>`}}
function ptBar(c){if(!c.slot)return'';const n=slotName(c.slot);
 return c.keep?`<div class="upt-bar on">${ic('check','ico-s')}<span>On your ${n} page</span><a class="btn sm" href="#/${c.slot}">Open ${n}</a></div>`
  :`<div class="upt-bar">${ic('flag','ico-s')}<span>A part for your ${n} page. Not kept yet: it goes away when the app closes.</span><button class="btn sm pri" data-act="ptKeep" data-id="${c.id}" ${c.html&&!(RUN&&RUN.id===c.id)?'':'disabled'}>${ic('pin','ico-s')}Keep on ${n}</button></div>`}
function ptEmpty(c){const I=PT_IDEAS[c.slot]||[];return`<div class="cvs-empty"><span class="cvs-orb"></span><p><b>Build a part for your ${slotName(c.slot)} page.</b></p><p class="small muted">Anything you like: a chart of your data, a tracker you fill in, a timer, a calculator, a small app. It appears on the right (on a phone, under Canvas). Tap Keep when you like it.</p>
 ${I.length?`<div class="cvs-ideas upt-ideas">${I.map(q=>`<button class="cvs-idea" data-act="ptIdea" data-id="${c.id}" data-q="${esc(q)}">${ic('ai','ico-s')}<span>${esc(q)}</span></button>`).join('')}</div>`:''}</div>`}
function ptList(){const P=CS.filter(c=>c.slot&&(c.keep||c.sess===SESS));if(!P.length)return'';
 return`<h4 class="cv-g cvs-gh">Parts on your pages</h4><div class="cvs-grid rv">${P.map(c=>`<button class="cvs-card" data-act="cvsOpen" data-id="${c.id}"><span class="cvs-thumb">${ic('cvs')}</span><span class="cvs-cb"><b>${esc(c.title)}</b><small>${c.keep?esc(slotName(c.slot)):'Not kept yet'} · ${ago(c.t1)}</small></span>${RUN&&RUN.id===c.id?'<i class="cvs-dot" title="Working"></i>':''}</button>`).join('')}</div>`}
function ptMove(c,by){const P=parts(c.slot),i=P.indexOf(c),j=i+by;if(i<0||j<0||j>=P.length)return;[P[i],P[j]]=[P[j],P[i]];P.forEach((x,n)=>x.ord=n);persist();closeSheet();render(false)}
Object.assign(ACT,{
 ptNew:d=>{if(!SLOTS[d.slot])return;const c=make();Object.assign(c,{title:'New part for '+slotName(d.slot),slot:d.slot,keep:false,sess:SESS});persist();TAB='chat';go('canvas/'+c.id);setTimeout(()=>$('#cvsIn')?.focus(),300)},
 ptIdea:d=>{const c=get(d.id);if(c)send(c,d.q)},
 ptKeep:d=>{const c=get(d.id);if(!c||!c.html)return;const P=parts(c.slot);c.keep=true;c.ord=P.length?Math.max(...P.map(x=>x.ord||0))+1:0;touch(c);paint();
  toast(`Kept on your ${slotName(c.slot)} page`,()=>{c.keep=false;c.sess=SESS;touch(c);paint()})},
 ptMenu:d=>{const c=get(d.id);if(!c)return;const P=parts(c.slot),i=P.indexOf(c);openSheet(`<h2>${esc(c.title)}</h2><div class="cv-menu">
  <button class="btn" data-act="cvsOpen" data-id="${c.id}">${ic('ai')}Change it with AI</button>
  <button class="btn" data-act="cvsRename" data-id="${c.id}">${ic('edit')}Rename</button>
  ${P.length>1?`<button class="btn" data-act="ptUp" data-id="${c.id}" ${i>0?'':'disabled'}>${ic('up')}Move up</button><button class="btn" data-act="ptDown" data-id="${c.id}" ${i<P.length-1?'':'disabled'}>${ic('down')}Move down</button>`:''}
  <button class="btn" data-act="ptOff" data-id="${c.id}">${ic('x')}Take it off ${esc(slotName(c.slot))}</button>
  <button class="btn danger" data-act="cvsDel" data-id="${c.id}">${ic('trash')}Delete</button></div>`)},
 ptUp:d=>{const c=get(d.id);if(c)ptMove(c,-1)},ptDown:d=>{const c=get(d.id);if(c)ptMove(c,1)},
 ptOff:d=>{const c=get(d.id);if(!c)return;const k=c.slot;delete c.slot;delete c.keep;delete c.ord;delete c.sess;touch(c);closeSheet();render(false);
  toast('Moved to AI canvas',()=>{c.slot=k;c.keep=true;touch(c);render(false)})},
 ptFix:d=>{const c=get(d.id);if(!c)return;if(RUN)return toast('Still working on the last one');TAB='chat';go('canvas/'+c.id);setTimeout(()=>send(c,`The page shows this error: “${d.x}”. Please fix it.`),80)}
});

/* others (the assistant, the agent, the How-to demos) can start a canvas */
window.CANVAS={list:()=>CS.slice(),get,start:startWith,send:(id,q)=>{const c=get(id);if(c)send(c,q)},plotData,parse,applyEdits,ready:()=>LOADED,check,probList,busy:()=>!!RUN};

const css=document.createElement('style');css.textContent=`
.cvs-start{margin:4px 0 10px}.cvs-start textarea{min-height:84px}
.cvs-ideas{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.cvs-idea{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:500 13.5px var(--f-body);cursor:pointer;text-align:left}
.cvs-idea:hover,.cvs-idea:focus-visible{border-color:var(--accent)}.cvs-idea .ico-s{color:var(--accent);flex:none}
.cvs-gh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.cvs-gh .link{font-size:13px}
.cvs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:12px}
.cvs-card{position:relative;display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-align:left;cursor:pointer;min-width:0}
.cvs-card:hover,.cvs-card:focus-visible{border-color:var(--accent)}
.cvs-thumb{width:48px;height:48px;flex:none;border-radius:14px;display:grid;place-items:center;color:var(--accent);background:color-mix(in srgb,var(--accent) 13%,var(--surface))}.cvs-thumb svg{width:24px;height:24px}
.cvs-cb{display:flex;flex-direction:column;gap:2px;min-width:0}.cvs-cb b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cvs-cb small{color:var(--muted);font-size:12.5px}
.cvs-dot{position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:50%;background:var(--accent);animation:meBl 1s ease-in-out infinite}
.cvs-hint{display:flex;gap:6px;align-items:flex-start;margin:6px 2px 8px}
/* no AI yet: the setup card would squeeze the chat in its fixed-height box, so the page just scrolls instead */
.cvs .cvs-chat.noai{height:auto!important;min-height:0}.cvs-chat.noai .cvs-log{flex:none;overflow:visible}.cvs-hint .ico-s{flex:none;margin-top:2px}
.cvs-setup{margin-bottom:12px}
.cvs-top{display:flex;align-items:center;gap:8px}.cvs-top .ph-r{margin-left:auto;display:flex;gap:4px}
.cvs-ti{display:flex;flex-direction:column;align-items:flex-start;min-width:0;flex:1;background:none;border:0;color:var(--ink);text-align:left;cursor:pointer;padding:2px 4px;border-radius:10px}
.cvs-ti b{font:700 18px/1.2 var(--f-body);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cvs-ti small{color:var(--muted);font-size:12px}
.cvs-tabs{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--surface);border:1px solid var(--line);margin:6px 0 10px}
.cvs-tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:0;border-radius:10px;background:none;color:var(--muted);font:600 13.5px var(--f-body);cursor:pointer}
.cvs-tabs button.on{background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--ink)}
.cvs-body{display:block}.cvs-chat,.cvs-view,.cvs-code{display:none}
.cvs[data-tab=chat] .cvs-chat,.cvs[data-tab=view] .cvs-view,.cvs[data-tab=code] .cvs-code{display:flex}
.cvs-chat{flex-direction:column;gap:8px;height:calc(100dvh - 255px);min-height:340px}
.cvs-log{flex:1;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:12px;padding:4px 2px 8px}
.cvs-log .cv-q{align-self:flex-end;max-width:86%;padding:10px 14px;border-radius:18px 18px 6px 18px;background:color-mix(in srgb,var(--accent) 15%,var(--surface))}.cvs-log .cv-q p{margin:0}
.cvs-log .cv-a{display:flex;gap:10px;align-items:flex-start}.cvs-log .cv-a>div{min-width:0;flex:1}
html.cvs-typing .tabbar{display:none!important}html.cvs-typing .cvs-opts{display:none}html.cvs-typing .cvs-chat{min-height:0}.cvs-data span{white-space:nowrap}@media(max-width:480px){.cvs-opts .cvs-data small{display:none}}.cvs-res{margin-top:6px}.cvs-s{display:flex;gap:6px;align-items:flex-start;margin:2px 0 6px;font:600 13.5px/1.4 var(--f-body);color:var(--muted)}.cvs-s .ico-s{flex:none;margin-top:2px}.cvs-s.ok{color:var(--ink)}.cvs-s.ok .ico-s{color:#2fae7a}.cvs-s.warn .ico-s{color:#e0803c}.cvs-sa{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 6px}.cvs-sys .ai-md,.cvs-sys{opacity:.75}.cvs-st2{margin:0}.cvs-st span{font-variant-numeric:tabular-nums}.cvs-opts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cvs-opts .cvs-data{flex:1;min-width:0}.cvs-think{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:600 12.5px var(--f-body);cursor:pointer;white-space:nowrap}.cvs-think.on{color:var(--ink);border-color:var(--accent)}.cvs-vtag{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:600 12px var(--f-body);cursor:pointer}.cvs-vtag:hover{color:var(--ink);border-color:var(--accent)}
.cvs-st{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;margin:4px 0}.cvs-st i{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:meBl 1s ease-in-out infinite}
.cvs-empty{margin:auto;text-align:center;max-width:340px;padding:20px}.cvs-empty p{margin:6px 0}
.cvs-orb{display:block;margin:0 auto 10px;width:44px;height:44px;border-radius:50%;background:conic-gradient(from 0deg,var(--accent),var(--c-learning,var(--accent)),var(--c-health,var(--accent)),var(--accent));animation:mmSpin 2.4s linear infinite}
.cvs-in{display:flex;align-items:flex-end;gap:8px;padding:6px;border-radius:20px;border:1px solid var(--line);background:var(--surface)}
.cvs .cvs-in textarea{flex:1;min-width:0;min-height:0;height:40px;border:0;box-shadow:none;background:none;resize:none;padding:9px 8px;font:15px/1.4 var(--f-body);color:var(--ink);max-height:180px;outline:none}
.cvs-in.has-mic,.cvs-in{padding-right:6px}.cvs-in .mic{position:static;flex:none;transform:none;align-self:flex-end;margin-bottom:2px}.cvs-go{flex:none;min-width:40px;height:40px;padding:0 12px;border-radius:14px}
.cvs-data{display:flex;align-items:center;gap:8px;font-size:13px;padding:0 6px;cursor:pointer}.cvs-data small{color:var(--muted)}.cvs .cvs-data input{appearance:auto;-webkit-appearance:checkbox;width:16px;height:16px;min-height:0;margin:0;padding:0;flex:none;accent-color:var(--accent)}.cvs-data small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cvs-view{flex-direction:column;gap:8px}
.cvs-bar{display:flex;align-items:center;gap:4px}.cvs-bar .seg-s{display:flex;gap:2px;padding:2px;border-radius:12px;border:1px solid var(--line)}.cvs-bar .ibtn.on{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--ink)}.cvs-sp{flex:1}
.cvs-stage{height:calc(100dvh - 300px);min-height:360px;border-radius:20px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 4%,var(--surface));overflow:hidden;display:flex}
.cvs-fw{flex:1;display:flex;justify-content:center;min-width:0}.cvs-fw.ph{padding:12px 0}.cvs-fw.ph iframe{width:390px;max-width:100%;border-radius:24px;box-shadow:0 10px 40px rgba(0,0,0,.18);border:1px solid var(--line)}
.cvs-fr{width:100%;height:100%;border:0;background:#fff;display:block}
.cvs-blank{margin:auto;text-align:center;color:var(--muted)}.cvs-blank svg{width:40px;height:40px;opacity:.5}
.cvs-ferr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:14px;background:color-mix(in srgb,#ff7a7a 14%,var(--surface));font-size:13.5px}.cvs-ferr span{flex:1;min-width:180px;display:flex;gap:6px;align-items:flex-start}
.cvs-code{flex-direction:column;gap:8px}.cvs-code textarea{width:100%;height:calc(100dvh - 300px);min-height:320px;font:12.5px/1.5 var(--f-mono,ui-monospace,monospace);padding:12px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);resize:vertical;white-space:pre;tab-size:2}
.cvs-full{position:fixed;inset:0;z-index:300;background:#fff}.cvs-full iframe{width:100%;height:100%}
.cvs-fx{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;z-index:301;background:rgba(20,20,24,.6);color:#fff;backdrop-filter:blur(10px)}
.cvs-vl{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.cvs-vi{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}.cvs-vi.on{border-color:var(--accent)}.cvs-vi small{color:var(--muted)}
@media(min-width:900px){
 .cvs-tabs{max-width:240px;margin-left:auto}.cvs-tabs button[data-k=chat]{display:none}
 .cvs-body{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:16px;align-items:start}
 .cvs .cvs-chat{display:flex;height:calc(100dvh - 185px)}
 .cvs[data-tab=chat] .cvs-view{display:flex}
 .cvs-stage{height:calc(100dvh - 215px)}.cvs-code textarea{height:calc(100dvh - 275px)}
}
.upz{display:flex;flex-direction:column;gap:14px;margin:22px 0 8px;clear:both}
.upt{min-width:0}.upt-h{display:flex;align-items:center;gap:8px;margin:0 0 6px}.upt-h b{flex:1;min-width:0;font:600 15px/1.3 var(--f-body);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.upt-h .ibtn{flex:none}
.upt-fr{display:block;width:100%;border:0;background:transparent;transition:height .25s var(--ease)}
.upt-err{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;padding:10px 14px;border-radius:14px;background:color-mix(in srgb,#ff7a7a 14%,var(--surface));font-size:13.5px;color:var(--text)}.upt-err[hidden]{display:none}.upt-err span{flex:1;min-width:180px;display:flex;gap:6px;align-items:flex-start}
.upt-add{align-self:center;display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:999px;border:1px dashed var(--line-2);background:none;color:var(--muted);font:500 13.5px var(--f-body);cursor:pointer;opacity:.75;transition:opacity .2s,color .2s,border-color .2s}
.upt-add:hover,.upt-add:focus-visible{opacity:1;color:var(--text);border-color:var(--accent)}
.upt-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 4px;padding:9px 12px;border-radius:14px;border:1px solid var(--line);background:var(--surface);font-size:13.5px;color:var(--muted)}.upt-bar span{flex:1;min-width:160px}.upt-bar .ico-s{flex:none;color:#e0803a}.upt-bar.on .ico-s{color:#2fae7a}.upt-bar .btn{flex:none}
.upt-ideas{justify-content:center;margin:14px 0 0}
.upt-pv{background:var(--bg)}.cvs-fw.upt-pv{padding:14px;overflow:auto}.upt-pv .cvs-fr{background:transparent}
.cvs-pl{margin:0 0 8px;padding-left:20px;font-size:13px;color:var(--muted)}.cvs-pl li{margin:2px 0}
@media(prefers-reduced-motion:reduce){.cvs-orb,.cvs-st i,.cvs-dot{animation:none}}
`;document.head.appendChild(css);
})();
