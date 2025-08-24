#!/usr/bin/env node
/*
🏷 TAG: FN.UTILS.LEEWAY_CI
🎨 COLOR_ONION: ◯#cc1e30 ▷ ◍#7d1c3e ▷ ●#972168 | SIG: 9b53d544
WHAT: CI checks for LEEWAY standards (tags, 5W&H, color-onion filled)
WHY: Block PRs that violate the LEEWAY contract
WHEN: Run during CI on pushes/PRs
WHERE: scripts/leeway-ci.mjs
WHO: CI pipeline and maintainers
HOW: Read .leewayrc.json, validate files for required tags and patterns
*/
// ICON_ASCII: family=simple glyph=tool ICON_SIG=9B53D544
// 5WH: WHAT=validate repo tags; WHY=automated governance; WHEN=CI runs; WHERE=scripts; WHO=CI/maintainers; HOW=pattern checks
import fs from 'fs';
import path from 'path';
let computeOnion, iconFor, sig8;
try{
  ({ computeOnion, iconFor, sig8 } = await import('./lib/leeway-hash.mjs'));
}catch(e){
  // fallback inline implementation (keeps CI runnable in limited envs)
  const crypto = (await import('node:crypto')).default;
  function _sig8(input){ return crypto.createHash('sha1').update(input).digest('hex').slice(0,8).toUpperCase(); }
  const CATEGORY_COLORS = { CORE:['#00FFE5','#39FF14','#B3FFE6'], UI:['#FF00FF','#00FF66','#FFD1FA'], MEDIA:['#00FFFF','#CCFF00','#E0FFF6'], WORKSPACE:['#FFAA00','#7CFFB2','#FFE6BF'], AI:['#9B5CFF','#00E7FF','#EAD9FF'], UTILS:['#FF4D4D','#33FFA8','#FFD6D6'], SEO:['#00E5FF','#B2FF59','#D9F9FF'], DATA:['#FF6EC7','#00FFCC','#FFE0F1'], BACKEND:['#7DF9FF','#ADFF2F','#E6FFFF'], ORCHESTRATION:['#FFE600','#50FA7B','#FFF7BF'], TOOLS:['#FF3B3B','#3BFFDA','#FFD1D1'] };
  computeOnion = (tag) => { const cat=(tag.split('.')[0]||'UTILS').toUpperCase(); const [neon,fluo,pastel]=CATEGORY_COLORS[cat]||CATEGORY_COLORS.UTILS; return { neon, fluo, pastel, sig: _sig8(tag) }; };
  iconFor = (tag) => { const families=['feather','lucide','hero','simple']; const glyphs=['tool','mic','meta','hash','db','gear','bolt','grid','chip','router']; const h=parseInt(_sig8(tag),16); return { family: families[h%families.length], glyph: glyphs[(h>>3)%glyphs.length], ICON_SIG: _sig8(tag+':icon') }; };
  sig8 = (t) => _sig8(t);
}

const VERBOSE = process.argv.includes('--verbose');
const cfg = JSON.parse(fs.readFileSync('.leewayrc.json','utf8'));
function walk(dir){ const out=[]; const items = fs.readdirSync(dir,{withFileTypes:true}); for(const it of items){ const p = path.join(dir,it.name); if(it.isDirectory()){ if(it.name==='node_modules' || it.name==='.git' || it.name==='legacy' || it.name==='dist' || it.name==='build') continue; out.push(...walk(p)); } else { out.push(p); } } return out; }

const files = walk(process.cwd()).filter(f=>f.endsWith('.html')||f.endsWith('.md')||f.endsWith('.py')||f.endsWith('.js')||f.endsWith('.mjs')||f.endsWith('.json'));
let errors = [];
const tagPatternRegex = cfg.allowedTagPatterns.map(p=>new RegExp('^'+p.replace(/\./g,'\\.').replace(/\(.*\)/g,'.*')+'$'));

// Accepts 🏷 TAG: ... or ASCII "# TAG: ..." / "// TAG: ..." / "<!-- TAG: ... -->"
const TAG_ANY = /(^|\n)[ \t]*(?:[#/]*\s*|<!--\s*)?(?:🏷\s*)?TAG:\s*([A-Z0-9][A-Z0-9_.-]+)(?=$|[ \t]*-->|[ \t]*\r?\n)/i;
const COLOR_ASCII = /(^|\n)[ \t]*(?:[#/]*\s*|<!--\s*)?COLOR_ONION_HEX:\s*NEON=#([0-9A-F]{6})\s+FLUO=#([0-9A-F]{6})\s+PASTEL=#([0-9A-F]{6})\s*\|\s*SIG:\s*([A-F0-9]{8})(?=$|[ \t]*-->|[ \t]*\r?\n)/i;
const ICON_ASCII = /(^|\n)[ \t]*(?:[#/]*\s*|<!--\s*)?ICON_ASCII:\s*family=([a-z0-9_-]+)\s+glyph=([a-z0-9_-]+)\s+ICON_SIG=([A-F0-9]{8})(?=$|[ \t]*-->|[ \t]*\r?\n)/i;
const FIVE_WH = /(^|\n)[ \t]*(?:[#/]*|<!--\s*)?(?:📖\s*)?5W&H:|(^|\n)[ \t]*(?:[#/]*|<!--\s*)?5WH:/i;
// emoji fallbacks
const COLOR_EMOJI = /(^|\n).*COLOR_ONION:.*SIG:([A-F0-9]{8})/i;
const ICON_EMOJI  = /(^|\n).*ICON:.*ICON_SIG=([A-F0-9]{8})/i;

function ctx(src, idx) {
  const start = Math.max(0, idx - 80), end = Math.min(src.length, idx + 80);
  return src.slice(start, end).replace(/\n/g, "\\n");
}

// Guard: detect if an immutable TAG line was removed or edited in a way
// that looks destructive. This is a best-effort check: we verify that
// at least one TAG: line (emoji or ASCII) still exists in the file and
// return true when we suspect an edit that removed historical tags.
function editedImmutableTag(text) {
  const emoji = /🏷\s*TAG:\s*[A-Z0-9][A-Z0-9_.-]+/i.test(text);
  const ascii = /(^|\n)[ \t]*(?:[#/]*\s*|<!--\s*)?TAG:\s*([A-Z0-9][A-Z0-9_.-]+)(?=$|[ \t]*-->|[ \t]*\r?\n)/im.test(text);
  // If neither form is present, the TAG line was likely removed/edited.
  return !(emoji || ascii);
}

// Stub for signature collision guard. For now we ensure the computed
// signature for the tag does not appear tied to a different TAG within
// the same file (very unlikely in normal repos). This is a light check
// and will be extended if you want stricter collision detection.
function ensureNoSigCollision(tag, text, file) {
  try {
    const expected = computeOnion(tag).sig.toUpperCase();
    // if the expected sig appears in the file but not associated with this tag,
    // warn (not failing) by returning false; the main CI loop can decide.
    const occurrences = (text.match(new RegExp(expected, 'ig')) || []).length;
    if (occurrences > 1) {
      // multiple occurrences may be suspicious; record a non-fatal console.warn
      console.warn(`${file}: warning: signature ${expected} appears ${occurrences} times`);
    }
  } catch (e) {
    // no-op
  }
  return true;
}

function fail(file, msg){ errors.push(`${file}: ${msg}`); }

for(const file of files){
  const s = fs.readFileSync(file,'utf8');
  const mTag = s.match(TAG_ANY);
  if(!mTag) continue; // untagged files are ignored
  const tag = mTag[2].trim();
  if(VERBOSE) console.log('[TAG]', file, tag, ctx(s, mTag.index||0));
  // pattern check
  const ok = tagPatternRegex.some(r=>r.test(tag));
  if(!ok) fail(file, `tag ${tag} does not match allowed patterns`);

  // 5W&H
  const idx = s.indexOf(mTag[0]);
  const snippet = s.slice(Math.max(0,idx-400), idx+400);
  // accept both colon and equals styles inserted by the ASCII migrator
  const requiredKeys = ['WHAT','WHY','WHEN','WHERE','WHO','HOW'];
  for(const key of requiredKeys){
    const colon = `${key}:`;
    const equal = `${key}=`;
    if(!(snippet.includes(colon) || snippet.includes(equal))) fail(file, `tag ${tag} missing ${key} in nearby docblock`);
  }

  // color onion: prefer ASCII, allow emoji fallback
  const mColorAscii = s.match(COLOR_ASCII);
  const mColorEmoji = s.match(COLOR_EMOJI);
  if(!mColorAscii && !mColorEmoji) fail(file, `tag ${tag} missing COLOR_ONION_HEX or emoji COLOR_ONION`);
  if(mColorAscii && (/AUTO/i.test(mColorAscii[0]) || /AUTO/i.test(s))) fail(file, `AUTO not allowed in COLOR_ONION_HEX for tag ${tag}`);

  // icon: ASCII preferred
  const mIconAscii = s.match(ICON_ASCII);
  const mIconEmoji = s.match(ICON_EMOJI);
  if(!mIconAscii && !mIconEmoji) fail(file, `tag ${tag} missing ICON_ASCII or emoji ICON`);

  // ensure signature present and consistent
  // compute expected sig and compare if ASCII present
  try{
    const expected = computeOnion(tag).sig;
    if(mColorAscii){ const sig = mColorAscii[4]; if(sig.toUpperCase()!==expected.toUpperCase()) fail(file, `tag ${tag} COLOR_ONION sig mismatch expected ${expected} got ${sig}`); }
  } catch(e){ /* no-op */ }
}

// requiredRegionTags must exist in index.html
const idxHtml = fs.existsSync('public/index.html') ? fs.readFileSync('public/index.html','utf8') : '';
for(const rt of cfg.requiredRegionTags){ if(!idxHtml.includes(rt)) fail('public/index.html', `missing required region tag ${rt}`); }

if(errors.length){ console.error('LEEWAY CI failed with errors:'); errors.forEach(e=>console.error('-',e)); process.exit(2); }
console.log('LEEWAY CI passed');
