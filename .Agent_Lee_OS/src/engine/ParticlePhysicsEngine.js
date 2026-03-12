/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.PARTICLEPHYSICSENGINE.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = ParticlePhysicsEngine module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\ParticlePhysicsEngine.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ParticlePhysicsEngine.js — CPU-side realistic particle motion
// Includes: attraction, curl-noise swirl, damping, orbit bias, soft separation

export class ParticlePhysicsEngine {
  /**
   * @param {number} count  number of particles
   */
  constructor(count) {
    this.count      = count;
    this.positions  = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.phases     = new Float32Array(count);       // per-particle noise phase offset

    // Physics knobs — tunable at runtime
    this.attractionStrength = 3.0;
    this.damping            = 0.92;
    this.swirlStrength      = 0.4;   // curl-noise intensity
    this.orbitBias          = 0.15;  // pull toward origin to avoid escape
    this.separationRadius   = 0.05;
    this.separationStrength = 0.3;

    // Init phases with random offsets to break uniformity
    for (let i = 0; i < count; i++) this.phases[i] = Math.random() * Math.PI * 2;
  }

  // ── Main step ─────────────────────────────────────────────────────────────

  /**
   * Advance simulation one tick.
   * @param {Float32Array} targetPositions  remapped target from ProjectionController
   * @param {number}       dt               delta time in seconds
   * @param {number}       time             elapsed time (for curl noise)
   * @param {number}       morphT           morph progress 0..1 (swirl peaks at 0.3)
   */
  step(targetPositions, dt, time = 0, morphT = 1) {
    const count      = this.count;
    const pos        = this.positions;
    const vel        = this.velocities;
    const phases     = this.phases;

    const attr   = this.attractionStrength;
    const damp   = this.damping;
    const swirl  = this.swirlStrength * this._swirlEnvelope(morphT);
    const orbit  = this.orbitBias;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = pos[i3], py = pos[i3+1], pz = pos[i3+2];

      // 1. Attraction toward morph target
      const tx = targetPositions[i3]   - px;
      const ty = targetPositions[i3+1] - py;
      const tz = targetPositions[i3+2] - pz;

      vel[i3]   += tx * attr * dt;
      vel[i3+1] += ty * attr * dt;
      vel[i3+2] += tz * attr * dt;

      // 2. Curl noise swirl (cheap layered approximation)
      const { cx, cy, cz } = this._curlNoise(px, py, pz, time + phases[i]);
      vel[i3]   += cx * swirl * dt;
      vel[i3+1] += cy * swirl * dt;
      vel[i3+2] += cz * swirl * dt;

      // 3. Orbit bias — soft pull toward origin so particles don't escape
      vel[i3]   -= px * orbit * dt;
      vel[i3+1] -= py * orbit * dt;
      vel[i3+2] -= pz * orbit * dt;

      // 4. Damping
      vel[i3]   *= damp;
      vel[i3+1] *= damp;
      vel[i3+2] *= damp;

      // 5. Integrate
      pos[i3]   += vel[i3]   * dt;
      pos[i3+1] += vel[i3+1] * dt;
      pos[i3+2] += vel[i3+2] * dt;
    }

    // 6. Soft separation pass — prevents hard clumping
    this._separationPass();
  }

  // ── Curl noise (cheap layered sin/cos approximation) ─────────────────────

  _curlNoise(x, y, z, t) {
    const eps = 0.1;
    const n   = (a, b, c) => Math.sin(a * 1.7 + t) * Math.sin(b * 2.3 - t * 0.7) * Math.cos(c * 1.9 + t * 0.5);

    // Finite-difference curl of noise field F
    const dFz_dy = (n(x, y+eps, z) - n(x, y-eps, z)) / (2*eps);
    const dFy_dz = (n(x, y, z+eps) - n(x, y, z-eps)) / (2*eps);
    const dFx_dz = (n(x+eps, y, z) - n(x-eps, y, z)) / (2*eps);
    const dFz_dx = dFz_dy; // symmetry shortcut for perf
    const dFy_dx = (n(x, y+eps, z) - n(x, y-eps, z)) / (2*eps);
    const dFx_dy = dFx_dz;

    return {
      cx: dFz_dy - dFy_dz,
      cy: dFx_dz - dFz_dx,
      cz: dFy_dx - dFx_dy,
    };
  }

  // ── Swirl envelope — peaks at 30% morph, fades out ──────────────────────

  _swirlEnvelope(t) {
    // Triangle ramp: 0→1 from 0..0.3, then 1→0 from 0.3..1
    if (t < 0.3) return t / 0.3;
    return 1 - (t - 0.3) / 0.7;
  }

  // ── Soft separation (N² but sampled at every 8th pair for perf) ──────────

  _separationPass() {
    const pos  = this.positions;
    const vel  = this.velocities;
    const r2   = this.separationRadius * this.separationRadius;
    const str  = this.separationStrength;
    const step = 8; // stride — check every 8th pair instead of all pairs

    for (let i = 0; i < this.count; i += step) {
      const i3 = i * 3;
      for (let j = i + 1; j < Math.min(i + 64, this.count); j++) {
        const j3 = j * 3;
        const dx = pos[i3]   - pos[j3];
        const dy = pos[i3+1] - pos[j3+1];
        const dz = pos[i3+2] - pos[j3+2];
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < r2 && d2 > 0.0001) {
          const inv = str / Math.sqrt(d2);
          vel[i3]   += dx * inv; vel[j3]   -= dx * inv;
          vel[i3+1] += dy * inv; vel[j3+1] -= dy * inv;
          vel[i3+2] += dz * inv; vel[j3+2] -= dz * inv;
        }
      }
    }
  }

  /** Scatter particles to initial random positions (call once at init) */
  scatter(scale = 2) {
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.positions[i3]   = (Math.random() - 0.5) * scale;
      this.positions[i3+1] = (Math.random() - 0.5) * scale;
      this.positions[i3+2] = (Math.random() - 0.5) * scale;
    }
  }
}
