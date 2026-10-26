/* ================= Journal book (1.59): the journal as a book you turn the pages of =================
   One page per day: everything written that day in full, and the day's moments (steps done, goals, focus) as short
   lines. One page on a phone, a two-page spread on wide screens. Pages turn with a drag that follows the finger (or a
   tap near the edge, the arrow buttons or the keyboard), with shading like paper. The index on the side, and the
   scrubber at the bottom, jump to any day. Write a new page or edit one in the full-screen writer; the book opens again
   on that page. The turn uses two flat faces rotating on their own (no preserve-3d), so it can't render mirrored in
   Android WebView. Reduced motion: pages cross-fade instead. */
(()=>{
'use strict';
Object.assign(IC,{book:'<path d="M12 6.2C10.1 4.8 7.4 4.2 4 4.4v13.7c3.4-.2 6.1.4 8 1.8 1.9-1.4 4.6-2 8-1.8V4.4c-3.4-.2-6.1.4-8 1.8z"/><path d="M12 6.2v13.7"/>',ixl:'<path d="M4 6h16M4 12h16M4 18h10"/>'});
const B={open:false,P:[],i:0,busy:false,ix:false,focus:''};
const wide=()=>innerWidth>=900;
const dayOf=t=>ymd(new Date(t));
/* the pages: a cover, one page per day that has entries (oldest first), and today's page to write on */
function pages(){const D={};S.entries.filter(e=>e&&e.type!=='token').forEach(e=>{(D[dayOf(e.t)]=D[dayOf(e.t)]||[]).push(e)});
 const td=ymd();if(!D[td])D[td]=[];
 return[{k:'cover'},...Object.keys(D).sort().map(d=>({k:'day',d,E:D[d].sort((a,b)=>a.t-b.t)}))]}
const longDate=d=>new Date(d+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
function entryHTMLb(e){const g=G(e.goalId),mood=e.mood?`<span class="bk-mood" title="${esc(MOODN[e.mood]||'')}">${e.mood} ${esc(MOODN[e.mood]||'')}</span>`:'',tm=new Date(e.t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 if(e.type==='note')return`<article class="bk-e"><div class="bk-eh"><span class="bk-tm">${esc(tm)}</span>${mood}<button class="bk-ed" data-act="bkEdit" data-id="${e.id}" aria-label="Edit this entry" title="Edit">${ic('edit')}</button></div>${e.title?`<h3>${esc(e.title)}</h3>`:''}${e.img?`<img class="bk-img" src="${e.img}" alt="">`:''}<div class="bk-x">${richOf(e)}</div>${g?`<div class="bk-g">🎯 ${esc(g.title)}</div>`:''}</article>`;
 const kind=JK[e.type]||'Moment',txt=e.title||e.text||kind;return`<div class="bk-mo"><span class="bk-tm">${esc(tm)}</span><span><b>${esc(kind)}</b> · ${esc(trunc(String(txt),140))}${g&&e.type!=='goal-new'&&e.type!=='goal-done'?` <em>(${esc(trunc(g.title,40))})</em>`:''}</span></div>`}
function pageHTML(p,n){if(!p)return`<div class="bk-pc bk-blank"></div>`;
 if(p.k==='cover'){const all=S.entries.filter(e=>e.type!=='token'),first=all.reduce((a,e)=>Math.min(a,e.t),Date.now()),nm=S.settings.name;
  return`<div class="bk-pc bk-cover"><div class="bk-cv"><small class="data">Plotlines</small><h2>${nm?esc(nm)+'’s journal':'My journal'}</h2><p>${all.length} entr${all.length===1?'y':'ies'} · since ${esc(new Date(first).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}))}</p><p class="bk-hint">Drag a page, or tap its edge, to turn it.</p></div></div>`}
 const w=p.E.filter(e=>e.type==='note'),m=p.E.filter(e=>e.type!=='note'),today=p.d===ymd();
 return`<div class="bk-pc"><header class="bk-ph"><small class="data">${today?'Today':esc(dayName(p.d))}</small><h2>${esc(longDate(p.d))}</h2></header>
 <div class="bk-body">${w.map(entryHTMLb).join('')}${m.length?`<div class="bk-mos">${m.map(entryHTMLb).join('')}</div>`:''}${!p.E.length?`<p class="bk-empty">${today?'Nothing written today yet.':'An empty page.'}</p>`:''}
 <button class="bk-add" data-act="bkWrite" data-d="${p.d}">${ic('edit')}${w.length?'Add to this day':today?'Write today’s page':'Write on this page'}</button></div>
 <footer class="bk-pn data">${n}</footer></div>`}
/* which pages are on screen: one (phone) or a left/right spread starting at an even index */
const step=()=>B.sp?2:1;
const clampI=i=>{const L=B.P.length;i=Math.max(0,Math.min(i,L-1));return B.sp?i-(i%2):i};
function shell(){return`<div id="book" class="bk${B.sp?' sp':''}" role="dialog" aria-modal="true" aria-label="Journal book">
 <div class="bk-top"><button class="ibtn" data-act="bkClose" aria-label="Close the book" title="Close (Esc)">${ic('x')}</button><div class="bk-tt"><b>Journal</b><small class="data" id="bkCount" aria-live="polite"></small></div><button class="ibtn" data-act="bkIx" aria-label="Pages" title="Pages" aria-expanded="false">${ic('ixl')}</button><button class="btn sm pri" data-act="bkWrite" data-d="${ymd()}">${ic('edit')}<span>Write</span></button></div>
 <div class="bk-stage"><div class="bk-book" id="bkBook"><div class="bk-pg bk-l" id="bkL"></div><div class="bk-pg bk-r" id="bkR"></div><div class="bk-spine" aria-hidden="true"></div></div></div>
 <div class="bk-bot"><button class="ibtn" data-act="bkPrev" aria-label="Previous page">${ic('back')}</button><div class="bk-scr"><input type="range" id="bkRange" min="0" aria-label="Go to a page"><span class="bk-bub data" id="bkBub"></span></div><button class="ibtn bk-nx" data-act="bkNext" aria-label="Next page">${ic('back')}</button></div>
 <aside class="bk-ix" id="bkIx" aria-label="Pages" hidden></aside></div>`}
const $b=s=>document.querySelector('#book '+s);
function paint(){const L=$b('#bkL'),R=$b('#bkR');if(!R)return;const i=B.i;
 if(B.sp){L.innerHTML=pageHTML(B.P[i],i+1);R.innerHTML=pageHTML(B.P[i+1],i+2)}else{L.innerHTML='';R.innerHTML=pageHTML(B.P[i],i+1)}
 const c=$b('#bkCount'),p=B.P[i],q=B.sp?B.P[i+1]:null;if(c)c.textContent=`Page ${i+1}${q?'–'+(i+2):''} of ${B.P.length}`;
 const r=$b('#bkRange');if(r){r.max=B.P.length-1;r.step=1;r.value=i}
 const pv=$b('[data-act=bkPrev]'),nx=$b('[data-act=bkNext]');if(pv)pv.disabled=i<=0;if(nx)nx.disabled=i+step()>=B.P.length;
 if(B.ix)ixPaint()}
function ixPaint(){const el=$b('#bkIx');if(!el)return;const G0={};B.P.forEach((p,k)=>{if(p.k!=='day')return;const m=p.d.slice(0,7);(G0[m]=G0[m]||[]).push([p,k])});
 el.innerHTML=`<div class="bk-ixh"><b>Pages</b><button class="ibtn sm" data-act="bkIx" aria-label="Close pages">${ic('x')}</button></div><button class="bk-ixr${B.i===0?' on':''}" data-act="bkGo" data-i="0"><span>Cover</span></button>`+Object.keys(G0).reverse().map(m=>`<div class="bk-ixm data">${esc(new Date(m+'-15T12:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}))}</div>`+G0[m].slice().reverse().map(([p,k])=>{const w=p.E.find(e=>e.type==='note'),on=k===B.i||(B.sp&&k===B.i+1);
  return`<button class="bk-ixr${on?' on':''}" data-act="bkGo" data-i="${k}"><span class="bk-ixd">${new Date(p.d+'T12:00').getDate()}</span><span class="bk-ixt"><b>${esc(dayName(p.d))}${w&&w.mood?' '+w.mood:''}</b><small>${esc(w?trunc(w.title||htmlText(richOf(w)).replace(/\s+/g,' '),60)||'Entry':p.E.length?p.E.length+' moment'+(p.E.length===1?'':'s'):'Empty')}</small></span></button>`}).join('')).join('');
 const on=el.querySelector('.bk-ixr.on');if(on)on.scrollIntoView({block:'center'})}

/* ---------------- turning ----------------
   next: the right page (leaf front) turns over the spine; on a spread its back (the next left page) lands on the left.
   prev: the same, the other way. p goes 0→1 over the turn; the front shows for the first half, the back for the second. */
let T=null;
function turnStart(dir){if(B.busy)return false;const ni=clampI(B.i+dir*step());if(ni===B.i)return false;const book=$b('#bkBook');if(!book)return false;
 const L=$b('#bkL'),R=$b('#bkR'),i=B.i,sp=B.sp;let front,back=null,under;
 if(dir>0){front=sp?B.P[i+1]:B.P[i];back=sp?B.P[i+2]:null;
  if(sp){R.innerHTML=pageHTML(B.P[i+3],i+4)}else R.innerHTML=pageHTML(B.P[i+1],i+2)}
 else{front=sp?B.P[i]:B.P[i-1];back=sp?B.P[i-1]:null;
  if(sp){L.innerHTML=pageHTML(B.P[i-2],i-1)}}
 const mk=(cls,html)=>{const d=document.createElement('div');d.className='bk-pg bk-leaf '+cls;d.innerHTML=html+'<i class="bk-shade"></i>';book.appendChild(d);return d};
 const fi=dir>0?(sp?i+1:i):(sp?i:i-1),bi=dir>0?i+2:i-1;
 const f=mk(dir>0?(sp?'bk-r':'bk-r'):(sp?'bk-l':'bk-r'),pageHTML(front,fi+1)),b=sp?mk(dir>0?'bk-l':'bk-r',pageHTML(back,bi+1)):null;
 const sh=document.createElement('i');sh.className='bk-cast '+(dir>0?'r':'l');book.appendChild(sh);
 T={dir,ni,f,b,sh,sp,p:0};setP(0);B.busy=true;return true}
function setP(p){if(!T)return;T.p=p;const{dir,f,b,sp,sh}=T,e=Math.max(0,Math.min(1,p));
 if(sp){/* front turns on the spine for the first half, the back comes down for the second */
  const a1=Math.min(1,e*2)*90,a2=(1-Math.max(0,e*2-1))*90;
  f.style.transform=`perspective(2200px) rotateY(${dir>0?-a1:a1}deg)`;f.style.visibility=e<.5?'visible':'hidden';
  b.style.transform=`perspective(2200px) rotateY(${dir>0?a2:-a2}deg)`;b.style.visibility=e>=.5?'visible':'hidden';
  f.querySelector('.bk-shade').style.opacity=Math.min(1,e*2)*.55;b.querySelector('.bk-shade').style.opacity=(1-Math.max(0,e*2-1))*.55}
 else if(dir>0){/* phone: the page lifts off to the left, curling away from the binding */
  f.style.transform=`perspective(1800px) rotateY(${-e*104}deg)`;f.style.visibility=e<.86?'visible':'hidden';f.querySelector('.bk-shade').style.opacity=e*.6}
 else{f.style.transform=`perspective(1800px) rotateY(${-(1-e)*104}deg)`;f.style.visibility=e>.14?'visible':'hidden';f.querySelector('.bk-shade').style.opacity=(1-e)*.6}
 sh.style.opacity=Math.sin(Math.PI*e)*.9}
function turnEnd(done){if(!T)return;const t=T;T=null;[t.f,t.b,t.sh].forEach(x=>x&&x.remove());if(done)B.i=t.ni;B.busy=false;paint();if(done){const pc=$b('#bkR .bk-pc');pc&&pc.focus&&pc.setAttribute('tabindex','-1')}}
/* frames drive the turn; a timer finishes it on time even if the device skips frames */
function animTo(p1,ms,cb){if(!T)return cb&&cb();const t=T,p0=t.p,t0=performance.now(),ease=x=>1-Math.pow(1-x,3);let fin=false;const end=()=>{if(fin)return;fin=true;if(T===t){setP(p1);cb&&cb()}};
 const tick=now=>{if(fin||T!==t)return;const k=Math.min(1,(now-t0)/ms);setP(p0+(p1-p0)*ease(k));if(k<1)requestAnimationFrame(tick);else end()};requestAnimationFrame(tick);setTimeout(end,ms+120)}
function turn(dir){if(reduced()){const ni=clampI(B.i+dir*step());if(ni===B.i)return;B.i=ni;fade();return}if(!turnStart(dir))return;try{vib()}catch(e){}animTo(1,B.sp?720:620,()=>turnEnd(true))}
function fade(){const bk=$b('#bkBook');paint();if(bk){bk.classList.remove('bk-fade');void bk.offsetWidth;bk.classList.add('bk-fade')}}
function jump(k){k=clampI(+k);if(k===B.i)return;B.i=k;fade()}

/* drag: follows the finger; let go past a third (or flick) to finish the turn */
let D=null;
function onDown(e){if(!B.open||B.busy||e.button>0||e.target.closest('button,a,input,select,textarea,.bk-ix'))return;const bk=$b('#bkBook');if(!bk||!bk.contains(e.target))return;D={x:e.clientX,y:e.clientY,t:performance.now(),w:bk.getBoundingClientRect().width/(B.sp?2:1),on:false,id:e.pointerId}}
function onMove(e){if(!D||e.pointerId!==D.id)return;const dx=e.clientX-D.x,dy=e.clientY-D.y;
 if(!D.on){if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3){if(Math.abs(dy)>14)D=null;return}const dir=dx<0?1:-1;if(!turnStart(dir)){D=null;return}D.on=true;D.dir=dir;try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId)}catch(_){}}
 e.preventDefault();setP(Math.max(0,Math.min(1,(-dx*D.dir)/D.w)))}
function onUp(e){if(!D||(e.pointerId!==D.id&&e.type!=='pointercancel'))return;const d=D;D=null;
 if(!d.on){/* a tap near an edge turns the page */if(e.type==='pointerup'){const bk=$b('#bkBook').getBoundingClientRect(),x=(e.clientX-bk.left)/bk.width;if(Math.abs(e.clientX-d.x)<8&&!getSelection().toString()){if(x>.82)turn(1);else if(x<.18)turn(-1)}}return}
 const v=(e.clientX-d.x)/Math.max(1,performance.now()-d.t),go=T&&(T.p>.33||v*-d.dir>.45);animTo(go?1:0,go?380:260,()=>turnEnd(go))}

/* ---------------- open, close, write ---------------- */
function open(atDay){B.P=pages();B.sp=wide();let i=B.P.length-1;if(atDay){const k=B.P.findIndex(p=>p.d===atDay);if(k>=0)i=k}B.i=clampI(i);B.ix=false;
 let el=document.getElementById('book');if(el)el.remove();document.body.insertAdjacentHTML('beforeend',shell());el=document.getElementById('book');B.open=true;
 document.documentElement.classList.add('bk-on');try{history.pushState({book:1},'')}catch(e){}paint();requestAnimationFrame(()=>el.classList.add('in'))}
function close(fromPop){const el=document.getElementById('book');if(!el)return;B.open=false;T=null;B.busy=false;document.documentElement.classList.remove('bk-on');el.classList.remove('in');setTimeout(()=>el.remove(),260);
 if(!fromPop&&history.state&&history.state.book){BKB=1;try{history.back()}catch(e){BKB=0}}if(cur.p==='journal')render(false)}
let BKB=0;
addEventListener('popstate',e=>{if(BKB){BKB=0;return}if(B.open&&!(e.state&&e.state.book)&&!$('#sheet').classList.contains('on')){close(true)}});
{const _b=window.__back;window.__back=function(){if(B.open&&!$('#sheet').classList.contains('on')){if(B.ix){B.ix=false;ixShow();return true}close();return true}return _b.apply(this,arguments)}}
/* after writing or editing, the book comes back on that day */
{const _cs=closeSheet;closeSheet=function(){const r=_cs.apply(this,arguments);if(B.open){setTimeout(()=>{if(!B.open)return;const d=B.focus||(B.P[B.i]&&B.P[B.i].d);B.P=pages();const k=B.P.findIndex(p=>p.d===d);B.i=clampI(k>=0?k:B.i);paint()},420)}return r}}
function ixShow(){const el=$b('#bkIx'),b=$b('[data-act=bkIx]');if(!el)return;el.hidden=!B.ix;if(b)b.setAttribute('aria-expanded',B.ix);if(B.ix)ixPaint()}
Object.assign(ACT,{
 bkOpen:d=>open(d&&d.d),
 bkClose:()=>close(),
 bkNext:()=>turn(1),bkPrev:()=>turn(-1),
 bkIx:()=>{B.ix=!B.ix;ixShow()},
 bkGo:d=>{if(!wide()){B.ix=false;ixShow()}jump(d.i)},
 bkWrite:d=>{B.focus=d.d||ymd();writeSheet(null,null,B.focus)},
 bkEdit:d=>{const e=S.entries.find(x=>x.id===d.id);if(!e)return;B.focus=dayOf(e.t);writeSheet(e)}});
document.addEventListener('pointerdown',onDown);document.addEventListener('pointermove',onMove,{passive:false});document.addEventListener('pointerup',onUp);document.addEventListener('pointercancel',onUp);
document.addEventListener('keydown',e=>{if(!B.open||$('#sheet').classList.contains('on')||e.target.matches('input,textarea,[contenteditable]'))return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();turn(1)}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();turn(-1)}else if(e.key==='Escape'){e.preventDefault();if(B.ix){B.ix=false;ixShow()}else close()}});
document.addEventListener('input',e=>{if(e.target.id!=='bkRange')return;const p=B.P[+e.target.value],b=$b('#bkBub');if(b)b.textContent=p?(p.k==='cover'?'Cover':new Date(p.d+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})):''});
document.addEventListener('change',e=>{if(e.target.id!=='bkRange')return;const b=$b('#bkBub');if(b)b.textContent='';jump(e.target.value)});
addEventListener('resize',()=>{if(!B.open||B.busy)return;const sp=wide();if(sp!==B.sp){B.sp=sp;B.i=clampI(B.i);document.getElementById('book').classList.toggle('sp',sp);paint()}});
/* the Book button on the Journal page */
{const _vj=VIEWS.journal;VIEWS.journal=function(){const o=_vj.apply(this,arguments);return o.replace('<label class="ibtn sm jdate"',`<button class="ibtn sm bk-ib" data-act="bkOpen" aria-label="Read as a book" title="Read as a book">${ic('book')}</button><label class="ibtn sm jdate"`).replace('<div class="jw-more rv">',`<div class="jw-more rv"><button class="chip jw-mode bk-chip" data-act="bkOpen">${ic('book')}Read as a book</button>`).replace('<div class="ph-r">',`<div class="ph-r"><button class="btn bk-open" data-act="bkOpen" aria-label="Open the journal as a book" title="Read it as a book">${ic('book')}<span>Book</span></button>`)}}
if(typeof booted!=='undefined'&&booted&&cur.p==='journal')render(false);
window.BOOK={open,close,state:()=>({open:B.open,i:B.i,n:B.P.length,sp:B.sp})};

const css=document.createElement('style');css.textContent=`
html.bk-on{overflow:hidden}
.bk{position:fixed;inset:0;z-index:56;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 40%,color-mix(in srgb,var(--surface) 70%,var(--bg)) 0,var(--bg) 70%);color:var(--text);opacity:0;transform:scale(.985);transition:opacity .25s ease,transform .3s var(--spring,ease);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
.bk.in{opacity:1;transform:none}
.bk-top{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;position:relative;z-index:6}
.bk-tt{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px}.bk-tt b{font-size:16px}.bk-tt small{font-size:11px}
.bk-stage{flex:1;min-height:0;display:flex;align-items:stretch;justify-content:center;padding:6px 12px 8px}
.bk-book{position:relative;width:100%;max-width:560px;display:grid;grid-template-columns:1fr;touch-action:pan-y;user-select:text}
.bk.sp .bk-book{max-width:1180px;grid-template-columns:1fr 1fr}
.bk-pg{position:relative;min-width:0;min-height:0;grid-row:1;overflow:hidden;border-radius:6px 16px 16px 6px;background:color-mix(in srgb,var(--surface) 92%,#fff 3%);box-shadow:0 1px 0 color-mix(in srgb,var(--text) 6%,transparent),0 18px 40px -18px rgba(0,0,0,.55),inset 14px 0 18px -14px rgba(0,0,0,.35)}
.bk-pg.bk-l{display:none}.bk.sp .bk-pg.bk-l{display:block;grid-column:1;border-radius:16px 6px 6px 16px;box-shadow:0 1px 0 color-mix(in srgb,var(--text) 6%,transparent),0 18px 40px -18px rgba(0,0,0,.55),inset -14px 0 18px -14px rgba(0,0,0,.35)}
.bk.sp .bk-pg.bk-r{grid-column:2}
.bk-spine{display:none}.bk.sp .bk-spine{display:block;position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-1px);background:color-mix(in srgb,var(--text) 10%,transparent);pointer-events:none}
.bk-leaf{position:absolute;inset:0;z-index:3;will-change:transform;-webkit-backface-visibility:hidden;backface-visibility:hidden;transform-origin:left center;pointer-events:none}
.bk.sp .bk-leaf.bk-r{left:50%;right:0;transform-origin:left center}.bk.sp .bk-leaf.bk-l{left:0;right:50%;transform-origin:right center}
.bk:not(.sp) .bk-leaf{transform-origin:left center}
.bk-shade{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(90deg,rgba(0,0,0,.05),rgba(0,0,0,.35) 70%,rgba(255,255,255,.08))}
.bk-cast{position:absolute;top:0;bottom:0;z-index:2;width:38%;pointer-events:none;opacity:0;background:linear-gradient(90deg,rgba(0,0,0,.45),transparent)}
.bk-cast.r{left:0}.bk.sp .bk-cast.r{left:50%}.bk-cast.l{right:0;background:linear-gradient(270deg,rgba(0,0,0,.45),transparent)}.bk.sp .bk-cast.l{right:50%}
.bk-pc{height:100%;overflow-y:auto;overscroll-behavior:contain;padding:26px 24px 46px 30px;background-image:repeating-linear-gradient(transparent 0 31px,color-mix(in srgb,var(--text) 5%,transparent) 31px 32px);background-attachment:local;scrollbar-width:thin;outline:0}
.bk.sp .bk-l .bk-pc{padding:26px 30px 46px 24px}
.bk-ph{margin-bottom:14px}.bk-ph h2{font:700 clamp(20px,5.4vw,26px)/1.2 var(--f-display);margin:4px 0 0;overflow-wrap:anywhere}
.bk-e{margin:0 0 22px}.bk-eh{display:flex;align-items:center;gap:10px;margin-bottom:6px}.bk-tm{font:600 12px var(--f-body);color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;min-width:4.6em}
.bk-mood{font-size:13px;color:var(--muted)}.bk-ed{margin-left:auto;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;border:1px solid var(--line);background:none;color:var(--muted);cursor:pointer}.bk-ed svg{width:16px;height:16px}
.bk-e h3{font:700 18px/1.3 var(--f-body);margin:0 0 6px;overflow-wrap:anywhere}
.bk-x{font-size:16.5px;line-height:1.75;overflow-wrap:anywhere}.bk-x p{margin:0 0 10px}.bk-x img{max-width:100%;height:auto;border-radius:10px}.bk-x ul,.bk-x ol{padding-left:22px;margin:0 0 10px}
.bk-img{display:block;max-width:100%;max-height:46vh;border-radius:12px;margin:6px 0 10px}
.bk-g{margin-top:6px;font-size:13px;color:var(--muted)}
.bk-mos{display:flex;flex-direction:column;gap:6px;margin:4px 0 18px;padding-top:12px;border-top:1px dashed var(--line)}
.bk-mo{display:flex;gap:10px;font-size:14px;line-height:1.45;color:var(--text)}.bk-mo em{color:var(--muted);font-style:normal}
.bk-empty{color:var(--muted);font-style:italic;margin:8px 0 18px}
.bk-add{display:inline-flex;align-items:center;gap:8px;margin-top:4px;padding:10px 14px;border-radius:12px;border:1px dashed color-mix(in srgb,var(--accent) 55%,var(--line));background:none;color:var(--accent);font:600 14px var(--f-body);cursor:pointer}.bk-add svg{width:16px;height:16px}
.bk-pn{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-size:11px;pointer-events:none;color:var(--muted)}
.bk-cover .bk-cv{min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:8px;padding:10% 4%}
.bk-cover{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 28%,var(--surface)),var(--surface) 70%)}
.bk-cover h2{font:800 clamp(30px,8vw,48px)/1.05 var(--f-display);margin:0;overflow-wrap:anywhere}.bk-cover p{margin:0;color:var(--muted)}.bk-hint{margin-top:18px!important;font-size:13px}
.bk-blank{background:none}
.bk-bot{display:flex;align-items:center;gap:10px;padding:4px 14px 12px;position:relative;z-index:6}
.bk-nx svg{transform:scaleX(-1)}
.bk-scr{position:relative;flex:1;min-width:0;display:flex;align-items:center}.bk-scr input{width:100%;accent-color:var(--accent)}
.bk-bub{position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 9px;border-radius:999px;background:var(--surface-2,var(--surface));border:1px solid var(--line);font-size:11.5px}.bk-bub:empty{display:none}
.bk-ix{position:absolute;top:0;padding-top:max(12px,env(safe-area-inset-top));bottom:0;right:0;width:min(340px,88vw);z-index:8;overflow-y:auto;overscroll-behavior:contain;background:var(--surface);border-left:1px solid var(--line);box-shadow:-24px 0 40px -20px rgba(0,0,0,.5);padding:12px 10px calc(16px + env(safe-area-inset-bottom))}
.bk-ixh{display:flex;align-items:center;justify-content:space-between;padding:6px 6px 10px;position:sticky;top:-12px;background:var(--surface);z-index:1}
.bk-ixm{margin:14px 8px 6px}
.bk-ixr{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border:0;border-radius:12px;background:none;color:var(--text);text-align:left;font:inherit;cursor:pointer}.bk-ixr.on{background:color-mix(in srgb,var(--accent) 16%,transparent)}
.bk-ixd{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:10px;background:color-mix(in srgb,var(--text) 7%,transparent);font:700 14px var(--f-body)}
.bk-ixt{min-width:0;display:flex;flex-direction:column}.bk-ixt b{font-size:14px}.bk-ixt small{color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bk-fade{animation:bkFade .32s ease}@keyframes bkFade{from{opacity:.35}to{opacity:1}}
.bk-open svg{width:17px;height:17px}
@media(max-width:560px){.bk-open{display:none!important}}
.jw-more:has(.bk-chip){display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
@media(prefers-reduced-motion:reduce){.bk{transition:none}}
`;document.head.appendChild(css);
})();
