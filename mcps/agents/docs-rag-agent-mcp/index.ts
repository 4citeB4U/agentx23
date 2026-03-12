// docs-rag-agent-mcp/index.ts
// Retrieves grounded document passages from local mcps/ docs. Falls back to glm_flash if needed.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import {
    existsSync,
    readdirSync,
    readFileSync,
    writeFileSync
} from "fs";
import { extname, join } from "path";

const DOCS_ROOT = process.env.DOCS_ROOT ?? join(__dirname, "../../..");
const DOCS_INDEX_PATH =
  process.env.DOCS_INDEX_PATH ?? join(__dirname, "docs-index.json");

interface DocEntry {
  path: string;
  content: string;
  indexed_at: string;
}

let docIndex: DocEntry[] = [];

// ── helpers ───────────────────────────────────────────────────────────────

function walkFiles(
  dir: string,
  exts: string[],
  maxDepth = 4,
  _depth = 0,
): string[] {
  if (_depth > maxDepth || !existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const paths: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (
      e.isDirectory() &&
      !e.name.startsWith(".") &&
      e.name !== "node_modules"
    ) {
      paths.push(...walkFiles(full, exts, maxDepth, _depth + 1));
    } else if (e.isFile() && exts.includes(extname(e.name).toLowerCase())) {
      paths.push(full);
    }
  }
  return paths;
}

function loadDocIndex(): void {
  if (existsSync(DOCS_INDEX_PATH)) {
    try {
      docIndex = JSON.parse(readFileSync(DOCS_INDEX_PATH, "utf-8"));
      return;
    } catch {
      // fall through to empty
    }
  }
  docIndex = [];
}

loadDocIndex();

// ── tool implementations ──────────────────────────────────────────────────

function fetchDocSnippet(
  query: string,
  top_k = 3,
  file_filter?: string,
): { passages: Array<{ source: string; snippet: string; score: number }> } {
  if (!query || query.length < 2) {
    return { passages: [] };
  }
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const corpus =
    docIndex.length > 0
      ? docIndex
      : walkFiles(
          join(DOCS_ROOT, "mcps"),
          [".md", ".yaml", ".json", ".ts"],
          5,
        ).map((p) => ({
          path: p,
          content: (() => {
            try {
              return readFileSync(p, "utf-8");
            } catch {
              return "";
            }
          })(),
          indexed_at: new Date().toISOString(),
        }));

  const filtered = file_filter
    ? corpus.filter((d) => d.path.includes(file_filter))
    : corpus;

  const scored = filtered
    .map((doc) => {
      const lower = doc.content.toLowerCase();
      const score = tokens.reduce((acc, t) => {
        const matches = lower.split(t).length - 1;
        return acc + matches;
      }, 0);
      // Find first occurrence for snippet
      let snippet = "";
      for (const t of tokens) {
        const idx = lower.indexOf(t);
        if (idx !== -1) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(doc.content.length, idx + 400);
          snippet = doc.content.slice(start, end).replace(/\n+/g, " ").trim();
          break;
        }
      }
      return {
        source: doc.path.replace(DOCS_ROOT, "").replace(/\\/g, "/"),
        snippet,
        score,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top_k);

  return { passages: scored };
}

function buildContextBundle(
  queries: string[],
  max_chars = 8000,
): { bundle: string; sources: string[]; truncated: boolean } {
  const allPassages: Array<{ source: string; snippet: string; score: number }> =
    [];
  for (const q of queries) {
    const { passages } = fetchDocSnippet(q, 2);
    allPassages.push(...passages);
  }
  // Deduplicate by source
  const seen = new Set<string>();
  const unique = allPassages.filter((p) => {
    if (seen.has(p.source)) return false;
    seen.add(p.source);
    return true;
  });

  let bundle = "";
  const sources: string[] = [];
  let truncated = false;
  for (const p of unique) {
    const section = `\n### ${p.source}\n${p.snippet}\n`;
    if (bundle.length + section.length > max_chars) {
      truncated = true;
      break;
    }
    bundle += section;
    sources.push(p.source);
  }
  return { bundle, sources, truncated };
}

function indexLocalDocs(
  root_override?: string,
  extensions = [".md", ".yaml", ".json"],
): { indexed_count: number; index_path: string } {
  const root = root_override ?? join(DOCS_ROOT, "mcps");
  const files = walkFiles(root, extensions, 5);
  docIndex = files.map((p) => ({
    path: p,
    content: (() => {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        return "";
      }
    })(),
    indexed_at: new Date().toISOString(),
  }));
  try {
    writeFileSync(DOCS_INDEX_PATH, JSON.stringify(docIndex, null, 2), "utf-8");
  } catch {
    // non-fatal
  }
  return { indexed_count: docIndex.length, index_path: DOCS_INDEX_PATH };
}

function rankPassages(
  passages: Array<{ source: string; snippet: string }>,
  query: string,
): Array<{ source: string; snippet: string; rank: number; score: number }> {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  return passages
    .map((p, i) => {
      const lower = p.snippet.toLowerCase();
      const score = tokens.reduce(
        (acc, t) => acc + (lower.split(t).length - 1),
        0,
      );
      return { ...p, rank: 0, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── MCP Server ────────────────────────────────────────────────────────────

const server = new Server(
  { name: "docs-rag-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fetch_doc_snippet",
      description: "Search local docs for passages matching a query.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          top_k: { type: "number" },
          file_filter: { type: "string" },
        },
      },
    },
    {
      name: "build_context_bundle",
      description: "Aggregate multiple query passages into a context bundle.",
      inputSchema: {
        type: "object",
        required: ["queries"],
        properties: {
          queries: { type: "array", items: { type: "string" } },
          max_chars: { type: "number" },
        },
      },
    },
    {
      name: "index_local_docs",
      description: "Crawl and index local docs into memory.",
      inputSchema: {
        type: "object",
        properties: {
          root_override: { type: "string" },
          extensions: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "rank_passages",
      description: "Re-rank an array of passages against a query.",
      inputSchema: {
        type: "object",
        required: ["passages", "query"],
        properties: {
          passages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                snippet: { type: "string" },
              },
            },
          },
          query: { type: "string" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let result: unknown;
    switch (name) {
      case "fetch_doc_snippet":
        result = fetchDocSnippet(
          args.query as string,
          args.top_k as number | undefined,
          args.file_filter as string | undefined,
        );
        break;
      case "build_context_bundle":
        result = buildContextBundle(
          args.queries as string[],
          args.max_chars as number | undefined,
        );
        break;
      case "index_local_docs":
        result = indexLocalDocs(
          args.root_override as string | undefined,
          args.extensions as string[] | undefined,
        );
        break;
      case "rank_passages":
        result = rankPassages(
          args.passages as Array<{ source: string; snippet: string }>,
          args.query as string,
        );
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);

export const REGISTRATION = {
  id: "docs-rag-agent-mcp",
  name: "DocsRAGAgent",
  layer: "interaction",
  model_lane: "notebooklm",
  fallback: "glm_flash",
  status: "unknown",
};
