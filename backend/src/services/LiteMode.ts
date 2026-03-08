// LEEWAY v12 HEADER
// File: backend/src/services/LiteMode.ts
// Purpose: Pi-Appliance Lite Mode state machine.
// Activated by drift/latency watchdog when CPU/RAM pressure is high or a dependency is down.
// Effects: fast model only, no MCP modules, tighter concurrency, block privileged writes.

import { EventEmitter } from "events";
import { concurrencyGuard } from "./ConcurrencyGuard.js";
import { ResourceGovernor } from "./ResourceGovernor.js";

export interface LiteModeState {
  active: boolean;
  reason: string;
  activatedAt: number | null;
  deactivatedAt: number | null;
}

class LiteModeService extends EventEmitter {
  private state: LiteModeState = {
    active: false,
    reason: "",
    activatedAt: null,
    deactivatedAt: null,
  };

  activate(reason: string): void {
    if (this.state.active) return; // already active
    this.state.active = true;
    this.state.reason = reason;
    this.state.activatedAt = Date.now();
    this.state.deactivatedAt = null;

    // Enforce resource constraints
    ResourceGovernor.toggleSafeMode(true);
    concurrencyGuard.setLiteMode(true);
    process.env.MCP_LITE_MODE = "true";

    console.warn(`[LiteMode] ACTIVATED — ${reason}`);
    this.emit("activated", this.state);
  }

  deactivate(): void {
    if (!this.state.active) return; // already inactive
    this.state.active = false;
    this.state.deactivatedAt = Date.now();
    this.state.reason = "";

    ResourceGovernor.toggleSafeMode(false);
    concurrencyGuard.setLiteMode(false);
    delete process.env.MCP_LITE_MODE;

    console.info("[LiteMode] DEACTIVATED — full capacity restored");
    this.emit("deactivated", this.state);
  }

  status(): LiteModeState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.active;
  }

  /** Preferred LLM mode string to inject into BrainRouter calls when Lite Mode is active */
  preferredMode(): "fast" | "auto" {
    return this.state.active ? "fast" : "auto";
  }
}

export const liteMode = new LiteModeService();
