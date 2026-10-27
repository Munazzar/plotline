// Slow page drags on a slowed-down phone: holds a DevTools session with the CPU throttled (like a mid-range phone),
// records the screen while doing slow drags forward and back, and leaves out/slow-<style>.mp4 for frames.py.
// node slow-drags.cjs [curl|slide|fade] [cpu slowdown, default 6]
const { execFileSync, spawn } = require('child_process'), path = require('path');
const style = process.argv[2] || 'curl', rate = +(process.argv[3] || 6);
const ADB = 'C:/Users/PORTAL/Android/sdk/platform-tools/adb.exe', OUT = path.join(__dirname, 'out');
const adb = (...a) => execFileSync(ADB, a, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const pages = await (await fetch('http://localhost:9222/json')).json();
  const p = pages.find(x => x.type === 'page' && JSON.parse(x.description || '{}').attached) || pages[0];
  const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {}; ws.onmessage = m => { const r = JSON.parse(m.data); if (wait[r.id]) { wait[r.id](r.result); delete wait[r.id] } };
  const send = (method, params) => new Promise(r => { wait[++id] = r; ws.send(JSON.stringify({ id, method, params })) });
  const js = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
  await js(`(()=>{S.settings.book=Object.assign({},S.settings.book,{turn:'${style}'});if(!BOOK.state().open)BOOK.open();ACT.bkGo({i:2});return 1})()`);
  await sleep(1200);
  const [bx, by, bw, bh] = await js(`(()=>{const d=devicePixelRatio,b=document.querySelector('#bkBook').getBoundingClientRect();return [b.x,b.y,b.width,b.height].map(v=>Math.round(v*d))})()`);
  await send('Emulation.setCPUThrottlingRate', { rate });
  adb('shell', 'rm', '-f', `/sdcard/slow-${style}.mp4`);
  const rec = spawn(ADB, ['shell', 'screenrecord', '--bit-rate', '8000000', `/sdcard/slow-${style}.mp4`], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  await sleep(1000);
  const y = by + Math.round(bh * .75), xr = bx + Math.round(bw * .9), xl = bx + Math.round(bw * .15);
  for (let k = 0; k < 3; k++) { adb('shell', 'input', 'swipe', xr, y, xl, y - 150, 2500); await sleep(1500) }   // slow forward
  for (let k = 0; k < 3; k++) { adb('shell', 'input', 'swipe', xl, y, xr, y - 150, 2500); await sleep(1500) }   // slow back
  adb('shell', 'input', 'swipe', xr, y, bx + Math.round(bw * .5), y - 100, 3000); await sleep(1500);            // slow, half way: springs back
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  adb('shell', 'pkill', '-INT', 'screenrecord'); await sleep(2000);
  adb('pull', `/sdcard/slow-${style}.mp4`, path.join(OUT, `slow-${style}.mp4`));
  console.log(JSON.stringify({ style, rate, book: [bx, by, bw, bh], header: await js(`(()=>{const d=devicePixelRatio,h=document.querySelector('.bk-top').getBoundingClientRect();return [h.x,h.y,h.width,h.height].map(v=>Math.round(v*d))})()`) }));
  ws.close(); process.exit(0);
})();
