// ASCII probe for huffman-studio: dump freq table + codes + parenthetic tree + bitstream head.
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

function treeStr(node){
  if (!node) return "∅";
  if (node.left === null && node.right === null) return JSON.stringify(String.fromCharCode(node.sym));
  return "(" + treeStr(node.left) + " " + treeStr(node.right) + ")";
}

function charLabel(v){
  if (v >= 32 && v < 127) return String.fromCharCode(v);
  return "\\x" + v.toString(16);
}

const samples = ["abracadabra", "aaaaaa"];
let out = "";
for (const s of samples){
  const c = H.compress(s);
  out += "=== sample: " + JSON.stringify(s) + " ===\n";
  out += "originalBits=" + c.originalBits + " compressedBits=" + c.bitCount + " symbols=" + Object.keys(c.fmap).length + "\n";
  const syms = Object.keys(c.fmap).map(Number).sort((a,b)=>c.fmap[b]-c.fmap[a] || a-b);
  out += "freq | code\n";
  for (const v of syms) out += "  " + charLabel(v) + " (" + v + ") x" + c.fmap[v] + " -> " + c.codes[v] + "\n";
  out += "tree: " + treeStr(c.root) + "\n";
  out += "bitstream head: " + c.bits.slice(0, 60) + (c.bitCount > 60 ? " ...(" + c.bitCount + " bits)" : "") + "\n";
  out += "roundtrip OK: " + (H.decompress(c) === s) + "\n\n";
}
fs.writeFileSync(path.join(__dirname, '_probe.txt'), out);
console.log(out);
console.log("written _probe.txt");
