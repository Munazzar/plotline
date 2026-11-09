/* ================= Writing as a page (1.69) =================
   Journal entries and notes open as a blank page: no card, no box round the text, written edge to edge. The app's own
   background shows through, the sidebar (bottom bar on a phone) stays, and the heading and formatting stay in view.
   The sheets keep their markup, ids and data-acts (writeSheet, thrNewSheet, thrAddSheet, thrUpEdit); this file only
   rearranges them. Everything that isn't writing rolls into one menu button (.wm) that also serves the note page header.
   Leaving a note saves it, the way the journal always has; "Discard" is in the menu. */
(()=>{
'use strict';
const root=document.documentElement,sh=$('#sheet');
const el=(c,h)=>{const d=document.createElement('div');d.className=c;if(h)d.innerHTML=h;return d};
const fullOn=()=>!!S.settings.wcFull;
const fullRow=()=>`<button type="button" class="wm-i wc-fs" data-act="wcFull"><span class="wm-r">${ic(fullOn()?'unfull':'full')}</span><span>${fullOn()?'Show the sidebar':'Full screen'}</span></button>`;

/* ---------------- the menu: everything rolls out of the button and back into it ---------------- */
let OPEN=null,SHUT=0;
const burger=(label='Options')=>`<div class="wm"><button type="button" class="wm-b" data-act="wmTog" aria-haspopup="true" aria-expanded="false" aria-label="${label}" title="${label}"><i></i><i></i><i></i></button><div class="wm-p" hidden></div></div>`;
function wmOpen(m){if(OPEN&&OPEN!==m)wmShut(true);clearTimeout(SHUT);const p=m.querySelector('.wm-p'),b=m.querySelector('.wm-b');p.hidden=false;p.scrollTop=0;p.style.right='';
 /* never off the left edge: the Done button pushes the anchor in on a phone */
 {const l=p.getBoundingClientRect().left;if(l<12)p.style.right=(l-12)+'px'}
 const pr=p.getBoundingClientRect(),br=b.getBoundingClientRect(),ox=br.left+br.width/2-pr.left,oy=br.top+br.height/2-pr.top,X=[...p.querySelectorAll('.wm-x')];
 p.style.setProperty('--ox',ox+'px');p.style.setProperty('--oy',oy+'px');p.style.setProperty('--n',X.length);
 /* offsets, not rects: an item's rect would include the transform it is parked with */
 X.forEach((x,i)=>{x.style.setProperty('--i',i);x.style.setProperty('--dx',Math.round(ox-x.offsetLeft-x.offsetWidth/2)+'px');x.style.setProperty('--dy',Math.round(oy-x.offsetTop-x.offsetHeight/2)+'px')});
 /* read the parked state first, or a panel that was just display:none has nothing to transition from */
 p.querySelectorAll('.wm-x,.wm-r').forEach(n=>getComputedStyle(n).transform);m.classList.add('on');b.setAttribute('aria-expanded','true');OPEN=m}
function wmShut(now){const m=OPEN;if(!m)return false;OPEN=null;clearTimeout(SHUT);m.classList.remove('on');const p=m.querySelector('.wm-p'),b=m.querySelector('.wm-b');b.setAttribute('aria-expanded','false');if(now)p.hidden=true;else SHUT=setTimeout(()=>{if(!m.classList.contains('on'))p.hidden=true},620);return true}
ACT.wmTog=(d,b)=>{const m=b.closest('.wm');if(OPEN===m)wmShut();else wmOpen(m)};
document.addEventListener('click',e=>{if(!OPEN)return;const m=e.target.closest&&e.target.closest('.wm');if(m!==OPEN)wmShut();else if(e.target.closest('[data-wm-c]'))setTimeout(wmShut,0)},true);
{const _b=window.__back;window.__back=function(){return wmShut()||_b.apply(this,arguments)}}

/* ---------------- the page ---------------- */
let OFF=0,GO=0;
const open=()=>sh.classList.contains('wc')&&sh.classList.contains('on');
function place(){root.classList.toggle('wc-full',fullOn()||root.classList.contains('bk-on'));const r=$('#rail');sh.style.setProperty('--wc-l',(root.classList.contains('wc-full')||!r?0:Math.max(0,r.getBoundingClientRect().right))+'px')}
function pageOn(note){clearTimeout(OFF);wmShut(true);sh.classList.add('wc');sh.classList.toggle('wc-note',!!note);root.classList.add('wc-on');place()}
function pageOff(){root.classList.remove('wc-on','wc-typing','wc-full');sh.classList.remove('wc','wc-note')}
addEventListener('resize',()=>{if(open())place()});
ACT.wcBack=()=>closeSheet();
ACT.wcFull=(d,b)=>{S.settings.wcFull=!fullOn();save();place();if(b){const r=el('x',fullRow()).firstChild;b.innerHTML=r.innerHTML}};
const row=(act,icon,text,cls='')=>`<button type="button" class="wm-i ${cls}" data-act="${act}" data-wm-c="1"><span class="wm-r">${ic(icon)}</span><span>${text}</span></button>`;
const sec=(label,node)=>{const d=el('wm-x wm-s',label?`<div class="wm-l">${label}</div>`:'');d.append(node);return d};
const bar=(crumb,stat,done)=>{const b=el('wc-bar',`<button type="button" class="ibtn sm wc-back" data-act="wcBack" aria-label="Back" title="Back">${ic('back')}</button><div class="wc-c"><b>${crumb}</b></div>${burger()}`);if(stat)b.querySelector('.wc-c').append(stat);b.append(done);return b};
/* a menu row out of a control that already exists, keeping its act, its id and whatever is inside it */
function asRow(n,icon,text){n.className=(n.classList.contains('wr-bk')?'wr-bk ':'')+'wm-i'+(n.classList.contains('on')?' on':'');n.innerHTML=`<span class="wm-r">${icon}</span><span>${text}</span>`;return el('wm-x').appendChild(n).parentNode}

/* ---------------- journal ---------------- */
function wrLine(){const d=$('#wrDate'),l=$('#sheet .wc-d');if(!d||!l)return;const m=$('#sheet .wr-m.on')?.dataset.m||'',v=validDate(d.value)||ymd(),[y,mo,da]=v.split('-').map(Number);l.textContent=(m?m+'  ':'')+new Date(y,mo-1,da).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
function wrPage(){const w=sh.querySelector('.wr');if(!w)return;const T=s=>w.querySelector(s);
 const top=T('.wr-top'),pills=T('.wr-pills'),title=T('#wrTitle'),mood=T('.wr-mood'),tb=T('.wr-tb'),ed=T('#wrEd'),meta=T('.wr-meta'),cov=T('.cover-row'),prev=T('#phPrev'),act=T('.actions'),bk=T('.wr-bk');
 const del=act.querySelector('[data-act=wrDel]'),photo=cov.querySelector('label.btn'),rm=cov.querySelector('[data-act=rmPhoto]'),priv=cov.querySelector('.wr-priv');
 const b=bar('Journal',T('#wrStat'),T('.wr-done')),P=b.querySelector('.wm-p');
 title.placeholder='Title';
 P.append(sec('This day',pills),sec('Mood',mood),sec('',meta));
 const icon=photo.querySelector('svg').outerHTML,file=photo.querySelector('input'),lab=photo.querySelector('#phLbl');photo.className='wm-i';photo.innerHTML=`<span class="wm-r">${icon}</span>`;photo.append(lab,file);P.append(el('wm-x').appendChild(photo).parentNode);
 if(rm)P.append(asRow(rm,ic('trash'),'Remove the photo'));
 {const s=priv.querySelector('span');s.innerHTML=`<span class="wm-r">${s.querySelector('svg').outerHTML}</span><span>Private</span>`}
 const pr=el('wm-x wm-sw');pr.append(priv);P.append(pr);
 if(bk)P.append(asRow(bk,ic('book'),'Write on the journal paper'));
 P.append(el('wm-x',fullRow()));
 P.append(el('wm-x',del?row('wrDel','trash','Delete this entry','danger'):''));if(!del)P.lastChild.remove();
 const tools=el('wc-tools');tools.append(tb);
 const page=el('wc-scroll');page.append(title,el('data wc-d'),prev,ed);
 w.replaceChildren(b,tools,page);pageOn(false);wrLine()}
{const _ws=writeSheet;writeSheet=function(){const r=_ws.apply(this,arguments);wrPage();return r}}
document.addEventListener('change',e=>{if(e.target.id==='wrDate')wrLine()});
{const _m=ACT.wrMood;ACT.wrMood=function(){const r=_m.apply(this,arguments);wrLine();return r}}

/* ---------------- notes: new note, add to a note, edit what's there ---------------- */
const snap=f=>JSON.stringify([f.querySelector('textarea').value.trim(),f.elements.title?f.elements.title.value.trim():'',f.elements.k?f.elements.k.value:'',(f._sk||[]).length]);
const dirty=f=>snap(f)!==f._wc;
const hasText=f=>!!(f.querySelector('textarea').value.trim()||(f.elements.title&&f.elements.title.value.trim())||(f._sk||[]).length);
function notePage(crumb,heading){const f=sh.querySelector('form');if(!f)return;const T=s=>f.querySelector(s);
 const tpl=sh.querySelector('.nt-tpl'),tags=T('.thr-tags'),fmt=T('.fmt-bar'),ta=T('textarea'),title=T('input[name=title]'),more=T('.nt-more'),act=T('.actions');
 const del=act.querySelector('[data-act=thrUpDel]'),done=act.querySelector('[type=submit]');
 done.textContent='Done';done.className='btn sm pri';
 const b=bar(crumb,el('data thr-wc',`${ta.value.trim()?ta.value.trim().split(/\s+/).length:0} words`),done),P=b.querySelector('.wm-p');
 if(tpl)P.append(sec('Start from',tpl));if(tags)P.append(sec('Kind',tags));
 if(more){more.open=true;more.querySelector('summary').hidden=true;P.append(sec('Link to a goal or habit',more))}
 P.append(el('wm-x',fullRow()));
 P.append(el('wm-x',del?del.outerHTML.replace('btn danger','wm-i danger').replace('Delete',`<span class="wm-r">${ic('trash')}</span><span>Delete this update</span>`):row('wcDrop','trash','Discard','danger')));
 const tools=el('wc-tools');tools.append(fmt);
 const page=el('wc-scroll');
 if(title){title.placeholder='Title';title.classList.add('wr-title');page.append(title)}else page.append(el('wc-h',esc(heading)));
 const tray=T('.ink-tray');ta.removeAttribute('rows');ta.placeholder='Write anything. Bold it, list it, check it off.';page.append(ta);if(tray)page.append(tray);
 const k=T('input[type=hidden]:not([name=k])');
 f.replaceChildren(b,tools,page);if(k)f.append(k);sh.querySelectorAll(':scope>:not(form):not(.grab)').forEach(n=>n.remove());
 f._wc=snap(f);pageOn(true)}
ACT.wcDrop=()=>{const f=sh.querySelector('form');if(f)f._wcGo=1;closeSheet()};
document.addEventListener('submit',e=>{const f=e.target;if(f.closest&&f.closest('#sheet.wc')){f._wcGo=1;setTimeout(()=>{f._wcGo=0},0)}},true);
{const _n=thrNewSheet;thrNewSheet=function(){const r=_n.apply(this,arguments);notePage('New note');return r}}
{const _a=thrAddSheet;thrAddSheet=function(id){const r=_a.apply(this,arguments),t=TH(id);if(t)notePage('Notes',t.title);return r}}
{const _u=ACT.thrUpEdit;ACT.thrUpEdit=function(d){const r=_u.apply(this,arguments),t=TH(d.id);if(t)notePage('Notes',t.title);return r}}
/* a template filling an untouched page isn't writing: leaving still throws it away */
{const _t=ACT.ntTpl;ACT.ntTpl=function(){const f=sh.querySelector('form'),was=f&&!dirty(f),r=_t.apply(this,arguments);if(was)f._wc=snap(f);return r}}

/* leaving by any road (back arrow, Android back, Esc, the sidebar) keeps what was written */
{const _c=closeSheet;closeSheet=function(){wmShut(true);const f=open()&&sh.classList.contains('wc-note')&&sh.querySelector('form');
 if(f&&!f._wcGo&&dirty(f)&&hasText(f)){f.requestSubmit();return}
 if(sh.classList.contains('wc')){root.classList.remove('wc-on','wc-typing','wc-full');clearTimeout(OFF);OFF=setTimeout(()=>{if(!sh.classList.contains('on'))pageOff()},300)}
 return _c.apply(this,arguments)}}
/* any other sheet opened from here is an ordinary sheet */
{const _o=openSheet;openSheet=function(){if(sh.classList.contains('wc')){clearTimeout(OFF);pageOff()}return _o.apply(this,arguments)}}
/* the sidebar and bottom bar still work: save and close first, then go */
document.addEventListener('click',e=>{if(GO||!open())return;const a=e.target.closest&&e.target.closest('#rail a,#rail button,#tabbar a,#tabbar button');if(!a)return;e.preventDefault();e.stopImmediatePropagation();closeSheet();setTimeout(()=>{GO=1;a.click();GO=0},240)},true);
/* the bottom bar makes way for the keyboard */
const typing=t=>t&&t.matches&&t.matches('textarea,[contenteditable=true],input:not([type=checkbox]):not([type=file])');
sh.addEventListener('focusin',e=>{if(open()&&typing(e.target))root.classList.add('wc-typing')});
sh.addEventListener('focusout',()=>setTimeout(()=>{if(!typing(document.activeElement))root.classList.remove('wc-typing')},60));

/* ---------------- a note's page: the header buttons go in the menu, writing opens the page ---------------- */
{const _vt=vThread;vThread=function(id){const o=_vt(id),t=TH(id);if(!t)return o;const tp=document.createElement('template');tp.innerHTML=o;const r=tp.content.querySelector('.crumb .ph-r');
 if(r){const L=[...r.children];r.innerHTML=burger();const P=r.querySelector('.wm-p');
  /* printBtn adds its own button to this header unless it finds one here */
  L.push(el('x',`<button data-act="printIt" data-k="thread" data-id="${esc(id)}" aria-label="Print or save as PDF">${ic('print')}</button>`).firstChild);
  L.forEach(c=>{const on=c.classList.contains('on'),svg=c.querySelector('svg'),tx=c.getAttribute('aria-label')||c.textContent.trim();c.classList.remove('ibtn','sm');c.classList.add('wm-i');c.classList.toggle('on',on);c.dataset.wmC=1;c.innerHTML=`<span class="wm-r">${svg?svg.outerHTML:''}</span><span>${esc(tx)}</span>`;const x=el('wm-x');x.append(c);P.append(x)})}
 const ed=tp.content.querySelector('form.thr-ed');if(ed){const b=document.createElement('button');b.type='button';b.className='wc-write rv';b.dataset.act='thrAddSheet';b.dataset.id=id;b.innerHTML=`${ic('edit')}<span>Write an update…</span>`;ed.replaceWith(b)}
 return tp.innerHTML};VIEWS.thread=vThread}

document.head.appendChild(Object.assign(document.createElement('style'),{textContent:`
/* the page */
html.wc-on #scrim{opacity:0!important;pointer-events:none!important;transition:none}
html.wc-on #view,html.wc-on #fnav,html.wc-on .ai-mini{visibility:hidden}
html.wc-on .tabbar{z-index:62}
html.wc-full .rail{visibility:hidden}html.wc-full .tabbar{display:none}
#sheet.wc{left:var(--wc-l,0px);right:0;top:0;bottom:auto;width:auto;max-width:none;height:var(--vvh,100dvh);max-height:none;padding:var(--sat,env(safe-area-inset-top)) 0 0;margin:0;border:0;border-radius:0;box-shadow:none;transform:none!important;overflow:hidden;display:flex;flex-direction:column;--wg:clamp(18px,3.2vw,48px)}
#sheet.wc:not(.bk-write){background:transparent!important;backdrop-filter:none;-webkit-backdrop-filter:none}
html.bk-on #sheet.wc:not(.bk-write){background:var(--bg)!important}
#sheet.wc:not(.on){opacity:0;visibility:hidden;transition:opacity .24s var(--ease),visibility 0s .24s}
#sheet.wc.on{opacity:1;visibility:visible;transition:none;animation:wcIn .46s var(--ease)}
@keyframes wcIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
#sheet.wc>.grab{display:none}
#sheet.wc>.wr,#sheet.wc>form{flex:1;min-height:0;width:100%;max-width:none;margin:0;display:flex;flex-direction:column;gap:0}
.wc-bar{flex:none;display:flex;align-items:center;gap:10px;padding:10px var(--wg) 6px;position:relative;z-index:6}
.wc-c{flex:1;min-width:0;display:flex;align-items:baseline;gap:10px;white-space:nowrap}
.wc-c b{font:600 14px var(--f-body);color:var(--text)}
.wc-c .data{min-width:0;overflow:hidden;text-overflow:ellipsis}
#sheet.wc .wr-done{display:inline-flex!important}
.wc-tools{flex:none;padding:0 var(--wg) 6px;position:relative;z-index:2}
#sheet.wc .wr-tb{position:static;top:auto;padding:0;gap:2px;border:0;border-radius:0;background:none;box-shadow:none;overflow-x:auto;scrollbar-width:none}
#sheet.wc .wr-tb::-webkit-scrollbar{display:none}
#sheet.wc .wr-tb button{flex:none}
#sheet.wc .fmt-bar{margin:0;padding:0;gap:2px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
#sheet.wc .fmt-bar::-webkit-scrollbar{display:none}
#sheet.wc .fmt-b{flex:none;height:36px;min-width:38px;padding:0 10px;border:0;border-radius:10px;background:none;font-size:14px}
#sheet.wc .fmt-b:hover{background:var(--surface-2)}
#sheet.wc .fmt-h{background:none}
.wc-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;padding:10px var(--wg) 24px;scrollbar-width:thin}
#sheet.wc .wr-title,.wc-h{flex:none;width:100%;margin:0;padding:0;border:0;border-radius:0;background-color:transparent;box-shadow:none;font:800 clamp(30px,4.2vw,50px)/1.05 var(--f-display);text-transform:uppercase;color:var(--text)}
#sheet.wc .wr-title:focus{border:0;box-shadow:none;outline:0}
.wc-d{flex:none;margin:8px 0 18px}
#sheet.wc>form .wc-scroll>.wr-title,.wc-h{margin-bottom:18px}
#sheet.wc .ph-prev{flex:none;max-height:38vh;width:auto;max-width:100%;align-self:flex-start;border-radius:14px;margin:0 0 18px}
html #sheet.wc .wr-ed,html #sheet.wc .wc-scroll>textarea{flex:1 0 auto;width:100%;min-height:180px;padding:0;border:0!important;border-radius:0;background-color:transparent!important;box-shadow:none!important;outline:0;font:400 clamp(17px,1.3vw,19px)/1.7 var(--f-body);color:var(--text);resize:none}
html #sheet.wc .wc-scroll>textarea{flex:1 1 0;min-height:120px}
#sheet.wc.bk-write .wr-ed{font-family:var(--bkf);font-size:var(--bks);line-height:var(--bkl)}
#sheet.wc .ink-tray{flex:none;margin-top:12px}
#sheet.wc .wc-scroll>.mic{position:sticky;top:auto;right:auto;bottom:8px;align-self:flex-end;flex:none;margin:-44px 0 0;z-index:3}
@media(max-width:820px){.wc-scroll{padding-bottom:calc(96px + var(--sab,env(safe-area-inset-bottom)))}
#sheet.wc .wc-scroll>.mic{bottom:calc(92px + var(--sab,env(safe-area-inset-bottom)))}
 html.wc-typing .wc-scroll,html.wc-full .wc-scroll{padding-bottom:18px}
 html.wc-typing #sheet.wc .wc-scroll>.mic,html.wc-full #sheet.wc .wc-scroll>.mic{bottom:8px}
 html.wc-on .tabbar{transition:transform .4s var(--ease),opacity .25s var(--ease)}
 html.wc-typing .tabbar{transform:translateY(150%);opacity:0;pointer-events:none}}
/* the menu button */
.wm{position:relative;flex:none;z-index:30}
.wm-b{position:relative;display:block;width:44px;height:44px;padding:0;border-radius:15px;border:1px solid var(--line-2);background:var(--surface);color:var(--text);cursor:pointer;transition:transform .78s var(--spring),border-color .4s var(--ease),background-color .4s var(--ease)}
.wm-b i{position:absolute;left:13px;right:13px;height:2px;border-radius:2px;background:currentColor;transition:transform .68s var(--spring),opacity .26s var(--ease)}
.wm-b i:nth-child(1){top:14px}.wm-b i:nth-child(2){top:20px;right:17px}.wm-b i:nth-child(3){top:26px}
.wm-b:active{transform:scale(.92)}
.wm.on .wm-b{transform:rotate(180deg);border-color:color-mix(in srgb,var(--accent) 55%,var(--line-2));background:color-mix(in srgb,var(--accent) 14%,var(--surface))}
.wm.on .wm-b i:nth-child(1){transform:translateY(6px) rotate(45deg)}
.wm.on .wm-b i:nth-child(2){transform:scaleX(0);opacity:0}
.wm.on .wm-b i:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
/* the panel opens as a circle from the button; each option travels out of the button, its icon rolling as it goes */
.wm-p{position:absolute;top:calc(100% + 10px);right:0;width:min(350px,calc(100vw - 28px));max-height:calc(var(--vvh,100dvh) - var(--sat,0px) - 96px);overflow:hidden auto;scrollbar-width:none;padding:10px;display:flex;flex-direction:column;gap:2px;border-radius:24px;border:1px solid var(--line-2);background:var(--bg-2);box-shadow:0 30px 70px -22px rgba(0,0,0,.6);clip-path:circle(0 at var(--ox,100%) var(--oy,0));transition:clip-path .5s cubic-bezier(.55,0,.75,.2) .06s}
.wm-p::-webkit-scrollbar{display:none}
.wm-p[hidden]{display:none}
.wm.on .wm-p{clip-path:circle(150vmax at var(--ox,100%) var(--oy,0));transition:clip-path .9s var(--ease)}
.wm-x{position:relative;flex:none;opacity:0;transform:translate(var(--dx,0),var(--dy,0)) scale(.3);transition:transform .42s cubic-bezier(.5,0,.8,.3) calc((var(--n,1) - var(--i,0))*14ms),opacity .3s var(--ease) calc((var(--n,1) - var(--i,0))*14ms)}
.wm.on .wm-x{opacity:1;transform:none;transition:transform .78s var(--spring) calc(var(--i,0)*44ms + 70ms),opacity .36s var(--ease) calc(var(--i,0)*44ms + 70ms)}
.wm-r{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--surface-2);transform:rotate(-320deg);transition:transform .46s cubic-bezier(.5,0,.8,.3) calc((var(--n,1) - var(--i,0))*14ms)}
.wm.on .wm-r{transform:none;transition:transform .92s var(--ease) calc(var(--i,0)*44ms + 70ms)}
.wm-r svg{width:16px;height:16px}
.wm-i{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:6px 8px;border:0;border-radius:14px;background:none;color:var(--text);font:600 14.5px var(--f-body);text-align:left;text-decoration:none;cursor:pointer;transition:background-color .2s}
.wm-i:hover{background:var(--surface)}
.wm-i.on .wm-r{background:color-mix(in srgb,var(--accent) 28%,var(--surface-2));color:var(--accent)}
.wm-i.danger{color:var(--danger,#F0736A)}
.wm-s{padding:4px 8px 10px}
.wm-l{font:600 11px var(--f-body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.wm-s .wr-pills{flex-wrap:wrap;overflow:visible}
.wm-s .wr-mood{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;overflow:visible;padding:0}
.wm-s .wr-m{width:auto}
.wm-s .wr-meta{grid-template-columns:1fr 1fr}
.wm-s .thr-tags{margin:0}
.wm-s .nt-tpl{display:flex;flex-wrap:wrap;gap:6px}
.wm-s .nt-more{margin:0;padding:0;border:0;background:none}
.wm-sw .wr-priv{margin:0;width:100%;min-height:46px;padding:6px 8px;justify-content:space-between}
.wm-sw .wr-priv>span:first-child{display:flex;align-items:center;gap:12px;font:600 14.5px var(--f-body);color:var(--text)}
/* the note page's way in */
.wc-write{display:flex;align-items:center;gap:12px;width:100%;padding:14px 2px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--muted);font:500 16px var(--f-body);text-align:left;cursor:text;transition:color .25s var(--ease),border-color .25s var(--ease)}
.wc-write:hover{color:var(--text);border-color:var(--accent)}
.wc-write svg{width:18px;height:18px}
.thr-ws:has(>.wc-write){grid-template-columns:minmax(0,1fr)}
.crumb:has(.wm){position:relative;z-index:50}
@media(prefers-reduced-motion:reduce){#sheet.wc.on{animation:none}.wm-b,.wm-b i,.wm-p,.wm.on .wm-p,.wm-x,.wm.on .wm-x,.wm-r,.wm.on .wm-r{transition-duration:.01s!important;transition-delay:0s!important}}
`}));
})();
