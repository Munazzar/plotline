// node strip-inner.cjs <dir with .class files>
// D8 34 (8.2.2) crashes with "NullPointerException ... String.length()" on the classes javac 21 makes for inner and
// anonymous classes: their constructors carry a MethodParameters attribute whose mandated outer-instance parameter has
// no name. MethodParameters only serves reflection (Parameter.getName), which the app never uses, so it is dropped from
// every method before dexing. Everything else is copied byte for byte.
const fs = require('fs'), path = require('path');
function strip(buf) {
  let p = 8; const n = buf.readUInt16BE(p); p += 2; const utf = [];
  for (let i = 1; i < n; i++) {
    const t = buf[p];
    if (t === 1) { const l = buf.readUInt16BE(p + 1); utf[i] = buf.toString('utf8', p + 3, p + 3 + l); p += 3 + l; }
    else if (t === 5 || t === 6) { p += 9; i++; }
    else if (t === 7 || t === 8 || t === 16 || t === 19 || t === 20) p += 3;
    else if (t === 15) p += 4;
    else if (t === 3 || t === 4 || t === 9 || t === 10 || t === 11 || t === 12 || t === 17 || t === 18) p += 5;
    else throw new Error('constant tag ' + t);
  }
  p += 6; const ic = buf.readUInt16BE(p); p += 2 + ic * 2;
  const out = [buf.subarray(0, p)]; let dropped = 0;
  /* fields: copied as they are */
  { const s = p, c = buf.readUInt16BE(p); p += 2; for (let i = 0; i < c; i++) { p += 6; const a = buf.readUInt16BE(p); p += 2; for (let j = 0; j < a; j++) p += 6 + buf.readUInt32BE(p + 2); } out.push(buf.subarray(s, p)); }
  /* methods: each attribute list rebuilt without MethodParameters */
  { const c = buf.readUInt16BE(p); out.push(buf.subarray(p, p + 2)); p += 2;
    for (let i = 0; i < c; i++) {
      out.push(buf.subarray(p, p + 6)); p += 6; const a = buf.readUInt16BE(p); p += 2; const keep = [];
      for (let j = 0; j < a; j++) { const len = 6 + buf.readUInt32BE(p + 2); if (utf[buf.readUInt16BE(p)] === 'MethodParameters') dropped++; else keep.push(buf.subarray(p, p + len)); p += len; }
      const k = Buffer.alloc(2); k.writeUInt16BE(keep.length); out.push(k, ...keep);
    } }
  out.push(buf.subarray(p));
  return dropped ? Buffer.concat(out) : null;
}
let n = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const x = path.join(d, f); if (fs.statSync(x).isDirectory()) walk(x); else if (f.endsWith('.class')) { const o = strip(fs.readFileSync(x)); if (o) { fs.writeFileSync(x, o); n++; } } } })(process.argv[2]);
console.log('stripped MethodParameters from', n, 'classes');
