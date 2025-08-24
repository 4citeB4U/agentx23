import crypto from 'node:crypto';

export function sig8(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8).toUpperCase();
}

const CATEGORY_COLORS = {
  CORE: ['#00FFE5','#39FF14','#B3FFE6'],
  UI: ['#FF00FF','#00FF66','#FFD1FA'],
  MEDIA: ['#00FFFF','#CCFF00','#E0FFF6'],
  WORKSPACE: ['#FFAA00','#7CFFB2','#FFE6BF'],
  AI: ['#9B5CFF','#00E7FF','#EAD9FF'],
  UTILS: ['#FF4D4D','#33FFA8','#FFD6D6'],
  SEO: ['#00E5FF','#B2FF59','#D9F9FF'],
  DATA: ['#FF6EC7','#00FFCC','#FFE0F1'],
  BACKEND: ['#7DF9FF','#ADFF2F','#E6FFFF'],
  ORCHESTRATION: ['#FFE600','#50FA7B','#FFF7BF'],
  TOOLS: ['#FF3B3B','#3BFFDA','#FFD1D1'],
};

export function computeOnion(tag) {
  const cat = (tag.split('.')[0] || 'UTILS').toUpperCase();
  const [neon, fluo, pastel] = CATEGORY_COLORS[cat] || CATEGORY_COLORS.UTILS;
  const sig = sig8(tag);
  return { neon, fluo, pastel, sig };
}

export function iconFor(tag) {
  const families = ['feather','lucide','hero','simple'];
  const glyphs   = ['tool','mic','meta','hash','db','gear','bolt','grid','chip','router'];
  const h = parseInt(sig8(tag), 16);
  const family = families[h % families.length];
  const glyph  = glyphs[(h >> 3) % glyphs.length];
  const ICON_SIG = sig8(tag + ':icon');
  return { family, glyph, ICON_SIG };
}

