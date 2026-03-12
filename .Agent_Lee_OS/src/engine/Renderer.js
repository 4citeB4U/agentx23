/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.RENDERER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = Renderer module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\Renderer.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// Renderer.js — 4K + Performance-Controlled Rendering System
import * as THREE from 'three';

export class RendererSystem {
  constructor(canvas) {
    this.canvas   = canvas;
    this.mode     = 'interactive';
    this._onResize = this._onResize.bind(this);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:       false,   // MSAA off — let shaders do soft edges
      powerPreference: 'high-performance',
      alpha:           false,
    });

    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setAnimationLoop(null); // caller controls loop

    // Capabilities probe — used by AdaptiveScaler
    this.gl = this.renderer.getContext();
    this.supportsFloatTextures =
      !!this.renderer.extensions.get('OES_texture_float') ||
      !!this.renderer.extensions.get('EXT_color_buffer_float');

    this.setInteractiveMode();
    window.addEventListener('resize', this._onResize);
  }

  /** Standard interactive mode — DPR capped, viewport-sized */
  setInteractiveMode() {
    this.mode = 'interactive';
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setScissorTest(false);
  }

  /** True 4K cinematic render target — offscreen quality pass */
  setCinematicMode() {
    this.mode = 'cinematic';
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(3840, 2160, false);
  }

  /**
   * Dynamic resolution scaling — call each frame with current FPS.
   * Keeps particle render at target FPS without killing GPU.
   * @param {number} fps  measured frames per second
   * @param {number} target  desired FPS (default 60)
   */
  scaleDynamicResolution(fps, target = 60) {
    if (this.mode !== 'interactive') return;
    const ratio = fps / target;
    const current = this.renderer.getPixelRatio();
    const maxDPR  = Math.min(window.devicePixelRatio, 2);

    if (ratio < 0.85 && current > 0.5) {
      this.renderer.setPixelRatio(Math.max(current - 0.1, 0.5));
    } else if (ratio > 0.98 && current < maxDPR) {
      this.renderer.setPixelRatio(Math.min(current + 0.05, maxDPR));
    }
  }

  /** Main render call — passes through any post-render compositing hooks */
  render(scene, camera) {
    this.renderer.render(scene, camera);
  }

  /** Returns the raw THREE.WebGLRenderer for pass composers */
  get raw() {
    return this.renderer;
  }

  _onResize() {
    if (this.mode !== 'interactive') return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
