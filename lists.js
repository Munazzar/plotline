/* ================= Lists =================
   Checklists (shopping, packing, to-dos) with an optional deadline for the list and for each item.
   Lists live in S.lists, so they sync through Google Drive with everything else.
   "Share" puts an encrypted copy in Firestore the same way Workbench boards do (benches collection, kind 'edit',
   AES-GCM key only in the link's #fragment), so no rules change is needed. Everyone with the link who is signed in
   can tick and add items; changes merge item by item (newest edit of each item wins, deletions are kept as tombstones).
   Cloud reads only happen while a shared list is open and someone is using the app.
*/
(()=>{
'use strict';
const now=()=>Date.now(),C=()=>window.WBC;
Object.assign(IC,{checklist:'<rect x="3.5" y="4" width="5" height="5" rx="1.2"/><path d="M4.8 6.6l1.1 1.1 1.9-2.2"/><rect x="3.5" y="13" width="5" height="5" rx="1.2"/><path d="M12 6.5h8.5M12 15.5h8.5"/>'});
const lists=()=>S.lists||(S.lists=[]);
const LBY=id=>lists().find(l=>l.id===id);
const live=L=>Object.values(L.items||{}).filter(i=>!i.del).sort((a,b)=>(!!b.pin-!!a.pin)||(a.o||0)-(b.o||0));
const stats=L=>{const I=live(L),d=I.filter(i=>i.done).length;return{n:I.length,d,p:I.length?Math.round(d/I.length*100):0}};
const dueTxt=ds=>{if(!ds)return'';const k=daysUntil(ds);return k===0?'Today':k===1?'Tomorrow':k===-1?'Yesterday':k<0?`${-k} days late`:k<7?dayName(ds):fmtDate(ds)};
const dueCl=(ds,done)=>!ds||done?'':daysUntil(ds)<0?' late':daysUntil(ds)<=1?' soon':'';
const EMO=['📝','🛒','🎒','✈️','🏠','🎁','📦','🧳','🍳','💼','🎉','🧹'];
const TPL={blank:['New list','📝',[]],groceries:['Groceries','🛒',['Milk','Eggs','Bread','Fruit','Vegetables']],packing:['Packing','🎒',['Passport / ID','Phone charger','Toothbrush','Clothes','Medicines']],todo:['To-do','✅',[]]};
function newList(k){const[t,e,its]=TPL[k]||TPL.blank,L={id:uid(),title:t,emoji:e,due:'',items:{},u:now(),mu:now(),created:now(),cloud:null};its.forEach((x,i)=>{const id=uid();L.items[id]={id,t:x,done:false,due:'',o:i,u:now()}});lists().unshift(L);save();return L}
function touch(L){L.u=now();save();if(L.cloud)pushSoon(L)}
const ST=new Map(),st=L=>{let x=ST.get(L.id);if(!x){x={};ST.set(L.id,x)}return x};

/* ---------------- cloud ---------------- */
const payload=L=>({k:'list',title:L.title,emoji:L.emoji,due:L.due,color:L.color||'',img:L.img||'',secs:L.secs||[],rep:L.rep||'',rst:L.rst||'',mu:L.mu,items:L.items});
const linkOf=L=>`${C().webBase()}#/list/j~${L.cloud.doc}~${C().toUrl(L.cloud.key)}`;
const ro=L=>!!(L.cloud&&!C().signedIn());
/* 1.50.1: a shared list comes from other people, so only well-formed fields get in: item ids from a fixed alphabet,
   dates that are dates, a colour from the app's set, a cover that is an inline picture, numbers and true/false values. */
const okId=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(k),okDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d:'';
function cleanList(r){if(!r||typeof r!=='object')return{};const items={};
 for(const[id,v]of Object.entries(r.items&&typeof r.items==='object'?r.items:{})){if(!okId(id)||!v||typeof v!=='object')continue;const o={id};
  for(const[f,x]of Object.entries(v))if(f!=='id'&&(typeof x==='boolean'||typeof x==='number'&&isFinite(x)))o[f]=x;
  o.t=String(v.t||'').slice(0,500);if(okId(v.s))o.s=v.s;if(typeof v.n==='string'&&v.n)o.n=v.n.slice(0,300);o.due=okDate(v.due);if(v.dt!=null)o.dt=okDate(v.dt);items[id]=o}
 return{k:r.k,title:String(r.title||'').slice(0,120),emoji:String(r.emoji||'').slice(0,16),due:okDate(r.due),color:AREA_IDS.includes(r.color)?r.color:'',
  img:typeof r.img==='string'&&/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(r.img)?r.img:'',secs:Array.isArray(r.secs)?r.secs.filter(x=>x&&okId(x.id)).slice(0,30).map(x=>({id:x.id,t:String(x.t||'').slice(0,60)})):[],rep:['day','week','month'].includes(r.rep)?r.rep:'',rst:typeof r.rst==='string'?r.rst.slice(0,10):'',mu:+r.mu||0,items}}
function merge(L,r){let ch=false;for(const[id,it]of Object.entries(r.items||{})){const a=L.items[id];if(!a||(it.u||0)>(a.u||0)){L.items[id]=it;ch=true}}
 if((r.mu||0)>(L.mu||0)){L.title=r.title;L.emoji=r.emoji;L.due=r.due||'';L.color=r.color||'';L.img=r.img||'';L.secs=r.secs||[];L.rep=r.rep||'';L.rst=r.rst||'';L.mu=r.mu;ch=true}return ch}
let pT={};function pushSoon(L,d=250){clearTimeout(pT[L.id]);pT[L.id]=setTimeout(()=>push(L),d)}
async function push(L){const s=st(L);if(!L.cloud||ro(L))return;if(s.pushing){s.again=1;return}s.pushing=1;paintSt(L,'saving');
 try{for(let i=0;i<4;i++){const enc=await encJ(L.cloud.key,payload(L));const r=await C().cput(L.cloud.doc,{owner:L.cloud.owner,kind:'edit',enc,u:now(),v:1},L.cloud.ut||'new');
   if(r.conflict){await pull(L,true);continue}L.cloud.ut=r.ut;L.cloud.sent=now();s.pushedAt=now();save();paintSt(L,'ok');if(window.rtPing)rtPing(L.cloud.doc);return}throw new Error('Too many people saving at once, retrying')}
 catch(e){paintSt(L,'err');toast(esc(e.message||String(e)))}finally{s.pushing=0;if(s.again){s.again=0;pushSoon(L,50)}}}
async function pull(L,force){const d=await C().cget(L.cloud.doc);if(!d){L.cloud.gone=1;save();paintSt(L,'err');return}
 if(!force&&d.ut===L.cloud.ut)return;const r=cleanList(await decJ(L.cloud.key,d.enc));L.cloud.owner=d.owner;L.cloud.ut=d.ut;st(L).remote=now();
 const ch=merge(L,r);const mineNewer=Object.values(L.items).some(i=>(i.u||0)>(L.cloud.sent||0))||(L.mu||0)>(L.cloud.sent||0);
 if(ch){save();if(cur.p==='list'&&cur.id===L.id||cur.p==='lists')repaint()}
 if(mineNewer&&!ro(L))pushSoon(L,200);paintSt(L,'ok')}
/* redraw the open list in place, keeping whatever you're typing (and the cursor) */
function repaint(){const a=document.activeElement,k=a&&a.dataset?(a.dataset.lsedit?'[data-lsedit="'+a.dataset.lsedit+'"]':a.dataset.lstitle?'[data-lstitle]':a.closest&&a.closest('.ls-sadd')?'.ls-sadd input':a.closest&&a.closest('.ls-add')?'.ls-add:not(.ls-sadd) input':null):null;
 const v=k&&a.value,ss=k&&a.selectionStart,se=k&&a.selectionEnd,y=scrollY;render(false);window.scrollTo(0,y);
 if(k){const n=document.querySelector('#view '+k);if(n){n.value=v;n.focus();try{n.setSelectionRange(ss,se)}catch(e){}}}}
function paintSt(L,k){const e=document.getElementById('lsst');if(e&&cur.p==='list'&&cur.id===L.id){e.className='ls-st '+k;e.textContent=k==='ok'?'Synced':k==='saving'?'Saving…':k==='err'?(L.cloud&&L.cloud.gone?'No longer shared':'Not synced'):''}}
/* while a shared list is open and someone is using the app: every 6 s right after a change from someone else, else every 30 s */
/* live: while a shared list is open, the Realtime Database pushes a ping on every change and we fetch it at once.
   Without that (not set up yet), it checks every 6 s right after a change, else every 30 s. */
/* 1.30.3: one live connection per shared list on screen: the open list, or every shared list while Lists is open
   (each is a Realtime Database connection, so nothing is watched on other pages). A change anywhere redraws in place. */
const W8=new Map();// doc -> watcher
const byDoc=doc=>lists().find(l=>l.cloud&&l.cloud.doc===doc);
const isOn=L=>!!(L&&L.cloud&&W8.has(L.cloud.doc)&&W8.get(L.cloud.doc).on);
function watchAll(){const want=new Set((cur.p==='list'?[LBY(cur.id)]:cur.p==='lists'?lists().filter(l=>!l.del).slice(0,12):[]).filter(l=>l&&l.cloud&&!l.cloud.gone).map(l=>l.cloud.doc));
 if(window.plAwake&&!window.plAwake())want.clear();
 for(const[d,w]of W8)if(!want.has(d)){w.close();W8.delete(d)}
 if(window.rtWatch)for(const d of want)if(!W8.has(d))W8.set(d,rtWatch(d,()=>{const x=byDoc(d);if(!x||now()-(st(x).pushedAt||0)<1500)return;pull(x).catch(()=>paintSt(x,'err'))}));
 liveTag()}
/* the blinking "Live" tag shows only while the database is actually pushing changes */
function liveTag(){const e=document.getElementById('lslive');if(!e)return;const on=cur.p==='list'?isOn(LBY(cur.id)):[...W8.values()].some(w=>w.on);e.hidden=!on}
let tick=0;setInterval(()=>{tick++;watchAll();const L=cur.p==='list'?LBY(cur.id):null;if(!L||!L.cloud||L.cloud.gone||st(L).pushing||(window.plAwake&&!window.plAwake()))return;
 if(isOn(L))return;if(tick%2||(now()-(st(L).remote||0)>60e3&&tick%10))return;pull(L).catch(()=>paintSt(L,'err'))},3000);
addEventListener('hashchange',()=>setTimeout(watchAll,50));
async function ensureCloud(L){if(L.cloud)return L.cloud;if(!C()||!C().signedIn())throw new Error('Sign in (Settings → Sync) to share a list');
 const s=await C().gs();L.cloud={doc:C().rnd(24),key:newKey(),owner:s.uid,ut:null,sent:0};save();await push(L);if(!L.cloud.ut){L.cloud=null;save();throw new Error('Couldn’t share the list. Try again in a moment.')}return L.cloud}
async function share(L){if(L.cloud)return showLink(L);
 if(!C()||!C().signedIn()){if(typeof shReady==='function'&&await shReady()&&C().signedIn())return share(L);return toast('Sign in (Settings → Sync) to share a list')}
 try{toast('Creating a private link…');await ensureCloud(L);render(false);showLink(L)}catch(e){toast(esc(e.message||String(e)))}}
/* Share: invite people (it shows up in their Plotlines, like shared habits) or copy a link */
function shareMenu(L){const sh=typeof shareChip==='function'&&shareChip('list',L.id);
 openSheet(`<div class="data">Share</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2><div class="acct-opts">
 <button class="acct-o" data-act="lsInvite" data-id="${L.id}"><b>${ic('user','ico-s')} Invite people</b><small>Add their Google email. The list shows up in their Plotlines by itself, with a notification on Android.</small></button>
 <button class="acct-o" data-act="lsLink" data-id="${L.id}"><b>${ic('link','ico-s')} Copy a link</b><small>Anyone you send it to can open it after signing in.</small></button>
 ${sh?`<button class="acct-o" data-act="lsGroup" data-id="${L.id}"><b>${ic('share','ico-s')} Who’s in it</b><small>See everyone’s progress and react.</small></button>`:''}</div>`)}
function showLink(L){const url=linkOf(L);openSheet(`<div class="data">Share</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2><p class="small muted">Anyone with this link who signs in to Plotlines can tick and add items. It’s end-to-end encrypted; the key is only in the link.</p>
 <div class="wb-row"><input id="lslink" readonly value="${esc(url)}" aria-label="Link"><button class="btn sm" data-act="lsCopy">${ic('copy')}Copy</button></div>
 <div class="actions"><button class="btn pri" data-act="lsSend">${ic('send')}Send…</button></div>`)}
async function joinData(doc,k){const have=lists().find(l=>l.cloud&&l.cloud.doc===doc);if(have)return have.id;
 const d=await C().cget(doc);if(!d)throw new Error('That list isn’t shared any more');const r=cleanList(await decJ(k,d.enc));if(!r||r.k!=='list')throw new Error('That link isn’t a list');
 const L={id:uid(),title:r.title||'Shared list',emoji:r.emoji||'📝',due:r.due||'',color:r.color||'',img:r.img||'',secs:r.secs||[],rep:r.rep||'',rst:r.rst||'',items:r.items||{},mu:r.mu||0,u:now(),created:now(),cloud:{doc,key:k,owner:d.owner,ut:d.ut,sent:now()}};
 lists().unshift(L);save();st(L).remote=now();return L.id}
async function join(doc,key){try{const id=await joinData(doc,C().fromUrl(key));history.replaceState(null,'','#/list/'+id);cur.id=id;render(false)}
 catch(e){toast(esc(e.message||String(e)));go('lists')}}
window.LS={byId:id=>LBY(id),ensureCloud,joinData};
/* list colour from its … menu (same picker as habits and goals) */
{const _sc=ACT.setColor;ACT.setColor=(d,el)=>{if(d.k!=='list')return _sc(d,el);const L=LBY(d.id);if(!L)return;L.color=d.v||'';L.mu=now();touch(L);
 el.closest('.clr-row').querySelectorAll('.clr').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});render(false)}}
/* cover image: smaller than a goal's (it also travels to everyone the list is shared with) */
FILE.lsimg=async inp=>{const L=LBY(inp.dataset.id),f=inp.files[0];if(!L||!f)return;
 try{const big=await readImg(f),im=new Image();im.src=big;await im.decode();const sc=Math.min(1,720/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  L.img=c.toDataURL('image/jpeg',.72);L.mu=now();closeSheet();touch(L);if(typeof imgCSS==='function')imgCSS();render(false);toast('Cover added')}catch(e){toast('Couldn’t read that image')}};

/* ---------------- views ----------------
   Same three views as Goals (grid, carousel, list). Cards are "tint" cards, so the card style, background pattern
   and image from Settings → Look & feel apply; each list can also have its own colour and cover image. */
const lColor=L=>L.color||AREA_IDS[[...String(L.id)].reduce((a,c)=>a+c.charCodeAt(0),0)%AREA_IDS.length];
const lvar=L=>cvar({id:L.id,area:'personal',color:lColor(L)});
const lview=()=>{const v=(S.settings.layout||{}).lists;return['grid','h','list'].includes(v)?v:'grid'};
function bigCard(L,n){const s=stats(L),I=live(L).filter(i=>!i.done).slice(0,3);
 return`<a class="lc tint" href="#/list/${L.id}" style="${lvar(L)}"><div class="lc-top"><span class="data">${s.n?`${s.d} of ${s.n} done`:'Empty'}${L.cloud?' · shared':''}</span><span class="nbadge">${pad2(n)}</span></div>
 <span class="lc-e">${esc(L.emoji||'📝')}</span><h3 class="lc-t">${esc(L.title)}</h3>
 ${I.length?`<ul class="lc-i">${I.map(i=>`<li>${esc(i.t)}</li>`).join('')}</ul>`:s.n?'<p class="lc-i lc-dn">All done</p>':''}
 <div class="pbar"><i style="width:${s.p}%"></i></div><div class="lc-f data">${L.due?`<span class="ls-due${dueCl(L.due,s.n&&s.d===s.n)}">Due ${esc(dueTxt(L.due))}</span>`:'&nbsp;'}</div></a>`}
function card(L){const s=stats(L),r=18,c=2*Math.PI*r;
 return`<a class="ls-c rv" href="#/list/${L.id}" style="${lvar(L)}"><span class="ls-ring" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="${r}" class="bg"/><circle cx="22" cy="22" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-s.p/100)).toFixed(1)}"/></svg><em>${esc(L.emoji||'📝')}</em></span>
 <span class="ls-ct"><b>${esc(L.title)}</b><small>${s.n?`${s.d} of ${s.n} done`:'Empty'}${L.due?` · <span class="ls-due${dueCl(L.due,s.n&&s.d===s.n)}">${esc(dueTxt(L.due))}</span>`:''}</small></span>${L.cloud?`<span class="ls-sh" title="Shared">${ic('link')}</span>`:''}</a>`}
function body(A,key){const v=lview();if(!A.length)return'';
 if(v==='list')return`<section class="ls-rows">${A.map(card).join('')}</section>`;
 if(v==='h')return hsShell('lists-'+key,A.map((L,i)=>{const s=stats(L),dn=s.n&&s.d===s.n;return hsItem(lvar(L),bigCard(L,i+1),dn?'done':'',`<span class="node static" aria-hidden="true">${dn?ic('check'):''}</span>`,L.due?'Due '+esc(dueTxt(L.due)):`${s.d} of ${s.n}`)}).join(''),0);
 return`<section class="lc-grid">${A.map((L,i)=>`<div class="rv">${bigCard(L,i+1)}</div>`).join('')}</section>`}
function vLists(){lists().forEach(fresh);const L=lists(),open=L.filter(l=>{const s=stats(l);return!s.n||s.d<s.n}),done=L.filter(l=>{const s=stats(l);return s.n&&s.d===s.n});
 return`<header class="ph"><div><h1>Lists</h1><div class="data">${L.length?`${open.length} open${done.length?` · ${done.length} done`:''}`:'Checklists you can share'}</div></div><div class="ph-r">${L.some(l=>l.cloud&&!l.cloud.gone)?`<span class="live-tag" id="lslive" ${[...W8.values()].some(w=>w.on)?'':'hidden'}><i></i>Live</span>`:''}<button class="ibtn" data-act="lsJoin" aria-label="Open a shared link" title="Open a shared link">${ic('link')}</button><button class="ibtn" data-act="lsNew" data-k="blank" aria-label="New list" title="New list">${ic('plus')}</button>${gear()}</div></header>
 <div class="bar rv"><div class="ls-tpl"><button class="chip" data-act="lsPhoto">📷 From a photo</button>${Object.entries(TPL).map(([k,[t,e]])=>`<button class="chip" data-act="lsNew" data-k="${k}">${e} ${k==='blank'?'Blank list':esc(t)}</button>`).join('')}</div>${L.length?iconSeg('lists',[['grid','grid','Grid'],['h','horz','Carousel'],['list','list','List']],lview()):''}</div>
 ${L.length?`${body(open,'open')}${done.length?`<div class="st-h rv" style="margin-top:28px"><h3>Done</h3><span class="data">${done.length}</span></div>${body(done,'done')}`:''}`
 :`<div class="empty rv"><p>No lists yet. Start one above, or open a link someone sent you.</p></div>`}`}
function itemRow(L,i){const r=ro(L);return`<div class="ls-it${i.done?' done':''}" data-iid="${i.id}"><button class="ls-ck" data-act="lsTog" data-id="${L.id}" data-i="${i.id}" role="checkbox" aria-checked="${!!i.done}" aria-label="${esc(i.t)}" ${r?'disabled':''}>${ic('check')}</button>
 ${i.n?'<div class="ls-tw">':''}<input class="ls-t" value="${esc(i.t)}" data-lsedit="${i.id}" maxlength="200" aria-label="Item" ${r?'readonly':''}>${i.n?`<button class="ls-n" data-act="lsNote" data-id="${L.id}" data-i="${i.id}" ${r?'disabled':''} aria-label="Note: ${esc(i.n)}">${esc(i.n)}</button></div>`:''}
 ${i.pin?`<button class="ls-pin" data-act="lsPin" data-id="${L.id}" data-i="${i.id}" aria-label="Unpin" title="Pinned · tap to unpin" ${r?'disabled':''}>📌</button>`:''}${+i.rem>Date.now()&&!i.done?`<span class="ls-rem data" title="Reminder">🔔 ${esc(dueTxt(ymd(new Date(+i.rem))))} ${esc(fmtTime(`${pad2(new Date(+i.rem).getHours())}:${pad2(new Date(+i.rem).getMinutes())}`))}</span>`:''}
 ${i.due?`<button class="ls-dc${dueCl(i.due,i.done)}" data-act="lsItemDue" data-id="${L.id}" data-i="${i.id}" ${r?'disabled':''}>${esc(dueTxt(i.due))}</button>`:r?'':`<button class="ibtn sm ls-ib" data-act="lsItemDue" data-id="${L.id}" data-i="${i.id}" aria-label="Set a date" title="Set a date">${ic('cal')}</button>`}
 ${r?'':`<button class="ibtn sm ls-ib ls-x" data-act="lsItemMenu" data-id="${L.id}" data-i="${i.id}" aria-label="More for this item" title="Pin, move, remind, delete">${ic('more')}</button>`}</div>`}
function vList(id){if(id&&id.startsWith('j~')){const[,doc,key]=id.split('~');setTimeout(()=>join(doc,key),0);return`<header class="ph"><div><h1>List</h1><div class="data">Opening the shared list…</div></div></header>`}
 const L=LBY(id);if(!L)return`<header class="ph"><div><h1>List</h1></div></header><div class="empty rv"><p>This list isn’t on this device.</p><div class="actions"><a class="btn pri" href="#/lists">All lists</a></div></div>`;
 fresh(L);const I=live(L),open=I.filter(i=>!i.done),done=I.filter(i=>i.done),s=stats(L),r=ro(L),showDone=st(L).showDone!==false;
 return`<div class="crumb"><a href="#/lists" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a><div class="ph-r">${L.cloud?`<span class="live-tag" id="lslive" ${isOn(L)?'':'hidden'}><i></i>Live</span>`:''}<button class="ibtn" data-act="lsShare" data-id="${L.id}" aria-label="${L.cloud?'Share link':'Share'}" title="${L.cloud?'Share link':'Share'}">${ic('share')}</button><button class="ibtn" data-act="lsMenu" data-id="${L.id}" aria-label="More">${ic('more')}</button></div></div>
 <section class="ls-hero tint rv" style="${lvar(L)}"><div class="ls-hrow"><button class="ls-emo" data-act="lsEmoji" data-id="${L.id}" aria-label="Change icon" ${r?'disabled':''}>${esc(L.emoji||'📝')}</button><input class="ls-title" value="${esc(L.title)}" data-lstitle="${L.id}" maxlength="80" aria-label="List name" ${r?'readonly':''}></div>
 <div class="ls-meta"><span class="data">${s.n?`${s.d} of ${s.n} done`:'No items yet'}</span>${typeof shareChip==='function'?shareChip('list',L.id):''}${L.cloud?`<span class="ls-st" id="lsst">${L.cloud.gone?'No longer shared':'Shared'}</span>`:''}<button class="ls-dc${dueCl(L.due,s.n&&s.d===s.n)}" data-act="lsDue" data-id="${L.id}" ${r?'disabled':''}>${ic('cal','ico-s')}${L.due?'Due '+esc(dueTxt(L.due)):'Add a deadline'}</button>${L.rep&&REP[L.rep]?`<button class="ls-dc" data-act="lsFresh" data-id="${L.id}" ${r?'disabled':''}>${ic('lsfresh','ico-s')}Fresh ${esc(REP[L.rep].toLowerCase())}</button>`:''}</div>
 <div class="ls-bar"><i style="width:${s.p}%"></i></div>${r?`<button class="btn sm pri" data-act="lsLogin" style="margin-top:14px">${ic('lock')}Sign in to edit</button>`:''}</section>
 ${r?'':`<form class="ls-add rv" data-form="lsAdd" data-id="${L.id}" autocomplete="off"><input name="t" maxlength="200" placeholder="Add an item" aria-label="Add an item" enterkeyhint="done" list="lsSug">${sugHTML(L)}<button type="button" class="btn ls-cam" data-act="lsPhoto" data-id="${L.id}" aria-label="Add or update from a photo" title="Add or update from a photo">${ic('camera')}</button><button class="btn pri" aria-label="Add">${ic('plus')}</button></form>`}
 ${openHTML(L,open,I,r)}
 ${done.length?`<div class="st-h rv ls-dh"><button class="link" data-act="lsDoneT" data-id="${L.id}">${showDone?'Hide':'Show'} done · ${done.length}</button>${r?'':`<button class="link" data-act="lsClear" data-id="${L.id}">Clear done</button>`}</div>${showDone?`<section class="ls-list rv">${done.map(i=>itemRow(L,i)).join('')}</section>`:''}`:''}${picsHTML(L)}`}
VIEWS.lists=vLists;VIEWS.list=vList;
/* 1.37 selection mode (index.html): remove many items of one list, or many lists, at once. Each returns an undo. */
window.lsBulk={
 items:(id,iids)=>{const L=LBY(id);if(!L||ro(L))return null;const I=iids.map(k=>L.items[k]).filter(i=>i&&!i.del);I.forEach(i=>{i.del=true;i.u=now()});touch(L);
  return()=>{I.forEach(i=>{i.del=false;i.u=now()});touch(L);render(false)}},
 lists:ids=>{const D=lists().filter(l=>ids.includes(l.id));S.lists=lists().filter(l=>!ids.includes(l.id));S.dead=S.dead||{};D.forEach(l=>{S.dead[l.id]=now()});save();
  return()=>{D.forEach(l=>{delete S.dead[l.id];l.mu=l.u=now()});S.lists=[...D,...lists()];save();render(false)}}};

/* ---------------- actions ---------------- */
const IT=(d)=>{const L=LBY(d.id);return[L,L&&L.items[d.i]]};
Object.assign(ACT,{
 lsNew:d=>{const L=newList(d.k);go('list/'+L.id);setTimeout(()=>{const i=document.querySelector(d.k==='blank'||d.k==='todo'?'.ls-title':'.ls-add input');if(i){i.focus();if(i.select&&i.classList.contains('ls-title'))i.select()}},350)},
 lsTog:(d,el)=>{const[L,i]=IT(d);if(!i||ro(L))return;i.done=!i.done;i.dt=i.done?ymd():'';i.u=now();if(typeof vib==='function')vib();touch(L);
  const row=el.closest('.ls-it');if(row&&!(typeof reduced==='function'&&reduced())){row.classList.toggle('done',i.done);el.setAttribute('aria-checked',i.done);setTimeout(()=>render(false),380)}else render(false)},
 lsDel:d=>{const[L,i]=IT(d);if(!i)return;i.del=true;i.u=now();touch(L);render(false);toast('Removed',()=>{i.del=false;i.u=now();touch(L);render(false)})},
 lsClear:d=>{const L=LBY(d.id);if(!L)return;const D=live(L).filter(i=>i.done);D.forEach(i=>{i.del=true;i.u=now()});touch(L);render(false);toast(`${D.length} cleared`)},
 lsDoneT:d=>{const L=LBY(d.id);if(!L)return;st(L).showDone=st(L).showDone===false;render(false)},
 lsDue:d=>{const L=LBY(d.id);if(!L)return;openSheet(`<h2>Deadline</h2><form data-form="lsDue" data-id="${L.id}"><div class="field"><label>Finish by</label><input type="date" name="d" value="${esc(L.due||'')}"></div><div class="actions">${L.due?`<button type="button" class="btn ghost" data-act="lsDueClear" data-id="${L.id}">No deadline</button>`:''}<button class="btn pri">Save</button></div></form>`)},
 lsDueClear:d=>{const L=LBY(d.id);if(!L)return;L.due='';L.mu=now();closeSheet();touch(L);render(false)},
 lsItemDue:d=>{const[L,i]=IT(d);if(!i)return;openSheet(`<h2>${esc(i.t)}</h2><form data-form="lsItemDue" data-id="${L.id}" data-i="${i.id}"><div class="field"><label>Do it by</label><input type="date" name="d" value="${esc(i.due||'')}"></div><div class="actions">${i.due?`<button type="button" class="btn ghost" data-act="lsItemDueClear" data-id="${L.id}" data-i="${i.id}">No date</button>`:''}<button class="btn pri">Save</button></div></form>`)},
 lsItemDueClear:d=>{const[L,i]=IT(d);if(!i)return;i.due='';i.u=now();closeSheet();touch(L);render(false)},
 lsEmoji:d=>{const L=LBY(d.id);if(!L)return;openSheet(`<h2>Icon</h2><div class="ls-emos">${EMO.map(e=>`<button class="ls-emo" data-act="lsEmojiSet" data-id="${L.id}" data-e="${e}">${e}</button>`).join('')}</div>`)},
 lsEmojiSet:d=>{const L=LBY(d.id);if(!L)return;L.emoji=d.e;L.mu=now();closeSheet();touch(L);render(false)},
 lsShare:d=>{const L=LBY(d.id);if(L)shareMenu(L)},
 lsImgRm:d=>{const L=LBY(d.id);if(!L)return;L.img='';L.mu=now();closeSheet();touch(L);if(typeof imgCSS==='function')imgCSS();render(false)},
 lsLink:d=>{const L=LBY(d.id);if(L)share(L)},
 lsInvite:d=>{const L=LBY(d.id);if(L&&typeof shareStart==='function')shareStart('list',{id:L.id})},
 lsGroup:d=>{const x=(S.shares||[]).find(x=>x.status==='joined'&&x.local&&x.local.kind==='list'&&x.local.id===d.id);if(x&&ACT.shOpen)ACT.shOpen({id:x.id})},
 lsCopy:async()=>{const i=$('#lslink');if(i&&await copyText(i.value))toast('Link copied')},
 lsSend:()=>{const i=$('#lslink');if(!i)return;const msg='Join my list on Plotlines: '+i.value;if(NATIVE){try{NATIVE.share('Plotlines list',msg);return}catch(e){}}if(navigator.share)navigator.share({title:'Plotlines list',url:i.value}).catch(()=>{});else ACT.lsCopy()},
 lsLogin:async()=>{if(typeof shReady==='function'&&await shReady()&&C().signedIn()){toast('Signed in. You can edit now');render(false)}},
 lsJoin:()=>openSheet(`<h2>Open a shared list</h2><form data-form="lsJoin"><div class="field"><label>Paste the link</label><input name="u" placeholder="https://…#/list/j~…" required></div><div class="actions"><button class="btn pri">Open</button></div></form>`),
 lsMenu:d=>{const L=LBY(d.id);if(!L)return;const own=L.cloud&&C()&&(()=>{try{return L.cloud.owner===(fbGet()||{}).uid}catch(e){return false}})();
  openSheet(`<div class="data">List</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2>${ro(L)?'':colorRow('list',{...L,area:'personal',color:L.color||''})}<div class="menu">
  ${ro(L)?'':`<label class="mbtn">${ic('camera')}${L.img?'Change cover image':'Add a cover image'}<input type="file" accept="image/*" data-file="lsimg" data-id="${L.id}" hidden></label>${L.img?`<button data-act="lsImgRm" data-id="${L.id}">${ic('trash')}Remove cover image</button>`:''}`}
  <button data-act="lsShare" data-id="${L.id}">${ic('share')}${L.cloud?'Share link':'Share this list'}</button>
  ${ro(L)?'':`<button data-act="lsPhoto" data-id="${L.id}">${ic('camera')}Add or update from a photo</button><button data-act="lsSecNew" data-id="${L.id}">${ic('list')}Add a section</button><button data-act="lsFresh" data-id="${L.id}">${ic('lsfresh')}Start fresh${L.rep&&REP[L.rep]?' · '+esc(REP[L.rep].toLowerCase()):'…'}</button><button data-act="lsSort" data-id="${L.id}">${ic('down')}Sort…</button>`}
  <button data-act="lsCopyText" data-id="${L.id}">${ic('copy')}Copy as text</button>
  <button data-act="lsDup" data-id="${L.id}">${ic('copy')}Duplicate (fresh, nothing ticked)</button>
  <button class="danger" data-act="lsDelList" data-id="${L.id}">${ic('trash')}Delete${L.cloud?' from this device':''}</button>
  ${own?`<button class="danger" data-act="lsDelList" data-id="${L.id}" data-all="1">${ic('trash')}Delete for everyone</button>`:''}</div>`)},
 lsCopyText:async d=>{const L=LBY(d.id);if(!L)return;const t=textOf(L);closeSheet();if(await copyText(t))toast('Copied')},
 lsDup:d=>{const L=LBY(d.id);if(!L)return;const N={id:uid(),title:L.title+' (copy)',emoji:L.emoji,due:'',items:{},u:now(),mu:now(),created:now(),cloud:null,secs:secsOf(L).map(x=>({...x})),rep:L.rep||''};live(L).forEach(i=>{const id=uid();N.items[id]={id,t:i.t,done:false,due:'',o:i.o,u:now(),...(i.s?{s:i.s}:{}),...(i.n?{n:i.n}:{})}});lists().unshift(N);save();closeSheet();go('list/'+N.id)},
 lsDelList:d=>{const L=LBY(d.id);if(!L)return;askConfirm(d.all?'Delete for everyone?':'Delete this list?',d.all?'The shared copy is deleted, so the link stops working for everyone.':`“${esc(L.title)}” is removed from this device${L.cloud?'. Others keep their copy.':'.'}`,'Delete',()=>{if(d.all&&L.cloud)C().cdel(L.cloud.doc,L.cloud.owner);S.lists=lists().filter(x=>x!==L);S.dead=S.dead||{};S.dead[L.id]=now();save();closeSheet();go('lists');toast('List deleted')})}});
Object.assign(FORM,{
 lsAdd:f=>{const L=LBY(f.dataset.id),inp=f.querySelector('input');const t=String(inp.value||'').trim();if(!L||!t)return;const sid=f.dataset.s&&SEC(L,f.dataset.s)?f.dataset.s:'',back=[];
  /* something already ticked off on this list (picked from the suggestions, say) comes back instead of a second copy */
  t.split(/\n|;/).map(x=>x.trim()).filter(Boolean).forEach(x=>{const k=nrm(x),dn=k&&live(L).find(i=>i.done&&nrm(i.t)===k);
   if(dn){dn.done=false;dn.dt='';dn.u=now();back.push(dn.t);return}
   const id=uid(),o=Math.max(0,...Object.values(L.items).map(i=>i.o||0))+1;L.items[id]={id,t:x.slice(0,200),done:false,due:'',o,u:now(),...(sid?{s:sid}:{})}});
  touch(L);render(false);if(back.length)toast(`${esc(back.join(', '))} ${back.length===1?'is':'are'} back on the list`);
  setTimeout(()=>{const i=document.querySelector(sid?'.ls-sadd input':'.ls-add:not(.ls-sadd) input');if(i)i.focus({preventScroll:!!sid})},30)},
 lsDue:f=>{const L=LBY(f.dataset.id);if(!L)return;L.due=new FormData(f).get('d')||'';L.mu=now();closeSheet();touch(L);render(false)},
 lsItemDue:f=>{const L=LBY(f.dataset.id),i=L&&L.items[f.dataset.i];if(!i)return;i.due=new FormData(f).get('d')||'';i.u=now();closeSheet();touch(L);render(false)},
 lsJoin:f=>{const m=/#\/list\/(j~[^~\s]+~[^\s#]+)/.exec(new FormData(f).get('u')||'');if(!m)return toast('That isn’t a Plotlines list link');closeSheet();go('list/'+m[1])}});
/* ---------------- lists from a photo (2026-11-18) ----------------
   The photo reader (ink.js: crop, read on the device or with your AI, check and fix the text) gives the lines in the
   order they're written. A new list takes them as its items (a first line like "Groceries:" or an unbulleted heading
   over bullets becomes its name). On an open list it updates: lines already there are matched (small misreads are
   forgiven) and ticked if the photo shows them ticked, new lines go in where they are on the paper. Optionally the photo
   is kept at the end of the list (L.pics, on this device and in your sync, not in the shared copy). */
const BUL=/^\s*(?:\[\s*([xX✓✔])?\s*\]|([☐□☑☒✓✔])|[-*•·●○◦▪■➢➤►‣⁃∙–—+>]+|\(?\d{1,3}[.):]|\(?[a-zA-Z][.)])\s*/u;
function photoLines(html){const raw=(window.inkMarks?inkMarks(html):String(html||'').replace(/<[^>]+>/g,'\n')).split('\n'),out=[];
 for(let l of raw){l=l.replace(/\*\*|==|__/g,'').replace(/^\s*\*(?=\S)|(?<=\S)\*\s*$/g,'').trim();if(!l)continue;
  /* a bullet can carry a checkbox too ("- [x] Milk"): take up to two marks off the front */
  let m=BUL.exec(l),done=false,r=l;const bul=!!m;for(let k=0;m&&k<2;k++){done=done||!!(m[1]||/[☑☒✓✔]/.test(m[2]||''));r=r.slice(m[0].length);m=BUL.exec(r)}
  const t=r.replace(/\s+/g,' ').trim().slice(0,200);if(t&&/[\p{L}\p{N}]/u.test(t))out.push({t,done,bul})}
 /* headings: a short unticked line ending in ":", or an unbulleted line over bullets when most lines are bulleted */
 const nb=out.filter(x=>x.bul).length;out.forEach((x,k)=>{x.head=!x.bul&&!x.done&&x.t.length<=60&&(/:$/.test(x.t)||nb>=out.length/2&&!!out[k+1]&&out[k+1].bul)});
 return out}
const nrm=t=>String(t).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'');
/* edits apart, a swap of two letters counting as one */
function lev(a,b){if(Math.abs(a.length-b.length)>3)return 9;let q=null,p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(q&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])c[j]=Math.min(c[j],q[j-2]+1)}q=p;p=c}return p[b.length]}
const srt=t=>[...t].sort().join(''),same=(a,b)=>a===b||(Math.min(a.length,b.length)>=5?lev(a,b)<=Math.max(1,Math.floor(Math.min(a.length,b.length)/6)):a.length>=3&&srt(a)===srt(b)&&lev(a,b)===1);
function newItem(L,t,done,o){const id=uid();L.items[id]={id,t,done:!!done,dt:done?ymd():'',due:'',o,u:now()};return L.items[id]}
function addPic(L,sk){if(!sk||!sk.img)return;L.pics=(L.pics||[]).concat({id:uid(),img:sk.img,t:now()}).slice(-8)}
function fromPhoto(L,lines,sk){
 if(!L){let title='',it=lines;const f=lines[0];
  /* the first line names the list, unless it's the first of several headings (then it's a section) */
  const heads=lines.filter(x=>x.head).length;
  if(f&&!f.bul&&lines.length>1&&(/:$/.test(f.t)||lines.slice(1).filter(x=>x.bul).length>=Math.max(1,(lines.length-1)/2))&&(!f.head||heads<2||lines[1]&&lines[1].head)){title=f.t.replace(/:$/,'').trim();it=lines.slice(1)}
  L={id:uid(),title:(title||'List from a photo').slice(0,80),emoji:'📝',due:'',items:{},u:now(),mu:now(),created:now(),cloud:null};let sec='',k=0;it.forEach(x=>{if(x.head){const s={id:uid(),t:x.t.replace(/:$/,'').trim().slice(0,60)};(L.secs=L.secs||[]).push(s);sec=s.id;return}const n=newItem(L,x.t,x.done,k++);if(sec)n.s=sec});const nI=k,nS=(L.secs||[]).length;addPic(L,sk);lists().unshift(L);save();
  /* the reader's screens each step history back as they close; open the list once they have */
  let n=0;const open=()=>history.state&&history.state.ink&&n++<30?setTimeout(open,50):go('list/'+L.id);setTimeout(open,30);
  toast(`${nI} item${nI===1?'':'s'}${nS?` in ${nS} section${nS===1?'':'s'}`:''}, in the order written`);return}
 const before=JSON.parse(JSON.stringify(L.items)),pb=L.pics,ps=secsOf(L),seq=live(L).slice(),used=new Set();let at=-1,any=false,add=0,tick=0,had=0,curS='';
 const plan=lines.map(x=>{if(x.head)return{x,m:null};const k=nrm(x.t),m=seq.find(i=>!used.has(i.id)&&same(nrm(i.t),k));if(m){used.add(m.id);any=true}return{x,m}});
 if(!any)at=seq.length-1;
 for(const{x,m}of plan){if(x.head){const nm=x.t.replace(/:$/,'').trim().slice(0,60);let s=secsOf(L).find(y=>nrm(y.t)===nrm(nm));if(!s){s={id:uid(),t:nm};L.secs=[...secsOf(L),s];L.mu=now()}curS=s.id;continue}
  if(m){had++;at=seq.indexOf(m);if(m.s&&SEC(L,m.s))curS=m.s;if(x.done&&!m.done){m.done=true;m.dt=ymd();m.u=now();tick++}continue}
  const n=newItem(L,x.t,x.done,0);if(curS)n.s=curS;seq.splice(++at,0,n);add++}
 seq.forEach((i,k)=>{if(i.o!==k){i.o=k;i.u=now()}});addPic(L,sk);if(sk)L.mu=now();touch(L);render(false);
 toast([add&&`${add} added`,tick&&`${tick} ticked`,had&&`${had} already here`].filter(Boolean).join(' · ')||'Nothing new',()=>{for(const i of Object.values(L.items)){if(before[i.id])Object.assign(i,before[i.id]);else i.del=true;i.u=now()}L.pics=pb;if(L.secs!==ps){L.secs=ps;L.mu=now()}touch(L);render(false)})}
function picsHTML(L){const P=L.pics||[];if(!P.length)return'';
 return`<div class="st-h rv ls-dh"><h3>${P.length===1?'Photo':'Photos'}</h3><span class="data">${P.length}</span></div><section class="ls-pics rv">${P.map(p=>`<button class="ls-pic" data-act="lsPic" data-id="${L.id}" data-p="${p.id}" aria-label="Open the photo from ${esc(fmtDate(ymd(new Date(p.t))))}"><img src="${p.img}" alt="" loading="lazy"></button>`).join('')}</section>`}
Object.assign(ACT,{
 lsPhoto:d=>{const L=d.id?LBY(d.id):null;if(d.id&&(!L||ro(L)))return;closeSheet();if(!window.inkScan)return toast('The photo reader isn’t loaded yet. Try again in a moment.');
  let sk=null;inkScan({sketch:x=>{sk=x},html:h=>{const lines=photoLines(h);if(!lines.length)return toast('No list lines found in that text');fromPhoto(L,lines,sk);sk=null}},null,'read',
   {title:L?'Update “'+trunc(L.title,30)+'” from the photo':'A list from the photo',keep:'Save the photo at the end of the list',keepOn:false,ins:L?'Update list':'Make the list',textOnly:true})},
 lsPic:d=>{const L=LBY(d.id),p=L&&(L.pics||[]).find(x=>x.id===d.p);if(!p)return;
  openSheet(`<div class="data">${esc(L.title)}</div><h2 style="margin-top:6px">Photo · ${esc(fmtDate(ymd(new Date(p.t))))}</h2><img class="ls-pfull" src="${p.img}" alt="The photo the list was read from"><div class="actions">${ro(L)?'':`<button class="btn danger" data-act="lsPicRm" data-id="${L.id}" data-p="${p.id}">${ic('trash')}Remove photo</button>`}<button class="btn pri" data-act="close">Done</button></div>`)},
 lsPicRm:d=>{const L=LBY(d.id);if(!L)return;const P=L.pics||[],i=P.findIndex(x=>x.id===d.p);if(i<0)return;const[p]=P.splice(i,1);save();closeSheet();render(false);toast('Photo removed',()=>{P.splice(i,0,p);L.pics=P;save();render(false)})}});
window.LISTS_PHOTO={photoLines,fromPhoto};

/* ---------------- sections, notes, start fresh, sort, move, suggestions (2026-11-18) ----------------
   Sections live on the list (L.secs [{id,t}], in order) and an item names its own (i.s), so everything that counts
   items (Home, Find, the widget, the assistant) still sees only real items. i.n is a short note under an item.
   L.rep ('day' | 'week' | 'month') unticks everything (nothing is deleted) when a new day, week (from Monday) or month
   starts; L.rst is the period it last did. All of it travels with a shared list; older versions just ignore it. */
Object.assign(IC,{lsfresh:'<path d="M4.5 11a7.5 7.5 0 0 1 13-4.2L19.5 9"/><path d="M19.5 4.5V9H15"/><path d="M19.5 13a7.5 7.5 0 0 1-13 4.2L4.5 15"/><path d="M4.5 19.5V15H9"/>'});
const secsOf=L=>Array.isArray(L.secs)?L.secs:[];
const SEC=(L,id)=>id?secsOf(L).find(x=>x.id===id):null;
const REP={day:'Every day',week:'Every week',month:'Every month'};
const perOf=(k,d=new Date())=>k==='day'?ymd(d):k==='week'?(x=>{x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)})(new Date(d)):k==='month'?ymd(d).slice(0,7):'';
const nextTxt=k=>{const d=new Date();if(k==='day')return'tomorrow';if(k==='week'){d.setDate(d.getDate()+((8-d.getDay())%7||7));return d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}d.setMonth(d.getMonth()+1,1);return fmtDate(ymd(d))};
function fresh(L){if(!L||!REP[L.rep]||ro(L))return;const p=perOf(L.rep);if(L.rst===p)return;const had=!!L.rst;L.rst=p;L.mu=now();let n=0;
 if(had)live(L).forEach(i=>{if(i.done){i.done=false;i.dt='';i.u=now();n++}});touch(L);
 if(n&&cur.p==='list'&&cur.id===L.id)setTimeout(()=>toast(`A fresh start: ${n} item${n===1?'':'s'} unticked`),300)}
/* the open items: those in no section first, then each section with its own header (fold, add, more) */
function openHTML(L,open,I,r){const S_=secsOf(L),ids=new Set(S_.map(x=>x.id)),fold=st(L).fold||{},to=st(L).to,loose=open.filter(i=>!i.s||!ids.has(i.s));
 let h=(loose.length||!S_.length?`<section class="ls-list rv">${loose.map(i=>itemRow(L,i)).join('')}</section>`:'')+(!open.length&&I.length?'<p class="small muted ls-none rv">Everything’s done 🎉</p>':'');
 h+=S_.map(x=>{const its=open.filter(i=>i.s===x.id),f=!!fold[x.id]&&to!==x.id;
  return`<section class="ls-sec rv${f?' fold':''}" data-sid="${x.id}"><div class="ls-sh"><button class="ls-sf" data-act="lsSecFold" data-id="${L.id}" data-s="${x.id}" aria-expanded="${!f}">${ic('next')}<b>${esc(x.t)}</b>${its.length?`<span class="data">${its.length}</span>`:''}</button>${r?'':`<button class="ibtn sm ls-sb" data-act="lsSecAdd" data-id="${L.id}" data-s="${x.id}" aria-label="Add to ${esc(x.t)}" title="Add to ${esc(x.t)}">${ic('plus')}</button><button class="ibtn sm ls-sb" data-act="lsSecMenu" data-id="${L.id}" data-s="${x.id}" aria-label="More for ${esc(x.t)}" title="Rename, move, remove">${ic('more')}</button>`}</div>
  ${f?'':`<div class="ls-list">${its.map(i=>itemRow(L,i)).join('')}${!r&&to===x.id?`<form class="ls-add ls-sadd" data-form="lsAdd" data-id="${L.id}" data-s="${x.id}" autocomplete="off"><input name="t" maxlength="200" placeholder="Add to ${esc(x.t)}" aria-label="Add to ${esc(x.t)}" enterkeyhint="done" list="lsSug"><button type="button" class="btn ls-cam" data-act="lsToClear" data-id="${L.id}" aria-label="Done adding here" title="Done">${ic('check')}</button><button class="btn pri" aria-label="Add">${ic('plus')}</button></form>`:!its.length&&!r?`<button class="ls-sempty" data-act="lsSecAdd" data-id="${L.id}" data-s="${x.id}">Nothing here yet. Add something</button>`:''}</div>`}</section>`}).join('');
 if(!r)h+=`<div class="ls-more rv"><button class="link small" data-act="lsSecNew" data-id="${L.id}">${ic('plus')}Add a section</button></div>`;
 return h}
/* typing suggestions: things you've had on this list (ticked or cleared) and on your other lists, newest first */
function sugHTML(L){const open=new Set(live(L).filter(i=>!i.done).map(i=>nrm(i.t))),seen=new Set(),out=[];
 for(const l of [L,...lists().filter(x=>x!==L)]){for(const i of Object.values(l.items||{}).sort((a,b)=>(b.u||0)-(a.u||0))){const k=nrm(i.t);if(!k||open.has(k)||seen.has(k))continue;seen.add(k);out.push(i.t);if(out.length>=80)break}if(out.length>=80)break}
 return out.length?`<datalist id="lsSug">${out.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`:''}
function textOf(L){const S_=secsOf(L),ids=new Set(S_.map(x=>x.id)),I=live(L),row=i=>`${i.done?'☑':'☐'} ${i.t}${i.due?' · '+fmtDate(i.due):''}${i.n?'\n    '+i.n:''}`;
 const parts=[I.filter(i=>!i.s||!ids.has(i.s)).map(row).join('\n'),...S_.map(x=>{const its=I.filter(i=>i.s===x.id);return its.length?`\n${x.t}:\n`+its.map(row).join('\n'):''})];
 return`${L.title}${L.due?' (by '+fmtDate(L.due)+')':''}\n`+parts.filter(Boolean).join('\n').replace(/^\n+/,'')}
const focusIn=sel=>setTimeout(()=>{const i=document.querySelector(sel);if(i){i.focus({preventScroll:true});i.scrollIntoView({block:'center',behavior:typeof reduced==='function'&&reduced()?'auto':'smooth'})}},80);
function secMove(d,dir){const L=LBY(d.id);if(!L||ro(L))return;const A=secsOf(L).slice(),k=A.findIndex(x=>x.id===d.s),j=k+dir;if(k<0||j<0||j>=A.length)return;[A[k],A[j]]=[A[j],A[k]];L.secs=A;L.mu=now();closeSheet();touch(L);render(false)}
Object.assign(ACT,{
 lsSecNew:d=>{const L=LBY(d.id);if(!L||ro(L))return;const it=d.i&&L.items[d.i];
  openSheet(`<div class="data">${esc(L.emoji||'📝')} ${esc(L.title)}</div><h2 style="margin-top:6px">New section</h2><p class="small muted">${it?`“${esc(it.t)}” goes into it.`:'Group items under a heading, like Produce or Dairy.'}</p><form data-form="lsSec" data-id="${L.id}" data-i="${it?it.id:''}"><div class="field"><label>Name</label><input name="t" maxlength="60" required placeholder="Produce" autocomplete="off"></div><div class="actions"><button class="btn pri">Add section</button></div></form>`);setTimeout(()=>{const i=$('#sheet input[name=t]');if(i)i.focus()},260)},
 lsSecAdd:d=>{const L=LBY(d.id);if(!L||ro(L))return;st(L).to=d.s;render(false);focusIn('.ls-sadd input')},
 lsToClear:d=>{const L=LBY(d.id);if(!L)return;st(L).to='';render(false)},
 lsSecFold:d=>{const L=LBY(d.id);if(!L)return;const f=st(L).fold||(st(L).fold={});f[d.s]=!f[d.s];if(f[d.s]&&st(L).to===d.s)st(L).to='';render(false)},
 lsSecMenu:d=>{const L=LBY(d.id),x=L&&SEC(L,d.s);if(!x||ro(L))return;const A=secsOf(L),k=A.indexOf(x),n=live(L).filter(i=>i.s===x.id&&!i.done).length,m=Object.values(L.items).filter(i=>!i.del&&i.s===x.id).length,b=(a,icon,label,cls='')=>`<button class="${cls}" data-act="${a}" data-id="${L.id}" data-s="${x.id}">${ic(icon)}${label}</button>`;
  openSheet(`<div class="data">Section</div><h2 style="margin-top:6px">${esc(x.t)}</h2><form data-form="lsSecRen" data-id="${L.id}" data-s="${x.id}"><div class="field"><label>Name</label><div class="ls-ren"><input name="t" maxlength="60" required value="${esc(x.t)}" autocomplete="off" aria-label="Section name"><button class="btn">Rename</button></div></div></form>
  <div class="menu">${k>0?b('lsSecUp','up','Move up'):''}${k<A.length-1?b('lsSecDown','down','Move down'):''}${n?b('lsSecTick','check',`Tick everything in it · ${n}`):''}${b('lsSecDel','trash',m?`Remove the section (its ${m} item${m===1?'':'s'} stay)`:'Remove the section','danger')}</div>`)},
 lsSecUp:d=>secMove(d,-1),lsSecDown:d=>secMove(d,1),
 lsSecTick:d=>{const L=LBY(d.id);if(!L||ro(L))return;const its=live(L).filter(i=>i.s===d.s&&!i.done);its.forEach(i=>{i.done=true;i.dt=ymd();i.u=now()});closeSheet();touch(L);render(false);
  toast(`${its.length} ticked`,()=>{its.forEach(i=>{i.done=false;i.dt='';i.u=now()});touch(L);render(false)})},
 lsSecDel:d=>{const L=LBY(d.id),x=L&&SEC(L,d.s);if(!x||ro(L))return;const k=secsOf(L).indexOf(x),its=Object.values(L.items).filter(i=>i.s===x.id);
  L.secs=secsOf(L).filter(y=>y!==x);its.forEach(i=>{delete i.s;i.u=now()});L.mu=now();if(st(L).to===x.id)st(L).to='';closeSheet();touch(L);render(false);
  toast(`Section “${esc(x.t)}” removed`,()=>{const A=secsOf(L).slice();A.splice(k,0,x);L.secs=A;its.forEach(i=>{i.s=x.id;i.u=now()});L.mu=now();touch(L);render(false)})},
 lsNote:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i||ro(L))return;
  openSheet(`<div class="data">Note</div><h2 style="margin-top:6px">${esc(i.t)}</h2><form data-form="lsNote" data-id="${L.id}" data-i="${i.id}"><div class="field"><textarea name="n" rows="3" maxlength="300" placeholder="Size, brand, how many, where to find it" aria-label="Note">${esc(i.n||'')}</textarea></div><div class="actions">${i.n?`<button type="button" class="btn ghost" data-act="lsNoteRm" data-id="${L.id}" data-i="${i.id}">Remove note</button>`:''}<button class="btn pri">Save</button></div></form>`);setTimeout(()=>{const t=$('#sheet textarea');if(t)t.focus()},260)},
 lsNoteRm:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i)return;delete i.n;i.u=now();closeSheet();touch(L);render(false)},
 lsItemSec:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i||ro(L))return;const on=s=>(SEC(L,i.s)?i.s:'')===s,b=(s,t)=>`<button data-act="lsItemSecSet" data-id="${L.id}" data-i="${i.id}" data-s="${s}" aria-pressed="${on(s)}">${on(s)?ic('check'):ic('list')}${esc(t)}</button>`;
  openSheet(`<div class="data">Section</div><h2 style="margin-top:6px">${esc(i.t)}</h2><div class="menu">${secsOf(L).map(x=>b(x.id,x.t)).join('')}${secsOf(L).length?b('','No section'):''}<button data-act="lsSecNew" data-id="${L.id}" data-i="${i.id}">${ic('plus')}New section…</button></div>`)},
 lsItemSecSet:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i)return;const was=i.s;if(SEC(L,d.s))i.s=d.s;else delete i.s;if(i.s!==was){i.o=Math.max(0,...Object.values(L.items).map(x=>x.o||0))+1;i.u=now();touch(L)}closeSheet();render(false)},
 lsItemTo:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i)return;const O=lists().filter(x=>x!==L&&!x.del&&!ro(x)),r=ro(L);
  openSheet(`<div class="data">${r?'Copy':'Move or copy'}</div><h2 style="margin-top:6px">${esc(i.t)}</h2>${O.length?`<div class="ls-tol">${O.map(x=>`<div class="ls-tor"><span class="ls-toe">${esc(x.emoji||'📝')}</span><b>${esc(x.title)}</b><button class="btn sm ghost" data-act="lsItemToDo" data-id="${L.id}" data-i="${i.id}" data-to="${x.id}" data-op="copy">Copy</button>${r?'':`<button class="btn sm" data-act="lsItemToDo" data-id="${L.id}" data-i="${i.id}" data-to="${x.id}" data-op="move">Move</button>`}</div>`).join('')}</div>`:'<p class="muted">You don’t have another list yet.</p>'}
  <div class="actions"><button class="btn ghost" data-act="lsItemToDo" data-id="${L.id}" data-i="${i.id}" data-to="new" data-op="${r?'copy':'move'}">${ic('plus')}${r?'Copy':'Move'} to a new list</button></div>`)},
 lsItemToDo:d=>{const L=LBY(d.id),i=L&&L.items[d.i];if(!i)return;const mv=d.op==='move'&&!ro(L);let T=null;
  if(d.to==='new'){T={id:uid(),title:'New list',emoji:L.emoji||'📝',due:'',items:{},u:now(),mu:now(),created:now(),cloud:null};lists().unshift(T)}else T=LBY(d.to);if(!T||ro(T))return;
  const o=Math.max(-1,...Object.values(T.items).map(x=>x.o||0))+1,id=uid();T.items[id]={id,t:i.t,done:!!i.done,dt:i.dt||'',due:i.due||'',o,u:now(),...(i.n?{n:i.n}:{})};
  if(mv){i.del=true;i.u=now();touch(L)}touch(T);closeSheet();
  const undo=()=>{T.items[id].del=true;T.items[id].u=now();if(mv){i.del=false;i.u=now();touch(L)}touch(T);render(false)};
  if(d.to==='new'){go('list/'+T.id);setTimeout(()=>{const t=document.querySelector('.ls-title');if(t){t.focus();t.select()}},380)}else render(false);
  toast(`${mv?'Moved':'Copied'} to ${esc(T.title)}`,undo)},
 lsFresh:d=>{const L=LBY(d.id);if(!L||ro(L))return;const n=live(L).filter(i=>i.done).length,c=(v,t)=>`<button type="button" class="chip${(REP[L.rep]?L.rep:'')===v?' on':''}" data-act="lsRep" data-id="${L.id}" data-v="${v}" aria-pressed="${(REP[L.rep]?L.rep:'')===v}">${t}</button>`;
  openSheet(`<div class="data">Start fresh</div><h2 style="margin-top:6px">${esc(L.title)}</h2><p class="small muted">For lists you go through again and again, like packing, a weekly shop or a morning routine. Everything is unticked; nothing is deleted.</p>
  <div class="actions left">${n?`<button class="btn" data-act="lsUntick" data-id="${L.id}">${ic('lsfresh')}Untick everything now · ${n}</button>`:'<span class="small muted">Nothing is ticked right now.</span>'}</div>
  <div class="field ls-fr"><label>By itself</label><div class="chips">${c('','Never')}${c('day','Every day')}${c('week','Every week')}${c('month','Every month')}</div><small class="muted">${REP[L.rep]?`Next fresh start: ${esc(nextTxt(L.rep))}.`:'Weeks start on Monday.'}${L.cloud?' Everyone on the shared list gets it.':''}</small></div>`)},
 lsRep:d=>{const L=LBY(d.id);if(!L||ro(L))return;L.rep=REP[d.v]?d.v:'';L.rst=L.rep?perOf(L.rep):'';L.mu=now();touch(L);render(false);ACT.lsFresh(d);toast(L.rep?`Starts fresh ${REP[L.rep].toLowerCase()}`:'No automatic fresh start')},
 lsUntick:d=>{const L=LBY(d.id);if(!L||ro(L))return;const D=live(L).filter(i=>i.done),P=D.map(i=>i.dt);D.forEach(i=>{i.done=false;i.dt='';i.u=now()});closeSheet();touch(L);render(false);
  toast(`${D.length} unticked`,()=>{D.forEach((i,k)=>{i.done=true;i.dt=P[k];i.u=now()});touch(L);render(false)})},
 lsSort:d=>{const L=LBY(d.id);if(!L||ro(L))return;const b=(k,t,x)=>`<button data-act="lsSortDo" data-id="${L.id}" data-k="${k}">${ic(x)}${t}</button>`;
  openSheet(`<div class="data">Sort</div><h2 style="margin-top:6px">${esc(L.title)}</h2><p class="small muted">Inside each section. Pinned items stay on top.</p><div class="menu">${b('az','A to Z','list')}${b('date','By date, soonest first','cal')}${b('rev','Reverse the order','down')}</div>`)},
 lsSortDo:d=>{const L=LBY(d.id);if(!L||ro(L))return;const I=live(L).slice().sort((a,b)=>(a.o||0)-(b.o||0)),before=I.map(i=>[i,i.o]);
  const key={az:(a,b)=>a.t.localeCompare(b.t,undefined,{sensitivity:'base',numeric:true}),date:(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')}[d.k];
  (key?I.slice().sort(key):I.slice().reverse()).forEach((i,k)=>{if(i.o!==k){i.o=k;i.u=now()}});closeSheet();touch(L);render(false);
  toast(d.k==='az'?'Sorted A to Z':d.k==='date'?'Sorted by date':'Order reversed',()=>{before.forEach(([i,o])=>{i.o=o;i.u=now()});touch(L);render(false)})}});
Object.assign(FORM,{
 lsSec:f=>{const L=LBY(f.dataset.id);if(!L||ro(L))return;const t=String(new FormData(f).get('t')||'').trim().slice(0,60);if(!t)return;if(secsOf(L).length>=30)return toast('A list can have up to 30 sections');
  const x={id:uid(),t};L.secs=[...secsOf(L),x];L.mu=now();const it=f.dataset.i&&L.items[f.dataset.i];
  if(it){it.s=x.id;it.o=Math.max(0,...Object.values(L.items).map(y=>y.o||0))+1;it.u=now()}else st(L).to=x.id;
  closeSheet();touch(L);render(false);if(!it)focusIn('.ls-sadd input')},
 lsSecRen:f=>{const L=LBY(f.dataset.id),x=L&&SEC(L,f.dataset.s);if(!x||ro(L))return;const t=String(new FormData(f).get('t')||'').trim().slice(0,60);if(!t)return;
  L.secs=secsOf(L).map(y=>y===x?{...y,t}:y);L.mu=now();closeSheet();touch(L);render(false)},
 lsNote:f=>{const L=LBY(f.dataset.id),i=L&&L.items[f.dataset.i];if(!i||ro(L))return;const n=String(new FormData(f).get('n')||'').replace(/\s+/g,' ').trim().slice(0,300);
  if(n)i.n=n;else delete i.n;i.u=now();closeSheet();touch(L);render(false)}});

/* typing in an item or the title saves as you go (and syncs a moment later) */
document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset)return;
 if(t.dataset.lsedit){const L=LBY(cur.id),i=L&&L.items[t.dataset.lsedit];if(!i||ro(L))return;i.t=t.value.slice(0,200);i.u=now();L.u=now();clearTimeout(st(L).sv);st(L).sv=setTimeout(()=>{save();if(L.cloud)pushSoon(L)},500)}
 else if(t.dataset.lstitle){const L=LBY(t.dataset.lstitle);if(!L||ro(L))return;L.title=t.value.slice(0,80)||'List';L.mu=now();clearTimeout(st(L).sv);st(L).sv=setTimeout(()=>{save();if(L.cloud)pushSoon(L)},500)}});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t&&t.dataset&&(t.dataset.lsedit||t.dataset.lstitle)){e.preventDefault();t.blur()}});
/* ---------------- home-screen "Cards" widget ----------------
   The Android Cards widget shows lists, goals or notes as swipeable cards (or one of them as a full list) and
   lets you tick, add, edit, pin, move, delete and set reminders right there. widgetCards() is its data (sent with
   the rest of the widget payload); taps are queued natively as {k:'wi',src,id,i,op,...} and applied here by
   cardsFromQueue() the next time the app opens. Reminders set from the widget are armed on the phone at once and
   kept by listAlarms() so the app's own schedule doesn't drop them. */
const pinFirst=(a,b)=>(!!b.pin-!!a.pin);
window.widgetCards=()=>{const A=g=>areaOf(g.area).k;
 const L=lists().filter(l=>!l.del).slice(0,24).map(l=>({id:l.id,t:l.title,e:l.emoji||'📝',a:lColor(l),sh:!!l.cloud,due:l.due||'',
  items:live(l).slice(0,40).map(i=>({id:i.id,t:i.t,done:!!i.done,due:i.due||'',pin:!!i.pin,rem:+i.rem||0}))}));
 const Gs=active().sort((a,b)=>(b.pinned-a.pinned)||(a.priority-b.priority)).slice(0,24).map(g=>({id:g.id,t:g.title,e:'🎯',a:g.color||A(g),p:pct(g),due:g.targetDate||'',
  items:[...g.steps].sort(pinFirst).slice(0,40).map(s=>({id:s.id,t:s.title,done:!!s.done,due:s.due||'',time:s.time||'',pin:!!s.pin,rem:s.done?0:(reminderAt(s)||0)})),
  subs:kids(g).filter(k=>k.status==='active').slice(0,8).map(k=>({id:k.id,t:k.title,p:pct(k)}))}));
 const T=threads().filter(t=>t.status!=='done').sort((a,b)=>thrLast(b)-thrLast(a)).slice(0,24).map(t=>({id:t.id,t:t.title,e:(thrUps(t)[0]?thrTag(thrUps(t)[0].k)[1]:'🧵'),a:'learning',
  items:[...thrUps(t)].sort(pinFirst).slice(0,30).map(u=>({id:u.id,t:trunc(u.x||'',160),e:thrTag(u.k)[1],at:u.t,pin:!!u.pin}))}));
 return{cards:{lists:L,goals:Gs,thr:T}}};
/* reorder: swap with the neighbour (or go to the top) among items in the same pinned group */
function moveIn(arr,x,op){const same=arr.filter(y=>!!y.pin===!!x.pin),k=same.indexOf(x);if(k<0)return false;
 const j=op==='up'?k-1:op==='down'?k+1:0;if(op==='top'){if(k===0)return false;same.splice(k,1);same.unshift(x)}else{if(j<0||j>=same.length)return false;[same[k],same[j]]=[same[j],same[k]]}
 const other=arr.filter(y=>!!y.pin!==!!x.pin);return x.pin?[...same,...other]:[...other,...same]}
window.cardsFromQueue=a=>{const op=String(a.op||''),t=String(a.t||'').trim().slice(0,200),at=+a.at||0,ts=+a.ts||Date.now();
 if(a.src==='list'){const Lx=LBY(a.id);if(!Lx||ro(Lx))return false;const it=Lx.items[a.i];
  if(op==='add'){if(!t||Lx.items[a.i])return false;const o=Math.max(0,...Object.values(Lx.items).map(i=>i.o||0))+1;Lx.items[a.i]={id:a.i,t,done:false,due:'',o,u:now()};touch(Lx);return true}
  if(!it||it.del)return false;
  if(op==='done'||op==='undone'){it.done=op==='done';it.dt=it.done?ymd():'';}
  else if(op==='pin'||op==='unpin')it.pin=op==='pin';
  else if(op==='del')it.del=true;
  else if(op==='edit'){if(!t)return false;it.t=t}
  else if(op==='rem')it.rem=at>0?at:0;
  else if(op==='up'||op==='down'||op==='top'){const all=live(Lx).sort((x,y)=>(x.o||0)-(y.o||0));all.forEach((y,k)=>{if(y.o!==k){y.o=k;y.u=now()}});const sub=all.filter(y=>(y.s||'')===(it.s||'')),slots=sub.map(y=>y.o),arr=moveIn(sub,it,op);if(!arr)return false;arr.forEach((y,k)=>{if(y.o!==slots[k]){y.o=slots[k];y.u=now()}})}
  else return false;
  it.u=now();touch(Lx);return true}
 if(a.src==='goal'){const g=G(a.id);if(!g)return false;const s=g.steps.find(x=>x.id===a.i);
  if(op==='add'){if(!t||s)return false;g.steps.push({id:a.i,title:t,due:'',time:'',remind:'',reminded:false,note:'',repeat:'',done:false,doneAt:null});return true}
  if(!s)return false;
  if(op==='done'||op==='undone'){if(!!s.done!==(op==='done'))ACT.toggleStep({g:g.id,s:s.id});return true}
  if(op==='pin'||op==='unpin')s.pin=op==='pin';
  else if(op==='del'){g.steps=g.steps.filter(x=>x!==s);S.entries=S.entries.filter(e=>e.sid!==s.id)}
  else if(op==='edit'){if(!t)return false;s.title=t}
  else if(op==='rem'){if(at>0){const d=new Date(at);s.remind='c';s.remDate=ymd(d);s.remTime=`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;s.reminded=false}else s.remind=''}
  else if(op==='up'||op==='down'||op==='top'){const arr=moveIn([...g.steps].sort(pinFirst),s,op);if(!arr)return false;g.steps=arr}
  else return false;
  g.u=now();return true}
 if(a.src==='thr'){const th=TH(a.id);if(!th)return false;
  if(op==='add')return thrFromQueue({k:'thr',id:th.id,x:t,kind:a.kind||'note',t:ts,qid:a.i});
  const u=(th.ups||[]).find(x=>x.id===a.i);if(!u||u.del)return false;
  if(op==='pin'||op==='unpin')u.pin=op==='pin';else if(op==='del')u.del=1;else if(op==='edit'){if(!t)return false;u.x=t}else return false;
  u.u=now();th.u=u.u;return true}
 return false};
/* list-item reminders for the phone's alarm list (set in the widget or kept from an earlier one) */
window.listAlarms=(t0,out)=>{lists().forEach(Lx=>live(Lx).forEach(i=>{if(!i.done&&+i.rem>t0)out.push({at:+i.rem,title:i.t,body:`${Lx.emoji||'📝'} ${Lx.title}`,k:'litem',l:Lx.id,i:i.id,rp:false})}))};
/* an item's ⋯ menu: done, pin, move, date, reminder, delete (the same things the home-screen Cards widget can do) */
const remTxt=at=>`${dueTxt(ymd(new Date(at)))} ${fmtTime(`${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}`)}`;
const dtLocal=at=>{const d=new Date(at);return`${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`};
ACT.lsItemMenu=d=>{const[Lx,i]=IT(d);if(!i||ro(Lx))return;const b=(op,icon,label,cls='')=>`<button class="${cls}" data-act="lsItemDo" data-id="${Lx.id}" data-i="${i.id}" data-op="${op}">${ic(icon)}${label}</button>`;
 const same=live(Lx).filter(y=>!!y.pin===!!i.pin&&(y.s||'')===(i.s||'')),k=same.indexOf(i),rem=+i.rem>Date.now()?+i.rem:0;
 openSheet(`<div class="data">${esc(Lx.emoji||'📝')} ${esc(Lx.title)}</div><h2 style="margin-top:6px">${esc(i.t)}</h2><div class="menu">
 ${b(i.done?'undone':'done','check',i.done?'Mark not done':'Mark done')}
 ${b(i.pin?'unpin':'pin','pin',i.pin?'Unpin':'Pin to the top')}
 ${k>0?b('top','up','Move to the top')+b('up','up','Move up'):''}${k>=0&&k<same.length-1?b('down','down','Move down'):''}
 <button data-act="lsItemDue" data-id="${Lx.id}" data-i="${i.id}">${ic('cal')}${i.due?'Change the date · '+esc(dueTxt(i.due)):'Set a date'}</button>
 <button data-act="lsRemSheet" data-id="${Lx.id}" data-i="${i.id}">${ic('bell')}${rem?'Reminder · '+esc(remTxt(rem)):'Remind me…'}</button>
  <button data-act="lsNote" data-id="${Lx.id}" data-i="${i.id}">${ic('edit')}${i.n?'Edit the note':'Add a note'}</button>
  <button data-act="lsItemSec" data-id="${Lx.id}" data-i="${i.id}">${ic('list')}${i.s&&SEC(Lx,i.s)?'Section · '+esc(SEC(Lx,i.s).t):'Put in a section'}</button>
  <button data-act="lsItemTo" data-id="${Lx.id}" data-i="${i.id}">${ic('copy')}Move or copy to another list</button>
 ${b('del','trash','Delete','danger')}</div>`)};
ACT.lsItemDo=d=>{const[Lx,i]=IT(d);if(!i)return;closeSheet();if(d.op==='del'){ACT.lsDel(d);return}
 if(cardsFromQueue({src:'list',id:Lx.id,i:i.id,op:d.op,at:0})){if(d.op==='rem')toast('Reminder removed')}render(false)};
ACT.lsRemSheet=d=>{const[Lx,i]=IT(d);if(!i||ro(Lx))return;const rem=+i.rem>Date.now()?+i.rem:0,soon=Date.now()+36e5;
 openSheet(`<h2>Remind me</h2><p class="muted" style="margin-top:4px">${esc(i.t)}</p><form data-form="lsRem" data-id="${Lx.id}" data-i="${i.id}"><div class="field"><label>When</label><input type="datetime-local" name="at" required value="${dtLocal(rem||soon)}" min="${dtLocal(Date.now())}"></div>
 <div class="actions">${rem?`<button type="button" class="btn ghost" data-act="lsItemDo" data-id="${Lx.id}" data-i="${i.id}" data-op="rem">No reminder</button>`:''}<button class="btn pri">Save</button></div></form>`)};
FORM.lsRem=f=>{const L0=LBY(f.dataset.id),i=L0&&L0.items[f.dataset.i];if(!i)return;const v=new FormData(f).get('at'),at=v?new Date(v).getTime():0;
 if(!(at>Date.now()))return toast('Pick a time that hasn’t passed yet');closeSheet();cardsFromQueue({src:'list',id:L0.id,i:i.id,op:'rem',at});if(typeof askNotif==='function')askNotif();render(false);toast('Reminder set for '+esc(remTxt(at)))};
ACT.lsPin=d=>{const[Lx,i]=IT(d);if(!i||ro(Lx))return;i.pin=!i.pin;i.u=now();touch(Lx);render(false)};
/* people opening a shared list link go straight to it, not the first-run welcome */
if(typeof welcome==='function'){const _w=welcome;welcome=function(){if(/^#\/list\/j~/.test(location.hash))return;return _w.apply(this,arguments)}}

/* this file can arrive after the app has already routed: catch up */
if(typeof booted!=='undefined'&&booted&&/^#\/lists?(\/|$)/.test(location.hash)&&!/^lists?$/.test(cur.p))route();
document.head.insertAdjacentHTML('beforeend',`<style>
.ls-tpl{display:flex;flex-wrap:wrap;gap:8px}
.lc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.lc{display:flex;flex-direction:column;gap:8px;min-height:264px;height:100%;box-sizing:border-box;padding:20px 20px 18px;border-radius:26px;text-decoration:none;color:var(--t-fg);position:relative;overflow:hidden;transition:transform .45s var(--spring)}
.lc:hover{transform:translateY(-3px)}.lc:active{transform:scale(.98)}
.lc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.lc-top .data{color:var(--t-mut)}
.lc-e{font-size:30px;line-height:1;margin-top:auto}
.lc .lc-t{font:800 clamp(24px,3.2vw,30px)/.95 var(--f-display);text-transform:uppercase;color:var(--t-fg);overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:0}
.lc-i{list-style:none;margin:2px 0 0;padding:0;display:grid;gap:3px;font-size:13.5px;color:var(--t-mut)}
.lc-i li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lc-i li::before{content:'';display:inline-block;width:9px;height:9px;border:1.5px solid currentColor;border-radius:50%;margin-right:8px;vertical-align:-1px}
.lc .pbar{margin-top:6px}.lc-f{min-height:1em;color:var(--t-mut)}
.ls-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.ls-c .ls-ring .fg{stroke:var(--c)}
.ls-hero.tint{color:var(--t-fg)}.ls-hero.tint .data,.ls-hero.tint .ls-st{color:var(--t-mut)}
.ls-hero.tint .ls-title{color:var(--t-fg)}.ls-hero.tint .ls-emo{background:rgba(255,255,255,.18);border-color:transparent}
.ls-hero.tint .ls-dc{background:rgba(0,0,0,.12);border-color:transparent;color:var(--t-fg)}
.ls-hero.tint .ls-bar{background:var(--t-barbg,rgba(0,0,0,.15))}.ls-hero.tint .ls-bar i{background:var(--t-bar,var(--t-fg))}
.menu .mbtn{display:flex;align-items:center;gap:12px;cursor:pointer}
.ls-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.ls-c{display:flex;align-items:center;gap:14px;padding:16px;border-radius:22px;background:var(--surface);border:1px solid var(--line);color:var(--text);text-decoration:none;transition:transform .45s var(--spring),border-color .2s}
.ls-c:hover{border-color:var(--line-2);transform:translateY(-2px)}.ls-c:active{transform:scale(.98)}
.ls-ring{position:relative;flex:none;width:52px;height:52px;display:grid;place-items:center}
.ls-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ls-ring circle{fill:none;stroke-width:3.5}.ls-ring .bg{stroke:var(--line)}.ls-ring .fg{stroke:var(--accent);stroke-linecap:round;transition:stroke-dashoffset .6s var(--spring)}
.ls-ring em{font-style:normal;font-size:22px}
.ls-ct{flex:1;min-width:0;display:grid;gap:3px}.ls-ct b{font-size:16px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ls-ct small{color:var(--muted);font-size:13px}
.ls-sh{flex:none;color:var(--muted)}.ls-sh svg{width:16px;height:16px}
.ls-due.late,.ls-dc.late{color:#FF7A7A}.ls-due.soon,.ls-dc.soon{color:var(--acc-ink,var(--accent))}
.ls-hero{padding:22px;border-radius:28px;margin-top:6px}
.ls-hrow{display:flex;align-items:center;gap:12px}
.ls-emo{flex:none;width:52px;height:52px;border-radius:16px;border:1px solid var(--line);background:var(--surface-2);font-size:26px;display:grid;place-items:center;cursor:pointer}
.ls-title{flex:1;min-width:0;background:none;border:0;padding:4px 0;height:auto;font:700 clamp(24px,6vw,34px)/1.1 var(--f-display);color:var(--text);box-shadow:none}
.ls-title:focus{outline:none;box-shadow:inset 0 -2px 0 var(--accent)}
.ls-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:14px}
.ls-st{font:600 11px var(--f-mono);letter-spacing:.04em;color:var(--muted);text-transform:uppercase}.ls-st.err{color:#FF7A7A}.ls-st.saving{color:var(--acc-ink,var(--accent))}
.ls-dc{display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font:500 13px var(--f-body);color:var(--text);cursor:pointer}
.ls-dc svg{width:14px;height:14px}
.ls-bar{height:6px;border-radius:6px;background:var(--line);margin-top:16px;overflow:hidden}.ls-bar i{display:block;height:100%;background:var(--accent);border-radius:6px;transition:width .6s var(--spring)}
.ls-add{display:flex;gap:10px;margin:16px 0 6px}.ls-add input{flex:1;min-width:0;height:52px;border-radius:16px;font-size:16px}.ls-add .btn{height:52px;width:52px;padding:0;justify-content:center;border-radius:16px}.ls-add .ls-cam{flex:none;color:var(--muted)}.ls-add .ls-cam svg{width:21px;height:21px}
.ls-sec{margin-top:20px}
.ls-sh{display:flex;align-items:center;gap:4px;padding:0 2px 2px 0;border-bottom:1px solid var(--line)}
.ls-sf{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px;border:0;background:none;color:var(--text);font:inherit;text-align:left;cursor:pointer;border-radius:10px}
.ls-sf svg{width:16px;height:16px;color:var(--muted);flex:none;transform:rotate(90deg);transition:transform .25s var(--spring)}.ls-sec.fold .ls-sf svg{transform:none}
.ls-sf b{font:700 13px/1.2 var(--f-body);text-transform:uppercase;letter-spacing:.08em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ls-sf .data{color:var(--muted);flex:none}
#view .ls-sb{flex:none;color:var(--muted);background:none;border-color:transparent;box-shadow:none}#view .ls-sb:hover{color:var(--text);background:var(--surface)}
.ls-sec .ls-list{padding-top:4px}
.ls-sempty{display:block;width:100%;min-height:44px;padding:0 8px;border:0;background:none;color:var(--muted);font:inherit;font-size:13.5px;text-align:left;cursor:pointer;border-radius:12px}
.ls-sadd{margin:8px 0 4px}.ls-sadd input,.ls-sadd .btn{height:46px}.ls-sadd .btn{width:46px}
.ls-more{margin:16px 0 4px}.ls-more .link{display:inline-flex;align-items:center;gap:6px;min-height:40px}.ls-more svg{width:15px;height:15px}
.ls-tw{flex:1;min-width:0;display:flex;flex-direction:column}.ls-tw .ls-t{width:100%;height:30px;margin-top:4px}
.ls-n{align-self:stretch;max-width:100%;padding:0 4px 6px;border:0;background:none;color:var(--muted);font:inherit;font-size:12.5px;line-height:1.35;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.ls-it.done .ls-n{opacity:.7}
.ls-fr{margin-top:20px}
.ls-ren{display:flex;gap:8px}.ls-ren input{flex:1;min-width:0}
.ls-tol{display:flex;flex-direction:column;gap:8px;margin-top:10px}.ls-tor{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;border:1px solid var(--line);border-radius:14px}.ls-tor b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.ls-toe{font-size:20px;line-height:1}
.ls-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin:4px 0 8px}.ls-pic{padding:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface);aspect-ratio:3/4;cursor:pointer}.ls-pic img{width:100%;height:100%;object-fit:cover;display:block}
.ls-pfull{display:block;width:100%;max-height:62vh;object-fit:contain;border-radius:14px;background:var(--surface-2,var(--surface));margin-top:12px}
.ls-list{display:grid;gap:2px;margin-top:8px}
.ls-it{display:flex;align-items:center;gap:10px;padding:6px 6px 6px 8px;border-radius:16px;transition:background .2s,opacity .35s}
.ls-it:hover{background:var(--surface)}
.ls-ck{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid var(--line-2);background:none;display:grid;place-items:center;cursor:pointer;color:transparent;padding:0;transition:background .25s,border-color .25s,transform .35s var(--spring)}
.ls-ck svg{width:16px;height:16px;stroke-width:3}.ls-ck:active{transform:scale(.85)}
.ls-it.done .ls-ck{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ls-t{flex:1;min-width:0;background:none;border:0;box-shadow:none;height:40px;padding:0 4px;font:500 16px var(--f-body);color:var(--text);border-radius:8px}
.ls-t:focus{outline:none;background:var(--surface-2)}
.ls-it.done .ls-t{color:var(--muted);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--muted) 60%,transparent)}
#view .ls-ib{background:none;border-color:transparent;box-shadow:none;width:36px;height:36px;color:var(--muted);opacity:.7}#view .ls-ib:hover{color:var(--text);background:var(--surface-2)}.ls-ib{}#view .ls-it:hover .ls-ib,#view .ls-it:focus-within .ls-ib{opacity:1}

.ls-pin{flex:none;background:none;border:0;padding:0 2px;font-size:14px;cursor:pointer}.ls-rem{flex:none;font-size:11px;color:var(--muted);white-space:nowrap}
.ls-dh{margin-top:24px}.ls-none{padding:12px 8px}
.ls-emos{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:14px}
</style>`);
})();
