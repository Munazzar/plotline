/* 1.41: design polish.
   - Apple-style line icons (SF Symbols proportions: 24 grid, even 1.6 strokes, round caps) and Apple type
     (SF Pro on Apple devices, Inter everywhere else), set as the new default look.
   - One shadow system for light and dark: hairline + soft lift in light, hairline highlight in dark.
   - App backgrounds (paper, journal, dots, lines, grid, waves or your own picture) with a strength slider.
   - Home: Up next is a deck of cards. Swipe left for the next step, right for the previous one.
   - Habits: check off today, skip or add a comment straight from the habit, no long press.
   - Calendar: one chip per item (no doubles), habit icons on each day (faded when partly done), week text fits.
   - Canvas: goals, journal and threads open edge to edge, full screen, on phones too. */
(()=>{
const R=document.documentElement,td=()=>ymd();

/* ---------- icons ---------- */
const GEAR='<path d="M18.99 10.26L21.08 10.49A9.2 9.2 0 0 1 21.08 13.51L18.99 13.74A7.2 7.2 0 0 1 18.17 15.71L19.49 17.35A9.2 9.2 0 0 1 17.35 19.49L15.71 18.17A7.2 7.2 0 0 1 13.74 18.99L13.51 21.08A9.2 9.2 0 0 1 10.49 21.08L10.26 18.99A7.2 7.2 0 0 1 8.29 18.17L6.65 19.49A9.2 9.2 0 0 1 4.51 17.35L5.83 15.71A7.2 7.2 0 0 1 5.01 13.74L2.92 13.51A9.2 9.2 0 0 1 2.92 10.49L5.01 10.26A7.2 7.2 0 0 1 5.83 8.29L4.51 6.65A9.2 9.2 0 0 1 6.65 4.51L8.29 5.83A7.2 7.2 0 0 1 10.26 5.01L10.49 2.92A9.2 9.2 0 0 1 13.51 2.92L13.74 5.01A7.2 7.2 0 0 1 15.71 5.83L17.35 4.51A9.2 9.2 0 0 1 19.49 6.65L18.17 8.29A7.2 7.2 0 0 1 18.99 10.26Z"/><circle cx="12" cy="12" r="3"/>';
const dot=(x,y,r=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
Object.assign(IC,{
 home:'<path d="M3.6 10.7 12 3.9l8.4 6.8"/><path d="M5.7 9.2v9a2 2 0 0 0 2 2h8.6a2 2 0 0 0 2-2v-9"/><path d="M10 20.2v-4.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.6"/>',
 habit:'<circle cx="12" cy="12" r="8.6"/><path d="M8.3 12.3l2.5 2.5 4.9-5.2"/>',
 cal:'<rect x="3.5" y="4.6" width="17" height="15.8" rx="3.4"/><path d="M3.5 9.3h17M8 2.9v3.4M16 2.9v3.4"/>'+dot(8,13.2,.95)+dot(12,13.2,.95)+dot(16,13.2,.95)+dot(8,16.8,.95)+dot(12,16.8,.95),
 goals:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.9"/>'+dot(12,12,1.5),
 target:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.9"/>'+dot(12,12,1.5),
 flame:'<path d="M12 21.1c-3.8 0-6.6-2.7-6.6-6.4 0-3.3 2-5.3 3.6-7.2.3 1.5 1 2.6 2.1 3.1.2-3.2 1.4-5.6 3.7-7.6.4 3.2 1.8 4.7 2.9 6.6.7 1.2 1 2.6 1 4.1 0 4.2-2.9 7.4-6.7 7.4z"/><path d="M12 21.1c-1.6 0-2.8-1.2-2.8-2.9 0-1.8 1.4-2.8 2.4-4.4.9 1.4 3.2 2.5 3.2 4.6 0 1.6-1.2 2.7-2.8 2.7z"/>',
 journal:'<path d="M6 3.4h11.4a1.6 1.6 0 0 1 1.6 1.6v14a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6V5A1.6 1.6 0 0 1 6 3.4z"/><path d="M8.2 3.4v17.2M11.4 8h4.6M11.4 11.4h3.2"/>',
 map:'<circle cx="6" cy="6.4" r="2.4"/><circle cx="18" cy="6.4" r="2.4"/><circle cx="12" cy="17.6" r="2.4"/><path d="M8.4 6.4h7.2M7.1 8.6l3.8 6.8M16.9 8.6l-3.8 6.8"/>',
 road:'<path d="M4 18.5c3.5 0 4-4 8-4s4.5-4 8-4"/><circle cx="4" cy="18.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="20" cy="10.5" r="1.6"/><path d="M20 3.5v4"/>',
 ai:'<path d="M10 3.4c.7 3.9 2.6 5.8 6.5 6.5-3.9.7-5.8 2.6-6.5 6.5-.7-3.9-2.6-5.8-6.5-6.5 3.9-.7 5.8-2.6 6.5-6.5z"/><path d="M17.6 14.2c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3z"/>',
 agent:'<rect x="4.6" y="7.2" width="14.8" height="11.6" rx="3.6"/><path d="M12 7.2V4.6M2.8 11.4v3.4M21.2 11.4v3.4M9.8 15.4h4.4"/>'+dot(12,3.6,1.1)+dot(9.3,11.9,1.15)+dot(14.7,11.9,1.15),
 checklist:'<path d="M3.8 6.6l1.5 1.5 2.6-2.8M3.8 12.6l1.5 1.5 2.6-2.8M3.8 18.6l1.5 1.5 2.6-2.8M11.2 7h9M11.2 13h9M11.2 19h9"/>',
 hist:'<path d="M4.1 12a7.9 7.9 0 1 0 2.3-5.6"/><path d="M3.9 3.6v4.3h4.3"/><path d="M12 7.8V12l2.9 1.9"/>',
 wbbench:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><circle cx="17" cy="17" r="3.5"/>',
 settings:GEAR,
 search:'<circle cx="10.6" cy="10.6" r="6.6"/><path d="M15.4 15.4l5 5"/>',
 plus:'<path d="M12 4.6v14.8M4.6 12h14.8"/>',minus:'<path d="M4.6 12h14.8"/>',
 check:'<path d="M5 12.6l4.4 4.4L19 7.4"/>',
 back:'<path d="M14.8 4.8 7.6 12l7.2 7.2"/>',next:'<path d="M9.2 4.8l7.2 7.2-7.2 7.2"/>',
 up:'<path d="M12 19.4V4.8M5.6 11.2 12 4.8l6.4 6.4"/>',down:'<path d="M12 4.6v14.6M5.6 12.8l6.4 6.4 6.4-6.4"/>',
 more:dot(5.6,12,1.6)+dot(12,12,1.6)+dot(18.4,12,1.6),
 edit:'<path d="M14.6 5.4l4 4M4.4 19.6l.9-4.3L15.9 4.7a1.8 1.8 0 0 1 2.6 0l.8.8a1.8 1.8 0 0 1 0 2.6L8.7 18.7z"/>',
 trash:'<path d="M4 6.6h16M9.4 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.8M6.2 6.6l.9 12.3a1.8 1.8 0 0 0 1.8 1.7h6.2a1.8 1.8 0 0 0 1.8-1.7l.9-12.3M10.2 10.4v6.2M13.8 10.4v6.2"/>',
 bell:'<path d="M6.1 16.6V11a5.9 5.9 0 0 1 11.8 0v5.6l1.6 1.8H4.5z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>',
 full:'<path d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15"/>',
 unfull:'<path d="M9 4v3.4A1.6 1.6 0 0 1 7.4 9H4M20 9h-3.4A1.6 1.6 0 0 1 15 7.4V4M15 20v-3.4a1.6 1.6 0 0 1 1.6-1.6H20M4 15h3.4A1.6 1.6 0 0 1 9 16.6V20"/>',
 print:'<path d="M7 8.4V4.2a.8.8 0 0 1 .8-.8h8.4a.8.8 0 0 1 .8.8v4.2"/><path d="M7 17.2H5.4a2 2 0 0 1-2-2v-4.8a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v4.8a2 2 0 0 1-2 2H17"/><rect x="7" y="13.6" width="10" height="7" rx=".8"/>',
 share:'<path d="M12 14.6V3.6M8.2 7.2 12 3.4l3.8 3.8"/><path d="M8.4 10.2H7a2 2 0 0 0-2 2v6.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.4a2 2 0 0 0-2-2h-1.4"/>',
 thread:'<path d="M4.2 6.6a3 3 0 0 1 3-3h9.6a3 3 0 0 1 3 3v6.2a3 3 0 0 1-3 3h-5.4l-4.4 3.6v-3.6h0a3 3 0 0 1-2.8-3z"/><path d="M8.2 8.2h7.6M8.2 11.4h4.6"/>',
 pin:'<path d="M9.4 3.6h5.2M10.2 3.6v5.2l-3.3 3.6v1.8h10.2v-1.8l-3.3-3.6V3.6M12 14.2v6.2"/>',
 link:'<path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1"/>',
 lock:'<rect x="5" y="10.6" width="14" height="10" rx="2.4"/><path d="M8.2 10.6V7.4a3.8 3.8 0 0 1 7.6 0v3.2"/>',
 flag:'<path d="M5.4 21V4.4M5.4 4.4c4.6-2 7.6 2 13.2 0v9c-5.6 2-8.6-2-13.2 0"/>',
 timer:'<circle cx="12" cy="13.4" r="7.4"/><path d="M12 9.6v3.8l2.4 1.6M9.6 2.8h4.8"/>',
 camera:'<path d="M4.6 7.4h2.6l1.6-2.4h6.4l1.6 2.4h2.6a1.6 1.6 0 0 1 1.6 1.6v9.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4V9a1.6 1.6 0 0 1 1.6-1.6z"/><circle cx="12" cy="13.2" r="3.6"/>',
 tune:'<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
 chat:'<path d="M12 3.8c-4.8 0-8.4 3.2-8.4 7.3 0 2.2 1 4.1 2.7 5.4L5.6 20l4-1.9c.8.2 1.6.3 2.4.3 4.8 0 8.4-3.2 8.4-7.3S16.8 3.8 12 3.8z"/>',
 menu:'<path d="M4.4 7h15.2M4.4 12h15.2M4.4 17h15.2"/>',
 x:'<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>'});

/* ---------- type ---------- */
FONTS.unshift(['appled','Apple','Inter','d'],['apple','Apple','Inter','b'],['applem','Apple','Inter','m']);
FONT_PRE.unshift(['apple','Apple','appled','apple','applem']);
const pre0=FONT_PRE.find(p=>p[0]==='plotline');if(pre0)pre0[1]='Plotlines classic';
Object.assign(FONT_DEF,{d:'appled',b:'apple',m:'applem'});
{const _af=applyFonts;applyFonts=function(){const st=S.settings,o=st.font;
  /* the old default pairs (Plotlines and Native) move to the Apple look once; a pair you picked yourself stays */
  if(!st.fontApple){st.fontApple=1;st.v114font=1;if(!o||(o.d==='bsd'&&o.b==='figtree'&&o.m==='martian')||(o.d==='nsysd'&&o.b==='system'&&o.m==='nsysm'))delete st.font}
  const r=_af.apply(this,arguments),f=fontSet();R.classList.toggle('f-apple',f.d==='appled');R.classList.toggle('fm-apple',f.m==='applem');return r}}

/* ---------- theme hooks: light/dark flag for shadows, and the background ---------- */
const BGS=[['none','None'],['paper','Paper'],['journal','Journal'],['dots','Dots'],['lines','Lines'],['grid','Grid'],['waves','Waves'],['image','Your image']];
let BGIMG=null;
const bgSet=()=>({k:'none',s:50,...(S.settings.bg||{})});
function applyBg(){const b=bgSet();let k=BGS.some(x=>x[0]===b.k)?b.k:'none';if(k==='image'&&!BGIMG)k='none';
 R.dataset.bgp=k;R.style.setProperty('--bgs',(Math.max(0,Math.min(100,+b.s||0))/100).toFixed(2));
 if(k==='image')R.style.setProperty('--bgimg',`url("${BGIMG}")`);else R.style.removeProperty('--bgimg')}
{const _at=applyTheme;applyTheme=function(){const r=_at.apply(this,arguments);R.classList.toggle('lt',isLightTheme(R.dataset.theme||S.settings.theme));applyBg();return r}}
DB.get('bgimg').then(v=>{if(v){BGIMG=v;applyBg()}}).catch(()=>{});

function bgPanel(){const b=bgSet();
 return`<section class="panel wide rv" id="bgset"><h3>Background</h3><p class="small muted">A texture behind the whole app. Your picture stays on this device.</p>
 <div class="bgt-g">${BGS.map(([k,n])=>`<button class="bgt${b.k===k?' on':''}" data-act="bgPick" data-k="${k}" aria-pressed="${b.k===k}"><span class="bgt-p" data-bgp="${k}" ${k==='image'&&BGIMG?`style="background-image:url('${BGIMG}')"`:''}>${k==='image'&&!BGIMG?ic('camera'):''}</span><b>${n}</b></button>`).join('')}</div>
 <div class="field bgs-f"><label for="bgS">Strength <span class="data" id="bgSv">${b.s}%</span></label><input type="range" id="bgS" min="5" max="100" step="1" value="${b.s}" ${b.k==='none'?'disabled':''}></div>
 ${BGIMG?`<div class="actions left"><button class="btn sm" data-act="bgPick" data-k="image" data-new="1">${ic('camera')}Change picture</button><button class="btn sm ghost" data-act="bgImgDel">Remove picture</button></div>`:''}</section>`}
{const _fp=fontPanel;fontPanel=function(){return bgPanel()+_fp()}}
function bgRepaint(){const p=$('#bgset');if(p){const t=document.createElement('template');t.innerHTML=bgPanel();const n=t.content.firstElementChild;n.classList.add('in');p.replaceWith(n)}}
function bgFile(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return;const u=URL.createObjectURL(f),im=new Image();
  im.onload=()=>{const m=1800,sc=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
   BGIMG=c.toDataURL('image/jpeg',.84);DB.set('bgimg',BGIMG).catch(()=>toast('Couldn’t keep the picture on this device'));S.settings.bg={...bgSet(),k:'image',s:bgSet().k==='image'?bgSet().s:40};save();applyBg();render(false)};
  im.onerror=()=>{URL.revokeObjectURL(u);toast('That picture didn’t open')};im.src=u};i.click()}
Object.assign(ACT,{
 bgPick:d=>{if(d.k==='image'&&(!BGIMG||d.new))return bgFile();const b=bgSet();S.settings.bg={...b,k:d.k,s:b.k==='none'&&d.k!=='none'?(d.k==='image'?40:50):b.s};save();applyBg();render(false)},
 bgImgDel:()=>{BGIMG=null;DB.set('bgimg','').catch(()=>{});if(bgSet().k==='image')S.settings.bg={...bgSet(),k:'none'};save();applyBg();render(false)}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='bgS'){const v=+e.target.value;S.settings.bg={...bgSet(),s:v};R.style.setProperty('--bgs',(v/100).toFixed(2));const l=$('#bgSv');if(l)l.textContent=v+'%'}});
document.addEventListener('change',e=>{if(e.target&&e.target.id==='bgS')save()});

/* ---------- calendar ---------- */
/* the same thing twice on one day (a step and a day goal with the same title, or a copied step) shows once */
{const _ci=calItems;calItems=function(a,b){const M=_ci(a,b),nk=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
 for(const k in M){const seen=new Map(),out=[];M[k].forEach(x=>{if(x.k==='target'){out.push(x);return}const key=nk(x.t);const j=seen.get(key);
   if(j==null){seen.set(key,out.length);out.push(x)}else if(out[j].done&&!x.done)out[j]=x});M[k]=out}return M}}
/* habit icons on each day: full when done, faded when partly done */
function dayHabits(ds){if(ds>td())return[];return S.habits.filter(h=>h.kind!=='quit'&&h.status!=='archived'&&ds>=(h.startDate||'')).map(h=>{const v=hVal(h,ds),n=hTarget(h);return v>=n?{h,f:1}:v>0?{h,f:0}:null}).filter(Boolean).sort((x,y)=>y.f-x.f)}
const hIcons=(ds,max)=>{const L=dayHabits(ds);if(!L.length)return'';const sh=L.slice(0,max);
 return`<span class="cd-hi" aria-hidden="true">${sh.map(x=>`<i class="${x.f?'':'pt'}" title="${esc(x.h.title)}${x.f?'':' (partly)'}">${esc(hIcon(x.h))}</i>`).join('')}${L.length>max?`<i class="mo">+${L.length-max}</i>`:''}</span>`};
{const _cm=calMonth;calMonth=function(){const o=_cm(),t=document.createElement('template');t.innerHTML=o;const ph=matchMedia('(max-width:820px)').matches;
 t.content.querySelectorAll('.cd[data-d]').forEach(c=>{const h=hIcons(c.dataset.d,ph?3:4),top=c.querySelector('.cd-top');if(!h)return;if(!ph&&top)top.insertAdjacentHTML('beforeend',h);else c.insertAdjacentHTML('beforeend',h)});return t.innerHTML}}
{const _cw=calWeek;calWeek=function(){const o=_cw(),t=document.createElement('template');t.innerHTML=o;
 t.content.querySelectorAll('.cw-h[data-d]').forEach(c=>{const h=hIcons(c.dataset.d,6);if(h)c.insertAdjacentHTML('beforeend',h)});return t.innerHTML}}

/* ---------- habits: today, skip and a comment from the habit itself ---------- */
const BUB='chat';
/* a labelled note button on every habit row and the habit page, so nobody has to know about the long press */
function noteBtn(h,cls){const t=td(),c=((h.ck||{})[t]||{}),dn=hDone(h,t);
 return`<button class="hnote${cls?' '+cls:''}${c.n?' on':''}" data-act="hDaySheet" data-id="${h.id}" data-d="${t}">${ic(BUB)}<span>${c.n?esc(c.n.length>70?c.n.slice(0,68)+'…':c.n):dn?'How did it go?':'Add a note'}</span></button>`}
{const _hr=hrow;hrow=function(h){const o=_hr(h);if(h.status!=='active'||h.kind==='quit')return o;
 const tp=document.createElement('template');tp.innerHTML=o;const m=tp.content.querySelector('.hb>.s');if(!m)return o;m.insertAdjacentHTML('afterend',noteBtn(h));return tp.innerHTML}}
{const _vh=vHabit;vHabit=function(id){const o=_vh(id),h=H(id);if(!h||h.status!=='active'||h.kind==='quit')return o;
 const i=o.indexOf('class="hero tint hhero"'),j=i<0?-1:o.indexOf('</section>',i);return j<0?o:o.slice(0,j)+noteBtn(h,'big')+o.slice(j)};VIEWS.habit=vHabit}
function snapFix(o){const t=td();
 return o.replace(/<button class="hsn-h" data-act="openHabit" data-id="([^"]+)">/g,(m,id)=>{const h=H(id);if(!h||h.kind==='quit')return m;const c=((h.ck||{})[t]||{});return`<button class="hsn-h${c.n?' cm':''}" data-act="hDaySheet" data-id="${id}" data-d="${t}" title="Check off today, skip or add a comment">`})
 .replace(/<button class="hsn-x ([^"]*)" data-act="hsnTap" data-id="([^"]+)" data-d="([^"]+)"/g,(m,c,id,ds)=>{const h=H(id),n=h&&((h.ck||{})[ds]||{}).n;return n?`<button class="hsn-x ${c} cm" data-act="hsnTap" data-id="${id}" data-d="${ds}"`:m})
 .replace('Tap a box: done → skipped → cleared. Tap a habit to open it.','Tap a box to check it off (tap again to skip, then clear). Tap a habit for today’s check-off, a skip or a comment.')}
{const _hs=habitsStrip;habitsStrip=function(){return snapFix(_hs.apply(this,arguments))}}
{const _vh=vHabits;vHabits=function(){return snapFix(_vh.apply(this,arguments))};VIEWS.habits=vHabits}
{const _ds=ACT.hDaySheet;ACT.hDaySheet=function(d){_ds.apply(this,arguments);const h=H(d.id),sh=$('#sheet');if(!h||!sh||!sh.classList.contains('on'))return;
 const a=sh.querySelector('.actions');if(a&&!sh.querySelector('.hds-open')&&!(cur.p==='habit'&&cur.id===h.id))a.insertAdjacentHTML('beforebegin',`<button class="link small hds-open" data-act="hdsOpen" data-id="${h.id}">Open ${esc(h.title)}</button>`)}}
ACT.hdsOpen=d=>{closeSheet();go('habit/'+d.id)};

/* ---------- Home: Up next as swipe cards ---------- */
let UDI=0;
function deckCard(g,s,i,n){return`<article class="now tint udk-c${haloOn(g,i===0)?' halo':''}" style="${cvar(g)}" data-i="${i}"><div class="data">${i?'Coming up':'Up next'} · ${esc(g.title)}</div><h2>${esc(s.title)}</h2><div class="data">${dueText(s)||'No date set'}${hasRem(s)?' · reminder on':''}</div><div class="now-a"><button class="btn ink" data-act="toggleStep" data-g="${g.id}" data-s="${s.id}">${ic('check')}Mark done</button><button class="btn inkline" data-act="timerPick" data-g="${g.id}" data-s="${s.id}">${ic('timer')}Focus</button><button class="btn inkline" data-act="open" data-id="${g.id}">Open goal</button></div></article>`}
function deckHTML(){const nx=active().map(g=>({g,s:nextStep(g)})).filter(x=>x.s).sort(urgency).slice(0,8),n=nx.length;if(!n)return'';UDI=Math.min(UDI,n-1);
 return`<div class="now udk" style="--n:${n}"><div class="udk-t" tabindex="0" aria-roledescription="carousel" aria-label="Up next. Swipe for more">${nx.map(({g,s},i)=>deckCard(g,s,i,n)).join('')}</div>
 <div class="udk-f">${n>1?`<button class="ibtn sm udk-a" data-act="udkGo" data-d="-1" aria-label="Previous">${ic('back')}</button><div class="udk-dots">${nx.map((x,i)=>`<button class="${i===UDI?'on':''}" data-act="udkGo" data-i="${i}" aria-label="Card ${i+1} of ${n}" style="--c:${colOf(x.g)}"></button>`).join('')}</div><button class="ibtn sm udk-a" data-act="udkGo" data-d="1" aria-label="Next">${ic('next')}</button>`:''}
 <span class="udk-l"><button class="link" data-act="weekly">Weekly review</button><a class="link" href="#/goals">All goals</a></span></div></div>`}
{const _vt=vToday;vToday=function(){const o=_vt.apply(this,arguments),t=document.createElement('template');t.innerHTML=o;const C=t.content;
 const now=[...C.children].find(n=>n.querySelector(':scope>article.now'));
 const com=[...C.children].find(n=>n.tagName==='SECTION'&&((n.querySelector(':scope>.st-h h3')||{}).textContent||'').trim().toLowerCase().startsWith('coming up'));
 if(now){const d=deckHTML();if(d)now.innerHTML=d;if(com)com.remove()}else if(com){const d=deckHTML();if(d)com.innerHTML=d}
 return t.innerHTML};VIEWS.today=vToday}
function udkTo(t,i,smooth){const cs=t.querySelectorAll('.udk-c');if(!cs.length)return;i=Math.max(0,Math.min(cs.length-1,i));UDI=i;const c=cs[i];
 t.scrollTo({left:c.offsetLeft-(t.clientWidth-c.offsetWidth)/2,behavior:smooth&&!reduced()?'smooth':'auto'})}
function udkPaint(t){const cs=[...t.querySelectorAll('.udk-c')],mid=t.scrollLeft+t.clientWidth/2;let best=0,bd=1e9;
 cs.forEach((c,i)=>{const d=(c.offsetLeft+c.offsetWidth/2-mid)/(c.offsetWidth||1),a=Math.min(1,Math.abs(d));if(Math.abs(d)<bd){bd=Math.abs(d);best=i}
  if(!reduced()){c.style.transform=`scale(${(1-a*.06).toFixed(4)})`;c.style.opacity=(1-a*.35).toFixed(3)}});
 UDI=best;t.parentNode.querySelectorAll('.udk-dots button').forEach((b,i)=>b.classList.toggle('on',i===best))}
ACT.udkGo=(d,el)=>{const t=el.closest('.udk').querySelector('.udk-t');udkTo(t,d.i!=null?+d.i:UDI+(+d.d),true)};
let UDR=null,UDX=0;
function udkInit(){document.querySelectorAll('#view .udk-t').forEach(t=>{if(t._ud)return;t._ud=1;udkTo(t,UDI,false);udkPaint(t);let raf=0;
 t.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;udkPaint(t)})},{passive:true});
 t.addEventListener('keydown',e=>{if(e.target!==t)return;if(e.key==='ArrowRight'){e.preventDefault();udkTo(t,UDI+1,true)}if(e.key==='ArrowLeft'){e.preventDefault();udkTo(t,UDI-1,true)}});
 t.addEventListener('dragstart',e=>e.preventDefault());
 t.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button'))return;UDR={t,x:e.clientX,sl:t.scrollLeft,m:0,i:UDI}})})}
addEventListener('pointermove',e=>{if(!UDR)return;const dx=e.clientX-UDR.x;UDR.m=Math.max(UDR.m,Math.abs(dx));if(UDR.m>5){UDR.t.classList.add('drag');UDR.t.scrollLeft=UDR.sl-dx}});
addEventListener('pointerup',e=>{if(!UDR)return;const u=UDR;UDR=null;u.t.classList.remove('drag');if(u.m>5){UDX=Date.now();const dx=e.clientX-u.x;udkTo(u.t,Math.abs(dx)>40?u.i+(dx<0?1:-1):u.i,true)}});
addEventListener('click',e=>{if(Date.now()-UDX<250&&e.target.closest&&e.target.closest('.udk-t')){e.stopPropagation();e.preventDefault()}},true);

/* ---------- canvas: goals, journal and threads edge to edge ---------- */
const CANVAS=['goal','journal','threads','thread','list','habit'];
const canvasPg=()=>CANVAS.includes(cur.p);
function canvasMark(){R.toggleAttribute('data-canvas',canvasPg());R.dataset.pgx=cur.p}
{const _fm=ACT.focusMode;ACT.focusMode=function(){const was=!!S.settings.focus;_fm.apply(this,arguments);if(NATIVE)return;
 try{if(!was&&canvasPg()&&!document.fullscreenElement&&R.requestFullscreen)R.requestFullscreen({navigationUI:'hide'}).catch(()=>{});else if(was&&document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}}}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&S.settings.focus&&canvasPg()){S.settings.focus=false;save();applyFocus(true)}});

/* ---------- after each page paint ---------- */
let MO=null;
function afterPaint(){canvasMark();udkInit()}
function boot(){const v=$('#view');if(v&&!MO){MO=new MutationObserver(()=>afterPaint());MO.observe(v,{childList:true})}afterPaint();
 try{applyTheme()}catch(e){}
 if(document.querySelector('#rail .nav')){buildChrome();if(typeof navMark==='function')navMark()}}
addEventListener('hashchange',()=>setTimeout(canvasMark,0));
if(document.readyState==='complete')boot();else addEventListener('load',()=>setTimeout(boot,0));
setTimeout(boot,1500);
})();
