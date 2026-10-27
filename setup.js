/* ================= Guided setup =================
   First run walks through everything that makes Plotlines work well, one step at a time: reminders, the AI (the
   on-device model downloads in the background while you go on), the natural voice (also in the background; Heart, the
   most natural one, is picked for you), Hey Plot and the mic, connections for the agent, sync and the app lock.
   Every step is optional and shows a tick once it's done. The last step sums it all up, with what is still downloading.
   It opens after the welcome (and again from Settings › Guided setup), and replaces the old one-sheet checklist:
   setupFlow, setupHTML and setupPaint keep their names so the welcome, the tour prompt and boot work unchanged. */
(()=>{
'use strict';
const NA=!window.PLOT_DEMO&&window.PlotlineAssist||null;
const W={i:0};
const dev=()=>NATIVE?'phone':'device';
const pname=()=>(window.PLOT_ASSIST&&PLOT_ASSIST.aname)?PLOT_ASSIST.aname():'Plot';
const wakeW=()=>'Hey '+pname();
const notifOn=()=>{try{return NATIVE?NATIVE.notificationsGranted():('Notification'in window&&Notification.permission==='granted')}catch(e){return false}};
const exactNeed=()=>!!(NATIVE&&NATIVE.exactAlarms);
const exactOn=()=>{try{return!exactNeed()||NATIVE.exactAlarms()}catch(e){return true}};
const kk=()=>window.KOKORO?KOKORO.state():{st:'none'};
const asg=()=>S.settings.assist||{};
const aiName=()=>String(llmOf(insSet().llm)[1]).split(' · ')[0];
const aiHave=()=>!!(window.AIX&&AIX.have&&AIX.have());
const aiBusy=()=>!!(window.AIX&&AIX.busy&&AIX.busy());
const conns=()=>window.AGENT&&AGENT.names?AGENT.names():[];
const sw=(attr,k,t,sub,on,dis)=>`<label class="sw"><span>${t}<small>${sub}</small></span><input type="checkbox" data-${attr}="${k}" ${on?'checked':''} ${dis?'disabled':''}><i></i></label>`;
const row=(icn,t,x,right,done)=>`<div class="su-r${done?' done':''}"><span class="su-i">${done?ic('check'):ic(icn)}</span><div><b>${t}</b><small>${x}</small></div>${right||''}</div>`;

/* ---------------- the steps ----------------
   lead: one line under the title; body: the choices; main: the primary button [label, action] (it may start a
   download in the background and go on); sum: what the last step says about it; done: shows the tick */
const STEPS=[
 {k:'notif',ic:'bell',t:'Reminders',lead:'Plotlines reminds you about habits, steps and check-ins, and you can reply right from the notification.',
  done:()=>notifOn()&&exactOn(),sum:()=>notifOn()?(exactOn()?'On':'On · may arrive a few minutes late'):'Off',
  body:()=>row('bell','Notifications','Habits, steps, check-ins and timers.',notifOn()?'<span class="data">On</span>':`<button class="btn sm" data-act="setupDo" data-k="notif">Allow</button>`,notifOn())+
   (exactNeed()?row('timer','On-time reminders','Lets Android deliver them at the exact minute instead of a few minutes late.',exactOn()?'<span class="data">On</span>':`<button class="btn sm" data-act="setupDo" data-k="exact">Allow</button>`,exactOn()):''),
  main:()=>notifOn()?null:['Allow and continue',async()=>{askNotif();await sleep(900);next()}]},

 {k:'ai',ic:'ai',t:'Your AI',lead:`${pname()} can answer questions about your plan, write ideas, run the agent and talk with you. Pick where its AI runs.`,
  done:()=>{const e=insSet().engine;return e==='api'?!!insSet().url:e==='local'&&aiHave()},
  sum:()=>{const s=insSet();return s.engine==='api'?'Your AI server · '+esc(s.model||''):s.engine==='copy'?'Not picked yet · copy prompts to any AI':esc(aiName())+(aiBusy()?' · setting up now':aiHave()?' · ready on this '+dev():' · not downloaded yet')},
  body:()=>{const s=insSet(),e=s.engine;
   const card=(k,t,x,rec)=>`<button type="button" class="wz-c${e===k?' on':''}" data-act="wzEng" data-k="${k}" aria-pressed="${e===k}"><span class="wz-rd"></span><span><b>${t}${rec?' <em>Recommended</em>':''}</b><small>${x}</small></span></button>`;
   let h=`<div class="wz-cs" role="radiogroup" aria-label="Where the AI runs">${card('local','On this '+dev(),'Private and free. A model downloads once, then works offline. Nothing you say leaves the '+dev()+'.',1)}${card('api','Your own AI server','Ollama or LM Studio on your computer, or any OpenAI-compatible service.')}${card('copy','Decide later','Copy ready-made prompts into any AI app for now.')}</div>`;
   if(e==='local')h+=`<div class="field" style="margin-top:14px"><label>Model</label><select data-ins="llm">${LLMS.map(([k,n])=>`<option value="${k}" ${llmOf(s.llm)[0]===k?'selected':''}>${n}${k===LLMS[0][0]?' · recommended':''}</option>`).join('')}</select><small class="muted">The recommended one answers quickly on most ${NATIVE?'phones':'devices'}. Bigger ones understand more but take longer. You can switch any time.</small></div>${window.AIX?AIX.modelCard('wz'):''}`;
   if(e==='api')h+=`<div class="chips" style="margin:14px 0 4px">${API_PRE.map(([n,u,m])=>`<button class="chip ${s.url===u?'on':''}" data-act="insApiPre" data-u="${u}" data-m="${m}">${n}</button>`).join('')}</div>
    <div class="field"><label for="wzUrl">Server address</label><input id="wzUrl" data-ins="url" value="${esc(s.url)}" placeholder="http://localhost:11434/v1" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label for="wzModel">Model</label><input id="wzModel" data-ins="model" value="${esc(s.model)}" placeholder="llama3.2" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label for="wzKey">API key <small class="muted">(not needed for Ollama)</small></label><input id="wzKey" data-ins="key" type="password" value="${esc(aiKey())}" autocomplete="off"><small class="muted">It stays on this ${dev()} and is never synced or backed up.</small></div>
    <div class="actions left"><button class="btn sm" data-act="insTest">Test connection</button></div>`;
   return h},
  main:()=>{const s=insSet();if(s.engine!=='local'||aiBusy()||!window.AIX)return null;
   if(!aiHave())return['Download and continue',()=>{AIX.setup({quiet:1});toast(`${esc(aiName())} is downloading. Keep going, it carries on in the background`);next()}];
   if(!s.profile)return['Set it up and continue',()=>{AIX.setup({quiet:1});next()}];return null}},

 {k:'voice',ic:'live',t:'A natural voice',lead:`When ${pname()} talks back, it can use a lifelike voice that runs right on this ${dev()}: free, offline, no account.`,
  done:()=>kk().st==='have'&&/^kokoro:/.test(asg().voice||''),
  sum:()=>{const k=kk(),v=asg().voice||'',kv=window.KOKORO&&/^kokoro:/.test(v)?KOKORO.voice(v.slice(7)):null;return k.st==='getting'?`Downloading · ${Math.round(k.p*100)}%`:k.st==='have'?(kv?'Natural voice · '+esc(kv[1]):'Downloaded · using the '+(NATIVE?'phone':'system')+' voice'):'The '+(NATIVE?'phone':'system')+' voice'},
  body:()=>{const k=kk();
   return(window.AIX&&AIX.kk?AIX.kk():'')+(k.st==='none'||k.st==='err'?`<p class="small muted" style="margin-top:8px">We pick Heart, the most natural voice, for you. You can choose another here or in Settings › AI & voice.</p>`:'')+
    `<div class="field" style="margin-top:14px"><label>Read replies out loud</label><select data-assist="speak">${[['voice','When I talk to it'],['always','Always'],['never','Never']].map(([k,n])=>`<option value="${k}" ${(asg().speak||'voice')===k?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="actions left"><button class="btn sm ghost" data-act="wzHear">${ic('play')}Hear ${esc(pname())}</button></div>`},
  main:()=>{const k=kk();if(!window.KOKORO||k.st==='have'||k.st==='getting')return null;return['Download and continue',()=>{ACT.kkGet();next()}]}},

 {k:'hey',ic:'mic',t:wakeW,lead:`Talk instead of typing. ${NA?`Say “${esc(wakeW())}” and ask in your own words, or tap the orb at the top.`:'Tap the orb at the top, or any mic button, and ask in your own words.'}`,
  done:()=>{const v=vset();return v.on&&(!NA||!!(asg().wake||asg().bg))},
  sum:()=>{const a=asg();return NA&&(a.wake||a.bg)?`Say “${esc(wakeW())}”`+(a.bg?' · even in the background':''):vset().on?'Tap the orb or a mic to talk':'Mic buttons off'},
  body:()=>{const v=vset(),st=vstate(),a=asg(),needCloud=NATIVE?!st.onDevice:true;
   return`<div class="field"><label>Assistant’s name</label><input data-assist="name" maxlength="24" value="${esc(pname())}" placeholder="Plot"><small class="muted">You’ll say “Hey ${esc(pname())}”.</small></div>`+
    sw('voice','on','Mic buttons','Talk instead of typing in the journal, Ask, goals and habits',v.on)+
    (needCloud?sw('voice','cloud','Allow online speech',NATIVE?'This phone can’t turn speech into text on its own, so its speech service (usually Google’s) does it online. Plotlines never stores your audio.':'Your browser turns speech into text with an online service. Plotlines never stores your audio.',v.cloud):'')+
    (NA?sw('assist','wake',`Listen for “${esc(wakeW())}” while Plotlines is open`,'Uses the phone’s speech recognizer in short rounds while the app is on screen',a.wake)+
     sw('assist','bg','Keep listening in the background','Hands-free, even with the phone locked. Android shows a small silent notification while it listens, and it uses more battery.',a.bg)
     :`<p class="small muted">“${esc(wakeW())}” works in the Android app. Here, tap the orb at the top to talk.</p>`)},
  main:()=>{const a=asg();if(!NA||a.wake||a.bg)return null;return[`Turn on “${esc(wakeW())}” and continue`,async()=>{await ACT.asWakeOn();next()}]}},

 {k:'conn',ic:'agent',t:'Connections',lead:'Let the agent look at your calendar, email, Drive or Notion when you ask. Each one is read only unless it says otherwise, and you can disconnect any time.',
  done:()=>conns().filter(n=>n!=='The web').length>0,sum:()=>{const L=conns();return L.length?esc(L.join(', ')):'None yet'},
  body:()=>(window.AGENT&&AGENT.connHTML?AGENT.connHTML():'<p class="small muted">Connections live on the Agent page.</p>')},

 {k:'sync',ic:'link',t:'Sync and backup',lead:'Use Plotlines on your phone and on the web with the same plan, and keep a copy safe.',
  done:()=>syncOn(),sum:()=>syncOn()?'Google Drive'+(S.settings.sync.email?' · '+esc(S.settings.sync.email):''):'Off · stays on this '+dev(),
  body:()=>`<div>${syncPanel()}</div><p class="small muted" style="margin-top:12px">Rather not sign in? Keep a backup file instead.</p><div class="actions left"><button class="btn sm ghost" data-act="exportData">Export a backup file</button></div>`,
  main:()=>{const c=cfg();if(syncOn()||!(NATIVE||c.clientId))return null;return['Connect Google Drive',async()=>{await connectDrive(false);paint();if(syncOn())next()}]}},

 {k:'lock',ic:'lock',t:'App lock',lead:'Keep your plan private on a shared device. It unlocks with your fingerprint, face'+(NATIVE?' or screen lock':' or a PIN')+'. Off unless you turn it on.',
  done:()=>lockActive(),sum:()=>lockActive()?esc(lockSub().split(' · ')[0]):'Off',
  body:()=>{if(NATIVE)return lockHTML();const l=lockSet(),pin=!!S.settings.pinHash;
   return row('lock','Fingerprint or face','If this device has one, it unlocks Plotlines.',l.on?'<span class="data">On</span>':'<button class="btn sm" data-act="wzBio">Turn on</button>',l.on)+
    (pin?row('lock','PIN','Set. You can change it in Settings › Privacy & lock.','<span class="data">On</span>',true):`<form data-form="wzPin" class="wz-pin"><div class="two"><div class="field"><label>PIN · 4 to 8 digits</label><input name="a" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required autocomplete="new-password"></div><div class="field"><label>Repeat it</label><input name="b" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required autocomplete="new-password"></div></div><div class="actions left"><button class="btn sm">Set PIN</button></div><p class="small muted">The PIN never leaves this ${dev()}. With sync on, you can reset a forgotten PIN by signing in.</p></form>`)}},

 {k:'end',ic:'check',t:'You’re all set',lead:'Here’s how Plotlines is set up. Tap any line to change it, now or later in Settings.',
  body:()=>{const k=kk(),s=insSet();
   const dl=s.engine==='local'&&aiBusy(),live=(dl&&window.AIX?AIX.modelCard('wz'):'')+(k.st==='getting'&&window.AIX&&AIX.kk?AIX.kk():'');
   return(live?`<div class="wz-live"><p class="data">Still downloading · you can start using Plotlines</p>${live}</div>`:'')+
    `<div class="setup">${STEPS.filter(x=>x.k!=='end').map(x=>`<button type="button" class="su-r wz-sr${x.done()?' done':''}" data-act="wzGo" data-k="${x.k}"><span class="su-i">${x.done()?ic('check'):ic(x.ic)}</span><div><b>${typeof x.t==='function'?esc(x.t()):x.t}</b><small>${x.sum()}</small></div>${ic('next','ico-s')}</button>`).join('')}</div>`},
  main:()=>['Start using Plotlines',()=>{S.settings.setupStep='';ACT.setupDone()}]}];

const title=x=>typeof x.t==='function'?esc(x.t()):x.t;
function html(){const n=STEPS.length,x=STEPS[W.i],m=x.main&&x.main(),last=x.k==='end';
 return`<div class="wz" data-k="${x.k}"><div class="wz-top"><span class="data">Set up Plotlines${last?'':` · ${W.i+1} of ${n-1}`}</span>${last?'':'<button type="button" class="link small" data-act="wzLater">Finish later</button>'}</div>
 <div class="wz-dots" role="tablist" aria-label="Setup steps">${STEPS.filter(y=>y.k!=='end').map((y,j)=>`<button type="button" class="wz-dot${j===W.i?' on':''}${y.k!=='end'&&y.done()?' ok':''}" data-act="wzGo" data-k="${y.k}" role="tab" aria-selected="${j===W.i}" aria-label="${title(y)}"></button>`).join('')}</div>
 <div class="wz-hd"><span class="wz-ic">${ic(x.ic)}</span><h2>${title(x)}</h2></div><p class="muted small wz-lead">${x.lead}</p>
 <div class="wz-b">${x.body()}</div>
 <div class="wz-nav">${W.i?`<button type="button" class="btn ghost wz-bk" data-act="wzBack" aria-label="Back">${ic('back')}</button>`:''}<span class="wz-sp"></span>${last?'':m?`<button type="button" class="btn ghost" data-act="wzNext">Skip</button>`:''}${m?`<button type="button" class="btn pri" data-act="wzMain">${m[0]}</button>`:`<button type="button" class="btn pri" data-act="wzNext">Next${ic('next')}</button>`}</div></div>`}
const open_=()=>!!document.querySelector('#sheet.on .wz');
function paint(){if(!open_())return;const sh=$('#sheet'),a=document.activeElement;if(a&&sh.contains(a)&&a.matches('input:not([type=checkbox]):not([type=radio]),textarea'))return;const y=sh.scrollTop;sh.innerHTML='<div class="grab"></div>'+html();sh.scrollTop=y}
let PT=0;const paintSoon=(ms=60)=>{clearTimeout(PT);PT=setTimeout(paint,ms)};
function goTo(i){W.i=Math.max(0,Math.min(STEPS.length-1,i));const x=STEPS[W.i];S.settings.setupStep=x.k==='end'?'':x.k;save();if(!open_())return;const sh=$('#sheet');sh.innerHTML='<div class="grab"></div>'+html();sh.scrollTop=0;
 const h=sh.querySelector('.wz-hd h2');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
function next(){goTo(W.i+1)}

/* the names the rest of the app already calls */
setupFlow=function(nx,at){SETUP_NEXT=nx||null;const k=at||S.settings.setupStep||'';const j=STEPS.findIndex(x=>x.k===k);W.i=j>0?j:0;openSheet(html(),true)};
setupHTML=html;setupPaint=paint;

Object.assign(ACT,{
 wzNext:()=>next(),wzBack:()=>goTo(W.i-1),
 wzGo:d=>{const j=STEPS.findIndex(x=>x.k===d.k);if(j>=0)goTo(j)},
 wzMain:async(d,el)=>{const m=STEPS[W.i].main&&STEPS[W.i].main();if(!m)return next();if(el)el.disabled=true;try{await m[1]()}finally{if(el&&el.isConnected)el.disabled=false}},
 wzLater:()=>{toast('Pick it up any time in Settings › Guided setup');ACT.setupDone()},
 wzEng:d=>{const s=insSet();s.engine=d.k;save();try{NAT_WARM='';natWarm()}catch(e){}paint()},
 wzHear:()=>{if(window.AIX&&AIX.hear)AIX.hear()},
 wzBio:async()=>{if(!await webBioOK()){toast('This device has no fingerprint or face unlock here. Set a PIN instead');$('#sheet .wz-pin input')?.focus();return}
  if(await bioCheck('Turn on app lock','Confirm it’s you')){S.settings.lock={...lockSet(),on:true};save();toast('App lock on')}else toast('App lock not turned on');paint()}});
Object.assign(FORM,{wzPin:async f=>{const a=f.elements.a.value;if(a!==f.elements.b.value)return toast('The PINs don’t match');S.settings.pinHash=await hash(a);save();document.activeElement&&document.activeElement.blur();toast('PIN set');paint()}});

/* the choices inside a step use the app's own controls; repaint the step once they've done their work */
document.addEventListener('change',e=>{if(e.target.closest&&e.target.closest('#sheet .wz'))paintSoon(80)});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#sheet .wz [data-act]');if(!b||/^wz|^setupDo$/.test(b.dataset.act))return;paintSoon(350);setTimeout(paint,1600)});
window.addEventListener('focus',()=>paintSoon(300));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)paintSoon(300)});
/* the natural voices download: repaint when it starts, finishes or fails (the bar itself moves on its own) */
let KST='';window.addEventListener('plot-kokoro',()=>{const s=kk().st;if(s!==KST){KST=s;paintSoon(120)}});

const css=document.createElement('style');css.textContent=`
.wz-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wz-dots{display:flex;gap:6px;margin:12px 0 18px}
.wz-dot{flex:1;height:5px;border-radius:3px;border:0;padding:0;background:var(--line);cursor:pointer;transition:background .3s var(--ease,ease)}
.wz-dot.ok{background:color-mix(in srgb,var(--accent) 45%,var(--line))}.wz-dot.on{background:var(--accent)}
.wz-hd{display:flex;align-items:center;gap:12px}.wz-hd h2{margin:0;outline:none}
.wz-ic{width:42px;height:42px;flex:none;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}.wz-ic svg{width:22px;height:22px}
.wz-lead{margin:10px 0 14px}
.wz-b .panel{padding:0;background:none;border:0;box-shadow:none;margin:0}.wz-b .panel>h3{display:none}
.wz-cs{display:grid;gap:8px}
.wz-c{display:flex;align-items:flex-start;gap:12px;text-align:left;width:100%;padding:13px 14px;border-radius:16px;background:var(--bg-2);border:1px solid var(--line);color:inherit;font:inherit;cursor:pointer}
.wz-c b{display:block;font-size:14.5px}.wz-c b em{font-style:normal;font:500 9.5px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-left:6px}
.wz-c small{display:block;color:var(--muted);font-size:12.5px;line-height:1.4;margin-top:2px}
.wz-c.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,var(--bg-2))}
.wz-rd{width:18px;height:18px;flex:none;margin-top:2px;border-radius:50%;border:2px solid var(--line);box-sizing:border-box}.wz-c.on .wz-rd{border:5px solid var(--accent)}
.wz-b .mm{margin-top:14px}
.wz-live{margin-bottom:14px}.wz-live .mm,.wz-live .kk{margin-top:8px}
.wz-sr{width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer}.wz-sr>svg{flex:none;opacity:.5}
.wz-pin{margin-top:12px}
.wz-nav{position:sticky;bottom:-24px;display:flex;align-items:center;gap:8px;margin:20px -20px -24px;padding:12px 20px calc(16px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg-2) 82%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.wz-sp{flex:1}.wz-nav .btn svg{width:16px;height:16px}.wz-nav .btn.pri{flex:0 1 auto;min-width:0;white-space:normal;line-height:1.2;text-align:center}.wz-bk{padding-left:12px;padding-right:12px}
@media(min-width:821px){.wz-nav{bottom:-28px;margin:20px -28px -28px;padding:14px 28px 18px;border-radius:0 0 30px 30px}}`;
document.head.appendChild(css);
})();
