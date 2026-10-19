/* ================= Ink (1.36): handwriting, sketching and text from photos =================
   One drawing surface for the journal and threads.
   - Strokes are kept as vectors (open a sketch again and keep drawing) plus a flat picture, so a sketch shows anywhere
     (cards, print, sync) without this file. Sketches sit in an entry's text as <img data-sk="id"> (see skHydrate in
     index.html) and on thread updates as u.sk.
   - Built for a stylus. Apple Pencil and S Pen pressure and tilt shape the line (tilt a pencil to shade), every
     coalesced sample is used and predicted samples are drawn ahead to hide latency. Palm rejection: once a pen has been
     seen on this device, fingers scroll and zoom instead of drawing, and wide contacts (a resting palm) never draw.
     The S Pen button and a pen's eraser end erase. Hovering pens show where the tip will land. Holding still at the end
     of a stroke snaps it to a clean line, circle, ellipse, rectangle or triangle. Two-finger tap undoes.
   - Text recognition stays on the device: the browser's own handwriting recognizer where there is one (ChromeOS),
     otherwise Tesseract (open-source OCR, loaded once from jsDelivr and cached for offline use). Photos are rebuilt with
     their layout: paragraphs, line breaks, headings, bullet, numbered and checkbox lists, bold and highlighted words.
     With an AI key set up in Workbench › AI, "Read with …" sends just that picture there for messy handwriting.
*/
(()=>{
'use strict';
const W=1000,DPR=()=>Math.min(3,window.devicePixelRatio||1);
const PAPER={light:'#FFFDF8',dark:'#1C1E24'},INKC={light:'#1B1C20',dark:'#F2F1EC'};
const COLORS=['ink','#2F5BEA','#D7263D','#1E9E62','#F08A24','#7B4DDB','#E84393','#8A5A2B','#FFD23F','#5CC8FF'];
const TOOLS=[['pen','Pen'],['pencil','Pencil'],['fountain','Fountain pen'],['marker','Highlighter'],['eraser','Eraser'],['lasso','Select']];
/* preset sizes in screen pixels at the page's normal zoom; strokes keep their size relative to the page */
const SIZES={pen:[1.5,2.6,4,6.5,10],pencil:[2,3.5,6,9,14],fountain:[3,4.5,7,10,15],marker:[10,16,24,34,46],eraser:[10,18,30,46,70]};
const LANGS=[['eng','English','en'],['spa','Spanish','es'],['fra','French','fr'],['deu','German','de'],['ita','Italian','it'],['por','Portuguese','pt'],['nld','Dutch','nl'],['tur','Turkish','tr'],['rus','Russian','ru'],['ara','Arabic','ar'],['urd','Urdu','ur'],['hin','Hindi','hi'],['ben','Bengali','bn'],['chi_sim','Chinese','zh'],['jpn','Japanese','ja'],['kor','Korean','ko']];
const TJS='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
Object.assign(IC,{
 inkpen:'<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.5 7l3.5 3.5"/>',
 inkpencil:'<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M5 19l2.6-.6M14 7l3 3"/>',
 inkfountain:'<path d="M12 3l5 6-5 12-5-12z"/><path d="M12 9v5"/><circle cx="12" cy="9" r="1"/>',
 inkmarker:'<path d="M6 15l7-11 6 4-7 11z"/><path d="M6 15l-1.5 4.5L9 18"/><path d="M4 22h16" opacity=".55"/>',
 inkeraser:'<path d="M8 20h12"/><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H7z"/><path d="M9 11l5 5"/>',
 inklasso:'<path d="M7 17c-3-1.5-4-4.5-2-7.5S12 4 16.5 5.5 21 11 17 13.5 9 14 8 16s1 4 3 4"/>',
 inkundo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
 inkredo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
 inkhand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5v-6a1.5 1.5 0 0 1 3 0V11"/><path d="M14 10.5v-4a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.6 0-4.2-1.4-5.4-3.6L4 14.2a1.5 1.5 0 0 1 2.6-1.5L8 15"/>',
 inkrot:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
 inkdots:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 inkx:'<path d="M6 6l12 12M18 6L6 18"/>',
 inktext:'<path d="M4 7V5h11v2"/><path d="M9.5 5v14"/><path d="M7.5 19h4"/><path d="M14 13h6M17 13v6"/>'});
const cfg=()=>{const s=S.settings;s.ink=Object.assign({tool:'pen',col:{pen:'ink',pencil:'ink',fountain:'ink',marker:'#FFD23F'},sz:{pen:1,pencil:1,fountain:1,marker:1,eraser:2},finger:'auto',paper:'light',bg:'plain',lang:'eng',whole:false},s.ink||{});return s.ink};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem('plotline.ink.'+k);localStorage.setItem('plotline.ink.'+k,v)}catch(e){return null}};
const penSeen=()=>LS('pen')==='1';
const hid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------------- storage: points packed as zigzag deltas in base64url (about 3 characters a point) ---------------- */
const A64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',R64={};[...A64].forEach((c,i)=>R64[c]=i);
function enc(q){let o='';for(let n of q){n=n<0?-2*n-1:2*n;do{let d=n%32;n=Math.floor(n/32);if(n)d+=32;o+=A64[d]}while(n)}return o}
function dec(s){const o=[];let n=0,m=1;for(let i=0;i<s.length;i++){const d=R64[s[i]];if(d===undefined)continue;n+=(d&31)*m;if(d&32)m*=32;else{o.push(n%2?-(n+1)/2:n/2);n=0;m=1}}return o}
function pack(p){const q=[];let lx=0,ly=0,lw=0;for(let i=0;i<p.length;i+=3){const x=Math.round(p[i]*2),y=Math.round(p[i+1]*2),w=Math.round(p[i+2]*64);q.push(x-lx,y-ly,w-lw);lx=x;ly=y;lw=w}return enc(q)}
function unpack(s){const q=dec(s),p=[];let x=0,y=0,w=0;for(let i=0;i+2<q.length;i+=3){x+=q[i];y+=q[i+1];w+=q[i+2];p.push(x/2,y/2,w/64)}return p}
const loadStrokes=sk=>(sk&&sk.s||[]).map(o=>({k:o.k,c:o.c,z:o.z,p:unpack(o.p)})).filter(s=>s.p.length);

/* ---------------- drawing a stroke: one filled path of round dabs joined by quads (all wound the same way, so a
   translucent highlighter or pencil paints each pixel once) ---------------- */
function quad(P,ax,ay,bx,by,cx,cy,dx,dy){const a=(ax*by-bx*ay)+(bx*cy-cx*by)+(cx*dy-dx*cy)+(dx*ay-ax*dy);P.moveTo(ax,ay);if(a<0){P.lineTo(dx,dy);P.lineTo(cx,cy);P.lineTo(bx,by)}else{P.lineTo(bx,by);P.lineTo(cx,cy);P.lineTo(dx,dy)}P.closePath()}
function pathOf(p,z,extra,minR=.3){const P=new Path2D(),h=z/2,n=p.length/3+(extra?extra.length/3:0),at=i=>i*3<p.length?[p[i*3],p[i*3+1],p[i*3+2]]:[extra[i*3-p.length],extra[i*3-p.length+1],extra[i*3-p.length+2]];
 let x0=0,y0=0,r0=0;for(let i=0;i<n;i++){const[x,y,w]=at(i),r=Math.max(minR,h*w);
  if(i){const dx=x-x0,dy=y-y0,d=Math.hypot(dx,dy);if(d>1e-3){const nx=-dy/d,ny=dx/d;quad(P,x0+nx*r0,y0+ny*r0,x+nx*r,y+ny*r,x-nx*r,y-ny*r,x0-nx*r0,y0-ny*r0)}}
  P.moveTo(x+r,y);P.arc(x,y,r,0,Math.PI*2);x0=x;y0=y;r0=r}
 return P}
function bbox(s){if(s._b)return s._b;const p=s.p;let a=1e9,b=1e9,c=-1e9,d=-1e9,m=0;for(let i=0;i<p.length;i+=3){a=Math.min(a,p[i]);b=Math.min(b,p[i+1]);c=Math.max(c,p[i]);d=Math.max(d,p[i+1]);m=Math.max(m,p[i+2])}const r=s.z/2*m;return s._b=[a-r,b-r,c+r,d+r]}
const colOf=(c,pp)=>c==='ink'?INKC[pp||'light']:c;
const alphaOf=s=>s.k==='marker'?.4:s.k==='pencil'?.88:1;
const GRAIN={};
function grain(ctx,col){if(GRAIN[col])return GRAIN[col];const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d'),d=x.createImageData(48,48),[r,g,b]=hexRGB(col);
 for(let i=0;i<d.data.length;i+=4){const v=Math.random();d.data[i]=r;d.data[i+1]=g;d.data[i+2]=b;d.data[i+3]=v<.18?40+v*400:170+v*85}x.putImageData(d,0,0);return GRAIN[col]=ctx.createPattern(c,'repeat')}
function hexRGB(h){const m=/^#?([0-9a-f]{6})$/i.exec(h||'');const n=m?parseInt(m[1],16):0;return[n>>16&255,n>>8&255,n&255]}
function drawStroke(x,s,pp,extra){const col=colOf(s.c,pp);x.globalAlpha=alphaOf(s);x.globalCompositeOperation=s.k==='marker'&&pp!=='dark'?'multiply':'source-over';
 x.fillStyle=s.k==='pencil'?grain(x,col):col;x.fill(extra?pathOf(s.p,s.z,extra):(s._P||(s._P=pathOf(s.p,s.z))));x.globalAlpha=1;x.globalCompositeOperation='source-over'}
function drawPaper(x,pp,bg,x0,y0,x1,y1,H){x.fillStyle=PAPER[pp]||PAPER.light;x.fillRect(0,0,W,H);const dark=pp==='dark';x.lineWidth=1.1;
 if(bg==='lines'){x.strokeStyle=dark?'rgba(140,170,255,.18)':'rgba(70,110,200,.2)';x.beginPath();for(let y=96;y<H;y+=36){if(y<y0-40||y>y1+40)continue;x.moveTo(0,y);x.lineTo(W,y)}x.stroke();x.strokeStyle=dark?'rgba(255,120,120,.22)':'rgba(220,70,70,.3)';x.beginPath();x.moveTo(84,0);x.lineTo(84,H);x.stroke()}
 else if(bg==='grid'){x.strokeStyle=dark?'rgba(255,255,255,.08)':'rgba(40,60,110,.1)';x.beginPath();for(let y=25;y<H;y+=25){if(y<y0-30||y>y1+30)continue;x.moveTo(0,y);x.lineTo(W,y)}for(let v=25;v<W;v+=25){x.moveTo(v,Math.max(0,y0));x.lineTo(v,Math.min(H,y1))}x.stroke()}
 else if(bg==='dots'){x.fillStyle=dark?'rgba(255,255,255,.2)':'rgba(40,60,110,.25)';for(let y=25;y<H;y+=25){if(y<y0-30||y>y1+30)continue;for(let v=25;v<W;v+=25)x.fillRect(v-1.3,y-1.3,2.6,2.6)}}}
function renderSketch(sk,strokes,scale,photo){const H=sk.h,c=document.createElement('canvas');c.width=Math.round(W*scale);c.height=Math.max(1,Math.round(H*scale));const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,0);
 drawPaper(x,sk.pp,photo?'plain':sk.bg,0,0,W,H,H);if(photo)x.drawImage(photo,0,0,W,H);strokes.forEach(s=>drawStroke(x,s,sk.pp));return c}

/* ---------------- shape snapping ---------------- */
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy)}
function rdp(pts,eps){if(pts.length<3)return pts.slice();let mx=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i][0],pts[i][1],a[0],a[1],b[0],b[1]);if(d>mx){mx=d;ix=i}}
 if(mx>eps){const l=rdp(pts.slice(0,ix+1),eps),r=rdp(pts.slice(ix),eps);return l.slice(0,-1).concat(r)}return[a,b]}
function along(V,w,closed){const o=[],L=closed?V.concat([V[0]]):V;for(let i=1;i<L.length;i++){const[a,b]=[L[i-1],L[i]],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/3));for(let k=i===1?0:1;k<=n;k++)o.push(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,w)}return o}
function snapShape(p,minSize){const n=p.length/3;if(n<5)return null;const P=[];let w=0,len=0;for(let i=0;i<n;i++){P.push([p[i*3],p[i*3+1]]);w+=p[i*3+2];if(i)len+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1])}w=clamp(w/n,.5,1.3);
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;P.forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)});const diag=Math.hypot(x1-x0,y1-y0);if(diag<minSize)return null;
 const a=P[0],b=P[n-1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]);
 let mx=0;P.forEach(([x,y])=>{mx=Math.max(mx,segDist(x,y,a[0],a[1],b[0],b[1]))});
 if(ab>minSize*.8&&mx<Math.max(5,ab*.06)&&len<ab*1.25){let ang=Math.atan2(b[1]-a[1],b[0]-a[0]);const sn=Math.round(ang/(Math.PI/4))*(Math.PI/4);let e=b;if(Math.abs(ang-sn)<.07){e=[a[0]+Math.cos(sn)*ab,a[1]+Math.sin(sn)*ab]}return along([a,e],w,false)}
 if(ab>len*.25)return null;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;if(rx<4||ry<4)return null;
 let err=0;P.forEach(([x,y])=>{err+=Math.abs(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)});err/=n;
 const V=rdp(P,Math.max(6,diag*.07));if(V.length>2&&Math.hypot(V[0][0]-V[V.length-1][0],V[0][1]-V[V.length-1][1])<diag*.25)V.pop();
 if(V.length===4&&err>.07){const ok=V.every((v,i)=>{const u=V[(i+1)%4],an=Math.abs(Math.atan2(u[1]-v[1],u[0]-v[0]))%(Math.PI/2);return an<.26||an>Math.PI/2-.26});if(ok)return along([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],w,true);return along(V,w,true)}
 if(V.length===3&&err>.09)return along(V,w,true);
 if(err<.13){const round=Math.abs(rx-ry)/Math.max(rx,ry)<.2,R=(rx+ry)/2,ex=round?R:rx,ey=round?R:ry,o=[],k=Math.max(24,Math.round(Math.PI*2*Math.max(ex,ey)/3));for(let i=0;i<=k;i++){const t=i/k*Math.PI*2;o.push(cx+Math.cos(t)*ex,cy+Math.sin(t)*ey,w)}return o}
 return null}

/* ---------------- overlays and Back ---------------- */
const OVS=[];let INKB=0;
function overlay(cls,html,onBack){const el=document.createElement('div');el.className='ink-ov '+cls;el.innerHTML=html;document.body.appendChild(el);document.documentElement.classList.add('ink-open');
 const o={el,onBack,close(){const i=OVS.indexOf(o);if(i<0)return;OVS.splice(i,1);el.classList.add('out');setTimeout(()=>el.remove(),220);if(!OVS.length)document.documentElement.classList.remove('ink-open');if(!o.pop&&history.state&&history.state.ink){INKB++;try{history.back()}catch(e){INKB--}}}};
 OVS.push(o);try{history.pushState({ink:OVS.length},'')}catch(e){}requestAnimationFrame(()=>el.classList.add('on'));return o}
addEventListener('popstate',e=>{if(INKB){INKB--;e.stopImmediatePropagation();return}const o=OVS[OVS.length-1];if(o){e.stopImmediatePropagation();o.pop=true;o.onBack?o.onBack():o.close()}},true);
{const _b=window.__back;window.__back=function(){const o=OVS[OVS.length-1];if(o){o.onBack?o.onBack():o.close();return true}return _b.apply(this,arguments)}}
addEventListener('keydown',e=>{const o=OVS[OVS.length-1];if(!o)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();o.onBack?o.onBack():o.close();return}if(o.key)o.key(e)},true);
function ask(title,msg,btns){return new Promise(res=>{const d=document.createElement('div');d.className='ink-ask';d.innerHTML=`<div class="ink-ask-b" role="alertdialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${msg?`<p>${esc(msg)}</p>`:''}<div class="ink-ask-a">${btns.map(([k,n,c])=>`<button class="btn ${c||''}" data-k="${k}">${esc(n)}</button>`).join('')}</div></div>`;
 d.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b||e.target===d){d.remove();res(b?b.dataset.k:null)}});document.body.appendChild(d)})}
function loadJS(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Couldn’t load the text reader. Check your connection; after the first time it works offline.'));document.head.appendChild(s)})}
function loadImg(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('Couldn’t read that image'));i.src=src})}

/* ================= the drawing pad ================= */
/* opts: {sk, mode:'draw'|'hand', photo, title, done(sk), text(html,sk), remove()} */
function pad(opts){const C=cfg(),hand=opts.mode==='hand',old=opts.sk||null;
 const P={strokes:loadStrokes(old),pp:old?old.pp||'light':C.paper,bg:old?old.bg||'plain':hand?'lines':C.bg,photo:opts.photo||(old&&old.ph)||'',H:old?old.h:0,s:1,s0:1,ox:0,oy:0,undo:[],redo:[],cur:null,ptrs:new Map(),sel:null,dirty:false,img:null,tool:C.tool==='lasso'||C.tool==='eraser'?'pen':C.tool,tmp:null,gs:null};
 const o=overlay('ink-pad',`
 <div class="ink-top"><button class="ink-ib" data-k="x" aria-label="Close">${ic('inkx')}</button><b class="ink-ttl">${esc(opts.title||(hand?'Write by hand':'Sketch'))}</b>
  <button class="ink-ib" data-k="undo" aria-label="Undo">${ic('inkundo')}</button><button class="ink-ib" data-k="redo" aria-label="Redo">${ic('inkredo')}</button>
  <button class="ink-ib ink-fing" data-k="finger" aria-label="Finger drawing">${ic('inkhand')}</button><button class="ink-ib" data-k="more" aria-label="More">${ic('inkdots')}</button>
  <span class="ink-sp"></span><button class="btn sm ink-tt" data-k="text">${ic('inktext')}<span>To text</span></button><button class="btn sm pri" data-k="done">${opts.sk?'Done':'Insert'}</button></div>
 <div class="ink-stage" tabindex="-1"><canvas class="ink-c"></canvas><canvas class="ink-l"></canvas><div class="ink-hv"></div>
  <div class="ink-selb" hidden><i class="ink-rs" aria-label="Resize"></i></div>
  <div class="ink-selm" hidden><button data-k="sdel">Delete</button><button data-k="sdup">Duplicate</button><button data-k="scol">Recolor</button><button data-k="stxt">To text</button></div>
  <div class="ink-tip" hidden></div></div>
 <div class="ink-bar"><div class="ink-tools" role="toolbar" aria-label="Tools">${TOOLS.map(([k,n])=>`<button class="ink-tool" data-tool="${k}" aria-label="${n}" title="${n}">${ic('ink'+k)}</button>`).join('')}</div>
  <div class="ink-sizes" role="radiogroup" aria-label="Size"></div><div class="ink-cols" role="radiogroup" aria-label="Color"></div></div>
 <div class="ink-menu" hidden></div>`,()=>finish(true));
 const el=o.el,stage=$q('.ink-stage'),cv=$q('.ink-c'),lv=$q('.ink-l'),hv=$q('.ink-hv'),selb=$q('.ink-selb'),selm=$q('.ink-selm'),menu=$q('.ink-menu'),tip=$q('.ink-tip');
 function $q(s){return el.querySelector(s)}
 const fingerDraws=()=>C.finger==='on'||(C.finger==='auto'&&!penSeen());
 /* ---- view ---- */
 let SW=0,SH=0,RAF=0,LRAF=0;
 function fit(){const r=stage.getBoundingClientRect();if(!r.width)return;const first=!SW;SW=r.width;SH=r.height;const d=DPR();[cv,lv].forEach(c=>{c.width=Math.round(SW*d);c.height=Math.round(SH*d)});
  const ps=P.s0;P.s0=Math.min(SW,1180)/W;if(!P.H)P.H=P.photo&&P.img?W*P.img.height/P.img.width:Math.round(clamp(W*SH/SW,700,1800));
  if(first){P.s=P.s0;P.ox=(SW-W*P.s)/2;P.oy=0}else{const f=P.s0/ps;P.s*=f;P.ox*=f;P.oy*=f}clampV();paint()}
 function clampV(){P.s=clamp(P.s,P.s0*.5,P.s0*8);const pw=W*P.s,ph=P.H*P.s;P.ox=pw<=SW?(SW-pw)/2:clamp(P.ox,SW-pw-24,24);P.oy=ph+80<=SH?Math.min(0,Math.max(P.oy,0)):clamp(P.oy,SH-ph-120,40)}
 const toW=(cx,cy)=>{const r=stage.getBoundingClientRect();return[(cx-r.left-P.ox)/P.s,(cy-r.top-P.oy)/P.s]};
 const toS=(x,y)=>[x*P.s+P.ox,y*P.s+P.oy];
 function paint(){cancelAnimationFrame(RAF);RAF=requestAnimationFrame(paintNow)}
 function paintNow(){const x=cv.getContext('2d'),d=DPR();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height);x.setTransform(d*P.s,0,0,d*P.s,d*P.ox,d*P.oy);
  const y0=-P.oy/P.s,y1=(SH-P.oy)/P.s,x0=-P.ox/P.s,x1=(SW-P.ox)/P.s;x.save();x.shadowColor='rgba(0,0,0,.25)';x.shadowBlur=18/P.s*d/d;x.fillStyle=PAPER[P.pp];x.fillRect(0,0,W,P.H);x.restore();
  x.save();x.beginPath();x.rect(0,0,W,P.H);x.clip();drawPaper(x,P.pp,P.photo?'plain':P.bg,x0,y0,x1,y1,P.H);if(P.photo&&P.img)x.drawImage(P.img,0,0,W,P.H);
  const sel=P.sel,mv=P.mv;for(const s of P.strokes){const b=bbox(s);if(b[2]<x0||b[0]>x1||b[3]<y0||b[1]>y1)if(!(sel&&mv&&sel.set.has(s)))continue;
   if(sel&&mv&&sel.set.has(s)){x.save();x.translate(mv.ax,mv.ay);x.scale(mv.k,mv.k);x.translate((mv.dx-mv.ax)/mv.k,(mv.dy-mv.ay)/mv.k);drawStroke(x,s,P.pp);x.restore()}else drawStroke(x,s,P.pp)}
  x.restore();placeSel()}
 function live(){if(LRAF)return;LRAF=requestAnimationFrame(()=>{LRAF=0;const x=lv.getContext('2d'),d=DPR();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,lv.width,lv.height);x.setTransform(d*P.s,0,0,d*P.s,d*P.ox,d*P.oy);
  const c=P.cur;if(c&&c.p.length){lv.style.opacity=c.k==='marker'?.4:1;const s={...c,k:c.k==='marker'?'pen':c.k};x.globalAlpha=1;x.fillStyle=c.k==='pencil'?grain(x,colOf(c.c,P.pp)):colOf(c.c,P.pp);x.fill(pathOf(c.p,c.z,c.snap?null:c.pred));void s}
  if(P.las&&P.las.length>2){x.setLineDash([6/P.s,5/P.s]);x.lineWidth=1.5/P.s;x.strokeStyle=P.pp==='dark'?'#fff':'#2F5BEA';x.beginPath();x.moveTo(P.las[0],P.las[1]);for(let i=2;i<P.las.length;i+=2)x.lineTo(P.las[i],P.las[i+1]);x.closePath();x.stroke();x.fillStyle='rgba(47,91,234,.06)';x.fill();x.setLineDash([])}})}
 /* ---- tools, sizes, colors ---- */
 const tsz=t=>(SIZES[t]||SIZES.pen)[C.sz[t]??1]/P.s0;
 function bar(){el.querySelectorAll('.ink-tool').forEach(b=>{const on=b.dataset.tool===P.tool;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  const t=P.tool==='lasso'?'pen':P.tool,sz=SIZES[t]||SIZES.pen;$q('.ink-sizes').innerHTML=sz.map((v,i)=>`<button class="ink-sz${(C.sz[t]??1)===i?' on':''}" data-sz="${i}" aria-label="Size ${i+1}" role="radio" aria-checked="${(C.sz[t]??1)===i}"><i style="width:${Math.min(26,4+v*(t==='marker'||t==='eraser'?.42:1.5))}px;height:${Math.min(26,4+v*(t==='marker'||t==='eraser'?.42:1.5))}px"></i></button>`).join('');
  const cur=C.col[t]||'ink',cs=t==='eraser'?'':COLORS.map(c=>`<button class="ink-sw${cur===c?' on':''}" data-col="${c}" style="--sw:${colOf(c,P.pp)}" aria-label="${c==='ink'?'Ink':c}" role="radio" aria-checked="${cur===c}"></button>`).join('')+`<label class="ink-sw ink-cust${COLORS.includes(cur)?'':' on'}" style="--sw:${COLORS.includes(cur)?'conic-gradient(red,#ff0,lime,cyan,blue,#f0f,red)':colOf(cur,P.pp)}" aria-label="Pick a color"><input type="color" value="${colOf(cur,P.pp)}"></label>`;
  $q('.ink-cols').innerHTML=t==='eraser'?`<label class="ink-chk"><input type="checkbox" data-k="whole" ${C.whole?'checked':''}> Erase whole strokes</label>`:cs;
  $q('.ink-fing').classList.toggle('on',fingerDraws());$q('.ink-fing').setAttribute('aria-pressed',fingerDraws());$q('.ink-fing').title=fingerDraws()?'Fingers draw (tap to scroll with fingers instead)':'Fingers scroll and zoom; only the pen draws (tap to draw with fingers)';
  $q('[data-k=undo]').disabled=!P.undo.length;$q('[data-k=redo]').disabled=!P.redo.length}
 function setTool(t){P.tool=t;if(t!=='lasso')clearSel();if(t!=='lasso'&&t!=='eraser')C.tool=t;save();bar()}
 const snap=()=>({s:P.strokes,H:P.H});
 function push(){P.undo.push(snap());if(P.undo.length>120)P.undo.shift();P.redo=[];P.dirty=true;bar()}
 function undo(){if(!P.undo.length)return;P.redo.push(snap());const u=P.undo.pop();P.strokes=u.s;P.H=u.H;clearSel();P.dirty=true;clampV();paint();bar()}
 function redo(){if(!P.redo.length)return;P.undo.push(snap());const u=P.redo.pop();P.strokes=u.s;P.H=u.H;clearSel();clampV();paint();bar()}
 function hint(t){tip.textContent=t;tip.hidden=false;clearTimeout(hint.t);hint.t=setTimeout(()=>tip.hidden=true,2400)}
 /* ---- input ---- */
 function pressure(e,c,x,y,t){if(e.pointerType==='pen'&&e.pressure>0){c.lp=c.lp==null?e.pressure:c.lp*.45+e.pressure*.55;return c.lp}
  const dt=Math.max(1,t-(c.lt||t-16)),v=c.lx==null?0:Math.hypot(x-c.lx,y-c.ly)*P.s/dt,tg=clamp(.92-v*.32,.3,.92);c.lp=c.lp==null?.62:c.lp*.7+tg*.3;return c.lp}
 function tiltOf(e){if(e.pointerType!=='pen')return 0;if(typeof e.altitudeAngle==='number'&&e.altitudeAngle>0&&e.altitudeAngle<1.55)return clamp(1-e.altitudeAngle/(Math.PI/2),0,1);const tx=(e.tiltX||0)*Math.PI/180,ty=(e.tiltY||0)*Math.PI/180;if(!tx&&!ty)return 0;return clamp(Math.atan(Math.hypot(Math.tan(tx),Math.tan(ty)))/(Math.PI/2),0,1)}
 function wf(k,p,t,dir){if(k==='marker')return 1;if(k==='pencil')return(.5+.6*p)*(1+2.4*t*t);if(k==='fountain')return(.3+.95*p)*(.28+.72*Math.abs(Math.sin(dir-Math.PI/4)));return .32+.92*p}
 function addPt(c,e,pred){const[x,y]=toW(e.clientX,e.clientY),t=e.timeStamp||performance.now();
  if(pred){const p=c.lp||.6,w=wf(c.k,p,c.tilt||0,c.dir||0);return[x,y,w]}
  const p=pressure(e,c,x,y,t);c.tilt=c.tilt==null?tiltOf(e):c.tilt*.7+tiltOf(e)*.3;
  const n=c.p.length;if(n){const lx=c.p[n-3],ly=c.p[n-2],k=c.sim?.42:.22,sx=lx+(x-lx)*(1-k),sy=ly+(y-ly)*(1-k),d=Math.hypot(sx-lx,sy-ly);if(d<.55/P.s)return;
   if(d>.2)c.dir=c.dir==null?Math.atan2(sy-ly,sx-lx):Math.atan2(sy-ly,sx-lx);c.p.push(sx,sy,wf(c.k,p,c.tilt,c.dir||0))}
  else c.p.push(x,y,wf(c.k,p,c.tilt,0));c.lx=x;c.ly=y;c.lt=t;c.rx=x;c.ry=y}
 function hold(c){clearTimeout(c.ht);if(hand||c.snap||c.k==='eraser')return;c.ht=setTimeout(()=>{if(P.cur!==c||c.snap)return;const r=snapShape(c.p,60/P.s);if(r){c.p=r;c.snap=true;c.pred=null;vib();live()}},560)}
 function start(e,tool){const[x,y]=toW(e.clientX,e.clientY);P.act={id:e.pointerId,type:e.pointerType,tool,t0:performance.now()};
  if(tool==='eraser'){P.eraseSnap=snap();P.erased=false;P.ex=x;P.ey=y;eraseAt(x,y);return}
  if(tool==='lasso'){if(P.sel&&inSel(e.clientX,e.clientY)){P.mv={sx:x,sy:y,dx:0,dy:0,ax:0,ay:0,k:1};return}clearSel();P.las=[x,y];return}
  const t=tool,c={k:t,c:C.col[t]||'ink',z:tsz(t),p:[],sim:e.pointerType!=='pen'||!(e.pressure>0&&e.pressure!==.5),hx:e.clientX,hy:e.clientY};P.cur=c;addPt(c,e);hold(c);live()}
 function move(e){const a=P.act;if(!a)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const L=evs.length?evs:[e];
  if(a.tool==='eraser'){for(const v of L){const[x,y]=toW(v.clientX,v.clientY),r=tsz('eraser')/2,d=Math.hypot(x-P.ex,y-P.ey),n=Math.ceil(d/(r*.5));for(let i=1;i<=n;i++)eraseAt(P.ex+(x-P.ex)*i/n,P.ey+(y-P.ey)*i/n);P.ex=x;P.ey=y}hover(e,true);return}
  if(a.tool==='lasso'){const[x,y]=toW(e.clientX,e.clientY);if(P.mv){P.mv.dx=x-P.mv.sx;P.mv.dy=y-P.mv.sy;paint()}else if(P.las){P.las.push(x,y);live()}return}
  const c=P.cur;if(!c||c.snap)return;for(const v of L)addPt(c,v);
  if(Math.hypot(e.clientX-c.hx,e.clientY-c.hy)>3){c.hx=e.clientX;c.hy=e.clientY;hold(c)}
  const pr=e.getPredictedEvents?e.getPredictedEvents():[];c.pred=pr.length?pr.slice(0,3).flatMap(v=>addPt(c,v,true)):null;live()}
 function end(e,cancel){const a=P.act;if(!a)return;P.act=null;
  if(a.tool==='eraser'){if(P.erased){P.undo.push(P.eraseSnap);P.redo=[];P.dirty=true;bar()}return}
  if(a.tool==='lasso'){if(P.mv){const m=P.mv;P.mv=null;if(Math.abs(m.dx)+Math.abs(m.dy)>.5||m.k!==1)xform(m);paint();return}const L=P.las;P.las=null;live();if(L&&L.length>6)select(L);return}
  const c=P.cur;P.cur=null;clearTimeout(c&&c.ht);if(!c||cancel||!c.p.length){live();return}
  if(!c.snap&&c.rx!=null){const n=c.p.length;if(Math.hypot(c.rx-c.p[n-3],c.ry-c.p[n-2])>.3)c.p.push(c.rx,c.ry,c.p[n-1])}
  if(c.sim&&!c.snap&&c.k!=='marker'){const n=c.p.length/3,m=Math.min(5,Math.floor(n/3));for(let i=0;i<m;i++){const f=.45+.55*(i+1)/(m+1);c.p[i*3+2]*=f;c.p[(n-1-i)*3+2]*=f}}
  push();P.undo[P.undo.length-1]={s:P.strokes,H:P.H};P.strokes=P.strokes.concat([{k:c.k,c:c.c,z:c.z,p:c.p}]);
  const b=bbox(P.strokes[P.strokes.length-1]);if(!P.photo&&b[3]>P.H-140){P.H=Math.min(30000,Math.round(b[3]+420));clampV()}
  live();paint()}
 /* ---- eraser ---- */
 function eraseAt(x,y){const r=tsz('eraser')/2,whole=C.whole;let ch=false;const out=[];
  for(const s of P.strokes){const b=bbox(s);if(x+r<b[0]||x-r>b[2]||y+r<b[1]||y-r>b[3]){out.push(s);continue}const p=s.p,h=s.z/2;
   if(whole){let hit=false;for(let i=0;i<p.length;i+=3)if(Math.hypot(p[i]-x,p[i+1]-y)<r+h*p[i+2]*.6){hit=true;break}if(hit)ch=true;else out.push(s);continue}
   let seg=[],segs=[],hit=false;for(let i=0;i<p.length;i+=3){if(Math.hypot(p[i]-x,p[i+1]-y)<r+h*p[i+2]*.5){hit=true;if(seg.length)segs.push(seg);seg=[]}else seg.push(p[i],p[i+1],p[i+2])}if(seg.length)segs.push(seg);
   if(!hit){out.push(s);continue}ch=true;for(const g of segs)if(g.length>=6||(p.length===3))out.push({k:s.k,c:s.c,z:s.z,p:g})}
  if(ch){P.strokes=out;P.erased=true;paint()}}
 /* ---- selection ---- */
 function pip(px,py,L){let ins=false;for(let i=0,j=L.length-2;i<L.length;j=i,i+=2){const xi=L[i],yi=L[i+1],xj=L[j],yj=L[j+1];if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)ins=!ins}return ins}
 function select(L){const set=new Set();for(const s of P.strokes){const p=s.p,n=p.length/3,st=Math.max(1,Math.floor(n/40));let a=0,t=0;for(let i=0;i<n;i+=st){t++;if(pip(p[i*3],p[i*3+1],L))a++}if(t&&a/t>=.5)set.add(s)}
  if(!set.size){hint('Draw a loop around what you want to select');return}P.sel={set};placeSel()}
 function selBox(){let a=1e9,b=1e9,c=-1e9,d=-1e9;P.sel.set.forEach(s=>{const x=bbox(s);a=Math.min(a,x[0]);b=Math.min(b,x[1]);c=Math.max(c,x[2]);d=Math.max(d,x[3])});return[a,b,c,d]}
 function placeSel(){if(!P.sel){selb.hidden=selm.hidden=true;return}let[a,b,c,d]=selBox();const m=P.mv;if(m){const T=(x,y)=>[m.ax+(x+m.dx-m.ax)*m.k,m.ay+(y+m.dy-m.ay)*m.k];[a,b]=T(a,b);[c,d]=T(c,d)}
  const[x0,y0]=toS(a,b),[x1,y1]=toS(c,d);Object.assign(selb.style,{left:x0-6+'px',top:y0-6+'px',width:x1-x0+12+'px',height:y1-y0+12+'px'});selb.hidden=false;
  selm.hidden=false;const mw=selm.offsetWidth||260;selm.style.left=clamp((x0+x1)/2-mw/2,8,SW-mw-8)+'px';selm.style.top=(y0>60?y0-52:Math.min(SH-50,y1+14))+'px'}
 const inSel=(cx,cy)=>{const r=selb.getBoundingClientRect();return!selb.hidden&&cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom};
 function clearSel(){P.sel=null;P.mv=null;placeSel()}
 function xform(m){push();const map=new Map();P.strokes=P.strokes.map(s=>{if(!P.sel.set.has(s))return s;const p=s.p.slice();for(let i=0;i<p.length;i+=3){p[i]=m.ax+(p[i]+m.dx-m.ax)*m.k;p[i+1]=m.ay+(p[i+1]+m.dy-m.ay)*m.k}const n={k:s.k,c:s.c,z:s.z*m.k,p};map.set(s,n);return n});P.sel={set:new Set(map.values())};
  const b=selBox();if(!P.photo&&b[3]>P.H-60){P.H=Math.round(b[3]+300);clampV()}}
 selb.querySelector('.ink-rs').addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();const[a,b,c,d]=selBox();const[x,y]=toW(e.clientX,e.clientY);P.mv={sx:x,sy:y,dx:0,dy:0,ax:a,ay:b,k:1,rs:[c-a,d-b]};P.act={id:e.pointerId,tool:'resize'};try{selb.setPointerCapture(e.pointerId)}catch(_){}});
 selb.addEventListener('pointermove',e=>{if(!P.act||P.act.tool!=='resize')return;const[x,y]=toW(e.clientX,e.clientY),m=P.mv,[w,h]=m.rs;m.k=clamp(Math.max((w+x-m.sx)/w,(h+y-m.sy)/h),.15,8);paint()});
 selb.addEventListener('pointerup',e=>{if(!P.act||P.act.tool!=='resize')return;P.act=null;const m=P.mv;P.mv=null;if(m.k!==1)xform(m);paint()});
 /* ---- gestures (fingers when the pen draws, two fingers always) ---- */
 function gmove(){const a=[...P.ptrs.values()];if(!a.length)return;if(a.length===1){const p=a[0];P.ox+=p.x-p.px;P.oy+=p.y-p.py}
  else{const[m,n]=a,d=Math.hypot(m.x-n.x,m.y-n.y),pd=Math.hypot(m.px-n.px,m.py-n.py),r=stage.getBoundingClientRect(),cx=(m.x+n.x)/2-r.left,cy=(m.y+n.y)/2-r.top,pcx=(m.px+n.px)/2-r.left,pcy=(m.py+n.py)/2-r.top;
   if(pd>4){const ns=clamp(P.s*d/pd,P.s0*.5,P.s0*8),f=ns/P.s;P.ox=pcx-(pcx-P.ox)*f;P.oy=pcy-(pcy-P.oy)*f;P.s=ns}P.ox+=cx-pcx;P.oy+=cy-pcy}
  a.forEach(p=>{if(Math.hypot(p.x-p.sx,p.y-p.sy)>10)P.gs.moved=true;p.px=p.x;p.py=p.y});clampV();paint()}
 stage.addEventListener('pointerdown',e=>{if(e.target.closest('.ink-selm,.ink-rs'))return;e.preventDefault();e.stopPropagation();try{stage.focus({preventScroll:true})}catch(_){}
  const pen=e.pointerType==='pen',touch=e.pointerType==='touch';
  if(pen&&!penSeen()){LS('pen','1');if(C.finger==='auto'){bar();hint('Pen found. Fingers now scroll and zoom; tap ✋ to draw with fingers too')}}
  if(pen){if(P.act&&P.act.type==='touch'){if(P.cur)P.cur=null;P.act=null;live()}P.ptrs.clear();P.gs=null}
  if(touch){if(P.act&&P.act.type==='pen')return;
   const palm=(e.width>38&&e.height>38);if(palm&&!P.ptrs.size)return;
   if(P.act&&P.act.type==='touch'){const young=performance.now()-P.act.t0<320;if(young&&P.act.tool!=='eraser'){if(P.cur)P.cur=null;if(P.las)P.las=null;P.mv=null;const id=P.act.id;P.act=null;live();P.ptrs.set(id,{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,sx:e.clientX,sy:e.clientY})}else return}
   if(P.ptrs.size||!fingerDraws()||P.act){P.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,sx:e.clientX,sy:e.clientY});if(!P.gs)P.gs={t0:performance.now(),moved:false,n:0};P.gs.n=Math.max(P.gs.n,P.ptrs.size);try{stage.setPointerCapture(e.pointerId)}catch(_){}return}}
  if(e.pointerType==='mouse'&&e.button!==0){P.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,sx:e.clientX,sy:e.clientY});P.gs={t0:performance.now(),moved:true,n:1};return}
  try{stage.setPointerCapture(e.pointerId)}catch(_){}
  const er=(e.buttons&32)||(pen&&(e.buttons&2));start(e,er?'eraser':P.tool)});
 stage.addEventListener('pointermove',e=>{const g=P.ptrs.get(e.pointerId);if(g){g.x=e.clientX;g.y=e.clientY;gmove();return}
  if(P.act&&P.act.id===e.pointerId){e.preventDefault();move(e);return}hover(e)});
 const up=(e,cancel)=>{if(P.ptrs.has(e.pointerId)){P.ptrs.delete(e.pointerId);if(!P.ptrs.size&&P.gs){const g=P.gs;P.gs=null;if(!cancel&&!g.moved&&g.n===2&&performance.now()-g.t0<300){undo();hint('Undo')}}return}if(P.act&&P.act.id===e.pointerId)end(e,cancel)};
 stage.addEventListener('pointerup',e=>up(e,false));stage.addEventListener('pointercancel',e=>up(e,true));
 stage.addEventListener('pointerleave',()=>{hv.hidden=true});
 stage.addEventListener('contextmenu',e=>e.preventDefault());
 ['touchstart','touchmove','touchend'].forEach(t=>stage.addEventListener(t,e=>{e.stopPropagation();if(e.cancelable&&t!=='touchend')e.preventDefault()},{passive:false}));
 stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();if(e.ctrlKey||e.metaKey){const cx=e.clientX-r.left,cy=e.clientY-r.top,ns=clamp(P.s*Math.exp(-e.deltaY*.01),P.s0*.5,P.s0*8),f=ns/P.s;P.ox=cx-(cx-P.ox)*f;P.oy=cy-(cy-P.oy)*f;P.s=ns}else{P.ox-=e.deltaX;P.oy-=e.deltaY}clampV();paint()},{passive:false});
 function hover(e,force){if(!force&&(e.buttons||(e.pointerType!=='pen'&&e.pointerType!=='mouse'))){hv.hidden=true;return}const r=stage.getBoundingClientRect(),t=force?'eraser':P.tool;if(t==='lasso'){hv.hidden=true;return}
  const d=Math.max(4,tsz(t)*P.s*(t==='eraser'?1:.9));Object.assign(hv.style,{width:d+'px',height:d+'px',left:e.clientX-r.left-d/2+'px',top:e.clientY-r.top-d/2+'px'});hv.className='ink-hv'+(t==='eraser'?' er':'');hv.hidden=false}
 /* ---- bar and menu ---- */
 el.addEventListener('click',async e=>{const tb=e.target.closest('[data-tool]');if(tb){setTool(tb.dataset.tool);return}
  const sz=e.target.closest('[data-sz]');if(sz){const t=P.tool==='lasso'?'pen':P.tool;C.sz[t]=+sz.dataset.sz;save();bar();return}
  const cl=e.target.closest('[data-col]');if(cl){const t=P.tool==='lasso'||P.tool==='eraser'?'pen':P.tool;C.col[t]=cl.dataset.col;if(P.tool==='eraser'||P.tool==='lasso')setTool(t);save();bar();return}
  const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
  if(k==='x')return finish(false);if(k==='done')return finish(true,true);if(k==='undo')return undo();if(k==='redo')return redo();
  if(k==='finger'){C.finger=fingerDraws()?'off':'on';save();bar();hint(fingerDraws()?'Fingers draw':'Fingers scroll and zoom; the pen draws');return}
  if(k==='more'){menu.hidden=!menu.hidden;if(!menu.hidden)menuHTML();return}
  if(k==='text')return toText(P.strokes);
  if(k==='sdel'){push();P.strokes=P.strokes.filter(s=>!P.sel.set.has(s));clearSel();paint();return}
  if(k==='sdup'){push();const n=[...P.sel.set].map(s=>{const p=s.p.slice();for(let i=0;i<p.length;i+=3){p[i]+=24;p[i+1]+=24}return{k:s.k,c:s.c,z:s.z,p}});P.strokes=P.strokes.concat(n);P.sel={set:new Set(n)};paint();return}
  if(k==='scol'){push();const c=C.col.pen||'ink',map=new Set();P.strokes=P.strokes.map(s=>{if(!P.sel.set.has(s))return s;const n={...s,c:s.k==='marker'?s.c:c,_P:null};map.add(n);return n});P.sel={set:map};paint();return}
  if(k==='stxt')return toText([...P.sel.set]);
  if(k==='paper'){P.pp=b.dataset.v;C.paper=P.pp;save();paint();bar();menuHTML();return}
  if(k==='bg'){P.bg=b.dataset.v;if(!hand){C.bg=P.bg;save()}paint();menuHTML();return}
  if(k==='space'){push();P.H=Math.min(30000,P.H+600);clampV();paint();menu.hidden=true;return}
  if(k==='clear'){if(!P.strokes.length)return;push();P.strokes=[];clearSel();paint();menu.hidden=true;return}
  if(k==='fing'){C.finger=b.dataset.v;save();bar();menuHTML();return}
  if(k==='png'){menu.hidden=true;const c=renderSketch({h:P.H,pp:P.pp,bg:P.bg},P.strokes,2,P.photo&&P.img);c.toBlob(bl=>{if(!bl)return;const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='sketch.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)},'image/png');return}
  if(k==='rm'){menu.hidden=true;if(await ask('Remove this sketch from the entry?','',[['no','Cancel','ghost'],['yes','Remove','danger']])==='yes'){o.close();opts.remove&&opts.remove()}return}});
 el.addEventListener('change',e=>{if(e.target.matches('.ink-cust input')){const t=P.tool==='lasso'||P.tool==='eraser'?'pen':P.tool;C.col[t]=e.target.value;save();bar()}else if(e.target.matches('[data-k=whole]')){C.whole=e.target.checked;save()}});
 el.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.ink-menu,[data-k=more]'))menu.hidden=true});
 function menuHTML(){const opt=(k,v,n,on)=>`<button class="chip${on?' on':''}" data-k="${k}" data-v="${v}">${n}</button>`;
  menu.innerHTML=`<div class="ink-mrow"><span>Paper</span>${opt('paper','light','Light',P.pp==='light')}${opt('paper','dark','Dark',P.pp==='dark')}</div>
  ${P.photo?'':`<div class="ink-mrow"><span>Lines</span>${[['plain','Plain'],['lines','Ruled'],['grid','Grid'],['dots','Dots']].map(([v,n])=>opt('bg',v,n,P.bg===v)).join('')}</div>`}
  <div class="ink-mrow"><span>Fingers</span>${[['auto','Auto'],['on','Draw'],['off','Scroll']].map(([v,n])=>opt('fing',v,n,C.finger===v)).join('')}</div>
  <p class="ink-mnote">Auto: fingers draw until a pen is used, then only the pen draws and fingers scroll and zoom. Two-finger tap undoes. Hold the pen still at the end of a line or shape to straighten it.</p>
  <div class="ink-mrow">${P.photo?'':`<button class="btn sm ghost" data-k="space">More space below</button>`}<button class="btn sm ghost" data-k="png">Save as image</button><button class="btn sm ghost danger" data-k="clear">Clear page</button>${opts.remove?`<button class="btn sm ghost danger" data-k="rm">Remove from entry</button>`:''}</div>`}
 o.key=e=>{const m=e.ctrlKey||e.metaKey;if(e.target.closest&&e.target.closest('input,textarea,[contenteditable]'))return;
  if(m&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(m&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
  else if((e.key==='Delete'||e.key==='Backspace')&&P.sel){e.preventDefault();push();P.strokes=P.strokes.filter(s=>!P.sel.set.has(s));clearSel();paint()}
  else if(!m&&!e.altKey){const T={p:'pen',b:'pencil',f:'fountain',h:'marker',e:'eraser',v:'lasso'}[e.key.toLowerCase()];if(T)setTool(T)}};
 /* ---- finishing ---- */
 function sketch(){const strokes=P.strokes;let h=P.H;if(!P.photo){let mb=0;strokes.forEach(s=>{mb=Math.max(mb,bbox(s)[3])});h=Math.round(clamp(mb+56,240,P.H))}
  const sk={id:old?old.id:hid(),v:1,w:W,h,pp:P.pp,bg:P.bg,s:strokes.map(s=>({k:s.k,c:s.c,z:Math.round(s.z*100)/100,p:pack(s.p)}))};if(P.photo)sk.ph=P.photo;
  const c=renderSketch(sk,strokes,Math.min(1.5,1400/W),P.photo&&P.img);sk.img=c.toDataURL('image/jpeg',.84);return sk}
 async function finish(keep,direct){if(P.busy)return;menu.hidden=true;
  if(!direct){if(!P.dirty||(!P.strokes.length&&!old&&!P.photo)){o.close();return}const a=await ask(old?'Keep your changes?':'Keep this sketch?','',[['no','Discard','ghost danger'],['yes',old?'Keep changes':'Insert it','pri']]);if(!a){if(o.pop){o.pop=false;try{history.pushState({ink:OVS.length},'')}catch(e){}}return}keep=a==='yes'}
  if(!keep){o.close();return}if(!P.strokes.length&&!P.photo){if(old&&opts.remove){o.close();opts.remove();return}o.close();return}
  P.busy=true;const sk=sketch();o.close();opts.done&&opts.done(sk)}
 async function toText(strokes){const ink=strokes.filter(s=>s.k!=='marker');if(!ink.length)return hint(P.sel?'Nothing written in the selection':'Write something first');
  review({src:{ink},title:'Handwriting to text',keepLabel:'Keep the handwriting too',onInsert:(html,keepInk)=>{const sk=keepInk?sketch():null;o.close();opts.text&&opts.text(html,sk)}})}
 const ro=new ResizeObserver(()=>{fit();live()});ro.observe(stage);const _c=o.close;o.close=()=>{ro.disconnect();_c()};
 if(P.photo){loadImg(P.photo).then(i=>{P.img=i;if(!old)P.H=W*i.height/i.width;fit();paint()}).catch(()=>{})}
 bar();setTimeout(()=>{fit();if(!old&&!penSeen()&&C.finger==='auto')hint(hand?'Write with your pen or finger. Tap To text when you’re done':'Draw with your pen or finger. Hold still at the end of a shape to snap it')},60)}

/* ================= reading text ================= */
const lang=()=>{const l=cfg().lang;return LANGS.find(x=>x[0]===l)||LANGS[0]};
let TW=null,TLANG='',TPROG=null;
async function tess(code,prog){TPROG=prog;if(TW&&TLANG===code)return TW;if(TW){try{(await TW).terminate()}catch(e){}TW=null}
 if(!window.Tesseract){prog&&prog('Getting the text reader ready (first time only)…');await loadJS(TJS)}TLANG=code;
 TW=Tesseract.createWorker(code,1,{logger:m=>{if(!TPROG)return;const st=String(m.status||'');TPROG(/recogni/i.test(st)?`Reading… ${Math.round((m.progress||0)*100)}%`:/load|init|download/i.test(st)?'Getting the text reader ready (first time only)…':'Reading…')}}).catch(e=>{TW=null;throw e});return TW}
/* grayscale + adaptive threshold (Bradley): shadows and uneven light on a photo of paper turn white, ink turns black */
function binarize(src){const w=src.width,h=src.height,x=src.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,w,h),g=new Float32Array(w*h),I=new Float64Array((w+1)*(h+1));
 for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=.299*d.data[j]+.587*d.data[j+1]+.114*d.data[j+2];
 for(let y=0;y<h;y++){let r=0;for(let xx=0;xx<w;xx++){r+=g[y*w+xx];I[(y+1)*(w+1)+xx+1]=I[y*(w+1)+xx+1]+r}}
 const s=Math.max(8,Math.round(Math.max(w,h)/22)),hs=s>>1,o=document.createElement('canvas');o.width=w;o.height=h;const ox=o.getContext('2d',{willReadFrequently:true}),od=ox.createImageData(w,h),bin=new Uint8Array(w*h);
 for(let y=0;y<h;y++){const y0=Math.max(0,y-hs),y1=Math.min(h-1,y+hs);for(let xx=0;xx<w;xx++){const x0=Math.max(0,xx-hs),x1=Math.min(w-1,xx+hs),cnt=(x1-x0+1)*(y1-y0+1),sum=I[(y1+1)*(w+1)+x1+1]-I[y0*(w+1)+x1+1]-I[(y1+1)*(w+1)+x0]+I[y0*(w+1)+x0],i=y*w+xx,dark=g[i]*cnt<=sum*.86&&g[i]<215;bin[i]=dark?1:0;const v=dark?0:255,j=i*4;od.data[j]=od.data[j+1]=od.data[j+2]=v;od.data[j+3]=255}}
 ox.putImageData(od,0,0);return{canvas:o,bin,w,h,rgb:d.data}}
/* highlight: the light pixels behind a word are coloured while the page isn't (bold can't be told apart reliably from a
   photo on the device, so it's left to the AI reader) */
function wordStyles(words,B){if(!B)return;const{bin,w,rgb}=B;let bgR=0,bgG=0,bgB=0,bn=0;
 for(let k=0;k<4000;k++){const i=Math.floor(Math.random()*bin.length);if(!bin[i]){const j=i*4;bgR+=rgb[j];bgG+=rgb[j+1];bgB+=rgb[j+2];bn++}}bgR/=bn||1;bgG/=bn||1;bgB/=bn||1;
 for(const wd of words){const b=wd.bbox;let lr=0,lg=0,lb=0,ln=0;
  for(let y=b.y0;y<b.y1;y+=2)for(let x=b.x0;x<b.x1;x+=2){const i=y*w+x;if(!bin[i]){const j=i*4;lr+=rgb[j];lg+=rgb[j+1];lb+=rgb[j+2];ln++}}
  if(ln>8){lr/=ln;lg/=ln;lb/=ln;const mx=Math.max(lr,lg,lb),mn=Math.min(lr,lg,lb),sat=mx?(mx-mn)/mx:0,dist=Math.hypot(lr-bgR,lg-bgG,lb-bgB);wd._mark=sat>.2&&dist>38&&mx>110}}}
const escH=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function wordsHTML(ws){let o='';for(let i=0;i<ws.length;){const b=!!ws[i]._bold,m=!!ws[i]._mark;let k=i;while(k<ws.length&&!!ws[k]._bold===b&&!!ws[k]._mark===m)k++;let t=ws.slice(i,k).map(w=>escH(w.text)).join(' ');if(b)t=`<b>${t}</b>`;if(m)t=`<mark>${t}</mark>`;o+=(o?' ':'')+t;i=k}return o}
/* lines (reading order, each {text, x0,y0,x1,y1, fs?, words?}) → paragraphs, line breaks, headings and lists.
   OCR often drops or garbles list markers (• read as «, + or *; a box as O), so a line lined up with its neighbours'
   markers counts as an item too. */
const BUL=/^([•·●○◦▪■➢➤►‣⁃∙*«»+~–—-]|e(?=\s+\p{Lu}))\s+/u,NUM=/^(\(?\d{1,3}[.)]|[a-hA-H][.)])\s+/,CHK=/^(\[\s?\]|\[[xX✓✔v]\]|[☐☑☒□✓✔]|[O0o](?=\s+\p{Lu}))\s*/u;
function linesToHTML(L){L=L.filter(l=>String(l.text||'').trim());if(!L.length)return'';
 const md=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]||1},mh=md(L.map(l=>l.y1-l.y0)),fs=md(L.map(l=>l.fs||l.y1-l.y0)),cw=mh*.55;
 const left=Math.min(...L.map(l=>l.x0)),right=Math.max(...L.map(l=>l.x1)),span=Math.max(1,right-left);
 L.forEach(l=>{const raw=l.text.trim();let m;l.raw=raw;if((m=CHK.exec(raw))&&raw.length>m[0].length){l.kind='chk';l.mk=m[0];l.on=/[xX✓✔v☑☒]/.test(m[1])}else if((m=BUL.exec(raw))){l.kind='ul';l.mk=m[0]}else if((m=NUM.exec(raw))){l.kind='ol';l.mk=m[0]}
  if(l.kind&&l.words&&l.words.length>1)l.tx=l.words[1].bbox?l.words[1].bbox.x0:l.x0});
 L.forEach((l,i)=>{if(l.kind)return;for(const n of[L[i-1],L[i+1]]){if(!n||!n.kind||n.kind==='ol')continue;const gap=Math.abs(n===L[i-1]?l.y0-n.y1:n.y0-l.y1);if(gap>mh*1.2)continue;
  if(Math.abs(l.x0-n.x0)<cw*1.2&&l.x0>left+cw){l.kind=n.kind;l.mk='';break}if(n.kind==='chk'&&n.tx&&Math.abs(l.x0-n.tx)<cw*1.2&&n===L[i-1]&&l.raw.length<60){l.kind='chk';l.mk='';break}}});
 const out=[];let para=null,list=null,prev=null;
 const flushP=()=>{if(para){out.push(`<p>${para.h}</p>`);para=null}};
 const flushL=()=>{if(!list)return;if(list.t==='chk')out.push(`<p>${list.items.map(i=>i.h).join('<br>')}</p>`);else{const r=items=>{let s='',i=0;while(i<items.length){const it=items[i],kids=[];i++;while(i<items.length&&items[i].lv>it.lv)kids.push(items[i++]);s+=`<li>${it.h}${kids.length?`<${list.t}>${r(kids.map(k=>({...k,lv:k.lv-1})))}</${list.t}>`:''}</li>`}return s};out.push(`<${list.t}>${r(list.items)}</${list.t}>`)}list=null};
 const strip=(l,mk)=>{if(!mk)return l.words&&l.words.length?wordsHTML(l.words):escH(l.raw);const ws=l.words;if(!ws||!ws.length)return escH(l.raw.slice(mk.length).trim());let n=mk.replace(/\s+/g,'').length,k=0;while(k<ws.length&&n>0){n-=String(ws[k].text).replace(/\s+/g,'').length;k++}let h=wordsHTML(ws.slice(k));if(n<0)h=escH(String(ws[k-1].text).slice(String(ws[k-1].text).length+n))+(h?' '+h:'');return h};
 for(const l of L){const raw=l.raw,html=l.words&&l.words.length?wordsHTML(l.words):escH(raw),gap=prev?l.y0-prev.y1:0,brk=!prev||gap>mh*.85||l.y0<prev.y0-mh*.5,nx=L[L.indexOf(l)+1],alone=brk&&(!nx||nx.y0-l.y1>mh*.85),big=(l.fs||l.y1-l.y0)/fs,head=!l.kind&&raw.length<70&&!/[.,;:]$/.test(raw)&&(big>1.25||alone&&big>1.08&&raw.split(/\s+/).length<=5);
  if(l.kind==='chk'){flushP();if(!list||list.t!=='chk'||gap>mh*1.6){flushL();list={t:'chk',items:[],x:l.x0}}list.items.push({h:(l.on?'☑ ':'☐ ')+strip(l,l.mk),lv:0})}
  else if(l.kind){flushP();const t=l.kind;if(!list||list.t==='chk'||(list.t!==t&&l.x0<=list.x+cw*1.5)||gap>mh*1.8){flushL();list={t,items:[],x:l.x0}}list.items.push({h:strip(l,l.mk),lv:l.x0>list.x+cw*2?1:0})}
  else if(list&&!brk&&list.t!=='chk'&&l.x0>list.x+cw*1.2){const it=list.items[list.items.length-1];it.h+=' '+html}
  else{flushL();if(head){flushP();out.push(`<p><b>${html.replace(/<\/?b>/g,'')}</b></p>`);prev={...l,head:true};continue}
   if(!para||brk||(prev&&prev.head)||(prev&&l.x0>prev.x0+cw*2.5)){flushP();para={h:html}}
   else{const full=prev.x1>=right-span*.16;if(full&&/[-‐]$/.test(para.h)&&/^\p{Ll}/u.test(raw))para.h=para.h.replace(/[-‐]$/,'')+html;else para.h+=(full?' ':'<br>')+html}}
  prev=l}
 flushP();flushL();return out.join('')}
function tessLines(data,B,sc){const L=[],W_=[];for(const bl of data.blocks||[])for(const pa of bl.paragraphs||[])for(const ln of pa.lines||[]){const ws=(ln.words||[]).filter((w,i)=>String(w.text||'').trim()&&(w.confidence>18||String(w.text).length>2||(i===0&&/^[^\p{L}\p{N}]{1,2}$/u.test(String(w.text).trim()))));if(!ws.length)continue;W_.push(...ws);L.push({text:ws.map(w=>w.text).join(' '),fs:ln.rowAttributes&&ln.rowAttributes.rowHeight?ln.rowAttributes.rowHeight/sc:0,x0:ln.bbox.x0/sc,y0:ln.bbox.y0/sc,x1:ln.bbox.x1/sc,y1:ln.bbox.y1/sc,words:ws,conf:ln.confidence})}
 wordStyles(W_,B);return L}
/* Chrome's built-in handwriting recognizer (on-device; ChromeOS today), fed the real strokes line by line */
function inkLines(strokes){const it=strokes.map((s,i)=>({s,i,b:bbox(s)}));const hs=it.map(x=>x.b[3]-x.b[1]).filter(h=>h>3).sort((a,b)=>a-b),mh=hs[hs.length>>1]||20;
 it.sort((a,b)=>(a.b[1]+a.b[3])-(b.b[1]+b.b[3]));const lines=[];
 for(const x of it){const cy=(x.b[1]+x.b[3])/2;let best=null,bd=1e9;for(const ln of lines){const lc=(ln.y0+ln.y1)/2,d=Math.abs(cy-lc);if(cy>=ln.y0-mh*.3&&cy<=ln.y1+mh*.3&&d<bd){best=ln;bd=d}}
  if(best){best.items.push(x);if(x.b[3]-x.b[1]<mh*2.5){best.y0=Math.min(best.y0,x.b[1]);best.y1=Math.max(best.y1,x.b[3])}}else lines.push({y0:x.b[1],y1:x.b[3],items:[x]})}
 lines.forEach(l=>{l.items.sort((a,b)=>a.i-b.i);l.x0=Math.min(...l.items.map(x=>x.b[0]));l.x1=Math.max(...l.items.map(x=>x.b[2]))});return lines.sort((a,b)=>a.y0-b.y0)}
async function hwRead(strokes){if(!('createHandwritingRecognizer' in navigator))return null;const lc=lang()[2];
 try{if(navigator.queryHandwritingRecognizer){const q=await navigator.queryHandwritingRecognizer({languages:[lc]});if(!q)return null}}catch(e){return null}
 let r;try{r=await navigator.createHandwritingRecognizer({languages:[lc]})}catch(e){return null}
 const lines=inkLines(strokes),out=[];let t=0;
 for(const ln of lines){const d=r.startDrawing({recognitionType:'text',inputType:'stylus'});for(const x of ln.items){const st=new HandwritingStroke(),p=x.s.p;for(let i=0;i<p.length;i+=3)st.addPoint({x:p[i],y:p[i+1],t:t+=8});d.addStroke(st);t+=120}
  const pr=await d.getPrediction();const txt=(pr&&pr[0]&&pr[0].text||'').trim();if(txt)out.push({text:txt,x0:ln.x0,x1:ln.x1,y0:ln.y0,y1:ln.y1});try{d.clear()}catch(e){}}
 try{r.finish()}catch(e){}return out.length?linesToHTML(out):''}
/* ink rendered black on white at a size the OCR likes (about 64px a line) */
function inkCanvas(strokes){let a=1e9,b=1e9,c=-1e9,d=-1e9;strokes.forEach(s=>{const x=bbox(s);a=Math.min(a,x[0]);b=Math.min(b,x[1]);c=Math.max(c,x[2]);d=Math.max(d,x[3])});
 const L=inkLines(strokes),hs=L.map(l=>l.y1-l.y0).sort((x,y)=>x-y),mh=hs[hs.length>>1]||40,sc=clamp(64/mh,.4,5),pad=30,cv=document.createElement('canvas');
 cv.width=Math.min(4000,Math.round((c-a)*sc+pad*2));cv.height=Math.min(6000,Math.round((d-b)*sc+pad*2));const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.setTransform(sc,0,0,sc,pad-a*sc,pad-b*sc);x.fillStyle='#000';
 strokes.forEach(s=>x.fill(pathOf(s.p,Math.max(s.z,3.4/sc),null,1.6/sc)));return cv}
/* the AI from Workbench › AI, only when the person asks for it */
const AIP=`You turn a picture into editable notes. Reply with HTML only, using just these tags: p, br, b, i, u, mark, ul, ol, li. No code fences, no comments.
- Copy every word exactly as it appears, in reading order. Keep spelling, numbers and punctuation. Write [?] for anything unreadable.
- Rebuild the layout: one <p> per paragraph; keep line breaks that matter (addresses, poems, short lines) as <br>; headings as <p><b>Heading</b></p>; bullet lists as <ul>, numbered lists as <ol>, nested lists nested; checkboxes as ☐ (empty) or ☑ (ticked) at the start of the line.
- Keep emphasis: bold in <b>, italic in <i>, underlined in <u>, highlighted in <mark>.
- A table becomes one line per row with cells separated by " · ".`;
function aiClean(s){s=String(s||'').trim().replace(/^```(?:html)?\s*/i,'').replace(/```\s*$/,'').trim();if(!/<(p|ul|ol|br|b|li)\b/i.test(s))s=s.split(/\n{2,}/).map(p=>`<p>${escH(p).replace(/\n/g,'<br>')}</p>`).join('');return s}
async function aiRead(dataUrl,ink,signal){if(!window.aiVision)throw new Error('AI isn’t set up');return aiClean(await window.aiVision(AIP+(ink?'\nThe picture is handwriting written on a tablet.':''),dataUrl,{signal}))}
async function ocrCanvas(src,prog){const L=lang();let sc=1,cv=src;const mx=Math.max(src.width,src.height);
 if(mx<1400){sc=Math.min(2.5,1800/mx);cv=document.createElement('canvas');cv.width=Math.round(src.width*sc);cv.height=Math.round(src.height*sc);const x=cv.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(src,0,0,cv.width,cv.height)}
 prog&&prog('Cleaning up the picture…');await new Promise(r=>setTimeout(r,30));const B=binarize(cv);const w=await tess(L[0],prog);
 try{await w.setParameters({preserve_interword_spaces:'1'})}catch(e){}const{data}=await w.recognize(B.canvas,{},{blocks:true,text:true});
 return linesToHTML(tessLines(data,B,1))}

/* ---------------- the review panel: what was read, editable, then inserted ---------------- */
/* src: {ink:[strokes]} or {canvas, photo}; onInsert(html, keep) */
function review({src,title,keepLabel,onInsert}){const aiN=window.aiVisionName?aiVisionName():'',hw='createHandwritingRecognizer' in navigator;let ctl=null,usedAI=false;
 const o=overlay('ink-rv',`<div class="ink-top"><button class="ink-ib" data-k="x" aria-label="Close">${ic('inkx')}</button><b class="ink-ttl">${esc(title||'Text from the picture')}</b><span class="ink-sp"></span><button class="btn sm pri" data-k="ins" disabled>Insert</button></div>
 <div class="ink-rvb"><div class="ink-rvh"><span class="ink-st" aria-live="polite">Reading…</span><span class="ink-sp"></span><select class="ink-lang" aria-label="Language">${LANGS.map(([k,n])=>`<option value="${k}" ${lang()[0]===k?'selected':''}>${n}</option>`).join('')}</select>${aiN?`<button class="btn sm ghost" data-k="ai">Read with ${esc(aiN)}</button>`:''}</div>
 <div class="rich ink-rvt" contenteditable="true" spellcheck="true" aria-label="Text found"></div>
 <div class="ink-rvf">${keepLabel?`<label class="sw ink-keep"><span>${esc(keepLabel)}</span><input type="checkbox" data-k="keep" ${src.ink?'':'checked'}><i></i></label>`:''}<span class="ink-sp"></span><button class="btn sm ghost" data-k="copy">Copy</button></div>
 ${aiN?'':`<p class="ink-mnote">Read on this device${src.ink&&hw?' with the browser’s handwriting recognizer':''}. For messy handwriting, add an AI key in Workbench › AI and a “Read with …” button appears here; only this picture is sent.</p>`}</div>`,()=>{ctl&&ctl.abort();o.close()});
 const el=o.el,st=el.querySelector('.ink-st'),tx=el.querySelector('.ink-rvt'),ins=el.querySelector('[data-k=ins]');
 const prog=t=>{if(st)st.textContent=t};
 async function run(useAI){ins.disabled=true;tx.classList.add('busy');ctl&&ctl.abort();ctl=new AbortController();const me=ctl;
  try{let html='';
   if(useAI){prog(`Asking ${aiN}…`);const url=src.ink?inkCanvas(src.ink).toDataURL('image/png'):(src.canvas.width*src.canvas.height>4e6?scaleTo(src.canvas,2000):src.canvas).toDataURL('image/jpeg',.9);html=await aiRead(url,!!src.ink,me.signal);usedAI=true}
   else if(src.ink){html=await hwRead(src.ink).catch(()=>null);if(html==null||!html)html=await ocrCanvas(inkCanvas(src.ink),prog)}
   else html=await ocrCanvas(src.canvas,prog);
   if(me!==ctl)return;html=cleanHTML(html);tx.innerHTML=html||'';prog(html?(useAI?`Read by ${aiN}. Check it, edit anything, then Insert.`:'Check it, edit anything, then Insert.'):'No text found.'+(aiN&&!useAI?` Try Read with ${aiN}.`:' Try a sharper, closer picture.'));ins.disabled=!html}
  catch(e){if(e&&e.name==='AbortError')return;prog(String(e&&e.message||e))}tx.classList.remove('busy')}
 el.addEventListener('click',async e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
  if(k==='x'){ctl&&ctl.abort();o.close()}else if(k==='ai')run(true);
  else if(k==='copy'){const t=htmlText(cleanHTML(tx.innerHTML));if(await copyText(t))toast('Copied')}
  else if(k==='ins'){const html=cleanHTML(tx.innerHTML);if(!htmlText(html)){toast('Nothing to insert');return}const keep=!!el.querySelector('[data-k=keep]:checked');o.close();onInsert(html,keep)}});
 el.querySelector('.ink-lang').addEventListener('change',e=>{cfg().lang=e.target.value;save();run(usedAI&&false)});
 run(false)}
function scaleTo(c,mx){const f=mx/Math.max(c.width,c.height);if(f>=1)return c;const o=document.createElement('canvas');o.width=Math.round(c.width*f);o.height=Math.round(c.height*f);const x=o.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(c,0,0,o.width,o.height);return o}

/* ================= photo: crop, rotate, then read its text, insert it or draw on it ================= */
function pickImage(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.style.display='none';i.addEventListener('change',()=>{res(i.files&&i.files[0]||null);i.remove()});document.body.appendChild(i);i.click()})}
async function scan(T,file,mode){if(!file){file=await pickImage();if(!file)return}let im;const url=URL.createObjectURL(file);try{im=await loadImg(url)}catch(e){toast('Couldn’t read that image');URL.revokeObjectURL(url);return}
 const S_={rot:0,cr:{x0:0,y0:0,x1:1,y1:1}};
 const o=overlay('ink-scan',`<div class="ink-top"><button class="ink-ib" data-k="x" aria-label="Close">${ic('inkx')}</button><b class="ink-ttl">Photo</b><span class="ink-sp"></span><button class="ink-ib" data-k="rot" aria-label="Rotate">${ic('inkrot')}</button><button class="btn sm ghost" data-k="full">Whole photo</button></div>
 <div class="ink-sstage"><canvas class="ink-sc"></canvas><div class="ink-crop"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div>
 <div class="ink-sbar"><p class="ink-mnote">Drag the corners to the part you want.</p><div class="ink-sacts"><button class="btn ghost" data-k="img">Insert photo</button><button class="btn ghost" data-k="draw">${ic('inkpen')}Draw on it</button><button class="btn pri" data-k="read">${ic('inktext')}Read the text</button></div></div>`,()=>{URL.revokeObjectURL(url);o.close()});
 const el=o.el,cv=el.querySelector('.ink-sc'),crop=el.querySelector('.ink-crop'),stg=el.querySelector('.ink-sstage');let R={x:0,y:0,w:1,h:1};
 const rotated=(mx)=>{const r=S_.rot%2===1,w=r?im.height:im.width,h=r?im.width:im.height,f=Math.min(1,(mx||1e9)/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*f);c.height=Math.round(h*f);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.translate(c.width/2,c.height/2);x.rotate(S_.rot*Math.PI/2);x.drawImage(im,-im.width*f/2,-im.height*f/2,im.width*f,im.height*f);return c};
 const cropped=mx=>{const c=rotated(mx),{x0,y0,x1,y1}=S_.cr,o2=document.createElement('canvas');o2.width=Math.max(1,Math.round((x1-x0)*c.width));o2.height=Math.max(1,Math.round((y1-y0)*c.height));o2.getContext('2d').drawImage(c,-x0*c.width,-y0*c.height);return o2};
 function draw(){const r=stg.getBoundingClientRect(),c=rotated(1600),f=Math.min((r.width-24)/c.width,(r.height-24)/c.height),d=DPR();cv.width=Math.round(c.width*f*d);cv.height=Math.round(c.height*f*d);cv.style.width=c.width*f+'px';cv.style.height=c.height*f+'px';cv.getContext('2d').drawImage(c,0,0,cv.width,cv.height);
  const cr=cv.getBoundingClientRect();R={x:cr.left-r.left,y:cr.top-r.top,w:cr.width,h:cr.height};place()}
 function place(){const{x0,y0,x1,y1}=S_.cr;Object.assign(crop.style,{left:R.x+x0*R.w+'px',top:R.y+y0*R.h+'px',width:(x1-x0)*R.w+'px',height:(y1-y0)*R.h+'px'})}
 let dr=null;crop.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();dr={h:e.target.dataset.h||'move',x:e.clientX,y:e.clientY,c:{...S_.cr}};try{crop.setPointerCapture(e.pointerId)}catch(_){}});
 crop.addEventListener('pointermove',e=>{if(!dr)return;const dx=(e.clientX-dr.x)/R.w,dy=(e.clientY-dr.y)/R.h,c={...dr.c},m=.06;
  if(dr.h==='move'){const w=c.x1-c.x0,h=c.y1-c.y0;c.x0=clamp(c.x0+dx,0,1-w);c.y0=clamp(c.y0+dy,0,1-h);c.x1=c.x0+w;c.y1=c.y0+h}
  else{if(dr.h.includes('n'))c.y0=clamp(c.y0+dy,0,c.y1-m);if(dr.h.includes('s'))c.y1=clamp(c.y1+dy,c.y0+m,1);if(dr.h.includes('w'))c.x0=clamp(c.x0+dx,0,c.x1-m);if(dr.h.includes('e'))c.x1=clamp(c.x1+dx,c.x0+m,1)}S_.cr=c;place()});
 crop.addEventListener('pointerup',()=>dr=null);crop.addEventListener('pointercancel',()=>dr=null);
 ['touchstart','touchmove'].forEach(t=>el.addEventListener(t,e=>{if(e.target.closest('.ink-sstage')){e.stopPropagation();if(e.cancelable)e.preventDefault()}},{passive:false}));
 const photoURL=()=>cropped(1600).toDataURL('image/jpeg',.85);
 el.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
  if(k==='x'){URL.revokeObjectURL(url);o.close()}
  else if(k==='rot'){S_.rot=(S_.rot+1)%4;const{x0,y0,x1,y1}=S_.cr;S_.cr={x0:1-y1,y0:x0,x1:1-y0,y1:x1};draw()}
  else if(k==='full'){S_.cr={x0:0,y0:0,x1:1,y1:1};place()}
  else if(k==='img'){const ph=photoURL();URL.revokeObjectURL(url);o.close();photoSketch(ph).then(sk=>T.sketch(sk))}
  else if(k==='draw'){const ph=photoURL();URL.revokeObjectURL(url);o.close();pad({photo:ph,title:'Draw on the photo',done:sk=>T.sketch(sk),text:(h,sk)=>{if(sk)T.sketch(sk);T.html(h)}})}
  else if(k==='read'){const c=cropped(3000),ph=photoURL();review({src:{canvas:c},title:'Text from the photo',keepLabel:'Also insert the photo',onInsert:async(html,keep)=>{URL.revokeObjectURL(url);o.close();if(keep)T.sketch(await photoSketch(ph));T.html(html)}})}});
 const ro=new ResizeObserver(draw);ro.observe(stg);const _c=o.close;o.close=()=>{ro.disconnect();_c()};
 if(mode==='read')setTimeout(()=>el.querySelector('[data-k=read]').click(),50)}
async function photoSketch(ph){const i=await loadImg(ph),h=Math.round(W*i.height/i.width),c=document.createElement('canvas'),f=Math.min(1,1400/W);c.width=Math.round(W*f);c.height=Math.round(h*f);c.getContext('2d').drawImage(i,0,0,c.width,c.height);
 return{id:hid(),v:1,w:W,h,pp:'light',bg:'plain',s:[],ph,img:c.toDataURL('image/jpeg',.84)}}

/* ================= where ink lands: the journal writing sheet and thread forms ================= */
let WRR=null;
document.addEventListener('selectionchange',()=>{const ed=document.getElementById('wrEd'),s=getSelection();if(ed&&s.rangeCount&&ed.contains(s.anchorNode))WRR=s.getRangeAt(0).cloneRange()});
function wrIns(html){const ed=document.getElementById('wrEd');if(!ed)return;ed.focus({preventScroll:true});const s=getSelection();s.removeAllRanges();
 if(WRR&&ed.contains(WRR.startContainer))s.addRange(WRR);else{const r=document.createRange();r.selectNodeContents(ed);r.collapse(false);s.addRange(r)}
 document.execCommand('insertHTML',false,html);WRR=s.rangeCount?s.getRangeAt(0).cloneRange():null;if(typeof wrSoon==='function')wrSoon()}
const skTag=sk=>`<img data-sk="${sk.id}" class="sk-img" src="${sk.img}" alt="${sk.s&&sk.s.length?'Sketch':'Photo'}" draggable="false">`;
const WRT={html:h=>wrIns(cleanHTML(h)),sketch:sk=>{SKC[sk.id]=sk;wrIns(skTag(sk)+'<p><br></p>')}};
/* thread updates keep light text markers (**bold**, ==highlight==, "- ", "[ ] "), so HTML is turned into those */
function marks(html){const t=document.createElement('template');t.innerHTML=html;const out=[];
 const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return c.nodeValue.replace(/\s+/g,' ');if(c.nodeType!==1)return'';const g=c.tagName,i=inl(c);if(g==='BR')return'\n';if(!i.trim())return i;const w=g==='B'||g==='STRONG'?'**':g==='I'||g==='EM'?'*':g==='U'?'__':g==='MARK'?'==':'';return w?w+i.trim()+w+(/\s$/.test(i)?' ':''):i}).join('');
 const blk=(n,dep)=>[...n.childNodes].forEach(c=>{if(c.nodeType===3){if(c.nodeValue.trim())out.push(c.nodeValue.trim());return}if(c.nodeType!==1)return;const g=c.tagName;
  if(g==='UL'||g==='OL'){let k=0;[...c.children].forEach(li=>{k++;const sub=[...li.children].filter(x=>x.tagName==='UL'||x.tagName==='OL');sub.forEach(x=>x.remove());out.push('  '.repeat(dep)+(g==='OL'?k+'. ':'- ')+inl(li).trim());sub.forEach(x=>blk({childNodes:[x]},dep+1))})}
  else if(g==='P'||g==='DIV'||g==='LI'){inl(c).split('\n').forEach(l=>out.push(l.trim().replace(/^☐\s*/,'[ ] ').replace(/^☑\s*/,'[x] ')))}else out.push(inl(c).trim())});
 blk(t.content,0);return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()}
function taIns(ta,txt){if(!ta)return;const a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a,pre=ta.value.slice(0,a),sep=pre&&!/\n$/.test(pre)?'\n':'';ta.setRangeText(sep+txt,a,b,'end');ta.dispatchEvent(new Event('input',{bubbles:true}));try{ta.focus({preventScroll:true})}catch(e){}}
function tray(f){let t=f.querySelector('.ink-tray');const L=f._sk||[];if(!t){t=document.createElement('div');t.className='ink-tray';const ta=f.querySelector('textarea');(ta&&ta.parentNode===f.querySelector('.field')?ta.parentNode:ta||f).insertAdjacentElement(ta?'afterend':'beforeend',t)}
 t.innerHTML=L.map((s,i)=>`<div class="ink-th"><img src="${s.img}" alt="${s.s&&s.s.length?'Sketch':'Photo'}" data-i="${i}"><button type="button" data-rm="${i}" aria-label="Remove">${ic('inkx')}</button></div>`).join('');t.hidden=!L.length;
 const ta=f.querySelector('textarea[name=x]');if(ta){if(ta.dataset.req==null)ta.dataset.req=ta.required?'1':'';ta.required=!L.length&&ta.dataset.req==='1'}}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.ink-tray');if(!t)return;const f=t.closest('form');if(!f)return;const rm=e.target.closest('[data-rm]'),im=e.target.closest('img[data-i]');
 if(rm){f._sk.splice(+rm.dataset.rm,1);tray(f)}else if(im){const i=+im.dataset.i,sk=f._sk[i];pad({sk,done:n=>{f._sk[i]=n;tray(f)},text:(h,n)=>{if(n)f._sk[i]=n;tray(f);taIns(f.querySelector('textarea'),marks(h))},remove:()=>{f._sk.splice(i,1);tray(f)}})}});
const thrT=f=>({html:h=>taIns(f.querySelector('textarea'),marks(h)),sketch:sk=>{f._sk=(f._sk||[]).concat(sk);tray(f)}});
window.inkTake=f=>f&&f._sk?f._sk.slice():undefined;
function targetOf(el){if(el&&el.closest('.wr'))return WRT;const f=el&&el.closest('form');return f?thrT(f):WRT}
Object.assign(ACT,{
 inkDraw:(d,el)=>{const T=targetOf(el);pad({mode:'draw',done:sk=>T.sketch(sk),text:(h,sk)=>{if(sk)T.sketch(sk);T.html(h)}})},
 inkHand:(d,el)=>{const T=targetOf(el);pad({mode:'hand',done:sk=>T.sketch(sk),text:(h,sk)=>{if(sk)T.sketch(sk);T.html(h)}})},
 inkScan:(d,el)=>scan(targetOf(el),null),
 skView:(d,el)=>view(el.getAttribute('src'))});
/* tap a sketch in the writing sheet to keep drawing on it; anywhere else it opens full screen */
document.addEventListener('click',e=>{const im=e.target.closest&&e.target.closest('img.sk-img');if(!im||im.closest('.ink-ov,.ink-tray'))return;
 if(im.closest('#wrEd')){const id=im.dataset.sk,sk=SKC[id];if(!sk)return;e.preventDefault();
  pad({sk,done:n=>{SKC[id]=n;document.querySelectorAll(`#wrEd img[data-sk="${id}"]`).forEach(x=>{x.src=n.img});wrSoon()},text:(h,n)=>{if(n){SKC[id]=n;document.querySelectorAll(`#wrEd img[data-sk="${id}"]`).forEach(x=>{x.src=n.img})}wrIns(cleanHTML(h))},remove:()=>{document.querySelectorAll(`#wrEd img[data-sk="${id}"]`).forEach(x=>x.remove());wrSoon()}});return}
 if(!im.dataset.act)view(im.getAttribute('src'))});
function view(src){if(!src)return;const o=overlay('ink-view',`<div class="ink-top"><button class="ink-ib" data-k="x" aria-label="Close">${ic('inkx')}</button></div><div class="ink-vb"><img src="${src}" alt=""></div>`);o.el.addEventListener('click',e=>{if(e.target.closest('[data-k=x]')||e.target.classList.contains('ink-vb'))o.close()})}
/* paste or drop a picture into the journal or a thread: read its text, insert it or draw on it */
function imgFile(dt){const f=[...(dt&&dt.files||[])].find(x=>/^image\//.test(x.type));if(f)return f;const it=[...(dt&&dt.items||[])].find(x=>x.kind==='file'&&/^image\//.test(x.type));return it?it.getAsFile():null}
document.addEventListener('paste',e=>{const t=e.target.closest&&e.target.closest('#wrEd,textarea[data-fmt]');if(!t)return;const f=imgFile(e.clipboardData);if(!f)return;e.preventDefault();e.stopImmediatePropagation();scan(targetOf(t),f)},true);
document.addEventListener('dragover',e=>{if(e.target.closest&&e.target.closest('#wrEd,textarea[data-fmt]'))e.preventDefault()});
document.addEventListener('drop',e=>{const t=e.target.closest&&e.target.closest('#wrEd,textarea[data-fmt]');if(!t)return;const f=imgFile(e.dataTransfer);if(!f)return;e.preventDefault();scan(targetOf(t),f)},true);
/* editing a thread update: its sketches come along in the form's tray */
{const _u=ACT.thrUpEdit;ACT.thrUpEdit=function(d){const r=_u.apply(this,arguments);const t=TH(d.id),u=t&&t.ups.find(x=>x.id===d.u),f=document.querySelector('#sheet form[data-form=thrUpEdit]');if(f&&u){f._sk=(u.sk||[]).slice();tray(f)}return r}}
window.inkPad=pad;window.inkScan=scan;window.inkTest={pack,unpack,snapShape,linesToHTML,marks,binarize,ocrCanvas,inkCanvas};
})();
