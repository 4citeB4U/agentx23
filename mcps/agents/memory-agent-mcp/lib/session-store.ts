// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/lib/session-store.ts
// Purpose: Layer-1 in-memory session store — zero-latency context for active convo
// =============================================================================

export interface SessionMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  ts: number;
}

class SessionStore {
  /** sessionId → ordered message list (most recent last) */
  private sessions = new Map<string, SessionMessage[]>();
  /** max messages retained per session before oldest are pruned */
  private readonly MAX_MSGS = 50;

  append(
    sessionId: string,
    role: "user" | "agent",
    content: string,
  ): SessionMessage {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    const msgs = this.sessions.get(sessionId)!;
    const entry: SessionMessage = {
      id: `${sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      ts: Date.now(),
    };
    msgs.push(entry);
    // Prune oldest messages when over limit
    if (msgs.length > this.MAX_MSGS) {
      msgs.splice(0, msgs.length - this.MAX_MSGS);
    }
    return entry;
  }

  /**
   * Keyword search within a session's messages.
   * Returns up to 5 most-recent messages that contain any word from the query.
   */
  search(sessionId: string, query: string): SessionMessage[] {
    const msgs = this.sessions.get(sessionId) ?? [];
    if (msgs.length === 0 || !query.trim()) return [];
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3); // skip short stop-words
    if (words.length === 0) return msgs.slice(-5);
    const hits = msgs.filter((m) =>
      words.some((w) => m.content.toLowerCase().includes(w)),
    );
    return hits.slice(-5);
  }

  getSession(sessionId: string): SessionMessage[] {
    return this.sessions.get(sessionId) ?? [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

/** Singleton exported for use across all memory-agent tools within this process */
export const sessionStore = new SessionStore();
