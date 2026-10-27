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
const wide=()=>innerWidth>=900&&S.settings.book?.spread!==false;
const dayOf=t=>ymd(new Date(t));
/* ---------------- look and feel (1.59.3): the book's own settings, kept on this device like the rest of the looks ---------------- */
const BDEF={paper:'auto',lines:'none',grain:true,font:'serif',size:18,lh:'normal',cover:'leather',turn:'curl',speed:'normal',sound:false,spread:true,moments:true,drop:true,open:'today',last:'',wsync:true};
const BS=()=>S.settings.book=Object.assign({},BDEF,S.settings.book||{});
const PAPERS=[['app','App theme'],['auto','Auto'],['cream','Cream'],['white','White'],['sepia','Sepia'],['grey','Stone'],['dark','Night'],['black','Black']];
const COVERS=[['leather','Leather','#5a3a2a'],['navy','Navy','#1f2d4a'],['forest','Forest','#24392c'],['wine','Wine','#4d1f2a'],['ink','Black','#1b1a1a'],['sand','Sand','#9a7b55'],['accent','Theme colour','']];
const FONTS=[['serif','Book'],['sans','Clean'],['mono','Typewriter'],['hand','Handwritten']];
const FONT_CSS={serif:"'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",sans:'var(--f-body)',mono:"'Courier Prime','Courier New',Courier,ui-monospace,monospace",hand:"'Segoe Print','Bradley Hand','Snell Roundhand','Comic Neue','Comic Sans MS',cursive"};
const SPEED={slow:1.45,normal:1,fast:.62};
function bkCls(){const s=BS(),dark=s.paper==='auto'||s.paper==='app'?paperDark():s.paper==='dark'||s.paper==='black';return`bk${B.sp?' sp':''}${dark?' dk':''} pp-${s.paper} ln-${s.lines}${s.grain?'':' nograin'}${s.drop?'':' nodrop'}`}
function bkApply(){const el=document.getElementById('book');if(!el)return;const open=el.classList.contains('in');el.className=bkCls()+(open?' in':'');bkStyle(el)}
function bkStyle(el){const s=BS();
 const cv=COVERS.find(c=>c[0]===s.cover)||COVERS[0];el.style.setProperty('--board',cv[2]||'color-mix(in srgb,var(--accent) 55%,#1a1410)');
 el.style.setProperty('--bkf',FONT_CSS[s.font]||FONT_CSS.serif);el.style.setProperty('--bks',(+s.size||18)+'px');el.style.setProperty('--bkl',{tight:1.5,normal:1.72,airy:1.95}[s.lh]||1.72)}
const seg=(k,L,v)=>`<div class="bk-sg" role="radiogroup">${L.map(([x,n])=>`<button class="${String(v)===String(x)?'on':''}" role="radio" aria-checked="${String(v)===String(x)}" data-act="bkSetV" data-k="${k}" data-v="${x}">${n}</button>`).join('')}</div>`;
const tog=(k,n,v)=>`<label class="bk-tg"><span>${n}</span><input type="checkbox" data-bkset="${k}" ${v?'checked':''}><i></i></label>`;
function setPaint(){const el=$b('#bkSet');if(!el)return;const s=BS();
 el.innerHTML=`<div class="bk-ixh"><b>Look &amp; feel</b><button class="bk-ib" data-act="bkSet" aria-label="Close">${ic('x')}</button></div>
 <h4>Paper</h4><div class="bk-sw">${PAPERS.map(([k,n])=>`<button class="bk-swp p-${k}${s.paper===k?' on':''}" data-act="bkSetV" data-k="paper" data-v="${k}" aria-label="${n}" title="${n}"><i></i><span>${n}</span></button>`).join('')}</div>
 <h4>Page</h4>${seg('lines',[['none','Blank'],['lined','Lined'],['dots','Dotted']],s.lines)}${tog('grain','Paper grain',s.grain)}
 <h4>Writing</h4>${seg('font',FONTS,s.font)}
 <div class="bk-rg"><span>Text size</span><input type="range" min="14" max="26" step="1" value="${s.size}" data-bkset="size" aria-label="Text size"><b>${s.size}</b></div>
 ${seg('lh',[['tight','Compact'],['normal','Normal'],['airy','Airy']],s.lh)}${tog('drop','Large first letter',s.drop)}${tog('moments','Show steps and goals',s.moments)}
 <h4>Cover</h4><div class="bk-sw">${COVERS.map(([k,n,c])=>`<button class="bk-swc${s.cover===k?' on':''}" style="--c:${c||'var(--accent)'}" data-act="bkSetV" data-k="cover" data-v="${k}" aria-label="${n}" title="${n}"><i></i><span>${n}</span></button>`).join('')}</div>
 <h4>Turning pages</h4>${seg('turn',[['curl','Paper curl'],['slide','Slide'],['fade','Fade']],s.turn)}${seg('speed',[['slow','Slow'],['normal','Normal'],['fast','Fast']],s.speed)}${tog('sound','Page sound',s.sound)}
 <h4>Layout</h4>${tog('spread','Two pages on wide screens',s.spread)}${tog('wsync','Writing looks like the book',s.wsync)}${seg('open',[['today','Open on today'],['last','Open where I left off']],s.open)}
 <button class="bk-reset" data-act="bkSetReset">Back to the defaults</button>`}
function setChange(k,v){const s=BS();if(k==='size')v=Math.max(14,Math.min(26,+v||18));s[k]=v;S.settings.book=s;save();
 if(k==='spread'){const sp=wide();if(sp!==B.sp){B.sp=sp;B.i=clampI(B.i)}}
 bkApply();if(['moments','spread'].includes(k))paint();if(k==='wsync'&&$('#sheet').classList.contains('wsheet'))sheetLook(v);if(k!=='size')setPaint();else{const b=$b('.bk-rg b');if(b)b.textContent=v}}
/* a soft page sound: a short burst of filtered noise, made on the device (no files) */
let AC=null;function rustle(){if(!BS().sound)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const d=.32,n=Math.floor(AC.sampleRate*d),buf=AC.createBuffer(1,n,AC.sampleRate),x=buf.getChannelData(0);for(let k=0;k<n;k++){const t=k/n;x[k]=(Math.random()*2-1)*Math.pow(Math.sin(Math.PI*t),1.6)*(.6+.4*Math.random())}
 const src=AC.createBufferSource(),bp=AC.createBiquadFilter(),g=AC.createGain();src.buffer=buf;bp.type='bandpass';bp.frequency.value=2600;bp.Q.value=.7;g.gain.value=.16;src.connect(bp).connect(g).connect(AC.destination);src.start()}catch(e){}}

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
 <div class="bk-body">${w.map((e,k)=>(k?'<div class="bk-orn" aria-hidden="true">⁂</div>':'')+entryHTMLb(e,k===0)).join('')}${m.length&&BS().moments!==false?`<ul class="bk-mos">${m.map(e=>entryHTMLb(e)).join('')}</ul>`:''}${!p.E.length?`<p class="bk-empty">${today?'A fresh page for today.':'Nothing was written this day.'}</p>`:''}
 <button class="bk-add" data-act="bkWrite" data-d="${p.d}">${ic('edit')}<span>${w.length?'Add to this day':today?'Write today’s page':'Write on this page'}</span></button></div>
 <footer class="bk-pn">${n}</footer></div>`}
/* which pages are on screen: one (phone) or a left/right spread starting at an even index */
const step=()=>B.sp?2:1;
const clampI=i=>{const L=B.P.length;i=Math.max(0,Math.min(i,L-1));return B.sp?i-(i%2):i};
function shell(){return`<div id="book" class="${bkCls()}" role="dialog" aria-modal="true" aria-label="Journal book">
 <div class="bk-top"><button class="bk-ib" data-act="bkClose" aria-label="Close the book" title="Close (Esc)">${ic('x')}</button><div class="bk-tt" id="bkCount" aria-live="polite"></div><button class="bk-ib bk-aa" data-act="bkSet" aria-label="Look and feel" title="Look and feel" aria-expanded="false">Aa</button><button class="bk-ib" data-act="bkIx" aria-label="Contents" title="Contents" aria-expanded="false">${ic('ixl')}</button><button class="bk-ib bk-wr" data-act="bkWrite" data-d="${ymd()}" aria-label="Write today" title="Write today">${ic('edit')}</button></div>
 <div class="bk-stage" id="bkStage"><div class="bk-book" id="bkBook"><i class="bk-edge l" aria-hidden="true"></i><i class="bk-edge r" aria-hidden="true"></i><div class="bk-pg bk-l" id="bkL"></div><div class="bk-pg bk-r" id="bkR"></div></div></div>
 <div class="bk-bot"><button class="bk-ib" data-act="bkPrev" aria-label="Previous page">${ic('back')}</button><div class="bk-scr"><input type="range" id="bkRange" min="0" aria-label="Go to a page"><span class="bk-bub" id="bkBub"></span></div><button class="bk-ib bk-nx" data-act="bkNext" aria-label="Next page">${ic('back')}</button></div>
 <aside class="bk-ix" id="bkIx" aria-label="Contents" hidden></aside><aside class="bk-ix bk-set" id="bkSet" aria-label="Look and feel" hidden></aside></div>`}
/* the paper follows the theme: warm cream in light themes, warm charcoal in dark ones */
function paperDark(){const c=getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)||[255,255,255];return(.299*c[0]+.587*c[1]+.114*c[2])<128}
const $b=s=>document.querySelector('#book '+s);
function paint(){const L=$b('#bkL'),R=$b('#bkR');if(!R)return;const i=B.i;
 if(B.sp){L.innerHTML=pageHTML(B.P[i],i+1);R.innerHTML=pageHTML(B.P[i+1],i+2)}else{L.innerHTML='';R.innerHTML=pageHTML(B.P[i],i+1)}
 chrome(i)}
/* everything around the pages, for page i: shown the moment a turn is decided, not when its animation ends */
function chrome(i){
 const c=$b('#bkCount'),p=B.P[B.sp&&B.P[i+1]?i+1:i];if(c)c.innerHTML=`<b>${p&&p.k==='day'?esc(dt(p.d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})):'Journal'}</b><small>${i+1}${B.sp&&B.P[i+1]?'–'+(i+2):''} of ${B.P.length}</small>`;
 const r=$b('#bkRange');if(r){r.max=B.P.length-1;r.step=1;r.value=i}
 const pv=$b('[data-act=bkPrev]'),nx=$b('[data-act=bkNext]');if(pv)pv.disabled=i<=0;if(nx)nx.disabled=i+step()>=B.P.length;
 /* the page edges: thicker on the side you have read */
 const n=B.P.length,el=$b('.bk-edge.l'),er=$b('.bk-edge.r'),th=k=>Math.round(Math.min(9,2+k*.35));if(el)el.style.setProperty('--t',th(i)+'px');if(er)er.style.setProperty('--t',th(n-1-i-(B.sp?1:0))+'px');
 {const pp=B.P[B.sp&&B.P[i+1]?i+1:i],st=BS();if(pp&&pp.d&&st.last!==pp.d){st.last=pp.d;save()}}
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
/* 1.60.0 (owner's call): a page that isn't on screen yet stays plain paper while it turns in, and gets its words
   once the turn has landed. Nothing new has to be drawn mid-turn, so nothing can flash. A cover keeps its leather. */
const blankPg=p=>!p?pageHTML(p):p.k==='cover'?'<div class="bk-pc bk-cover"></div>':'<div class="bk-pc"></div>';
/* 1.60.1: turning works the way Noor's reader does, which stays smooth on phones. The turning layers are made once per
   book and reused (no new layers to paint mid-turn); the flap carries its transform and its clip on one element; and the
   shadows are strips moved with transforms, so no gradient is redrawn while the finger moves. Only the two clip paths
   change each frame. */
function lays(){const book=$b('#bkBook');if(!book)return null;if(B.lay&&B.lay.under.isConnected)return B.lay;
 const mk=(cls,html)=>{const d=document.createElement('div');d.className='bk-lay '+cls;d.style.visibility='hidden';if(html)d.innerHTML=html;book.appendChild(d);return d};
 const under=mk('bk-pg bk-under'),copy=mk('bk-pg bk-copy'),sh=mk('bk-shw','<i class="bk-cs"></i><i class="bk-fs"></i>'),flap=mk('bk-pg bk-flap','<div class="bk-back"></div><i class="bk-gl"></i>');
 return B.lay={under,copy,sh,flap,cs:sh.firstChild,fs:sh.lastChild,back:flap.firstChild,gl:flap.lastChild}}
const LAYS=Y=>[Y.under,Y.copy,Y.sh,Y.flap];
function turnStart(dir,startY){if(B.busy)return false;const ni=clampI(B.i+dir*step());if(ni===B.i)return false;const book=$b('#bkBook'),Y=lays();if(!book||!Y)return false;
 const L=$b('#bkL'),R=$b('#bkR'),i=B.i,sp=B.sp,mir=sp&&dir<0,pg=mir?L:R,br=book.getBoundingClientRect(),pr=pg.getBoundingClientRect(),W=pr.width,H=pr.height,side=mir?' bk-l':' bk-r';
 let frontP,backP,underP,under=true;
 if(sp&&dir>0){frontP=B.P[i+1];backP=B.P[i+2];underP=B.P[i+3]}
 else if(sp){frontP=B.P[i];backP=B.P[i-1];underP=B.P[i-2]}
 else if(dir>0){frontP=B.P[i];underP=B.P[i+1]}
 else{frontP=B.P[i-1];under=false}
 /* the turning page is the real one on screen, except a phone page coming back from the left (a plain copy) */
 const real=sp||dir>0;
 const put=(el,cls,html)=>{el.className='bk-lay '+cls;Object.assign(el.style,{left:(pr.left-br.left)+'px',top:(pr.top-br.top)+'px',width:W+'px',height:H+'px',clipPath:'',transform:'',visibility:'visible'});if(html!=null&&el._h!==html){el.innerHTML=html;el._h=html}};
 if(under)put(Y.under,'bk-pg bk-under'+side,blankPg(underP));else Y.under.style.visibility='hidden';
 if(!real)put(Y.copy,'bk-pg bk-copy'+side,blankPg(frontP));else Y.copy.style.visibility='hidden';
 put(Y.sh,'bk-shw'+side,null);Y.sh.style.visibility='hidden';
 put(Y.flap,'bk-pg bk-flap'+(mir?' bk-r':' bk-l'),null);Y.flap.style.visibility='hidden';
 Y.back.className=sp?'bk-back':'bk-back bk-paperback';Y.back.style.width=W+'px';Y.back.style.height=H+'px';const bh=sp?blankPg(backP):'';if(Y.back._h!==bh){Y.back.innerHTML=bh;Y.back._h=bh}
 const cy=(startY!=null?startY:H*.82)>H/2?H:0;
 T={dir,ni,W,H,mir,cy,real,front:real?pg:Y.copy,P:dir>0||sp?[W,cy]:[-W,cy],done:false};
 B.busy=true;foldTo(T.P);return true}
/* the corner positions that mean "not turned" and "fully turned" for this turn */
const P0=t=>t.dir>0||t.mir?[t.W,t.cy]:[-t.W,t.cy],P1=t=>t.dir>0||t.mir?[-t.W,t.cy]:[t.W,t.cy];
function foldTo(Pin){const t=T,Y=B.lay;if(!t||!Y)return;const{W,H,cy,mir}=t;let P=reach(Pin,W,H,cy);t.P=P;const C=[W,cy];
 const css=X=>mir?[W-X[0],X[1]]:X,v=[C[0]-P[0],C[1]-P[1]],len=Math.hypot(v[0],v[1]);
 if(len<.5){t.front.style.clipPath='';Y.flap.style.visibility='hidden';Y.sh.style.visibility='hidden';return}
 const n=[v[0]/len,v[1]/len],M=[(P[0]+C[0])/2,(P[1]+C[1])/2],rect=[[0,0],[W,0],[W,H],[0,H]];
 t.front.style.clipPath=poly(halfPlane(rect,n,M,true).map(css));
 /* the flap: the folded part, reflected over the fold line (in css space, mirrored for a left page); its clip is in its own coordinates */
 const refl=X=>{const d=2*dot([X[0]-M[0],X[1]-M[1]],n);return[X[0]-d*n[0],X[1]-d*n[1]]};
 const F=X=>css(refl(css(X))),o=F([0,0]),ex=F([1,0]),ey=F([0,1]);
 Y.flap.style.transform=`matrix(${(ex[0]-o[0]).toFixed(5)},${(ex[1]-o[1]).toFixed(5)},${(ey[0]-o[0]).toFixed(5)},${(ey[1]-o[1]).toFixed(5)},${o[0].toFixed(2)},${o[1].toFixed(2)})`;
 Y.flap.style.clipPath=poly(halfPlane(rect,n,M,false).map(css));
 /* shadows: strips that start at the fold line. The cast shadow falls on the page below (away from the spine), the
    shade on the lifted page sits on its spine side, and the gloss runs across the flap */
 const nc=mir?[-n[0],n[1]]:n,Mc=css(M),half=len/2,deg=Math.atan2(nc[1],nc[0])*180/Math.PI;
 const p=Math.max(0,Math.min(1,Math.abs(P[0]-P0(t)[0])/(2*W))),k=Math.sin(Math.PI*Math.min(1,p*1.15));
 const strip=(el,a,w,op)=>{el.style.transform=`translate(${Mc[0].toFixed(1)}px,${Mc[1].toFixed(1)}px) rotate(${a.toFixed(2)}deg) translate(0,-50%) scaleX(${(w/100).toFixed(3)})`;el.style.opacity=op.toFixed(3)};
 strip(Y.cs,deg,Math.max(30,Math.min(90,half*.6)),.5*k+.1);
 strip(Y.fs,deg+180,Math.max(28,Math.min(70,half*.5)),Math.min(1,.85*k+.15));
 strip(Y.gl,deg,Math.max(1,half),1);
 Y.flap.style.visibility='visible';Y.sh.style.visibility='visible'}
/* the turn is over: the real pages get their words (if it went through) and the turning layers are put away */
function turnEnd(done){if(!T)return;const t=T;T=null;B.busy=false;if(t.real)t.front.style.clipPath='';
 if(done){B.i=t.ni;rustle();paint()}
 if(B.lay)LAYS(B.lay).forEach(el=>{el.style.visibility='hidden';el.style.clipPath='';el.style.transform=''})}
/* finish (or undo) the turn: the corner travels in a slight arc, the way a hand lifts a page */
function finishNow(){if(T&&T.goal!=null)turnEnd(T.goal);if(V&&V.goal!=null)svEnd(V.goal)}
const EOUT=x=>1-Math.pow(1-x,3),EIO=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
function animTo(target,ms,cb,ease=EOUT){const t=T;if(!t)return cb&&cb();const a=t.P.slice(),t0=performance.now(),lift=(t.cy?-1:1)*t.H*.16;let fin=false;
 const end=()=>{if(fin)return;fin=true;if(T===t){foldTo(target);cb&&cb()}};
 const tick=now=>{if(fin||T!==t)return;const k=Math.max(0,Math.min(1,(now-t0)/ms)),e=ease(k);/* the first frame can be stamped before t0: k<0 would swing the page back for a frame */foldTo([a[0]+(target[0]-a[0])*e,a[1]+(target[1]-a[1])*e+lift*Math.sin(Math.PI*e)*Math.min(1,Math.abs(target[0]-a[0])/t.W)]);if(k<1)requestAnimationFrame(tick);else end()};
 requestAnimationFrame(tick);setTimeout(end,ms+150)}
function turn(dir){if(B.busy){if(D&&D.on)return;finishNow();if(B.busy)return}const st=BS().turn;if((st==='slide'||st==='fade')&&!reduced()){if(svStart(dir)){try{vib()}catch(e){}V.goal=true;chrome(V.ni);svAnim(1,Math.round((st==='fade'?340:420)*(SPEED[BS().speed]||1)),()=>svEnd(true))}return}if(reduced()){const ni=clampI(B.i+dir*step());if(ni===B.i)return;B.i=ni;fade();rustle();return}if(!turnStart(dir))return;try{vib()}catch(e){}T.goal=true;chrome(T.ni);animTo(P1(T),Math.round((B.sp?720:620)*(SPEED[BS().speed]||1)),()=>turnEnd(true),EIO)}
/* slide and fade: the next page (or spread) sits in its own layer next to this one; the drag moves both, and
   letting go springs to whichever is nearer (or where a flick points) */
let V=null;
function viewHTML(i){return B.sp?`<div class="bk-pg bk-l">${blankPg(B.P[i])}</div><div class="bk-pg bk-r">${blankPg(B.P[i+1])}</div>`:`<div class="bk-pg bk-r">${blankPg(B.P[i])}</div>`}
function svStart(dir){if(B.busy)return false;const ni=clampI(B.i+dir*step());if(ni===B.i)return false;const book=$b('#bkBook');if(!book)return false;const br=book.getBoundingClientRect();
 const nv=layer('bk-view',viewHTML(ni),{x:0,y:0,w:br.width,h:br.height});book.appendChild(nv);
 const cur=[...book.querySelectorAll(':scope>.bk-pg:not(.bk-lay),:scope>.bk-edge')];cur.forEach(e=>{e.style.willChange='transform,opacity'});
 V={dir,ni,nv,cur,w:br.width+28,mode:BS().turn,p:0};B.busy=true;svSet(0);return true}
function svSet(p){const v=V;if(!v)return;v.p=p;
 if(v.mode==='fade'){v.cur.forEach(e=>{e.style.opacity=(1-p).toFixed(3)})}
 else{const x=-v.dir*v.w*p;v.cur.forEach(e=>{e.style.transform=`translateX(${x.toFixed(1)}px)`});v.nv.style.transform=`translateX(${(x+v.dir*v.w).toFixed(1)}px)`}}
function svEnd(done){const v=V;if(!v)return;V=null;B.busy=false;const back=()=>{v.cur.forEach(e=>{e.style.transform='';e.style.opacity='';e.style.willChange=''});v.nv.remove()};
 /* done: the real pages get their words now; the incoming view was only blank paper, so it goes at once */
 if(done){B.i=v.ni;rustle();paint();v.cur.forEach(e=>{e.style.transform='';e.style.opacity='';e.style.willChange=''});v.nv.remove()}else back()}
function svAnim(p1,ms,cb){const v=V;if(!v)return cb&&cb();const a=v.p,t0=performance.now(),ease=x=>1-Math.pow(1-x,3);let fin=false;const end=()=>{if(fin)return;fin=true;if(V===v){svSet(p1);cb&&cb()}};
 const tick=now=>{if(fin||V!==v)return;const k=Math.max(0,Math.min(1,(now-t0)/ms));svSet(a+(p1-a)*ease(k));if(k<1)requestAnimationFrame(tick);else end()};requestAnimationFrame(tick);setTimeout(end,ms+150)}
function fade(){const bk=$b('#bkBook');paint();if(bk){bk.classList.remove('bk-fade');void bk.offsetWidth;bk.classList.add('bk-fade')}}
function jump(k){k=clampI(+k);if(k===B.i)return;B.i=k;fade()}

/* drag: the lifted corner follows the finger; past a quarter (or a flick) it finishes */
let D=null,RAF=0,NOCLICK=0;
/* an edge tap that turns the page must not also press a button near it (Chrome moves a tap onto a nearby button) */
document.addEventListener('click',e=>{if(NOCLICK&&performance.now()-NOCLICK<500&&e.target.closest&&e.target.closest('#bkBook')){e.stopPropagation();e.preventDefault()}NOCLICK=0},true);
function onDown(e){if(!B.open||e.button>0)return;const pb=e.target.closest('.bk-pc button');/* a swipe may start on a button in the page (Add to this day, edit); a tap still presses it */
 if(!pb&&e.target.closest('button,a,input,select,textarea,.bk-ix,.bk-top,.bk-bot'))return;const bk=$b('#bkBook');if(!bk||!bk.contains(e.target))return;if(B.busy){finishNow();if(B.busy)return}D={x:e.clientX,y:e.clientY,t:performance.now(),on:false,id:e.pointerId,vx:0,lx:e.clientX,lt:performance.now(),btn:!!pb}}
function frameXY(e){const t=T,pg=t.mir?$b('#bkL'):$b('#bkR'),r=pg.getBoundingClientRect();let x=e.clientX-r.left,y=e.clientY-r.top;if(t.mir)x=r.width-x;return[x,y]}
function onMove(e){if(!D||e.pointerId!==D.id)return;const dx=e.clientX-D.x,dy=e.clientY-D.y,now=performance.now();
 if(!D.on){if(Math.abs(dx)<9||Math.abs(dx)<Math.abs(dy)*1.25){if(Math.abs(dy)>14)D=null;return}const dir=dx<0?1:-1,pg=(B.sp&&dir<0)?$b('#bkL'):$b('#bkR'),r=pg.getBoundingClientRect();
  if(BS().turn!=='curl'&&!reduced()){if(!svStart(dir)){D=null;return}D.on=true;D.dir=dir;D.sv=true;try{$b('#bkBook').setPointerCapture(e.pointerId)}catch(_){}}
  else{if(!turnStart(dir,D.y-r.top)){D=null;return}D.on=true;D.dir=dir;D.o=frameXY({clientX:D.x,clientY:D.y});D.p0=T.P.slice();try{$b("#bkBook").setPointerCapture(e.pointerId)}catch(_){}}}
 e.preventDefault();D.vx=(e.clientX-D.lx)/Math.max(1,now-D.lt);D.lx=e.clientX;D.lt=now;
 if(D.sv){const p=Math.max(0,Math.min(1,(-dx*D.dir)/(V?V.w*.9:1)));cancelAnimationFrame(RAF);RAF=requestAnimationFrame(()=>svSet(p));return}
 const P=dragP(D,e);cancelAnimationFrame(RAF);RAF=requestAnimationFrame(()=>foldTo(P))}
/* where the lifted corner is for the finger at e; a phone page coming back from the left travels twice as far as the finger */
function dragP(d,e){const f=frameXY(e),t=T,k=(!t.mir&&t.dir<0&&!B.sp)?2:1;return[d.p0[0]+(f[0]-d.o[0])*k,d.p0[1]+(f[1]-d.o[1])*.9]}
function onUp(e){if(!D||(e.pointerId!==D.id&&e.type!=='pointercancel'))return;const d=D;D=null;
 if(!d.on){if(!d.btn&&e.type==='pointerup'&&Math.abs(e.clientX-d.x)<8&&Math.abs(e.clientY-d.y)<8&&!getSelection().toString()){const bk=$b('#bkBook').getBoundingClientRect(),x=(e.clientX-bk.left)/bk.width;if(x>.85||x<.15){NOCLICK=performance.now();turn(x>.85?1:-1)}}
  /* a quick swipe whose moves never arrived (only down and up): still a swipe */
  else if(e.type==='pointerup'){const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.25){NOCLICK=performance.now();turn(dx<0?1:-1)}}return}
 cancelAnimationFrame(RAF);
 /* the release can land well past the last move (moves get coalesced or dropped): it counts as the last move */
 if(e.type==='pointerup'&&e.clientX!==d.lx){const vx=(e.clientX-d.lx)/Math.max(1,performance.now()-d.lt);if(Math.abs(vx)>Math.abs(d.vx))d.vx=vx;
  if(d.sv){if(V)svSet(Math.max(0,Math.min(1,(-(e.clientX-d.x)*d.dir)/(V.w*.9))))}else if(T)foldTo(dragP(d,e))}if(d.sv){const v=V;if(!v)return;const fl=d.vx*-d.dir,go=v.p>.25||fl>.45;v.goal=go;if(go)chrome(v.ni);svAnim(go?1:0,Math.round(((go?1-v.p:v.p)*420+140)*(SPEED[BS().speed]||1)),()=>svEnd(go));return}
 const t=T;if(!t)return;const a=P0(t),z=P1(t),prog=Math.abs(t.P[0]-a[0])/Math.abs(z[0]-a[0]),fl=d.vx*(t.dir>0?-1:1)*(t.mir?-1:1);
 const go=prog>.25||fl>.5;t.goal=go;if(go)chrome(t.ni);animTo(go?z:a,Math.round(((go?1-prog:prog)*620+180)*(SPEED[BS().speed]||1)),()=>turnEnd(go))}

/* ---------------- open, close, write ---------------- */
function open(atDay){B.P=pages();B.sp=wide();B.set=false;if(!atDay&&BS().open==='last'&&BS().last)atDay=BS().last;let i=B.P.length-1;if(atDay){const k=B.P.findIndex(p=>p.d===atDay);if(k>=0)i=k}B.i=clampI(i);B.ix=false;
 let el=document.getElementById('book');if(el)el.remove();document.body.insertAdjacentHTML('beforeend',shell());el=document.getElementById('book');B.open=true;bkApply();
 document.documentElement.classList.add('bk-on');try{history.pushState({book:1},'')}catch(e){}paint();requestAnimationFrame(()=>el.classList.add('in'))}
function close(fromPop){const el=document.getElementById('book');if(!el)return;B.open=false;T=null;B.busy=false;document.documentElement.classList.remove('bk-on');el.classList.remove('in');setTimeout(()=>el.remove(),300);
 if(!fromPop&&history.state&&history.state.book){BKB=1;try{history.back()}catch(e){BKB=0}}if(cur.p==='journal'||cur.p==='threads')render(false)}
let BKB=0;
addEventListener('popstate',e=>{if(BKB){BKB=0;return}if(B.open&&!(e.state&&e.state.book)&&!$('#sheet').classList.contains('on')){close(true)}});
{const _b=window.__back;window.__back=function(){if(B.open&&!$('#sheet').classList.contains('on')){if(B.set){B.set=false;setShow();return true}if(B.ix){B.ix=false;ixShow();return true}close();return true}return _b.apply(this,arguments)}}
/* after writing or editing, the book comes back on that day */
{const _cs=closeSheet;closeSheet=function(){const r=_cs.apply(this,arguments);sheetLook(false);if(B.open){setTimeout(()=>{if(!B.open)return;const d=B.focus||(B.P[B.i]&&B.P[B.i].d);B.P=pages();const k=B.P.findIndex(p=>p.d===d);B.i=clampI(k>=0?k:B.i);paint()},420)}return r}}
function setShow(){const el=$b('#bkSet'),b=$b('.bk-top [data-act=bkSet]');if(!el)return;el.hidden=!B.set;if(b)b.setAttribute('aria-expanded',B.set);if(B.set){B.ix=false;ixShow();setPaint()}}
function ixShow(){const el=$b('#bkIx'),b=$b('.bk-top [data-act=bkIx]');if(!el)return;el.hidden=!B.ix;if(b)b.setAttribute('aria-expanded',B.ix);if(B.ix)ixPaint()}
Object.assign(ACT,{
 bkOpen:d=>open(d&&d.d),
 bkClose:()=>close(),
 bkNext:()=>turn(1),bkPrev:()=>turn(-1),
 bkIx:()=>{B.ix=!B.ix;if(B.ix&&B.set){B.set=false;setShow()}ixShow()},
 bkSet:()=>{B.set=!B.set;setShow()},
 bkSetV:d=>setChange(d.k,d.v),
 bkSetReset:()=>{const last=BS().last;S.settings.book={...BDEF,last};save();const sp=wide();if(sp!==B.sp){B.sp=sp;B.i=clampI(B.i)}bkApply();paint();setPaint()},
 bkGo:d=>{if(!wide()){B.ix=false;ixShow()}jump(d.i)},
 bkWrite:d=>{B.focus=d.d||ymd();writeSheet(null,null,B.focus);sheetLook(true)},
 bkEdit:d=>{const e=S.entries.find(x=>x.id===d.id);if(!e)return;B.focus=dayOf(e.t);writeSheet(e);sheetLook(true)}});
/* every journal entry is written on the book's paper (unless turned off in Aa) */
{const _ws=writeSheet;writeSheet=function(){const r=_ws.apply(this,arguments);try{sheetLook(true)}catch(e){}return r}}
/* the writer takes the book's paper, ink, font, size and lines while you write from the book */
const LOOKV=['--pp','--pp2','--ink','--ink2','--acc','--rule','--bkf','--bks','--bkl','--grain'];
function sheetLook(on){const sh=$('#sheet');if(!sh)return;let bk=document.getElementById('book'),tmp=null;if(on&&BS().wsync===false)on=false;
 /* the book is closed: read its look off a hidden copy */
 if(on&&!bk){tmp=document.createElement('div');tmp.className=bkCls();tmp.style.display='none';document.body.appendChild(tmp);bkStyle(tmp);bk=tmp}
 if(on){const cs=getComputedStyle(bk);LOOKV.forEach(k=>sh.style.setProperty(k,cs.getPropertyValue(k)));sh.classList.add('bk-write');sh.classList.toggle('bk-lined',BS().lines==='lined');sh.classList.toggle('bk-dots',BS().lines==='dots');if(tmp)tmp.remove()}else{LOOKV.forEach(k=>sh.style.removeProperty(k));sh.classList.remove('bk-write','bk-lined','bk-dots')}}
document.addEventListener('pointerdown',onDown);document.addEventListener('pointermove',onMove,{passive:false});document.addEventListener('pointerup',onUp);document.addEventListener('pointercancel',onUp);
document.addEventListener('keydown',e=>{if(!B.open||$('#sheet').classList.contains('on')||e.target.matches('input,textarea,[contenteditable]'))return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();turn(1)}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();turn(-1)}else if(e.key==='Escape'){e.preventDefault();if(B.set){B.set=false;setShow()}else if(B.ix){B.ix=false;ixShow()}else close()}});
document.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.bkset;if(!k||!B.open)return;setChange(k,e.target.type==='checkbox'?e.target.checked:e.target.value)});
document.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.bkset==='size'&&B.open)setChange('size',e.target.value)});
document.addEventListener('input',e=>{if(e.target.id!=='bkRange')return;const p=B.P[+e.target.value],b=$b('#bkBub');if(b)b.textContent=p?(p.k==='cover'?'Cover':dt(p.d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})):''});
document.addEventListener('change',e=>{if(e.target.id!=='bkRange')return;const b=$b('#bkBub');if(b)b.textContent='';jump(e.target.value)});
addEventListener('resize',()=>{if(!B.open||B.busy)return;const sp=wide();if(sp!==B.sp){B.sp=sp;B.i=clampI(B.i);document.getElementById('book').classList.toggle('sp',sp)}paint()});
/* Book is a third tab next to Journal and Notes, where people look for it (it opens the book over the page) */
if(typeof jSwitchRow==='function'){const _js=jSwitchRow;jSwitchRow=function(on){return _js.apply(this,arguments).replace(/(data-act="jvGo" data-v="threads">[^<]*<\/button>)/,`$1<button role="tab" aria-selected="false" class="bk-tab" data-act="jvGo" data-v="book">${ic('book')}Book</button>`)}}
{const _jv=ACT.jvGo;ACT.jvGo=function(d){if(d&&d.v==='book'){open();return}return _jv.apply(this,arguments)}}
if(typeof booted!=='undefined'&&booted&&(cur.p==='journal'||cur.p==='threads'))render(false);
window.BOOK={open,close,state:()=>({open:B.open,i:B.i,n:B.P.length,sp:B.sp,busy:B.busy})};

const GRAIN=(()=>{try{const n=160,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d'),d=x.createImageData(n,n);for(let k=0;k<d.data.length;k+=4){d.data[k]=107;d.data[k+1]=90;d.data[k+2]=64;d.data[k+3]=Math.random()<.5?Math.round(Math.random()*17):0}x.putImageData(d,0,0);return`url(${c.toDataURL('image/png')})`}catch(e){return'linear-gradient(transparent,transparent)'}})();
const css=document.createElement('style');css.textContent=`
html.bk-on{overflow:hidden}
.bk{--pp:#f7f1e4;--pp2:#efe6d3;--ink:#2b261f;--ink2:#7c705e;--rule:rgba(90,70,40,.16);--acc:#8a5a2b;--desk:radial-gradient(130% 100% at 50% 35%,#ece6dc 0,#d9d1c4 60%,#c9bfaf 100%);--board:#5a3a2a;
 position:fixed;inset:0;z-index:56;display:flex;flex-direction:column;background:var(--desk);color:var(--ink);opacity:0;transition:opacity .3s ease;padding:var(--sat,env(safe-area-inset-top)) 0 var(--sab,env(safe-area-inset-bottom));-webkit-tap-highlight-color:transparent}
.bk.dk{--pp:#25221e;--pp2:#1f1c19;--ink:#ece4d6;--ink2:#a2967f;--rule:rgba(236,220,190,.12);--acc:#d9b27c;--desk:radial-gradient(130% 100% at 50% 35%,#2e2a26 0,#191715 62%,#0d0c0b 100%);--board:#3a281f}
.bk.in{opacity:1}
.bk{--grain:${GRAIN};--bkf:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;--bks:18px;--bkl:1.72}.bk.nograin{--grain:linear-gradient(transparent,transparent)}
.bk.pp-app{--pp:var(--surface);--pp2:color-mix(in srgb,var(--surface) 82%,var(--bg));--ink:var(--text);--ink2:var(--muted);--rule:var(--line);--acc:var(--accent);--desk:var(--bg)}
.bk.pp-cream{--pp:#f7f1e4;--pp2:#efe6d3;--ink:#2b261f;--ink2:#7c705e;--rule:rgba(90,70,40,.16);--acc:#8a5a2b}
.bk.pp-white{--pp:#fdfdfb;--pp2:#efefec;--ink:#1d1f24;--ink2:#6c707a;--rule:rgba(30,40,60,.13);--acc:#3d5a98}
.bk.pp-sepia{--pp:#eedfc0;--pp2:#e1cfa9;--ink:#3a2a17;--ink2:#7b6343;--rule:rgba(110,70,20,.2);--acc:#8b4a17}
.bk.pp-grey{--pp:#e8e7e3;--pp2:#dad8d2;--ink:#232323;--ink2:#6d6a64;--rule:rgba(0,0,0,.13);--acc:#4f566b}
.bk.pp-black{--pp:#0d0d0d;--pp2:#151515;--ink:#e7e2d9;--ink2:#8e8679;--rule:rgba(255,240,210,.1);--acc:#d9b27c;--desk:#000}
.bk.ln-lined .bk-pc:not(.bk-cover){background-image:repeating-linear-gradient(transparent 0 calc(var(--bks) * var(--bkl) - 1px),var(--rule) calc(var(--bks) * var(--bkl) - 1px) calc(var(--bks) * var(--bkl)));background-attachment:local;background-position:0 calc(var(--bks) * .32)}
.bk.ln-dots .bk-pc:not(.bk-cover){background-image:radial-gradient(var(--rule) 1.1px,transparent 1.5px);background-size:22px 22px;background-attachment:local}
.bk.nodrop .bk-e.first .bk-x>:first-child::first-letter{float:none;font-size:inherit;line-height:inherit;padding:0;color:inherit;font-weight:inherit}
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
.bk-pg{position:relative;min-width:0;min-height:0;grid-row:1;overflow:hidden;background-color:var(--pp);background-image:var(--grain),linear-gradient(90deg,rgba(0,0,0,.07),rgba(0,0,0,0) 7%,rgba(0,0,0,0) 93%,rgba(0,0,0,.03));border-radius:3px 8px 8px 3px;z-index:1}
.bk-pg.bk-l{display:none}.bk.sp .bk-pg.bk-l{display:block;grid-column:1;border-radius:8px 2px 2px 8px;background-image:var(--grain),linear-gradient(270deg,rgba(0,0,0,.16),rgba(0,0,0,.05) 5%,rgba(0,0,0,0) 12%)}
.bk.sp .bk-pg.bk-r{grid-column:2;border-radius:2px 8px 8px 2px;background-image:var(--grain),linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,.05) 5%,rgba(0,0,0,0) 12%)}
.bk:not(.sp) .bk-pg.bk-r{background-image:var(--grain),linear-gradient(90deg,rgba(0,0,0,.14),rgba(0,0,0,.04) 4%,rgba(0,0,0,0) 9%)}
/* turning layers */
.bk-lay{position:absolute;z-index:3;pointer-events:none}
.bk-lay.bk-pg{display:block!important}
/* turning layers are placed against the whole book, never inside a grid column (that shifted them a page to the right) */
.bk .bk-lay{grid-column:1/-1!important;grid-row:1!important}
/* 1.60.1, as in Noor: the flap moves and clips on one element; the shadows are strips moved with transforms */
.bk-book>.bk-pg:not(.bk-lay){will-change:clip-path}
.bk-flap{z-index:4!important;transform-origin:0 0;will-change:transform,clip-path;border-radius:3px 8px 8px 3px;background-image:var(--grain)}
.bk-shw{overflow:hidden}
.bk-cs,.bk-fs,.bk-gl{position:absolute;left:0;top:0;width:100px;height:300%;transform-origin:0 0;pointer-events:none}
.bk-cs{background:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,.14) 40%,rgba(0,0,0,0))}
.bk-fs{background:linear-gradient(90deg,rgba(0,0,0,.4),rgba(0,0,0,.14) 40%,rgba(0,0,0,0))}
.bk-gl{background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.22) 6%,rgba(255,255,255,0) 45%,rgba(0,0,0,.12))}
.bk-back{position:absolute;left:0;top:0;transform:matrix(-1,0,0,1,0,0);transform-origin:50% 50%}
.bk-paperback{inset:0;background:linear-gradient(90deg,var(--pp2),var(--pp))}
/* the page itself */
.bk-pc{height:100%;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;padding:28px 30px 16px 38px;scrollbar-width:none;outline:0;font-family:var(--bkf);position:relative}
.bk-pc::-webkit-scrollbar{display:none}
.bk.sp .bk-l .bk-pc,.bk-flap.bk-l .bk-pc,.bk-lay.bk-l .bk-pc{padding:28px 38px 16px 30px}
.bk-run{text-align:center;font:600 10.5px/1 var(--f-body);letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);margin-bottom:18px}
.bk-ph{display:flex;align-items:center;gap:14px;margin:0 0 20px;padding-bottom:16px;border-bottom:1px solid var(--rule)}
.bk-dn{font:400 58px/.85 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;color:var(--acc);font-variant-numeric:lining-nums}
.bk-dw{display:flex;flex-direction:column;gap:3px}.bk-dw b{font-size:21px;font-weight:600;letter-spacing:.01em}.bk-dw span{font-style:italic;color:var(--ink2);font-size:15px}
.bk-e{margin:0 0 6px}.bk-eh{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.bk-tm{font:600 10.5px var(--f-body);letter-spacing:.12em;text-transform:uppercase;color:var(--ink2);white-space:nowrap;font-variant-numeric:tabular-nums}
.bk-mood{font-size:13px;color:var(--ink2)}.bk-mood i{font-style:italic}
.bk-ed{margin-left:auto;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;border:0;background:none;color:var(--ink2);cursor:pointer;opacity:.75}.bk-ed:hover{opacity:1;background:color-mix(in srgb,var(--ink) 8%,transparent)}.bk-ed svg{width:15px;height:15px}
.bk-e h3{font:600 21px/1.3 inherit;font-family:inherit;margin:0 0 8px;overflow-wrap:anywhere}
.bk-x{font-size:var(--bks);line-height:var(--bkl);overflow-wrap:anywhere;hyphens:auto}.bk-x p{margin:0 0 .7em}.bk-x img{max-width:100%;height:auto;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.18)}.bk-x ul,.bk-x ol{padding-left:22px;margin:0 0 .7em}.bk-x mark{background:color-mix(in srgb,var(--acc) 26%,transparent);color:inherit;border-radius:2px}
.bk-e.first .bk-x>:first-child::first-letter{float:left;font-size:3.4em;line-height:.82;padding:6px 8px 0 0;color:var(--acc);font-weight:500}
.bk-img{display:block;max-width:100%;max-height:44vh;border-radius:4px;margin:6px auto 12px;box-shadow:0 3px 12px rgba(0,0,0,.22);transform:rotate(-.6deg)}
.bk-g{margin-top:2px;font-style:italic;font-size:14px;color:var(--ink2)}
.bk-orn{text-align:center;color:var(--ink2);margin:16px 0 14px;letter-spacing:.4em;font-size:15px}
.bk-mos{list-style:none;margin:18px 0 20px;padding:14px 0 0;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:8px}
.bk-mos li{display:flex;gap:12px;font-size:15px;line-height:1.45}.bk-mos .bk-tm{min-width:5.2em;padding-top:3px}.bk-mos em{color:var(--ink2)}
.bk-empty{color:var(--ink2);font-style:italic;font-size:17px;margin:10px 0 22px}
.bk-add{display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:8px 2px;border:0;border-bottom:1px solid color-mix(in srgb,var(--acc) 45%,transparent);background:none;color:var(--acc);font:italic 16px 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;cursor:pointer}.bk-add svg{width:15px;height:15px}
.bk-pn{margin-top:auto;padding-top:22px;text-align:center;font-size:13px;color:var(--ink2);pointer-events:none;font-variant-numeric:oldstyle-nums}
/* the cover: leather with a gold-foil title */
.bk-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:34px;background:radial-gradient(120% 90% at 30% 20%,color-mix(in srgb,var(--board) 70%,#fff 14%),var(--board) 55%,color-mix(in srgb,var(--board) 70%,#000)),var(--grain);color:#f1e3c0}
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
.bk-ix{position:absolute;top:0;bottom:0;right:0;width:min(360px,90vw);z-index:8;overflow-y:auto;overscroll-behavior:contain;background-color:var(--pp);background-image:var(--grain);color:var(--ink);box-shadow:-30px 0 50px -20px rgba(0,0,0,.55);padding:0 12px calc(16px + var(--sab,env(safe-area-inset-bottom)));font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;animation:bkIx .32s cubic-bezier(.2,.8,.2,1)}
@keyframes bkIx{from{transform:translateX(30px);opacity:0}}
/* the panel's header runs under the status bar, so what scrolls under it never shows up there */
.bk-ixh{display:flex;align-items:center;justify-content:space-between;margin:0 -12px;padding:calc(max(12px,var(--sat,env(safe-area-inset-top))) + 6px) 16px 12px;position:sticky;top:0;background:var(--pp);z-index:1}.bk-ixh b{font-size:22px;font-weight:600}
.bk-ixm{margin:18px 8px 8px;font:600 10.5px var(--f-body);letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.bk-ixr{display:flex;align-items:center;gap:12px;width:100%;padding:10px 8px;border:0;border-bottom:1px solid var(--rule);background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}.bk-ixr.on{background:color-mix(in srgb,var(--acc) 14%,transparent);border-radius:8px}
.bk-ixd{width:34px;flex:none;text-align:center;font-size:22px;color:var(--acc)}
.bk-ixt{flex:1;min-width:0;display:flex;flex-direction:column}.bk-ixt b{font-size:16px;font-weight:600}.bk-ixt small{color:var(--ink2);font-size:14px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bk-ixp{color:var(--ink2);font-size:13px;font-variant-numeric:oldstyle-nums}
.bk-sln{animation:bkSlN .38s cubic-bezier(.2,.8,.2,1)}.bk-slp{animation:bkSlP .38s cubic-bezier(.2,.8,.2,1)}
@keyframes bkSlN{from{transform:translateX(46px);opacity:.15}}@keyframes bkSlP{from{transform:translateX(-46px);opacity:.15}}
.bk-aa{font:600 16px 'Iowan Old Style',Palatino,Georgia,serif}
.bk-set h4{margin:18px 6px 8px;font:600 10.5px var(--f-body);letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.bk-sg{display:flex;flex-wrap:wrap;gap:4px;padding:4px;margin:0 2px 8px;border-radius:12px;background:color-mix(in srgb,var(--ink) 7%,transparent)}
.bk-sg button{flex:1 1 auto;min-width:0;padding:8px 10px;border:0;border-radius:9px;background:none;color:var(--ink);font:500 14px var(--f-body);cursor:pointer}.bk-sg button.on{background:var(--pp);box-shadow:0 1px 4px rgba(0,0,0,.2);font-weight:700}
.bk-tg{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 6px;font:15px var(--f-body);cursor:pointer}.bk-tg input{position:absolute;opacity:0;pointer-events:none}
.bk-tg i{width:42px;height:25px;flex:none;border-radius:999px;background:color-mix(in srgb,var(--ink) 18%,transparent);position:relative;transition:background .2s}.bk-tg i::after{content:"";position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.bk-tg input:checked+i{background:var(--acc)}.bk-tg input:checked+i::after{transform:translateX(17px)}.bk-tg input:focus-visible+i{outline:2px solid var(--acc);outline-offset:2px}
.bk-sw{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 2px 6px}
.bk-sw button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 2px;border:0;border-radius:12px;background:none;color:var(--ink);font:12px var(--f-body);cursor:pointer;min-width:0}.bk-sw span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bk-sw i{width:40px;height:40px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.2)}.bk-sw button.on i{box-shadow:0 0 0 2px var(--pp),0 0 0 4px var(--acc)}
.p-app i{background:linear-gradient(135deg,var(--surface) 0 50%,var(--accent) 50%)}.p-auto i{background:linear-gradient(135deg,#f7f1e4 50%,#25221e 50%)}.p-cream i{background:#f7f1e4}.p-white i{background:#fdfdfb}.p-sepia i{background:#eedfc0}.p-grey i{background:#e8e7e3}.p-dark i{background:#25221e}.p-black i{background:#0d0d0d}
.bk-swc i{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 80%,#fff 15%),var(--c))}
.bk-rg{display:flex;align-items:center;gap:12px;padding:8px 6px;font:15px var(--f-body)}.bk-rg input{flex:1;accent-color:var(--acc)}.bk-rg b{width:2em;text-align:right;font-variant-numeric:tabular-nums}
.bk-reset{display:block;margin:18px auto 6px;padding:10px 16px;border:0;border-radius:12px;background:none;color:var(--ink2);font:14px var(--f-body);text-decoration:underline;cursor:pointer}
/* sideways swipes belong to the book: each page scrolls only up and down, so Android never cancels the touch to pan it */
.bk-book,.bk-book *{touch-action:pan-y}
.bk-under{z-index:0!important}
.bk-view{z-index:0!important;display:grid;grid-template-columns:1fr;will-change:transform,opacity}.bk.sp .bk-view{grid-template-columns:1fr 1fr}.bk-view>.bk-pg{position:relative;grid-row:1}
#sheet.bk-write{background-color:var(--pp)!important;background-image:var(--grain)!important;color:var(--ink)}
#sheet.bk-write .wr-title,#sheet.bk-write #wrEd{font-family:var(--bkf);color:var(--ink);background-color:transparent}
#sheet.bk-write .wr-title{font-size:calc(var(--bks) * 1.25);font-weight:600}
#sheet.bk-write #wrEd{font-size:var(--bks);line-height:var(--bkl)}
#sheet.bk-write.bk-lined #wrEd{background-image:repeating-linear-gradient(transparent 0 calc(var(--bks) * var(--bkl) - 1px),var(--rule) calc(var(--bks) * var(--bkl) - 1px) calc(var(--bks) * var(--bkl)));background-attachment:local}
#sheet.bk-write.bk-dots #wrEd{background-image:radial-gradient(var(--rule) 1.1px,transparent 1.5px);background-size:22px 22px;background-attachment:local}
#sheet.bk-write .data,#sheet.bk-write .wr-m small,#sheet.bk-write ::placeholder{color:var(--ink2)}
#sheet.bk-write .wr-pill,#sheet.bk-write .wr-tb button,#sheet.bk-write .wr-m,#sheet.bk-write .ibtn{color:var(--ink);border-color:var(--rule);background-color:color-mix(in srgb,var(--ink) 5%,transparent)}
#sheet.bk-write .wr-top::before{background:var(--pp)}
#sheet.bk-write .wr-pill.on,#sheet.bk-write .wr-m.on{background-color:color-mix(in srgb,var(--acc) 22%,transparent);border-color:var(--acc)}
#sheet.bk-write .btn.pri,#sheet.bk-write .wr-pr{background:var(--acc);color:var(--pp);border-color:var(--acc)}
#sheet.bk-write mark{background:color-mix(in srgb,var(--acc) 30%,transparent);color:inherit}
.bk-fade{animation:bkFade .35s ease}@keyframes bkFade{from{opacity:.25;transform:scale(.995)}to{opacity:1;transform:none}}
.bk-tab{display:inline-flex;align-items:center;gap:6px}.bk-tab svg{width:16px;height:16px}
@media(max-width:560px){.bk-pc{padding:24px 22px 14px 28px}.bk-x{font-size:17px}.bk-dn{font-size:50px}.bk-stage{padding:6px 12px 8px}}
@media(prefers-reduced-motion:reduce){.bk{transition:none}.bk-ix{animation:none}}
`;document.head.appendChild(css);
})();
