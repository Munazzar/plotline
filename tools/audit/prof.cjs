// node tools/audit/prof.cjs "<js that does the action>" [label] : CPU profile of one action at phone size, 4x slower CPU
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), os = require('os');
const [ACTION = "location.hash='#/cal'", LABEL = 'action', SETUP = ''] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe', URL = process.env.URL || 'http://localhost:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9900 + Math.floor(Math.random() * 90), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'plprof-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const wait = new Map();
const cmd = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise(ok => wait.set(id, ok)); };
const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return r.result.result?.value; };
(async () => {
  for (let i = 0; i < 40 && !ws; i++) { try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = L.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(250); }
  if (ws.readyState !== 1) await new Promise(ok => ws.onopen = ok); ws.onmessage = m => { const r = JSON.parse(m.data); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cmd("Page.navigate", { url: URL }); for (let i = 0; i < 80; i++) { await sleep(250); try { if (await ev("!!(window.S&&S.goals&&window.seedDemo)")) break; } catch (e) { } } await sleep(800);
  await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(3000)}if(!S.goals.length)seedDemo();S.settings.name='Sam';save();closeSheet();${SETUP};return 1})()`); await sleep(2500);
  await cmd('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 200 }); await cmd('Profiler.start');
  await ev(`(async()=>{${ACTION};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,600));return 1})()`);
  const p = (await cmd('Profiler.stop')).result.profile;
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n); const parent = {}; p.nodes.forEach(n => (n.children || []).forEach(c => parent[c] = n.id));
  const dt = {}; for (let i = 0; i < p.samples.length; i++) dt[p.samples[i]] = (dt[p.samples[i]] || 0) + (p.timeDeltas[i] || 0);
  const self = {}, total = {}; const name = n => (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop() + ':' + (n.callFrame.lineNumber + 1);
  for (const n of p.nodes) { const t = (dt[n.id] || 0) / 1000; if (!t) continue; self[name(n)] = (self[name(n)] || 0) + t; const seen = new Set(); for (let x = n.id; x; x = parent[x]) { const k = name(byId[x]); if (!seen.has(k)) { seen.add(k); total[k] = (total[k] || 0) + t; } } }
  const top = o => Object.entries(o).filter(([k]) => !/^\((idle|program|root|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => String(Math.round(v)).padStart(5) + '  ' + k).join('\n');
  const callers = {}; for (const n of p.nodes) { const t = (dt[n.id] || 0) / 1000; if (!t) continue; const k = name(n); if (!/getPropertyValue|^(anon) :5391|getComputedStyle|offset|getBoundingClientRect/.test(k)) continue; const par = byId[parent[n.id]], g = par && byId[parent[par.id]]; const c = k + '  <-  ' + (par ? name(par) : '?') + '  <-  ' + (g ? name(g) : '?'); callers[c] = (callers[c] || 0) + t; }
  console.log('-- callers of layout/style reads\n' + Object.entries(callers).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => String(Math.round(v)).padStart(5) + '  ' + k).join('\n'));
  console.log(`== ${LABEL}\n-- total (incl. callees)\n${top(total)}\n-- self\n${top(self)}`);
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); });
