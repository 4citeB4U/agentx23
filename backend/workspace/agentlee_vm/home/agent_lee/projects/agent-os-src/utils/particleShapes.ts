/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UTIL.PARTICLE_SHAPES
REGION: 🔵 UTIL
============================================================================ */
import * as THREE from "three";

export type ParticleShapeId =
  | "MICRO_SPHERES" | "MICRO_CUBES" | "MICRO_TETRAHEDRONS" | "MICRO_OCTAHEDRONS"
  | "VOXELS" | "RODS" | "DISCS" | "SHARDS" | "PLATES" | "GLYPH_TILES"
  | "NODES" | "FILAMENTS" | "METABALL_DROPLETS" | "PIXEL_CUBES" | "FRAGMENTS";

export function buildParticleGeometry(id: ParticleShapeId): THREE.BufferGeometry {
  const s = 0.15; // Base particle size
  switch (id) {
    case "MICRO_SPHERES": return new THREE.SphereGeometry(s, 8, 8);
    case "MICRO_CUBES": return new THREE.BoxGeometry(s, s, s);
    case "MICRO_TETRAHEDRONS": return new THREE.TetrahedronGeometry(s);
    case "MICRO_OCTAHEDRONS": return new THREE.OctahedronGeometry(s);
    case "VOXELS": return new THREE.BoxGeometry(s * 1.2, s * 1.2, s * 1.2);
    case "RODS": return new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 2, 6);
    case "DISCS": return new THREE.CylinderGeometry(s, s, s * 0.2, 8);
    case "SHARDS": return new THREE.ConeGeometry(s, s * 2, 3);
    case "PLATES": return new THREE.BoxGeometry(s * 2, s * 0.1, s * 1.5);
    case "GLYPH_TILES": return new THREE.BoxGeometry(s, s, s * 0.5);
    case "NODES": return new THREE.IcosahedronGeometry(s, 0);
    case "FILAMENTS": return new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 4, 4);
    case "METABALL_DROPLETS": return new THREE.SphereGeometry(s * 1.1, 6, 6);
    case "PIXEL_CUBES": return new THREE.BoxGeometry(s, s, s);
    case "FRAGMENTS": return new THREE.TetrahedronGeometry(s * 0.8);
    default: return new THREE.BoxGeometry(s, s, s);
  }
}
