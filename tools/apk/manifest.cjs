// node manifest.cjs <AndroidManifest.xml in> <out> <copyOfServiceName> <newServiceName>
// Adds a <service> to a compiled (binary AXML) manifest by copying an existing one and giving it a new class name:
// the new name is appended to the string pool (so no existing index moves), and the copied start/end element chunks go
// right after the original's end tag. Check the result with: aapt2 dump xmltree --file AndroidManifest.xml <apk>.
const fs = require('fs');
const [inF, outF, fromName, newName] = process.argv.slice(2);
const b = fs.readFileSync(inF);
if (b.readUInt16LE(0) !== 0x0003) throw new Error('not a binary XML');

// string pool
const sp = 8, spSize = b.readUInt32LE(sp + 4), n = b.readUInt32LE(sp + 8), styles = b.readUInt32LE(sp + 12),
  flags = b.readUInt32LE(sp + 16), strStart = b.readUInt32LE(sp + 20), utf8 = !!(flags & 256);
if (styles) throw new Error('styled strings not handled');
const offs = []; for (let i = 0; i < n; i++) offs.push(b.readUInt32LE(sp + 28 + i * 4));
const strData = b.subarray(sp + strStart, sp + spSize);
const str = i => { let p = offs[i]; if (utf8) { let l = strData[p++]; if (l & 0x80) p++; let bl = strData[p++]; if (bl & 0x80) bl = ((bl & 0x7f) << 8) | strData[p++]; return strData.toString('utf8', p, p + bl) }
  const l = strData.readUInt16LE(p); return strData.toString('utf16le', p + 2, p + 2 + l * 2) };
const strs = []; for (let i = 0; i < n; i++) strs.push(str(i));
if (strs.includes(newName)) throw new Error('already has ' + newName);
const fromIdx = strs.indexOf(fromName); if (fromIdx < 0) throw new Error('no string ' + fromName);

// the new string, encoded like the pool
let enc;
if (utf8) { const u = Buffer.from(newName, 'utf8'); if (newName.length > 127 || u.length > 127) throw new Error('long name'); enc = Buffer.concat([Buffer.from([newName.length, u.length]), u, Buffer.from([0])]) }
else { const u = Buffer.from(newName, 'utf16le'), h = Buffer.alloc(2); h.writeUInt16LE(newName.length); enc = Buffer.concat([h, u, Buffer.alloc(2)]) }
/* the string data may have padding at its end: the new string goes right after the last string's bytes */
const lastEnd = (() => { let m = 0; for (let i = 0; i < n; i++) { let p = offs[i]; let len; if (utf8) { let q = p; let l = strData[q++]; if (l & 0x80) q++; let bl = strData[q++]; if (bl & 0x80) bl = ((bl & 0x7f) << 8) | strData[q++]; len = q - p + bl + 1 } else { len = 2 + strData.readUInt16LE(p) * 2 + 2 } m = Math.max(m, p + len) } return m })();
let newData = Buffer.concat([strData.subarray(0, lastEnd), enc]); const pad = (4 - newData.length % 4) % 4; newData = Buffer.concat([newData, Buffer.alloc(pad)]);
const head = Buffer.from(b.subarray(sp, sp + 28)), offTab = Buffer.alloc((n + 1) * 4);
for (let i = 0; i < n; i++) offTab.writeUInt32LE(offs[i], i * 4); offTab.writeUInt32LE(lastEnd, n * 4);
head.writeUInt32LE(n + 1, 8); head.writeUInt32LE(28 + offTab.length, 20); head.writeUInt32LE(28 + offTab.length + newData.length, 4);
const newPool = Buffer.concat([head, offTab, newData]), newIdx = n;

// the XML body: find the <service> whose android:name is fromName, copy it with the new name
const body = b.subarray(sp + spSize); let p = 0, start = -1, end = -1, depth = 0, sDepth = -1;
while (p < body.length) {
  const t = body.readUInt16LE(p), sz = body.readUInt32LE(p + 4);
  if (t === 0x0102) {
    const ac = body.readUInt16LE(p + 28), as = body.readUInt16LE(p + 26), ast = body.readUInt16LE(p + 24);
    for (let i = 0; i < ac; i++) { const q = p + 16 + ast + i * as; if (strs[body.readUInt32LE(q + 4)] === 'name' && body.readInt32LE(q + 8) === fromIdx && strs[body.readUInt32LE(p + 20)] === 'service') { start = p; sDepth = depth } }
    depth++
  } else if (t === 0x0103) { depth--; if (start >= 0 && end < 0 && depth === sDepth) end = p + sz }
  p += sz;
}
if (start < 0 || end < 0) throw new Error('service ' + fromName + ' not found');
const copy = Buffer.from(body.subarray(start, end));
/* rename: in the copy's first start tag, the name attribute's raw value and typed data both point at the new string */
{ const ac = copy.readUInt16LE(28), as = copy.readUInt16LE(26), ast = copy.readUInt16LE(24);
  for (let i = 0; i < ac; i++) { const q = 16 + ast + i * as; if (copy.readInt32LE(q + 8) === fromIdx) { copy.writeInt32LE(newIdx, q + 8); copy.writeUInt32LE(newIdx, q + 16) } } }
const newBody = Buffer.concat([body.subarray(0, end), copy, body.subarray(end)]);
const hdr = Buffer.from(b.subarray(0, 8)), out = Buffer.concat([hdr, newPool, newBody]); out.writeUInt32LE(out.length, 4);
fs.writeFileSync(outF, out);
console.log(JSON.stringify({ strings: n + 1, utf8, added: newName, copiedBytes: copy.length, size: out.length }));
