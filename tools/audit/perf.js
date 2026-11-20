/* Speed probe (run in the page): page switches, what a save costs, and what keeps the GPU busy. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
export async function switches(routes) {
  const out = {};
  for (const r of routes) {
    const lt = []; const po = new PerformanceObserver(l => l.getEntries().forEach(e => lt.push(e.duration))); try { po.observe({ type: 'longtask', buffered: false }); } catch (e) { }
    const t0 = performance.now(); location.hash = '#/' + r;
    await new Promise(ok => { const h0 = document.querySelector('#view').innerHTML.length, tEnd = performance.now() + 4000; const c = () => ((document.documentElement.dataset.pg === r.split('/')[0] || performance.now() > tEnd) ? ok() : setTimeout(c, 5)); c(); });
    const t1 = performance.now(); await frames(); const t2 = performance.now(); await sleep(700); po.disconnect();
    (out[r] = out[r] || []).push({ route: Math.round(t1 - t0), paint: Math.round(t2 - t0), busy: Math.round(lt.reduce((a, b) => a + b, 0)) });
  }
  return out;
}
export function heavy() {
  const all = [...document.querySelectorAll('body *')]; let blur = 0, shadow = 0, anim = [], fixedBlur = 0;
  for (const e of all) { const s = getComputedStyle(e); if (s.backdropFilter && s.backdropFilter !== 'none') { blur++; if (s.position === 'fixed' || s.position === 'sticky') fixedBlur++; } if (s.filter && /blur/.test(s.filter)) shadow++; }
  for (const a of document.getAnimations()) { const t = a.effect && a.effect.getTiming && a.effect.getTiming(); if (t && t.iterations === Infinity && a.playState === 'running') anim.push((a.animationName || a.constructor.name) + ' on ' + (a.effect.target && (a.effect.target.className || a.effect.target.tagName))); }
  return { nodes: all.length, backdropBlur: blur, fixedBlur, filterBlur: shadow, infiniteAnims: [...new Set(anim)].slice(0, 20), infiniteCount: anim.length };
}
export async function saveCost() {
  const t0 = performance.now(); const j = JSON.stringify(S); const t1 = performance.now();
  let db = null; try { const t2 = performance.now(); await DB.set('state', S); db = Math.round(performance.now() - t2); } catch (e) { }
  return { stateKB: Math.round(j.length / 1024), stringifyMs: Math.round(t1 - t0), dbSetMs: db };
}
/* one tap: time to the next frame and the long tasks it caused */
export async function tap(selector, back) {
  const e = document.querySelector(selector); if (!e) return null;
  const lt = []; const po = new PerformanceObserver(l => l.getEntries().forEach(x => lt.push(Math.round(x.duration)))); try { po.observe({ type: 'longtask' }); } catch (x) { }
  const t0 = performance.now(); e.click(); await frames(); const t1 = performance.now(); await sleep(900); po.disconnect();
  if (back) { try { closeSheet(); } catch (x) { } await sleep(400); }
  return { frame: Math.round(t1 - t0), longTasks: lt };
}
