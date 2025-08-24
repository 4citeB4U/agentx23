// LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
// TAG: FN.UTILS.LEEWAY_FIX2
// COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: FCFF9A28
// ICON_ASCII: family=feather glyph=undefined ICON_SIG=2FF9E37A
// 5WH: WHAT=tolerant AUTO replacer; WHY=fill leftover AUTO entries; WHEN=on demand/CI; HOW=search+compute+replace; WHERE=scripts; WHO=developers/CI

/*
🏷 TAG: FN.UTILS.LEEWAY_FIX2
🎨 COLOR_ONION: ◯#e31ca7 ▷ ◍#921c8c ▷ ●#9021ab | SIG: 77a07458
WHAT: Tolerant filler for remaining COLOR_ONION: AUTO entries by locating nearest TAG and computing onion.
WHY: Some file comment formats prevented the original leeway-fix from matching.
WHEN: Run when leeway-fix leaves AUTO values behind.
WHERE: scripts/leeway-fix2.mjs
WHO: Developers / CI
HOW: Search for COLOR_ONION: AUTO, find preceding TAG within 400 chars, compute FNV->HSL->HEX onion and replace.
ICON: 🛠️
*/
import fs from 'fs';
import path from 'path';

function fnv1a(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h >>> 0) * 0x01000193 >>> 0; }
  return (h >>> 0).toString(16).padStart(8,'0');
}
function hslToRgb(h,s,l){ s/=100; l/=100; const k = n=> (n+ h/30) % 12; const a = s * Math.min(l,1-l); const f = n => l - a*Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1))); return [Math.round(255*f(0)),Math.round(255*f(8)),Math.round(255*f(4))]; }
function rgbToHex([r,g,b]){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function computeOnion(tag){ const sig = fnv1a(tag).slice(0,8); const n = parseInt(sig.slice(0,8),16); const h = n % 360; const s = 60 + (n % 20); const l = 32 + (n % 20); const core = {h,s,l}; const outer = {h:(core.h+30)%360,s:Math.min(90,core.s+10),l:Math.min(70,core.l+10)}; const mid = {h:(core.h+15)%360,s:core.s,l:Math.max(20,core.l-6)}; const hexOuter = rgbToHex(hslToRgb(outer.h,outer.s,outer.l)); const hexMid = rgbToHex(hslToRgb(mid.h,mid.s,mid.l)); const hexCore = rgbToHex(hslToRgb(core.h,core.s,core.l)); return `◯${hexOuter} ▷ ◍${hexMid} ▷ ●${hexCore} | SIG: ${sig}`; }

function walk(dir){ const out=[]; const items = fs.readdirSync(dir,{withFileTypes:true}); for(const it of items){ const p = path.join(dir,it.name); if(it.isDirectory()){ if(it.name==='node_modules' || it.name==='.git') continue; out.push(...walk(p)); } else { out.push(p); } } return out; }

const root = process.cwd();
const files = walk(root).filter(f=>f.endsWith('.html')||f.endsWith('.md')||f.endsWith('.py')||f.endsWith('.js')||f.endsWith('.mjs')||f.endsWith('.json'));
let total=0;
for(const file of files){ let s = fs.readFileSync(file,'utf8'); let changed=false; const re = /🎨\s*COLOR_ONION:\s*AUTO/g; let m; while((m = re.exec(s))){ const pos = m.index; const prefixStart = Math.max(0, pos-600); const prefix = s.slice(prefixStart, pos); const tagMatch = prefix.match(/🏷\s*TAG:\s*([^\n\r]+)/m); const tag = tagMatch ? tagMatch[1].trim() : null; if(!tag) continue; const onion = computeOnion(tag); const before = s.slice(0, m.index); const after = s.slice(m.index + m[0].length); s = before + '🎨 COLOR_ONION: ' + onion + after; changed=true; total++; }
  if(changed){ fs.writeFileSync(file,s,'utf8'); console.log('fixed',file); }
}
console.log('leeway-fix2 complete. files changed:',total);
