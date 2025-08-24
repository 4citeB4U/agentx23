/**
 * Tool Components for Agent Lee.
 *
 * This module defines a simple registry for “tools” and wires together
 * retrieval‑augmented generation (RAG), local LLM planning/summarization,
 * and optional backend calls. Each registered tool exposes a `run`
 * method that is invoked after a lightweight planning phase. The
 * surrounding plumbing performs context retrieval from IndexedDB,
 * embeds the query, scores stored chunks, asks the LLM for a plan,
 * runs the tool and then summarizes the raw result.
 *
 * Drop this file in the same directory as your index.html and import
 * it at the bottom of the page with a `<script type="module"
 * src="./tool_components.js"></script>`. Tools can then be invoked
 * via `LEW.tools.invoke(name, opts)` where `name` is the registry
 * identifier (e.g. "research.deep") and `opts` provides at least a
 * `query` string. See individual tool definitions below for details.
 */

// Ensure the global LEW namespace exists. Other modules (llm, vec, store)
// attach themselves here as well.
window.LEW = window.LEW || {};

// ---------------------------------------------------------------------------
// LLM cache and helper. This helper allows tools to specify which local LLM
// should be used when planning and summarizing. If a name is provided, it
// attempts to instantiate the corresponding class from the global window
// (e.g. Phi3LLM, GemmaLLM, LlamaLLM, AZRLLM). Instances are cached to avoid
// reloading models repeatedly. If no name is provided or the name is
// unknown, we fall back to LEW.llm.getLLM() which returns the user's
// preferred model.
const __llmCache = {};
async function __getLlmInstanceByName(name) {
  // Normalize to lowercase if it's a string
  const key = typeof name === 'string' ? name.toLowerCase() : null;
  if (!key) {
    return window.LEW.llm?.getLLM?.() || null;
  }
  // Return cached instance if available
  if (__llmCache[key]) {
    return __llmCache[key];
  }
  // Map of allowed model names to their constructors on window
  const ctorMap = {
    phi3: window.Phi3LLM,
    gemma: window.GemmaLLM,
    llama: window.LlamaLLM,
    azr: window.AZRLLM
  };
  const Ctor = ctorMap[key];
  if (!Ctor) {
    // Unknown model name; fallback to preferred LLM
    return window.LEW.llm?.getLLM?.() || null;
  }
  try {
    const inst = new Ctor();
    // initialize the model if it exposes an initialize() method
    if (inst.initialize) {
      await inst.initialize();
    }
    __llmCache[key] = inst;
    return inst;
  } catch (e) {
    console.warn(`LEW.tools: Failed to instantiate LLM "${key}"`, e);
    return window.LEW.llm?.getLLM?.() || null;
  }
}

/**
 * The tools registry holds named tool implementations. A tool is an
 * object with a `run` method that accepts an object containing at
 * minimum `{ query, files, params, context, plan }` and returns a
 * Promise resolving to a structured result. See below for examples.
 */
window.LEW.tools = window.LEW.tools || {
  _registry: new Map(),
  /**
   * Register a tool implementation under a unique name.
   * @param {string} name
   * @param {{ run: Function }} impl
   */
  register(name, impl) {
    this._registry.set(name, impl);
  },
  /**
   * Invoke a registered tool. Retrieves context from LEW.store,
   * generates a plan with the local LLM, runs the tool, then
   * summarizes the output with the LLM again.
   * @param {string} name
   * @param {object} [opts]
   * @param {string} [opts.query] - user query passed to the tool
   * @param {Array} [opts.files] - optional files uploaded by the user
   * @param {object} [opts.params] - tool‑specific parameters
   * @param {number} [opts.k] - number of context chunks to retrieve
   * @returns {Promise<{plan: string|null, toolResult: any, summary: string}>}
   */
  async invoke(name, opts = {}) {
    const { query = '', files = [], params = {}, k = 6, llmName: optLlmName } = opts;
    const tool = this._registry.get(name);
    if (!tool) throw new Error(`Tool "${name}" is not registered`);
    // Determine which LLM should be used. Prefer an explicit llmName passed
    // via opts.llmName, otherwise check if the tool defines a `llmName`
    // property. Fall back to the globally preferred model.
    const llmName = optLlmName || tool.llmName || null;
    // Retrieve chunks from the RAG store. If none exist or the store
    // interface is unavailable, context will remain empty.
    let ctx = '';
    try {
      const allChunks = await (window.LEW.store?.ragGetAll?.() || []);
      if (allChunks && allChunks.length > 0) {
        const qVecArr = await (window.LEW.vec?.embedTexts?.([query]) || []);
        const qVec = qVecArr[0];
        if (qVec) {
          // Score chunks by cosine similarity; fall back to 0 for missing embeddings.
          const scored = allChunks.map(c => ({
            ...c,
            score: c.embedding ? window.LEW.vec.cosineSimilarity(qVec, c.embedding) : 0
          })).sort((a,b) => b.score - a.score).slice(0, k);
          ctx = scored.map(c => c.text).join("\n---\n");
        }
      }
    } catch (e) {
      console.warn(`LEW.tools: RAG retrieval failed`, e);
    }
    // Call the local LLM for a high‑level plan. If any part of the
    // pipeline fails, planning gracefully degrades to null.
    const llm = await __getLlmInstanceByName(llmName);
    let plan = null;
    if (llm && llm.chat) {
      const system = `You are the \"${name}\" tool component. ` +
        `Given the user query, context and parameters, decide how to use your underlying tool safely. ` +
        `Return only your plan.`;
      const prompt = `\n[USER QUERY]\n${query}\n\n` +
        `[TOP-${k} CONTEXT]\n${ctx || '(none)'}\n\n` +
        `[PARAMS]\n${JSON.stringify(params)}\n\n` +
        `[FILES]\n${files && files.length ? files.map(f => f.name || String(f)).join(', ') : '(none)'}`;
      try {
        const resp = await llm.chat({ system, prompt: prompt.trim() });
        plan = resp?.text || null;
      } catch (e) {
        console.warn(`LEW.tools: LLM planning failed for ${name}`, e);
        plan = null;
      }
    }
    // Execute the tool implementation. Any thrown error becomes a failed
    // result; implementations should return structured dicts.
    let toolResult;
    try {
      toolResult = await tool.run({ query, files, params, context: ctx, plan });
    } catch (e) {
      console.error(`LEW.tools: Tool "${name}" run threw`, e);
      toolResult = { ok: false, error: e.message };
    }
    // Summarize the tool output with the LLM. The summary is meant to
    // be read to the user (e.g., via TTS) and displayed in the UI.
    let summary = '';
    if (llm && llm.chat) {
      try {
        const sumSystem = `You are an assistant summarizing results from a tool call. ` +
          `Respond clearly in 2–4 sentences. If sources are present, list them as bullet points.`;
        const sumPrompt = `Tool result:\n${JSON.stringify(toolResult).slice(0, 20000)}`;
        const sumResp = await llm.chat({ system: sumSystem, prompt: sumPrompt });
        summary = sumResp?.text || JSON.stringify(toolResult);
      } catch (e) {
        console.warn(`LEW.tools: LLM summarization failed for ${name}`, e);
        summary = JSON.stringify(toolResult);
      }
    } else {
      summary = JSON.stringify(toolResult);
    }
    return { plan, toolResult, summary };
  }
};

// -------------------------------------------------------------------------
// Built‑in tool: research.deep
//
// Performs a local search via LEW.search.searchAndAnswer using DuckDuckGo
// and Wikipedia providers. This tool returns a synthesis as well as a
// list of sources drawn from LEW.search._lastResults. Parameters
// accepted: `engines` (array of engine names), `maxSources`/`k`
// (number of results), `useRag`, `useLLM` (booleans). See index.html
// for defaults.
window.LEW.tools.register('research.deep', {
  llmName: 'phi3',
  async run({ query, params }) {
    const engines = params?.engines || ['wiki', 'ddg'];
    const maxSources = params?.maxSources || params?.k || 5;
    try {
      // Prefer to use the new LeeSearch module if it exists on LEW; fallback to the older search API.
      if (window.LEW.leeSearch?.searchAndAnswer) {
        const { answer, results } = await window.LEW.leeSearch.searchAndAnswer(query, {
          engines,
          k: maxSources,
          useRag: params?.useRag ?? true,
          useLLM: params?.useLLM ?? true
        });
        const sources = (results || []).slice(0, maxSources).map(item => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          source: item.source
        }));
        return { ok: true, data: answer, sources };
      } else {
        const { answer } = await window.LEW.search.searchAndAnswer(query, {
          engines,
          useRag: params?.useRag ?? true,
          useLLM: params?.useLLM ?? true,
          k: maxSources
        });
        const sources = (window.LEW.search._lastResults || []).map(item => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          source: item.source
        }));
        return { ok: true, data: answer, sources };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
});

// Built‑in tool: fs.manage
//
// Proxy to backend for file system operations. It expects params
// containing at least `action` and `path`. Optional fields include
// `content` for writes and `confirmation_token` for deletes. The
// backend must expose a POST /api/tool/fs endpoint returning a
// JSON representation of the tool result (see app.py for an example).
window.LEW.tools.register('fs.manage', {
  llmName: 'gemma',
  async run({ params }) {
    if (!params || !params.action || !params.path) {
      return { ok: false, error: 'Missing required params: action and path' };
    }
    try {
      const res = await fetch('/api/tool/fs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
});

// Built‑in tool: shell.execute
//
// Executes arbitrary commands via a backend shell endpoint. The
// request body must include a `command` string. See app.py for the
// corresponding FastAPI implementation. Note: shell execution is
// disabled by default in tool_suite.py unless configured otherwise.
window.LEW.tools.register('shell.execute', {
  llmName: 'llama',
  async run({ params }) {
    if (!params || !params.command) {
      return { ok: false, error: 'Missing required param: command' };
    }
    try {
      const res = await fetch('/api/tool/shell', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
});

// Built‑in tool: research.deep_backend
//
// When the backend is available, this tool calls the Python
// conduct_deep_research directly. It accepts `query` and optional
// `maxSources`/`k` on params. See app.py for the implementation.
window.LEW.tools.register('research.deep_backend', {
  llmName: 'phi3',
  async run({ query, params }) {
    const body = {
      query: query,
      max_sources: params?.maxSources || params?.k || 5
    };
    try {
      const r = await fetch('/api/tool/deep_research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
});