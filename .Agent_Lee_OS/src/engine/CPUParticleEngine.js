/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.CPUPARTICLEENGINE.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = CPUParticleEngine module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\CPUParticleEngine.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// CPUParticleEngine.js
// Instanced CPU simulation — 50k–300k particles, runs everywhere
// Uses THREE.Points + ShaderMaterial + per-frame buffer upload

import * as THREE from 'three';
import { ParticlePhysicsEngine } from './ParticlePhysicsEngine.js';

// Raw shader source — imported as strings via Vite ?raw, or inlined here
const VERT = /* glsl */`
attribute vec3  aPosition;
attribute float aSize;
attribute float aBrightness;
uniform   mat4  modelViewMatrix;
uniform   mat4  projectionMatrix;
uniform   float uPointScale;
varying   float vAlpha;
varying   float vBrightness;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPosition, 1.0);
  float s  = max(aSize, 0.5);
  gl_PointSize = clamp((s * uPointScale) / -mv.z, 0.5, 32.0);
  vAlpha      = smoothstep(50.0, 1.0, -mv.z);
  vBrightness = aBrightness;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3  uColor;
uniform vec3  uColorB;
uniform float uGlobalAlpha;
varying float vAlpha;
varying float vBrightness;
void main() {
  vec2  co   = gl_PointCoord - 0.5;
  float dist = length(co);
  if (dist > 0.5) discard;
  float core = smoothstep(0.15, 0.0,  dist);
  float halo = smoothstep(0.5,  0.15, dist);
  float a    = halo + core * 0.5;
  float rim  = pow(1.0 - dist * 2.0, 1.5);
  float b    = 1.0 + vBrightness * 0.8 + rim * 0.4;
  vec3  col  = mix(uColor, uColorB, dist * 2.0) * b;
  gl_FragColor = vec4(col, a * vAlpha * uGlobalAlpha);
}`;

export class CPUParticleEngine {
  /**
   * @param {number} count          particle count
   * @param {object} options
   * @param {THREE.Color} options.colorA   inner color
   * @param {THREE.Color} options.colorB   outer color
   */
  constructor(count, options = {}) {
    this.count   = count;
    this.physics = new ParticlePhysicsEngine(count);
    this.physics.scatter(3);

    // ── Geometry ──────────────────────────────────────────────────────────
    this.geometry = new THREE.BufferGeometry();

    this._posAttr  = new THREE.BufferAttribute(this.physics.positions, 3);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aPosition', this._posAttr);

    // Per-particle size variance (1.0 ± 0.5)
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = 0.7 + Math.random() * 0.6;
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this._brightAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    this._brightAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aBrightness', this._brightAttr);

    // ── Material ──────────────────────────────────────────────────────────
    this.material = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
      uniforms: {
        uColor:       { value: options.colorA ?? new THREE.Color(0x20ccff) },
        uColorB:      { value: options.colorB ?? new THREE.Color(0x8844ff) },
        uPointScale:  { value: window.innerHeight * 0.5 },
        uGlobalAlpha: { value: 1.0 },
      }
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    window.addEventListener('resize', () => {
      this.material.uniforms.uPointScale.value = window.innerHeight * 0.5;
    });
  }

  // ── Update (call every frame) ─────────────────────────────────────────

  /**
   * @param {Float32Array} targetPositions  remapped target buffer
   * @param {number}       dt               delta seconds
   * @param {number}       time             elapsed seconds
   * @param {number}       morphT           0..1 morph progress
   */
  update(targetPositions, dt, time, morphT) {
    this.physics.step(targetPositions, dt, time, morphT);
    this._posAttr.needsUpdate = true;

    // Compute velocity magnitudes → brightness
    const vel    = this.physics.velocities;
    const bright = this._brightAttr.array;
    for (let i = 0; i < this.count; i++) {
      const i3   = i * 3;
      const spd  = Math.sqrt(vel[i3]*vel[i3] + vel[i3+1]*vel[i3+1] + vel[i3+2]*vel[i3+2]);
      bright[i]  = Math.min(spd * 2, 1);
    }
    this._brightAttr.needsUpdate = true;
  }

  setGlobalAlpha(a) {
    this.material.uniforms.uGlobalAlpha.value = a;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
