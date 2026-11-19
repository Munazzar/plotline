/* Whole-app UI audit. In the browser, on the dev server:  const A = await import('/tools/audit/audit.js'); await A.run()
   Visits every page (and settings sub-page, a goal, a habit, a list, a note), waits for it to settle, and reports per page:
   errors, render time, horizontal overflow, clipped text, text crammed against its card's edge, overlapping controls,
   small tap targets, sections left invisible, and "undefined"/"NaN" on screen. A.xss() seeds data with script payloads
   and reports any page where one ran. Nothing here changes app code; xss() changes the data in this browser only. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* visible: has a size, isn't hidden, and isn't clipped away by a folded or scrolled parent (closed sections, carousels) */
const vis = e => {
  const r = e.getBoundingClientRect(), s = getComputedStyle(e);
  if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05)) return false;
  for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
    const t = getComputedStyle(x); if (+t.opacity < 0.05 || t.visibility === 'hidden') return false;
    if (t.overflow !== 'visible' || t.overflowX !== 'visible' || t.overflowY !== 'visible') { const p = x.getBoundingClientRect(); const ox = Math.min(r.right, p.right) - Math.max(r.left, p.left), oy = Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top); if (ox < r.width * 0.5 || oy < r.height * 0.5) return false; }
  }
  return true;
};
const sel = e => { const p = []; for (let x = e, i = 0; x && x !== document.body && i < 4; x = x.parentElement, i++) { let s = x.tagName.toLowerCase(); if (x.id) { s += '#' + x.id; p.unshift(s); break; } const c = [...x.classList].filter(c => !/^(rv|in|on|ud)$/.test(c)).slice(0, 2); if (c.length) s += '.' + c.join('.'); p.unshift(s); } return p.join('>'); };
const txt = e => (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
function scroller(e) { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 2) return true; } return false; }
function clippedBy(e) { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.overflow !== 'visible' || s.overflowX !== 'visible') return x; } return null; }
const isFixed = e => { for (let x = e; x && x !== document.body; x = x.parentElement) if (/fixed|sticky/.test(getComputedStyle(x).position)) return true; return false; };

export function check(root = document.querySelector('#view')) {
  const out = [], W = innerWidth, add = (k, e, x) => out.push({ k, s: sel(e), t: txt(e), x });
  if (document.documentElement.scrollWidth > W + 1) out.push({ k: 'page-wider-than-screen', s: 'html', x: document.documentElement.scrollWidth });
  const all = [...root.querySelectorAll('*')].filter(vis);
  for (const e of all) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (r.right > W + 2 && !scroller(e) && !isFixed(e) && r.left < W) { const c = clippedBy(e); if (!c || c.getBoundingClientRect().right > W + 2) add('off-screen-right', e, Math.round(r.right - W)); }
    /* text that is cut off without an ellipsis */
    if (e.children.length === 0 && e.textContent.trim() && (s.overflow === 'hidden' || s.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 2 && s.textOverflow !== 'ellipsis' && !/-webkit-box/.test(s.display)) add('text-clipped', e, e.scrollWidth - e.clientWidth);
    if (e.children.length === 0 && /\b(undefined|NaN|null|\[object Object\])\b/.test(e.textContent) && !/input|textarea|code|pre/i.test(e.tagName)) add('bad-text', e, e.textContent.trim().slice(0, 60));
  }
  /* cards: visible border or own background with rounded corners; any text inside closer than 6px to the edge */
  const cards = all.filter(e => { const s = getComputedStyle(e); return (parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent')) && parseFloat(s.borderRadius) >= 8 && e.getBoundingClientRect().width > 120 && e.getBoundingClientRect().height > 36; });
  for (const c of cards) {
    const cr = c.getBoundingClientRect(), cs = getComputedStyle(c);
    if (/^(BUTTON|A|INPUT|TEXTAREA|SELECT|LABEL)$/.test(c.tagName) && cr.height < 60) continue;
    const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n, worst = null;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue; const pe = n.parentElement; if (!vis(pe) || isFixed(pe) && !isFixed(c)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const rr = rg.getBoundingClientRect(); if (!rr.width) continue;
      if (rr.left < cr.left - 1 || rr.right > cr.right + 1 || rr.top < cr.top - 1 || rr.bottom > cr.bottom + 1) { if (!clippedBy(pe) || clippedBy(pe) === c || c.contains(clippedBy(pe))) worst = { k: 'text-outside-card', d: 0, n: pe }; continue; }
      const d = Math.min(rr.left - cr.left, cr.right - rr.right, rr.top - cr.top, cr.bottom - rr.bottom);
      if (d < 6 && (!worst || d < worst.d)) worst = { k: 'text-tight-in-card', d: Math.round(d), n: pe };
    }
    if (worst) out.push({ k: worst.k, s: sel(c), t: txt(worst.n), x: worst.d });
  }
  /* controls that overlap each other */
  const ctl = all.filter(e => e.matches('button,a,input,select,textarea,[data-act]') && !e.closest('svg'));
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j]; if (a.contains(b) || b.contains(a)) continue;
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left), oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (ox > 4 && oy > 4 && ox * oy > 0.25 * Math.min(p.width * p.height, q.width * q.height) && !isFixed(a) && !isFixed(b)) add('controls-overlap', a, sel(b));
  }
  if (W < 600) for (const e of ctl) { const r = e.getBoundingClientRect(); if ((r.height < 28 || r.width < 28) && !e.closest('p,li,small') && e.tagName !== 'INPUT') add('small-tap-target', e, Math.round(r.width) + 'x' + Math.round(r.height)); }
  /* revealed sections that never became visible */
  for (const e of root.querySelectorAll('.rv')) { const r = e.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0 && r.width && +getComputedStyle(e).opacity < 0.5) add('stuck-invisible', e, getComputedStyle(e).opacity); }
  /* de-duplicate */
  const seen = new Set(); return out.filter(o => { const k = o.k + o.s + o.t; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function routes() {
  const R = (window.FF_PAGES || []).map(p => p[0]).filter(k => k !== 'settings');
  try { const g = S.goals[0], h = S.habits[0], l = (S.lists || [])[0], t = (S.threads || [])[0]; if (g) R.push('goal/' + g.id); if (h) R.push('habit/' + h.id); if (l) R.push('list/' + l.id); if (t) R.push('thread/' + t.id); } catch (e) { }
  R.push('screen', 'moves', 'settings'); try { setSecs().forEach(s => R.push('settings/' + s.k)); } catch (e) { }
  return [...new Set(R)];
}

export async function run(opt = {}) {
  const errs = []; const onE = e => errs.push(String(e.message || e.reason || e)); addEventListener('error', onE); addEventListener('unhandledrejection', onE);
  const ce = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); ce.apply(console, a); };
  const res = {};
  try { closeSheet(); } catch (e) { }
  for (const r of opt.routes || routes()) {
    errs.length = 0;
    const p = r.split('/')[0], id = r.split('/').slice(1).join('/');
    let ms = null; try { const t0 = performance.now(); VIEWS[p] && VIEWS[p](id); ms = Math.round(performance.now() - t0); } catch (e) { errs.push('view threw: ' + e.message); }
    location.hash = '#/' + r; await sleep(opt.wait || 1300);
    window.scrollTo(0, 0); await sleep(150);
    let issues = check();
    /* the bottom of long pages too */
    const H = document.documentElement.scrollHeight; if (H > innerHeight * 1.5) { for (let y = innerHeight * .8; y < H; y += innerHeight * .8) { window.scrollTo(0, y); await sleep(260); } await sleep(300); issues = issues.concat(check()); }
    const seen = new Set(); issues = issues.filter(o => { const k = o.k + o.s + o.t; if (seen.has(k)) return false; seen.add(k); return true; });
    res[r] = { ms, dom: document.querySelectorAll('#view *').length, errs: [...new Set(errs)], issues };
    try { closeSheet(); } catch (e) { }
  }
  removeEventListener('error', onE); removeEventListener('unhandledrejection', onE); console.error = ce;
  return res;
}

/* short text report */
export function report(res) {
  const L = [];
  for (const [r, v] of Object.entries(res)) {
    const by = {}; v.issues.forEach(i => (by[i.k] = by[i.k] || []).push(i));
    if (!v.errs.length && !v.issues.length && (v.ms || 0) < 40) continue;
    L.push(`## ${r}  view ${v.ms}ms  dom ${v.dom}`);
    v.errs.forEach(e => L.push('  ERR ' + e));
    for (const [k, a] of Object.entries(by)) L.push(`  ${k} (${a.length}): ` + a.slice(0, 6).map(i => `${i.s}${i.t ? ' “' + i.t + '”' : ''}${i.x != null ? ' [' + i.x + ']' : ''}`).join(' | '));
  }
  return L.join('\n');
}

/* XSS: every text field people type gets a payload; any page where one runs is reported */
export async function xss() {
  window.__xss = []; const P = n => `<img src=x onerror="__xss.push('${n}')">"'><svg onload="__xss.push('${n}s')">`;
  try {
    S.goals.forEach((g, i) => { g.title = P('goal' + i) + g.title; g.why = P('why' + i); (g.steps || []).forEach((s, j) => s.title = P('step' + i + '-' + j)); });
    S.habits.forEach((h, i) => { h.title = P('habit' + i); h.why = P('hwhy' + i); });
    S.entries.forEach((e, i) => { e.title = P('entry' + i); if (e.html != null) e.html = P('ehtml' + i) + e.html; if (e.text != null) e.text = P('etext' + i); });
    (S.lists || []).forEach((l, i) => { l.title = P('list' + i); (l.items || []).forEach((x, j) => { x.t = P('item' + i + j); x.title = x.t; }); });
    (S.days || []).forEach((d, i) => d.title = P('day' + i));
    S.settings.name = P('name'); save();
  } catch (e) { return 'seed failed: ' + e.message; }
  const hit = {};
  for (const r of routes()) { const n = __xss.length; location.hash = '#/' + r; await sleep(900); if (__xss.length > n) hit[r] = __xss.slice(n); }
  return hit;
}

/* Tap every kind of button on every page (skipping anything that deletes, resets, signs out, sends or downloads)
   and report the ones that throw. Each tap starts from the page freshly opened. */
export async function taps(opt = {}) {
  const BAD = /del|remove|reset|clear|wipe|signout|logout|syncOff|disconnect|erase|purge|drop|forget|send|share|export|download|backup|import|print|copy|logDl|acct|connect|install|update|unpair|leave|kill|lock|setPin|tour|setup|aiStart|liveOpen|asOpen|askOpen|asMic|listen|voice|mic|speak|focusMode|navBack|close|undo|perm|blkPerm|Allow|demoOff|seed|mm|model|llm|lrt|kokoro|dl|get|fetch|sync|drive|agRun|cvsSend|run|ask|go$|build|aiGen|aiMake/i;
  const errs = []; const onE = e => errs.push(String(e.message || e.reason || e)); addEventListener('error', onE); addEventListener('unhandledrejection', onE);
  const ce = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 160)); ce.apply(console, a); };
  const out = {}; let n = 0;
  for (const r of opt.routes || routes()) {
    location.hash = '#/' + r; await sleep(900);
    const acts = [...new Set([...document.querySelectorAll('#view [data-act]')].filter(vis).map(e => e.dataset.act))].filter(a => !BAD.test(a)).slice(0, opt.max || 30);
    for (const a of acts) {
      try { closeSheet(); } catch (e) { }
      document.querySelector('.vdlg')?.remove();
      if (location.hash !== '#/' + r) { location.hash = '#/' + r; await sleep(700); }
      const el = [...document.querySelectorAll(`#view [data-act="${a}"]`)].find(vis); if (!el) continue;
      errs.length = 0; n++;
      try { el.click(); } catch (e) { errs.push('click threw: ' + e.message); }
      await sleep(opt.wait || 350);
      if (errs.length) (out[r] = out[r] || []).push({ act: a, txt: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), errs: [...new Set(errs)].slice(0, 3) });
      /* a sheet opened: tap the safe buttons in it too (one level) */
      const sh = document.querySelector('#sheet.on');
      if (sh && opt.deep !== false) { const sub = [...new Set([...sh.querySelectorAll('[data-act]')].filter(vis).map(e => e.dataset.act))].filter(x => !BAD.test(x)).slice(0, 12);
        for (const b of sub) { const e2 = [...document.querySelectorAll(`#sheet.on [data-act="${b}"]`)].find(vis); if (!e2) { try { closeSheet(); } catch (x) { } await sleep(250); const e1 = [...document.querySelectorAll(`#view [data-act="${a}"]`)].find(vis); if (!e1) break; e1.click(); await sleep(400); continue; } errs.length = 0; n++; try { e2.click(); } catch (x) { errs.push('click threw: ' + x.message); } await sleep(300); if (errs.length) (out[r] = out[r] || []).push({ act: a + ' > ' + b, txt: (e2.innerText || '').trim().slice(0, 30), errs: [...new Set(errs)].slice(0, 3) }); } }
    }
    try { closeSheet(); } catch (e) { }
  }
  removeEventListener('error', onE); removeEventListener('unhandledrejection', onE); console.error = ce;
  return { tapped: n, errors: out };
}
