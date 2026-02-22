/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UTIL.SAMPLER
REGION: 🔵 UTIL
============================================================================ */
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export function sampleSurfacePoints(args: {
  geometry: THREE.BufferGeometry;
  count: number;
  scale?: number;
  color?: THREE.Color;
}) {
  const { geometry, count, scale = 1, color = new THREE.Color(1, 1, 1) } = args;

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const sampler = new MeshSurfaceSampler(mesh).build();

  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    sampler.sample(p);
    pos[i * 3 + 0] = p.x * scale;
    pos[i * 3 + 1] = p.y * scale;
    pos[i * 3 + 2] = p.z * scale;

    col[i * 3 + 0] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
  }

  return { pos, col };
}
