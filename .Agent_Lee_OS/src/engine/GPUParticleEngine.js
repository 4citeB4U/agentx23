/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.GPUPARTICLEENGINE.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = GPUParticleEngine module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\GPUParticleEngine.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// GPUParticleEngine.js
// Ping-pong FBO simulation — 300k–2M+ particles, fully GPU side
// Position + velocity stored in floating-point render targets
// Each frame: run sim shaders A→B, swap, draw instanced quads from texture

import * as THREE from 'three';

// ── Simulation shaders ──────────────────────────────────────────────────────

const SIM_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const VELOCITY_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uTarget;
uniform float uDt;
uniform float uTime;
uniform float uMorphT;
varying vec2 vUv;

vec3 curlNoise(vec3 p, float t) {
  float e = 0.1;
  float n = sin(p.x*1.7+t)*sin(p.y*2.3-t*0.7)*cos(p.z*1.9+t*0.5);
  float dzdY = (sin(p.x*(1.7))*(cos((p.y+e)*2.3-t*0.7))*cos(p.z*1.9+t*0.5) -
                sin(p.x*(1.7))*(cos((p.y-e)*2.3-t*0.7))*cos(p.z*1.9+t*0.5)) / (2.0*e);
  float dydZ = (sin(p.x*1.7+t)*sin(p.y*2.3-t*0.7)*(cos((p.z+e)*1.9+t*0.5)) -
                sin(p.x*1.7+t)*sin(p.y*2.3-t*0.7)*(cos((p.z-e)*1.9+t*0.5))) / (2.0*e);
  return vec3(dzdY - dydZ, 0.0, 0.0); // simplified curl for GPU perf
}

float swirlEnvelope(float t) {
  return t < 0.3 ? t/0.3 : 1.0 - (t-0.3)/0.7;
}

void main() {
  vec3 pos    = texture2D(uPos,    vUv).xyz;
  vec3 vel    = texture2D(uVel,    vUv).xyz;
  vec3 target = texture2D(uTarget, vUv).xyz;

  vec3 attract = (target - pos) * 3.0 * uDt;
  vec3 curl    = curlNoise(pos, uTime) * 0.4 * swirlEnvelope(uMorphT) * uDt;
  vec3 orbit   = -pos * 0.15 * uDt;

  vel = (vel + attract + curl + orbit) * 0.92;

  gl_FragColor = vec4(vel, 1.0);
}`;

const POSITION_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform float uDt;
varying vec2 vUv;
void main() {
  vec3 pos = texture2D(uPos, vUv).xyz;
  vec3 vel = texture2D(uVel, vUv).xyz;
  gl_FragColor = vec4(pos + vel * uDt, 1.0);
}`;

// ── Draw shader ─────────────────────────────────────────────────────────────

const DRAW_VERT = /* glsl */`
attribute vec2 aUv;       // which texel = which particle
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uPointScale;
varying float vSpeed;

void main() {
  vec3 pos  = texture2D(uPos, aUv).xyz;
  vec3 vel  = texture2D(uVel, aUv).xyz;
  vSpeed    = length(vel) * 2.0;
  vec4 mv   = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp((4.0 * uPointScale) / -mv.z, 0.5, 24.0);
  gl_Position  = projectionMatrix * mv;
}`;

const DRAW_FRAG = /* glsl */`
precision highp float;
uniform vec3  uColor;
uniform vec3  uColorB;
uniform float uGlobalAlpha;
varying float vSpeed;

void main() {
  vec2  co   = gl_PointCoord - 0.5;
  float dist = length(co);
  if (dist > 0.5) discard;
  float halo = smoothstep(0.5, 0.1, dist);
  float core = smoothstep(0.15, 0.0, dist);
  float a    = (halo + core * 0.6);
  float b    = 1.0 + min(vSpeed, 1.0) * 0.8;
  vec3  col  = mix(uColor, uColorB, dist * 2.0) * b;
  gl_FragColor = vec4(col, a * uGlobalAlpha);
}`;

// ── Engine class ─────────────────────────────────────────────────────────────

export class GPUParticleEngine {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} count
   * @param {object} options
   */
  constructor(renderer, count, options = {}) {
    this.renderer = renderer;
    this.count    = count;

    // Texture dimensions — find smallest square that fits count
    this.texW = Math.ceil(Math.sqrt(count));
    this.texH = Math.ceil(count / this.texW);
    const texCount = this.texW * this.texH;

    const rtOpts = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format:    THREE.RGBAFormat,
      type:      THREE.FloatType,
    };

    // Ping-pong render targets (position + velocity each)
    this._posA = new THREE.WebGLRenderTarget(this.texW, this.texH, rtOpts);
    this._posB = new THREE.WebGLRenderTarget(this.texW, this.texH, rtOpts);
    this._velA = new THREE.WebGLRenderTarget(this.texW, this.texH, rtOpts);
    this._velB = new THREE.WebGLRenderTarget(this.texW, this.texH, rtOpts);
    this._targetRT = new THREE.WebGLRenderTarget(this.texW, this.texH, rtOpts);

    // Fill position A with scattered random positions
    const initData = new Float32Array(texCount * 4);
    for (let i = 0; i < texCount; i++) {
      initData[i*4]   = (Math.random() - 0.5) * 6;
      initData[i*4+1] = (Math.random() - 0.5) * 6;
      initData[i*4+2] = (Math.random() - 0.5) * 6;
      initData[i*4+3] = 1;
    }
    const initTex = new THREE.DataTexture(initData, this.texW, this.texH, THREE.RGBAFormat, THREE.FloatType);
    initTex.needsUpdate = true;

    // Target texture (written from JS, updated each morph change)
    this._targetData = new Float32Array(texCount * 4);
    this._targetTex  = new THREE.DataTexture(this._targetData, this.texW, this.texH, THREE.RGBAFormat, THREE.FloatType);

    // Simulation scene + ortho camera (full screen quad pass)
    this._simScene  = new THREE.Scene();
    this._simCam    = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad      = new THREE.PlaneGeometry(2, 2);

    this._velMat = new THREE.ShaderMaterial({
      vertexShader:   SIM_VERT,
      fragmentShader: VELOCITY_FRAG,
      uniforms: {
        uPos: { value: initTex }, uVel: { value: null },
        uTarget: { value: this._targetTex },
        uDt: { value: 0.016 }, uTime: { value: 0 }, uMorphT: { value: 1 },
      }
    });
    this._posMat = new THREE.ShaderMaterial({
      vertexShader:   SIM_VERT,
      fragmentShader: POSITION_FRAG,
      uniforms: { uPos: { value: null }, uVel: { value: null }, uDt: { value: 0.016 } }
    });

    this._velMesh = new THREE.Mesh(quad, this._velMat);
    this._posMesh = new THREE.Mesh(quad, this._posMat);

    // Seed position A
    this.renderer.setRenderTarget(this._posA);
    this.renderer.render(new (() => { const s=new THREE.Scene(); s.add(new THREE.Mesh(quad, new THREE.MeshBasicMaterial({map:initTex}))); return s; })(), this._simCam);
    this.renderer.setRenderTarget(null);

    // ── Draw geometry — one point per texel ─────────────────────────────
    const uvs = new Float32Array(texCount * 2);
    for (let i = 0; i < texCount; i++) {
      uvs[i*2]   = (i % this.texW) / this.texW;
      uvs[i*2+1] = Math.floor(i / this.texW) / this.texH;
    }
    const drawGeo = new THREE.BufferGeometry();
    drawGeo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
    drawGeo.setDrawRange(0, count); // only draw real particles, not padded texels

    this._drawMat = new THREE.ShaderMaterial({
      vertexShader:   DRAW_VERT,
      fragmentShader: DRAW_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
      uniforms: {
        uPos:         { value: this._posA.texture },
        uVel:         { value: this._velA.texture },
        uColor:       { value: options.colorA ?? new THREE.Color(0x20ccff) },
        uColorB:      { value: options.colorB ?? new THREE.Color(0x8844ff) },
        uPointScale:  { value: window.innerHeight * 0.5 },
        uGlobalAlpha: { value: 1.0 },
      }
    });

    this.mesh = new THREE.Points(drawGeo, this._drawMat);
    window.addEventListener('resize', () => {
      this._drawMat.uniforms.uPointScale.value = window.innerHeight * 0.5;
    });

    this._posRead = this._posA;
    this._posWrite = this._posB;
    this._velRead  = this._velA;
    this._velWrite = this._velB;
  }

  // ── Upload new target positions ──────────────────────────────────────────

  setTargetPositions(positions) {
    const texCount = this.texW * this.texH;
    const count    = Math.min(positions.length / 3, texCount);
    for (let i = 0; i < count; i++) {
      this._targetData[i*4]   = positions[i*3];
      this._targetData[i*4+1] = positions[i*3+1];
      this._targetData[i*4+2] = positions[i*3+2];
      this._targetData[i*4+3] = 1;
    }
    this._targetTex.needsUpdate = true;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  update(dt, time, morphT) {
    // Velocity pass
    this._simScene.remove(this._velMesh, this._posMesh);
    this._velMat.uniforms.uPos.value    = this._posRead.texture;
    this._velMat.uniforms.uVel.value    = this._velRead.texture;
    this._velMat.uniforms.uTarget.value = this._targetTex;
    this._velMat.uniforms.uDt.value     = dt;
    this._velMat.uniforms.uTime.value   = time;
    this._velMat.uniforms.uMorphT.value = morphT;
    this._simScene.add(this._velMesh);
    this.renderer.setRenderTarget(this._velWrite);
    this.renderer.render(this._simScene, this._simCam);

    // Position pass
    this._simScene.remove(this._velMesh);
    this._posMat.uniforms.uPos.value = this._posRead.texture;
    this._posMat.uniforms.uVel.value = this._velWrite.texture;
    this._posMat.uniforms.uDt.value  = dt;
    this._simScene.add(this._posMesh);
    this.renderer.setRenderTarget(this._posWrite);
    this.renderer.render(this._simScene, this._simCam);

    this.renderer.setRenderTarget(null);

    // Update draw uniforms from the write buffers
    this._drawMat.uniforms.uPos.value = this._posWrite.texture;
    this._drawMat.uniforms.uVel.value = this._velWrite.texture;

    // Swap ping-pong
    [this._posRead, this._posWrite] = [this._posWrite, this._posRead];
    [this._velRead, this._velWrite] = [this._velWrite, this._velRead];
  }

  setGlobalAlpha(a) {
    this._drawMat.uniforms.uGlobalAlpha.value = a;
  }

  dispose() {
    [this._posA, this._posB, this._velA, this._velB, this._targetRT].forEach(rt => rt.dispose());
    this._velMat.dispose(); this._posMat.dispose(); this._drawMat.dispose();
    this.mesh.geometry.dispose();
    this._targetTex.dispose();
  }
}
