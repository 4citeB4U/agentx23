/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UTIL.TESSERACT
REGION: 🔵 UTIL
============================================================================ */
import * as THREE from 'three';

// 1. 4D POINTS + TESSERACT TOPOLOGY
function makeTesseractVertices4D(size = 1) {
  const s = size;
  const verts: number[][] = [];
  for (let xi = -1; xi <= 1; xi += 2)
    for (let yi = -1; yi <= 1; yi += 2)
      for (let zi = -1; zi <= 1; zi += 2)
        for (let wi = -1; wi <= 1; wi += 2)
          verts.push([xi * s, yi * s, zi * s, wi * s]);
  return verts;
}

function makeTesseractEdges() {
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++)
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) edges.push([i, j]);
    }
  return edges;
}

// 2. 4D ROTATION
function rotate4DInPlane(p: number[], a: number, b: number, theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const out = [...p];
  out[a] = p[a] * c - p[b] * s;
  out[b] = p[a] * s + p[b] * c;
  return out;
}

function rotate4D(p: number[], angles: Record<string, number>) {
  let q = p;
  if (angles.xy) q = rotate4DInPlane(q, 0, 1, angles.xy);
  if (angles.xz) q = rotate4DInPlane(q, 0, 2, angles.xz);
  if (angles.yz) q = rotate4DInPlane(q, 1, 2, angles.yz);
  if (angles.xw) q = rotate4DInPlane(q, 0, 3, angles.xw);
  if (angles.yw) q = rotate4DInPlane(q, 1, 3, angles.yw);
  if (angles.zw) q = rotate4DInPlane(q, 2, 3, angles.zw);
  return q;
}

// 3. PROJECTION
function project4Dto3D(p4: number[], opts: { wDist?: number; scale?: number }) {
  const { wDist = 4.0, scale = 1.0 } = opts;
  const [x, y, z, w] = p4;
  const denom = wDist - w;
  const f = denom !== 0 ? wDist / denom : 999.0;
  return [x * f * scale, y * f * scale, z * f * scale];
}

// 4. CORE FACTORY
export function createTesseractCore(options: {
  size?: number;
  color?: number;
  lineOpacity?: number;
  wDist?: number;
  scale?: number;
} = {}) {
  const {
    size = 1.0,
    color = 0x00ff7f,
    lineOpacity = 0.8,
    wDist = 3.5,
    scale = 1.0
  } = options;

  const verts4D = makeTesseractVertices4D(size);
  const edges = makeTesseractEdges();
  const group = new THREE.Group();

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(edges.length * 2 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: lineOpacity,
    depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);

  const vertexGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const vertexMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const vertexMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(vertexGeo, vertexMat);
    group.add(m);
    vertexMeshes.push(m);
  }

  let t = 0;

  function update(dt: number, audioPeak: number) {
    t += dt * (1 + audioPeak * 2);
    const angles = {
      xy: t * 0.20, xz: t * 0.15, yz: t * 0.10,
      xw: t * 0.75, yw: t * 0.55, zw: t * 0.35,
    };
    const pulse = 1.0 + audioPeak * 0.5;
    const verts3D: number[][] = new Array(16);

    for (let i = 0; i < 16; i++) {
      const r = rotate4D(verts4D[i], angles);
      const p3 = project4Dto3D(r, { wDist, scale: scale * pulse });
      verts3D[i] = p3;
      vertexMeshes[i].position.set(p3[0], p3[1], p3[2]);
      (vertexMeshes[i].material as THREE.MeshBasicMaterial).color.setHSL(
        audioPeak > 0.1 ? 0.4 + audioPeak * 0.2 : 0, 1.0, audioPeak > 0.1 ? 0.8 : 1.0
      );
    }

    let k = 0;
    for (let e = 0; e < edges.length; e++) {
      const [a, b] = edges[e];
      const pa = verts3D[a], pb = verts3D[b];
      positions[k++] = pa[0]; positions[k++] = pa[1]; positions[k++] = pa[2];
      positions[k++] = pb[0]; positions[k++] = pb[1]; positions[k++] = pb[2];
    }
    geometry.attributes.position.needsUpdate = true;
    group.rotation.y += dt * 0.2;
    group.rotation.z += dt * 0.1;
  }

  return {
    group, update, material,
    setOpacity(op: number) {
      material.opacity = op;
      vertexMat.opacity = Math.min(1, op);
    },
  };
}
