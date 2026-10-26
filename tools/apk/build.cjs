// node build.cjs <base.apk> <repo dir> <out.apk> <oldVer> <newVer> <oldCode> <newCode> <key.pem> <cert.der> [entry=file ...]
// Extra entry=file pairs replace or add APK entries as they are (e.g. classes4.dex=new4.dex classes6.dex=bridge.dex);
// a replacement AndroidManifest.xml (from manifest.cjs) still gets the new version.
// Rebuilds the base APK with the repo's web files in assets/www, the new version in the manifest, stored entries
// 4-byte aligned, old signatures dropped, then signs it with APK Signature Scheme v2.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), v2 = require('./v2.cjs');
const [base, repo, out, oldV, newV, oldC, newC, keyF, certF, ...PUT] = process.argv.slice(2);
const put = new Map(PUT.map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
const b = fs.readFileSync(base), e = v2.eocdOf(b);
const WEB = ['index.html', 'polish.css', 'sw.js', 'privacy.html', ...fs.readdirSync(repo).filter(f => f.endsWith('.js'))];

function crc32(buf) { let c, crc = ~0; for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }

function patchManifest(raw) {
  const m = Buffer.from(raw), o16 = Buffer.from(oldV, 'utf16le'), n16 = Buffer.from(newV, 'utf16le');
  if (o16.length !== n16.length) throw new Error('version names must be the same length');
  let i = m.indexOf(o16), hits = 0; while (i >= 0) { n16.copy(m, i); hits++; i = m.indexOf(o16, i + 1); }
  if (hits !== 1) throw new Error('versionName found ' + hits + ' times');
  const pat = Buffer.alloc(8); pat.writeUInt32BE(0x08000010, 0); pat.writeUInt32LE(+oldC, 4);
  const j = m.indexOf(pat); if (j < 0 || m.indexOf(pat, j + 1) >= 0) throw new Error('versionCode not found exactly once');
  m.writeUInt32LE(+newC, j + 4); return m;
}

// read the central directory
const ents = []; let p = e.cdOff;
while (b.readUInt32LE(p) === 0x02014b50) {
  const nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lo = b.readUInt32LE(p + 42);
  const name = b.toString('utf8', p + 46, p + 46 + nl), data = lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28);
  ents.push({ name, m: b.readUInt16LE(p + 10), time: b.readUInt32LE(p + 12), crc: b.readUInt32LE(p + 16), cs: b.readUInt32LE(p + 20), us: b.readUInt32LE(p + 24), attr: b.readUInt32LE(p + 38), raw: b.subarray(data, data + b.readUInt32LE(p + 20)) });
  p += 46 + nl + xl + cl;
}
const have = new Set(ents.map(x => x.name));
const fresh = (name, buf, time) => { const c = zlib.deflateRawSync(buf, { level: 9 }); return { name, m: 8, time, crc: crc32(buf), cs: c.length, us: buf.length, attr: 0, raw: c }; };
const list = [], rep = [];
for (const x of ents) {
  if (/^META-INF\/.*\.(SF|RSA|DSA|EC|MF)$/i.test(x.name)) continue;
  const w = x.name.startsWith('assets/www/') && x.name.slice(11);
  if (w && WEB.includes(w)) { list.push(fresh(x.name, fs.readFileSync(path.join(repo, w)), x.time)); rep.push(w); continue; }
  if (put.has(x.name)) { const buf = fs.readFileSync(put.get(x.name)); list.push(fresh(x.name, x.name === 'AndroidManifest.xml' ? patchManifest(buf) : buf, x.time)); rep.push(x.name); put.delete(x.name); continue; }
  if (x.name === 'AndroidManifest.xml') { list.push(fresh(x.name, patchManifest(zlib.inflateRawSync(x.raw)), x.time)); continue; }
  list.push(x);
}
const added = WEB.filter(w => !have.has('assets/www/' + w));
for (const w of added) list.push(fresh('assets/www/' + w, fs.readFileSync(path.join(repo, w)), ents[0].time));
for (const [n, fp] of put) { list.push(fresh(n, fs.readFileSync(fp), ents[0].time)); added.push(n); }

// write: local headers (stored entries 4-byte aligned with zero padding in the extra field), central directory, EOCD
const parts = [], cds = []; let off = 0;
for (const x of list) {
  const nb = Buffer.from(x.name, 'utf8'); let pad = 0;
  if (x.m === 0) pad = (4 - ((off + 30 + nb.length) % 4)) % 4;
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(x.m === 0 ? 10 : 20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(x.m, 8);
  h.writeUInt32LE(x.time, 10); h.writeUInt32LE(x.crc, 14); h.writeUInt32LE(x.cs, 18); h.writeUInt32LE(x.us, 22); h.writeUInt16LE(nb.length, 26); h.writeUInt16LE(pad, 28);
  parts.push(h, nb, Buffer.alloc(pad), x.raw);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(x.m === 0 ? 10 : 20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(x.m, 10);
  c.writeUInt32LE(x.time, 12); c.writeUInt32LE(x.crc, 16); c.writeUInt32LE(x.cs, 20); c.writeUInt32LE(x.us, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(x.attr, 38); c.writeUInt32LE(off, 42);
  cds.push(c, nb);
  off += 30 + nb.length + pad + x.raw.length;
}
const cd = Buffer.concat(cds), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
const unsigned = Buffer.concat([...parts, cd, end]);
const signed = v2.sign(unsigned, fs.readFileSync(keyF), fs.readFileSync(certF));
fs.writeFileSync(out, signed);
console.log(JSON.stringify({ entries: list.length, replaced: rep.length, added, verify: v2.verify(fs.readFileSync(out)) }));
