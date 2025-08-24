// Unified search + RAG + LLM module for Agent Lee
// This file is placed under public/search/lee-search.js so that it can be
// loaded directly by the browser. The module exposes a single global
// object, `LeeSearch`, which provides methods for initializing the
// environment, ingesting documents into a local IndexedDB store, and
// performing multi‑engine searches with optional RAG and LLM synthesis.
//
// To use this module, import it in your HTML via a `<script type="module">`
// statement and call `LeeSearch.init()` once on startup. Then call
// `LeeSearch.searchAndAnswer(query, options)` to perform a search. See
// README or the comments below for details on parameters and return
// values. The implementation here is taken from the user’s description
// and lightly adapted to fit into this repository.

// TAG: FN.SEARCH.RAG.UNIFIED_MODULE
// SIG: 5C8B8A72
// COLOR_ONION_HEX: NEON=#00E5FF FLUO=#34FFDD PASTEL=#D6FFF8
// ICON_ASCII: family=feather glyph=search ICON_SIG=0CB3F0B2
// 5WH: WHAT=Unified search+RAG+LLM module; WHY=free frontend-first w/ backend fallbacks;
// WHEN=on demand; WHERE=public/search/lee-search.js; WHO=Agent Lee SPA;
// HOW=multi-provider + IndexedDB store + local LLM

const _cap = { backend: false, vespa: false, haystack: false, perplexica: false };
let _backend = '';
let _onProgress = null;

// ---------- small utils ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const toText = x => (x == null ? '' : String(x));
const isOk = r => r && (r.ok || r.status === 200);

// ---------- IndexedDB (RAG store) ----------
const DB_NAME = 'lee_rag_v1';
const STORE = 'chunks';
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('idb'));
  });
}
async function idbPutMany(rows) {
  const db = await idbOpen();
  const tx = db.transaction(STORE, 'readwrite');
  const os = tx.objectStore(STORE);
  for (const row of rows) os.put(row);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbAll() {
  const db = await idbOpen();
  const tx = db.transaction(STORE, 'readonly');
  const os = tx.objectStore(STORE);
  return new Promise((res, rej) => {
    const out = [];
    const req = os.openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c) return res(out);
      out.push(c.value);
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

// ---------- Embeddings (use your existing embedder.js) ----------
async function embedTexts(texts) {
  // Expect window.Embedder with initialize() and embed(text) -> Float32Array
  if (!window.Embedder) {
    throw new Error('embedder_missing');
  }
  if (window.Embedder.initialize) {
    await window.Embedder.initialize();
  }
  const out = [];
  for (const t of texts) {
    const v = await window.Embedder.embed(t);
    out.push(v);
  }
  return out; // array of Float32Array
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// ---------- Chunker ----------
function chunkText(text, { max = 480, overlap = 60 } = {}) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts = [];
  let i = 0;
  while (i < clean.length) {
    const end = clamp(i + max, 0, clean.length);
    const slice = clean.slice(i, end);
    parts.push(slice);
    i += (max - overlap);
  }
  return parts.filter(Boolean);
}

// ---------- Provider helpers (frontend-first, fallback to backend proxy) ----------
async function tryFetch(url, init, fallbackPath) {
  try {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`status_${r.status}`);
    return await r.json();
  } catch {
    if (!_cap.backend || !fallbackPath) throw new Error('direct_failed');
    const r2 = await fetch(_backend + fallbackPath, init);
    if (!r2.ok) throw new Error(`proxy_status_${r2.status}`);
    return await r2.json();
  }
}

async function p_ddg(q) {
  const j = await tryFetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`,
    { headers: { 'User-Agent': 'AgentLee/1.0' } },
    `/api/provider/ddg?q=${encodeURIComponent(q)}`
  );
  const items = [];
  if (j.Abstract && j.AbstractURL) {
    items.push({ title: j.Heading || q, url: j.AbstractURL, snippet: j.Abstract, source: 'DDG' });
  }
  (j.RelatedTopics || []).forEach(t => {
    if (t.Text && t.FirstURL) items.push({ title: t.Text, url: t.FirstURL, snippet: t.Text, source: 'DDG' });
    (t.Topics || []).forEach(s => {
      if (s.Text && s.FirstURL) items.push({ title: s.Text, url: s.FirstURL, snippet: s.Text, source: 'DDG' });
    });
  });
  return items;
}

async function p_wiki(q) {
  const j = await tryFetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`,
    {},
    `/api/provider/wiki?q=${encodeURIComponent(q)}`
  );
  const hits = j?.query?.search || [];
  return hits.map(h => ({ title: h.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s/g, '_'))}`, snippet: h.snippet?.replace(/<[^>]+>/g, '') || '', source: 'Wikipedia' }));
}

async function p_hn(q) {
  const j = await tryFetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=10`,
    {},
    `/api/provider/hn?q=${encodeURIComponent(q)}`
  );
  const hits = j.hits || [];
  return hits.filter(h => h.url || h.story_url).map(h => ({ title: h.title || h.story_title, url: h.url || h.story_url, snippet: h._highlightResult?.title?.value?.replace(/<[^>]+>/g, '') || '', source: 'HN' }));
}

async function p_so(q) {
  const j = await tryFetch(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&site=stackoverflow&pagesize=8`,
    {},
    `/api/provider/so?q=${encodeURIComponent(q)}`
  );
  return (j.items || []).map(it => ({ title: it.title, url: it.link, snippet: (it.tags || []).join(', '), source: 'StackOverflow' }));
}

async function p_arxiv(q) {
  // arXiv often blocks CORS → likely to hit backend fallback
  const txt = await tryFetch(
    `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=8`,
    {},
    `/api/provider/arxiv?q=${encodeURIComponent(q)}`
  );
  if (typeof txt === 'object' && txt.results) return txt.results; // backend normalized
  const items = [];
  const s = String(txt);
  for (const m of s.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<summary>([\s\S]*?)<\/summary>[\s\S]*?<id>([\s\S]*?)<\/id>/g)) {
    items.push({ title: m[1].trim().replace(/\s+/g, ' '), snippet: m[2].trim().replace(/\s+/g, ' '), url: m[3].trim(), source: 'arXiv' });
  }
  return items;
}

async function p_reddit(q) {
  const j = await tryFetch(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=10`,
    { headers: { 'User-Agent': 'AgentLee/1.0' } },
    `/api/provider/reddit?q=${encodeURIComponent(q)}`
  );
  return (j.data?.children || []).map(c => {
    const d = c.data || {};
    return { title: d.title, url: `https://www.reddit.com${d.permalink}`, snippet: d.selftext?.slice(0, 160) || d.subreddit_name_prefixed || '', source: 'Reddit' };
  });
}

// backend-only big engines:
async function p_perplexica(q) {
  if (!_cap.perplexica) return [];
  const j = await fetch(_backend + `/api/provider/perplexica?q=${encodeURIComponent(q)}`).then(r => r.json());
  return (j.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.snippet || '', source: 'Perplexica' }));
}
async function p_vespa(q) {
  if (!_cap.vespa) return [];
  const j = await fetch(_backend + `/api/provider/vespa?q=${encodeURIComponent(q)}`).then(r => r.json());
  return (j.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.snippet || '', source: 'Vespa' }));
}
async function p_haystack(q) {
  if (!_cap.haystack) return [];
  const j = await fetch(_backend + `/api/provider/haystack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) }).then(r => r.json());
  return (j.results || []).map(x => ({ title: x.title, url: x.url || '', snippet: x.snippet || '', source: 'Haystack' }));
}

const PROVIDERS = {
  ddg: p_ddg,
  wiki: p_wiki,
  hn: p_hn,
  so: p_so,
  arxiv: p_arxiv,
  reddit: p_reddit,
  perplexica: p_perplexica,
  vespa: p_vespa,
  haystack: p_haystack,
};

// ---------- LLM chooser (local-first) ----------
function pickLocalLLM() {
  // preference: smallest first
  if (window.Phi3LLM) return new window.Phi3LLM();
  if (window.GemmaLLM) return new window.GemmaLLM();
  if (window.LlamaLLM) return new window.LlamaLLM();
  if (window.AZRLLM) return new window.AZRLLM();
  return null;
}

// ---------- public API ----------
export const LeeSearch = {
  /**
   * Initialize module
   * @param {object} o { backendBase?: string, onProgress?: fn, defaultEngines?: string[] }
   */
  async init(o = {}) {
    _backend = toText(o.backendBase || '');
    _onProgress = typeof o.onProgress === 'function' ? o.onProgress : null;

    // detect backend + capabilities (optional)
    _cap.backend = false;
    try {
      if (_backend) {
        const r = await fetch(_backend + '/api/capabilities').then(r => r.json());
        _cap.backend = !!r.ok;
        _cap.vespa = !!r.vespa;
        _cap.haystack = !!r.haystack;
        _cap.perplexica = !!r.perplexica;
      }
    } catch {
      /* no backend, still fine */
    }
    return { ok: true, capabilities: { ..._cap } };
  },

  /**
   * Ingest a document into local RAG store
   * @param {string} id
   * @param {string} text
   * @param {object} meta
   */
  async addDocument(id, text, meta = {}) {
    const chunks = chunkText(text);
    const vecs = await embedTexts(chunks);
    const rows = chunks.map((t, i) => ({ id: `${id}:${i}`, docId: id, text: t, meta, vec: Array.from(vecs[i]) }));
    await idbPutMany(rows);
    return { ok: true, chunks: rows.length };
  },

  /** Get quick stats of the local store */
  async stats() {
    const all = await idbAll();
    const byDoc = new Map();
    all.forEach(r => {
      byDoc.set(r.docId, (byDoc.get(r.docId) || 0) + 1);
    });
    return { docs: byDoc.size, chunks: all.length };
  },

  /**
   * Core: search + (optional) RAG + local LLM synthesis
   * @param {string} q
   * @param {object} opt { engines?: string[], k?: number, useRag?: boolean, useLLM?: boolean }
   */
  async searchAndAnswer(q, opt = {}) {
    const engines = opt.engines || ['ddg', 'wiki', 'hn', 'so', 'arxiv', 'reddit', 'perplexica', 'vespa', 'haystack'];
    const k = opt.k ?? 6;
    const useRag = opt.useRag !== false;
    const useLLM = opt.useLLM !== false;

    _onProgress && _onProgress({ stage: 'start', q, engines: engines.slice() });

    // 1) RAG retrieve (local)
    let ragContext = '';
    if (useRag) {
      try {
        const all = await idbAll();
        if (all.length) {
          // embed query
          const qv = (await embedTexts([q]))[0];
          const scored = all.map(r => ({ r, s: cosine(qv, new Float32Array(r.vec)) }));
          scored.sort((a, b) => b.s - a.s);
          ragContext = scored.slice(0, k).map(x => x.r.text).join(' ');
        }
      } catch (e) {
        /* if embedder missing, skip RAG */
      }
    }
    _onProgress && _onProgress({ stage: 'rag_done', haveContext: !!ragContext });

    // 2) Multi-provider fetch (frontend-first w/ fallback)
    const jobs = engines.map(name => {
      const fn = PROVIDERS[name];
      if (!fn) return Promise.resolve([]);
      return fn(q).catch(() => []);
    });
    const parts = await Promise.allSettled(jobs);
    const raw = parts.flatMap(p => (p.status === 'fulfilled' ? p.value : []));
    // dedupe by URL/title
    const seen = new Set();
    const results = [];
    for (const it of raw) {
      const key = (it.url || it.title || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      results.push(it);
    }
    _onProgress && _onProgress({ stage: 'providers_done', count: results.length });

    // 3) Optional local LLM synthesis
    let answer = '';
    if (useLLM) {
      const llm = pickLocalLLM();
      if (llm && llm.chat) {
        const tops = results.slice(0, k).map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet || ''}`).join('\n');
        const prompt =
`You are Agent Lee. Answer the query using the sources and (optionally) local document context.
Query: ${q}

Top sources:
${tops}

${ragContext ? `Local RAG context:\n${ragContext}\n` : ''}

Return:
- a concise answer (3-7 sentences)
- 3 bullet key takeaways
- cite 2-3 source URLs (from the list)`;
        try {
          const r = await llm.chat(prompt);
          answer = r.text || '';
        } catch {
          answer = '';
        }
      }
    }
    _onProgress && _onProgress({ stage: 'done' });

    return { q, answer, results, rag: { used: !!ragContext, tokens: ragContext.length } };
  }
};

// Attach to window for non‑module access
window.LeeSearch = LeeSearch;