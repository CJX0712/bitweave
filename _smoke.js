// Smoke test for huffman-studio engine (globalThis.HUFF) via Node vm sandbox.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const ctx = { console: console, Math: Math, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  Uint8Array: Uint8Array, Array: Array, Object: Object, Number: Number, String: String, globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(m[1], ctx, { filename: 'engine.js' });
const H = ctx.HUFF;

let pass = 0, fail = 0; const fails = [];
function ok(name, cond){ if (cond){ pass++; } else { fail++; fails.push(name); } }

// 1. freqs correctness
(function(){
  const u8 = H.textToBytes("abracadabra");
  const f = H.freqs(u8);
  ok("freq a=5", f[97] === 5);
  ok("freq b=2", f[98] === 2);
  ok("freq r=2", f[114] === 2);
  ok("freq c=1", f[99] === 1);
  ok("freq d=1", f[100] === 1);
  ok("freq total symbols", Object.keys(f).length === 5);
})();

// 2. prefix-free on many inputs
(function(){
  const samples = ["abracadabra", "the quick brown fox", "床前明月光疑是地上霜", "AAAAAAAAAAABBBBBBCCCDDEE", "mississippi", "ab", "a".repeat(20)];
  for (const s of samples){
    const comp = H.compress(s);
    ok("prefix-free:" + JSON.stringify(s).slice(0,20), H.isPrefixFree(comp.codes));
    // prefix-free via per-pair check independent of helper
    const arr = Object.keys(comp.codes).map(k=>comp.codes[k]);
    let pf = true;
    for (let i=0;i<arr.length;i++) for (let j=0;j<arr.length;j++){ if(i!==j && arr[j].indexOf(arr[i])===0 && arr[j].length>arr[i].length) pf=false; }
    ok("prefix-free-manual:" + JSON.stringify(s).slice(0,20), pf);
  }
})();

// 3. roundtrip on many random ASCII + Unicode strings
(function(){
  const words = "abcdefghijklmnopABCDEFGHIJKLMNOP 0123456789".split("");
  function rnd(len, alpha){ let s=""; for(let i=0;i<len;i++) s += alpha[Math.floor(Math.random()*alpha.length)]; return s; }
  const asciiAlpha = "the cat sat on the mat ".split("");
  let allGood = true;
  for (let t=0;t<200;t++){
    const a = rnd(1 + Math.floor(Math.random()*60), asciiAlpha);
    const comp = H.compress(a);
    const back = H.decompress(comp);
    if (back !== a) allGood = false;
  }
  ok("roundtrip 200 ascii random", allGood);
  const uni = ["床前明月光疑是地上霜举头望明月", "变量名_测试用例✓🌟数据", "function f(x){ return x+1; }", "混合中英Mixed文字123"];
  let uniGood = true;
  for (const s of uni){ const c = H.compress(s); if (H.decompress(c) !== s) uniGood = false; }
  ok("roundtrip unicode", uniGood);
})();

// 4. determinism: same input -> identical codes + identical bitstream
(function(){
  const s = "to be or not to be that is the question";
  const c1 = H.compress(s), c2 = H.compress(s);
  ok("determinism codes", JSON.stringify(c1.codes) === JSON.stringify(c2.codes));
  ok("determinism bits", c1.bits === c2.bits);
})();

// 5. edge: empty
(function(){
  const c = H.compress("");
  ok("empty bitCount 0", c.bitCount === 0);
  ok("empty roundtrip", H.decompress(c) === "");
  ok("empty originalBits 0", c.originalBits === 0);
})();

// 6. edge: single distinct symbol repeated
(function(){
  const s = "aaaaaaaaaa";
  const c = H.compress(s);
  ok("single code len 1", c.codes[97] === "0");
  ok("single bitCount = len", c.bitCount === s.length);
  ok("single roundtrip", H.decompress(c) === s);
})();

// 7. edge: two symbols
(function(){
  const s = "ab";
  const c = H.compress(s);
  ok("two codes prefix-free", H.isPrefixFree(c.codes));
  ok("two roundtrip", H.decompress(c) === s);
  ok("two bitCount 2", c.bitCount === 2);
})();

// 8. compression sanity: skewed distribution compresses below 8 bits/symbol
(function(){
  const s = "aaaaaaaaaa".repeat(5); // 50 a's
  const c = H.compress(s);
  ok("skewed compressed < original", c.bitCount < c.originalBits);
  ok("skewed avg <= 2", (c.bitCount / s.length) <= 2);
})();

// 9. optimality-ish: uniform distribution still decodable & prefix-free
(function(){
  const s = "abcdefghijklmnop"; // 16 distinct, each once
  const c = H.compress(s);
  ok("uniform prefix-free", H.isPrefixFree(c.codes));
  ok("uniform roundtrip", H.decompress(c) === s);
})();

// 10. buildTree internal_freq = sum of leaves
(function(){
  const c = H.compress("abracadabra");
  // root freq equals total bytes
  ok("root freq == len", c.root.freq === H.textToBytes("abracadabra").length);
})();

const summary = (fail === 0) ? "ALL GREEN" : ("FAILURES: " + fails.join(", "));
fs.writeFileSync(path.join(__dirname, '_smoke.log'), "PASS " + pass + " / " + (pass + fail) + "\n" + summary + "\n");
console.log("PASS " + pass + " / " + (pass + fail));
console.log(summary);
