// Realistic test data for the eval (on top of the app's example goals and habits): 75 days of activity with steps by
// the hour, sleep sessions, workouts, screen time and unlocks by hour, a few days with no record at all, and 40
// journal entries with moods. Deterministic, so every run sees the same data. Evaluated in the app page.
(() => {
  let x = 7; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const L = S.settings.actLog || (S.settings.actLog = {}), tn = dnum(ymd()), now = new Date();
  const APPS = ['com.instagram.android', 'com.whatsapp', 'com.google.android.youtube', 'com.android.chrome', 'com.spotify.music'];
  for (let k = tn - 74; k <= tn; k++) {
    if (k % 13 === 0) continue; // not recorded
    const ds = fromN(k), d = new Date(ds + 'T00:00'), we = d.getDay() === 0 || d.getDay() === 6, today = k === tn;
    const hs = Array.from({ length: 24 }, (_, h) => {
      if (today && h > now.getHours()) return 0;
      const base = h < 6 ? 0 : h === 8 && !we ? 1400 : h === 12 ? 700 : h >= 17 && h <= 19 ? 1100 : h >= 22 ? 60 : 300;
      return Math.round(base * (0.5 + rnd()) * (we ? 0.8 : 1));
    });
    const z = Math.round(360 + rnd() * 150), bed = new Date(d.getTime() - (60 + rnd() * 90) * 60e3).getTime();
    const hu = {}, un = {};
    for (let h = 7; h <= 23; h++) { if (today && h > now.getHours()) break; const m = {}; APPS.forEach(a => { if (rnd() < 0.5) m[a] = Math.round(rnd() * (h >= 20 ? 25 : 10)); }); hu[h] = m; un[h] = Math.round(rnd() * 8); }
    const w = [1, 3, 5].includes(d.getDay()) ? [{ k: [56, 36, 48][d.getDay() % 3], m: Math.round(25 + rnd() * 40), t: d.getTime() + 18 * 3600e3 }] : [];
    const m = Object.values(hu).reduce((a, o) => a + Object.values(o).reduce((p, q) => p + q, 0), 0);
    L[ds] = { ...(L[ds] || {}), s: hs.reduce((a, b) => a + b, 0), hs, hsFrom: 0, z, ss: [[bed, bed + z * 60e3]], w, hu, un, m, u: Date.now() };
  }
  const MO = MOODS.map(m => m[0]);
  for (let k = tn - 59; k <= tn; k++) {
    if (rnd() < 0.33) continue;
    const t = new Date(fromN(k) + 'T21:00').getTime();
    S.entries.push({ id: uid(), t, type: 'note', goalId: null, title: '', text: ['Good focus today.', 'Tired after work.', 'Long walk, felt great.', 'Stressful meeting.', 'Quiet evening.'][Math.floor(rnd() * 5)], mood: MO[Math.floor(rnd() * MO.length)] });
  }
  save(); return Object.keys(L).length + ' days, ' + S.entries.filter(e => e.mood).length + ' moods';
})()
