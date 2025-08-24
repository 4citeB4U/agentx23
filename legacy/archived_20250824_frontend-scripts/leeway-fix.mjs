// LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
// TAG: FN.UTILS.LEEWAY_FIX
// COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: 6205706F
// ICON_ASCII: family=simple glyph=🛠 ICON_SIG=41BFA242
// 5WH: WHAT=compute and fill COLOR_ONION; WHY=CI enforcement; WHEN=on fix runs; HOW=walk+compute+replace; WHERE=scripts; WHO=developers/CI

/*
🏷 TAG: FN.UTILS.LEEWAY_FIX
🎨 COLOR_ONION: ◯#702aea ▷ ◍#2b1ba7 ▷ ●#1f35c1 | SIG: bf754820
WHAT: Compute deterministic color-onion and SIG for tags and replace AUTO placeholders
WHY: Ensure consistent deterministic visuals across frontend and CI
WHEN: Run in CI or locally to fill AUTO entries
WHERE: scripts/leeway-fix.mjs
WHO: Developers and CI
HOW: Walk files, compute FNV-1a, map to HSL->HEX, rewrite files in place
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
let changed=0;
for(const file of files){ let s = fs.readFileSync(file,'utf8'); const regex = /(🏷 TAG: .*\n)(🎨 COLOR_ONION: )AUTO/mg; let m;if(!regex.test(s)) continue; s = s.replace(/(🏷 TAG: (.*)\n)(🎨 COLOR_ONION: )AUTO/mg, (full,tagLine,tag,label)=>{ const tagText = tagLine.replace('🏷 TAG:','').trim(); const onion = computeOnion(tagText); changed++; return `${tagLine}${label}${onion}\n`; }); if(changed>0){ fs.writeFileSync(file,s,'utf8'); console.log('fixed',file); }
}
console.log('leeway-fix complete. files changed:',changed);
