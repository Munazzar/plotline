// Phone-width screenshots of every canvas/part the eval built, for a person to judge (the check only finds breakage,
// not whether the page is good or does what was asked).  node shots.cjs [cdpPort=9333] [tag=r1]
// Writes out/<tag>/shots/<n>.png from the pages run.cjs saved (out/<tag>/<n>.html, the last step of each idea).
const fs = require('fs'), path = require('path');
const [PORT = '9333', TAG = 'r1'] = process.argv.slice(2);
const IDEAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'ideas.json'), 'utf8'));
const OUT = path.join(__dirname, 'out', TAG, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const wait = new Map();
const call = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise(ok => wait.set(id, ok)); };
const ev = async expr => { const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const x = r.result || {}; if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text); return x.result?.value; };
(async () => {
  // its own tab, so it never disturbs a run that's using the app page
  const t = await (await fetch(`http://localhost:${PORT}/json/new?http://localhost:8791/`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(ok => { ws.onopen = ok; });
  ws.onmessage = m => { const r = JSON.parse(m.data); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(4000);
  await ev(`(async()=>{for(let i=0;i<40&&!(window.CANVAS&&CANVAS.docOf);i++)await new Promise(r=>setTimeout(r,250));await CANVAS.ready();return 1})()`);
  for (let i = 0; i < IDEAS.length; i++) {
    const file = path.join(__dirname, "out", TAG, (i + 1) + (IDEAS[i].then ? "-" + IDEAS[i].then.length : "") + ".html"); if (!fs.existsSync(file)) { console.log("#" + (i + 1), "no file"); continue; }
    const h = await ev(`(async()=>{const c={id:"shot",title:"shot",slot:${JSON.stringify(IDEAS[i].slot || "")}||undefined,data:true,store:{},html:${JSON.stringify(fs.readFileSync(file, "utf8"))}};if(!c.html)return 0;
      let f=document.getElementById('shotF');if(f)f.remove();f=document.createElement('iframe');f.id='shotF';f.setAttribute('sandbox','allow-scripts allow-forms');
      f.style.cssText='position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:99999;background:'+getComputedStyle(document.body).backgroundColor;
      document.body.appendChild(f);f.srcdoc=CANVAS.docOf(c,{part:c.slot?1:0});await new Promise(r=>setTimeout(r,2500));return 844})()`);
    if (!h) { console.log('#' + (i + 1), 'no page'); continue; }
    const r = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: h, scale: 1 } });
    fs.writeFileSync(path.join(OUT, `${i + 1}.png`), Buffer.from(r.result.data, 'base64')); console.log('#' + (i + 1), 'shot');
  }
  await fetch(`http://localhost:${PORT}/json/close/${t.id}`); process.exit(0);
})();
