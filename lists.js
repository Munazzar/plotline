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
const live=L=>Object.values(L.items||{}).filter(i=>!i.del).sort((a,b)=>(a.o||0)-(b.o||0));
const stats=L=>{const I=live(L),d=I.filter(i=>i.done).length;return{n:I.length,d,p:I.length?Math.round(d/I.length*100):0}};
const dueTxt=ds=>{if(!ds)return'';const k=daysUntil(ds);return k===0?'Today':k===1?'Tomorrow':k===-1?'Yesterday':k<0?`${-k} days late`:k<7?dayName(ds):fmtDate(ds)};
const dueCl=(ds,done)=>!ds||done?'':daysUntil(ds)<0?' late':daysUntil(ds)<=1?' soon':'';
const EMO=['📝','🛒','🎒','✈️','🏠','🎁','📦','🧳','🍳','💼','🎉','🧹'];
const TPL={blank:['New list','📝',[]],groceries:['Groceries','🛒',['Milk','Eggs','Bread','Fruit','Vegetables']],packing:['Packing','🎒',['Passport / ID','Phone charger','Toothbrush','Clothes','Medicines']],todo:['To-do','✅',[]]};
function newList(k){const[t,e,its]=TPL[k]||TPL.blank,L={id:uid(),title:t,emoji:e,due:'',items:{},u:now(),mu:now(),created:now(),cloud:null};its.forEach((x,i)=>{const id=uid();L.items[id]={id,t:x,done:false,due:'',o:i,u:now()}});lists().unshift(L);save();return L}
function touch(L){L.u=now();save();if(L.cloud)pushSoon(L)}
const ST=new Map(),st=L=>{let x=ST.get(L.id);if(!x){x={};ST.set(L.id,x)}return x};

/* ---------------- cloud ---------------- */
const payload=L=>({k:'list',title:L.title,emoji:L.emoji,due:L.due,color:L.color||'',img:L.img||'',mu:L.mu,items:L.items});
const linkOf=L=>`${C().webBase()}#/list/j~${L.cloud.doc}~${C().toUrl(L.cloud.key)}`;
const ro=L=>!!(L.cloud&&!C().signedIn());
function merge(L,r){let ch=false;for(const[id,it]of Object.entries(r.items||{})){const a=L.items[id];if(!a||(it.u||0)>(a.u||0)){L.items[id]=it;ch=true}}
 if((r.mu||0)>(L.mu||0)){L.title=r.title;L.emoji=r.emoji;L.due=r.due||'';L.color=r.color||'';L.img=r.img||'';L.mu=r.mu;ch=true}return ch}
let pT={};function pushSoon(L,d=250){clearTimeout(pT[L.id]);pT[L.id]=setTimeout(()=>push(L),d)}
async function push(L){const s=st(L);if(!L.cloud||ro(L))return;if(s.pushing){s.again=1;return}s.pushing=1;paintSt(L,'saving');
 try{for(let i=0;i<4;i++){const enc=await encJ(L.cloud.key,payload(L));const r=await C().cput(L.cloud.doc,{owner:L.cloud.owner,kind:'edit',enc,u:now(),v:1},L.cloud.ut||'new');
   if(r.conflict){await pull(L,true);continue}L.cloud.ut=r.ut;L.cloud.sent=now();s.pushedAt=now();save();paintSt(L,'ok');if(window.rtPing)rtPing(L.cloud.doc);return}throw new Error('Too many people saving at once, retrying')}
 catch(e){paintSt(L,'err');toast(esc(e.message||String(e)))}finally{s.pushing=0;if(s.again){s.again=0;pushSoon(L,50)}}}
async function pull(L,force){const d=await C().cget(L.cloud.doc);if(!d){L.cloud.gone=1;save();paintSt(L,'err');return}
 if(!force&&d.ut===L.cloud.ut)return;const r=await decJ(L.cloud.key,d.enc);L.cloud.owner=d.owner;L.cloud.ut=d.ut;st(L).remote=now();
 const ch=merge(L,r);const mineNewer=Object.values(L.items).some(i=>(i.u||0)>(L.cloud.sent||0))||(L.mu||0)>(L.cloud.sent||0);
 if(ch){save();if(cur.p==='list'&&cur.id===L.id||cur.p==='lists')repaint()}
 if(mineNewer&&!ro(L))pushSoon(L,200);paintSt(L,'ok')}
/* redraw the open list in place, keeping whatever you're typing (and the cursor) */
function repaint(){const a=document.activeElement,k=a&&a.dataset?(a.dataset.lsedit?'[data-lsedit="'+a.dataset.lsedit+'"]':a.dataset.lstitle?'[data-lstitle]':a.closest&&a.closest('.ls-add')?'.ls-add input':null):null;
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
/* Share: invite people (it shows up in their Plotline, like shared habits) or copy a link */
function shareMenu(L){const sh=typeof shareChip==='function'&&shareChip('list',L.id);
 openSheet(`<div class="data">Share</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2><div class="acct-opts">
 <button class="acct-o" data-act="lsInvite" data-id="${L.id}"><b>${ic('user','ico-s')} Invite people</b><small>Add their Google email. The list shows up in their Plotline by itself, with a notification on Android.</small></button>
 <button class="acct-o" data-act="lsLink" data-id="${L.id}"><b>${ic('link','ico-s')} Copy a link</b><small>Anyone you send it to can open it after signing in.</small></button>
 ${sh?`<button class="acct-o" data-act="lsGroup" data-id="${L.id}"><b>${ic('share','ico-s')} Who’s in it</b><small>See everyone’s progress and react.</small></button>`:''}</div>`)}
function showLink(L){const url=linkOf(L);openSheet(`<div class="data">Share</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2><p class="small muted">Anyone with this link who signs in to Plotline can tick and add items. It’s end-to-end encrypted; the key is only in the link.</p>
 <div class="wb-row"><input id="lslink" readonly value="${esc(url)}" aria-label="Link"><button class="btn sm" data-act="lsCopy">${ic('copy')}Copy</button></div>
 <div class="actions"><button class="btn pri" data-act="lsSend">${ic('send')}Send…</button></div>`)}
async function joinData(doc,k){const have=lists().find(l=>l.cloud&&l.cloud.doc===doc);if(have)return have.id;
 const d=await C().cget(doc);if(!d)throw new Error('That list isn’t shared any more');const r=await decJ(k,d.enc);if(!r||r.k!=='list')throw new Error('That link isn’t a list');
 const L={id:uid(),title:r.title||'Shared list',emoji:r.emoji||'📝',due:r.due||'',color:r.color||'',img:r.img||'',items:r.items||{},mu:r.mu||0,u:now(),created:now(),cloud:{doc,key:k,owner:d.owner,ut:d.ut,sent:now()}};
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
function vLists(){const L=lists(),open=L.filter(l=>{const s=stats(l);return!s.n||s.d<s.n}),done=L.filter(l=>{const s=stats(l);return s.n&&s.d===s.n});
 return`<header class="ph"><div><h1>Lists</h1><div class="data">${L.length?`${open.length} open${done.length?` · ${done.length} done`:''}`:'Checklists you can share'}</div></div><div class="ph-r">${L.some(l=>l.cloud&&!l.cloud.gone)?`<span class="live-tag" id="lslive" ${[...W8.values()].some(w=>w.on)?'':'hidden'}><i></i>Live</span>`:''}<button class="ibtn" data-act="lsJoin" aria-label="Open a shared link" title="Open a shared link">${ic('link')}</button><button class="ibtn" data-act="lsNew" data-k="blank" aria-label="New list" title="New list">${ic('plus')}</button>${gear()}</div></header>
 <div class="bar rv"><div class="ls-tpl">${Object.entries(TPL).map(([k,[t,e]])=>`<button class="chip" data-act="lsNew" data-k="${k}">${e} ${k==='blank'?'Blank list':esc(t)}</button>`).join('')}</div>${L.length?iconSeg('lists',[['grid','grid','Grid'],['h','horz','Carousel'],['list','list','List']],lview()):''}</div>
 ${L.length?`${body(open,'open')}${done.length?`<div class="st-h rv" style="margin-top:28px"><h3>Done</h3><span class="data">${done.length}</span></div>${body(done,'done')}`:''}`
 :`<div class="empty rv"><p>No lists yet. Start one above, or open a link someone sent you.</p></div>`}`}
function itemRow(L,i){const r=ro(L);return`<div class="ls-it${i.done?' done':''}" data-iid="${i.id}"><button class="ls-ck" data-act="lsTog" data-id="${L.id}" data-i="${i.id}" role="checkbox" aria-checked="${!!i.done}" aria-label="${esc(i.t)}" ${r?'disabled':''}>${ic('check')}</button>
 <input class="ls-t" value="${esc(i.t)}" data-lsedit="${i.id}" maxlength="200" aria-label="Item" ${r?'readonly':''}>
 ${i.due?`<button class="ls-dc${dueCl(i.due,i.done)}" data-act="lsItemDue" data-id="${L.id}" data-i="${i.id}" ${r?'disabled':''}>${esc(dueTxt(i.due))}</button>`:r?'':`<button class="ibtn sm ls-ib" data-act="lsItemDue" data-id="${L.id}" data-i="${i.id}" aria-label="Set a date" title="Set a date">${ic('cal')}</button>`}
 ${r?'':`<button class="ibtn sm ls-ib ls-x" data-act="lsDel" data-id="${L.id}" data-i="${i.id}" aria-label="Remove item" title="Remove">${ic('trash')}</button>`}</div>`}
function vList(id){if(id&&id.startsWith('j~')){const[,doc,key]=id.split('~');setTimeout(()=>join(doc,key),0);return`<header class="ph"><div><h1>List</h1><div class="data">Opening the shared list…</div></div></header>`}
 const L=LBY(id);if(!L)return`<header class="ph"><div><h1>List</h1></div></header><div class="empty rv"><p>This list isn’t on this device.</p><div class="actions"><a class="btn pri" href="#/lists">All lists</a></div></div>`;
 const I=live(L),open=I.filter(i=>!i.done),done=I.filter(i=>i.done),s=stats(L),r=ro(L),showDone=st(L).showDone!==false;
 return`<div class="crumb"><a href="#/lists" class="ibtn" aria-label="Back to lists">${ic('back')}</a><div class="ph-r">${L.cloud?`<span class="live-tag" id="lslive" ${isOn(L)?'':'hidden'}><i></i>Live</span>`:''}<button class="ibtn" data-act="lsShare" data-id="${L.id}" aria-label="${L.cloud?'Share link':'Share'}" title="${L.cloud?'Share link':'Share'}">${ic('share')}</button><button class="ibtn" data-act="lsMenu" data-id="${L.id}" aria-label="More">${ic('more')}</button></div></div>
 <section class="ls-hero tint rv" style="${lvar(L)}"><div class="ls-hrow"><button class="ls-emo" data-act="lsEmoji" data-id="${L.id}" aria-label="Change icon" ${r?'disabled':''}>${esc(L.emoji||'📝')}</button><input class="ls-title" value="${esc(L.title)}" data-lstitle="${L.id}" maxlength="80" aria-label="List name" ${r?'readonly':''}></div>
 <div class="ls-meta"><span class="data">${s.n?`${s.d} of ${s.n} done`:'No items yet'}</span>${typeof shareChip==='function'?shareChip('list',L.id):''}${L.cloud?`<span class="ls-st" id="lsst">${L.cloud.gone?'No longer shared':'Shared'}</span>`:''}<button class="ls-dc${dueCl(L.due,s.n&&s.d===s.n)}" data-act="lsDue" data-id="${L.id}" ${r?'disabled':''}>${ic('cal','ico-s')}${L.due?'Due '+esc(dueTxt(L.due)):'Add a deadline'}</button></div>
 <div class="ls-bar"><i style="width:${s.p}%"></i></div>${r?`<button class="btn sm pri" data-act="lsLogin" style="margin-top:14px">${ic('lock')}Sign in to edit</button>`:''}</section>
 ${r?'':`<form class="ls-add rv" data-form="lsAdd" data-id="${L.id}" autocomplete="off"><input name="t" maxlength="200" placeholder="Add an item" aria-label="Add an item" enterkeyhint="done"><button class="btn pri" aria-label="Add">${ic('plus')}</button></form>`}
 <section class="ls-list rv">${open.map(i=>itemRow(L,i)).join('')||(I.length?'<p class="small muted ls-none">Everything’s done 🎉</p>':'')}</section>
 ${done.length?`<div class="st-h rv ls-dh"><button class="link" data-act="lsDoneT" data-id="${L.id}">${showDone?'Hide':'Show'} done · ${done.length}</button>${r?'':`<button class="link" data-act="lsClear" data-id="${L.id}">Clear done</button>`}</div>${showDone?`<section class="ls-list rv">${done.map(i=>itemRow(L,i)).join('')}</section>`:''}`:''}`}
VIEWS.lists=vLists;VIEWS.list=vList;

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
 lsSend:()=>{const i=$('#lslink');if(!i)return;const msg='Join my list on Plotline: '+i.value;if(NATIVE){try{NATIVE.share('Plotline list',msg);return}catch(e){}}if(navigator.share)navigator.share({title:'Plotline list',url:i.value}).catch(()=>{});else ACT.lsCopy()},
 lsLogin:async()=>{if(typeof shReady==='function'&&await shReady()&&C().signedIn()){toast('Signed in. You can edit now');render(false)}},
 lsJoin:()=>openSheet(`<h2>Open a shared list</h2><form data-form="lsJoin"><div class="field"><label>Paste the link</label><input name="u" placeholder="https://…#/list/j~…" required></div><div class="actions"><button class="btn pri">Open</button></div></form>`),
 lsMenu:d=>{const L=LBY(d.id);if(!L)return;const own=L.cloud&&C()&&(()=>{try{return L.cloud.owner===(fbGet()||{}).uid}catch(e){return false}})();
  openSheet(`<div class="data">List</div><h2 style="margin-top:6px">${esc(L.emoji||'')} ${esc(L.title)}</h2>${ro(L)?'':colorRow('list',{...L,area:'personal',color:L.color||''})}<div class="menu">
  ${ro(L)?'':`<label class="mbtn">${ic('camera')}${L.img?'Change cover image':'Add a cover image'}<input type="file" accept="image/*" data-file="lsimg" data-id="${L.id}" hidden></label>${L.img?`<button data-act="lsImgRm" data-id="${L.id}">${ic('trash')}Remove cover image</button>`:''}`}
  <button data-act="lsShare" data-id="${L.id}">${ic('share')}${L.cloud?'Share link':'Share this list'}</button>
  <button data-act="lsCopyText" data-id="${L.id}">${ic('copy')}Copy as text</button>
  <button data-act="lsDup" data-id="${L.id}">${ic('copy')}Duplicate (fresh, nothing ticked)</button>
  <button class="danger" data-act="lsDelList" data-id="${L.id}">${ic('trash')}Delete${L.cloud?' from this device':''}</button>
  ${own?`<button class="danger" data-act="lsDelList" data-id="${L.id}" data-all="1">${ic('trash')}Delete for everyone</button>`:''}</div>`)},
 lsCopyText:async d=>{const L=LBY(d.id);if(!L)return;const t=`${L.title}${L.due?' (by '+fmtDate(L.due)+')':''}\n`+live(L).map(i=>`${i.done?'☑':'☐'} ${i.t}${i.due?' · '+fmtDate(i.due):''}`).join('\n');closeSheet();if(await copyText(t))toast('Copied')},
 lsDup:d=>{const L=LBY(d.id);if(!L)return;const N={id:uid(),title:L.title+' (copy)',emoji:L.emoji,due:'',items:{},u:now(),mu:now(),created:now(),cloud:null};live(L).forEach(i=>{const id=uid();N.items[id]={id,t:i.t,done:false,due:'',o:i.o,u:now()}});lists().unshift(N);save();closeSheet();go('list/'+N.id)},
 lsDelList:d=>{const L=LBY(d.id);if(!L)return;askConfirm(d.all?'Delete for everyone?':'Delete this list?',d.all?'The shared copy is deleted, so the link stops working for everyone.':`“${esc(L.title)}” is removed from this device${L.cloud?'. Others keep their copy.':'.'}`,'Delete',()=>{if(d.all&&L.cloud)C().cdel(L.cloud.doc,L.cloud.owner);S.lists=lists().filter(x=>x!==L);S.dead=S.dead||{};S.dead[L.id]=now();save();closeSheet();go('lists');toast('List deleted')})}});
Object.assign(FORM,{
 lsAdd:f=>{const L=LBY(f.dataset.id),inp=f.querySelector('input');const t=String(inp.value||'').trim();if(!L||!t)return;
  t.split(/\n|;/).map(x=>x.trim()).filter(Boolean).forEach(x=>{const id=uid(),o=Math.max(0,...Object.values(L.items).map(i=>i.o||0))+1;L.items[id]={id,t:x,done:false,due:'',o,u:now()}});
  touch(L);render(false);setTimeout(()=>{const i=document.querySelector('.ls-add input');if(i)i.focus()},30)},
 lsDue:f=>{const L=LBY(f.dataset.id);if(!L)return;L.due=new FormData(f).get('d')||'';L.mu=now();closeSheet();touch(L);render(false)},
 lsItemDue:f=>{const L=LBY(f.dataset.id),i=L&&L.items[f.dataset.i];if(!i)return;i.due=new FormData(f).get('d')||'';i.u=now();closeSheet();touch(L);render(false)},
 lsJoin:f=>{const m=/#\/list\/(j~[^~\s]+~[^\s#]+)/.exec(new FormData(f).get('u')||'');if(!m)return toast('That isn’t a Plotline list link');closeSheet();go('list/'+m[1])}});
/* typing in an item or the title saves as you go (and syncs a moment later) */
document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset)return;
 if(t.dataset.lsedit){const L=LBY(cur.id),i=L&&L.items[t.dataset.lsedit];if(!i||ro(L))return;i.t=t.value.slice(0,200);i.u=now();L.u=now();clearTimeout(st(L).sv);st(L).sv=setTimeout(()=>{save();if(L.cloud)pushSoon(L)},500)}
 else if(t.dataset.lstitle){const L=LBY(t.dataset.lstitle);if(!L||ro(L))return;L.title=t.value.slice(0,80)||'List';L.mu=now();clearTimeout(st(L).sv);st(L).sv=setTimeout(()=>{save();if(L.cloud)pushSoon(L)},500)}});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t&&t.dataset&&(t.dataset.lsedit||t.dataset.lstitle)){e.preventDefault();t.blur()}});
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
.ls-add{display:flex;gap:10px;margin:16px 0 6px}.ls-add input{flex:1;min-width:0;height:52px;border-radius:16px;font-size:16px}.ls-add .btn{height:52px;width:52px;padding:0;justify-content:center;border-radius:16px}
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

.ls-dh{margin-top:24px}.ls-none{padding:12px 8px}
.ls-emos{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:14px}
</style>`);
})();
