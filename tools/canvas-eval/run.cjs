// Canvas eval: builds every request in ideas.json with the real app and a real AI, one at a time, and scores what
// came out with the app's own phone-size check (the same one that drives the auto-repair).
// Needs: the app served (e.g. http://localhost:8791), Chrome with --remote-debugging-port, and the app's AI set to a
// server that works without a key from the page (for a keyed server, a local relay that adds the key).
//   node run.cjs [cdpPort=9333] [aiUrl=http://127.0.0.1:8099/v1] [model=qwen3.5-35b-a3b] [only=1-40] [tag=run]
// Writes out/<tag>/results.jsonl, out/<tag>/<n>.html and prints a summary.
const fs = require('fs'), path = require('path');
const [PORT = '9333', AI = 'http://127.0.0.1:8099/v1', MODEL = 'qwen3.5-35b-a3b', ONLY = '', TAG = 'run'] = process.argv.slice(2);
const IDEAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'ideas.json'), 'utf8'));
const OUT = path.join(__dirname, 'out', TAG); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const wait = new Map();
async function connect() {
  const pages = await (await fetch(`http://localhost:${PORT}/json`)).json();
  const p = pages.find(x => x.type === 'page' && /localhost:87\d\d/.test(x.url)); if (!p) throw new Error('no app page');
  ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  ws.onmessage = m => { const r = JSON.parse(m.data); const f = wait.get(r.id); if (f) { wait.delete(r.id); f(r); } };
}
async function ev(expr) {
  const id = ++seq; ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  const r = await new Promise(ok => wait.set(id, ok)); const x = r.result || {};
  if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text);
  return x.result?.value;
}
const J = JSON.stringify;
async function setup() {
  await ev(`(async()=>{for(const x of await navigator.serviceWorker.getRegistrations())await x.unregister();for(const k of await caches.keys())await caches.delete(k);location.reload();return 1})()`).catch(() => {});
  await sleep(4000); ws.close(); await connect();
  await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40&&!window.CANVAS;i++)await w(250);
    const ex=[...document.querySelectorAll('button')].find(b=>/Explore with examples/.test(b.textContent));if(ex){ex.click();await w(2500)}
    document.startViewTransition=undefined;Object.assign(insSet(),{engine:'api',url:${J(AI)},model:${J(MODEL)}});delete insSet().cthink;save();return planEngine()})()`);
}
async function build(i, it) {
  const t0 = Date.now();
  const id = await ev(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));${it.slot ? `ACT.ptNew({slot:${J(it.slot)}})` : 'ACT.cvsNew()'};await w(800);const id=cur.id;CANVAS.send(id,${J(it.q)});return id})()`);
  const asks = [it.q, ...(it.then || [])], steps = [];
  for (let k = 0; k < asks.length; k++) {
    if (k) await ev(`CANVAS.send(${J(id)},${J(asks[k])})`);
    const s0 = Date.now(); await sleep(3000);
    while (await ev('CANVAS.busy()')) { if (Date.now() - s0 > 15 * 60e3) { await ev('ACT.cvsStop()'); break; } await sleep(5000); }
    const r = await ev(`(async()=>{const c=CANVAS.get(${J(id)}),a=c.msgs.filter(m=>m.r==='a'&&m.st!=='retry').pop()||{};
      const H=c.html?await CANVAS.check(c,c.html):null;
      return{st:a.err?'error':a.st||'answer',msg:String(a.x||'').slice(0,300),fixed:a.fixed||0,vers:c.ver.length,len:(c.html||'').length,html:c.html||'',
        errs:H?H.errs:[],probs:H&&H.look?H.look.probs:[],minor:H&&H.look?H.look.minor:[],outline:H&&H.look?H.look.outline:'',measured:!!(H&&H.look)}})()`);
    fs.writeFileSync(path.join(OUT, `${i + 1}${k ? '-' + k : ''}.html`), r.html); delete r.html;
    steps.push({ ask: asks[k], secs: Math.round((Date.now() - s0) / 1000), ...r });
  }
  return { n: i + 1, q: it.q, slot: it.slot || '', secs: Math.round((Date.now() - t0) / 1000), steps };
}
(async () => {
  await connect(); await setup();
  const [a, b] = ONLY ? ONLY.split('-').map(Number) : [1, IDEAS.length];
  const res = [];
  for (let i = a - 1; i < (b || a); i++) {
    let r; try { r = await build(i, IDEAS[i]); } catch (e) { r = { n: i + 1, q: IDEAS[i].q, fail: String(e.message || e) }; try { ws.close(); } catch (x) {} await connect().catch(() => {}); }
    res.push(r); fs.appendFileSync(path.join(OUT, 'results.jsonl'), J(r) + '\n');
    const L = r.steps ? r.steps[r.steps.length - 1] : null;
    console.log(`#${r.n} ${L ? (L.errs.length || L.probs.length || L.st === 'error' || L.st === 'blank' || !L.len ? 'FAIL' : 'pass') : 'FAIL'} ${r.secs || 0}s fixed:${L ? L.fixed : '-'} ${L ? L.st : r.fail} | ${r.q.slice(0, 60)}${L && L.probs.length ? ' | ' + L.probs[0].slice(0, 120) : ''}`);
  }
  const ok = res.filter(r => r.steps && r.steps.every(s => s.len && !s.errs.length && !s.probs.length && s.st !== 'error' && s.st !== 'blank'));
  console.log(`\n${ok.length}/${res.length} passed the check. Median build ${res.filter(r => r.secs).map(r => r.secs).sort((x, y) => x - y)[Math.floor(res.length / 2)] || 0}s.`);
  process.exit(0);
})();
