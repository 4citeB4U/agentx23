/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.ADAPTIVESCALER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = AdaptiveScaler module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\AdaptiveScaler.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// AdaptiveScaler.js
// Monitors FPS and dynamically adjusts:
//   - renderer DPI
//   - particle count
//   - simulation mode (CPU ↔ GPU)
// All changes flow through CoreStateManager → downstream engines rebuild

export class AdaptiveScaler {
  /**
   * @param {RendererSystem}    renderer
   * @param {CoreStateManager}  state
   * @param {object}            options
   */
  constructor(renderer, state, options = {}) {
    this.renderer = renderer;
    this.state    = state;

    this._targetFPS     = options.targetFPS    ?? 60;
    this._sampleWindow  = options.sampleWindow ?? 2.0;   // seconds to average
    this._upgradeBuffer = options.upgradeBuffer ?? 5.0;  // seconds of headroom before upgrading

    this._samples       = [];
    this._lastSample    = performance.now();
    this._frameCount    = 0;
    this._headroomTimer = 0;
    this._locked        = false;   // pause adjustments during morph transitions

    // Register with renderer for resize events
    window.addEventListener('resize', () => this._onResize());
  }

  // ── Per-frame tick ────────────────────────────────────────────────────────

  /**
   * Call every animation frame.
   * @param {number} dt  delta seconds
   */
  tick(dt) {
    if (this._locked) return;

    this._frameCount++;
    const now = performance.now();
    const elapsed = (now - this._lastSample) / 1000;

    if (elapsed >= this._sampleWindow) {
      const fps = this._frameCount / elapsed;
      this._samples.push(fps);
      if (this._samples.length > 5) this._samples.shift();

      const avgFPS = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;

      // Dynamic resolution — fast feedback
      this.renderer.scaleDynamicResolution(avgFPS, this._targetFPS);

      // Particle count / tier adjustment — slower feedback
      this._adjustTier(avgFPS, dt);

      // Update state for UI display
      this.state.set({ fps: Math.round(avgFPS) });

      this._frameCount  = 0;
      this._lastSample  = now;
    }
  }

  // ── Lock / unlock during morph (prevent thrashing) ───────────────────────

  lockDuringMorph() { this._locked = true; }
  unlock()          { this._locked = false; }

  // ── Tier adjustment ───────────────────────────────────────────────────────

  _adjustTier(fps, dt) {
    const ratio   = fps / this._targetFPS;
    const current = this.state.get('quality');
    const tiers   = ['low', 'medium', 'high', 'cinematic'];
    const idx     = tiers.indexOf(current);

    if (ratio < 0.75 && idx > 0) {
      // Degrading — step down immediately
      const next = tiers[idx - 1];
      console.log(`[AdaptiveScaler] FPS=${fps.toFixed(1)} → downgrade to ${next}`);
      this._setTier(next);
      this._headroomTimer = 0;
    } else if (ratio > 0.95 && idx < tiers.length - 1) {
      // Headroom — wait before upgrading to avoid flicker
      this._headroomTimer += dt * this._sampleWindow;
      if (this._headroomTimer >= this._upgradeBuffer) {
        const next = tiers[idx + 1];
        console.log(`[AdaptiveScaler] FPS=${fps.toFixed(1)} → upgrade to ${next}`);
        this._setTier(next);
        this._headroomTimer = 0;
      }
    } else {
      this._headroomTimer = 0;
    }
  }

  _setTier(tier) {
    const cfg = CoreStateManager.QUALITY_TABLE?.[tier];
    if (!cfg) return;
    this.state.set({
      quality:       tier,
      particleCount: cfg.particles,
      simulationMode: cfg.gpu ? 'gpu' : 'cpu',
    });
  }

  _onResize() {
    // On resize, re-evaluate DPR for renderer
    this.renderer.setInteractiveMode?.();
  }
}

// ── Import companion (avoid circular) ─────────────────────────────────────
import { CoreStateManager } from './CoreStateManager.js';
