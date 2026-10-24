// APK Signature Scheme v2: sign and verify (RSA PKCS#1 v1.5 with SHA-512 = 0x0104, as apksig picks for 4096-bit keys)
const crypto = require('crypto');
const MAGIC = Buffer.from('APK Sig Block 42');
const V2_ID = 0x7109871a;

function eocdOf(b) {
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (b.readUInt32LE(i) === 0x06054b50) return { at: i, cdSize: b.readUInt32LE(i + 12), cdOff: b.readUInt32LE(i + 16) };
  throw new Error('no EOCD');
}
// returns {start, end, pairs} of the signing block right before the central directory, or null
function sigBlockOf(b) {
  const e = eocdOf(b), cd = e.cdOff;
  if (cd < 32 || !b.subarray(cd - 16, cd).equals(MAGIC)) return null;
  const size = Number(b.readBigUInt64LE(cd - 24)), start = cd - size - 8;
  if (Number(b.readBigUInt64LE(start)) !== size) throw new Error('signing block sizes differ');
  const pairs = {}; let p = start + 8;
  while (p < cd - 24) { const n = Number(b.readBigUInt64LE(p)); pairs[b.readUInt32LE(p + 8)] = b.subarray(p + 12, p + 8 + n); p += 8 + n; }
  return { start, end: cd, pairs };
}
const lp = buf => { const l = Buffer.alloc(4); l.writeUInt32LE(buf.length); return Buffer.concat([l, buf]); };
const seq = items => lp(Buffer.concat(items.map(lp)));
function readSeq(buf) { const out = []; let p = 0; while (p < buf.length) { const n = buf.readUInt32LE(p); out.push(buf.subarray(p + 4, p + 4 + n)); p += 4 + n; } return out; }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };

// the v2 content digest over [entries][central directory][EOCD with CD offset = start of signing block]
const HASH = { 0x0103: 'sha256', 0x0104: 'sha512', 0x0201: 'sha256' };
function digest(sections, h) {
  const chunks = [];
  for (const s of sections) for (let o = 0; o < s.length; o += 1 << 20) {
    const c = s.subarray(o, Math.min(s.length, o + (1 << 20)));
    chunks.push(crypto.createHash(h).update(Buffer.from([0xa5])).update(u32(c.length)).update(c).digest());
  }
  return crypto.createHash(h).update(Buffer.from([0x5a])).update(u32(chunks.length)).update(Buffer.concat(chunks)).digest();
}
function sectionsOf(b, blockStart, cdOff, eocdAt) {
  const eocd = Buffer.from(b.subarray(eocdAt)); eocd.writeUInt32LE(blockStart, 16);
  return [b.subarray(0, blockStart), b.subarray(cdOff, eocdAt), eocd];
}

function verify(b) {
  const e = eocdOf(b), blk = sigBlockOf(b);
  if (!blk || !blk.pairs[V2_ID]) throw new Error('no v2 signature');
  const signers = readSeq(readSeq(blk.pairs[V2_ID])[0]);
  const certs = [];
  for (const s of signers) {
    const [signedData, sigs, pub] = readSeq(s);
    const [digests, certSeq] = readSeq(signedData);
    const sig = readSeq(sigs).map(x => ({ algo: x.readUInt32LE(0), v: readSeq(x.subarray(4))[0] }))[0];
    const key = crypto.createPublicKey({ key: pub, format: 'der', type: 'spki' });
    if (!HASH[sig.algo]) throw new Error('algorithm ' + sig.algo.toString(16));
    if (!crypto.verify(HASH[sig.algo], signedData, key, sig.v)) throw new Error('signature does not verify');
    const d = readSeq(digests).map(x => ({ algo: x.readUInt32LE(0), v: readSeq(x.subarray(4))[0] })).find(x => x.algo === sig.algo);
    const got = digest(sectionsOf(b, blk.start, e.cdOff, e.at), HASH[sig.algo]);
    if (!got.equals(d.v)) throw new Error('content digest does not match');
    const cert = readSeq(certSeq)[0];
    const x = new crypto.X509Certificate(cert);
    if (!x.publicKey.export({ type: 'spki', format: 'der' }).equals(pub)) throw new Error('certificate key differs from signer key');
    certs.push({ algo: sig.algo.toString(16), sha256: crypto.createHash('sha256').update(cert).digest('hex') });
  }
  return certs;
}

// b must be an unsigned APK (no signing block); returns the signed APK
function sign(b, keyPem, certDer) {
  const e = eocdOf(b), key = crypto.createPrivateKey(keyPem), ALGO = 0x0104;
  const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
  const d = digest(sectionsOf(b, e.cdOff, e.cdOff, e.at), HASH[ALGO]);
  const signedData = Buffer.concat([seq([Buffer.concat([u32(ALGO), lp(d)])]), seq([certDer]), lp(Buffer.alloc(0))]);
  const sig = crypto.sign(HASH[ALGO], signedData, key);
  const signer = Buffer.concat([lp(signedData), seq([Buffer.concat([u32(ALGO), lp(sig)])]), lp(pub)]);
  const value = seq([signer]);
  const pair = Buffer.concat([Buffer.alloc(8), u32(V2_ID), value]); pair.writeBigUInt64LE(BigInt(pair.length - 8));
  const size = BigInt(pair.length + 8 + 16), s1 = Buffer.alloc(8), s2 = Buffer.alloc(8);
  s1.writeBigUInt64LE(size); s2.writeBigUInt64LE(size);
  const block = Buffer.concat([s1, pair, s2, MAGIC]);
  const eocd = Buffer.from(b.subarray(e.at)); eocd.writeUInt32LE(e.cdOff + block.length, 16);
  return Buffer.concat([b.subarray(0, e.cdOff), block, b.subarray(e.cdOff, e.at), eocd]);
}
module.exports = { verify, sign, sigBlockOf, eocdOf };
if (require.main === module) console.log(JSON.stringify(verify(require('fs').readFileSync(process.argv[2]))));
