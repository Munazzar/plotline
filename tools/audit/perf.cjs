// node tools/audit/perf.cjs [url] [cpuSlowdown=4] : startup, page switches, save cost and GPU-heavy styles, at phone size in headless Chrome
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), os = require('os');
const [URL = 'http://localhost:8765/', SLOW = '4'] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9800 + Math.floor(Math.random() * 100), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'plperf-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const wait = new Map();
const cmd = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise(ok => wait.set(id, ok)); };
async function ev(x) { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result.result?.value; }
(async () => {
  for (let i = 0; i < 40 && !ws; i++) { try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = L.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(250); }
  if (ws.readyState !== 1) await new Promise(ok => ws.onopen = ok); ws.onmessage = m => { const r = JSON.parse(m.data); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
  await cmd('Page.enable'); await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cmd("Page.navigate", { url: URL }); for (let i = 0; i < 80; i++) { await sleep(250); try { if (await ev("!!(window.S&&S.goals&&window.seedDemo)")) break; } catch (e) { } } await sleep(800);
  await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(3000)}if(!S.goals.length)seedDemo();S.settings.name='Sam';${process.env.SETUP||''};save();closeSheet();return 1})()`); await sleep(1500);
  console.error('seeded');
  await cmd('Emulation.setCPUThrottlingRate', { rate: +SLOW });
  /* startup: reload with the data in place */
  await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 500 }); await cmd('Profiler.start');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `window.__T={};new MutationObserver((m,o)=>{const v=document.querySelector('#view');if(v&&v.children.length&&!__T.view){__T.view=performance.now();o.disconnect()}}).observe(document,{subtree:true,childList:true});addEventListener('DOMContentLoaded',()=>__T.dcl=performance.now());addEventListener('load',()=>__T.load=performance.now())` });
  await cmd('Page.reload'); const t0 = Date.now(); await sleep(300);
  for (let i = 0; i < 200; i++) { try { if (await ev(`!!(window.VIEWS&&document.querySelector('#view')&&document.querySelector('#view').children.length)`)) break; } catch (e) { } await sleep(50); }
  console.error('started');
  await sleep(3000); console.log('in-page:', await ev(`JSON.stringify({T:__T,fcp:Math.round((performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0),res:performance.getEntriesByType('resource').sort((a,b)=>b.responseEnd-a.responseEnd).slice(0,8).map(r=>r.name.split('/').pop().slice(0,40)+' '+Math.round(r.startTime)+'-'+Math.round(r.responseEnd)+' '+Math.round(r.transferSize/1024)+'KB')})`));
  const startup = Date.now() - t0;
  { const p = (await cmd('Profiler.stop')).result.profile; const self = {}, byId = {}; p.nodes.forEach(n => byId[n.id] = n); const dt = {}; for (let i = 0; i < p.samples.length; i++) dt[p.samples[i]] = (dt[p.samples[i]] || 0) + (p.timeDeltas[i] || 0);
    for (const n of p.nodes) { const f = n.callFrame, k = (f.functionName || '(anon)') + ' ' + f.url.split('/').pop() + ':' + (f.lineNumber + 1); self[k] = (self[k] || 0) + (dt[n.id] || 0) / 1000; }
    console.log('top self time (ms):\n' + Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => Math.round(v) + '  ' + k).join('\n')); } const nav = await ev(`JSON.stringify((p=>({domInteractive:Math.round(p.domInteractive),domContentLoaded:Math.round(p.domContentLoadedEventEnd),load:Math.round(p.loadEventEnd)}))(performance.getEntriesByType('navigation')[0]))`);
  await sleep(+(process.env.IDLE||2500));
  if (process.env.ONLY_START) { ws.close(); ch.kill(); return; }
  const r = await ev(`(async()=>{const P=await import('${URL}tools/audit/perf.js');const R0=['today','habits','cal','goals','journal','lists','threads','agent','settings'],R=[];for(let k=0;k<3;k++)R0.forEach(p=>R.push(p,'screen'));const sw=await P.switches(R);location.hash='#/today';await new Promise(r=>setTimeout(r,1500));const taps={check:await P.tap('#view .chk'),uncheck:await P.tap('#view .chk'),openHabitPage:await P.tap('#view [data-act=openHabit]')};location.hash='#/habits';await new Promise(r=>setTimeout(r,1500));taps.habitCheck=await P.tap('#view .hrow .chk, #view [data-act=hTick], #view .hck');location.hash='#/journal';await new Promise(r=>setTimeout(r,1500));taps.newEntry=await P.tap('[data-act=addEntry]',1);location.hash='#/goals';await new Promise(r=>setTimeout(r,1500));taps.openGoal=await P.tap('#view [data-act=openGoal], #view a[href^="#/goal/"]');const h={};for(const k of ['today','habits','journal','settings']){location.hash='#/'+k;await new Promise(r=>setTimeout(r,1200));h[k]=P.heavy()}return JSON.stringify({sw,taps,h,save:await P.saveCost()})})()`);
  console.log(JSON.stringify({ startupMs: startup, nav: JSON.parse(nav), ...JSON.parse(r) }, null, 1));
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); });
