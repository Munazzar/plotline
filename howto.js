/* How-to: step-by-step guides to everything in Plotlines, searchable from the How-to page and from Find anything.
   Each guide can carry a live demo: the real app runs in a frame (index.html?demo=<guide>) on sample data and walks
   through the steps in a loop, with a pointer tapping and typing exactly as you would. The frame is a sandbox (see the
   ?demo= script at the top of index.html): storage stays in memory and the phone's bridges are switched off, so a demo
   can never touch your plan, alarms, widgets or sync. The guides themselves live in guides.js (window.HOWTO_GUIDES). */
(()=>{
'use strict';
const DEMO=window.PLOT_DEMO||'';
Object.assign(IC,{howto:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
 play:'<path d="M8 5.5v13l10.5-6.5z"/>',pause:'<path d="M8.5 5.5v13M15.5 5.5v13"/>',phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
 desk:'<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>'});
/* icons the guides use that the app doesn't have yet */
const ICX={chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 cloud:'<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.4 4.3 4.3 0 0 0 7 18z"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>',zap:'<path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z"/>',
 bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'};
for(const k in ICX)if(!IC[k])IC[k]=ICX[k];
const G=()=>window.HOWTO_GUIDES||[];
const byId=id=>G().find(g=>g.id===id);
const CATS=()=>[...new Set(G().map(g=>g.cat))];
const stepText=s=>typeof s==='string'?s:s.x;

if(!DEMO){
/* ======================= the How-to page ======================= */
const HW={q:'',cat:'',dev:matchMedia('(min-width:900px)').matches?'desk':'phone',step:-1,paused:false,key:''};

/* search: every word must match the start of a word somewhere in the guide; titles weigh most */
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'');
const words=s=>norm(s).split(/[^a-z0-9+]+/).filter(Boolean);
const IDX=new Map();
function idx(g){let x=IDX.get(g.id);if(x)return x;x={t:words(g.title),k:words((g.keys||'')+' '+g.cat),s:words(g.sum),st:g.steps.map(s=>words(stepText(s))),tip:words((g.tips||[]).join(' '))};IDX.set(g.id,x);return x}
function score(g,q){const Q=words(q);if(!Q.length)return{n:1};const x=idx(g);let n=0,step=-1;
 for(const w of Q){const has=L=>L.some(v=>v.startsWith(w));let k=0;if(has(x.t))k+=w.length>2&&x.t.includes(w)?12:8;if(has(x.k))k+=5;if(has(x.s))k+=3;
  const si=x.st.findIndex(has);if(si>=0){k+=2;if(step<0)step=si}if(has(x.tip))k+=1;if(!k)return null;n+=k}
 if(norm(g.title).includes(norm(q).trim()))n+=10;return{n,step}}
function search(q,cat){return G().map(g=>({g,r:(!cat||g.cat===cat)?score(g,q):null})).filter(x=>x.r).sort((a,b)=>b.r.n-a.r.n)}
const mark=(s,q)=>{let o=esc(s);const Q=words(q).filter(w=>w.length>1);if(!Q.length)return o;
 return o.replace(new RegExp(`\\b(${Q.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`,'gi'),'<mark>$1</mark>')};

function row(g,q,r){const hit=q&&r&&r.step>=0?`<small class="hw-hit">Step ${r.step+1}: ${mark(stepText(g.steps[r.step]),q)}</small>`:`<small>${mark(g.sum,q)}</small>`;
 return`<a class="hw-r" href="#/howto/${g.id}"><span class="hw-ri">${ic(IC[g.ic]?g.ic:'howto')}</span><span class="hw-rt"><b>${mark(g.title,q)}</b>${hit}</span>${g.demo?`<span class="hw-live" title="Live demo">${ic('play')}</span>`:''}${ic('next','ico-s')}</a>`}
function results(){const q=HW.q.trim(),L=search(q,HW.cat);if(!L.length)return`<div class="empty"><h3>Nothing matches “${esc(q)}”</h3><p class="muted">Try fewer or different words, like “reminder”, “habit” or “sync”.</p></div>`;
 if(q)return`<div class="data hw-n">${L.length} guide${L.length===1?'':'s'}</div><div class="hw-list">${L.map(x=>row(x.g,q,x.r)).join('')}</div>`;
 return CATS().filter(c=>!HW.cat||c===HW.cat).map(c=>`<section class="hw-sec"><h2 class="data">${esc(c)}</h2><div class="hw-list">${L.filter(x=>x.g.cat===c).map(x=>row(x.g,'',null)).join('')}</div></section>`).join('')}

function vIndex(){const n=G().length,d=G().filter(g=>g.demo).length;
 return`<header class="ph"><div><h1>How-to</h1><div class="data">${n} step-by-step guides · ${d} with a live demo</div></div><div class="ph-r">${gear()}</div></header>
 <div class="hw-search rv">${ic('search')}<input id="hwq" data-hwq type="search" placeholder="Search the guides: reminders, sync, habits…" value="${esc(HW.q)}" autocomplete="off" enterkeyhint="search" aria-label="Search the how-to guides"></div>
 <div class="hw-cats rv" role="tablist"><button class="chip${HW.cat?'':' on'}" data-act="hwCat" data-v="">All</button>${CATS().map(c=>`<button class="chip${HW.cat===c?' on':''}" data-act="hwCat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
 <div id="hwr" class="rv">${results()}</div>`}

/* the demo frame: the app itself, at phone or desktop size, scaled to fit */
const DEV={phone:[390,800],desk:[1280,800]};
function frameSrc(g,from){const th=S.settings.theme||'';return`index.html?demo=${encodeURIComponent(g.id)}&th=${encodeURIComponent(th)}${from?'&from='+from:''}&v=${encodeURIComponent(APP_VER)}`}
function devHTML(g){const[w,h]=DEV[HW.dev];HW.key=g.id+':'+HW.dev+':'+(HW.from||0);
 return`<div class="hw-dev ${HW.dev}" data-key="${esc(HW.key)}" style="--w:${w};--h:${h}"><div class="hw-scr"><iframe title="Live demo: ${esc(g.title)}" src="${frameSrc(g,HW.from)}" loading="lazy" tabindex="-1" referrerpolicy="no-referrer"></iframe><div class="hw-fade"></div></div></div>`}
function ctlHTML(){return`<div class="hw-ctl"><div class="seg-c hw-seg" role="radiogroup" aria-label="Demo size"><button class="${HW.dev==='phone'?'on':''}" data-act="hwDev" data-v="phone" aria-label="Phone">${ic('phone')}<span>Android</span></button><button class="${HW.dev==='desk'?'on':''}" data-act="hwDev" data-v="desk" aria-label="Web">${ic('desk')}<span>Web</span></button></div>
 <span style="flex:1"></span><button class="ibtn" data-act="hwPlay" id="hwPlay" aria-label="${HW.paused?'Play':'Pause'}">${ic(HW.paused?'play':'pause')}</button><button class="ibtn" data-act="hwRestart" aria-label="Start again">${ic('reset')}</button></div>`}

function vGuide(id){const g=byId(id);if(!g)return`<div class="crumb"><a href="#/howto" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a></div><div class="empty"><h3>That guide isn’t here</h3><p><a href="#/howto">See all guides</a></p></div>`;
 const rel=(g.rel||[]).map(byId).filter(Boolean),i=G().indexOf(g),nx=G()[i+1];
 return`<div class="crumb"><a href="#/howto" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a></div>
 <header class="ph hw-h"><div><div class="data">${esc(g.cat)}${g.only?` · ${esc(g.only)}`:''}</div><h1>${esc(g.title)}</h1></div></header>
 <p class="hw-sum rv">${esc(g.sum)}</p>${g.go?`<div class="hw-try rv"><button class="btn sm" data-act="hwTry" data-r="${esc(g.go)}">Open it in the app ${ic('next','ico-s')}</button></div>`:''}
 <div class="hw-body">
 ${g.demo?`<section class="hw-demo rv" aria-label="Live demo"><div class="hw-dh"><span class="hw-dot"></span><b>Watch it</b><small>The real app on sample data, looping</small></div>${devHTML(g)}${ctlHTML()}</section>`:''}
 <section class="hw-steps rv"><h2 class="data">Step by step</h2><ol>${g.steps.map((s,k)=>`<li class="${k===HW.step?'on':''}" data-k="${k}"${g.demo?` data-act="hwStep" data-i="${k}" role="button" tabindex="0" title="Show this step in the demo"`:''}><i>${k+1}</i><span>${esc(stepText(s))}</span></li>`).join('')}</ol>
 ${(g.tips||[]).length?`<div class="hw-tips"><h3>${ic('bulb','ico-s')} Good to know</h3><ul>${g.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}
 ${rel.length||nx?`<div class="hw-rel"><h3 class="data">Related</h3><div class="hw-list">${[...rel,...(nx&&!rel.includes(nx)?[nx]:[])].slice(0,4).map(r=>row(r,'',null)).join('')}</div></div>`:''}
 </section></div>`}

function vHowto(id){if(id){if(HW.gid!==id){HW.gid=id;HW.step=-1;HW.paused=false;HW.from=0}return vGuide(id)}HW.gid='';return vIndex()}
VIEWS.howto=vHowto;

/* re-renders keep the running demo: a guide's page has nothing else that changes, so the same guide in the same size is left as it is */
{const _vs=viewSet;viewSet=function(v,h){const old=cur.p==='howto'&&v.querySelector('.hw-dev');if(old&&h.includes(`data-key="${old.dataset.key}"`))return;_vs(v,h)}}

/* talking to the demo frame */
const frame=()=>$('#view .hw-dev iframe');
const tell=m=>{const f=frame();try{f&&f.contentWindow&&f.contentWindow.postMessage({howto:1,...m},location.origin==='null'?'*':location.origin)}catch(e){}};
window.addEventListener('message',e=>{const d=e.data;if(!d||!d.howto||cur.p!=='howto')return;const f=frame();if(!f||e.source!==f.contentWindow)return;
 if(d.t==='step'){HW.step=d.i;document.querySelectorAll('#view .hw-steps li').forEach(li=>li.classList.toggle('on',+li.dataset.k===d.i))}
 else if(d.t==='loop'){const fd=$('#view .hw-fade');if(fd){fd.classList.add('on');setTimeout(()=>fd.classList.remove('on'),900)}}
 else if(d.t==='paused'){HW.paused=!!d.v;const b=$('#hwPlay');if(b){b.innerHTML=ic(HW.paused?'play':'pause');b.setAttribute('aria-label',HW.paused?'Play':'Pause')}}});
/* the frame is drawn at a real phone or desktop size, then scaled to the space it has */
function fit(){document.querySelectorAll('#view .hw-dev').forEach(d=>{const w=+getComputedStyle(d).getPropertyValue('--w')||390,h=+getComputedStyle(d).getPropertyValue('--h')||800;
 const avail=d.clientWidth,maxH=Math.max(360,innerHeight*(d.classList.contains('phone')?.74:.62)),k=Math.min(1,avail/w,maxH/h);d.style.setProperty('--k',k.toFixed(4));d.style.height=Math.round(h*k)+'px'})}
new MutationObserver(()=>{if(cur.p==='howto')requestAnimationFrame(fit)}).observe($('#view'),{childList:true});
window.addEventListener('resize',()=>{if(cur.p==='howto')fit()});

document.addEventListener('input',e=>{const t=e.target;if(!t||!t.matches||!t.matches('[data-hwq]'))return;HW.q=t.value;const r=$('#hwr');if(r)r.innerHTML=results()});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t&&t.matches&&t.matches('#view .hw-steps li[data-act]')){e.preventDefault();t.click()}
 if(e.key==='Enter'&&t&&t.matches&&t.matches('[data-hwq]')){const a=$('#hwr .hw-r');if(a){e.preventDefault();location.hash=a.getAttribute('href')}}});
Object.assign(ACT,{
 hwCat:d=>{HW.cat=d.v||'';const r=$('#hwr');document.querySelectorAll('#view .hw-cats .chip').forEach(c=>c.classList.toggle('on',(c.dataset.v||'')===HW.cat));if(r)r.innerHTML=results()},
 hwDev:d=>{if(HW.dev===d.v)return;HW.dev=d.v;HW.paused=false;render(false)},
 hwPlay:()=>{HW.paused=!HW.paused;tell({t:HW.paused?'pause':'play'});ACT_PAINT()},
 hwRestart:()=>{HW.from=0;HW.step=-1;HW.paused=false;HW.key='';HW.n=(HW.n||0)+1;const f=frame();if(f)f.src=f.src.replace(/&from=\d+/,'');ACT_PAINT();document.querySelectorAll('#view .hw-steps li').forEach(li=>li.classList.remove('on'))},
 hwStep:d=>{const i=+d.i||0,f=frame();if(!f)return;HW.paused=false;HW.step=i;tell({t:'goto',i});ACT_PAINT();const dm=$('#view .hw-demo');if(dm&&dm.getBoundingClientRect().top<0)dm.scrollIntoView({behavior:'smooth',block:'start'})},
 hwTry:d=>go(d.r)});
function ACT_PAINT(){const b=$('#hwPlay');if(b){b.innerHTML=ic(HW.paused?'play':'pause');b.setAttribute('aria-label',HW.paused?'Play':'Pause')}}

/* the guides show up in Find anything too: under the app's own results, as they are typed */
const fRow2=(r,t,sub)=>`<button class="fnd-r" data-act="fndGo" data-r="${esc(r)}"><i></i><span class="t"><b>${esc(t)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${ic('next','ico-s')}</button>`;
document.addEventListener('input',e=>{const t=e.target;if(!t||!t.matches||!t.matches('[data-find]'))return;const r=$('#fndr');if(!r)return;const q=t.value.trim();if(!q)return;
 const L=search(q,'').slice(0,6);if(!L.length)return;const rows=`<div class="fnd-g data">How-to</div>`+L.map(x=>fRow2('howto/'+x.g.id,x.g.title,x.r.step>=0?`Step ${x.r.step+1}: ${stepText(x.g.steps[x.r.step])}`:x.g.sum)).join('');
 if(r.querySelector('.fnd-r'))r.insertAdjacentHTML('beforeend',rows);else r.innerHTML=rows});

/* the More sheet and the sidebar find it through PAGES; it gets its own icon */
const css=document.createElement('style');css.textContent=`
.hw-search{display:flex;align-items:center;gap:10px;padding:0 16px;height:52px;border-radius:18px;border:1px solid var(--line);background:var(--surface);margin:0 0 12px;max-width:760px}
.hw-search svg{width:19px;height:19px;color:var(--muted);flex:none}.hw-search input{flex:1;min-width:0;border:0;background:none;outline:0;font:500 16px var(--f-body);color:var(--text);height:100%}
.hw-search:focus-within{border-color:color-mix(in srgb,var(--accent) 60%,var(--line))}
.hw-cats{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px 18px;padding:2px 16px}.hw-cats::-webkit-scrollbar{display:none}.hw-cats .chip{flex:none}
.hw-sec{margin-bottom:22px;max-width:760px}.hw-sec h2,.hw-n{margin:0 4px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.hw-list{display:grid;gap:6px;max-width:760px}
.hw-r{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:var(--surface);border:1px solid var(--line);color:var(--text);text-decoration:none;transition:border-color .2s,transform .4s var(--spring,ease)}
.hw-r:hover{border-color:var(--line-2)}.hw-r:active{transform:scale(.99)}
.hw-ri{flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:var(--bg-2);color:var(--accent)}.hw-ri svg{width:18px;height:18px}
.hw-rt{flex:1;min-width:0}.hw-rt b{display:block;font-size:15px;font-weight:650}.hw-rt small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hw-rt mark{background:color-mix(in srgb,var(--accent) 26%,transparent);color:inherit;border-radius:4px;padding:0 1px}
.hw-live{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}.hw-live svg{width:12px;height:12px;fill:currentColor;stroke:none}
.hw-h h1{font-size:clamp(30px,6vw,52px)}.hw-h{margin-bottom:10px}
.hw-sum{font-size:16px;line-height:1.5;color:var(--muted);max-width:640px;margin:0 0 18px}
.hw-body{display:grid;gap:18px;align-items:start}@media(min-width:980px){.hw-body{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}.hw-demo{position:sticky;top:16px}}
.hw-demo{padding:14px;border-radius:26px;border:1px solid var(--line);background:var(--surface)}
.hw-dh{display:flex;align-items:center;gap:8px;margin:0 2px 12px}.hw-dh b{font-size:15px}.hw-dh small{color:var(--muted);font-size:12.5px;margin-left:auto}
.hw-dot{width:8px;height:8px;border-radius:50%;background:#ef4b4b;box-shadow:0 0 0 0 rgba(239,75,75,.5);animation:hwRec 1.8s infinite}
@keyframes hwRec{70%{box-shadow:0 0 0 7px rgba(239,75,75,0)}100%{box-shadow:0 0 0 0 rgba(239,75,75,0)}}
.hw-dev{position:relative;margin:0 auto;width:100%;--k:.8;overflow:hidden}
.hw-scr{position:absolute;left:50%;top:0;width:calc(var(--w)*1px);height:calc(var(--h)*1px);transform:translateX(-50%) scale(var(--k));transform-origin:top center;border-radius:calc(28px / var(--k));overflow:hidden;background:var(--bg);box-shadow:0 0 0 calc(7px / var(--k)) color-mix(in srgb,var(--text) 88%,transparent),0 24px 60px -30px rgba(0,0,0,.45)}
.hw-dev.desk .hw-scr{border-radius:calc(14px / var(--k));box-shadow:0 0 0 calc(5px / var(--k)) color-mix(in srgb,var(--text) 80%,transparent),0 24px 60px -30px rgba(0,0,0,.45)}
.hw-dev.phone{padding-top:0}.hw-scr iframe{width:100%;height:100%;border:0;display:block;background:var(--bg)}
.hw-fade{position:absolute;inset:0;background:var(--bg);opacity:0;pointer-events:none;transition:opacity .35s}.hw-fade.on{opacity:1}
.hw-ctl{display:flex;align-items:center;gap:8px;margin-top:14px}.hw-seg button{display:inline-flex;align-items:center;gap:6px}.hw-seg svg{width:16px;height:16px}
.hw-steps h2{margin:0 4px 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.hw-try{margin:-6px 0 18px}.hw-steps ol{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.hw-steps ol>li{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);font-size:15px;line-height:1.45;transition:border-color .25s,background .25s,transform .3s}
.hw-steps ol>li[data-act]{cursor:pointer}.hw-steps ol>li[data-act]:hover{border-color:var(--line-2)}
.hw-steps ol>li i{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 13px var(--f-body);font-style:normal;background:var(--bg-2);color:var(--muted);transition:background .25s,color .25s}
.hw-steps ol>li.on{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));background:color-mix(in srgb,var(--accent) 8%,var(--surface))}.hw-steps ol>li.on i{background:var(--accent);color:var(--on-accent,#fff)}
.hw-tips{margin-top:16px;padding:14px 16px;border-radius:18px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));border:1px solid var(--line)}
.hw-tips h3{display:flex;align-items:center;gap:6px;margin:0 0 6px;font-size:14px}.hw-tips ul{margin:0;padding-left:18px}.hw-tips li{font-size:14px;line-height:1.5;margin:4px 0}
.hw-rel{margin-top:18px}.hw-rel h3{margin:0 4px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
@media(prefers-reduced-motion:reduce){.hw-dot{animation:none}}
`;document.head.appendChild(css);
if(!IC.reset)IC.reset='<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>';
try{buildChrome()}catch(e){}
if(cur.p==='howto'||location.hash.startsWith('#/howto'))route();
return}

/* ======================= inside the demo frame ======================= */
const Q=new URLSearchParams(location.search),FROM=+Q.get('from')||0,FAST=Q.has('fast');
const guide=byId(DEMO);
document.documentElement.classList.add('hw-demo-on');
/* nothing here should buzz, toast a reminder or offer an update */
try{notify=()=>{}}catch(e){}
const css=document.createElement('style');css.textContent=`
html.demo #authb,html.demo .demob.upd,html.demo .tprompt{display:none!important}
html.demo,html.demo body{scroll-behavior:auto!important}
.hwp{position:fixed;left:0;top:0;z-index:2147483646;width:30px;height:30px;margin:-6px 0 0 -6px;pointer-events:none;transition:transform .62s cubic-bezier(.3,.8,.25,1),opacity .3s;opacity:0;will-change:transform}
.hwp.on{opacity:1}.hwp svg{width:30px;height:30px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));transition:transform .14s}
.hwp.down svg{transform:scale(.82)}
.hwp i{position:absolute;left:-12px;top:-12px;width:36px;height:36px;border-radius:50%;border:3px solid var(--accent,#7c5cff);opacity:0;transform:scale(.3)}
.hwp.tap i{animation:hwTap .55s ease-out}
@keyframes hwTap{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.5)}}
.hwring{position:fixed;z-index:2147483645;pointer-events:none;border-radius:14px;box-shadow:0 0 0 3px var(--accent,#7c5cff),0 0 0 9px color-mix(in srgb,var(--accent,#7c5cff) 22%,transparent);opacity:0;transition:all .45s cubic-bezier(.3,.8,.25,1)}
.hwring.on{opacity:1}
.hwcap{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));z-index:2147483646;transform:translateX(-50%);width:max-content;max-width:min(92vw,560px);padding:10px 16px;border-radius:16px;
 background:color-mix(in srgb,#111 86%,transparent);color:#fff;font:600 15px/1.35 var(--f-body,system-ui);box-shadow:0 12px 30px -12px rgba(0,0,0,.5);display:flex;gap:10px;align-items:flex-start;pointer-events:none;transition:opacity .3s,transform .4s cubic-bezier(.3,.8,.25,1),top .4s,bottom .4s}
.hwcap b{flex:none;min-width:22px;height:22px;border-radius:11px;display:grid;place-items:center;background:var(--accent,#7c5cff);font-size:12px;padding:0 6px}
.hwcap.top{bottom:auto;top:calc(12px + env(safe-area-inset-top))}.hwcap.hide{opacity:0}
@media(min-width:821px){.hwcap{bottom:24px}}
.hwshield{position:fixed;inset:0;z-index:2147483644;background:transparent;cursor:pointer}
.hwpause{position:fixed;inset:0;z-index:2147483646;display:none;place-items:center;pointer-events:none}.hwpause span{width:72px;height:72px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center}
.hwpause svg{width:30px;height:30px;fill:#fff;stroke:none;margin-left:4px}html.hw-paused .hwpause{display:grid}
`;document.head.appendChild(css);

const P=document.createElement('div');P.className='hwp';P.innerHTML='<i></i><svg viewBox="0 0 24 24"><path d="M5 2.5l13.5 12.3-5.9.6 3.4 6.6-2.6 1.3-3.3-6.7L5 20.6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const RING=document.createElement('div');RING.className='hwring';
const CAP=document.createElement('div');CAP.className='hwcap hide';
const SH=document.createElement('div');SH.className='hwshield';SH.title='Pause or play';
const PZ=document.createElement('div');PZ.className='hwpause';PZ.innerHTML=`<span><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></span>`;
let paused=false,jump=-1,tok=0;
const post=m=>{try{parent!==window&&parent.postMessage({howto:1,...m},location.origin==='null'?'*':location.origin)}catch(e){}};
function setPause(v){paused=v;document.documentElement.classList.toggle('hw-paused',v);post({t:'paused',v})}
SH.addEventListener('click',()=>setPause(!paused));
['wheel','touchmove'].forEach(k=>SH.addEventListener(k,e=>e.preventDefault(),{passive:false}));
window.addEventListener('message',e=>{const d=e.data;if(!d||!d.howto||e.source!==parent)return;if(d.t==='pause')setPause(true);else if(d.t==='play')setPause(false);else if(d.t==='goto'){jump=d.i;setPause(false);tok++}});
document.addEventListener('keydown',e=>{e.stopPropagation();e.preventDefault()},true);

const K=FAST?.08:1;
class Stop extends Error{}
async function wait(ms){const t=tok,end=performance.now()+ms*K;while(performance.now()<end||paused){if(t!==tok)throw new Stop();await new Promise(r=>setTimeout(r,paused?120:Math.min(60,Math.max(1,end-performance.now()))))}if(t!==tok)throw new Stop()}
const vis=e=>{if(!e||!e.isConnected)return false;const r=e.getBoundingClientRect();if(!r.width&&!r.height)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&!(+cs.opacity===0&&cs.pointerEvents==='none')};
const sheetOn=()=>{const s=$('#sheet');return s&&s.classList.contains('on')?s:null};
function find(sel,txt){if(sel.includes('||')){for(const one of sel.split('||')){const e=find(one.trim(),txt);if(e)return e}return null}let L=[...document.querySelectorAll(sel)].filter(vis);
 if(txt){const t=String(txt).toLowerCase();L=L.filter(e=>((e.innerText||e.value||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('placeholder')||'')).toLowerCase().includes(t))}
 if(txt){const t=String(txt).toLowerCase().trim(),ex=L.filter(e=>(e.innerText||'').toLowerCase().trim()===t);if(ex.length)L=ex.concat(L.filter(e=>!ex.includes(e)))}
 const sh=sheetOn();if(sh){const inS=L.filter(e=>sh.contains(e));if(inS.length)return inS[0]}
 return L[0]||null}
async function need(sel,txt,ms=4500){const end=performance.now()+ms*(FAST?.5:1);for(;;){const e=find(sel,txt);if(e)return e;if(performance.now()>end){console.warn('[howto] missing',DEMO,sel,txt||'');post({t:'miss',sel});return null}await wait(90)}}
function inView(e){const r=e.getBoundingClientRect();return r.top>=60&&r.bottom<=innerHeight-100}
async function show(e){if(inView(e))return;e.scrollIntoView({block:'center',inline:'nearest',behavior:FAST?'auto':'smooth'});await wait(520)}
function ptrTo(x,y){P.style.transform=`translate(${x}px,${y}px)`;P.classList.add('on')}
function ring(e,pad=6){if(!e){RING.classList.remove('on');return}const r=e.getBoundingClientRect();Object.assign(RING.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px',borderRadius:Math.min(18,r.height/2+pad)+'px'});RING.classList.add('on')}
function capPlace(e){if(!e){CAP.classList.remove('top');return}const r=e.getBoundingClientRect();CAP.classList.toggle('top',r.bottom>innerHeight-190)}
/* sheets slide and pages animate in: wait until the target has stopped moving before pointing at it */
async function settle(e){let last='';for(let k=0;k<14;k++){const r=e.getBoundingClientRect(),key=[r.left|0,r.top|0,r.width|0,r.height|0].join();if(key===last)return;last=key;await wait(70)}}
async function point(e,dx=0){await show(e);await settle(e);const r=e.getBoundingClientRect();capPlace(e);ptrTo(r.left+Math.min(r.width/2,r.width-14)+dx,r.top+r.height/2);ring(e);await wait(700)}
async function press(e){P.classList.add('down','tap');await wait(160);P.classList.remove('down');setTimeout(()=>P.classList.remove('tap'),500)}
function setVal(el,v){const pr=Object.getPrototypeOf(el),d=Object.getOwnPropertyDescriptor(pr,'value');if(d&&d.set)d.set.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))}
const A={
 async tap(a){let e=await need(a.tap,a.txt);if(!e)return;await point(e);await press(e);ring(null);if(!e.isConnected)e=find(a.tap,a.txt)||e;if(a.real)e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));e.click();await wait(a.after??650)},
 async hold(a){const e=await need(a.hold,a.txt);if(!e)return;await point(e);P.classList.add('down');ring(e,10);await wait(750);P.classList.remove('down');ring(null);const r=e.getBoundingClientRect();
  e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));await wait(a.after??800)},
 async open(a){const h=await need('#view section.fold > h3',a.open);if(!h)return;await point(h);await press(h);ring(null);if(!h.closest('.fold').classList.contains('open'))h.click();await wait(a.after??700)},
 async draw(a){const st=await need(a.draw||'.ink-stage');if(!st)return;const r=st.getBoundingClientRect();let id=40;ring(null);
  for(const path of a.paths){id++;const pts=path.map(([x,y])=>[r.left+x*r.width,r.top+y*r.height]);const ev=(type,[x,y],k)=>st.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'pen',isPrimary:true,clientX:x,clientY:y,pressure:k,buttons:type==='pointerup'?0:1,button:0,width:1,height:1}));
   ptrTo(...pts[0]);await wait(260);P.classList.add('down');ev('pointerdown',pts[0],.45);P.style.transition='transform .03s linear';
   for(let i=1;i<pts.length;i++){ptrTo(...pts[i]);ev('pointermove',pts[i],.35+.4*Math.sin(i/pts.length*Math.PI));await wait(FAST?1:16)}
   ev('pointerup',pts[pts.length-1],0);P.style.transition='';P.classList.remove('down');await wait(140)}
  await wait(a.after??600)},
 async look(a){const e=await need(a.look,a.txt);if(!e)return;await point(e);await wait(a.ms??900);ring(null)},
 async type(a){const e=await need(a.type,a.txt);if(!e)return;await point(e);await press(e);ring(null);try{e.focus({preventScroll:true})}catch(_){}
  if(e.isContentEditable){e.textContent='';for(let k=1;k<=a.v.length;k++){e.textContent=a.v.slice(0,k);e.dispatchEvent(new Event('input',{bubbles:true}));await wait(FAST?2:45)}}
  else{setVal(e,a.add?e.value:'');const base=a.add?e.value:'';for(let k=1;k<=a.v.length;k++){setVal(e,base+a.v.slice(0,k));await wait(FAST?2:a.v.length>60?22:45)}}
  e.dispatchEvent(new Event('change',{bubbles:true}));await wait(a.after??450);if(a.blur)try{e.blur()}catch(_){}},
 async pick(a){const e=await need(a.pick,a.txt);if(!e)return;await point(e);await press(e);setVal(e,a.v);e.dispatchEvent(new Event('change',{bubbles:true}));ring(null);await wait(a.after??600)},
 async check(a){const e=await need(a.check,a.txt);if(!e)return;await point(e);await press(e);ring(null);if(!!e.checked!==(a.v!==false))e.click();await wait(a.after??600)},
 async nav(a){const r=a.nav,direct=[...document.querySelectorAll(`#tabbar [data-nav="${r}"],#rail [data-nav="${r}"]`)].find(vis);
  if(direct){await point(direct);await press(direct);ring(null);direct.click();await wait(900);return}
  const more=[...document.querySelectorAll('#tabbar [data-nav="more"],#rail [data-nav="more"]')].find(vis);
  if(more){await point(more);await press(more);ring(null);more.click();await wait(700);const t=await need(`[data-act="moGo"][data-r="${r}"]`,'',2500);if(t){await point(t);await press(t);ring(null);t.click();await wait(900);return}}
  go(r);await wait(900)},
 async swipe(a){const e=await need(a.swipe,a.txt);if(!e)return;await point(e);const r=e.getBoundingClientRect(),x0=r.left+r.width*.75,x1=r.left+r.width*.25,y=r.top+r.height/2;ring(null);
  P.classList.add('down');ptrTo(x0,y);await wait(150);P.style.transition='transform .5s ease-in-out';ptrTo(x1,y);if(a.fn)a.fn(e);else e.scrollBy({left:a.dx??r.width*.8,behavior:'smooth'});await wait(520);P.style.transition='';P.classList.remove('down');await wait(a.after??700)},
 async scroll(a){const e=await need(a.scroll,a.txt);if(!e)return;e.scrollIntoView({block:a.block||'center',behavior:FAST?'auto':'smooth'});await wait(a.after??700)},
 async wait(a){await wait(a.wait)},
 async run(a){await a.run();await wait(a.after??500)},
 async go(a){go(a.go);await wait(a.after??900)},
 async close(){if(sheetOn()){closeSheet();await wait(500)}},
};
async function act(a){for(const k of Object.keys(A))if(k in a&&k!=='after')return A[k](a)}
function cap(i,n,s){CAP.innerHTML=`<b>${i+1}/${n}</b><span>${esc(stepText(s))}</span>`;CAP.classList.remove('hide')}
async function play(){const n=guide.steps.length;
 for(let loop=0;;loop++){const my=tok;try{
  let start=0;if(jump>=0){start=jump;jump=-1}else if(loop===0&&FROM)start=FROM;
  if(loop>0||start>0){/* a fresh start: same sample data, nothing open */ await reset();}
  /* catch up quietly to the step asked for */
  if(start>0){const k0=Date.now();CAP.classList.add('hide');P.classList.remove('on');for(let i=0;i<start;i++)for(const a of steps(i))await quick(a);console.debug('[howto] caught up in',Date.now()-k0)}
  for(let i=start;i<n;i++){post({t:'step',i});if(FAST||navigator.webdriver)console.info('[howto] step',i);cap(i,n,guide.steps[i]);const L=steps(i);if(!L.length)await wait(2200);for(const a of L)await act(a);await wait(i===n-1?1600:900)}
  CAP.classList.add('hide');P.classList.remove('on');ring(null);post({t:'loop'});if(FAST||navigator.webdriver)console.info('[howto] loop');await wait(1400)}
 catch(e){if(!(e instanceof Stop)){console.warn('[howto] demo error',DEMO,e);await new Promise(r=>setTimeout(r,1500))}if(tok===my)tok++}}}
const steps=i=>{const s=guide.steps[i];return typeof s==='string'?[]:(s.d||[])};
/* running a step instantly, for jumping ahead: taps and typing land at once, waits are skipped */
async function quick(a){const save=[P.style.transition];const sel=a.tap||a.look||a.type||a.pick||a.check||a.swipe||a.scroll||a.hold,e=sel?await need(sel,a.txt,2500):null;
 if(a.tap&&e){e.click();await new Promise(r=>setTimeout(r,a.after??300))}else if(a.type&&e){setVal(e,(a.add?e.value:'')+a.v);e.dispatchEvent(new Event('change',{bubbles:true}))}
 else if(a.pick&&e){setVal(e,a.v);e.dispatchEvent(new Event('change',{bubbles:true}))}else if(a.check&&e){if(!!e.checked!==(a.v!==false))e.click()}
 else if(a.swipe&&e&&a.fn)a.fn(e);else if(a.hold&&e){const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+5,clientY:r.top+5}))}else if(a.open){const h=find('#view section.fold > h3',a.open);if(h&&!h.closest('.fold').classList.contains('open'))h.click()}else if(a.draw){await A.draw(a)}else if(a.nav){go(a.nav);await new Promise(r=>setTimeout(r,500))}else if(a.go){go(a.go);await new Promise(r=>setTimeout(r,500))}else if(a.run){await a.run()}else if(a.close&&sheetOn())closeSheet();
 P.style.transition=save[0];await new Promise(r=>setTimeout(r,60))}
async function reset(){CAP.classList.add('hide');P.classList.remove('on');ring(null);
 try{closeSheet()}catch(e){}if(guide.end)try{guide.end()}catch(e){}
 const st=S.settings;S=norm({settings:{name:st.name,theme:st.theme,onboarded:true,tourOffered:true,toured:true,setupDone:true,demoHide:true}});seedDemo();seedMore();
 if(guide.seed)try{guide.seed()}catch(e){console.warn('[howto] seed',e)}
 try{primeSig()}catch(e){}scrollTo(0,0);go(guide.start||'today');await new Promise(r=>setTimeout(r,700))}
/* a few things the sample data doesn't have: a note, a list and an AI that answers from a script */
function seedMore(){
 try{const ins=insSet();ins.engine='api';ins.url='https://demo.plotlines.invalid/v1';ins.model='demo'}catch(e){}
 }
window.HOWTO_DEMO={find,need,wait,A};
/* the AI in a demo answers from the guide's script, word by word, as a real one would */
const SUGS=['What’s next for my 10K?','How are my habits this week?','Plan a calm evening for me','Add stretching to tomorrow'];
try{apiChat=async function(msgs,onTok,signal,opts={}){const last=[...msgs].reverse().find(m=>m.role==='user');const sys=(msgs.find(m=>m.role==='system')||{}).content||'';
 const q=String(last&&last.content||'');let out=null;
 if(/^You write short suggestions for buttons/.test(sys))out=SUGS.join('\n');
 else if(guide.ai)out=guide.ai(q,sys,opts);
 if(out==null)out=/^You decide what to do/.test(sys)?{kind:'talk'}:opts.schema||/Reply with (one )?JSON/i.test(sys)?{}:'Here’s what stands out: you’re keeping most of your habits, and your 10K goal is moving fastest. One small step today keeps it going.';
 if(typeof out!=='string')out=JSON.stringify(out);
 const parts=out.match(/\S+\s*|\s+/g)||[];for(const p of parts){if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');onTok(p);await new Promise(r=>setTimeout(r,FAST?1:28))}}}catch(e){}

async function boot(){for(let k=0;k<200&&!(typeof booted!=='undefined'&&booted);k++)await new Promise(r=>setTimeout(r,50));
 if(!guide){CAP.innerHTML='<span>This demo isn’t available.</span>';CAP.classList.remove('hide');document.body.append(CAP);return}
 document.body.append(SH,RING,P,CAP,PZ);await reset();play()}
boot();
})();
