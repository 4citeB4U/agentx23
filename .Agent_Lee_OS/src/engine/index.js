/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.ENGINE_INDEX.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = index module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\index.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// engine/index.js — barrel export + bootstrap helper
//
// Usage:
//   import { bootstrapEngine } from './engine/index.js';
//   const { renderer, state, morph, scaler, scene, camera } = bootstrapEngine(canvas);
//   // in your animation loop:
//   requestAnimationFrame(function loop(now) {
//     const dt = Math.min((now - prev) / 1000, 0.05);
//     scaler.tick(dt);
//     morph.update(dt);
//     adapter.update(dt);
//     renderer.render(scene, camera);
//     requestAnimationFrame(loop);
//   });

export { RendererSystem        } from './Renderer.js';
export { CoreStateManager      } from './CoreStateManager.js';
export { ProjectionController  } from './ProjectionController.js';
export { ParticlePhysicsEngine } from './ParticlePhysicsEngine.js';
export { CPUParticleEngine     } from './CPUParticleEngine.js';
export { GPUParticleEngine     } from './GPUParticleEngine.js';
export { ParticleSystemAdapter } from './ParticleSystemAdapter.js';
export { MorphController       } from './MorphController.js';
export { AdaptiveScaler        } from './AdaptiveScaler.js';

import * as THREE from 'three';
import { RendererSystem        } from './Renderer.js';
import { CoreStateManager      } from './CoreStateManager.js';
import { ParticleSystemAdapter } from './ParticleSystemAdapter.js';
import { MorphController       } from './MorphController.js';
import { AdaptiveScaler        } from './AdaptiveScaler.js';

/**
 * One-shot bootstrap — creates everything, wires state, returns handles.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object}            options
 * @param {number}  options.fov          camera FOV (default 75)
 * @param {boolean} options.autoDetect   auto-detect performance tier (default true)
 * @returns {{ renderer, state, scene, camera, adapter, morph, scaler, core }}
 */
export function bootstrapEngine(canvas, options = {}) {
  // ── Scene + Camera ──────────────────────────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    options.fov ?? 75,
    canvas.clientWidth / canvas.clientHeight,
    0.01,
    200
  );
  camera.position.set(0, 0, 6);

  window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  });

  // ── Renderer ────────────────────────────────────────────────────────────
  const renderer = new RendererSystem(canvas);

  // ── State ───────────────────────────────────────────────────────────────
  const state = new CoreStateManager();

  if (options.autoDetect !== false) {
    state.detectAndApplyPerformanceTier(renderer.gl, renderer.supportsFloatTextures);
  }

  // ── Lighting (for solid core mesh) ──────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x111122, 2));
  const point = new THREE.PointLight(0x0088ff, 3, 20);
  point.position.set(0, 3, 3);
  scene.add(point);

  // ── Solid Core ──────────────────────────────────────────────────────────
  const coreGeo = new THREE.IcosahedronGeometry(0.5, 5);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uPulse:     { value: 0.5 },
      uCoreColor: { value: new THREE.Color(0x00aaff) },
      uMetalness: { value: 0.4 },
      uRoughness: { value: 0.1 },
    },
    vertexShader:   coreVertSrc,
    fragmentShader: coreFragSrc,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  // ── Particle system ─────────────────────────────────────────────────────
  const adapter = new ParticleSystemAdapter(renderer, state, scene);
  adapter.init();

  // Kick off initial target shape
  adapter.setTargetShape(state.get('particleShape'), true /* immediate */);

  // ── Morph controller ─────────────────────────────────────────────────────
  const morph = new MorphController(adapter, state);

  // ── Adaptive scaler ──────────────────────────────────────────────────────
  const scaler = new AdaptiveScaler(renderer, state);

  // Pause scaler during active morphs
  state.subscribe('morphProgress', (t) => {
    if (t < 1) scaler.lockDuringMorph();
    else       scaler.unlock();
  });

  return { renderer, state, scene, camera, adapter, morph, scaler, core, coreMat };
}

// ── Inline shader source (avoids raw import issues in all bundlers) ────────

const coreVertSrc = /* glsl */`
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
uniform float uTime;
uniform float uPulse;
void main() {
  vec3 pos = position;
  float d = sin(normal.x*8.0+uTime*1.5)*cos(normal.y*7.0+uTime*1.2)*0.02*uPulse;
  pos += normal * d;
  vec4 mv   = modelViewMatrix * vec4(pos, 1.0);
  vNormal   = normalize(normalMatrix * normal);
  vViewDir  = normalize(-mv.xyz);
  vUv       = uv;
  gl_Position = projectionMatrix * mv;
}`;

const coreFragSrc = /* glsl */`
precision highp float;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
uniform float uTime;
uniform float uPulse;
uniform vec3  uCoreColor;
uniform float uMetalness;
uniform float uRoughness;
float fresnel(vec3 n, vec3 v) {
  return 0.05 + 0.95 * pow(1.0 - clamp(dot(n,v),0.0,1.0), 5.0);
}
void main() {
  vec3  n   = normalize(vNormal);
  vec3  v   = normalize(vViewDir);
  float f   = fresnel(n, v);
  float rim = pow(1.0 - max(dot(n,v),0.0), 3.0);
  float pulse = 0.8 + 0.2*sin(uTime*2.0)*uPulse;
  vec3  emit  = uCoreColor * pulse;
  vec3  spec  = vec3(pow(max(dot(n, normalize(v+vec3(0,1,0))),0.0), mix(512.0,2.0,uRoughness*uRoughness)));
  vec3  col   = emit + uCoreColor*rim*2.0 + spec*uMetalness;
  float iri   = rim * 0.3;
  col += vec3(sin(uTime*.7+vUv.x*6.28)*iri, sin(uTime*.9+vUv.y*6.28)*iri, sin(uTime*1.1+vUv.x*3.14)*iri);
  gl_FragColor = vec4(col, 1.0);
}`;
