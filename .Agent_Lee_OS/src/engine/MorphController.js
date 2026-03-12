/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.MORPHCONTROLLER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = MorphController module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\MorphController.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// MorphController.js
// Orchestrates shape transitions with stability trick:
//   1. Store current positions
//   2. Generate new target
//   3. Nearest-neighbor remap (no cross-map snapping)
//   4. Gradual attraction + swirl envelope for first 30% of transition
//   5. Queue support — transitions can be chained without tearing

import { ProjectionController } from './ProjectionController.js';

export class MorphController {
  /**
   * @param {ParticleSystemAdapter} adapter
   * @param {CoreStateManager}      state
   */
  constructor(adapter, state) {
    this.adapter  = adapter;
    this.state    = state;

    this._queue       = [];    // pending shape transitions
    this._progress    = 1;     // 0..1 (1 = idle, 0 = just started)
    this._duration    = 2.0;   // seconds per morph
    this._active      = false;

    // Listen for external shape change requests
    state.subscribe('coreShape', (val) => this.morphTo(val));
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * Queue a morph to the given shape.
   * If a morph is already running the new one queues after.
   * @param {string} shape
   * @param {number} duration  override morph duration in seconds
   */
  morphTo(shape, duration) {
    this._queue.push({ shape, duration: duration ?? this._duration });
    if (!this._active) this._startNext();
  }

  /** Set how long each morph takes (seconds) */
  setDuration(s) { this._duration = s; }

  /**
   * Update — call every frame from your animation loop.
   * @param {number} dt  delta seconds
   */
  update(dt) {
    if (!this._active) return;

    this._progress += dt / this._current.duration;
    const t = Math.min(this._progress, 1);

    // Feed morph progress to adapter (drives swirl envelope in physics)
    this.adapter._morphT = t;

    // Inform state for UI / layer queries
    this.state.set({ morphProgress: t });

    if (t >= 1) {
      this._active = false;
      console.log(`[Morph] Completed → ${this._current.shape}`);
      if (this._queue.length > 0) {
        // Small pause between chained morphs
        setTimeout(() => this._startNext(), 300);
      }
    }
  }

  get isActive() { return this._active; }
  get progress()  { return this._progress; }

  // ── Internal ──────────────────────────────────────────────────────────────

  _startNext() {
    if (this._queue.length === 0) return;

    this._current  = this._queue.shift();
    this._progress = 0;
    this._active   = true;

    console.log(`[Morph] Starting → ${this._current.shape} (${this._current.duration}s)`);

    // Delegate to adapter — it handles nearest-neighbor remap
    this.adapter.setTargetShape(this._current.shape, false /* transitional */);
  }
}
