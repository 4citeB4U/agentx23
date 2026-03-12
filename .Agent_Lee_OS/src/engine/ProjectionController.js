/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.PROJECTIONCONTROLLER.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = ProjectionController module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\src\engine\ProjectionController.js
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ProjectionController.js — Pure geometry generation (no THREE scene coupling)
import * as THREE from 'three';

export class ProjectionController {

  /**
   * Generate a Float32Array of XYZ positions for `count` particles in `shape`.
   * All positions are unit-scale unless noted.
   *
   * @param {string} shape  Sphere | Torus | Cube | Helix | Galaxy | Klein
   * @param {number} count  number of particles
   * @returns {Float32Array}
   */
  static generate(shape, count) {
    const positions = new Float32Array(count * 3);

    switch (shape) {
      case 'Sphere':   return ProjectionController._sphere(positions, count);
      case 'Torus':    return ProjectionController._torus(positions, count);
      case 'Cube':     return ProjectionController._cube(positions, count);
      case 'Helix':    return ProjectionController._helix(positions, count);
      case 'Galaxy':   return ProjectionController._galaxy(positions, count);
      case 'Klein':    return ProjectionController._klein(positions, count);
      case 'Diamond':  return ProjectionController._diamond(positions, count);
      default:
        console.warn(`[ProjectionController] Unknown shape "${shape}", falling back to Sphere`);
        return ProjectionController._sphere(positions, count);
    }
  }

  // ── Shapes ──────────────────────────────────────────────────────────────

  static _sphere(positions, count) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const i3    = i * 3;
      positions[i3]   = Math.sin(phi) * Math.cos(theta);
      positions[i3+1] = Math.sin(phi) * Math.sin(theta);
      positions[i3+2] = Math.cos(phi);
    }
    return positions;
  }

  static _torus(positions, count, R = 2, r = 0.5) {
    for (let i = 0; i < count; i++) {
      const u  = Math.random() * Math.PI * 2;
      const v  = Math.random() * Math.PI * 2;
      const i3 = i * 3;
      positions[i3]   = (R + r * Math.cos(v)) * Math.cos(u);
      positions[i3+1] = (R + r * Math.cos(v)) * Math.sin(u);
      positions[i3+2] = r * Math.sin(v);
    }
    return positions;
  }

  static _cube(positions, count) {
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Random face placement so surface is evenly distributed
      const face = Math.floor(Math.random() * 6);
      const a = Math.random() * 2 - 1;
      const b = Math.random() * 2 - 1;
      if (face === 0) { positions[i3]=1;  positions[i3+1]=a; positions[i3+2]=b; }
      if (face === 1) { positions[i3]=-1; positions[i3+1]=a; positions[i3+2]=b; }
      if (face === 2) { positions[i3]=a; positions[i3+1]=1;  positions[i3+2]=b; }
      if (face === 3) { positions[i3]=a; positions[i3+1]=-1; positions[i3+2]=b; }
      if (face === 4) { positions[i3]=a; positions[i3+1]=b;  positions[i3+2]=1; }
      if (face === 5) { positions[i3]=a; positions[i3+1]=b;  positions[i3+2]=-1; }
    }
    return positions;
  }

  static _helix(positions, count, turns = 4, radius = 1.5, height = 4) {
    for (let i = 0; i < count; i++) {
      const t  = i / count;
      const angle = t * Math.PI * 2 * turns;
      const i3 = i * 3;
      positions[i3]   = Math.cos(angle) * radius;
      positions[i3+1] = t * height - height / 2;
      positions[i3+2] = Math.sin(angle) * radius;
    }
    return positions;
  }

  static _galaxy(positions, count, arms = 3, spread = 0.4, radius = 3) {
    for (let i = 0; i < count; i++) {
      const t    = Math.random();
      const arm  = Math.floor(Math.random() * arms);
      const angle = (arm / arms) * Math.PI * 2 + t * Math.PI * 3;
      const r    = t * radius;
      const i3   = i * 3;
      positions[i3]   = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
      positions[i3+1] = (Math.random() - 0.5) * spread * 0.3;
      positions[i3+2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
    }
    return positions;
  }

  static _klein(positions, count) {
    // Compact Klein bottle immersion in R³
    for (let i = 0; i < count; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const i3 = i * 3;
      if (u < Math.PI) {
        positions[i3]   = 3 * Math.cos(u) * (1 + Math.sin(u)) + 2 * (1 - Math.cos(u) / 2) * Math.cos(u) * Math.cos(v);
        positions[i3+1] = 8 * Math.sin(u) + 2 * (1 - Math.cos(u) / 2) * Math.sin(u) * Math.cos(v);
        positions[i3+2] = 2 * (1 - Math.cos(u) / 2) * Math.sin(v);
      } else {
        positions[i3]   = 3 * Math.cos(u) * (1 + Math.sin(u)) + 2 * (1 - Math.cos(u) / 2) * Math.cos(v + Math.PI);
        positions[i3+1] = 8 * Math.sin(u);
        positions[i3+2] = 2 * (1 - Math.cos(u) / 2) * Math.sin(v);
      }
      // Normalize to unit scale
      const scale = 0.08;
      positions[i3] *= scale; positions[i3+1] *= scale; positions[i3+2] *= scale;
    }
    return positions;
  }

  static _diamond(positions, count) {
    // Octahedron-inspired distribution with radial bias
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const z     = Math.random() * 2 - 1;
      const r     = Math.sqrt(1 - z * z);
      const bias  = Math.pow(Math.random(), 0.5); // surface-heavy
      const i3    = i * 3;
      positions[i3]   = Math.cos(theta) * r * bias;
      positions[i3+1] = z * bias;
      positions[i3+2] = Math.sin(theta) * r * bias;
    }
    return positions;
  }

  // ── Nearest-neighbor stable remap ─────────────────────────────────────

  /**
   * Build an index map so every source[i] maps to the nearest target position.
   * Prevents cross-stream snapping during morph transitions.
   * O(n) approximation using spatial bucketing.
   *
   * @param {Float32Array} source   current positions
   * @param {Float32Array} target   destination positions
   * @returns {Uint32Array}  remap[i] = j means source[i] targets position[j]
   */
  static buildNearestMap(source, target) {
    const count = source.length / 3;
    const remap = new Uint32Array(count);
    const used  = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      let bestDist = Infinity;
      let bestJ    = i;
      const sx = source[i*3], sy = source[i*3+1], sz = source[i*3+2];

      // Approximate: check ±32 neighbours (fast for real-time)
      const window = Math.min(32, count);
      for (let d = 0; d < window; d++) {
        const j = (i + d) % count;
        if (used[j]) continue;
        const dx = target[j*3]-sx, dy = target[j*3+1]-sy, dz = target[j*3+2]-sz;
        const dist = dx*dx + dy*dy + dz*dz;
        if (dist < bestDist) { bestDist = dist; bestJ = j; }
      }
      remap[i] = bestJ;
      used[bestJ] = 1;
    }
    return remap;
  }
}
