/* Natural voices: Kokoro-82M (hexgrad, Apache-2.0) speaking right on this device, on the web and in the Android app alike.
   The model (92 MB, 8-bit) downloads once into its own cache and then works offline. Text becomes phonemes with eSpeak NG
   (lib/phonemizer), the model turns them into 24 kHz audio on ONNX Runtime Web (the same runtime as the photo reader),
   and each sentence plays while the next one is being made. English voices only: anything else uses the system voice.
   In the Android app the phone does the speaking instead (Kokoro.java, ONNX Runtime on several cores, a lot faster):
   the page only turns the text into phoneme ids and hands them over through window.PlotlineAssist.
   The text clean-up below follows kokoro-js (Apache-2.0). */
(function(){
const ORTV='1.30.0',ORTJS=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORTV}/dist/ort.wasm.min.js`,ORTW=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORTV}/dist/`;
const HF='https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/';
/* where the model comes from: Hugging Face, else the same file in 6 pieces on jsDelivr (byte-identical, sha256 fbae9257…) */
const MSRC=[[HF+'onnx/model_quantized.onnx'],[0,1,2,3,4,5].map(i=>`https://cdn.jsdelivr.net/npm/kokoro-q8-shards@1.0.0/kokoro-q8.part${i}.bin`)];
const VSRC=[HF+'voices/','https://cdn.jsdelivr.net/npm/kokoro-local-runtime@0.1.0/voices/'];
const KC='plotline-voice-v1',MKEY='https://kokoro.invalid/model_quantized.onnx',VKEY=v=>`https://kokoro.invalid/voices/${v}.bin`,MB=92;
/* id, name, Female/Male, US/UK; best-sounding first */
const VOICES=[['af_heart','Heart','f','us'],['af_bella','Bella','f','us'],['af_nicole','Nicole','f','us'],['bf_emma','Emma','f','uk'],['am_fenrir','Fenrir','m','us'],['am_michael','Michael','m','us'],['am_puck','Puck','m','us'],['bm_george','George','m','uk'],['bm_fable','Fable','m','uk'],
 ['af_aoede','Aoede','f','us'],['af_kore','Kore','f','us'],['af_sarah','Sarah','f','us'],['bf_isabella','Isabella','f','uk'],['af_nova','Nova','f','us'],['af_alloy','Alloy','f','us'],['af_sky','Sky','f','us'],['bm_lewis','Lewis','m','uk'],['bm_daniel','Daniel','m','uk'],
 ['am_echo','Echo','m','us'],['am_eric','Eric','m','us'],['am_liam','Liam','m','us'],['am_onyx','Onyx','m','us'],['bf_alice','Alice','f','uk'],['bf_lily','Lily','f','uk'],['af_jessica','Jessica','f','us'],['af_river','River','f','us'],['am_adam','Adam','m','us'],['am_santa','Santa','m','us']];
const VOCAB={';':1,':':2,',':3,'.':4,'!':5,'?':6,'—':9,'…':10,'"':11,'(':12,')':13,'“':14,'”':15,' ':16,'̃':17,'ʣ':18,'ʥ':19,'ʦ':20,'ʨ':21,'ᵝ':22,'ꭧ':23,A:24,I:25,O:31,Q:33,S:35,T:36,W:39,Y:41,'ᵊ':42,
 a:43,b:44,c:45,d:46,e:47,f:48,h:50,i:51,j:52,k:53,l:54,m:55,n:56,o:57,p:58,q:59,r:60,s:61,t:62,u:63,v:64,w:65,x:66,y:67,z:68,'ɑ':69,'ɐ':70,'ɒ':71,'æ':72,'β':75,'ɔ':76,'ɕ':77,'ç':78,'ɖ':80,'ð':81,'ʤ':82,'ə':83,'ɚ':85,'ɛ':86,'ɜ':87,'ɟ':90,'ɡ':92,
 'ɥ':99,'ɨ':101,'ɪ':102,'ʝ':103,'ɯ':110,'ɰ':111,'ŋ':112,'ɳ':113,'ɲ':114,'ɴ':115,'ø':116,'ɸ':118,'θ':119,'œ':120,'ɹ':123,'ɾ':125,'ɻ':126,'ʁ':128,'ɽ':129,'ʂ':130,'ʃ':131,'ʈ':132,'ʧ':133,'ʊ':135,'ʋ':136,'ʌ':138,'ɣ':139,'ɤ':140,'χ':142,'ʎ':143,'ʒ':147,'ʔ':148,
 'ˈ':156,'ˌ':157,'ː':158,'ʰ':162,'ʲ':164,'↓':169,'→':171,'↗':172,'↘':173,'ᵻ':177};

const KS={st:'none',p:0,err:'',sess:null,load:null,get:null,vv:{},ctx:null,src:null,tok:0,wait:{}};
const NK=(()=>{try{const a=window.PlotlineAssist;return a&&typeof a.kokoroSay==='function'?a:null}catch(e){return null}})();
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsSet=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
const emit=()=>window.dispatchEvent(new Event('plot-kokoro'));
const cache=async()=>{try{return await caches.open(KC)}catch(e){return null}};
/* the model is on this device already? (remembered, then checked against the cache once) */
const nState=()=>{try{const o=JSON.parse(NK.kokoro()||'{}');KS.st=o.st||'none';KS.p=+o.p||0;KS.err=o.err||''}catch(e){}};
if(NK)nState();else if(lsGet('kokoro.have')==='1')KS.st='have';
if(!NK)(async()=>{const c=await cache();if(!c)return;const r=await c.match(MKEY);const have=!!r;if(have!==(KS.st==='have')&&KS.st!=='getting'){KS.st=have?'have':'none';lsSet('kokoro.have',have?'1':null);emit()}})();

function loadJS(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Couldn’t load the voice engine. Check your connection; after the first time it works offline.'));document.head.appendChild(s)})}
async function pull(urls,prog){const parts=[],est=MB*1048576;let got=0;
 for(const u of urls){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);const n=urls.length===1&&+r.headers.get('content-length')||est,rd=r.body&&r.body.getReader();
  if(!rd){const b=new Uint8Array(await r.arrayBuffer());parts.push(b);got+=b.length;continue}
  for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;prog&&prog(Math.min(.99,got/n))}}
 return new Blob(parts)}
/* the phone's own download: progress comes back as window.__assist('kokoro', state, fraction) → ev() */
function nSetup(prog){if(KS.get)return KS.get;let t=0;
 KS.get=new Promise((ok,no)=>{KS.nget={ok,no,prog};try{NK.kokoroGet()}catch(e){no(e)}
  /* also ask the phone now and then, in case a progress message went missing */
  t=setInterval(()=>{const was=KS.st;nState();if(KS.st==='getting'){prog&&prog(KS.p);emit()}else if(KS.st!==was||KS.st!=='getting')ev(KS.st,KS.p)},1500)}).finally(()=>{clearInterval(t);KS.get=null;KS.nget=null});
 nState();emit();return KS.get}
function ev(st,p){KS.st=st==='getting'?'getting':st==='have'?'have':st==='err'?'err':'none';KS.p=+p||0;if(KS.st==='err')nState();const g=KS.nget;
 if(g){if(KS.st==='getting')g.prog&&g.prog(KS.p);else if(KS.st==='have')g.ok();else g.no(new Error(KS.err||'Couldn’t download the voices'))}emit()}
/* download the model once (with progress) and the first voice */
function setup(prog){if(NK)return nSetup(prog);if(KS.get)return KS.get;KS.st='getting';KS.p=0;KS.err='';emit();
 KS.get=(async()=>{const c=await cache();let blob=null,err;
  if(c&&await c.match(MKEY))blob=1;
  for(const src of blob?[]:MSRC){try{blob=await pull(src,f=>{KS.p=f;prog&&prog(f);emit()});if(blob.size<80e6)throw new Error('The download was cut short');break}catch(e){err=e;blob=null}}
  if(!blob)throw err||new Error('Couldn’t download the voices');
  if(blob!==1){if(!c)throw new Error('This browser can’t keep the voices offline');try{await c.put(MKEY,new Response(blob,{headers:{'content-type':'application/octet-stream'}}))}catch(e){throw new Error('Not enough space to keep the voices on this device')}}
  await vvec('af_heart');KS.st='have';KS.p=1;lsSet('kokoro.have','1');emit()})().catch(e=>{KS.st='err';KS.err=e&&e.message||String(e);emit();throw e}).finally(()=>{KS.get=null});
 return KS.get}
async function remove(){if(NK){stop();try{NK.kokoroRemove()}catch(e){}KS.st='none';emit();return}stop();KS.sess=null;KS.load=null;KS.vv={};try{await caches.delete(KC)}catch(e){}KS.st='none';lsSet('kokoro.have',null);emit()}
/* a voice is 510 style vectors of 256 numbers (one per phoneme count) */
async function vvec(v){if(KS.vv[v])return KS.vv[v];const c=await cache();let r=c&&await c.match(VKEY(v)),err;
 if(!r)for(const b of VSRC){try{const x=await fetch(b+v+'.bin');if(!x.ok)throw new Error('HTTP '+x.status);r=new Response(await x.arrayBuffer());if(c)try{await c.put(VKEY(v),r.clone())}catch(e){}break}catch(e){err=e;r=null}}
 if(!r)throw err||new Error('Couldn’t get that voice');const a=new Float32Array(await r.arrayBuffer());if(a.length<256*510)throw new Error('That voice file is damaged');KS.vv[v]=a;return a}
/* the engine itself: ONNX Runtime, the phonemizer and the model, loaded the first time something is spoken */
function engine(){if(KS.load)return KS.load;KS.load=(async()=>{const c=await cache(),r=c&&await c.match(MKEY);if(!r){KS.st='none';lsSet('kokoro.have',null);emit();throw new Error('The natural voices aren’t downloaded')}
 const ph=window.Phonemizer?0:loadJS('lib/phonemizer/phonemizer.min.js');
 if(!window.ort)await loadJS(ORTJS);
 ort.env.wasm.wasmPaths=ORTW;ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(4,navigator.hardwareConcurrency||1):1;ort.env.wasm.proxy=true;
 const sess=await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 await ph;KS.sess=sess;return sess})().catch(e=>{KS.load=null;throw e});return KS.load}

/* ---- text → phonemes (after kokoro-js) ---- */
function sayTime(e){if(e.includes('.'))return e;if(e.includes(':')){const[a,t]=e.split(':').map(Number);return t===0?`${a} o'clock`:t<10?`${a} oh ${t}`:`${a} ${t}`}
 const a=parseInt(e.slice(0,4),10);if(a<1100||a%1e3<10)return e;const t=e.slice(0,2),r=parseInt(e.slice(2,4),10),n=e.endsWith('s')?'s':'';
 if(a%1e3>=100&&a%1e3<=999){if(r===0)return`${t} hundred${n}`;if(r<10)return`${t} oh ${r}${n}`}return`${t} ${r}${n}`}
function sayMoney(e){const a=e[0]==='$'?'dollar':'pound';if(isNaN(Number(e.slice(1))))return`${e.slice(1)} ${a}s`;if(!e.includes('.'))return`${e.slice(1)} ${a}${e.slice(1)==='1'?'':'s'}`;
 const[t,r]=e.slice(1).split('.'),n=parseInt(r.padEnd(2,'0'),10);return`${t} ${a}${t==='1'?'':'s'} and ${n} ${e[0]==='$'?(n===1?'cent':'cents'):(n===1?'penny':'pence')}`}
const sayPoint=e=>{const[a,t]=e.split('.');return`${a} point ${t.split('').join(' ')}`};
function clean(e){return e.replace(/[^\p{L}\p{N}\s\u0000-ɏ -⁯₠-⃏]/gu,' ').replace(/[‘’]/g,"'").replace(/«/g,'“').replace(/»/g,'”').replace(/[“”]/g,'"').replace(/\(/g,'«').replace(/\)/g,'»').replace(/[^\S \n]/g,' ').replace(/  +/,' ')
 .replace(/\bD[Rr]\.(?= [A-Z])/g,'Doctor').replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g,'Mister').replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g,'Miss').replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g,'Mrs').replace(/\betc\.(?! [A-Z])/gi,'etc').replace(/\b(y)eah?\b/gi,"$1e'a")
 .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g,sayTime).replace(/(?<=\d),(?=\d)/g,'').replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi,sayMoney)
 .replace(/\d*\.\d+/g,sayPoint).replace(/(?<=\d)-(?=\d)/g,' to ').replace(/(?<=\d)S/g,' S').replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g,"'S").replace(/(?<=X')S\b/g,'s').replace(/(?:[A-Za-z]\.){2,} [a-z]/g,e=>e.replace(/\./g,'-')).replace(/(?<=[A-Z])\.(?=[A-Z])/gi,'-').trim()}
const PUNCT=/(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;
async function phonemes(text,us){const t=clean(text),parts=[];let at=0;for(const m of t.matchAll(PUNCT)){if(at<m.index)parts.push([0,t.slice(at,m.index)]);if(m[0])parts.push([1,m[0]]);at=m.index+m[0].length}if(at<t.length)parts.push([0,t.slice(at)]);
 let s=(await Promise.all(parts.map(async([p,x])=>p?x:(await Phonemizer.phonemize(x,us?'en-us':'en')).join(' ')))).join('');
 s=s.replace(/kəkˈoːɹoʊ/g,'kˈoʊkəɹoʊ').replace(/kəkˈɔːɹəʊ/g,'kˈəʊkəɹəʊ').replace(/ʲ/g,'j').replace(/r/g,'ɹ').replace(/x/g,'k').replace(/ɬ/g,'l').replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g,' ').replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g,'z');
 if(us)s=s.replace(/(?<=nˈaɪn)ti(?!ː)/g,'di');return s.trim()}
/* sentences, with long ones cut at commas or spaces so each stays well under the model's 510 phonemes */
function chunks(text){const out=[];for(const s0 of String(text).replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+(?=["“(]?[A-Z0-9])/)){let s=s0.trim();
 while(s.length>220){let i=s.lastIndexOf(', ',220);if(i<80)i=s.lastIndexOf(' ',220);if(i<40)i=220;out.push(s.slice(0,i+1).trim());s=s.slice(i+1).trim()}if(s)out.push(s)}return out}
async function synth(text,voice,speed){const sess=await engine(),ph=await phonemes(text,voice[0]!=='b'),ids=[...ph].map(c=>VOCAB[c]).filter(x=>x!=null).slice(0,510);if(!ids.length)return null;
 const vv=await vvec(voice),style=vv.slice(ids.length*256,ids.length*256+256);
 const feeds={input_ids:new ort.Tensor('int64',BigInt64Array.from([0,...ids,0].map(BigInt)),[1,ids.length+2]),style:new ort.Tensor('float32',style,[1,256]),speed:new ort.Tensor('float32',new Float32Array([speed]),[1])};
 const out=await sess.run(feeds);return(out.waveform||out[sess.outputNames[0]]).data}
function actx(){if(!KS.ctx||KS.ctx.state==='closed')KS.ctx=new(window.AudioContext||window.webkitAudioContext)();if(KS.ctx.state==='suspended')KS.ctx.resume();return KS.ctx}
function play(pcm,tok){return new Promise(ok=>{if(tok!==KS.tok)return ok();const c=actx(),b=c.createBuffer(1,pcm.length,24000);b.copyToChannel(pcm instanceof Float32Array?pcm:Float32Array.from(pcm),0);
 const s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.onended=()=>{if(KS.src===s)KS.src=null;ok()};KS.src=s;s.start()})}
/* speak: resolves true when it finished, false when stopped; rejects when nothing could be said (the caller falls back) */
/* Android: each sentence's phoneme ids go to the phone, which says them; ('tts', id, done|err) comes back → tts() */
let NID=0;
async function nSpeak(text,o){stop();const tok=KS.tok,voice=VOICES.some(v=>v[0]===o.voice)?o.voice:'af_heart';if(!window.Phonemizer)await loadJS('lib/phonemizer/phonemizer.min.js');
 const ids=[];for(const c of chunks(text)){const x=[...await phonemes(c,voice[0]!=='b')].map(c=>VOCAB[c]).filter(x=>x!=null).slice(0,510);if(x.length)ids.push(x)}
 if(tok!==KS.tok)return false;if(!ids.length)return true;const id='k'+(++NID);
 return new Promise((ok,no)=>{KS.wait={[id]:{ok,no}};if(o.onstart)o.onstart();try{NK.kokoroSay(id,JSON.stringify(ids),voice,Math.max(.5,Math.min(2,+o.rate||1)))}catch(e){KS.wait={};no(e)}})}
function tts(id,k){const w=KS.wait[id];if(!w)return false;delete KS.wait[id];if(k==='err')w.no(new Error('The natural voice couldn’t speak'));else w.ok(true);return true}
async function speak(text,o={}){if(NK)return nSpeak(text,o);stop();const tok=++KS.tok,voice=VOICES.some(v=>v[0]===o.voice)?o.voice:'af_heart',speed=Math.max(.5,Math.min(2,+o.rate||1));
 const cs=chunks(text);if(!cs.length)return true;let next=synth(cs[0],voice,speed),said=false;
 for(let i=0;i<cs.length;i++){let pcm;try{pcm=await next}catch(e){if(!said)throw e;return false}if(tok!==KS.tok)return false;
  next=i+1<cs.length?synth(cs[i+1],voice,speed):null;if(next)next.catch(()=>{});
  if(pcm&&pcm.length){if(!said&&o.onstart)o.onstart();said=true;await play(pcm,tok)}if(tok!==KS.tok)return false}
 return true}
function stop(){if(NK){KS.tok++;const w=KS.wait;KS.wait={};for(const k in w)w[k].ok(false);try{NK.stopSpeaking()}catch(e){}return}KS.tok++;const s=KS.src;KS.src=null;if(s)try{s.onended=null;s.stop()}catch(e){}}
/* English text only (Latin letters); other scripts and languages go to the system voice */
/* a symbol (\u2192, \u2248, \u23F0) no longer sends a whole sentence to the system voice: clean() drops it; only letters of other scripts do */
const can=(t,lang)=>KS.st==='have'&&(!lang||/^en\b/i.test(lang))&&!/(?=\p{L})[^\u0000-\u024F\u1E00-\u1EFF]/u.test(String(t||''));
window.KOKORO={VOICES,speak,stop,setup,remove,can,ev,tts,native:!!NK,mb:()=>NK?163:MB,
 warm:()=>{if(KS.st!=='have')return;if(NK){try{NK.kokoroWarm()}catch(e){}if(!window.Phonemizer)loadJS('lib/phonemizer/phonemizer.min.js').catch(()=>{})}else engine().catch(()=>{})},
 state:()=>({st:KS.st,p:KS.p,err:KS.err}),voice:v=>VOICES.find(x=>x[0]===v)||null};
})();
