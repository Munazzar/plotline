/* Conversations: every chat with the assistant, every talk in conversation mode and every Ask thread is kept as its own
   conversation. The Conversations page lists them (search, Chats / Talks / Ask), opens one to read it through, continues
   it in chat or out loud, and turns it into things in the plan (goals, habits, routines, lists, a journal entry,
   reminders) with the AI. Stored on this device only (IndexedDB key "convs"), never synced, up to 300 conversations. */
(()=>{
'use strict';
const nm=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const tr=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const clip=(s,n)=>{s=String(s||'').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const strip=a=>{a=String(a||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'');return window.AIX?AIX.hideActs(a):a};
Object.assign(IC,{hist:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/>'});

/* ---------------- the store ---------------- */
let CV=[],saveT=0;
DB.get('convs').then(v=>{if(Array.isArray(v))CV=[...CV,...v.filter(c=>c&&c.id&&!CV.some(x=>x.id===c.id))].sort((a,b)=>b.t1-a.t1);if(cur.p==='chats')render(false)}).catch(()=>{});
const persist=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{DB.set('convs',CV.slice(0,300)).catch(()=>{})},400)};
const KIND={chat:['Chat','chat'],talk:['Talk','live'],ask:['Ask','ai']};
function sync(id,k,turns){turns=(turns||[]).filter(t=>t&&t.q&&String(t.a||'').trim());if(!turns.length)return id||null;
 let c=id&&CV.find(x=>x.id===id);if(!c){c={id:id||uid(),k:KIND[k]?k:'chat',t0:turns[0].t||Date.now(),t1:Date.now(),title:'',turns:[]};CV.unshift(c)}
 const sig=turns.map(t=>(t.id||'')+':'+String(t.a).length).join(',');if(c.sig===sig)return c.id;c.sig=sig;
 const m=new Map(c.turns.map(t=>[t.id,t]));
 turns.forEach((t,i)=>{const tid=t.id||'t'+i,old=m.get(tid);m.set(tid,{id:tid,q:clip(t.q,1200),a:clip(strip(t.a),5000),t:(old&&old.t)||t.t||Date.now()})});
 c.turns=[...m.values()].sort((a,b)=>a.t-b.t).slice(-200);c.t1=Date.now();if(!c.named)c.title=tr(c.turns[0].q,70);
 CV=[c,...CV.filter(x=>x!==c)];persist();if(cur.p==='chats'&&!document.activeElement?.matches('input,textarea'))listPaint();return c.id}
const get=id=>CV.find(c=>c.id===id)||null;
window.CONV={sync,get,list:()=>CV.slice()};

/* Ask threads are conversations too: save each one once an answer finishes */
if(typeof insRun==='function'){const _r=insRun;insRun=async function(){const R=IN.res;try{return await _r.apply(this,arguments)}finally{try{
 if(R&&R.turns)R.cid=sync(R.cid,'ask',R.turns.filter(t=>t.done&&!t.err&&!t.off).map((t,i)=>({id:'a'+i,q:t.q,a:t.a})))}catch(e){}}}}

/* ---------------- the page ---------------- */
const CF={q:'',k:''};
const when=t=>{const d=new Date(t),n=new Date(),day=Math.floor((new Date(n.toDateString())-new Date(d.toDateString()))/864e5),hm=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return day<=0?hm:day===1?'Yesterday · '+hm:day<7?d.toLocaleDateString([],{weekday:'long'})+' · '+hm:d.toLocaleDateString([],{month:'short',day:'numeric',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})};
const grp=t=>{const d=new Date(t),n=new Date(),day=Math.floor((new Date(n.toDateString())-new Date(d.toDateString()))/864e5);
 return day<=0?'Today':day===1?'Yesterday':day<7?'This week':d.toLocaleDateString([],{month:'long',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})};
function hits(){const q=CF.q.trim().toLowerCase();return CV.filter(c=>(!CF.k||c.k===CF.k)&&(!q||c.title.toLowerCase().includes(q)||c.turns.some(t=>t.q.toLowerCase().includes(q)||t.a.toLowerCase().includes(q))))}
function listHTML(){const L=hits();if(!CV.length)return`<div class="empty rv"><h3>No conversations yet</h3><p class="muted">Chats with ${esc(nm())}, talks out loud and Ask threads show up here, so you can read them again, carry on, or turn them into goals, habits and lists.</p><div class="actions"><button class="btn pri" data-act="convNewTalk">${ic('live')}Start talking</button><button class="btn" data-act="convNewChat">${ic('chat')}Start a chat</button></div></div>`;
 if(!L.length)return`<p class="muted cv-none">Nothing matches${CF.q?` “${esc(CF.q)}”`:''}.</p>`;
 let g='',o='';L.forEach(c=>{const h=grp(c.t1);if(h!==g){g=h;o+=`<h4 class="cv-g">${esc(h)}</h4>`}const last=c.turns[c.turns.length-1],K=KIND[c.k]||KIND.chat;
  o+=`<button class="cv-i" data-act="convOpen" data-id="${c.id}"><span class="cv-ic k-${c.k}">${ic(K[1])}</span><span class="cv-b"><b>${esc(c.title||'Conversation')}</b><small>${esc(tr(last?last.a:'',110))}</small><em>${K[0]} · ${when(c.t1)} · ${c.turns.length} message${c.turns.length===1?'':'s'}</em></span></button>`});return o}
function listPaint(){const l=$('#cvList');if(l)l.innerHTML=listHTML()}
function vChats(id){if(id)return vChat(id);
 return`<header class="ph"><div><h1>Conversations</h1><div class="data">${CV.length?`${CV.length} saved on this device`:'Chats and talks with '+esc(nm())}</div></div><div class="ph-r"><button class="ibtn" data-act="convNewTalk" aria-label="Start talking" title="Start talking">${ic('live')}</button><button class="ibtn" data-act="convNewChat" aria-label="New chat" title="New chat">${ic('plus')}</button>${gear()}</div></header>
 ${CV.length?`<div class="cv-tools rv"><label class="cv-s">${ic('search','ico-s')}<input id="cvQ" type="search" placeholder="Search conversations" value="${esc(CF.q)}" aria-label="Search conversations"></label>
 <div class="chips cv-k">${[['','All'],['chat','Chats'],['talk','Talks'],['ask','Ask']].map(([k,n])=>`<button class="chip ${CF.k===k?'on':''}" data-act="convKind" data-k="${k}">${n}</button>`).join('')}</div></div>`:''}
 <div class="cv-l rv" id="cvList">${listHTML()}</div>`}
function vChat(id){const c=get(id);if(!c)return`<header class="ph"><div><a class="link" href="#/chats">${ic('back','ico-s')} Conversations</a><h1>Not found</h1></div></header><p class="muted">This conversation was deleted or is on another device.</p>`;
 const K=KIND[c.k]||KIND.chat;
 return`<div class="crumb"><a href="#/chats" class="ibtn" data-act="navBack" aria-label="Back">${ic('back')}</a><div class="ph-r"><button class="ibtn" data-act="convMore" data-id="${c.id}" aria-label="More">${ic('more')}</button></div></div>
 <h2 class="cv-t">${esc(c.title||'Conversation')}</h2><p class="cv-m">${K[0]} · ${when(c.t0)} · ${c.turns.length} message${c.turns.length===1?'':'s'}</p>
 <div class="cv-x rv">${c.turns.map(t=>`<div class="cv-q"><p>${esc(t.q).replace(/\n/g,'<br>')}</p></div><div class="cv-a"><span class="cv-av" aria-hidden="true"></span><div class="ai-md">${window.AIX&&AIX.md?AIX.md(t.a):'<p>'+esc(t.a).replace(/\n+/g,'<br>')+'</p>'}</div></div>`).join('')}</div>
 <div class="cv-bar"><button class="btn pri cv-mkb" data-act="convMake" data-id="${c.id}">${ic('ai')}Make something from this</button><button class="btn" data-act="convChat" data-id="${c.id}">${ic('chat')}Continue</button><button class="btn" data-act="convTalk" data-id="${c.id}" aria-label="Continue out loud">${ic('live')}Talk</button></div>`}
VIEWS.chats=vChats;
document.addEventListener('input',e=>{if(e.target.id!=='cvQ')return;CF.q=e.target.value;listPaint()});

/* ---------------- make something from a conversation ---------------- */
const MK=[['any','Whatever fits','ai'],['goal','Goals','goals'],['habit','Habits','check'],['routine','A routine','rep'],['list','A list','checklist'],['journal','Journal entry','journal'],['reminder','Reminders','bell']];
const MKD={any:'whatever would really help: goals, habits, a routine, lists, reminders or a journal note',goal:'goals (things to achieve)',habit:'habits (things to do regularly)',routine:'one routine (a short sequence of steps)',list:'one or two lists with their items',journal:'one journal entry that captures what was said and decided, in the user’s own voice',reminder:'reminders with when'};
const transcript=(c,n)=>{let o='';for(const t of c.turns){o+=`ME: ${t.q}\n${nm().toUpperCase()}: ${t.a}\n\n`}return o.length>n?'…'+o.slice(-n):o};
let MKR={id:'',k:'',busy:false,acts:[],err:'',ctl:null};
function makeHTML(){const c=get(MKR.id);if(!c)return'';const ready=window.AIX&&AIX.ready();
 return`<h2>Make something from this</h2><p class="small muted">${esc(nm())} reads the conversation and suggests things for your plan. Nothing is added until you tap it.</p>
 <div class="chips cv-mk">${MK.map(([k,n,i])=>`<button class="chip ${MKR.k===k?'on':''}" data-act="convMk" data-k="${k}" ${MKR.busy?'disabled':''}>${ic(i,'ico-s')}${n}</button>`).join('')}</div>
 ${!ready?`<p class="small">Suggestions need the AI. You can still save the whole conversation to your journal.</p>${window.AIX?AIX.modelCard('make'):''}`:''}
 <div id="cvMkOut">${MKR.busy?`<p class="small muted cv-busy"><i></i>Reading the conversation…</p>`:MKR.err?`<p class="small err">${esc(MKR.err)}</p>`:MKR.acts.length?AIX.actChips(MKR.acts)+(MKR.acts.filter(a=>a.st!=='done').length>1?`<div class="actions left"><button class="btn sm pri" data-act="convAll">Add all</button></div>`:''):MKR.k&&!MKR.busy?`<p class="small muted">Nothing to suggest from this one. Try another kind.</p>`:''}</div>
 <div class="actions left cv-mk-a"><button class="btn sm ghost" data-act="convJournal" data-id="${c.id}">${ic('journal')}Save whole conversation to journal</button></div>`}
const mkPaint=()=>{const s=$('#sheet .cv-mkw');if(s)s.innerHTML=makeHTML()};
async function mkRun(k){const c=get(MKR.id);if(!c||MKR.busy)return;if(!(window.AIX&&AIX.ready()))return toast('Set up the AI first');
 MKR={...MKR,k,busy:true,acts:[],err:'',ctl:new AbortController()};mkPaint();let out='';
 try{await AIX.chat([{role:'system',content:`You turn a conversation into things for the user's plan in the Plotline app. Read it and suggest ${MKD[k]||MKD.any}, based only on what was actually said. Reply with ACTION lines only, one per line, at most 6, nothing else.\n${AIX.ACT_SYS.replace(/At most two ACTION lines[^\n]*$/,'')}${k!=='any'?`\nUse only the type "${k==='journal'?'journal':k}".`:''}`},{role:'user',content:`CONVERSATION\n${transcript(c,6000)}`}],x=>{out+=x},{max_tokens:420,temperature:.3,ctl:MKR.ctl});
  const P=AIX.parseActs(out.replace(/<think>[\s\S]*?(<\/think>|$)/g,''),6);MKR.acts=AIX.keepActs(P.acts)}
 catch(e){MKR.err=String(e&&e.message||e)}
 MKR.busy=false;mkPaint()}
function saveJournal(c){const html=c.turns.map(t=>`<p><b>${esc(t.q)}</b></p><p>${esc(t.a).replace(/\n+/g,'<br>')}</p>`).join('');
 S.entries.push({id:uid(),t:Date.now(),type:'note',goalId:null,title:'Conversation · '+tr(c.title,60),text:c.turns.map(t=>t.q+'\n'+t.a).join('\n\n'),html,mood:'',private:false,sid:null,img:null});save();toast('Saved to your journal')}

/* ---------------- actions ---------------- */
const leave=()=>{try{if(window.PLOT_ASSIST)PLOT_ASSIST.close()}catch(e){}try{if(document.getElementById('live')&&ACT.lvEnd)ACT.lvEnd()}catch(e){}};
Object.assign(ACT,{
 convGo:()=>{leave();go('chats')},
 convOpen:d=>go('chats/'+d.id),
 convKind:d=>{CF.k=d.k||'';render(false)},
 convNewChat:()=>{if(ACT.asClear)ACT.asClear();if(ACT.asOpen)ACT.asOpen()},
 convNewTalk:()=>{if(ACT.asClear)ACT.asClear();if(window.liveOpen)liveOpen()},
 convChat:d=>{if(window.PLOT_ASSIST&&PLOT_ASSIST.resume(d.id)){if(ACT.asOpen)ACT.asOpen()}},
 convTalk:d=>{if(window.liveOpen)liveOpen(null,{resume:d.id})},
 convMake:d=>{MKR={id:d.id,k:'',busy:false,acts:[],err:'',ctl:null};openSheet(`<div class="cv-mkw">${makeHTML()}</div>`)},
 convMk:d=>mkRun(d.k),
 convAll:()=>{let n=0;MKR.acts.forEach(a=>{if(a.st==='done')return;try{AIX.doAct(a);n++}catch(e){}});mkPaint();toast(`Added ${n} thing${n===1?'':'s'} to your plan`)},
 convJournal:d=>{const c=get(d.id);if(c){saveJournal(c);closeSheet()}},
 convMore:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>${esc(c.title||'Conversation')}</h2><div class="cv-menu">
  <button class="btn" data-act="convRename" data-id="${c.id}">${ic('edit')}Rename</button>
  <button class="btn" data-act="convCopy" data-id="${c.id}">${ic('copy')}Copy the conversation</button>
  <button class="btn" data-act="convJournal" data-id="${c.id}">${ic('journal')}Save to journal</button>
  <button class="btn danger" data-act="convDel" data-id="${c.id}">${ic('trash')}Delete</button></div>`)},
 convRename:d=>{const c=get(d.id);if(!c)return;openSheet(`<h2>Rename</h2><form data-form="convName" data-id="${c.id}"><div class="field"><input name="t" maxlength="80" value="${esc(c.title)}" aria-label="Name"></div><div class="actions"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn pri">Save</button></div></form>`);setTimeout(()=>$('#sheet input[name=t]')?.select(),80)},
 convCopy:async d=>{const c=get(d.id);if(!c)return;toast(await copyText(transcript(c,1e6).trim())?'Copied':'Copy failed');closeSheet()},
 convDel:d=>{const c=get(d.id);if(!c)return;askConfirm('Delete this conversation?','It’s removed from this device. Anything you made from it stays in your plan.','Delete',()=>{CV=CV.filter(x=>x!==c);persist();closeSheet();if(cur.p==='chats'&&cur.id)go('chats');else render(false);toast('Conversation deleted')})}
});
Object.assign(FORM,{convName:(f,e)=>{const id=(f.dataset||{}).id||f.getAttribute('data-id'),c=get(id),t=tr(new FormData(f).get('t'),80);if(c&&t){c.title=t;c.named=1;persist()}closeSheet();render(false)}});
/* the Ask page gets a history button next to New chat */
if(typeof vAsk==='function'){const _v=vAsk;vAsk=function(){return _v.apply(this,arguments).replace('<div class="ph-r">',`<div class="ph-r"><button class="ibtn" data-act="convGo" aria-label="Conversation history" title="Conversations">${ic('hist')}</button>`)};VIEWS.ask=vAsk}

const css=document.createElement('style');css.textContent=`
.cv-tools{display:flex;flex-direction:column;gap:10px;margin:4px 0 14px}
.cv-s{display:flex;align-items:center;gap:8px;padding:0 14px;height:44px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--muted)}.cv-s input{flex:1;min-width:0;border:0;background:none;color:var(--text);font:500 15px var(--f-body);outline:none;height:100%}
.cv-k{margin:0}
.cv-g{margin:18px 4px 8px;font:700 12px var(--f-body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cv-i{display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;padding:12px 14px;margin:0 0 8px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;transition:transform .2s}.cv-i:active{transform:scale(.98)}
.cv-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;flex:none;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}.cv-ic svg{width:18px;height:18px}.cv-ic.k-talk{background:color-mix(in srgb,var(--c-learning,var(--accent)) 20%,transparent);color:var(--c-learning,var(--accent))}
.cv-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.cv-b b{font-size:15px;line-height:1.3;overflow-wrap:anywhere}.cv-b small{color:var(--muted);font-size:13px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.cv-b em{font-style:normal;font-size:11.5px;color:var(--muted);opacity:.85;margin-top:2px}
.cv-none{margin:20px 4px}
.cv-t{font:800 clamp(24px,6.5vw,36px)/1.05 var(--f-display);text-transform:uppercase;margin:6px 0 6px;overflow-wrap:anywhere}.cv-m{margin:0 0 18px;font:600 11.5px var(--f-body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cv-x{display:flex;flex-direction:column;gap:10px;padding-bottom:24px}
.cv-q{align-self:flex-end;max-width:85%;padding:10px 14px;border-radius:18px 18px 6px 18px;background:color-mix(in srgb,var(--accent) 18%,var(--surface))}.cv-q p,.cv-a p{margin:0;font-size:15px;line-height:1.5;overflow-wrap:anywhere}
.cv-a{display:flex;gap:10px;align-items:flex-start;max-width:92%}.cv-av{width:22px;height:22px;border-radius:50%;flex:none;margin-top:2px;background:conic-gradient(from 200deg,var(--accent),var(--c-learning,var(--accent)),var(--c-health,var(--accent)),var(--accent))}
.cv-bar{position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));z-index:15;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 -16px;padding:14px 16px 10px;background:linear-gradient(to top,var(--bg) 80%,transparent)}.cv-bar .btn{min-width:0;justify-content:center;white-space:nowrap}.cv-bar .cv-mkb{grid-column:1/-1}
@media(min-width:900px){.cv-bar{bottom:16px}}
.cv-mk{margin:12px 0}.cv-mk .chip{display:inline-flex;align-items:center;gap:6px}.cv-mk .ico-s{width:14px;height:14px}
.cv-busy{display:flex;align-items:center;gap:8px}.cv-busy i{width:14px;height:14px;border-radius:50%;border:2px solid var(--accent);border-top-color:transparent;animation:mmSpin .8s linear infinite}
.cv-mk-a{margin-top:14px}.cv-menu{display:flex;flex-direction:column;gap:8px;margin-top:12px}.cv-menu .btn{justify-content:flex-start}
`;document.head.appendChild(css);
})();
