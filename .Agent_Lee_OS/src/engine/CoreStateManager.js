/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.CORESTATEMANAGER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = CoreStateManager module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\CoreStateManager.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// CoreStateManager.js — Single source of truth for the entire engine

export class CoreStateManager {
  constructor() {
    this.state = {
      quality:        'high',   // low | medium | high | cinematic
      coreShape:      'Sphere',
      particleShape:  'Torus',
      morphProgress:  0,        // 0..1
      fps:            60,
      particleCount:  300_000,
      simulationMode: 'cpu',    // cpu | gpu
      cinematic:      false,
    };

    this._listeners = new Map();   // named channels
  }

  // ── State access ──────────────────────────────────────────────────────────

  get(key) {
    return key ? this.state[key] : { ...this.state };
  }

  set(patch) {
    const prev = { ...this.state };
    Object.assign(this.state, patch);
    this._emit('change', this.state, prev);

    // Emit fine-grained channel events
    for (const key of Object.keys(patch)) {
      if (this.state[key] !== prev[key]) {
        this._emit(key, this.state[key], prev[key]);
      }
    }
  }

  // ── Subscription ─────────────────────────────────────────────────────────

  /** Subscribe to all changes: subscribe('change', fn) */
  subscribe(channel, fn) {
    if (!this._listeners.has(channel)) this._listeners.set(channel, new Set());
    this._listeners.get(channel).add(fn);
    return () => this._listeners.get(channel)?.delete(fn); // unsubscribe fn
  }

  _emit(channel, ...args) {
    this._listeners.get(channel)?.forEach(fn => fn(...args));
  }

  // ── Performance tier detection ────────────────────────────────────────────

  /**
   * Detect hardware tier and auto-configure state.
   * @param {WebGLRenderingContext} gl
   * @param {boolean} supportsFloatTextures
   */
  detectAndApplyPerformanceTier(gl, supportsFloatTextures = false) {
    const tier = this._detectTier(gl);
    const config = CoreStateManager.QUALITY_TABLE[tier];

    this.set({
      quality:        tier,
      particleCount:  config.particles,
      simulationMode: (config.gpu && supportsFloatTextures) ? 'gpu' : 'cpu',
    });

    console.log(`[CoreState] Tier: ${tier} | Particles: ${config.particles} | Mode: ${this.state.simulationMode}`);
    return tier;
  }

  _detectTier(gl) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) return 'low';

    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    const isIntegrated = /Intel|llvmpipe|SwiftShader/i.test(renderer);

    const dpr = window.devicePixelRatio;
    const w   = window.innerWidth;

    if (isIntegrated || w < 1280) return 'low';
    if (dpr >= 2 && w >= 2560)    return 'cinematic';
    if (w >= 1920)                 return 'high';
    return 'medium';
  }

  // ── Quality table ─────────────────────────────────────────────────────────

  static QUALITY_TABLE = {
    low:       { particles:    50_000, gpu: false, k4: false },
    medium:    { particles:   150_000, gpu: false, k4: false },
    high:      { particles:   300_000, gpu: true,  k4: false },
    cinematic: { particles: 1_000_000, gpu: true,  k4: true  },
  };
}
