// node tools/android-test/picks-check.cjs : bills.js picks() on the emulator's real OCR text of fixtures/receipt.png
const src=require('fs').readFileSync(require('path').join(__dirname,'../../bills.js'),'utf8').split(/\r?\n/);
const grab=re=>{const i=src.findIndex(l=>re.test(l));let s='',k=i;do{s+=src[k]+'\n'}while(!/^\S|^ ?\}?$/.test(src[++k]||'')&&k<i+8);return s};
const code=[/^const num=/,/^const str=/,/^const AMT=/,/^function picks\(/].map(grab).join('\n');
const picks=new Function(code+';return picks')();
const raw='GREEN LEAF GROCERY\n\n12 Market Street\n\n2026-10-25 14:32\n\nApples\n\n2\n\n3.40\n\nBread\n\n1 2.95\n\nMilk 2L\n\n1 1.89\n\nTOTAL\n\n24.22';
const p=picks(raw),f=v=>p.find(x=>x.v===v),assert=require('assert');
assert.deepStrictEqual([f(3.4).lab,f(3.4).q],['Apples',2]);
assert.deepStrictEqual([f(2.95).lab,f(2.95).q],['Bread',1]);
assert.deepStrictEqual([f(24.22).lab,f(24.22).q],['TOTAL',null]);
console.log('picks ok',JSON.stringify(p.slice(0,4)));
