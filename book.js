/* ================= Journal book (1.59): the journal as a real book =================
   One page per day: everything written that day in full, and the day's moments (steps done, goals, focus) as short
   lines. One page on a phone, a two-page spread from 900 px. A leather cover, page edges that thicken on the side you've
   read, gutter shading at the spine, warm paper with grain, and serif diary type.
   Turning: the page folds along a line under the finger, like paper. The fold line is the perpendicular bisector of the
   finger and the page corner it lifts (top or bottom, from where the drag starts); the page keeps the part on the spine
   side, and the rest is reflected over the fold and shows its back. On a spread that back is the next left page, so it
   lands the right way round; on a phone it is the blank back of the paper. The flap has shading along the fold, casts
   a shadow on the page below and a drop shadow on the page it covers. The corner is held within reach of the spine so
   the paper never "tears". Drag follows the finger frame by frame; let go past a quarter (or flick) and it finishes,
   tap near an edge, use the arrows or the keyboard. A timer finishes every turn even if frames are skipped. Reduced
   motion: pages cross-fade. No preserve-3d anywhere, so Android WebView can't flatten or mirror it. */
(()=>{
'use strict';
Object.assign(IC,{book:'<path d="M12 6.2C10.1 4.8 7.4 4.2 4 4.4v13.7c3.4-.2 6.1.4 8 1.8 1.9-1.4 4.6-2 8-1.8V4.4c-3.4-.2-6.1.4-8 1.8z"/><path d="M12 6.2v13.7"/>',ixl:'<path d="M4 6h16M4 12h16M4 18h10"/>'});
const B={open:false,P:[],i:0,busy:false,ix:false,focus:'',sp:false};
const wide=()=>innerWidth>=900;
const dayOf=t=>ymd(new Date(t));
/* the pages: a cover, one page per day that has entries (oldest first), and today's page to write on */
function pages(){const D={};S.entries.filter(e=>e&&e.type!=='token').forEach(e=>{(D[dayOf(e.t)]=D[dayOf(e.t)]||[]).push(e)});
 const td=ymd();if(!D[td])D[td]=[];
 return[{k:'cover'},...Object.keys(D).sort().map(d=>({k:'day',d,E:D[d].sort((a,b)=>a.t-b.t)}))]}
const dt=d=>new Date(d+'T12:00');
function entryHTMLb(e,first){const g=G(e.goalId),tm=new Date(e.t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 if(e.type==='note')return`<article class="bk-e${first?' first':''}"><div class="bk-eh"><span class="bk-tm">${esc(tm)}</span>${e.mood?`<span class="bk-mood">${e.mood} <i>${esc(MOODN[e.mood]||'')}</i></span>`:''}<button class="bk-ed" data-act="bkEdit" data-id="${e.id}" aria-label="Edit this entry" title="Edit">${ic('edit')}</button></div>${e.title?`<h3>${esc(e.title)}</h3>`:''}${e.img?`<img class="bk-img" src="${e.img}" alt="">`:''}<div class="bk-x">${richOf(e)}</div>${g?`<div class="bk-g">— for “${esc(g.title)}”</div>`:''}</article>`;
 const kind=JK[e.type]||'Moment',txt=e.title||e.text||kind;return`<li><span class="bk-tm">${esc(tm)}</span><span><b>${esc(kind)}.</b> ${esc(trunc(String(txt),140))}${g&&e.type!=='goal-new'&&e.type!=='goal-done'?` <em>(${esc(trunc(g.title,40))})</em>`:''}</span></li>`}
function pageHTML(p,n){if(!p)return`<div class="bk-pc bk-blank"></div>`;
 if(p.k==='cover'){const all=S.entries.filter(e=>e.type!=='token'),first=all.reduce((a,e)=>Math.min(a,e.t),Date.now()),nm=S.settings.name,y0=new Date(first).getFullYear(),y1=new Date().getFullYear();
  return`<div class="bk-pc bk-cover"><div class="bk-cvf"><div class="bk-cvo">✦</div><h2>Journal</h2><div class="bk-cvn">${nm?esc(nm):'My days, in my words'}</div><div class="bk-cvy">${y0===y1?y0:y0+' – '+y1}</div><div class="bk-cvo">✦</div></div><p class="bk-hint">${all.length} entr${all.length===1?'y':'ies'} · drag the page or tap its edge to turn</p></div>`}
 const w=p.E.filter(e=>e.type==='note'),m=p.E.filter(e=>e.type!=='note'),today=p.d===ymd(),D=dt(p.d);
 return`<div class="bk-pc"><div class="bk-run">${esc(D.toLocaleDateString(undefined,{month:'long',year:'numeric'}))}</div>
 <header class="bk-ph"><div class="bk-dn">${D.getDate()}</div><div class="bk-dw"><b>${esc(D.toLocaleDateString(undefined,{weekday:'long'}))}</b><span>${today?'Today':esc(D.toLocaleDateString(undefined,{month:'long',day:'numeric'}))}</span></div></header>
 <div class="bk-body">${w.map((e,k)=>(k?'<div class="bk-orn" aria-hidden="true">⁂</div>':'')+entryHTMLb(e,k===0)).join('')}${m.length?`<ul class="bk-mos">${m.map(e=>entryHTMLb(e)).join('')}</ul>`:''}${!p.E.length?`<p class="bk-empty">${today?'A fresh page for today.':'Nothing was written this day.'}</p>`:''}
 <button class="bk-add" data-act="bkWrite" data-d="${p.d}">${ic('edit')}<span>${w.length?'Add to this day':today?'Write today’s page':'Write on this page'}</span></button></div>
 <footer class="bk-pn">${n}</footer></div>`}
/* which pages are on screen: one (phone) or a left/right spread starting at an even index */
const step=()=>B.sp?2:1;
const clampI=i=>{const L=B.P.length;i=Math.max(0,Math.min(i,L-1));return B.sp?i-(i%2):i};
function shell(){return`<div id="book" class="bk${B.sp?' sp':''}${paperDark()?' dk':''}" role="dialog" aria-modal="true" aria-label="Journal book">
 <div class="bk-top"><button class="bk-ib" data-act="bkClose" aria-label="Close the book" title="Close (Esc)">${ic('x')}</button><div class="bk-tt" id="bkCount" aria-live="polite"></div><button class="bk-ib" data-act="bkIx" aria-label="Contents" title="Contents" aria-expanded="false">${ic('ixl')}</button><button class="bk-ib bk-wr" data-act="bkWrite" data-d="${ymd()}" aria-label="Write today" title="Write today">${ic('edit')}</button></div>
 <div class="bk-stage" id="bkStage"><div class="bk-book" id="bkBook"><i class="bk-edge l" aria-hidden="true"></i><i class="bk-edge r" aria-hidden="true"></i><div class="bk-pg bk-l" id="bkL"></div><div class="bk-pg bk-r" id="bkR"></div></div></div>
 <div class="bk-bot"><button class="bk-ib" data-act="bkPrev" aria-label="Previous page">${ic('back')}</button><div class="bk-scr"><input type="range" id="bkRange" min="0" aria-label="Go to a page"><span class="bk-bub" id="bkBub"></span></div><button class="bk-ib bk-nx" data-act="bkNext" aria-label="Next page">${ic('back')}</button></div>
 <aside class="bk-ix" id="bkIx" aria-label="Contents" hidden></aside></div>`}
/* the paper follows the theme: warm cream in light themes, warm charcoal in dark ones */
function paperDark(){const c=getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)||[255,255,255];return(.299*c[0]+.587*c[1]+.114*c[2])<128}
const $b=s=>document.querySelector('#book '+s);
function paint(){const L=$b('#bkL'),R=$b('#bkR');if(!R)return;const i=B.i;
 if(B.sp){L.innerHTML=pageHTML(B.P[i],i+1);R.innerHTML=pageHTML(B.P[i+1],i+2)}else{L.innerHTML='';R.innerHTML=pageHTML(B.P[i],i+1)}
 const c=$b('#bkCount'),p=B.P[B.sp&&B.P[i+1]?i+1:i];if(c)c.innerHTML=`<b>${p&&p.k==='day'?esc(dt(p.d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})):'Journal'}</b><small>${i+1}${B.sp&&B.P[i+1]?'–'+(i+2):''} of ${B.P.length}</small>`;
 const r=$b('#bkRange');if(r){r.max=B.P.length-1;r.step=1;r.value=i}
 const pv=$b('[data-act=bkPrev]'),nx=$b('[data-act=bkNext]');if(pv)pv.disabled=i<=0;if(nx)nx.disabled=i+step()>=B.P.length;
 /* the page edges: thicker on the side you have read */
 const n=B.P.length,el=$b('.bk-edge.l'),er=$b('.bk-edge.r'),th=k=>Math.round(Math.min(9,2+k*.35));if(el)el.style.setProperty('--t',th(i)+'px');if(er)er.style.setProperty('--t',th(n-1-i-(B.sp?1:0))+'px');
 if(B.ix)ixPaint()}
function ixPaint(){const el=$b('#bkIx');if(!el)return;const G0={};B.P.forEach((p,k)=>{if(p.k!=='day')return;const m=p.d.slice(0,7);(G0[m]=G0[m]||[]).push([p,k])});
 el.innerHTML=`<div class="bk-ixh"><b>Contents</b><button class="bk-ib" data-act="bkIx" aria-label="Close contents">${ic('x')}</button></div><button class="bk-ixr${B.i===0?' on':''}" data-act="bkGo" data-i="0"><span class="bk-ixd">✦</span><span class="bk-ixt"><b>Cover</b></span></button>`+Object.keys(G0).reverse().map(m=>`<div class="bk-ixm">${esc(new Date(m+'-15T12:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}))}</div>`+G0[m].slice().reverse().map(([p,k])=>{const w=p.E.find(e=>e.type==='note'),on=k===B.i||(B.sp&&k===B.i+1);
  return`<button class="bk-ixr${on?' on':''}" data-act="bkGo" data-i="${k}"><span class="bk-ixd">${dt(p.d).getDate()}</span><span class="bk-ixt"><b>${esc(dt(p.d).toLocaleDateString(undefined,{weekday:'long'}))}${w&&w.mood?' '+w.mood:''}</b><small>${esc(w?trunc(w.title||htmlText(richOf(w)).replace(/\s+/g,' '),60)||'Entry':p.E.length?p.E.length+' moment'+(p.E.length===1?'':'s'):'Blank page')}</small></span><span class="bk-ixp">${k+1}</span></button>`}).join('')).join('');
 const on=el.querySelector('.bk-ixr.on');if(on)on.scrollIntoView({block:'center'})}

/* ---------------- the fold ----------------
   Geometry runs in a "page frame": the spine at x=0, the outer edge at x=W. The left page of a spread is the same frame
   mirrored (css x = W - x). P is the lifted corner, C the corner it came from. */
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function halfPlane(pts,n,M,keepSpine){const s=X=>dot([X[0]-M[0],X[1]-M[1]],n)*(keepSpine?-1:1),out=[];
 for(let k=0;k<pts.length;k++){const A=pts[k],Z=pts[(k+1)%pts.length],sa=s(A),sz=s(Z);if(sa>=0)out.push(A);if((sa>=0)!==(sz>=0)){const t=sa/(sa-sz);out.push([A[0]+(Z[0]-A[0])*t,A[1]+(Z[1]-A[1])*t])}}return out}
const poly=pts=>pts.length>2?`polygon(${pts.map(p=>p[0].toFixed(1)+'px '+p[1].toFixed(1)+'px').join(',')})`:'polygon(0 0,0 0,0 0)';
/* keep the corner within reach of the spine so the paper never tears */
function reach(P,W,H,cy){const S1=[0,cy],S2=[0,H-cy],r1=W,r2=Math.hypot(W,H);let p=P.slice();
 const lim=(c,r)=>{const dx=p[0]-c[0],dy=p[1]-c[1],d=Math.hypot(dx,dy);if(d>r){p=[c[0]+dx/d*r,c[1]+dy/d*r]}};lim(S1,r1);lim(S2,r2);return p}
let T=null;
function layer(cls,html,box){const d=document.createElement('div');d.className='bk-lay '+cls;Object.assign(d.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});if(html!=null)d.innerHTML=html;return d}
function turnStart(dir,startY){if(B.busy)return false;const ni=clampI(B.i+dir*step());if(ni===B.i)return false;const book=$b('#bkBook');if(!book)return false;
 const L=$b('#bkL'),R=$b('#bkR'),i=B.i,sp=B.sp,mir=sp&&dir<0,pg=mir?L:R,br=book.getBoundingClientRect(),pr=pg.getBoundingClientRect(),W=pr.width,H=pr.height,box={x:pr.left-br.left,y:pr.top-br.top,w:W,h:H};
 const scrollOf=el=>{const c=el.querySelector('.bk-pc');return c?c.scrollTop:0};
 let frontP,frontN,backP,backN,underEl=pg,underHTML;
 if(sp&&dir>0){frontP=B.P[i+1];frontN=i+2;backP=B.P[i+2];backN=i+3;underHTML=pageHTML(B.P[i+3],i+4)}
 else if(sp){frontP=B.P[i];frontN=i+1;backP=B.P[i-1];backN=i;underHTML=pageHTML(B.P[i-2],i-1)}
 else if(dir>0){frontP=B.P[i];frontN=i+1;underHTML=pageHTML(B.P[i+1],i+2)}
 else{frontP=B.P[i-1];frontN=i;underHTML=null}
 const sc=(dir>0||sp)?scrollOf(pg):0;
 const front=layer('bk-pg bk-front'+(mir?' bk-l':' bk-r'),pageHTML(frontP,frontN),box);
 if(underHTML!=null)underEl.innerHTML=underHTML;
 const cast=layer('bk-cast',null,box);
 const flapW=layer('bk-flapw',null,box),flapC=document.createElement('div');flapC.className='bk-pg bk-flap'+(mir?' bk-r':' bk-l');
 flapC.innerHTML=(sp?`<div class="bk-back" style="width:${W}px;height:${H}px">${pageHTML(backP,backN)}</div>`:'<div class="bk-back bk-paperback"></div>')+'<i class="bk-gloss"></i>';flapW.appendChild(flapC);
 book.append(cast,front,flapW);const fc=front.querySelector('.bk-pc');if(fc)fc.scrollTop=sc;
 const cy=(startY!=null?startY:H*.82)>H/2?H:0;
 T={dir,ni,W,H,mir,cy,front,cast,flapW,flapC,P:dir>0||sp?[W,cy]:[-W,cy],done:false};
 B.busy=true;foldTo(T.P);return true}
/* the corner positions that mean "not turned" and "fully turned" for this turn */
const P0=t=>t.dir>0||t.mir?[t.W,t.cy]:[-t.W,t.cy],P1=t=>t.dir>0||t.mir?[-t.W,t.cy]:[t.W,t.cy];
function foldTo(Pin){const t=T;if(!t)return;const{W,H,cy,mir}=t;let P=reach(Pin,W,H,cy);t.P=P;const C=[W,cy];
 const css=X=>mir?[W-X[0],X[1]]:X,v=[C[0]-P[0],C[1]-P[1]],len=Math.hypot(v[0],v[1]);
 if(len<.5){t.front.style.clipPath='none';t.flapW.style.visibility='hidden';t.cast.style.opacity=0;return}
 t.flapW.style.visibility='visible';const n=[v[0]/len,v[1]/len],M=[(P[0]+C[0])/2,(P[1]+C[1])/2],rect=[[0,0],[W,0],[W,H],[0,H]];
 const keep=halfPlane(rect,n,M,true),fold=halfPlane(rect,n,M,false);
 t.front.style.clipPath=poly(keep.map(css));
 /* the flap: the folded part, reflected over the fold line (in css space, mirrored for a left page) */
 const refl=X=>{const d=2*dot([X[0]-M[0],X[1]-M[1]],n);return[X[0]-d*n[0],X[1]-d*n[1]]};
 const F=X=>css(refl(css(X))),o=F([0,0]),ex=F([1,0]),ey=F([0,1]);
 t.flapW.style.transform=`matrix(${(ex[0]-o[0]).toFixed(5)},${(ex[1]-o[1]).toFixed(5)},${(ey[0]-o[0]).toFixed(5)},${(ey[1]-o[1]).toFixed(5)},${o[0].toFixed(2)},${o[1].toFixed(2)})`;
 t.flapC.style.clipPath=poly(fold.map(css));
 /* shading along the fold, in the flap's own (unreflected) coordinates */
 const nc=mir?[-n[0],n[1]]:n,Mc=css(M),ang=Math.atan2(nc[0],-nc[1]),Lg=Math.abs(W*Math.sin(ang))+Math.abs(H*Math.cos(ang)),Sx=W/2-nc[0]*Lg/2,Sy=H/2-nc[1]*Lg/2,dF=(Mc[0]-Sx)*nc[0]+(Mc[1]-Sy)*nc[1],half=len/2,deg=(ang*180/Math.PI).toFixed(2);
 const p=Math.max(0,Math.min(1,Math.abs(P[0]-P0(t)[0])/(2*W))),k=Math.sin(Math.PI*Math.min(1,p*1.15));
 t.flapC.querySelector('.bk-gloss').style.background=`linear-gradient(${deg}deg,rgba(0,0,0,0) ${dF-1}px,rgba(0,0,0,.28) ${dF}px,rgba(255,255,255,.22) ${dF+Math.min(14,half*.2)}px,rgba(255,255,255,0) ${dF+half*.45}px,rgba(0,0,0,.12) ${dF+half}px)`;
 t.flapW.style.filter=`drop-shadow(${(-nc[0]*9*k).toFixed(1)}px ${(-nc[1]*9*k).toFixed(1)}px ${(6+12*k).toFixed(1)}px rgba(0,0,0,${(.42*k+.08).toFixed(2)}))`;
 t.cast.style.clipPath=poly(fold.map(css));t.cast.style.opacity=1;
 t.cast.style.background=`linear-gradient(${deg}deg,rgba(0,0,0,0) ${dF-1}px,rgba(0,0,0,${(.5*k+.1).toFixed(2)}) ${dF}px,rgba(0,0,0,0) ${dF+Math.max(30,Math.min(90,half*.6))}px)`;
 t.front.style.setProperty('--fs',(k*.18).toFixed(3))}
function turnEnd(done){if(!T)return;const t=T;T=null;[t.front,t.cast,t.flapW].forEach(x=>x&&x.remove());if(done)B.i=t.ni;B.busy=false;paint()}
/* finish (or undo) the turn: the corner travels in a slight arc, the way a hand lifts a page */
function animTo(target,ms,cb){const t=T;if(!t)return cb&&cb();const a=t.P.slice(),t0=performance.now(),ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,lift=(t.cy?-1:1)*t.H*.16;let fin=false;
 const end=()=>{if(fin)return;fin=true;if(T===t){foldTo(target);cb&&cb()}};
 const tick=now=>{if(fin||T!==t)return;const k=Math.min(1,(now-t0)/ms),e=ease(k);foldTo([a[0]+(target[0]-a[0])*e,a[1]+(target[1]-a[1])*e+lift*Math.sin(Math.PI*e)*Math.min(1,Math.abs(target[0]-a[0])/t.W)]);if(k<1)requestAnimationFrame(tick);else end()};
 requestAnimationFrame(tick);setTimeout(end,ms+150)}
function turn(dir){if(B.busy)return;if(reduced()){const ni=clampI(B.i+dir*step());if(ni===B.i)return;B.i=ni;fade();return}if(!turnStart(dir))return;try{vib()}catch(e){}animTo(P1(T),B.sp?880:760,()=>turnEnd(true))}
function fade(){const bk=$b('#bkBook');paint();if(bk){bk.classList.remove('bk-fade');void bk.offsetWidth;bk.classList.add('bk-fade')}}
function jump(k){k=clampI(+k);if(k===B.i)return;B.i=k;fade()}

/* drag: the lifted corner follows the finger; past a quarter (or a flick) it finishes */
let D=null,RAF=0;
function onDown(e){if(!B.open||B.busy||e.button>0||e.target.closest('button,a,input,select,textarea,.bk-ix,.bk-top,.bk-bot'))return;const bk=$b('#bkBook');if(!bk||!bk.contains(e.target))return;D={x:e.clientX,y:e.clientY,t:performance.now(),on:false,id:e.pointerId,vx:0,lx:e.clientX,lt:performance.now()}}
function frameXY(e){const t=T,pg=t.mir?$b('#bkL'):$b('#bkR'),r=pg.getBoundingClientRect();let x=e.clientX-r.left,y=e.clientY-r.top;if(t.mir)x=r.width-x;return[x,y]}
function onMove(e){if(!D||e.pointerId!==D.id)return;const dx=e.clientX-D.x,dy=e.clientY-D.y,now=performance.now();
 if(!D.on){if(Math.abs(dx)<9||Math.abs(dx)<Math.abs(dy)*1.25){if(Math.abs(dy)>14)D=null;return}const dir=dx<0?1:-1,pg=(B.sp&&dir<0)?$b('#bkL'):$b('#bkR'),r=pg.getBoundingClientRect();
  if(!turnStart(dir,D.y-r.top)){D=null;return}D.on=true;D.dir=dir;D.o=frameXY({clientX:D.x,clientY:D.y});D.p0=T.P.slice();try{$b("#bkBook").setPointerCapture(e.pointerId)}catch(_){}}
 e.preventDefault();D.vx=(e.clientX-D.lx)/Math.max(1,now-D.lt);D.lx=e.clientX;D.lt=now;
 const f=frameXY(e),t=T,k=(!t.mir&&t.dir<0&&!B.sp)?2:1;/* a phone page coming back from the left travels twice as far as the finger */
 const P=[D.p0[0]+(f[0]-D.o[0])*k,D.p0[1]+(f[1]-D.o[1])*.9];cancelAnimationFrame(RAF);RAF=requestAnimationFrame(()=>foldTo(P))}
function onUp(e){if(!D||(e.pointerId!==D.id&&e.type!=='pointercancel'))return;const d=D;D=null;
 if(!d.on){if(e.type==='pointerup'&&Math.abs(e.clientX-d.x)<8&&Math.abs(e.clientY-d.y)<8&&!getSelection().toString()){const bk=$b('#bkBook').getBoundingClientRect(),x=(e.clientX-bk.left)/bk.width;if(x>.85)turn(1);else if(x<.15)turn(-1)}return}
 cancelAnimationFrame(RAF);const t=T;if(!t)return;const a=P0(t),z=P1(t),prog=Math.abs(t.P[0]-a[0])/Math.abs(z[0]-a[0]),fl=d.vx*(t.dir>0?-1:1)*(t.mir?-1:1);
 const go=prog>.25||fl>.5;animTo(go?z:a,Math.round((go?1-prog:prog)*620+180),()=>turnEnd(go))}

/* ---------------- open, close, write ---------------- */
function open(atDay){B.P=pages();B.sp=wide();let i=B.P.length-1;if(atDay){const k=B.P.findIndex(p=>p.d===atDay);if(k>=0)i=k}B.i=clampI(i);B.ix=false;
 let el=document.getElementById('book');if(el)el.remove();document.body.insertAdjacentHTML('beforeend',shell());el=document.getElementById('book');B.open=true;
 document.documentElement.classList.add('bk-on');try{history.pushState({book:1},'')}catch(e){}paint();requestAnimationFrame(()=>el.classList.add('in'))}
function close(fromPop){const el=document.getElementById('book');if(!el)return;B.open=false;T=null;B.busy=false;document.documentElement.classList.remove('bk-on');el.classList.remove('in');setTimeout(()=>el.remove(),300);
 if(!fromPop&&history.state&&history.state.book){BKB=1;try{history.back()}catch(e){BKB=0}}if(cur.p==='journal'||cur.p==='threads')render(false)}
let BKB=0;
addEventListener('popstate',e=>{if(BKB){BKB=0;return}if(B.open&&!(e.state&&e.state.book)&&!$('#sheet').classList.contains('on')){close(true)}});
{const _b=window.__back;window.__back=function(){if(B.open&&!$('#sheet').classList.contains('on')){if(B.ix){B.ix=false;ixShow();return true}close();return true}return _b.apply(this,arguments)}}
/* after writing or editing, the book comes back on that day */
{const _cs=closeSheet;closeSheet=function(){const r=_cs.apply(this,arguments);if(B.open){setTimeout(()=>{if(!B.open)return;const d=B.focus||(B.P[B.i]&&B.P[B.i].d);B.P=pages();const k=B.P.findIndex(p=>p.d===d);B.i=clampI(k>=0?k:B.i);paint()},420)}return r}}
function ixShow(){const el=$b('#bkIx'),b=$b('.bk-top [data-act=bkIx]');if(!el)return;el.hidden=!B.ix;if(b)b.setAttribute('aria-expanded',B.ix);if(B.ix)ixPaint()}
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
document.addEventListener('input',e=>{if(e.target.id!=='bkRange')return;const p=B.P[+e.target.value],b=$b('#bkBub');if(b)b.textContent=p?(p.k==='cover'?'Cover':dt(p.d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})):''});
document.addEventListener('change',e=>{if(e.target.id!=='bkRange')return;const b=$b('#bkBub');if(b)b.textContent='';jump(e.target.value)});
addEventListener('resize',()=>{if(!B.open||B.busy)return;const sp=wide();if(sp!==B.sp){B.sp=sp;B.i=clampI(B.i);document.getElementById('book').classList.toggle('sp',sp)}paint()});
/* Book is a third tab next to Journal and Notes, where people look for it (it opens the book over the page) */
if(typeof jSwitchRow==='function'){const _js=jSwitchRow;jSwitchRow=function(on){return _js.apply(this,arguments).replace(/(data-act="jvGo" data-v="threads">[^<]*<\/button>)/,`$1<button role="tab" aria-selected="false" class="bk-tab" data-act="jvGo" data-v="book">${ic('book')}Book</button>`)}}
{const _jv=ACT.jvGo;ACT.jvGo=function(d){if(d&&d.v==='book'){open();return}return _jv.apply(this,arguments)}}
if(typeof booted!=='undefined'&&booted&&(cur.p==='journal'||cur.p==='threads'))render(false);
window.BOOK={open,close,state:()=>({open:B.open,i:B.i,n:B.P.length,sp:B.sp,busy:B.busy})};

const GRAIN=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .42 0 0 0 0 .35 0 0 0 0 .25 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const css=document.createElement('style');css.textContent=`
html.bk-on{overflow:hidden}
.bk{--pp:#f7f1e4;--pp2:#efe6d3;--ink:#2b261f;--ink2:#7c705e;--rule:rgba(90,70,40,.16);--acc:#8a5a2b;--desk:radial-gradient(130% 100% at 50% 35%,#ece6dc 0,#d9d1c4 60%,#c9bfaf 100%);--board:#5a3a2a;
 position:fixed;inset:0;z-index:56;display:flex;flex-direction:column;background:var(--desk);color:var(--ink);opacity:0;transition:opacity .3s ease;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);-webkit-tap-highlight-color:transparent}
.bk.dk{--pp:#25221e;--pp2:#1f1c19;--ink:#ece4d6;--ink2:#a2967f;--rule:rgba(236,220,190,.12);--acc:#d9b27c;--desk:radial-gradient(130% 100% at 50% 35%,#2e2a26 0,#191715 62%,#0d0c0b 100%);--board:#3a281f}
.bk.in{opacity:1}
.bk-top{display:flex;align-items:center;gap:6px;padding:8px 10px 4px;position:relative;z-index:6}
.bk-ib{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:50%;border:0;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink);cursor:pointer;transition:background .2s,transform .15s}.bk-ib:active{transform:scale(.92)}.bk-ib:disabled{opacity:.3;cursor:default}.bk-ib svg{width:19px;height:19px}
.bk-wr{background:var(--acc);color:var(--pp)}
.bk-tt{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif}.bk-tt b{font-size:16px;font-weight:600}.bk-tt small{font-size:12px;color:var(--ink2);font-variant-numeric:tabular-nums}
.bk-stage{flex:1;min-height:0;display:flex;align-items:stretch;justify-content:center;padding:8px 14px 10px;overflow:hidden}
.bk-book{position:relative;width:100%;max-width:560px;display:grid;grid-template-columns:1fr;touch-action:pan-y;border-radius:4px 10px 10px 4px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.bk.sp .bk-book{max-width:1220px;grid-template-columns:1fr 1fr;border-radius:10px}
/* the cover boards behind the pages */
.bk-book::before{content:"";position:absolute;inset:-7px -8px -9px -5px;border-radius:6px 14px 14px 6px;background:linear-gradient(160deg,color-mix(in srgb,var(--board) 85%,#fff 8%),var(--board) 45%,color-mix(in srgb,var(--board) 80%,#000));box-shadow:0 30px 60px -24px rgba(0,0,0,.6),0 8px 18px -8px rgba(0,0,0,.4)}
.bk.sp .bk-book::before{inset:-8px -9px -10px;border-radius:14px}
/* the stack of page edges at the outer sides */
.bk-edge{position:absolute;top:3px;bottom:3px;width:var(--t,3px);z-index:0;background:repeating-linear-gradient(90deg,var(--pp2) 0 1px,color-mix(in srgb,var(--pp2) 70%,#000) 1px 1.6px);border-radius:2px;transition:width .3s}
.bk-edge.r{right:calc(-1 * var(--t,3px))}.bk-edge.l{left:calc(-1 * var(--t,3px));display:none}.bk.sp .bk-edge.l{display:block}
.bk-pg{position:relative;min-width:0;min-height:0;grid-row:1;overflow:hidden;background-color:var(--pp);background-image:${GRAIN},linear-gradient(90deg,rgba(0,0,0,.07),rgba(0,0,0,0) 7%,rgba(0,0,0,0) 93%,rgba(0,0,0,.03));border-radius:3px 8px 8px 3px;z-index:1}
.bk-pg.bk-l{display:none}.bk.sp .bk-pg.bk-l{display:block;grid-column:1;border-radius:8px 2px 2px 8px;background-image:${GRAIN},linear-gradient(270deg,rgba(0,0,0,.16),rgba(0,0,0,.05) 5%,rgba(0,0,0,0) 12%)}
.bk.sp .bk-pg.bk-r{grid-column:2;border-radius:2px 8px 8px 2px;background-image:${GRAIN},linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,.05) 5%,rgba(0,0,0,0) 12%)}
.bk:not(.sp) .bk-pg.bk-r{background-image:${GRAIN},linear-gradient(90deg,rgba(0,0,0,.14),rgba(0,0,0,.04) 4%,rgba(0,0,0,0) 9%)}
/* turning layers */
.bk-lay{position:absolute;z-index:3;pointer-events:none}
.bk-lay.bk-pg{display:block!important;grid-column:auto}
.bk-front::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,var(--fs,0));pointer-events:none}
.bk-cast{z-index:2}
.bk-flapw{z-index:4;transform-origin:0 0;will-change:transform,filter}
.bk-flap{position:absolute;inset:0;display:block!important;border-radius:3px 8px 8px 3px;background-image:${GRAIN}}
.bk-back{position:absolute;left:0;top:0;transform:matrix(-1,0,0,1,0,0);transform-origin:50% 50%}
.bk-paperback{inset:0;background:linear-gradient(90deg,var(--pp2),var(--pp))}
.bk-gloss{position:absolute;inset:0;pointer-events:none}
/* the page itself */
.bk-pc{height:100%;overflow-y:auto;overscroll-behavior:contain;padding:28px 30px 54px 38px;scrollbar-width:none;outline:0;font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;position:relative}
.bk-pc::-webkit-scrollbar{display:none}
.bk.sp .bk-l .bk-pc,.bk-flap.bk-l .bk-pc,.bk-lay.bk-l .bk-pc{padding:28px 38px 54px 30px}
.bk-run{text-align:center;font:600 10.5px/1 var(--f-body);letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);margin-bottom:18px}
.bk-ph{display:flex;align-items:center;gap:14px;margin:0 0 20px;padding-bottom:16px;border-bottom:1px solid var(--rule)}
.bk-dn{font:400 58px/.85 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;color:var(--acc);font-variant-numeric:lining-nums}
.bk-dw{display:flex;flex-direction:column;gap:3px}.bk-dw b{font-size:21px;font-weight:600;letter-spacing:.01em}.bk-dw span{font-style:italic;color:var(--ink2);font-size:15px}
.bk-e{margin:0 0 6px}.bk-eh{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.bk-tm{font:600 10.5px var(--f-body);letter-spacing:.12em;text-transform:uppercase;color:var(--ink2);white-space:nowrap;font-variant-numeric:tabular-nums}
.bk-mood{font-size:13px;color:var(--ink2)}.bk-mood i{font-style:italic}
.bk-ed{margin-left:auto;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;border:0;background:none;color:var(--ink2);cursor:pointer;opacity:.75}.bk-ed:hover{opacity:1;background:color-mix(in srgb,var(--ink) 8%,transparent)}.bk-ed svg{width:15px;height:15px}
.bk-e h3{font:600 21px/1.3 inherit;font-family:inherit;margin:0 0 8px;overflow-wrap:anywhere}
.bk-x{font-size:18px;line-height:1.72;overflow-wrap:anywhere;hyphens:auto}.bk-x p{margin:0 0 .7em}.bk-x img{max-width:100%;height:auto;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.18)}.bk-x ul,.bk-x ol{padding-left:22px;margin:0 0 .7em}.bk-x mark{background:color-mix(in srgb,var(--acc) 26%,transparent);color:inherit;border-radius:2px}
.bk-e.first .bk-x>:first-child::first-letter{float:left;font-size:3.4em;line-height:.82;padding:6px 8px 0 0;color:var(--acc);font-weight:500}
.bk-img{display:block;max-width:100%;max-height:44vh;border-radius:4px;margin:6px auto 12px;box-shadow:0 3px 12px rgba(0,0,0,.22);transform:rotate(-.6deg)}
.bk-g{margin-top:2px;font-style:italic;font-size:14px;color:var(--ink2)}
.bk-orn{text-align:center;color:var(--ink2);margin:16px 0 14px;letter-spacing:.4em;font-size:15px}
.bk-mos{list-style:none;margin:18px 0 20px;padding:14px 0 0;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:8px}
.bk-mos li{display:flex;gap:12px;font-size:15px;line-height:1.45}.bk-mos .bk-tm{min-width:5.2em;padding-top:3px}.bk-mos em{color:var(--ink2)}
.bk-empty{color:var(--ink2);font-style:italic;font-size:17px;margin:10px 0 22px}
.bk-add{display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:8px 2px;border:0;border-bottom:1px solid color-mix(in srgb,var(--acc) 45%,transparent);background:none;color:var(--acc);font:italic 16px 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;cursor:pointer}.bk-add svg{width:15px;height:15px}
.bk-pn{position:absolute;bottom:16px;left:0;right:0;text-align:center;font-size:13px;color:var(--ink2);pointer-events:none;font-variant-numeric:oldstyle-nums}
/* the cover: leather with a gold-foil title */
.bk-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:34px;background:radial-gradient(120% 90% at 30% 20%,color-mix(in srgb,var(--board) 70%,#fff 14%),var(--board) 55%,color-mix(in srgb,var(--board) 70%,#000)),${GRAIN};color:#f1e3c0}
.bk-cvf{width:min(100%,360px);padding:42px 24px;border:1px solid rgba(232,200,130,.5);outline:1px solid rgba(232,200,130,.25);outline-offset:6px;border-radius:4px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.bk-cover h2{margin:0;font:500 clamp(40px,11vw,58px)/1 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;letter-spacing:.06em;background:linear-gradient(180deg,#fbeab5 0%,#d8ad55 48%,#f6dd94 62%,#b88a36 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
.bk-cvn{font-style:italic;font-size:18px;color:#ecd9a8}.bk-cvy{font:600 11px var(--f-body);letter-spacing:.3em;color:#d8b874}.bk-cvo{color:#d8b874;font-size:14px}
.bk-hint{margin:0;font:13px var(--f-body);color:rgba(241,227,192,.7);text-align:center}
.bk-blank{background:none}
/* bottom bar and contents */
.bk-bot{display:flex;align-items:center;gap:12px;padding:6px 16px 12px;position:relative;z-index:6}
.bk-nx svg{transform:scaleX(-1)}
.bk-scr{position:relative;flex:1;min-width:0;display:flex;align-items:center}
.bk-scr input{width:100%;height:28px;-webkit-appearance:none;appearance:none;background:none;cursor:pointer}
.bk-scr input::-webkit-slider-runnable-track{height:3px;border-radius:3px;background:color-mix(in srgb,var(--ink) 18%,transparent)}
.bk-scr input::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7.5px;border-radius:50%;background:var(--acc);box-shadow:0 1px 4px rgba(0,0,0,.35)}
.bk-scr input::-moz-range-track{height:3px;border-radius:3px;background:color-mix(in srgb,var(--ink) 18%,transparent)}.bk-scr input::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:var(--acc)}
.bk-bub{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:4px 10px;border-radius:999px;background:var(--pp);color:var(--ink);box-shadow:0 4px 14px rgba(0,0,0,.25);font:13px 'Iowan Old Style',Palatino,Georgia,serif}.bk-bub:empty{display:none}
.bk-ix{position:absolute;top:0;bottom:0;right:0;width:min(360px,90vw);z-index:8;overflow-y:auto;overscroll-behavior:contain;background-color:var(--pp);background-image:${GRAIN};color:var(--ink);box-shadow:-30px 0 50px -20px rgba(0,0,0,.55);padding:max(12px,env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom));font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;animation:bkIx .32s cubic-bezier(.2,.8,.2,1)}
@keyframes bkIx{from{transform:translateX(30px);opacity:0}}
.bk-ixh{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 12px;position:sticky;top:-12px;background:var(--pp);z-index:1}.bk-ixh b{font-size:22px;font-weight:600}
.bk-ixm{margin:18px 8px 8px;font:600 10.5px var(--f-body);letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.bk-ixr{display:flex;align-items:center;gap:12px;width:100%;padding:10px 8px;border:0;border-bottom:1px solid var(--rule);background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}.bk-ixr.on{background:color-mix(in srgb,var(--acc) 14%,transparent);border-radius:8px}
.bk-ixd{width:34px;flex:none;text-align:center;font-size:22px;color:var(--acc)}
.bk-ixt{flex:1;min-width:0;display:flex;flex-direction:column}.bk-ixt b{font-size:16px;font-weight:600}.bk-ixt small{color:var(--ink2);font-size:14px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bk-ixp{color:var(--ink2);font-size:13px;font-variant-numeric:oldstyle-nums}
.bk-fade{animation:bkFade .35s ease}@keyframes bkFade{from{opacity:.25;transform:scale(.995)}to{opacity:1;transform:none}}
.bk-tab{display:inline-flex;align-items:center;gap:6px}.bk-tab svg{width:16px;height:16px}
@media(max-width:560px){.bk-pc{padding:24px 22px 50px 28px}.bk-x{font-size:17px}.bk-dn{font-size:50px}.bk-stage{padding:6px 12px 8px}}
@media(prefers-reduced-motion:reduce){.bk{transition:none}.bk-ix{animation:none}}
`;document.head.appendChild(css);
})();
