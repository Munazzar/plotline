// Evaluate JS in the app's visible WebView over Chrome DevTools Protocol.
// Needs `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` (lib.sh forward_devtools does it).
// node cdp.cjs "<expression>" (or @file.js)  -> prints the JSON result (promises are awaited)
const a = process.argv[2] || 'location.href';
const expr = a.startsWith('@') ? require('fs').readFileSync(a.slice(1), 'utf8') : a;  // @file: read a long expression from a file
(async () => {
  const pages = await (await fetch('http://localhost:9222/json')).json();
  // The background agent has its own hidden WebView: pick the attached (visible) one.
  const p = pages.find(x => x.type === 'page' && JSON.parse(x.description || '{}').attached) || pages[0];
  const ws = new WebSocket(p.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  ws.onmessage = m => {
    const r = JSON.parse(m.data);
    if (r.id !== 1) return;
    const x = r.result || {};
    if (x.exceptionDetails) console.error('ERR', x.exceptionDetails.exception?.description || x.exceptionDetails.text);
    else console.log(JSON.stringify(x.result?.value ?? null));
    ws.close(); process.exit(x.exceptionDetails ? 1 : 0);
  };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  setTimeout(() => { console.error('timeout'); process.exit(2); }, 30000);
})();
