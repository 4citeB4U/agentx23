// LEEWAY v12 HEADER
// File: backend/src/routes/search.ts
// Purpose: Multi-engine web search proxy for Agent Lee VM browser.
//          Supports DuckDuckGo, Wikipedia, Brave, Whoogle, Bing, Google.
//          Returns structured results + iframe URL. No API keys needed for DDG/Wiki.
// Security: Input sanitised; no query is forwarded to external services without encoding.
// Performance: Parallel fetch where applicable; 10 s timeout per upstream.
// Discovery: ROLE=internal; INTENT=vm-search-proxy; REGION=🔍 SEARCH

import { Response as ExpressResponse, Request, Router } from "express";

export const searchRouter = Router();

const TIMEOUT_MS = 10_000;

type SearchEngine =
  | "duckduckgo"
  | "wikipedia"
  | "brave"
  | "whoogle"
  | "bing"
  | "google"
  | "searxng";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchResponse {
  engine: SearchEngine;
  query: string;
  url: string;
  results: SearchResult[];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
): Promise<globalThis.Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const results: SearchResult[] = [];

    // Abstract (top answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        link:
          data.AbstractURL ||
          `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Abstract,
      });
    }

    // Related topics
    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 60),
            link: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=8&origin=*`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const hits: any[] = data?.query?.search || [];
    return hits.map((h: any) => ({
      title: h.title,
      link: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`,
      snippet: h.snippet.replace(/<[^>]*>/g, ""),
    }));
  } catch {
    return [];
  }
}

async function searchSearXNG(query: string): Promise<SearchResult[]> {
  // Try public SearXNG instance
  const instances = [
    "https://searx.be",
    "https://search.mdosch.de",
    "https://searxng.site",
  ];
  for (const base of instances) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`;
      const res = await fetchWithTimeout(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const hits: any[] = data?.results || [];
      if (hits.length === 0) continue;
      return hits.slice(0, 8).map((h: any) => ({
        title: h.title || h.url,
        link: h.url,
        snippet: h.content || "",
      }));
    } catch {
      continue;
    }
  }
  return [];
}

// GET /api/search?q=...&engine=duckduckgo|wikipedia|brave|whoogle|bing|google|searxng
searchRouter.get("/", async (req: Request, res: ExpressResponse) => {
  const query = String(req.query.q || "")
    .trim()
    .slice(0, 400);
  const engine = String(
    req.query.engine || "duckduckgo",
  ).toLowerCase() as SearchEngine;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter: q" });
  }

  const encoded = encodeURIComponent(query);
  let results: SearchResult[] = [];
  let iframeUrl = "";

  switch (engine) {
    case "duckduckgo": {
      results = await searchDuckDuckGo(query);
      iframeUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;
      break;
    }
    case "wikipedia": {
      results = await searchWikipedia(query);
      iframeUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encoded}&ns0=1`;
      break;
    }
    case "brave": {
      // Brave search has CORS restrictions; return the URL for iframe
      iframeUrl = `https://search.brave.com/search?q=${encoded}&source=web`;
      break;
    }
    case "whoogle": {
      // Try local whoogle first (common ports), fallback to public instance
      const wPorts = [5000, 5001, 5010];
      let wUrl = "";
      for (const port of wPorts) {
        try {
          const testRes = await fetchWithTimeout(`http://localhost:${port}/`, {
            method: "HEAD",
          });
          if (testRes.ok) {
            wUrl = `http://localhost:${port}/search?q=${encoded}`;
            break;
          }
        } catch {
          /* skip */
        }
      }
      iframeUrl = wUrl || `https://whoogle.io/search?q=${encoded}`;
      break;
    }
    case "bing": {
      iframeUrl = `https://www.bing.com/search?q=${encoded}`;
      break;
    }
    case "google": {
      iframeUrl = `https://www.google.com/search?q=${encoded}`;
      break;
    }
    case "searxng": {
      results = await searchSearXNG(query);
      iframeUrl = `https://searx.be/search?q=${encoded}`;
      break;
    }
    default: {
      results = await searchDuckDuckGo(query);
      iframeUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;
    }
  }

  const payload: SearchResponse = {
    engine,
    query,
    url: iframeUrl,
    results,
  };

  return res.json(payload);
});
