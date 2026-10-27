// A slow, real-finger-like drag (drifting up as it goes) on a page whose text is longer than the page.
// Prints how far the turning page's text scrolled and whether the browser cancelled the drag. Both should be 0.
// node drift-drag.cjs
(async () => {
  const pages = await (await fetch('http://localhost:9222/json')).json();
  const p = pages.find(x => x.type === 'page' && JSON.parse(x.description || '{}').attached) || pages[0];
  const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {}; ws.onmessage = m => { const r = JSON.parse(m.data); if (wait[r.id]) { wait[r.id](r.result); delete wait[r.id] } };
  const send = (method, params) => new Promise(r => { wait[++id] = r; ws.send(JSON.stringify({ id, method, params })) });
  const js = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await js(`(()=>{S.settings.book=Object.assign({},S.settings.book,{turn:'curl'});if(!BOOK.state().open){BOOK.open();ACT.bkGo({i:2})}return 1})()`);
  await sleep(1200);
  const b = await js(`(()=>{const pc=document.querySelector('#bkR .bk-pc');if(pc.scrollHeight<=pc.clientHeight+20)pc.insertAdjacentHTML('beforeend','<p>'+'long line of text '.repeat(400)+'</p>');pc.scrollTop=0;window._dd0=pc.scrollHeight;
    window._dd={max:0,cancel:0};const f=()=>{const t=document.querySelector('#bkR .bk-pc');if(t)window._dd.max=Math.max(window._dd.max,t.scrollTop)};document.querySelector('#bkR .bk-pc').addEventListener('scroll',f);
    document.addEventListener('pointercancel',()=>window._dd.cancel++);const r=document.querySelector('#bkBook').getBoundingClientRect();console.log(window._dd0);return [r.x,r.y,r.width,r.height]})()`);
  const [x, y, w, h] = b, x0 = x + w * .85, y0 = y + h * .6, N = 90;
  const tp = (type, X, Y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: X, y: Y, id: 1 }] });
  await tp('touchStart', x0, y0);
  for (let k = 1; k <= N; k++) { const dx = w * .6 * k / N; await tp('touchMove', x0 - dx, y0 - dx * .45 + Math.sin(k) * 2); await sleep(25) }
  const mid = await js('JSON.stringify([window._dd,window._dd0,document.querySelector("#bkR .bk-pc").scrollTop])');
  await tp('touchEnd'); await sleep(1200);
  console.log('during drag', mid, 'after', await js('JSON.stringify(window._dd)'));
  ws.close(); process.exit(0);
})();
