#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { computeOnion, iconFor } from './lib/leeway-hash.mjs';

// Local walk implementation to avoid external dependencies
function walk(dir){
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for(const it of items){
    const p = path.join(dir, it.name);
    if(it.isDirectory()){
      if(['node_modules','.git','legacy','dist','build'].includes(it.name)) continue;
      out.push(...walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

const files = walk(process.cwd()).filter(f => f.match(/\.(py|js|ts|tsx|jsx|html|md|mjs)$/i));

const TAG_ANY = /(^|\n)[ \t]*(?:[#/]*|<!--\s*)?(?:🏷\s*)?TAG:\s*([A-Z0-9][A-Z0-9_.-]+)(?=$|[ \t]*-->|[ \t]*\r?\n)/i;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(TAG_ANY);
  if (!m) continue; // no TAG present
  const tag = m[2].trim();

  // If ASCII TAG already exists, skip (non-destructive)
  if (/^[ \t]*[#/]+[ \t]*TAG:\s*[A-Z0-9_.-]+/im.test(text) || /<!--\s*TAG:\s*[A-Z0-9_.-]+/i.test(text)) {
    continue;
  }

  const { neon, fluo, pastel, sig } = computeOnion(tag);
  const { family, glyph, ICON_SIG } = iconFor(tag);

  const prefix = linePrefix(file);
  const open = determineCommentOpen(file);
  const close = determineCommentClose(file);

  const header = `${open} LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE${close}\n${prefix} TAG: ${tag}${close}\n${prefix} COLOR_ONION_HEX: NEON=${neon} FLUO=${fluo} PASTEL=${pastel} | SIG: ${sig}${close}\n${prefix} ICON_ASCII: family=${family} glyph=${glyph} ICON_SIG=${ICON_SIG}${close}\n${prefix} 5WH: WHAT=todo; WHY=todo; WHEN=todo; HOW=todo; WHERE=todo; WHO=todo${close}\n\n`;

  fs.writeFileSync(file, header + text, 'utf8');
  console.log('added ASCII header →', file);
}

function linePrefix(file) {
  if (file.endsWith('.html')) return '<!--';
  if (/\.(py|sh|md)$/.test(file)) return '#';
  return '//';
}
function determineCommentOpen(file) {
  if (file.endsWith('.html')) return '<!--';
  if (/\.(py|sh|md)$/.test(file)) return '#';
  return '//';
}
function determineCommentClose(file) {
  if (file.endsWith('.html')) return ' -->';
  return '';
}
