import { v4 as uuidv4 } from "uuid";
import { consciousness } from "./consciousness.js";
import { loggerService } from "./logger.js";
import { persistenceService } from "./persistence.js";

export interface OSMessage {
  id: string;
  source: "web" | "voice" | "telegram" | "system";
  role: "user" | "model";
  text: string;
  timestamp: string;
}

class MessageRouter {
  private processedIds: Set<string> = new Set();
  private maxCacheSize = 1000;
  private messageHistory: OSMessage[] = [];
  private observers: ((message: OSMessage) => void)[] = [];

  constructor() {
    this.reconstituteState();
  }

  /**
   * Subscribe to neural bridge broadcasts.
   */
  public subscribe(callback: (message: OSMessage) => void) {
    this.observers.push(callback);
  }

  private async reconstituteState() {
    const state = await persistenceService.loadState();
    if (state && state.messageHistory) {
      this.messageHistory = state.messageHistory;
      console.log(
        `[router] Reconstituted ${this.messageHistory.length} mission cycles.`,
      );
      // Repopulate processed IDs
      this.messageHistory.forEach((m) => this.processedIds.add(m.id));
    }
  }

  /**
   * Routes a message through the system, ensuring uniqueness and processing via Agent Lee's brain.
   */
  async routeMessage(message: Partial<OSMessage>): Promise<OSMessage | null> {
    const id = message.id || uuidv4();

    // Duplication check
    if (this.processedIds.has(id)) {
      console.log(`[router] Skipping duplicate message: ${id}`);
      return null;
    }

    const userMessage: OSMessage = {
      id,
      source: message.source || "system",
      role: "user",
      text: message.text || "",
      timestamp: new Date().toISOString(),
    };

    // Enforcement Logging
    await loggerService.log("command", userMessage.text, {
      source: userMessage.source,
      id: userMessage.id,
    });

    // Add to history and cache
    this.processedIds.add(id);
    this.messageHistory.push(userMessage);

    console.log(`[router] Processing input from ${userMessage.source}...`);

    // Pass recent conversation history so Agent Lee can learn and remember.
    // Strip messages that would corrupt AI context: error fallbacks, build plan
    // markers, build step injections, and pre-compiled history snowballs.
    const junkPatterns = [
      "voice channel hit a snag",
      "neural router isn",
      "local inference is locked",
      "MISSION_DEVIATION",
      "BUILD_PLAN::",
      "BUILD STEP ",
      "::END_PLAN",
    ];
    const recentHistory = this.messageHistory
      .filter((m) => {
        // Skip any message containing known junk patterns
        if (junkPatterns.some((p) => m.text.includes(p))) return false;
        // Skip snowballed history messages — user text that starts with "User:"
        // because the frontend was previously injecting compiled history into text
        if (m.role === "user" && m.text.trimStart().startsWith("User:"))
          return false;
        return true;
      })
      .slice(-15) // Increased history from 10 to 15
      .map((m) => ({ role: m.role, text: m.text.slice(0, 1500) })); // Increased truncation from 300 to 1500

    // Process via Consciousness (Agent Lee's brain)
    const responseText = await consciousness.think(userMessage, recentHistory);

    // Handle duplication ignore from consciousness
    if (responseText === "DUPLICATE_IGNORE") return null;

    // Strip BUILD_PLAN markers for history storage so AI context stays clean.
    // The full responseText (with markers) is kept in modelMessage for chat.ts to parse.
    const cleanedResponseText = responseText
      .replace(/BUILD_PLAN::[\s\S]+?::END_PLAN\n?/g, "")
      .trim();

    const modelMessage: OSMessage = {
      id: uuidv4(),
      source: userMessage.source,
      role: "model",
      text: responseText, // Keep full text (markers included) — chat.ts will strip them
      timestamp: new Date().toISOString(),
    };

    // History entry uses clean text so BUILD_PLAN markers never pollute future AI context
    const historyMessage: OSMessage = {
      ...modelMessage,
      text: cleanedResponseText,
    };

    // Don't save system fallback/error messages into history — they corrupt the context
    const isErrorFallback =
      responseText.includes("voice channel hit a snag") ||
      responseText.includes("neural router isn") ||
      responseText.includes("MISSION_DEVIATION_DETECTED") ||
      responseText.includes("local inference is locked");

    if (!isErrorFallback) {
      this.messageHistory.push(historyMessage);
    }

    // Save state (cap history at 200 entries to prevent unbounded growth)
    const capped = this.messageHistory.slice(-200);
    await persistenceService.saveState({ messageHistory: capped });

    // Dispatch back to appropriate channel
    await this.dispatchResponse(modelMessage);

    return modelMessage;
  }

  public getHistory(options?: {
    since?: number;
    source?: OSMessage["source"];
  }) {
    const since = options?.since;
    const source = options?.source;

    return this.messageHistory.filter((message) => {
      if (source && message.source !== source) {
        return false;
      }

      if (since) {
        const timestamp = Date.parse(message.timestamp);
        if (!Number.isNaN(timestamp) && timestamp <= since) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Dispatches a response back to the appropriate channel.
   */
  async dispatchResponse(message: OSMessage) {
    console.log(
      `[router] Dispatching neural broadcast for ${message.source}...`,
    );
    // Notify all observers (e.g. WebSocket server for broadcast)
    this.observers.forEach((callback) => callback(message));
  }

  /**
   * Immediately broadcasts an arbitrary message to all WebSocket observers
   * without routing through consciousness. Use for Telegram sync pushes etc.
   */
  public broadcast(msg: Partial<OSMessage>) {
    const fullMsg: OSMessage = {
      id: msg.id || `broadcast-${Date.now()}`,
      source: msg.source || "system",
      role: msg.role || "user",
      text: msg.text || "",
      timestamp: msg.timestamp || new Date().toISOString(),
    };
    this.observers.forEach((callback) => callback(fullMsg));
  }

  /** Wipe all chat history and reset state to a clean slate. */
  public async clearHistory(): Promise<void> {
    this.messageHistory = [];
    this.processedIds.clear();
    await persistenceService.saveState({ messageHistory: [] });
    console.log("[router] Chat history cleared.");
  }
}

export const messageRouter = new MessageRouter();
