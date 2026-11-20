// node tools/audit/trace.cjs "<js action>" [setup] : where one action's time goes (scripts, style, layout, paint) at phone size, 4x slower CPU
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), os = require('os');
const [ACTION = "location.hash='#/cal'", SETUP = ''] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe', URL = process.env.URL || 'http://localhost:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9700 + Math.floor(Math.random() * 90), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pltr-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const wait = new Map(), evs = [];
const cmd = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise(ok => wait.set(id, ok)); };
const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return r.result.result?.value; };
(async () => {
  for (let i = 0; i < 40 && !ws; i++) { try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = L.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(250); }
  if (ws.readyState !== 1) await new Promise(ok => ws.onopen = ok);
  let done; const fin = new Promise(ok => done = ok);
  ws.onmessage = m => { const r = JSON.parse(m.data); if (r.method === 'Tracing.dataCollected') evs.push(...r.params.value); if (r.method === 'Tracing.tracingComplete') done(); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cmd('Page.navigate', { url: URL }); for (let i = 0; i < 80; i++) { await sleep(250); if (await ev("!!(window.S&&S.goals&&window.seedDemo)")) break; } await sleep(800);
  await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(3000)}if(!S.goals.length)seedDemo();S.settings.name='Sam';save();closeSheet();${SETUP};return 1})()`); await sleep(2500);
  await cmd('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cmd('Tracing.start', { categories: 'devtools.timeline,blink', options: 'sampling-frequency=10000' });
  const t0 = await ev('performance.now()');
  await ev(`(async()=>{${ACTION};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,400));return 1})()`);
  await cmd('Tracing.end'); await fin;
  const tot = {}, big = [];
  for (const e of evs) { if (e.ph !== 'X' || !e.dur) continue; if (!/^(UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|EvaluateScript|FunctionCall|ParseHTML|RecalculateStyles|HitTest|CommitLoad|TimerFire|FireAnimationFrame|EventDispatch|Commit|RasterTask|Decode Image|ScrollLayer|UpdateLayer|IntersectionObserverController::computeIntersections|v8.compile|ScheduleStyleRecalculation)$/.test(e.name)) continue; tot[e.name] = (tot[e.name] || 0) + e.dur / 1000; if (/UpdateLayoutTree|^Layout$/.test(e.name) && e.dur > 20000) big.push(e.name + ' ' + Math.round(e.dur / 1000) + 'ms ' + JSON.stringify(e.args && (e.args.elementCount ?? e.args.beginData)).slice(0, 160)); }
  console.log(Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => Math.round(v).toString().padStart(6) + '  ' + k).join('\n'));
  console.log(big.slice(0, 12).join('\n'));
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); });
