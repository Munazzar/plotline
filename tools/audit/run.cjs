// Run the UI audit (audit.js) in headless Chrome, at phone and desktop size, on the example data.
//   node tools/audit/run.cjs [url=http://localhost:8765/] [out=tools/audit/out] [widths=390,1280] [xss]
// Needs the app served (the preview server serves the repo root). Writes <out>/report-<w>.txt and <out>/<w>.json,
// plus phone screenshots of every page in <out>/shots-<w>/.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), os = require('os');
const [URL = 'http://localhost:8765/', OUT = path.join(__dirname, 'out'), WIDTHS = '390,1280', MODE = ''] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 400), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'plaudit-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-extensions', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const wait = new Map(), logs = [];
async function connect() {
  for (let i = 0; i < 40; i++) { try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = L.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(250); }
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  ws.onmessage = m => { const r = JSON.parse(m.data); if (r.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (r.params.exceptionDetails.exception?.description || r.params.exceptionDetails.text).split('\n')[0]); if (r.method === 'Runtime.consoleAPICalled' && r.params.type === 'error') logs.push('ERR ' + r.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
}
const cmd = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise(ok => wait.set(id, ok)); };
async function ev(expr) { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const x = r.result || {}; if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text); return x.result?.value; }
(async () => {
  try {
    await connect(); await cmd('Runtime.enable'); await cmd('Page.enable');
    for (const w of WIDTHS.split(',').map(Number)) {
      const phone = w < 600;
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: phone ? 844 : 900, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
      if (phone) await cmd('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' });
      await cmd('Page.navigate', { url: URL }); await sleep(5000);
      await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40&&!window.VIEWS;i++)await w(250);
        const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(3000)}
        if(!S.goals.length)seedDemo();S.settings.name='Sam';${process.env.SETUP||''};save();closeSheet();return 1})()`);
      await sleep(1500); logs.length = 0;
      const t0 = Date.now();
      if (MODE === 'shots') { const R = await ev(`(async()=>{const A=await import('${URL}tools/audit/audit.js');return A.routes()})()`); const D = path.join(OUT, `shots-${w}${process.env.TAG||''}`); fs.mkdirSync(D, { recursive: true });
        for (const r of R) { await ev(`location.hash=${JSON.stringify('#/' + r)};1`); await sleep(1400); const H = Math.min(2600, await ev('document.documentElement.scrollHeight')); for (let y = 0; y < H; y += 700) { await ev(`scrollTo(0,${y});1`); await sleep(220); } await ev('scrollTo(0,0);1'); await sleep(500);
          const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: H, scale: phone ? 0.5 : 0.5 } }); fs.writeFileSync(path.join(D, r.split('/').join('_') + '.jpg'), Buffer.from(shot.result.data, 'base64')); }
        console.log('shots in', D); continue; }
      const res = await ev(`(async()=>{const A=await import('${URL}tools/audit/audit.js');return ${MODE === 'xss' ? 'A.xss()' : MODE === 'taps' ? 'A.taps()' : MODE === 'xsstaps' ? '(async()=>{await A.xss();window.__xss=[];const t=await A.taps({wait:300});return {hits:window.__xss,tapped:t.tapped,errors:t.errors}})()' : 'A.run({wait:1200})'}})()`);
      fs.writeFileSync(path.join(OUT, `${MODE || 'ui'}-${w}${process.env.TAG||''}.json`), JSON.stringify({ res, logs }, null, 1));
      if (/taps/.test(MODE)) { console.log(`taps at ${w}:`, JSON.stringify(res, null, 1)); console.log('console:', [...new Set(logs)].slice(0, 40).join('\n')); } else if (MODE !== 'xss') {
        const rep = await ev(`(async()=>{const A=await import('${URL}tools/audit/audit.js');return A.report(${JSON.stringify(res)})})()`);
        fs.writeFileSync(path.join(OUT, `report-${w}${process.env.TAG||''}.txt`), rep + '\n\nconsole:\n' + [...new Set(logs)].join('\n'));
        console.log(`width ${w}: ${Object.keys(res).length} pages in ${Math.round((Date.now() - t0) / 1000)} s, ${Object.values(res).reduce((a, v) => a + v.issues.length, 0)} issues, ${[...new Set(logs)].length} console errors`);
      } else console.log(`xss at ${w}:`, JSON.stringify(res));
      if (/xss|taps/.test(MODE)) break;
    }
  } catch (e) { console.error('audit failed:', e.message); }
  finally { try { ws.close(); } catch (e) { } ch.kill(); }
})();
