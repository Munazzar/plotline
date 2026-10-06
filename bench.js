/* ================= Workbench =================
   An infinite canvas for ideas, workflows and architectures, built to work with any AI.
   Boards live on this device (IndexedDB key 'benches'). "Share" puts a copy in Firestore sealed with AES-GCM under a
   random 256-bit key that only travels in the link's #fragment. Browsers never send a fragment to a server, so
   Firestore, Google, link previews and crawlers only ever see ciphertext under an unguessable id.

   Needs: the benches block in firestore.rules, and Firebase Authentication → Anonymous turned on.
*/
(()=>{
'use strict';
const GRID=20,now=()=>Date.now();
const TYPES={sticky:['Sticky note',200,130,'wbsticky'],card:['Card',240,110,'wbcard'],task:['Task',240,52,'wbtask'],step:['Step',200,60,'wbstep'],decision:['Decision',190,120,'wbdec'],service:['Service',210,80,'wbsvc'],data:['Data store',190,90,'wbdata'],user:['Person',160,80,'wbuser'],frame:['Frame',560,360,'wbframe'],text:['Text',300,48,'wbtext']};
const KTAG={step:'Step',decision:'Decision',service:'Service',data:'Data',user:'Person'};
const COLORS={none:'var(--muted)',amber:'#F0C862',orange:'#FF8C6B',pink:'#F585B8',violet:'#AC93FF',blue:'#6B9BFF',green:'#46C99B',lime:'#A9D14A',red:'#FF7A7A'};
const ME=(()=>{try{let c=localStorage.getItem('plotline.wbme');if(!c){c=uid();localStorage.setItem('plotline.wbme',c)}return c}catch(e){return uid()}})();
const who=()=>(typeof myName==='function'&&myName())||'Guest';
const rel=t=>{const s=(now()-t)/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':new Date(t).toLocaleDateString()};
const rnd=n=>{const A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',v=crypto.getRandomValues(new Uint8Array(n));return[...v].map(x=>A[x%62]).join('')};
const toUrl=k=>k.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),fromUrl=k=>{k=k.replace(/-/g,'+').replace(/_/g,'/');while(k.length%4)k+='=';return k};
const webBase=()=>(PLOTLINE_CFG.webUrl||location.origin+location.pathname).replace(/#.*$/,'');

Object.assign(IC,{
 wbfit:'<rect x="7.5" y="8.5" width="9" height="7" rx="1.5"/><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7M21 17v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 21H4.5A1.5 1.5 0 0 1 3 19.5V17"/>',
 wbfs:'<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
 wbunfs:'<path d="M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5"/>',
 wbbench:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/><circle cx="6.5" cy="17.5" r="3"/>',
 wbptr:'<path d="M5 3l14 7-6 2-2 6z"/>',
 wbhand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 14a1.6 1.6 0 0 1 2.6-1.8L8 14"/>',
 wbsticky:'<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
 wbcard:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/>',
 wbtask:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
 wbstep:'<rect x="2" y="8" width="20" height="8" rx="4"/>',
 wbdec:'<path d="M12 3l9 9-9 9-9-9z"/>',
 wbsvc:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M7 14h.01M11 10h6M11 14h6"/>',
 wbdata:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
 wbuser:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 wbframe:'<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
 wbtext:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
 wbcom:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 wbspark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
 wbshare:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
 wbundo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 wbredo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
 wbprompt:'<path d="M4 17l6-6-6-6M12 19h8"/>',
 print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
 wbglow:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 wbal:'<path d="M4 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="7" y="14" width="14" height="4" rx="1"/>',
 wbac:'<path d="M12 3v18"/><rect x="6" y="6" width="12" height="4" rx="1"/><rect x="4" y="14" width="16" height="4" rx="1"/>',
 wbar:'<path d="M20 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="3" y="14" width="14" height="4" rx="1"/>',
 wbat:'<path d="M3 4h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="14" rx="1"/>',
 wbam:'<path d="M3 12h18"/><rect x="6" y="6" width="4" height="12" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
 wbab:'<path d="M3 20h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="3" width="4" height="14" rx="1"/>',
 wbdh:'<rect x="3" y="7" width="4" height="10" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="17" y="7" width="4" height="10" rx="1"/>',
 wbdv:'<rect x="7" y="3" width="10" height="4" rx="1"/><rect x="7" y="10" width="10" height="4" rx="1"/><rect x="7" y="17" width="10" height="4" rx="1"/>'});
const DESC={sticky:'A quick thought',card:'A title and details',task:'Something to tick off',step:'A step in a flow',decision:'A yes or no branch',service:'A system or service',data:'A database or store',user:'A person or role',frame:'Group related items',text:'A heading or label'};

/* ---------------- styles ---------------- */
document.head.insertAdjacentHTML('beforeend',`<style>
.wb-on main{max-width:none!important;padding:0!important;margin:0}
.wb-on .tabbar{display:none!important}
.wb{position:relative;height:100vh;height:100dvh;overflow:hidden;background:var(--bg);user-select:none;-webkit-user-select:none}
.wb-cv{position:absolute;inset:0;overflow:hidden;touch-action:none;outline:none;background-image:radial-gradient(circle,var(--line-2) 1.1px,transparent 1.6px)}
.wb-cv.pan{cursor:grab}.wb-cv.panning{cursor:grabbing}
.wb-w{position:absolute;left:0;top:0;transform-origin:0 0}
.wb-e{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.wb-e .hit{stroke:transparent;stroke-width:16;fill:none;pointer-events:stroke;cursor:pointer}
.wb-e .ln{fill:none;stroke:var(--muted);stroke-width:1.8}
.wb-e .sel .ln{stroke:var(--accent);stroke-width:2.6}
.wb-e .tmp{stroke:var(--accent);stroke-dasharray:6 5}
.wb-e text{font:600 12px var(--f-body);fill:var(--text);paint-order:stroke;stroke:var(--bg);stroke-width:5px;stroke-linejoin:round;text-anchor:middle;dominant-baseline:middle}
.wn{position:absolute;isolation:isolate;box-sizing:border-box;padding:16px 18px;border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 92%,var(--text) 8%),var(--surface) 42px);border:1px solid color-mix(in srgb,var(--nc) 34%,var(--line-2));color:var(--text);font:500 14.5px/1.5 var(--f-body);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 7%,transparent),0 1px 2px rgba(0,0,0,.18),0 12px 28px -16px rgba(0,0,0,.6);transition:box-shadow .25s,border-color .25s;cursor:grab;display:flex;flex-direction:column;justify-content:center;overflow-wrap:anywhere;z-index:1}
.wn.sel{outline:2px solid var(--accent);outline-offset:2px}
.wn.drop{outline:2px dashed var(--accent);outline-offset:3px}
.wn-t{white-space:pre-wrap;min-height:1.4em;outline:none}
.wn-t[contenteditable]{cursor:text;user-select:text;-webkit-user-select:text}
.wn-k{align-self:flex-start;font:600 9.5px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--nc);background:color-mix(in srgb,var(--nc) 15%,transparent);padding:3px 8px;border-radius:999px;margin-bottom:8px}
.wn:hover{border-color:color-mix(in srgb,var(--nc) 55%,var(--line-2));box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 8%,transparent),0 2px 4px rgba(0,0,0,.2),0 18px 36px -18px rgba(0,0,0,.7)}
.wn.halo{box-shadow:0 0 0 3px color-mix(in srgb,var(--hc) 38%,transparent),0 0 30px 6px color-mix(in srgb,var(--hc) 42%,transparent),0 12px 28px -16px rgba(0,0,0,.6);border-color:var(--hc)}
.t-decision.halo,.t-text.halo,.t-frame.halo{box-shadow:none;filter:drop-shadow(0 0 14px color-mix(in srgb,var(--hc) 70%,transparent))}
.wb-addb span{font-size:13px}
.wb-signin{background:var(--accent);color:var(--on-accent)}.wb-signin:hover{background:var(--accent);filter:brightness(1.08)}
.wb-pop{position:absolute;z-index:8;display:none;flex-direction:column;align-items:stretch;gap:6px;padding:12px;width:min(360px,calc(100% - 20px));max-height:min(70dvh,520px);overflow:auto;background:var(--bg-2)}
.wb-pop:not(.on){display:none}
html.wb-on .tprompt{display:none}
.wb-pop.on{display:flex;animation:wbPop .22s cubic-bezier(.32,.72,0,1)}
@keyframes wbPop{from{opacity:0;transform:translateY(6px) scale(.97)}}
.wb-pt{font:600 10.5px var(--f-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:2px 4px 4px}
.wb-pg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.wb-po{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;text-align:left;padding:10px;border-radius:13px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;cursor:pointer;transition:border-color .2s,transform .3s var(--spring)}
.wb-po:hover{border-color:var(--accent)}.wb-po:active{transform:scale(.96)}.wb-po.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.wb-po svg{grid-row:1/3;width:20px;height:20px;color:var(--acc-ink,var(--accent))}.wb-po b{font-size:13px}.wb-po small{font-size:11.5px;color:var(--muted);line-height:1.3}
.wb-pg.g .wb-po{grid-template-columns:1fr;justify-items:start;gap:6px}
.wb-gp{display:block;width:100%;height:38px;border-radius:9px;border:1px solid var(--line);background-color:var(--bg)}
.wb-tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 6px 2px;font-size:13.5px}.wb-tg input{width:20px;height:20px;accent-color:var(--accent)}
.wb-zr{width:110px;height:28px;margin:0 2px;accent-color:var(--accent);cursor:pointer;background:none;border:0;padding:0}
@media(max-width:520px){.wb-zr{width:84px}}
html.wb-fs .wb-top{top:10px}html.wb-fs .wb-tools,html.wb-fs .wb-zm{bottom:14px}
.t-sticky{background:color-mix(in srgb,var(--nc) 26%,var(--surface));border-radius:4px 4px 18px 4px;font-weight:600}
.t-card .wn-t::first-line{font-weight:700;font-size:15px}
.t-card{justify-content:flex-start;border-top:3px solid var(--nc)}
.t-task{flex-direction:row;align-items:center;gap:10px;justify-content:flex-start;padding:10px 12px}
.wn-ck{flex:none;width:22px;height:22px;border-radius:7px;border:1.6px solid var(--nc);background:none;display:grid;place-items:center;cursor:pointer;color:#0B1020;padding:0}
.wn-ck svg{width:15px;height:15px}
.done .wn-ck{background:var(--c-health);border-color:var(--c-health)}
.done .wn-t{text-decoration:line-through;color:var(--muted)}
.t-step{border-radius:999px;text-align:center;align-items:center;background:color-mix(in srgb,var(--nc) 14%,var(--surface))}
.t-decision{background:none;border:0;box-shadow:none;text-align:center;align-items:center;padding:20px 34px}
.t-decision::before,.t-decision::after{content:"";position:absolute;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);z-index:-1}
.t-decision::before{inset:0;background:color-mix(in srgb,var(--nc) 55%,var(--line-2))}
.t-decision::after{inset:2px;background:color-mix(in srgb,var(--nc) 12%,var(--surface))}
.t-service{border-left:4px solid var(--nc)}
.t-data{border-radius:50%/22px;text-align:center;align-items:center;padding-top:24px}
.t-data::before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:26px;border:1px solid color-mix(in srgb,var(--nc) 40%,var(--line-2));border-radius:50%}
.t-user{border-radius:999px;text-align:center;align-items:center}
.t-frame{background:color-mix(in srgb,var(--nc) 5%,transparent);border:1.5px dashed color-mix(in srgb,var(--nc) 55%,var(--line-2));box-shadow:none;justify-content:flex-start;z-index:0;padding:10px 14px}
.t-frame .wn-t{font:600 12px var(--f-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--nc)}
.t-text{background:none;border-color:transparent;box-shadow:none;font:700 22px/1.2 var(--f-body);padding:6px 4px}
.wn-h{position:absolute;right:-9px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:var(--accent);border:3px solid var(--bg);opacity:0;cursor:crosshair;transition:opacity .15s;z-index:2}
.wn:hover .wn-h,.wn.sel .wn-h{opacity:1}
.wn-r{position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;cursor:nwse-resize;opacity:0;border-right:2px solid var(--accent);border-bottom:2px solid var(--accent)}
.wn.sel .wn-r{opacity:1}
@media(hover:none){.wn.sel .wn-h{width:24px;height:24px;right:-13px;margin-top:-12px}.wn.sel .wn-r{width:20px;height:20px}}
.wn-b{position:absolute;top:-10px;right:12px;font:600 10px var(--f-mono);background:var(--accent);color:var(--on-accent);border-radius:9px;padding:2px 6px}
.wb-mq{position:absolute;border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);pointer-events:none;display:none}
.wb-bar{display:flex;align-items:center;gap:2px;padding:5px;border-radius:16px;background:color-mix(in srgb,var(--bg-2) 86%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line-2);box-shadow:0 10px 30px -12px rgba(0,0,0,.5)}
.wb-top{position:absolute;top:calc(10px + var(--sat,0px));left:10px;right:10px;display:flex;align-items:center;gap:8px;z-index:5;pointer-events:none}
.wb-top>*{pointer-events:auto;min-width:0}
.wb-b{height:36px;min-width:36px;padding:0 10px;border:0;border-radius:11px;background:none;color:var(--text);display:inline-flex;align-items:center;justify-content:center;gap:6px;font:600 13px var(--f-body);cursor:pointer;white-space:nowrap;text-decoration:none;flex:none}
.wb-b svg{width:18px;height:18px}
.wb-b:hover{background:var(--surface-2)}.wb-b.on{background:var(--surface-2);color:var(--acc-ink,var(--accent))}
.wb-b[disabled]{opacity:.35;pointer-events:none}
.wb-b .n{font:600 10px var(--f-mono);color:var(--muted)}
input.wb-ttl,.wb-ttl{background:none;border:0;border-radius:8px;color:var(--text);font:700 16px var(--f-body);padding:4px 8px;width:clamp(110px,24vw,320px);min-width:0;outline:none;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
input.wb-ttl:focus{background:var(--surface);box-shadow:none}
.wb-tag{display:inline-flex;gap:5px;align-items:center;font:500 10.5px var(--f-mono);text-transform:uppercase;color:var(--muted);padding:0 8px}.wb-tag svg{width:14px;height:14px}
.wb-sp{flex:1}
.wb-who{display:flex;padding-left:8px}.wb-who span{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--f-body);color:#111;margin-left:-6px;border:2px solid var(--bg-2)}
.wb-st{width:8px;height:8px;border-radius:50%;background:var(--dim);margin:0 8px;flex:none}.wb-st.ok{background:var(--c-health)}.wb-st.saving{background:var(--accent)}.wb-st.err{background:#FF7A7A}
.wb-tools{position:absolute;left:50%;bottom:calc(14px + var(--sab,0px));transform:translateX(-50%);z-index:5;max-width:calc(100% - 20px);overflow-x:auto;scrollbar-width:none}
.wb-tools::-webkit-scrollbar{display:none}
.wb-sep{width:1px;height:22px;background:var(--line-2);margin:0 4px;flex:none}
.wb-zm{position:absolute;right:10px;bottom:calc(14px + var(--sab,0px));z-index:5}
.wb-zm .z{font:500 11px var(--f-mono);min-width:50px}
.wb-sb{position:absolute;z-index:6;transform:translate(-50%,calc(-100% - 14px));display:none;flex-wrap:wrap;justify-content:center;width:max-content;max-width:calc(100vw - 20px)}
.wb-sb.on{display:flex}
.wb-dot{width:20px;height:20px;border-radius:50%;background:var(--c);border:2px solid var(--bg-2);box-shadow:0 0 0 1px var(--line-2);cursor:pointer;margin:0 2px;padding:0;flex:none}
.wb-dot.on{box-shadow:0 0 0 2px var(--text)}
.wb-sb select{width:auto;height:34px;padding:0 8px;font-size:13px;border-radius:10px;background:var(--surface)}
.wb-side{position:absolute;top:calc(66px + var(--sat,0px));right:10px;bottom:calc(14px + var(--sab,0px));width:min(410px,calc(100% - 20px));z-index:7;overflow:auto;padding:18px;border-radius:22px;background:var(--bg-2);border:1px solid var(--line-2);box-shadow:0 30px 60px -20px rgba(0,0,0,.6);display:none;user-select:text;-webkit-user-select:text;overscroll-behavior:contain}
.wb-side.on{display:block}
.wb-side h3{font:700 19px var(--f-body);margin:0 0 4px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.wb-side textarea{min-height:90px;font-size:14px}
.wb-side .lbl{margin-top:16px}
.wb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.wb-chip{border:1px solid var(--line-2);background:var(--surface);color:var(--text);border-radius:999px;padding:7px 12px;font:600 12.5px var(--f-body);cursor:pointer}
.wb-chip.on{background:var(--accent);color:var(--on-accent);border-color:transparent}
.wb-say{background:var(--surface);border-radius:14px;padding:12px 14px;font-size:14px;margin-top:12px;border-left:3px solid var(--accent)}
.wb-cm{padding:12px 0;border-top:1px solid var(--line)}.wb-cm b{font-size:13.5px}.wb-cm p{margin:4px 0 0;font-size:14px;white-space:pre-wrap}
.wb-row{display:flex;gap:6px;align-items:center}.wb-row input{font:500 12px var(--f-mono)}
.wb-hint{font-size:12.5px;color:var(--muted);margin:6px 0 0}
.wb-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.wb-tpl{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;padding:16px;border-radius:20px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font:inherit;transition:transform .4s var(--spring),border-color .2s}
.wb-tpl:hover{border-color:var(--accent);transform:translateY(-2px)}
.wb-tpl svg{width:24px;height:24px;color:var(--acc-ink,var(--accent))}.wb-tpl small{color:var(--muted);font-size:12.5px;line-height:1.35}
.wb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.wb-card{position:relative;display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:22px;background:var(--surface);border:1px solid var(--line);cursor:pointer;transition:transform .4s var(--spring),border-color .2s}
.wb-card:hover{border-color:var(--line-2);transform:translateY(-2px)}
.wb-card b{font-size:16px;padding-right:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-card .ibtn{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:12px}
.wb-mini{width:100%;height:120px;border-radius:14px;background:var(--bg-2);display:block}
@media(max-width:820px){
 .wb-side{left:10px;right:10px;width:auto;top:auto;bottom:calc(10px + var(--sab,0px));max-height:74dvh}
 .wb-tools{left:10px;right:10px;transform:none;max-width:none}
 .wb-zm{bottom:calc(72px + var(--sab,0px))}
 .wb-b .lb{display:none}
}
@media(max-width:520px){.wb-zm .z,.wb-zm .snap{display:none}.wb-top{gap:6px}.wb-top>.wb-bar:first-child{flex:1 1 auto}.wb-top>.wb-bar:last-child{flex:none}.wb-sp{display:none}input.wb-ttl,.wb-ttl{width:auto;flex:1 1 40px;font-size:15px;padding:4px}.wb-top .wb-b{min-width:32px;padding:0 7px}.wb-who span:nth-child(n+3){display:none}}
</style>`);

/* ---------------- storage ---------------- */
let LIST=null,saveT=null;
const loadList=async()=>{if(LIST)return LIST;try{LIST=(await DB.get('benches'))||[]}catch(e){LIST=[]}return LIST};
loadList();
function persist(){clearTimeout(saveT);saveT=setTimeout(()=>{if(LIST)DB.set('benches',LIST).catch(()=>toast('Couldn’t save the board on this device'))},250);if(typeof syncSoon==='function')syncSoon(5000)}
const blank=title=>({id:uid(),title:title||'Untitled board',tu:now(),created:now(),u:now(),nodes:{},edges:{},comments:{},dead:{},who:{},cloud:null,pub:null});
function put(b,type,text,x,y,color,extra){const id=uid(),[,w,h]=TYPES[type];b.nodes[id]={id,type,text,x,y,w,h,color:color||(type==='sticky'?'amber':'none'),u:now(),...extra};return id}
function link(b,a,c,label){const id=uid();b.edges[id]={id,a,b:c,label:label||'',u:now()};return id}
const TPLS=[
 ['blank','Blank board','An empty canvas with a dot grid','wbbench',()=>{}],
 ['idea','Idea map','Problem, people, solution, money, risks','wbsticky',b=>{const c=put(b,'card','Your idea\nOne line on what it is',300,240,'blue');
  [['Problem it solves',0,0,'red'],['Who has it',300,0,'amber'],['How it works',600,0,'green'],['Why now',0,460,'violet'],['How it earns',300,460,'lime'],['Biggest risk',600,460,'orange']].forEach(([t,x,y,col])=>link(b,c,put(b,'sticky',t,x,y,col)))}],
 ['workflow','Workflow','Steps and decisions, left to right','wbstep',b=>{const s=put(b,'step','Start',0,120,'green'),a=put(b,'step','Collect the request',260,120),d=put(b,'decision','Approved?',520,90,'amber'),y=put(b,'step','Do the work',780,20),n=put(b,'step','Send back with notes',780,240,'red'),e=put(b,'step','Done',1040,20,'green');
  link(b,s,a);link(b,a,d);link(b,d,y,'yes');link(b,d,n,'no');link(b,y,e);link(b,n,a,'retry')}],
 ['arch','Architecture','People, apps, services and data','wbsvc',b=>{put(b,'frame','Backend',440,-40,'violet',{w:560,h:340});const u=put(b,'user','Customer',0,120,'blue'),w=put(b,'service','Web app',220,120,'blue'),api=put(b,'service','API',480,40,'violet'),wk=put(b,'service','Worker',480,200,'violet'),db=put(b,'data','Database',760,40,'green'),q=put(b,'data','Queue',760,200,'orange'),x=put(b,'service','Payments (external)',220,340,'pink');
  link(b,u,w,'uses');link(b,w,api,'REST');link(b,api,db,'reads/writes');link(b,api,q,'events');link(b,q,wk);link(b,api,x,'charges')}]];

/* ---------------- board state ---------------- */
const WB={B:null,sel:new Set(),esel:new Set(),G:null,edit:null,hist:[],fut:[],panel:null,snap:true,cascade:0,views:{},st:{k:'off',m:''},pending:false,els:new Map()};
const snap=b=>JSON.stringify([b.nodes,b.edges,b.comments]);
const sig=o=>{const{u,...r}=o;return JSON.stringify(r)};
const KS=['nodes','edges','comments'];
function diff(b,before){const o=JSON.parse(before),out=[];
 KS.forEach((k,i)=>{const O=o[i],L=b[k];for(const id in L)if(!O[id]||sig(O[id])!==sig(L[id]))out.push([k,id,O[id]||null,L[id]]);for(const id in O)if(!L[id])out.push([k,id,O[id],null])});return out}
function applyCh(b,ch,side){const t=now();ch.forEach(c=>{const[k,id]=c,v=c[side];if(v){b[k][id]={...v,u:t};delete b.dead[id]}else{delete b[k][id];b.dead[id]=t}})}
function changed(){const b=WB.B;b.u=now();persist();pushSoon();draw()}
/* every edit: snapshot before, mutate, commit. Changed items get a fresh u, removed ones a tombstone (that's what sync merges on). */
function commit(before){const b=WB.B,ch=diff(b,before);if(!ch.length)return false;const t=now();ch.forEach(([k,id,,v])=>{if(v)v.u=t;else b.dead[id]=t});
 WB.hist.push(ch);if(WB.hist.length>100)WB.hist.shift();WB.fut=[];changed();return true}
function undo(){const ch=WB.hist.pop();if(!ch)return;applyCh(WB.B,ch,2);WB.fut.push(ch);changed()}
function redo(){const ch=WB.fut.pop();if(!ch)return;applyCh(WB.B,ch,3);WB.hist.push(ch);changed()}
/* sync merge: last writer wins per item; tombstones beat older copies */
function mergeInto(b,r){let ch=false;const dead=b.dead;
 for(const[k,v]of Object.entries(r.dead||{}))if(!(dead[k]>=v)){dead[k]=v;ch=true}
 for(const k of KS){const L=b[k],R=r[k]||{};
  for(const id in R){const o=R[id],m=L[id];if(dead[id]>=o.u)continue;if(!m||o.u>m.u||(o.u===m.u&&JSON.stringify(o)>JSON.stringify(m))){L[id]=o;ch=true}}
  for(const id in L)if(dead[id]>=L[id].u){delete L[id];ch=true}}
 if((r.tu||0)>(b.tu||0)){b.title=r.title;b.tu=r.tu;ch=true}
 for(const[k,v]of Object.entries(r.who||{}))if(!b.who[k]||v.t>b.who[k].t)b.who[k]=v;
 const cut=now()-60*864e5;for(const k in dead)if(dead[k]<cut)delete dead[k];
 for(const k in b.who)if(b.who[k].t<now()-5*60e3)delete b.who[k];
 return ch}
const payload=b=>({title:b.title,tu:b.tu,nodes:b.nodes,edges:b.edges,comments:b.comments,dead:b.dead,who:b.who});
/* Drive sync: boards travel in plotline.json next to goals and habits. Same per-item merge as live sharing;
   a deleted board leaves a tombstone in S.dead. Keys are sorted so an unchanged board compares equal. */
const sortK=o=>Object.keys(o||{}).sort().reduce((a,k)=>(a[k]=o[k],a),{});
const syncForm=b=>({id:b.id,created:b.created||0,u:b.u||0,title:b.title,tu:b.tu||0,nodes:sortK(b.nodes),edges:sortK(b.edges),comments:sortK(b.comments),dead:sortK(b.dead)});
const byId=(x,y)=>x.id<y.id?-1:x.id>y.id?1:0;
window.WBSYNC={
 list:async()=>(await loadList()).map(syncForm).sort(byId),
 merge:(A,B,dead)=>{const m=new Map();(A||[]).forEach(x=>m.set(x.id,JSON.parse(JSON.stringify(x))));
  (B||[]).forEach(r=>{const b=m.get(r.id);if(!b){m.set(r.id,r);return}['nodes','edges','comments','dead','who'].forEach(k=>{b[k]=b[k]||{}});mergeInto(b,r);b.u=Math.max(b.u||0,r.u||0)});
  return[...m.values()].filter(x=>!(dead&&dead[x.id]>=(x.u||0))).map(syncForm).sort(byId)},
 apply:async(rs,dead)=>{await loadList();let ch=false;
  (rs||[]).forEach(r=>{let b=LIST.find(x=>x.id===r.id);if(!b){b={...blank(r.title),id:r.id,created:r.created||now(),tu:0,u:0};LIST.push(b);ch=true}
   if(mergeInto(b,r))ch=true;if((r.u||0)>(b.u||0)){b.u=r.u;ch=true}});
  const keep=LIST.filter(b=>!(dead&&dead[b.id]>=(b.u||0)));if(keep.length!==LIST.length){LIST.splice(0,LIST.length,...keep);ch=true}
  if(!ch)return;LIST.sort((a,b)=>(b.u||0)-(a.u||0));DB.set('benches',LIST).catch(()=>{});
  if(cur.p==='bench'){if(cur.id&&WB.B&&LIST.includes(WB.B))draw();else render(false)}}};
const edgesOk=b=>Object.values(b.edges).filter(e=>b.nodes[e.a]&&b.nodes[e.b]);
function delNodes(b,ids){const s=new Set(ids);ids.forEach(id=>delete b.nodes[id]);Object.values(b.edges).forEach(e=>{if(s.has(e.a)||s.has(e.b))delete b.edges[e.id]});Object.values(b.comments).forEach(c=>{if(s.has(c.on))delete b.comments[c.id]})}
const snapv=v=>WB.snap?Math.round(v/GRID)*GRID:Math.round(v);
function bbox(rs){if(!rs.length)return null;let x=1e9,y=1e9,X=-1e9,Y=-1e9;rs.forEach(r=>{x=Math.min(x,r.x);y=Math.min(y,r.y);X=Math.max(X,r.x+r.w);Y=Math.max(Y,r.y+r.h)});return{x,y,w:X-x,h:Y-y}}
const rectOf=id=>{const n=WB.B.nodes[id];if(!n)return null;const el=WB.els.get(id);return{x:n.x,y:n.y,w:n.w,h:el?el.offsetHeight:n.h}};

/* ---------------- cloud (Firestore REST, anonymous Firebase session) ---------------- */
const FSD=()=>`https://firestore.googleapis.com/v1/projects/${fbc().pid}/databases/(default)/documents/benches`;
const AK='plotline.wbauth';
async function anon(force){let s=null;try{s=JSON.parse(localStorage.getItem(AK)||'null')}catch(e){}
 if(s&&!force&&s.exp>now()+60e3)return s;const key=fbc().key,keep=o=>{try{localStorage.setItem(AK,JSON.stringify(o))}catch(e){}return o};let r,j;
 try{if(s&&s.rt){r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(s.rt)});j=await r.json().catch(()=>({}));
   if(r.ok&&j.id_token)return keep({id:j.id_token,rt:j.refresh_token||s.rt,uid:j.user_id||s.uid,exp:now()+(+j.expires_in||3600)*1e3})}
  r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});j=await r.json().catch(()=>({}))}
 catch(e){throw new Error('You’re offline')}
 if(!r.ok||!j.idToken){const m=(j.error&&j.error.message)||r.status;throw new Error(/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(m)?'Shared boards need Anonymous sign-in turned on in Firebase (Authentication → Sign-in method).':'Couldn’t start a cloud session ('+m+')')}
 return keep({id:j.idToken,rt:j.refreshToken,uid:j.localId,exp:now()+(+j.expiresIn||3600)*1e3})}
const myUid=()=>{try{return(JSON.parse(localStorage.getItem(AK)||'null')||{}).uid||''}catch(e){return''}};
/* editing a shared board needs a signed-in Plotline (Google) account; boards only on this device don't */
const gSess=()=>{try{return typeof fbGet==='function'?fbGet():null}catch(e){return null}};
const signedIn=()=>{const g=gSess();return!!(g&&g.email&&g.rt)};
const mine=o=>!!o&&(o===myUid()||o===(gSess()||{}).uid);
const needLogin=b=>!!(b&&b.cloud&&!signedIn()&&!(WB.views[b.cloud.doc]===b));
async function gs(){if(typeof fbSession!=='function')throw new Error('Sign in to edit shared boards');try{return await fbSession()}catch(e){throw new Error('Sign in to edit shared boards')}}
const sessFor=(kind,owner)=>kind==='view'&&owner&&owner===myUid()?anon():gs();
const QUOTA='The cloud’s daily limit is used up. Changes stay on this device and sync again by themselves later.';
async function cget(doc){let r;try{r=await fetch(`${FSD()}/${doc}?key=${fbc().key}`,{cache:'no-store'})}catch(e){throw new Error('You’re offline')}
 if(r.status===404)return null;if(r.status===429){window.FS_COOL=Date.now()+15*60000;throw new Error(QUOTA)}if(!r.ok)throw new Error('Cloud error '+r.status);const d=await r.json();return{ut:d.updateTime,...fsDec(d)}}
async function cput(doc,fields,pre,retry=true){const s=await sessFor(fields.kind,fields.owner);const q=pre==='new'?'currentDocument.exists=false':pre?'currentDocument.updateTime='+encodeURIComponent(pre):'';let r;
 try{r=await fetch(`${FSD()}/${doc}?${q}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.id},body:JSON.stringify(fsEnc(fields))})}catch(e){throw new Error('You’re offline')}
 if(r.status===401&&retry){if(fields.kind==='view'&&fields.owner===myUid())await anon(true);else{const g=gSess();if(g&&typeof fbPut==='function')fbPut({...g,exp:0})}return cput(doc,fields,pre,false)}
 if(r.status===400||r.status===409||r.status===404){const t=await r.text();if(/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS|NOT_FOUND/.test(t))return{conflict:true};throw new Error('Cloud error '+r.status)}
 if(r.status===403)throw new Error(signedIn()?'The cloud refused this board. Check the Firestore rules for “benches”.':'Sign in to edit shared boards');
 if(r.status===429){window.FS_COOL=Date.now()+15*60000;throw new Error(QUOTA)}if(!r.ok)throw new Error('Cloud error '+r.status);const d=await r.json();return{ut:d.updateTime}}
async function cdel(doc,owner){let s;try{s=await(owner&&owner===myUid()?anon():gs())}catch(e){return}await fetch(`${FSD()}/${doc}`,{method:'DELETE',headers:{Authorization:'Bearer '+s.id}}).catch(()=>{})}
function setSt(k,m=''){WB.st={k,m};const el=$('#wbst');if(el){el.className='wb-st '+k;el.title=k==='ok'?'Synced':k==='saving'?'Saving…':k==='err'?m:'On this device only'}if(k==='err'&&m&&m!==WB.lastErr){WB.lastErr=m;toast(esc(m))}}
let pushT,pushing=false,again=false;
function pushSoon(d=500){const b=WB.B;if(!b||!b.cloud||b.ro)return;clearTimeout(pushT);pushT=setTimeout(()=>push(b),d)}
async function push(b){if(pushing){again=true;return}pushing=true;setSt('saving');
 try{for(let i=0;i<5;i++){b.who[ME]={n:who(),t:now()};const enc=await encJ(b.cloud.key,payload(b));
   if(enc.length>950000)throw new Error('This board is too big to share (about 1 MB). Split it into two boards.');
   const r=await cput(b.cloud.doc,{owner:b.cloud.owner,kind:'edit',enc,u:now(),v:1},b.cloud.ut||'new');
   if(r.conflict){await pull(b,true);continue}
   b.cloud.ut=r.ut;b.cloud.sent=now();WB.pushedAt=now();persist();setSt('ok');pubSoon(b);if(window.rtPing)rtPing(b.cloud.doc);return}
  throw new Error('Too many people saving at once, retrying')}
 catch(e){setSt('err',e.message||String(e))}finally{pushing=false;if(again){again=false;pushSoon(50)}}}
async function pull(b,force){const d=await cget(b.cloud.doc);if(!d){b.cloud.gone=1;setSt('err','This board is no longer shared');return}
 if(!force&&d.ut===b.cloud.ut)return;const r=await decJ(b.cloud.key,d.enc);b.cloud.owner=d.owner;b.cloud.ut=d.ut;WB.lastRemote=now();
 if(mergeInto(b,r)){persist();if(WB.B===b){if(WB.G||WB.edit)WB.pending=true;else draw()}}else drawWho();
 if(!b.ro&&(b.u||0)>(b.cloud.sent||0))pushSoon(300);setSt('ok')}
/* the public view copy: a second doc under its own key, which only the owner's device may update */
let pubT;function pubSoon(b){if(!b.pub||!mine(b.cloud.owner))return;clearTimeout(pubT);pubT=setTimeout(()=>publish(b).catch(e=>setSt('err',e.message)),2500)}
async function publish(b,first){const v=b.pub,{who:_,...p}=payload(b);for(let i=0;i<3;i++){const r=await cput(v.doc,{owner:b.cloud.owner,kind:'view',enc:await encJ(v.key,p),u:now(),v:1},first?'new':v.ut);
  if(r.conflict){const d=await cget(v.doc);v.ut=d&&d.ut;first=!d;continue}v.ut=r.ut;persist();return}}
// ponytail: polls one doc every 6s while a shared board is busy (30s when quiet, paused on quota); switch to Firestore's Listen channel if read quota matters
/* live: the Realtime Database pings an open shared board on every change (rtWatch); polling only without it */
let BW=null;function benchWatch(){const b=cur.p==='bench'?WB.B:null,doc=b&&b.cloud&&!b.cloud.gone?b.cloud.doc:null;if(BW&&BW.doc===doc)return;if(BW){BW.w.close();BW=null}
 if(doc&&window.rtWatch)BW={doc,w:rtWatch(doc,()=>{const x=WB.B;if(!x||!x.cloud||x.cloud.doc!==doc||pushing||now()-(WB.pushedAt||0)<1500)return;pull(x).catch(e=>setSt('err',e.message))})}}
let tick=0;setInterval(()=>{const b=WB.B;tick++;benchWatch();if(BW&&BW.w.on)return;if(!b||!b.cloud||cur.p!=='bench'||pushing||WB.G||WB.edit||(window.plAwake&&!window.plAwake()))return;
 if(tick%2||now()-(WB.lastRemote||0)>60e3&&tick%10)return;pull(b).catch(e=>setSt('err',e.message))},3000);
setInterval(()=>{const b=WB.B;if(b&&b.cloud&&!b.ro&&cur.p==='bench'&&(!window.plAwake||window.plAwake()))pushSoon(0)},120e3);
const linkOf=(k,doc,key)=>`${webBase()}#/bench/${k}~${doc}~${toUrl(key)}`;
async function shareOn(b){if(!fsOK())throw new Error('Sharing isn’t available in this version');if(!signedIn()&&!(typeof shReady==='function'&&await shReady()))throw new Error('Sign in first to share a board');const s=await gs();
 b.cloud={doc:rnd(24),key:newKey(),owner:s.uid,ut:null,sent:0};persist();await push(b);if(WB.st.k==='err'){b.cloud=null;persist();throw new Error(WB.st.m)}}
async function viewOn(b){b.pub={doc:rnd(24),key:newKey(),ut:null};await publish(b,true)}
async function join(kind,doc,key){
 if(kind==='v'){let b=WB.views[doc];if(!b){b={...blank('Shared board'),ro:true,cloud:{doc,key}};WB.views[doc]=b;await pull(b,true)}return b}
 await loadList();let b=LIST.find(x=>x.cloud&&x.cloud.doc===doc);
 if(!b){b={...blank('Shared board'),tu:0,cloud:{doc,key,owner:'',ut:null,sent:now()}};await pull(b,true);if(b.cloud.gone)throw new Error('That board isn’t shared any more');LIST.unshift(b);persist();toast(signedIn()?'Board added to your Workbench':'Board added. Sign in to edit it')}
 return b}

/* ---------------- AI ---------------- */
const PROV={
 anthropic:['Anthropic Claude','anthropic','https://api.anthropic.com/v1','claude-sonnet-5-5',['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-4-5-20251001'],'https://console.anthropic.com/settings/keys'],
 openai:['OpenAI','oai','https://api.openai.com/v1','gpt-5',['gpt-5','gpt-5-mini','gpt-4.1'],'https://platform.openai.com/api-keys'],
 gemini:['Google Gemini','gemini','https://generativelanguage.googleapis.com/v1beta','gemini-2.5-flash',['gemini-2.5-pro','gemini-2.5-flash'],'https://aistudio.google.com/apikey'],
 openrouter:['OpenRouter (any model)','oai','https://openrouter.ai/api/v1','openrouter/auto',['openrouter/auto','anthropic/claude-sonnet-4.5','openai/gpt-5','google/gemini-2.5-pro','meta-llama/llama-3.3-70b-instruct'],'https://openrouter.ai/keys'],
 groq:['Groq','oai','https://api.groq.com/openai/v1','llama-3.3-70b-versatile',[],'https://console.groq.com/keys'],
 mistral:['Mistral','oai','https://api.mistral.ai/v1','mistral-large-latest',[],'https://console.mistral.ai/api-keys'],
 deepseek:['DeepSeek','oai','https://api.deepseek.com/v1','deepseek-chat',['deepseek-chat','deepseek-reasoner'],'https://platform.deepseek.com/api_keys'],
 xai:['xAI Grok','oai','https://api.x.ai/v1','grok-4',[],'https://console.x.ai/'],
 ollama:['Ollama on this computer','oai','http://localhost:11434/v1','llama3.2',[],''],
 custom:['Custom (OpenAI-compatible)','oai','','',[],''],
 plotline:['Plotline’s AI server (Ask page)','plotline','','',[],'']};
const TARGETS={claude:['Claude','https://claude.ai/new','xml'],chatgpt:['ChatGPT','https://chatgpt.com/','md'],gemini:['Gemini','https://gemini.google.com/app','md'],copilot:['Copilot','https://copilot.microsoft.com/','md'],grok:['Grok','https://grok.com/','md'],deepseek:['DeepSeek','https://chat.deepseek.com/','md'],perplexity:['Perplexity','https://www.perplexity.ai/','md'],mistral:['Le Chat','https://chat.mistral.ai/chat','md'],meta:['Meta AI','https://www.meta.ai/','md'],local:['Small / local model','','lite']};
const wbs=()=>S.settings.wb=Object.assign({mode:'copy',prov:'anthropic',models:{},urls:{},target:'claude',ptarget:'claude',pgoal:'research'},S.settings.wb||{});
const keyOf=p=>{try{return localStorage.getItem('plotline.wbkey.'+p)||''}catch(e){return''}};
const keySet=(p,v)=>{try{v?localStorage.setItem('plotline.wbkey.'+p,v):localStorage.removeItem('plotline.wbkey.'+p)}catch(e){}};
const provUrl=p=>(wbs().urls[p]||PROV[p][2]||'').replace(/\/+$/,''),provModel=p=>wbs().models[p]||PROV[p][3];
async function aiCall(system,user,{json=true,signal}={}){const p=wbs().prov,P=PROV[p],key=keyOf(p),url=provUrl(p),model=provModel(p);
 if(P[1]==='plotline'){let out='';await apiChat([{role:'system',content:system},{role:'user',content:user}],t=>{out+=t},signal,{temperature:.5});return out}
 if(!key&&p!=='ollama'&&p!=='custom')throw new Error(`Add your ${P[0]} API key in AI settings first`);if(!url||!model)throw new Error('Set the server address and model in AI settings');
 let r;try{
  if(P[1]==='anthropic')r=await fetch(url+'/messages',{method:'POST',signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:8000,system,messages:[{role:'user',content:user}]})});
  else if(P[1]==='gemini')r=await fetch(`${url}/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',signal,headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents:[{role:'user',parts:[{text:user}]}],...(json?{generationConfig:{responseMimeType:'application/json'}}:{})})});
  else r=await fetch(url+'/chat/completions',{method:'POST',signal,headers:{'content-type':'application/json',...(key?{Authorization:'Bearer '+key}:{}),...(p==='openrouter'?{'HTTP-Referer':webBase(),'X-Title':'Plotline Workbench'}:{})},body:JSON.stringify({model,messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:user}]})})}
 catch(e){if(e.name==='AbortError')throw e;throw new Error(`Couldn’t reach ${P[0]}. The browser may be blocking it; try OpenRouter, or use Copy & paste.`)}
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${P[0]} said ${r.status}: ${String((j.error&&(j.error.message||j.error))||'').slice(0,180)}`);
 if(P[1]==='anthropic')return(j.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
 if(P[1]==='gemini')return((j.candidates||[])[0]?.content?.parts||[]).map(x=>x.text||'').join('');
 return j.choices?.[0]?.message?.content||''}

const ROLE='You are a senior product strategist and systems architect working with me on a visual board in Plotline Workbench. You think in short, concrete items (one idea per item) and connect them so the structure is obvious at a glance.';
const SPEC=`Reply with exactly one JSON object inside a \`\`\`json code block, and nothing outside it:

{"format":"plotline-bench","version":1,"say":"one or two sentences to me","ops":[ ... ]}

Each op is one of:
{"op":"add","id":"new-1","type":"sticky","text":"…","col":0,"row":0,"color":"amber"}
{"op":"update","id":"<existing id>","text":"…","type":"card","color":"blue"}   (only the fields you change)
{"op":"delete","id":"<existing item or link id>"}
{"op":"link","from":"<id>","to":"<id>","label":"optional, 1-4 words"}
{"op":"comment","on":"<id>","text":"…"}

Rules:
- types: sticky (quick idea), card (titled note: first line is the title), task (an action), step (a workflow step), decision (a yes/no question), service (an app, system or API), data (a database, file or store), user (a person or role), frame (a labeled group area), text (a heading).
- colors: none, amber, orange, pink, violet, blue, green, lime, red. Use color to group, not to decorate.
- New ids are "new-1", "new-2", … and may be used by later "link" and "comment" ops. Existing ids come from the board; never invent others.
- col and row (integers 0-30) place new items on a grid beside the board: same row = side by side, next row = below. Flows run left to right by col.
- Keep text short: a sticky under 12 words; a card is a title line plus at most 3 short lines.
- At most 60 ops. Don't repeat what is already on the board.`;
const PRESETS=[
 ['brainstorm','Brainstorm','Brainstorm 8 to 12 fresh, distinct ideas that build on this board. Add them as sticky notes grouped by color, and link each to the item it grows from.'],
 ['workflow','Workflow','Turn this into a clear step-by-step workflow: a start, steps, yes/no decisions with labeled branches, and an end. Lay it out left to right and link everything in order.'],
 ['arch','Architecture','Design a practical system architecture for this: people and clients, services, data stores and outside APIs. Link them with short labels for what flows between them (e.g. "REST", "events", "reads"). Group related parts in frames.'],
 ['expand','Expand','Expand the selected items: give each 3 to 5 concrete child items (sub-ideas, steps or parts) and link them from their parent.'],
 ['critique','Critique','Act as a tough but fair reviewer. Comment on the weakest or riskiest items, and add red sticky notes for missing risks, assumptions to test and open questions.'],
 ['tidy','Tidy up','Tidy the board: rewrite vague items to be specific, merge duplicates (update one, delete the rest), fix types and colors, and link items that clearly belong together. Add no new ideas.'],
 ['plan','Action plan','Turn this into an action plan: 5 to 10 concrete tasks in order, each starting with a verb, linked in sequence, with the first task colored green.'],
 ['summary','Summary','Add one card that summarises the board: the core idea on the first line, then the key decisions and the next three actions.'],
 ['free','Just my words','']];
const PGOALS=[
 ['research','Research it','Research this thoroughly: the market and its trends, existing competitors and alternatives (what they do well and badly), the target users and their real pains, and evidence people would pay. End with the 3 biggest unknowns and a cheap way to test each.'],
 ['spec','Write a spec','Write a build-ready product spec: problem, users, goals and non-goals, user stories, the core features of a first version, data model, system components and APIs, edge cases, and a milestone plan.'],
 ['critique','Stress-test it','Stress-test this like a skeptical investor and a senior engineer: the weakest assumptions, the risks (market, technical, legal, ethical), how it could fail, and what would have to be true for it to work. Be specific and direct.'],
 ['pitch','Pitch it','Write a crisp one-page pitch: one-line hook, problem, solution, who it is for, why now, how it makes money, competition and edge, and the ask.'],
 ['plan','Plan it','Turn this into a realistic 90-day execution plan, week by week, with clear deliverables and the riskiest assumption tested first.'],
 ['code','Build it','Act as a senior engineer. Propose an architecture and tech stack, then write starter code for the core feature, file by file, with short notes on how to run it.'],
 ['explain','Explain it','Explain this board simply to a newcomer: what it is, how the parts connect, and what is still undecided.']];
const AIS={preset:'brainstorm',scope:'board',text:'',reply:'',errs:[],say:'',busy:false,ctrl:null,ptext:'',pout:'',pans:''};

function scopeIds(b,scope){if(scope!=='sel'||!WB.sel.size)return Object.keys(b.nodes);const s=new Set(WB.sel);
 Object.values(b.edges).forEach(e=>{if(WB.sel.has(e.a))s.add(e.b);if(WB.sel.has(e.b))s.add(e.a)});return[...s].filter(id=>b.nodes[id])}
function boardJSON(b,scope){const ids=new Set(scopeIds(b,scope)),ns=[...ids].map(id=>b.nodes[id]).sort((p,q)=>p.y-q.y||p.x-q.x);
 return JSON.stringify({title:b.title,...(scope==='sel'&&WB.sel.size?{selected:[...WB.sel]}:{}),items:ns.map(n=>({id:n.id,type:n.type,text:n.text,...(n.color!=='none'?{color:n.color}:{}),...(n.done?{done:true}:{})})),
  links:edgesOk(b).filter(e=>ids.has(e.a)&&ids.has(e.b)).map(e=>({id:e.id,from:e.a,to:e.b,...(e.label?{label:e.label}:{})})),
  comments:Object.values(b.comments).filter(c=>ids.has(c.on)).slice(-30).map(c=>({on:c.on,by:c.by,text:c.text}))},null,1)}
function outline(b,scope){const ids=new Set(scopeIds(b,scope)),N=b.nodes,short=id=>trunc(N[id].text.split('\n')[0],60);
 const ns=[...ids].map(id=>N[id]).sort((p,q)=>p.y-q.y||p.x-q.x),L=edgesOk(b).filter(e=>ids.has(e.a)&&ids.has(e.b)),C=Object.values(b.comments).filter(c=>ids.has(c.on));
 return`Board: ${b.title}\n\nItems:\n${ns.map(n=>`- ${n.text.replace(/\n+/g,' — ')}${['sticky','card','text'].includes(n.type)?'':` (${TYPES[n.type][0].toLowerCase()})`}${n.done?' [done]':''}`).join('\n')||'- (empty)'}`
  +(L.length?`\n\nConnections:\n${L.map(e=>`- ${short(e.a)} → ${short(e.b)}${e.label?` (${e.label})`:''}`).join('\n')}`:'')
  +(C.length?`\n\nComments:\n${C.slice(-20).map(c=>`- on “${short(c.on)}”, ${c.by}: ${c.text}`).join('\n')}`:'')}
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
/* one prompt, shaped for the model it goes to: XML sections for Claude, Markdown for the chat apps, short for small models */
function shape(style,parts){if(style==='xml')return parts.map(([t,,body])=>`<${t}>\n${body}\n</${t}>`).join('\n\n');
 if(style==='lite')return parts.map(([,h,body])=>`${h.toUpperCase()}:\n${body}`).join('\n\n');return parts.map(([,h,body])=>`## ${h}\n${body}`).join('\n\n')}
function taskText(){const p=PRESETS.find(x=>x[0]===AIS.preset),t=AIS.text.trim();return[p&&p[2],t&&(p&&p[2]?'My extra notes: ':'')+t].filter(Boolean).join('\n\n')||'Improve this board in the way you think is most useful.'}
function opsPrompt(style){const b=WB.B;return shape(style,[['role','Role',ROLE],['board','Board (JSON)',style==='xml'?boardJSON(b,AIS.scope):'```json\n'+boardJSON(b,AIS.scope)+'\n```'],['task','Task',taskText()],['format','Reply format',SPEC]])}
function studioPrompt(){const s=wbs(),g=PGOALS.find(x=>x[0]===s.pgoal)||PGOALS[0],t=TARGETS[s.ptarget]||TARGETS.claude,b=WB.B,extra=AIS.ptext.trim();
 return shape(t[2],[['role','Role','You are an expert advisor helping me take work from my planning board further. Be concrete, skip filler, and say so when something is a guess.'],['context','Context from my board',outline(b,AIS.scope)],['task','What I want',g[2]+(extra?`\n\n${extra}`:'')],
  ['output','How to answer','Use clear headings and short paragraphs or bullet lists.'+(s.ptarget==='perplexity'?' Cite sources with links for factual claims.':'')+(t[2]==='lite'?' Keep it under 400 words.':'')]])}
function parseReply(txt){const m=String(txt).match(/```(?:json)?\s*([\s\S]*?)```/),s=m?m[1]:String(txt);const i=s.indexOf('{'),j=s.lastIndexOf('}');if(i<0||j<i)return null;try{return JSON.parse(s.slice(i,j+1))}catch(e){return null}}
function check(o,b){if(!o||typeof o!=='object')return['The reply has no JSON object I can read. Reply with one ```json block only.'];const E=[];
 if(o.format!=='plotline-bench')E.push('"format" must be "plotline-bench".');if(!Array.isArray(o.ops))return[...E,'"ops" must be an array.'];if(o.ops.length>60)E.push('At most 60 ops.');
 const ids=new Set(Object.keys(b.nodes)),eids=new Set(Object.keys(b.edges)),nw=new Set(),txt=(v,n)=>typeof v==='string'&&v.trim()&&v.length<=n,known=x=>ids.has(x)||nw.has(x);
 o.ops.forEach((p,i)=>{const at=`ops[${i}]`;if(!p||typeof p!=='object'){E.push(at+' is not an object.');return}
  if(p.type!=null&&!TYPES[p.type])E.push(`${at}: "type" must be one of ${Object.keys(TYPES).join(', ')}.`);
  if(p.color!=null&&!COLORS[p.color])E.push(`${at}: "color" must be one of ${Object.keys(COLORS).join(', ')}.`);
  switch(p.op){
   case'add':if(typeof p.id!=='string'||!/^new-\d{1,3}$/.test(p.id))E.push(`${at}: "id" must look like "new-1".`);else if(nw.has(p.id))E.push(`${at}: "${p.id}" is used twice.`);else nw.add(p.id);
    if(!p.type)E.push(`${at}: "type" is missing.`);if(!txt(p.text,600))E.push(`${at}: "text" must be 1 to 600 characters.`);
    ['col','row'].forEach(k=>{if(p[k]!=null&&!(Number.isInteger(p[k])&&p[k]>=0&&p[k]<=30))E.push(`${at}: "${k}" must be an integer from 0 to 30.`)});break;
   case'update':if(!ids.has(p.id))E.push(`${at}: "${p.id}" is not an item on the board.`);if(p.text!=null&&!txt(p.text,600))E.push(`${at}: "text" must be 1 to 600 characters.`);break;
   case'delete':if(!ids.has(p.id)&&!eids.has(p.id))E.push(`${at}: "${p.id}" is not an item or link on the board.`);break;
   case'link':[p.from,p.to].forEach(x=>{if(!known(x))E.push(`${at}: "${x}" is not on the board or added earlier.`)});if(p.from===p.to)E.push(`${at}: an item can’t link to itself.`);if(p.label!=null&&(typeof p.label!=='string'||p.label.length>60))E.push(`${at}: "label" must be text under 60 characters.`);break;
   case'comment':if(!known(p.on))E.push(`${at}: "on" must be an item id.`);if(!txt(p.text,600))E.push(`${at}: "text" must be 1 to 600 characters.`);break;
   default:E.push(`${at}: unknown op "${p.op}". Use add, update, delete, link or comment.`)}});
 return E.slice(0,25)}
const fixMsg=E=>`Your reply didn't match the format. Fix these and reply again with the whole JSON in one \`\`\`json block:\n${E.map(e=>'- '+e).join('\n')}`;
function applyOps(o,by){const b=WB.B,before=snap(b),map={},added=[],adds=o.ops.filter(p=>p.op==='add');
 const base=bbox([...WB.sel].map(rectOf).filter(Boolean))||bbox(Object.keys(b.nodes).map(rectOf)),c=centerWorld(),ax=base?base.x+base.w+140:c.x-300,ay=base?base.y:c.y-200;
 // no col/row from the AI: rank by links among the new items, then stack each rank
 if(adds.some(p=>p.col==null||p.row==null)){const rk={};adds.forEach(p=>rk[p.id]=0);for(let k=0;k<adds.length;k++)o.ops.forEach(p=>{if(p.op==='link'&&p.from in rk&&p.to in rk)rk[p.to]=Math.max(rk[p.to],Math.min(30,rk[p.from]+1))});
  const rows={};adds.forEach(p=>{p.col=rk[p.id];p.row=rows[p.col]=(rows[p.col]??-1)+1})}
 const ref=id=>map[id]||id;
 o.ops.forEach(p=>{
  if(p.op==='add'){const id=uid(),[,w,h]=TYPES[p.type];b.nodes[id]={id,type:p.type,text:p.text.trim(),x:snapv(ax+p.col*280),y:snapv(ay+p.row*170),w,h,color:p.color||(p.type==='sticky'?'amber':'none'),u:0};map[p.id]=id;added.push(id)}
  else if(p.op==='update'){const n=b.nodes[p.id];if(!n)return;if(p.text!=null)n.text=p.text.trim();if(p.type)n.type=p.type;if(p.color)n.color=p.color}
  else if(p.op==='delete'){if(b.nodes[p.id])delNodes(b,[p.id]);else delete b.edges[p.id]}
  else if(p.op==='link'){const a=ref(p.from),t=ref(p.to);if(b.nodes[a]&&b.nodes[t]&&!Object.values(b.edges).some(e=>e.a===a&&e.b===t))link(b,a,t,(p.label||'').trim())}
  else if(p.op==='comment'){const on=ref(p.on);if(b.nodes[on]){const id=uid();b.comments[id]={id,on,by:by,me:'ai',text:p.text.trim(),t:now(),u:0}}}});
 if(!commit(before)){toast('The AI suggested no changes');return}
 WB.sel=new Set(added);WB.esel.clear();if(added.length)fitTo(added);drawSel();
 toast(`Applied ${o.ops.length} change${o.ops.length===1?'':'s'} from ${esc(by)}`,()=>undo())}
async function runAI(){const b=WB.B;if(AIS.busy||!b)return;AIS.busy=true;AIS.errs=[];AIS.say='';AIS.ctrl=new AbortController();panelDraw();const P=PROV[wbs().prov];
 try{let user=opsPrompt('md').replace(/## Role\n[^\n]*\n\n/,'').replace(/\n\n## Reply format[\s\S]*$/,'');let txt=await aiCall(ROLE+'\n\n'+SPEC,user,{signal:AIS.ctrl.signal}),o=parseReply(txt),E=check(o,b);
  if(E.length){txt=await aiCall(ROLE+'\n\n'+SPEC,user+'\n\n## Your previous reply\n'+txt.slice(0,6000)+'\n\n'+fixMsg(E),{signal:AIS.ctrl.signal});o=parseReply(txt);E=check(o,b)}
  if(E.length){AIS.errs=E;AIS.reply=txt}else{AIS.say=typeof o.say==='string'?o.say:'';applyOps(o,P[0])}}
 catch(e){if(e.name!=='AbortError')AIS.errs=[e.message||String(e)]}
 AIS.busy=false;AIS.ctrl=null;panelDraw()}

/* ---------------- rendering ---------------- */
const btn=(act,data,icon,label,extra='')=>`<button class="wb-b" data-act="${act}" ${data} aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${ic(icon)}</button>`;
function vBench(id){
 if(!LIST){loadList().then(()=>{if(cur.p==='bench')render(false)});return'<p class="muted" style="padding:40px">Loading…</p>'}
 WB.B=null;if(!id)return listHTML();
 const m=/^([ev])~([A-Za-z0-9]{10,64})~([A-Za-z0-9_-]{40,})$/.exec(id);
 if(m){const key=fromUrl(m[3]),known=m[1]==='v'?WB.views[m[2]]:LIST.find(x=>x.cloud&&x.cloud.doc===m[2]);
  if(known&&m[1]==='e'&&known.id){history.replaceState(null,'','#/bench/'+known.id);cur.id=known.id;return openB(known)}
  if(known)return openB(known);
  join(m[1],m[2],key).then(b=>{if(cur.p!=='bench'||cur.id!==id)return;if(!b.ro){history.replaceState(null,'','#/bench/'+b.id);cur.id=b.id}render(false)}).catch(e=>{toast(esc(e.message||String(e)));if(cur.id===id)go('bench')});
  return`<div class="wb"><div class="wb-cv"></div><p class="muted" style="position:absolute;inset:45% 0 auto;text-align:center">Opening the shared board…</p></div>`}
 const b=LIST.find(x=>x.id===id);if(!b)return`<header class="ph"><div><h1>Not found</h1><div class="data">That board isn’t on this device</div></div></header><a class="btn" href="#/bench">All boards</a>`;
 return openB(b)}
function openB(b){if(b.cloud&&!Object.getOwnPropertyDescriptor(b,'ro'))Object.defineProperty(b,'ro',{get(){return needLogin(this)},configurable:true,enumerable:false});if(WB.lastB!==b){WB.hist=[];WB.fut=[];WB.sel=new Set();WB.esel=new Set();WB.edit=null;WB.lastB=b;WB.panel=null;WB.lastErr=''}WB.B=b;setSt(b.cloud?'ok':'off');return boardHTML(b)}
function listHTML(){return`<header class="ph"><div><h1>Workbench</h1><div class="data">Ideas, workflows and architectures · with any AI</div></div><div class="ph-r">${gear()}</div></header>
 <section class="rv"><div class="wb-tpls">${TPLS.map(([k,n,d,i])=>`<button class="wb-tpl" data-act="wbNew" data-tpl="${k}">${ic(i)}<b>${n}</b><small>${d}</small></button>`).join('')}</div>
 <div class="actions left"><button class="btn sm" data-act="wbJoin">${ic('link')}Open a shared link</button><label class="btn sm">${ic('up')}Import a board<input type="file" accept=".json,application/json" data-file="wbImport" hidden></label></div></section>
 ${boardSecs()}`}
/* the dashboard groups boards by who can see them */
function boardSecs(){const L=LIST.slice().sort((a,c)=>(c.u||0)-(a.u||0)),byMe=L.filter(b=>b.cloud&&mine(b.cloud.owner)),withMe=L.filter(b=>b.cloud&&!mine(b.cloud.owner)),local=L.filter(b=>!b.cloud);
 if(!L.length)return`<section class="rv"><div class="st-h"><h3>Your boards</h3></div><p class="muted small">No boards yet. Pick a start above.</p></section>`;
 const sec=(t,sub,A)=>A.length?`<section class="rv"><div class="st-h"><h3>${t}</h3><span class="data">${sub}</span></div><div class="wb-grid">${A.map(cardHTML).join('')}</div></section>`:'';
 return sec('Shared by you',`${byMe.length} board${byMe.length===1?'':'s'} · live for anyone with the link`,byMe)+sec('Shared with you',`${withMe.length} board${withMe.length===1?'':'s'}`,withMe)+sec(byMe.length||withMe.length?'On this device only':'Your boards',byMe.length||withMe.length?'not shared':'',local)}
function cardHTML(b){const ns=Object.values(b.nodes),es=edgesOk(b).length;
 return`<div class="wb-card" data-act="wbOpen" data-id="${b.id}" role="button" tabindex="0">${mini(b)}<b>${esc(b.title)}</b><span class="data">${ns.length} item${ns.length===1?'':'s'} · ${es} link${es===1?'':'s'} · ${rel(b.u||b.created)}${b.cloud?' · shared':''}</span><button class="ibtn" data-act="wbCardMenu" data-id="${b.id}" aria-label="Board options">${ic('more')}</button></div>`}
function mini(b){const ns=Object.values(b.nodes);if(!ns.length)return'<div class="wb-mini"></div>';const bb=bbox(ns),p=60,N=b.nodes,c=n=>[n.x+n.w/2,n.y+n.h/2];
 return`<svg class="wb-mini" viewBox="${bb.x-p} ${bb.y-p} ${bb.w+2*p} ${bb.h+2*p}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${edgesOk(b).map(e=>{const[x1,y1]=c(N[e.a]),[x2,y2]=c(N[e.b]);return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--line-2)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`}).join('')}
 ${ns.map(n=>`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" style="fill:${n.type==='frame'?'none':`color-mix(in srgb,${COLORS[n.color]||COLORS.none} 40%,var(--surface-2))`};stroke:color-mix(in srgb,${COLORS[n.color]||COLORS.none} 50%,transparent)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`}
function boardHTML(b){const ro=!!b.ro;
 return`<div class="wb" id="wb">
 <div class="wb-cv" id="wbcv" tabindex="-1" aria-label="Board canvas"><div class="wb-w" id="wbw"><svg class="wb-e" id="wbe"><defs>${['a','s'].map(k=>`<marker id="wbar${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--${k==='a'?'muted':'accent'})"/></marker>`).join('')}</defs><g id="wbeg"></g><path id="wbtmp" class="ln tmp" d=""/></svg><div id="wbn"></div></div><div class="wb-mq" id="wbmq"></div></div>
 <div class="wb-top"><div class="wb-bar"><a class="wb-b" href="#/bench" aria-label="All boards" title="All boards">${ic('back')}</a>${ro?`<span class="wb-ttl">${esc(b.title)}</span>${needLogin(b)?`<button class="wb-b wb-signin" data-act="wbLogin">${ic('lock')}<span>Sign in to edit</span></button>`:`<span class="wb-tag">${ic('eye')}View only</span>`}`:`<input class="wb-ttl" id="wbttl" value="${esc(b.title)}" maxlength="80" aria-label="Board name">`}<span class="wb-who" id="wbwho"></span><span class="wb-st" id="wbst"></span></div>
 <div class="wb-sp"></div><div class="wb-bar">${ro?'':pbtn('ai','wbspark','AI')}${pbtn('prompt','wbprompt','Prompt')}${pbtn('comments','wbcom','Comments')}${pbtn('share','wbshare','Share')}${btn('wbMore','','more','More')}</div></div>
 ${ro?'':`<div class="wb-tools wb-bar" id="wbtools">${btn('wbTool','data-t="select"','wbptr','Select (drag empty space to box-select)')}${btn('wbTool','data-t="hand"','wbhand','Pan (or hold Space)')}<span class="wb-sep"></span><button class="wb-b wb-addb" data-act="wbPop" data-p="add" aria-haspopup="dialog" aria-expanded="false" title="Add an item">${ic('plus')}<span>Add</span></button>${btn('wbAdd','data-t="sticky"','wbsticky','Add a sticky note')}<span class="wb-sep"></span>${btn('wbTool','data-t="link"','link','Connect: tap one item, then another')}</div>`}
 <div class="wb-zm wb-bar">${ro?'':btn('wbUndo','','wbundo','Undo (Ctrl+Z)','id="wbun"')+btn('wbRedo','','wbredo','Redo (Ctrl+Shift+Z)','id="wbre"')}${btn('wbZoom','data-d="-1"','minus','Zoom out 5%')}<input type="range" class="wb-zr" id="wbzr" min="15" max="300" step="1" value="100" aria-label="Zoom"><button class="wb-b z" data-act="wbZoom" data-d="0" id="wbz" title="Back to 100%">100%</button>${btn('wbZoom','data-d="1"','plus','Zoom in 5%')}${btn('wbFit','','wbfit','Fit the board (Shift+1)')}${btn('wbPop','data-p="view"','grid','Background and snapping','aria-haspopup="dialog" aria-expanded="false"')}${btn('wbFull','','wbfs','Full screen','id="wbfull"')}</div>
 <div class="wb-sb wb-bar" id="wbsb"></div><div class="wb-pop wb-bar" id="wbpop" role="dialog" aria-label="Choose"></div><aside class="wb-side" id="wbside" aria-label="Board panel"></aside></div>`}
const pbtn=(p,icon,label)=>`<button class="wb-b" data-act="wbPanel" data-p="${p}" aria-label="${label}" title="${label}">${ic(icon)}<span class="lb">${label}</span>${p==='comments'?'<span class="n" id="wbcn"></span>':''}</button>`;
function nodeHTML(n,ro){const t=TYPES[n.type]?n.type:'card',cm=Object.values(WB.B.comments).filter(c=>c.on===n.id).length;
 return`<div class="wn t-${t}${n.done?' done':''}${n.halo?' halo':''}${WB.sel.has(n.id)?' sel':''}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;min-height:${n.h}px;--nc:${COLORS[n.color]||COLORS.none};--hc:${n.color&&n.color!=='none'&&COLORS[n.color]?COLORS[n.color]:'var(--accent)'}">${t==='task'?`<button class="wn-ck" data-ck aria-label="Mark done">${n.done?ic('check'):''}</button>`:''}${KTAG[t]?`<div class="wn-k">${KTAG[t]}</div>`:''}<div class="wn-t">${esc(n.text)}</div>${cm?`<span class="wn-b">${cm}</span>`:''}${ro?'':'<i class="wn-h" data-h title="Drag to connect"></i><i class="wn-r" data-r></i>'}</div>`}
function draw(){const b=WB.B,box=$('#wbn');if(!b||!box)return;WB.pending=false;const ns=Object.values(b.nodes).sort((p,q)=>(q.type==='frame')-(p.type==='frame'));
 box.innerHTML=ns.map(n=>nodeHTML(n,b.ro)).join('');WB.els=new Map([...box.children].map(el=>[el.dataset.id,el]));
 [...WB.sel].forEach(id=>{if(!b.nodes[id])WB.sel.delete(id)});[...WB.esel].forEach(id=>{if(!b.edges[id])WB.esel.delete(id)});
 drawEdges();drawSel();drawWho();const t=$('#wbttl');if(t&&document.activeElement!==t)t.value=b.title;
 const cn=$('#wbcn');if(cn){const n=Object.keys(b.comments).length;cn.textContent=n||''}
 const un=$('#wbun'),re=$('#wbre');if(un){un.disabled=!WB.hist.length;re.disabled=!WB.fut.length}
 const sn=$('#wbsnap');if(sn)sn.classList.toggle('on',WB.snap);
 document.querySelectorAll('#wbtools [data-act=wbTool]').forEach(x=>x.classList.toggle('on',x.dataset.t===(WB.tool||'select')));
 if(WB.panel)panelDraw(true)}
function ends(a,c){const ac={x:a.x+a.w/2,y:a.y+a.h/2},cc={x:c.x+c.w/2,y:c.y+c.h/2},dx=cc.x-ac.x,dy=cc.y-ac.y;
 if(Math.abs(dx)/(a.w+c.w)>Math.abs(dy)/(a.h+c.h)){const s=Math.sign(dx)||1;return[{x:ac.x+s*a.w/2,y:ac.y,nx:s,ny:0},{x:cc.x-s*c.w/2,y:cc.y,nx:-s,ny:0}]}
 const s=Math.sign(dy)||1;return[{x:ac.x,y:ac.y+s*a.h/2,nx:0,ny:s},{x:cc.x,y:cc.y-s*c.h/2,nx:0,ny:-s}]}
function curve(p,q){const d=Math.max(30,Math.hypot(q.x-p.x,q.y-p.y)/2.6),c1={x:p.x+p.nx*d,y:p.y+p.ny*d},c2={x:q.x+(q.nx||0)*d,y:q.y+(q.ny||0)*d};
 return{d:`M${p.x} ${p.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${q.x} ${q.y}`,m:{x:(p.x+3*c1.x+3*c2.x+q.x)/8,y:(p.y+3*c1.y+3*c2.y+q.y)/8}}}
function drawEdges(){const g=$('#wbeg');if(!g)return;g.innerHTML=edgesOk(WB.B).map(e=>{const a=rectOf(e.a),c=rectOf(e.b),[p,q]=ends(a,c),k=curve(p,q),s=WB.esel.has(e.id);
 return`<g data-eid="${e.id}" class="${s?'sel':''}"><path class="hit" d="${k.d}"/><path class="ln" d="${k.d}" marker-end="url(#wbar${s?'s':'a'})"/>${e.label?`<text x="${k.m.x}" y="${k.m.y}">${esc(e.label)}</text>`:''}</g>`}).join('')}
function drawWho(){const el=$('#wbwho'),b=WB.B;if(!el||!b)return;const L=Object.entries(b.who||{}).filter(([k,v])=>k!==ME&&v.t>now()-90e3);
 const hue=s=>[...s].reduce((a,c)=>a+c.charCodeAt(0),0)%360;el.innerHTML=L.slice(0,5).map(([k,v])=>`<span style="background:hsl(${hue(k)} 70% 70%)" title="${esc(v.n)} is here">${esc((v.n||'?')[0].toUpperCase())}</span>`).join('');el.title=L.length?`${L.length} other${L.length===1?'':'s'} here now`:''}
const GRIDS=[['dots','Dots'],['grid','Grid'],['fine','Grid + blocks'],['cross','Crosses'],['iso','Triangles'],['lines','Lined paper'],['none','Plain']];
const gmode=()=>{const m=S.settings.wbGrid||'dots';return GRIDS.some(g=>g[0]===m)?m:'dots'};
function gcol(){const c=getComputedStyle(document.documentElement),t=(c.getPropertyValue('--text').trim()||'#888').replace(/'/g,'');/* derived from the text colour on every draw, so it follows theme switches and shows on light themes */return[`${t}' fill-opacity='.34' stroke-opacity='.34`,`${t}' stroke-opacity='.13`]}
function gridSvg(m,g){const[a,b]=gcol(),u=(w,h,body)=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`,r=Math.max(.8,Math.min(1.6,g/14));
 if(m==='dots')return[u(g,g,`<circle cx='${g/2}' cy='${g/2}' r='${r}' fill='${a}'/>`),g,g];
 if(m==='grid')return[u(g,g,`<path d='M${g} 0V${g}H0' fill='none' stroke='${b}' stroke-width='1'/>`),g,g];
 if(m==='fine'){const G=g*5;let d='';for(let i=1;i<5;i++)d+=`M${i*g} 0V${G}M0 ${i*g}H${G}`;return[u(G,G,`<path d='${d}' fill='none' stroke='${b}' stroke-width='1'/><path d='M${G} 0V${G}H0' fill='none' stroke='${a}' stroke-width='1.2'/>`),G,G]}
 if(m==='cross'){const c=g/2,k=Math.max(2.5,g/7);return[u(g,g,`<path d='M${c-k} ${c}H${c+k}M${c} ${c-k}V${c+k}' stroke='${a}' stroke-width='1.1'/>`),g,g]}
 if(m==='iso'){const h=g*Math.sqrt(3);return[u(g,h,`<circle cx='0' cy='0' r='${r}' fill='${a}'/><circle cx='${g}' cy='0' r='${r}' fill='${a}'/><circle cx='${g/2}' cy='${h/2}' r='${r}' fill='${a}'/><circle cx='0' cy='${h}' r='${r}' fill='${a}'/><circle cx='${g}' cy='${h}' r='${r}' fill='${a}'/>`),g,h]}
 if(m==='lines')return[u(g,g,`<path d='M0 ${g-.5}H${g}' stroke='${b}' stroke-width='1'/>`),g,g];return['none',g,g]}
function applyView(){const v=WB.B&&WB.B.vp,w=$('#wbw'),cv=$('#wbcv');if(!v||!w)return;w.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`;
 const g=GRID*v.z*(v.z<.5?5:1),[img,gw,gh]=gridSvg(gmode(),g);cv.style.backgroundImage=img;cv.style.backgroundSize=`${gw}px ${gh}px`;cv.style.backgroundPosition=`${v.x}px ${v.y}px`;
 const z=$('#wbz');if(z)z.textContent=Math.round(v.z*100)+'%';const zr=$('#wbzr');if(zr&&document.activeElement!==zr)zr.value=Math.round(v.z*100);placeSb()}
function zoomStep(dir,sx,sy){const v=WB.B.vp,c=Math.round(v.z*100),n=dir>0?(Math.floor(c/5)+1)*5:(Math.ceil(c/5)-1)*5;zoomAt(Math.max(15,Math.min(300,n))/100/v.z,sx,sy)}
function zoomCenter(){const cv=$('#wbcv');return[cv.clientWidth/2,cv.clientHeight/2]}
/* pop-overs (Add, Background) */
function popHTML(p){if(p==='add')return`<div class="wb-pt">Add to the board</div><div class="wb-pg">${Object.entries(TYPES).map(([k,v])=>`<button class="wb-po" data-act="wbAddPop" data-t="${k}">${ic(v[3])}<b>${v[0]}</b><small>${DESC[k]||''}</small></button>`).join('')}</div>`;
 if(p==='view')return`<div class="wb-pt">Background</div><div class="wb-pg g">${GRIDS.map(([k,n])=>`<button class="wb-po${gmode()===k?' on':''}" data-act="wbGrid" data-g="${k}" aria-pressed="${gmode()===k}"><i class="wb-gp" style="background-image:${gridSvg(k,14)[0].replace(/"/g,"'")};background-size:${gridSvg(k,14)[1]}px ${gridSvg(k,14)[2]}px"></i><b>${n}</b></button>`).join('')}</div><label class="wb-tg"><span>Snap items to the grid</span><input type="checkbox" id="wbsnapc" ${WB.snap?'checked':''}></label>`;return''}
function popOpen(p,anchor){const el=$('#wbpop'),wb=$('#wb');if(!el||!wb)return;if(WB.pop===p&&el.classList.contains('on'))return popClose();popClose();WB.pop=p;el.innerHTML=popHTML(p);el.classList.add('on');
 const r=anchor.getBoundingClientRect(),o=wb.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;let x=r.left+r.width/2-o.left-w/2;x=Math.max(10,Math.min(o.width-w-10,x));let y=r.top-o.top-h-10;if(y<10)y=r.bottom-o.top+10;el.style.left=x+'px';el.style.top=y+'px';anchor.setAttribute('aria-expanded','true')}
function popClose(){WB.pop=null;const el=$('#wbpop');if(el)el.classList.remove('on');document.querySelectorAll('[data-act=wbPop]').forEach(b=>b.setAttribute('aria-expanded','false'))}
document.addEventListener('pointerdown',e=>{if(WB.pop&&!(e.target.closest&&e.target.closest('#wbpop,[data-act=wbPop]')))popClose()},true);
document.addEventListener('change',e=>{if(e.target&&e.target.id==='wbsnapc'){WB.snap=e.target.checked;toast(WB.snap?'Snap to grid on':'Snap to grid off')}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='wbzr'&&WB.B&&WB.B.vp){const[cx,cy]=zoomCenter();zoomAt((+e.target.value/100)/WB.B.vp.z,cx,cy)}});
document.addEventListener('wheel',e=>{if(!(e.target&&e.target.id==='wbzr')||!WB.B)return;e.preventDefault();const[cx,cy]=zoomCenter();zoomStep(e.deltaY<0?1:-1,cx,cy)},{passive:false});
/* full screen: the browser's, or the app's immersive mode */
function fsSet(on){const R=document.documentElement;R.classList.toggle('wb-fs',on);try{if(on){if(R.requestFullscreen&&!document.fullscreenElement&&!NATIVE)R.requestFullscreen().catch(()=>{})}else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}try{NATIVE&&NATIVE.immersive&&NATIVE.immersive(!!on)}catch(e){}
 const b=$('#wbfull');if(b){b.innerHTML=ic(on?'wbunfs':'wbfs');b.title=b.ariaLabel=on?'Exit full screen':'Full screen'}}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.documentElement.classList.contains('wb-fs'))fsSet(false)});
addEventListener('hashchange',()=>{if(!/^#\/bench\//.test(location.hash)&&document.documentElement.classList.contains('wb-fs'))fsSet(false);popClose()});
function centerWorld(){const cv=$('#wbcv'),v=WB.B.vp||{x:0,y:0,z:1};const w=cv?cv.clientWidth:innerWidth,h=cv?cv.clientHeight:innerHeight;return{x:(w/2-v.x)/v.z,y:(h/2-v.y)/v.z}}
function fitTo(ids,anim){const cv=$('#wbcv'),b=WB.B;if(!cv)return;const bb=bbox((ids||Object.keys(b.nodes)).map(rectOf).filter(Boolean));const W=cv.clientWidth,H=cv.clientHeight;
 if(!bb){b.vp={x:W/2,y:H/2,z:1};applyView();return}const pad=W<600?40:110,z=Math.max(.15,Math.min(1.2,(W-pad*2)/bb.w,(H-pad*2-60)/bb.h));
 b.vp={z,x:W/2-(bb.x+bb.w/2)*z,y:H/2+20-(bb.y+bb.h/2)*z};applyView()}
function zoomAt(f,sx,sy){const v=WB.B.vp,z=Math.max(.15,Math.min(3,v.z*f));const k=z/v.z;v.x=sx-(sx-v.x)*k;v.y=sy-(sy-v.y)*k;v.z=z;applyView()}
/* selection toolbar */
let SBK='';
function drawSel(){const b=WB.B;if(!b)return;WB.els.forEach((el,id)=>el.classList.toggle('sel',WB.sel.has(id)));document.querySelectorAll('#wbeg [data-eid]').forEach(g=>{const s=WB.esel.has(g.dataset.eid);g.classList.toggle('sel',s);g.querySelector('.ln').setAttribute('marker-end',`url(#wbar${s?'s':'a'})`)});
 const sb=$('#wbsb');if(!sb)return;if(b.ro||(!WB.sel.size&&!WB.esel.size)){sb.classList.remove('on');SBK='';return}
 const key=[...WB.sel,...WB.esel].join()+'|'+[...WB.sel].map(id=>b.nodes[id]&&b.nodes[id].color+b.nodes[id].type+(b.nodes[id].halo?'h':'')).join();
 if(key!==SBK){SBK=key;if(WB.sel.size){const ns=[...WB.sel].map(id=>b.nodes[id]),c0=ns[0].color,t0=ns.every(n=>n.type===ns[0].type)?ns[0].type:'';
   sb.innerHTML=Object.entries(COLORS).map(([k,v])=>`<button class="wb-dot${ns.every(n=>n.color===k)?' on':''}" style="--c:${k==='none'?'var(--surface-2)':v}" data-act="wbColor" data-c="${k}" aria-label="Color ${k}" title="${k}"></button>`).join('')
   +`<span class="wb-sep"></span><select id="wbtype" aria-label="Item type">${t0?'':'<option value="">Mixed</option>'}${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${k===t0?'selected':''}>${v[0]}</option>`).join('')}</select><span class="wb-sep"></span>`
   +btn('wbHalo','',  'wbglow',ns.every(n=>n.halo)?'Turn off the glow':'Glow: highlight with a halo',ns.every(n=>n.halo)?'aria-pressed="true" style="color:var(--acc-ink,var(--accent))"':'aria-pressed="false"')+(WB.sel.size>1?'<span class="wb-sep"></span>'+[['l','wbal','Align left'],['c','wbac','Align centres'],['r','wbar','Align right'],['t','wbat','Align tops'],['m','wbam','Align middles'],['b','wbab','Align bottoms']].map(([a,i,l])=>btn('wbAlign',`data-a="${a}"`,i,l)).join('')+(WB.sel.size>2?btn('wbAlign','data-a="dh"','wbdh','Space evenly across')+btn('wbAlign','data-a="dv"','wbdv','Space evenly down'):'')+'<span class="wb-sep"></span>':'')+(WB.sel.size===1?btn('wbEdit','','edit','Edit text (Enter)'):'')+btn('wbPanel','data-p="comments"','wbcom','Comment')+btn('wbAskSel','','wbspark','Ask AI about the selection')+btn('wbDupSel','','copy','Duplicate (Ctrl+D)')+btn('wbDelSel','','trash','Delete (Del)');void c0}
  else sb.innerHTML=btn('wbEdgeLabel','','edit','Edit label')+btn('wbEdgeRev','','horz','Reverse direction')+btn('wbDelSel','','trash','Delete link');}
 sb.classList.toggle('on',!WB.G);placeSb()}
function placeSb(){const sb=$('#wbsb'),b=WB.B;if(!sb||!b||!sb.classList.contains('on'))return;const v=b.vp;let bb;
 if(WB.sel.size)bb=bbox([...WB.sel].map(rectOf).filter(Boolean));else{const e=b.edges[[...WB.esel][0]];if(!e||!b.nodes[e.a]||!b.nodes[e.b])return;const[p,q]=ends(rectOf(e.a),rectOf(e.b)),m=curve(p,q).m;bb={x:m.x,y:m.y,w:0,h:0}}
 if(!bb)return;const cv=$('#wbcv'),W=cv.clientWidth,x=Math.max(sb.offsetWidth/2+10,Math.min(W-sb.offsetWidth/2-10,v.x+(bb.x+bb.w/2)*v.z));let y=v.y+bb.y*v.z;if(y-sb.offsetHeight-14<70)y=v.y+(bb.y+bb.h)*v.z+sb.offsetHeight+28;
 sb.style.left=x+'px';sb.style.top=y+'px'}

/* ---------------- panels ---------------- */
function panelClose(){if(!WB.panel)return;WB.panel=null;panelDraw()}
function panelDraw(soft){const el=$('#wbside'),b=WB.B;if(!el||!b)return;document.querySelectorAll('[data-act=wbPanel]').forEach(x=>{if(x.closest('#wbsb'))return;x.classList.toggle('on',x.dataset.p===WB.panel)});
 if(!WB.panel){el.classList.remove('on');return}
 if(soft&&el.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
 const head=t=>`<h3>${t}<button class="wb-b" data-act="wbPanel" data-p="${WB.panel}" aria-label="Close panel">✕</button></h3>`;let h='';
 if(WB.panel==='ai')h=head('AI on this board')+aiHTML();
 else if(WB.panel==='prompt')h=head('Prompt studio')+promptHTML();
 else if(WB.panel==='comments')h=head('Comments')+commentsHTML();
 else if(WB.panel==='share')h=head('Share')+shareHTML();
 el.innerHTML=h;el.classList.add('on')}
const chips=(items,act,val,attr='k')=>`<div class="wb-chips">${items.map(([k,n])=>`<button class="wb-chip${k===val?' on':''}" data-act="${act}" data-${attr}="${k}">${esc(n)}</button>`).join('')}</div>`;
function scopeHTML(){const n=WB.sel.size;return chips([['board','Whole board'],['sel',n?`Selected (${n})`:'Selected (none)']],'wbScope',n?AIS.scope:'board','s')}
function aiHTML(){const s=wbs(),P=PROV[s.prov],api=s.mode==='api',t=TARGETS[s.target]||TARGETS.claude;
 return`<p class="small muted">Ask any AI to add, link, rework or comment on this board. Every change can be undone.</p>
 ${chips([['api','Direct to an AI'],['copy','Copy & paste (any chat app)']],'wbAiMode',s.mode,'m')}
 <label class="lbl">What should it do?</label>${chips(PRESETS.map(p=>[p[0],p[1]]),'wbPreset',AIS.preset)}
 <textarea id="wbaitext" placeholder="${AIS.preset==='free'?'Say what you want, e.g. “Map the onboarding flow for a halal savings app”':'Optional: add your own notes or constraints'}">${esc(AIS.text)}</textarea>
 <label class="lbl">Look at</label>${scopeHTML()}
 ${api?`<div class="actions left"><button class="btn pri" data-act="wbRun" ${AIS.busy?'disabled':''}>${ic('wbspark')}${AIS.busy?'Thinking…':'Run with '+esc(P[0].split(' (')[0])}</button>${AIS.busy?'<button class="btn" data-act="wbStop">Stop</button>':''}</div><p class="wb-hint">Model: ${esc(provModel(s.prov)||'not set')} · <button class="link" data-act="wbAiSet">Change AI</button></p>`
 :`<label class="lbl">1 · Pick the AI you’ll paste into</label>${chips(Object.entries(TARGETS).map(([k,v])=>[k,v[0]]),'wbTarget',s.target,'t')}
  <div class="actions left"><button class="btn pri" data-act="wbCopyPrompt">${ic('copy')}Copy prompt</button>${t[1]?`<a class="btn" href="${t[1]}" target="_blank" rel="noopener noreferrer">Open ${esc(t[0])} ${ic('ext','ico-s')}</a>`:''}</div>
  <label class="lbl">2 · Paste its whole reply</label><textarea id="wbaireply" placeholder="Paste the AI’s full answer here">${esc(AIS.reply)}</textarea>
  <div class="actions left"><button class="btn pri" data-act="wbApply">Apply to board</button></div>`}
 ${AIS.errs.length?`<div class="errbox"><b>That didn’t work yet</b><ul>${AIS.errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>${api&&!AIS.reply?'':`<div class="actions left"><button class="btn sm pri" data-act="wbCopyFix">${ic('copy')}Copy fix-it message</button></div><p class="wb-hint">Paste it into the same chat, then paste the new reply above.</p>`}</div>`:''}
 ${AIS.say?`<div class="wb-say">${esc(AIS.say)}</div>`:''}
 <details class="wb-sec"${s.mode==='api'&&!keyOf(s.prov)&&!['ollama','custom','plotline'].includes(s.prov)?' open':''} id="wbaiset"><summary class="lbl" style="cursor:pointer">AI settings</summary>${aiSetHTML()}</details>`}
function aiSetHTML(){const s=wbs(),p=s.prov,P=PROV[p];
 return`<div class="field"><label>Provider</label><select id="wbprov">${Object.entries(PROV).map(([k,v])=>`<option value="${k}" ${k===p?'selected':''}>${esc(v[0])}</option>`).join('')}</select></div>
 ${P[1]==='plotline'?`<p class="wb-hint">Uses the server set on the Ask page (Settings → Insights). ${typeof insSet==='function'&&insSet().url?'Current: '+esc(insSet().url):'Not set yet.'}</p>`:`
 <div class="field"><label>Model</label><input id="wbmodel" list="wbmodels" value="${esc(provModel(p))}" placeholder="model id" autocomplete="off" spellcheck="false"><datalist id="wbmodels">${P[4].map(m=>`<option value="${esc(m)}">`).join('')}</datalist></div>
 ${p==='custom'||p==='ollama'?`<div class="field"><label>Server address</label><input id="wburl" value="${esc(provUrl(p))}" placeholder="https://…/v1" spellcheck="false"></div>`:''}
 <div class="field"><label>API key${p==='ollama'?' (not needed)':''}</label><input id="wbkey" type="password" value="${esc(keyOf(p))}" placeholder="${keyOf(p)?'':'Paste your key'}" autocomplete="off" spellcheck="false"></div>
 <p class="wb-hint">${ic('lock','ico-s')} Your key stays on this device only. It is never synced, shared or put in a board. Calls go straight from this browser to ${esc(P[0])}.${P[5]?` <a href="${P[5]}" target="_blank" rel="noopener noreferrer">Get a key</a>`:''}${p==='ollama'?' Start Ollama with OLLAMA_ORIGINS=* so the browser may reach it.':''}</p>`}
 <div class="actions left"><button class="btn sm" data-act="wbTest">Test connection</button></div>`}
function promptHTML(){const s=wbs(),t=TARGETS[s.ptarget]||TARGETS.claude,ro=WB.B.ro;AIS.pout=AIS.pout||studioPrompt();
 return`<p class="small muted">Turn this board into a well-built prompt for any AI, take it there, and bring the answer back as a note.</p>
 <label class="lbl">Goal</label>${chips(PGOALS.map(g=>[g[0],g[1]]),'wbPGoal',s.pgoal)}
 <label class="lbl">For</label>${chips(Object.entries(TARGETS).map(([k,v])=>[k,v[0]]),'wbPTarget',s.ptarget,'t')}
 <label class="lbl">Look at</label>${scopeHTML()}
 <textarea id="wbptext" placeholder="Optional: anything else the AI should know" style="min-height:60px">${esc(AIS.ptext)}</textarea>
 <label class="lbl">Prompt · edit freely</label><textarea id="wbpout" style="min-height:200px;font:400 12.5px/1.5 var(--f-mono)">${esc(AIS.pout)}</textarea>
 <div class="actions left"><button class="btn pri" data-act="wbPCopy">${ic('copy')}Copy</button>${t[1]?`<a class="btn" href="${t[1]}" target="_blank" rel="noopener noreferrer">Open ${esc(t[0])} ${ic('ext','ico-s')}</a>`:''}${wbs().mode==='api'?`<button class="btn" data-act="wbPRun" ${AIS.busy?'disabled':''}>${AIS.busy?'Thinking…':'Run here'}</button>`:''}<button class="btn sm ghost" data-act="wbPRegen">Rebuild</button></div>
 ${ro?'':`<label class="lbl">Bring the answer back</label><textarea id="wbpans" placeholder="Paste the answer here">${esc(AIS.pans)}</textarea><div class="actions left"><button class="btn" data-act="wbPNote">${ic('wbcard')}Add to board as a card</button></div>`}`}
function commentsHTML(){const b=WB.B,one=WB.sel.size===1?[...WB.sel][0]:null,L=Object.values(b.comments).filter(c=>b.nodes[c.on]&&(!one||c.on===one)).sort((p,q)=>p.t-q.t);
 const short=id=>esc(trunc(b.nodes[id].text.split('\n')[0]||'(untitled)',40));
 return`<p class="small muted">${one?`On “${short(one)}”. <button class="link" data-act="wbSelClear">Show all</button>`:'Select an item to comment on it.'}</p>
 ${L.length?L.map(c=>`<div class="wb-cm"><b>${esc(c.by)}</b> <small class="muted">${rel(c.t)}${one?'':` · on <button class="link" data-act="wbGo" data-id="${c.on}">${short(c.on)}</button>`}</small>${c.me===ME&&!b.ro?` <button class="link" data-act="wbCDel" data-id="${c.id}" style="float:right">Delete</button>`:''}<p>${esc(c.text)}</p></div>`).join(''):'<p class="muted small">No comments yet.</p>'}
 ${one&&!b.ro?`<form data-form="wbCom" class="wb-sec">${myName()?'':'<div class="field"><label>Your name</label><input name="name" maxlength="40" required autocomplete="nickname"></div>'}<textarea name="text" placeholder="Write a comment" required maxlength="1000" style="min-height:70px"></textarea><div class="actions left"><button class="btn pri sm">Post</button></div></form>`:''}`}
function shareHTML(){const b=WB.B;
 if(needLogin(b))return`<p class="small">Anyone can look at this board with the link, but changing it needs a Plotline account, so every edit has a name on it.</p><div class="actions left"><button class="btn pri" data-act="wbLogin">${ic('lock')}Sign in to edit</button></div>`;
 if(b.ro)return`<p class="small">You’re viewing a read-only link. It updates live as the owner works.</p><div class="sh-what">${ic('lock')}<div><b>Private by design</b><small>This board is encrypted. The key is only in your link, after the #, which is never sent to any server. Search engines and bots can’t find or read it.</small></div></div>`;
 if(!b.cloud)return`<p class="small muted">This board lives only on this device right now.</p>
 <div class="sh-what">${ic('lock')}<div><b>Unlisted, encrypted links</b><small>Sharing puts an end-to-end encrypted copy in the cloud and gives you a long, unguessable link. The key lives only in the link, after the #, which browsers never send to any server, so Google, link previews and bots can’t find or read the board.</small></div></div>
 <div class="actions left"><button class="btn pri" data-act="wbShare" ${fsOK()?'':'disabled'}>${ic('wbshare')}Create share link</button></div>${fsOK()?'':'<p class="wb-hint">Sharing isn’t available in this version.</p>'}`;
 const own=mine(b.cloud.owner),n=Object.entries(b.who||{}).filter(([k,v])=>k!==ME&&v.t>now()-90e3).length;
 const row=(id,url)=>`<div class="wb-row"><input id="${id}" readonly value="${esc(url)}" aria-label="Link"><button class="btn sm" data-act="wbCopyLink" data-k="${id}">${ic('copy')}Copy</button></div>`;
 return`<p class="small">${n?`<b>${n} other${n===1?'':'s'}</b> here now. `:''}Changes sync live.</p>
 <label class="lbl">Collaborate · anyone with this link can view, edit and comment</label>${row('wbl1',linkOf('e',b.cloud.doc,b.cloud.key))}
 <label class="lbl">Public · view only, updates live</label>${b.pub?row('wbl2',linkOf('v',b.pub.doc,b.pub.key))+(own?`<div class="actions left"><button class="btn sm ghost" data-act="wbViewOff">Turn off view link</button></div>`:''):own?`<div class="actions left"><button class="btn sm" data-act="wbViewOn">${ic('eye')}Create view-only link</button></div>`:'<p class="wb-hint">Only the person who shared this board can make a view-only link.</p>'}
 <div class="sh-what">${ic('lock')}<div><b>Who can get in</b><small>Only people you give a link to. Links carry a 256-bit key after the #, so they can’t be guessed, searched or indexed, and the cloud only stores ciphertext. Anyone holding a link can open it, so share it only where you mean to.</small></div></div>
 <div class="actions left">${own?`<button class="btn sm ghost" data-act="wbUnshare">Stop sharing</button>`:`<button class="btn sm ghost" data-act="wbLeave">Remove from this device</button>`}</div>`}

/* ---------------- canvas input ---------------- */
const PTS=new Map();let SPACE=false;
const world=e=>{const r=$('#wbcv').getBoundingClientRect(),v=WB.B.vp;return{x:(e.clientX-r.left-v.x)/v.z,y:(e.clientY-r.top-v.y)/v.z}};
function mount(){const cv=$('#wbcv');if(!cv||cv._m||!WB.B)return;cv._m=1;const b=WB.B;
 cv.addEventListener('pointerdown',pdown);cv.addEventListener('pointermove',pmove);cv.addEventListener('pointerup',pup);cv.addEventListener('pointercancel',pup);cv.addEventListener('dblclick',dbl);
 cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();if(e.ctrlKey||e.metaKey){WB.wacc=(WB.wacc||0)+e.deltaY;if(Math.abs(WB.wacc)>=24){zoomStep(WB.wacc<0?1:-1,e.clientX-r.left,e.clientY-r.top);WB.wacc=0}}else{b.vp.x-=e.deltaX;b.vp.y-=e.deltaY;applyView()}},{passive:false});
 cv.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('.wn-t[contenteditable]'))finishEdit()});
 const t=$('#wbttl');if(t)t.addEventListener('input',()=>{b.title=t.value.slice(0,80)||'Untitled board';b.tu=now();b.u=now();persist();pushSoon(800)});
 const side=$('#wbside');side.addEventListener('input',e=>{const id=e.target.id;if(id==='wbaitext')AIS.text=e.target.value;else if(id==='wbaireply')AIS.reply=e.target.value;else if(id==='wbptext'){AIS.ptext=e.target.value;AIS.pout=studioPrompt();const o=$('#wbpout');if(o)o.value=AIS.pout}else if(id==='wbpout')AIS.pout=e.target.value;else if(id==='wbpans')AIS.pans=e.target.value;
  else if(id==='wbmodel'){wbs().models[wbs().prov]=e.target.value.trim();save()}else if(id==='wburl'){wbs().urls[wbs().prov]=e.target.value.trim();save()}else if(id==='wbkey')keySet(wbs().prov,e.target.value.trim())});
 side.addEventListener('change',e=>{if(e.target.id==='wbprov'){wbs().prov=e.target.value;save();panelDraw();const d=$('#wbaiset');if(d)d.open=true}});
 $('#wbsb').addEventListener('change',e=>{if(e.target.id==='wbtype'&&e.target.value){const before=snap(b);[...WB.sel].forEach(id=>{const n=b.nodes[id];if(n)n.type=e.target.value});commit(before)}});
 const fresh=!b.vp;if(fresh)b.vp={x:0,y:0,z:1};draw();if(fresh)fitTo();applyView();panelDraw();
 /* a re-render (e.g. after a setting is saved) rebuilds the board: keep an open pop-over open */
 if(WB.pop){const k=WB.pop,a=document.querySelector(`[data-act=wbPop][data-p=${k}]`);WB.pop=null;if(a)popOpen(k,a)}
 if(b.cloud&&!pushing)pull(b,!b.ro&&!b.cloud.ut).catch(e=>setSt('err',e.message))}
function pdown(e){const b=WB.B;if(!b||e.button===2)return;PTS.set(e.pointerId,{x:e.clientX,y:e.clientY});const cv=$('#wbcv');
 if(PTS.size===2){WB.tap0=null;if(WB.G&&WB.G.before)commit(WB.G.before);const[a,c]=[...PTS.values()];WB.G={k:'pinch',d:Math.hypot(a.x-c.x,a.y-c.y),m:{x:(a.x+c.x)/2,y:(a.y+c.y)/2}};$('#wbmq').style.display='none';return}
 if(e.target.closest('.wn-t[contenteditable]'))return;if(WB.edit)finishEdit();
 const n=e.target.closest('.wn'),id=n&&n.dataset.id,p=world(e),ed=e.target.closest('[data-eid]');
 const panNow=WB.tool==='hand'||SPACE||e.button===1;
 WB.tap0=!id&&!ed&&PTS.size===1?{x:e.clientX,y:e.clientY}:null;
 if(!panNow&&!b.ro){
  if(e.target.closest('[data-ck]')&&id){const before=snap(b);b.nodes[id].done=!b.nodes[id].done;commit(before);return}
  if(e.target.closest('[data-h]')&&id){WB.G={k:'link',from:id,p};cv.setPointerCapture(e.pointerId);return}
  if(e.target.closest('[data-r]')&&id){const nn=b.nodes[id];WB.G={k:'resize',id,p0:p,w:nn.w,h:nn.h,before:snap(b)};cv.setPointerCapture(e.pointerId);return}
  if(id&&WB.tool==='link'){if(!WB.linkFrom||WB.linkFrom===id){WB.linkFrom=id;WB.sel=new Set([id]);drawSel();toast('Now tap the item to connect to')}else{const before=snap(b);link(b,WB.linkFrom,id);WB.linkFrom=null;commit(before)}return}
  if(id){if(e.shiftKey||e.ctrlKey||e.metaKey){WB.sel.has(id)?WB.sel.delete(id):WB.sel.add(id)}else if(!WB.sel.has(id))WB.sel=new Set([id]);WB.esel.clear();
   const ids=new Set([...WB.sel].filter(x=>b.nodes[x]));[...ids].forEach(fid=>{const f=b.nodes[fid];if(f.type!=='frame')return;Object.values(b.nodes).forEach(o=>{const r=rectOf(o.id);if(o.id!==fid&&r.x+r.w/2>f.x&&r.x+r.w/2<f.x+f.w&&r.y+r.h/2>f.y&&r.y+r.h/2<f.y+(rectOf(fid).h))ids.add(o.id)})});
   WB.G={k:'drag',p0:p,ids:[...ids],o:[...ids].map(x=>[b.nodes[x].x,b.nodes[x].y]),moved:false,before:snap(b)};drawSel();cv.setPointerCapture(e.pointerId);return}
  if(ed){WB.esel=new Set([ed.dataset.eid]);WB.sel.clear();drawSel();return}}
 if(panNow||e.pointerType==='touch'||b.ro){WB.G={k:'pan',s:{x:e.clientX,y:e.clientY},v:{...b.vp},tap:!id&&!ed};cv.classList.add('panning')}
 else{if(!e.shiftKey){WB.sel.clear();WB.esel.clear();drawSel()}WB.G={k:'mq',p0:p,base:new Set(WB.sel)}}
 cv.setPointerCapture(e.pointerId)}
function pmove(e){const b=WB.B,G=WB.G;if(!b)return;if(PTS.has(e.pointerId))PTS.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!G)return;const cv=$('#wbcv');
 if(G.k==='pinch'){if(PTS.size<2)return;const[a,c]=[...PTS.values()],d=Math.hypot(a.x-c.x,a.y-c.y),m={x:(a.x+c.x)/2,y:(a.y+c.y)/2},r=cv.getBoundingClientRect();b.vp.x+=m.x-G.m.x;b.vp.y+=m.y-G.m.y;zoomAt(d/G.d,m.x-r.left,m.y-r.top);G.d=d;G.m=m;return}
 if(G.k==='pan'){b.vp.x=G.v.x+e.clientX-G.s.x;b.vp.y=G.v.y+e.clientY-G.s.y;if(Math.abs(e.clientX-G.s.x)+Math.abs(e.clientY-G.s.y)>6)G.tap=false;applyView();return}
 const p=world(e);
 if(G.k==='drag'){const dx=p.x-G.p0.x,dy=p.y-G.p0.y;if(!G.moved&&Math.hypot(dx,dy)*b.vp.z<4)return;if(!G.moved){G.moved=true;$('#wbsb').classList.remove('on')}
  G.ids.forEach((id,i)=>{const n=b.nodes[id],el=WB.els.get(id);n.x=snapv(G.o[i][0]+dx);n.y=snapv(G.o[i][1]+dy);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}});drawEdges();return}
 if(G.k==='resize'){const n=b.nodes[G.id],el=WB.els.get(G.id);n.w=Math.max(80,snapv(G.w+p.x-G.p0.x));n.h=Math.max(40,snapv(G.h+p.y-G.p0.y));el.style.width=n.w+'px';el.style.minHeight=n.h+'px';drawEdges();return}
 if(G.k==='link'){const a=rectOf(G.from),hov=document.elementFromPoint(e.clientX,e.clientY),t=hov&&hov.closest('.wn');WB.els.forEach(el=>el.classList.toggle('drop',el===t&&t.dataset.id!==G.from));
  const q={x:p.x,y:p.y,nx:0,ny:0},[s]=ends(a,{x:p.x-1,y:p.y-1,w:2,h:2});$('#wbtmp').setAttribute('d',curve(s,q).d);return}
 if(G.k==='mq'){const x=Math.min(p.x,G.p0.x),y=Math.min(p.y,G.p0.y),w=Math.abs(p.x-G.p0.x),h=Math.abs(p.y-G.p0.y),v=b.vp,mq=$('#wbmq');
  Object.assign(mq.style,{display:'block',left:v.x+x*v.z+'px',top:v.y+y*v.z+'px',width:w*v.z+'px',height:h*v.z+'px'});
  WB.sel=new Set(G.base);Object.keys(b.nodes).forEach(id=>{const r=rectOf(id);if(r.x<x+w&&r.x+r.w>x&&r.y<y+h&&r.y+r.h>y&&b.nodes[id].type!=='frame')WB.sel.add(id)});drawSel()}}
function pup(e){PTS.delete(e.pointerId);const t0=WB.tap0;WB.tap0=null;if(t0&&WB.panel&&Math.hypot(e.clientX-t0.x,e.clientY-t0.y)<6)panelClose();const b=WB.B,G=WB.G;if(!b||!G)return;const cv=$('#wbcv');cv.classList.remove('panning');
 if(G.k==='pinch'){if(PTS.size===0)WB.G=null;else{const[q]=[...PTS.values()];WB.G={k:'pan',s:q,v:{...b.vp}}}return}
 WB.G=null;
 if(G.k==='pan'&&G.tap&&e.pointerType==='touch'){WB.sel.clear();WB.esel.clear();drawSel()}
 if(G.k==='drag'&&G.moved)commit(G.before);
 if(G.k==='resize')commit(G.before);
 if(G.k==='link'){$('#wbtmp').setAttribute('d','');WB.els.forEach(el=>el.classList.remove('drop'));const hov=document.elementFromPoint(e.clientX,e.clientY),t=hov&&hov.closest('.wn'),before=snap(b);
  if(t&&t.dataset.id!==G.from){if(!Object.values(b.edges).some(x=>x.a===G.from&&x.b===t.dataset.id))link(b,G.from,t.dataset.id);commit(before)}
  else if(!t){const p=world(e),src=b.nodes[G.from],type=['frame','text'].includes(src.type)?'card':src.type,[,w,h]=TYPES[type];if(Math.hypot(p.x-G.p.x,p.y-G.p.y)>40){const id=uid();b.nodes[id]={id,type,text:'',x:snapv(p.x-w/2),y:snapv(p.y-h/2),w,h,color:src.color,u:0};link(b,G.from,id);commit(before);WB.sel=new Set([id]);drawSel();startEdit(id)}}}
 if(G.k==='mq')$('#wbmq').style.display='none';
 if(WB.pending)draw();else drawSel()}
function dbl(e){const b=WB.B,tg=document.elementFromPoint(e.clientX,e.clientY)||e.target;if(!b||b.ro||tg.closest('.wn-t[contenteditable]'))return;const n=tg.closest('.wn'),ed=tg.closest('[data-eid]');
 if(n)return startEdit(n.dataset.id);if(ed){WB.esel=new Set([ed.dataset.eid]);return ACT.wbEdgeLabel()}
 const p=world(e);addNode('sticky',p)}
function addNode(type,at,text=''){const b=WB.B,before=snap(b),[,w,h]=TYPES[type],c=at||centerWorld(),off=at?0:(WB.cascade=(WB.cascade+1)%6)*GRID*1.5,id=uid();
 b.nodes[id]={id,type,text,x:snapv(c.x-w/2+off),y:snapv(c.y-h/2+off),w,h,color:type==='sticky'?'amber':'none',u:0};commit(before);WB.sel=new Set([id]);WB.esel.clear();drawSel();if(!text)startEdit(id);return id}
function startEdit(id){const el=WB.els.get(id),b=WB.B;if(!el||b.ro)return;const t=el.querySelector('.wn-t');WB.edit={id,before:snap(b)};
 try{t.contentEditable='plaintext-only'}catch(e){t.contentEditable='true'}if(t.contentEditable!=='plaintext-only')t.contentEditable='true';
 $('#wbsb').classList.remove('on');t.focus({preventScroll:true});const r=document.createRange();r.selectNodeContents(t);const s=getSelection();s.removeAllRanges();s.addRange(r)}
function finishEdit(){const E=WB.edit;if(!E)return;WB.edit=null;const b=WB.B,el=WB.els.get(E.id),n=b.nodes[E.id];if(!el||!n){draw();return}const t=el.querySelector('.wn-t');
 n.text=t.innerText.replace(/ /g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,4000);t.removeAttribute('contenteditable');if(!commit(E.before))draw()}
/* clipboard: items copy between boards; plain text pastes as a card */
let CLIP=null;
document.addEventListener('copy',e=>{if(!onBoard()||busyField(e.target)||!WB.sel.size)return;const b=WB.B,ids=new Set(WB.sel);CLIP={n:[...ids].map(id=>b.nodes[id]),e:Object.values(b.edges).filter(x=>ids.has(x.a)&&ids.has(x.b)),m:'plotline-wb:'+uid()};e.clipboardData.setData('text/plain',CLIP.n.map(n=>n.text).join('\n\n')+'\n'+CLIP.m);e.preventDefault()});
document.addEventListener('paste',e=>{if(!onBoard()||busyField(e.target)||WB.B.ro)return;const txt=e.clipboardData.getData('text/plain')||'';e.preventDefault();if(CLIP&&txt.includes(CLIP.m))return pasteItems(CLIP,40);if(txt.trim())addNode('card',null,txt.trim().slice(0,4000))});
function pasteItems(c,off){const b=WB.B,before=snap(b),map={};c.n.forEach(n=>{const id=uid();map[n.id]=id;b.nodes[id]={...n,id,x:n.x+off,y:n.y+off}});c.e.forEach(x=>link(b,map[x.a],map[x.b],x.label));commit(before);WB.sel=new Set(Object.values(map));drawSel()}
const onBoard=()=>cur.p==='bench'&&WB.B&&$('#wbcv')&&!$('#sheet').classList.contains('on');
const busyField=t=>t&&t.closest&&t.closest('input,textarea,select,[contenteditable]');
addEventListener('keydown',e=>{if(!onBoard())return;const t=e.target,b=WB.B,k=e.key,mod=e.ctrlKey||e.metaKey;
 if(t.closest&&t.closest('.wn-t[contenteditable]')){if(k==='Escape'||(k==='Enter'&&mod)){e.preventDefault();t.blur()}return}
 if(busyField(t))return;
 if(e.code==='Space'&&!SPACE){SPACE=true;$('#wbcv').classList.add('pan');e.preventDefault();return}
 if(k==='!'||(e.shiftKey&&e.code==='Digit1')){e.preventDefault();fitTo();return}
 if(!mod&&(k==='='||k==='+')){zoomAt(1.2,innerWidth/2,innerHeight/2);return}if(!mod&&k==='-'){zoomAt(1/1.2,innerWidth/2,innerHeight/2);return}
 if(k==='Escape'&&WB.pop){popClose();return}
 if(k==='Escape'&&WB.panel&&!WB.sel.size&&!WB.esel.size){panelClose();return}
 if(b.ro)return;
 if(mod&&k.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
 else if(mod&&k.toLowerCase()==='y'){e.preventDefault();redo()}
 else if(mod&&k.toLowerCase()==='a'){e.preventDefault();WB.sel=new Set(Object.keys(b.nodes));drawSel()}
 else if(mod&&k.toLowerCase()==='d'){e.preventDefault();ACT.wbDupSel()}
 else if(k==='Delete'||k==='Backspace'){if(WB.sel.size||WB.esel.size){e.preventDefault();ACT.wbDelSel()}}
 else if(k==='Enter'&&WB.sel.size===1){e.preventDefault();startEdit([...WB.sel][0])}
 else if(k==='Escape'){WB.sel.clear();WB.esel.clear();WB.linkFrom=null;drawSel()}
 else if(k.startsWith('Arrow')&&WB.sel.size){e.preventDefault();const s=e.shiftKey?GRID*2:WB.snap?GRID:1,dx=k==='ArrowLeft'?-s:k==='ArrowRight'?s:0,dy=k==='ArrowUp'?-s:k==='ArrowDown'?s:0,before=snap(b);WB.sel.forEach(id=>{b.nodes[id].x+=dx;b.nodes[id].y+=dy});commit(before)}
 else if(!mod&&!e.altKey&&k==='n'){e.preventDefault();addNode('sticky')}});
addEventListener('keyup',e=>{if(e.code==='Space'){SPACE=false;const cv=$('#wbcv');if(cv)cv.classList.remove('pan')}});
addEventListener('resize',()=>{if(onBoard())placeSb()});

/* ---------------- actions ---------------- */
const B=()=>WB.B;
const dl=(name,txt,type)=>download(name,txt,type);
const fileName=b=>(b.title.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'board').slice(0,60);
function printBoard(b){const ns=Object.values(b.nodes);if(!ns.length)return toast('The board is empty');const bb=bbox(ns.map(n=>rectOf(n.id)||n)),p=40,hex=n=>{const c=COLORS[n.color];return c&&c[0]==='#'?c:'#8a8f9c'};
 const ed=edgesOk(b).map(e=>{const[q1,q2]=ends(rectOf(e.a),rectOf(e.b)),k=curve(q1,q2);return`<path d="${k.d}" fill="none" stroke="#666" stroke-width="1.6" marker-end="url(#ar)"/>${e.label?`<text x="${k.m.x}" y="${k.m.y}" font-size="12" text-anchor="middle" fill="#333" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(e.label)}</text>`:''}`}).join('');
 const nd=ns.sort((x,y)=>(y.type==='frame')-(x.type==='frame')).map(n=>{const r=rectOf(n.id)||n,c=hex(n);return`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="${n.type==='frame'?'none':n.type==='sticky'?c+'33':'#fff'}" stroke="${c}" stroke-width="${n.halo?3:1.4}" ${n.type==='frame'?'stroke-dasharray="6 5"':''}/><foreignObject x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"><div xmlns="http://www.w3.org/1999/xhtml" style="padding:12px 14px;font:${n.type==='text'?'700 20px':'13px'}/1.4 sans-serif;color:#111;white-space:pre-wrap;overflow-wrap:anywhere">${KTAG[n.type]?`<div style="font:600 9px monospace;letter-spacing:.08em;text-transform:uppercase;color:${c};margin-bottom:4px">${KTAG[n.type]}</div>`:''}${n.done?'✓ ':''}${esc(n.text)}</div></foreignObject>`}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bb.x-p} ${bb.y-p} ${bb.w+2*p} ${bb.h+2*p}" style="width:100%;height:auto;max-height:180mm;border:1px solid #ddd;border-radius:8px"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#666"/></marker></defs>${ed}${nd}</svg>`;
 const out=typeof window.printDoc==='function'?window.printDoc:null;if(!out)return toast('Printing isn’t available');out(b.title,`<h1>${esc(b.title)}</h1><p class="m">${ns.length} items · ${edgesOk(b).length} links</p>${svg}<h2>Outline</h2><pre style="white-space:pre-wrap;font:12.5px/1.5 ui-monospace,monospace">${esc(md(b))}</pre>`)}
const exportJSON=b=>dl(fileName(b)+'.plotline-board.json',JSON.stringify({format:'plotline-board',version:1,title:b.title,nodes:b.nodes,edges:b.edges,comments:b.comments},null,1),'application/json');
const md=b=>`# ${b.title}\n\n${outline(b,'board').replace(/^Board: .*\n\n/,'')}\n`;
function dupBoard(b){const n={...blank(b.title+' (copy)'),nodes:JSON.parse(JSON.stringify(b.nodes)),edges:JSON.parse(JSON.stringify(b.edges)),comments:JSON.parse(JSON.stringify(b.comments))};LIST.unshift(n);persist();return n}
function delBoard(b,cloudToo){const i=LIST.indexOf(b);if(i>=0)LIST.splice(i,1);S.dead=S.dead||{};S.dead[b.id]=now();save();persist();if(cloudToo&&b.cloud&&mine(b.cloud.owner)){cdel(b.cloud.doc,b.cloud.owner);if(b.pub)cdel(b.pub.doc,b.cloud.owner)}
 toast(`Deleted “${esc(trunc(b.title,30))}”`,cloudToo?null:()=>{LIST.splice(Math.max(0,i),0,b);b.u=now();delete S.dead[b.id];save();persist();if(cur.p==='bench')render(false)})}
Object.assign(ACT,{
 wbNew:d=>{const t=TPLS.find(x=>x[0]===d.tpl)||TPLS[0],b=blank(t[0]==='blank'?'Untitled board':t[1]);t[4](b);LIST.unshift(b);persist();go('bench/'+b.id)},
 wbOpen:(d,el,e)=>{if(e&&e.target.closest('[data-act=wbCardMenu]'))return;go('bench/'+d.id)},
 wbCardMenu:(d,el,e)=>{if(e)e.stopPropagation();const b=LIST.find(x=>x.id===d.id);if(!b)return;const own=b.cloud&&mine(b.cloud.owner);
  openSheet(`<div class="data">Board</div><h2 style="margin-top:6px">${esc(b.title)}</h2><form data-form="wbRename" data-id="${b.id}"><div class="field"><label>Name</label><input name="t" value="${esc(b.title)}" maxlength="80"></div><div class="actions left"><button class="btn sm pri">Rename</button></div></form>
  <div class="actions left"><button class="btn pri" data-act="wbCardShare" data-id="${b.id}">${ic('wbshare')}${b.cloud?'Share link':'Share'}</button><button class="btn" data-act="wbDupB" data-id="${b.id}">${ic('copy')}Duplicate</button><button class="btn" data-act="wbExp" data-id="${b.id}">${ic('down')}Export file</button><button class="btn" data-act="wbDelB" data-id="${b.id}">${ic('trash')}Delete${b.cloud?' from this device':''}</button>${own?`<button class="btn" data-act="wbDelB" data-id="${b.id}" data-cloud="1">${ic('trash')}Delete everywhere</button>`:''}</div>`)},
 wbCardShare:async d=>{const b=LIST.find(x=>x.id===d.id);if(!b)return;
  if(!b.cloud){try{toast('Creating a private link…');await shareOn(b);render(false)}catch(e){toast(esc(e.message||String(e)));return}}
  const url=linkOf('e',b.cloud.doc,b.cloud.key);
  openSheet(`<div class="data">Share</div><h2 style="margin-top:6px">${esc(b.title)}</h2><p class="small muted">Anyone with this link can view, edit and comment. It’s end-to-end encrypted; the key is only in the link.</p><div class="wb-row"><input id="wbcl" readonly value="${esc(url)}" aria-label="Link"><button class="btn sm" data-act="wbCopyLink" data-k="wbcl">${ic('copy')}Copy</button></div>${navigator.share?`<div class="actions left"><button class="btn" data-act="wbSendLink" data-k="wbcl">${ic('wbshare')}Send…</button></div>`:''}`)},
 wbSendLink:d=>{const i=$('#'+d.k);if(i)navigator.share({title:'Plotline board',url:i.value}).catch(()=>{})},
 wbDupB:d=>{const b=LIST.find(x=>x.id===d.id);if(!b)return;closeSheet();dupBoard(b);render(false);toast('Duplicated')},
 wbExp:d=>{const b=LIST.find(x=>x.id===d.id);if(b)exportJSON(b)},
 wbDelB:d=>{const b=LIST.find(x=>x.id===d.id);if(!b)return;closeSheet();delBoard(b,!!d.cloud);if(cur.p==='bench'&&cur.id===b.id)go('bench');else render(false)},
 wbJoin:()=>openSheet(`<div class="data">Workbench</div><h2 style="margin-top:6px">Open a shared board</h2><form data-form="wbJoin"><div class="field"><label>Link</label><input name="u" placeholder="Paste the link you were given" autocomplete="off" spellcheck="false" required></div><div class="actions"><button class="btn pri">Open</button></div></form>`),
 wbTool:d=>{WB.tool=d.t==='select'?null:d.t;WB.linkFrom=null;draw();if(d.t==='link')toast('Tap one item, then the item to connect it to')},
 wbAdd:d=>addNode(d.t),
 wbZoom:d=>{const cv=$('#wbcv');if(+d.d===0){const v=B().vp;zoomAt(1/v.z,cv.clientWidth/2,cv.clientHeight/2)}else zoomStep(+d.d,cv.clientWidth/2,cv.clientHeight/2)},
 wbPop:(d,el)=>popOpen(d.p,el),
 wbAddPop:d=>{popClose();addNode(d.t)},
 wbGrid:d=>{S.settings.wbGrid=d.g;save();applyView();const el=$('#wbpop');if(el&&WB.pop==='view')el.innerHTML=popHTML('view')},
 wbFull:()=>fsSet(!document.documentElement.classList.contains('wb-fs')),
 wbHalo:()=>{const b=B(),before=snap(b),ns=[...WB.sel].map(id=>b.nodes[id]).filter(Boolean),on=!ns.every(n=>n.halo);ns.forEach(n=>{if(on)n.halo=true;else delete n.halo});commit(before)},
 wbAlign:d=>{const b=B(),before=snap(b),ids=[...WB.sel].filter(id=>b.nodes[id]),R0=ids.map(rectOf),bb=bbox(R0);if(!bb||ids.length<2)return;
  if(d.a==='dh'||d.a==='dv'){const h=d.a==='dh',L=ids.map((id,i)=>({n:b.nodes[id],r:R0[i]})).sort((p,q)=>h?p.r.x-q.r.x:p.r.y-q.r.y),tot=L.reduce((a,o)=>a+(h?o.r.w:o.r.h),0),gap=((h?bb.w:bb.h)-tot)/(L.length-1);let at=h?bb.x:bb.y;L.forEach(o=>{if(h)o.n.x=Math.round(at);else o.n.y=Math.round(at);at+=(h?o.r.w:o.r.h)+gap})}
  else ids.forEach((id,i)=>{const n=b.nodes[id],r=R0[i];if(d.a==='l')n.x=bb.x;else if(d.a==='r')n.x=bb.x+bb.w-r.w;else if(d.a==='c')n.x=Math.round(bb.x+bb.w/2-r.w/2);else if(d.a==='t')n.y=bb.y;else if(d.a==='b')n.y=bb.y+bb.h-r.h;else if(d.a==='m')n.y=Math.round(bb.y+bb.h/2-r.h/2)});
  commit(before)},
 wbPrint:()=>{closeSheet();if(NATIVE||typeof printPage!=='function')printBoard(B());else printPage()},
 wbLogin:async()=>{if(typeof shReady!=='function')return toast('Sign in from Settings → Sync');const ok=await shReady();if(ok&&signedIn()){toast('Signed in. You can edit now');render(false)}},
 wbFit:()=>fitTo(),wbUndo:undo,wbRedo:redo,
 wbSnap:()=>{WB.snap=!WB.snap;draw();toast(WB.snap?'Snap to grid on':'Snap to grid off')},
 wbPanel:d=>{WB.panel=WB.panel===d.p?null:d.p;if(WB.panel==='prompt')AIS.pout=studioPrompt();if(WB.panel==='ai'&&WB.sel.size)AIS.scope='sel';panelDraw()},
 wbMore:()=>{const b=B();openSheet(`<div class="data">Board</div><h2 style="margin-top:6px">${esc(b.title)}</h2>
  <div class="actions left"><button class="btn" data-act="wbPrint">${ic('print')}Print or PDF</button><button class="btn" data-act="wbExpCur">${ic('down')}Export file</button><button class="btn" data-act="wbMd">${ic('copy')}Copy as Markdown</button>${b.ro?'':`<button class="btn" data-act="wbDupCur">${ic('copy')}Duplicate board</button><button class="btn" data-act="wbDelCur">${ic('trash')}Delete board</button>`}</div>
  <details class="panel" style="margin-top:18px"><summary>Keyboard and touch</summary><p class="small muted" style="line-height:1.8">Double-click empty space: new sticky · Double-click or Enter: edit text · Drag the dot on an item’s edge: connect (drop on empty space to create a linked item) · Drag empty space: box-select · Space+drag, middle mouse or two fingers: pan · Ctrl+scroll or pinch: zoom · Shift+1: fit · Ctrl+Z / Ctrl+Shift+Z: undo / redo · Ctrl+D: duplicate · Ctrl+C / Ctrl+V: copy and paste items (plain text pastes as a card) · Arrows: nudge · N: new sticky · Delete: remove</p></details>`)},
 wbExpCur:()=>exportJSON(B()),
 wbMd:async()=>{toast(await copyText(md(B()))?'Copied as Markdown':'Couldn’t copy')},
 wbDupCur:()=>{closeSheet();const n=dupBoard(B());go('bench/'+n.id)},
 wbDelCur:()=>{const b=B();closeSheet();delBoard(b,false);go('bench')},
 wbColor:d=>{const b=B(),before=snap(b);WB.sel.forEach(id=>{b.nodes[id].color=d.c});commit(before)},
 wbEdit:()=>{if(WB.sel.size===1)startEdit([...WB.sel][0])},
 wbDupSel:()=>{const b=B();if(!WB.sel.size)return;const ids=new Set(WB.sel);pasteItems({n:[...ids].map(id=>b.nodes[id]),e:Object.values(b.edges).filter(x=>ids.has(x.a)&&ids.has(x.b))},40)},
 wbDelSel:()=>{const b=B(),before=snap(b);delNodes(b,[...WB.sel]);WB.esel.forEach(id=>delete b.edges[id]);WB.sel.clear();WB.esel.clear();if(commit(before))toast('Deleted',()=>undo())},
 wbAskSel:()=>{AIS.scope='sel';AIS.preset='expand';WB.panel='ai';panelDraw()},
 wbEdgeLabel:()=>{const e=B().edges[[...WB.esel][0]];if(!e)return;openSheet(`<div class="data">Link</div><h2 style="margin-top:6px">Label</h2><form data-form="wbLabel" data-id="${e.id}"><div class="field"><input name="l" value="${esc(e.label||'')}" maxlength="60" placeholder="e.g. yes, sends data, depends on"></div><div class="actions"><button class="btn pri">Save</button></div></form>`);setTimeout(()=>{const i=$('#sheet input[name=l]');if(i)i.focus()},80)},
 wbEdgeRev:()=>{const b=B(),before=snap(b);WB.esel.forEach(id=>{const e=b.edges[id];[e.a,e.b]=[e.b,e.a]});commit(before)},
 wbSelClear:()=>{WB.sel.clear();drawSel();panelDraw()},
 wbGo:d=>{WB.sel=new Set([d.id]);fitTo([d.id]);drawSel();panelDraw()},
 wbCDel:d=>{const b=B(),before=snap(b);delete b.comments[d.id];commit(before)},
 wbAiMode:d=>{wbs().mode=d.m;save();AIS.errs=[];panelDraw()},
 wbPreset:d=>{AIS.preset=d.k;panelDraw()},
 wbScope:d=>{if(d.s==='sel'&&!WB.sel.size){toast('Select some items on the board first');return}AIS.scope=d.s;AIS.pout=studioPrompt();panelDraw()},
 wbTarget:d=>{wbs().target=d.t;save();panelDraw()},
 wbAiSet:()=>{const x=$('#wbaiset');if(x){x.open=true;x.scrollIntoView({behavior:'smooth'})}},
 wbRun:runAI,wbStop:()=>{if(AIS.ctrl)AIS.ctrl.abort()},
 wbCopyPrompt:async()=>{const t=TARGETS[wbs().target]||TARGETS.claude;toast(await copyText(opsPrompt(t[2]))?`Copied. Paste it into ${t[0]}`:'Couldn’t copy')},
 wbApply:()=>{const o=parseReply(AIS.reply),E=check(o,B());AIS.errs=E;AIS.say='';if(!E.length){AIS.say=typeof o.say==='string'?o.say:'';AIS.reply='';applyOps(o,(TARGETS[wbs().target]||['AI'])[0])}panelDraw()},
 wbCopyFix:async()=>{toast(await copyText(fixMsg(AIS.errs))?'Copied. Paste it into the same chat':'Couldn’t copy')},
 wbTest:async()=>{toast('Testing…');try{const r=await aiCall('Reply with the single word OK.','Are you there?',{json:false});toast('Connected · '+esc(trunc(r.trim()||'(empty reply)',40)))}catch(e){toast(esc(e.message||String(e)))}},
 wbPGoal:d=>{wbs().pgoal=d.k;save();AIS.pout=studioPrompt();panelDraw()},
 wbPTarget:d=>{wbs().ptarget=d.t;save();AIS.pout=studioPrompt();panelDraw()},
 wbPRegen:()=>{AIS.pout=studioPrompt();panelDraw()},
 wbPCopy:async()=>{const t=TARGETS[wbs().ptarget]||TARGETS.claude;toast(await copyText(AIS.pout)?`Copied. Paste it into ${t[0]}`:'Couldn’t copy')},
 wbPRun:async()=>{if(AIS.busy)return;AIS.busy=true;panelDraw();try{AIS.pans=await aiCall('',AIS.pout,{json:false})}catch(e){toast(esc(e.message||String(e)))}AIS.busy=false;panelDraw()},
 wbPNote:()=>{const t=AIS.pans.trim();if(!t){toast('Paste an answer first');return}const b=B(),base=bbox([...WB.sel].map(rectOf).filter(Boolean)),before=snap(b),id=uid(),c=centerWorld();
  b.nodes[id]={id,type:'card',text:t.slice(0,4000),x:snapv(base?base.x+base.w+80:c.x-180),y:snapv(base?base.y:c.y-120),w:360,h:160,color:'violet',u:0};if(base&&WB.sel.size===1)link(b,[...WB.sel][0],id);commit(before);AIS.pans='';WB.sel=new Set([id]);fitTo([id]);drawSel();panelDraw();toast('Added to the board')},
 wbShare:async()=>{const b=B();try{toast('Creating a private link…');await shareOn(b);toast('Shared. Copy the link to invite people')}catch(e){toast(esc(e.message||String(e)))}panelDraw();setSt(b.cloud?'ok':'off')},
 wbViewOn:async()=>{try{await viewOn(B());persist();toast('View-only link ready')}catch(e){B().pub=null;toast(esc(e.message||String(e)))}panelDraw()},
 wbViewOff:async()=>{const b=B();if(b.pub)await cdel(b.pub.doc);b.pub=null;persist();panelDraw();toast('View-only link turned off')},
 wbCopyLink:async d=>{const i=$('#'+d.k);toast(i&&await copyText(i.value)?'Link copied':'Couldn’t copy')},
 wbUnshare:async()=>{const b=B();await cdel(b.cloud.doc);if(b.pub)await cdel(b.pub.doc);b.cloud=null;b.pub=null;persist();setSt('off');panelDraw();toast('Stopped sharing. The board stays on this device')},
 wbLeave:()=>{const b=B();delBoard(b,false);go('bench')}});
Object.assign(FORM,{
 wbRename:f=>{const b=LIST.find(x=>x.id===f.dataset.id);if(!b)return;b.title=(f.t.value.trim()||'Untitled board').slice(0,80);b.tu=now();b.u=now();persist();closeSheet();render(false);if(b.cloud){const k=WB.B;WB.B=b;pushSoon(0);WB.B=k}},
 wbJoin:f=>{const m=/#\/bench\/([ev]~[^\s#]+)/.exec(f.u.value.trim());if(!m){toast('That isn’t a Workbench link');return}closeSheet();go('bench/'+m[1])},
 wbLabel:f=>{const b=B(),e=b.edges[f.dataset.id];if(!e)return;const before=snap(b);e.label=f.l.value.trim().slice(0,60);closeSheet();commit(before)},
 wbCom:f=>{const b=B(),on=[...WB.sel][0],t=f.text.value.trim();if(!on||!t)return;const nm=f.elements.namedItem('name');if(nm&&nm.value.trim()){S.settings.name=nm.value.trim().slice(0,40);save()}
  const before=snap(b),id=uid();b.comments[id]={id,on,by:who(),me:ME,text:t.slice(0,1000),t:now(),u:0};commit(before);panelDraw()}});
FILE.wbImport=inp=>{const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(o.format!=='plotline-board'||typeof o.nodes!=='object')throw 0;
 const b=blank(String(o.title||'Imported board').slice(0,80));['nodes','edges','comments'].forEach(k=>{for(const[id,v]of Object.entries(o[k]||{}))if(v&&typeof v==='object'&&v.id===id)b[k][id]={...v,u:now()}});
 for(const id in b.nodes){const n=b.nodes[id];if(!TYPES[n.type]||!isFinite(n.x)||!isFinite(n.y))delete b.nodes[id];else{n.text=String(n.text||'').slice(0,4000);n.w=+n.w||TYPES[n.type][1];n.h=+n.h||TYPES[n.type][2];if(!COLORS[n.color])n.color='none'}}
 LIST.unshift(b);persist();toast('Imported');go('bench/'+b.id)}catch(e){toast('That isn’t a Plotline board file')}};r.readAsText(f);inp.value=''};

/* ---------------- wiring into the app ---------------- */
VIEWS.bench=vBench;
/* the encrypted-link cloud, shared with Lists (lists.js) */
window.WBC={cget,cput,cdel,signedIn,gs,rnd,toUrl,fromUrl,webBase};
NAV.push(['bench','Workbench','wbbench']);
/* the side rail may already be drawn without this tab (this file loads after boot on slow starts): redraw it */
if(document.querySelector('#rail .nav')&&!document.querySelector('#rail [data-nav=bench]')){buildChrome();if(typeof navMark==='function')navMark()}
{const _r=render;render=function(){if(cur.p!=='bench'){WB.B=null;if(WB.edit)WB.edit=null}_r.apply(this,arguments);const on=cur.p==='bench'&&!!WB.B;document.documentElement.classList.toggle('wb-on',on);if(on)mount();
 let m=document.querySelector('meta[name=robots][data-wb]');if(cur.p==='bench'&&cur.id){if(!m){m=document.createElement('meta');m.name='robots';m.content='noindex,nofollow';m.dataset.wb=1;document.head.appendChild(m)}}else if(m)m.remove()}}
/* people opening a shared link go straight to the board, not the first-run welcome */
{const _w=welcome;welcome=function(){if(/^#\/bench\/[ev]~/.test(location.hash))return;return _w.apply(this,arguments)}}
/* this file can arrive after the app has already booted and routed: catch up */
if(booted&&/^#\/bench/.test(location.hash)&&cur.p!=='bench'){if(/^#\/bench\/[ev]~/.test(location.hash)&&!S.settings.onboarded)closeSheet();route()}
})();
