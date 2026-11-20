// node tools/audit/eval.cjs <route> "<js expression>" [width=390] [shot.png] : open a page on the example data in headless Chrome and print the expression's value (and save a screenshot)
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), os = require('os');
const [ROUTE = 'today', EXPR = '1', W = '390', SHOT = ''] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe', URL = process.env.URL || 'http://localhost:8765/', sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9700 + Math.floor(Math.random() * 90), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'plev-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const wait = new Map();
const cmd = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise(ok => wait.set(id, ok)); };
const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result?.value; };
(async () => {
  for (let i = 0; i < 40 && !ws; i++) { try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = L.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(250); }
  if (ws.readyState !== 1) await new Promise(ok => ws.onopen = ok); ws.onmessage = m => { const r = JSON.parse(m.data); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
  const phone = +W < 600; await cmd('Emulation.setDeviceMetricsOverride', { width: +W, height: phone ? 844 : 900, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
  if (process.env.PRE) await cmd('Page.enable'), await cmd('Page.addScriptToEvaluateOnNewDocument', { source: process.env.PRE }); await cmd('Page.navigate', { url: URL }); await sleep(4500);
  await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(3000)}if(!S.goals.length)seedDemo();S.settings.name='Sam';${process.env.SETUP||''};save();closeSheet();return 1})()`);
  await ev(`(async()=>{const r=${JSON.stringify(ROUTE)}.replace('{habit}',(S.habits.find(h=>h.kind==='build')||S.habits[0]).id).replace('{goal}',S.goals[0].id);location.hash='#/'+r;await new Promise(r=>setTimeout(r,1800));return 1})()`);
  console.log(JSON.stringify(await ev(`(async()=>{return ${EXPR}})()`), null, 1));
  if (SHOT) { const s = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOT, Buffer.from(s.result.data, 'base64')); }
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); });
