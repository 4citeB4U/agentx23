/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.PARTICLESYSTEMADAPTER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = ParticleSystemAdapter module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\ParticleSystemAdapter.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ParticleSystemAdapter.js
// Chooses CPU or GPU engine, exposes a unified API to MorphController
// Switches engines automatically when tier changes

import { CPUParticleEngine } from './CPUParticleEngine.js';
import { GPUParticleEngine  } from './GPUParticleEngine.js';
import { ProjectionController } from './ProjectionController.js';

export class ParticleSystemAdapter {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {CoreStateManager}    state
   * @param {THREE.Scene}         scene
   */
  constructor(renderer, state, scene) {
    this.renderer = renderer;
    this.state    = state;
    this.scene    = scene;
    this._engine  = null;
    this._target  = new Float32Array(0);
    this._morphT  = 1;
    this._time    = 0;

    // React to tier/mode changes from CoreStateManager
    state.subscribe('quality', () => this._rebuild());
  }

  // ── Build / rebuild engine ────────────────────────────────────────────────

  _rebuild() {
    const s    = this.state.get();
    const mode = s.simulationMode;
    const n    = s.particleCount;

    // Tear down old engine
    if (this._engine) {
      this.scene.remove(this._engine.mesh);
      this._engine.dispose();
      this._engine = null;
    }

    if (mode === 'gpu' && this.renderer.supportsFloatTextures !== false) {
      console.log(`[Adapter] Building GPU engine — ${n.toLocaleString()} particles`);
      this._engine = new GPUParticleEngine(this.renderer.raw, n);
    } else {
      console.log(`[Adapter] Building CPU engine — ${n.toLocaleString()} particles`);
      this._engine = new CPUParticleEngine(n);
    }

    this.scene.add(this._engine.mesh);

    // Re-apply current target if one exists
    if (this._target.length === n * 3) {
      this._applyTarget(this._target);
    } else {
      // Generate default target from current shape state
      const shape = this.state.get('particleShape');
      this.setTargetShape(shape, true /* immediate */);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Call once after state tier detection is done */
  init() {
    this._rebuild();
  }

  /**
   * Set a new morph target shape.
   * @param {string}  shape     ProjectionController shape name
   * @param {boolean} immediate skip transition (snap instantly)
   */
  setTargetShape(shape, immediate = false) {
    const count = this.state.get('particleCount');
    const raw   = ProjectionController.generate(shape, count);

    if (!immediate && this._engine?.physics?.positions) {
      // Build nearest-neighbor remap to prevent cross-stream snapping
      const remap  = ProjectionController.buildNearestMap(this._engine.physics.positions, raw);
      const mapped = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const j = remap[i];
        mapped[i*3]   = raw[j*3];
        mapped[i*3+1] = raw[j*3+1];
        mapped[i*3+2] = raw[j*3+2];
      }
      this._target = mapped;
      this._morphT = 0;  // reset progress so swirl envelope fires
    } else {
      this._target = raw;
      this._morphT = immediate ? 1 : 0;
    }

    this._applyTarget(this._target);
    this.state.set({ particleShape: shape });
  }

  _applyTarget(target) {
    if (!this._engine) return;
    if (typeof this._engine.setTargetPositions === 'function') {
      // GPU path
      this._engine.setTargetPositions(target);
    } else {
      // CPU path — physics engine reads this buffer directly
      // Store reference, physics.step() uses it
      this._currentTarget = target;
    }
  }

  /** Main loop update — call every frame */
  update(dt) {
    if (!this._engine) return;
    this._time += dt;

    // Advance morph progress
    if (this._morphT < 1) {
      this._morphT = Math.min(this._morphT + dt * 0.5, 1); // ~2s full transition
    }

    if (typeof this._engine.update === 'function') {
      // CPU engine: pass target positions + physics params
      const target = this._currentTarget ?? this._target;
      this._engine.update(target, dt, this._time, this._morphT);
    }
    // GPU engine: update is called with renderer-side state
    // (GPUParticleEngine.update handles its own sim passes)
  }

  get mesh() {
    return this._engine?.mesh ?? null;
  }

  setGlobalAlpha(a) {
    this._engine?.setGlobalAlpha(a);
  }

  dispose() {
    if (this._engine) {
      this.scene.remove(this._engine.mesh);
      this._engine.dispose();
    }
  }
}
