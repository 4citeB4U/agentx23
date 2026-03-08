/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UTIL.CORE_SHAPES
REGION: 🔵 UTIL
============================================================================ */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type CoreShapeId =
  | "SPHERE" | "CUBE" | "TETRAHEDRON" | "OCTAHEDRON" | "ICOSAHEDRON"
  | "DODECAHEDRON" | "TORUS" | "CYLINDER" | "CONE" | "PYRAMID"
  | "CAPSULE" | "ELLIPSOID" | "GEODESIC_DOME" | "CRYSTAL_POLYHEDRON"
  | "METABALL_BLOB" | "VOXEL_CUBE" | "PROTO_MESH_HULL" | "TEDDY_BEAR";

export function buildCoreGeometry(id: CoreShapeId): THREE.BufferGeometry {
  switch (id) {
    case "SPHERE": return new THREE.SphereGeometry(6, 32, 32);
    case "CUBE": return new THREE.BoxGeometry(10, 10, 10);
    case "TETRAHEDRON": return new THREE.TetrahedronGeometry(8);
    case "OCTAHEDRON": return new THREE.OctahedronGeometry(8);
    case "ICOSAHEDRON": return new THREE.IcosahedronGeometry(8);
    case "DODECAHEDRON": return new THREE.DodecahedronGeometry(8);
    case "TORUS": return new THREE.TorusGeometry(6, 2, 16, 100);
    case "CYLINDER": return new THREE.CylinderGeometry(5, 5, 12, 32);
    case "CONE": return new THREE.ConeGeometry(6, 12, 32);
    case "PYRAMID": return new THREE.ConeGeometry(7, 10, 4);
    case "CAPSULE": return new THREE.CapsuleGeometry(4, 8, 4, 16);
    case "ELLIPSOID": {
      const ell = new THREE.SphereGeometry(6, 32, 32);
      ell.scale(1.5, 0.8, 1);
      return ell;
    }
    case "GEODESIC_DOME": return new THREE.IcosahedronGeometry(8, 2);
    case "CRYSTAL_POLYHEDRON": {
      const crystal = new THREE.OctahedronGeometry(8, 1);
      const pos = crystal.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
          pos.getX(i) * (0.8 + Math.random() * 0.4),
          pos.getY(i) * (0.8 + Math.random() * 0.4),
          pos.getZ(i) * (0.8 + Math.random() * 0.4)
        );
      }
      return crystal;
    }
    case "METABALL_BLOB":
      return new THREE.SphereGeometry(7, 32, 32);
    case "VOXEL_CUBE": return new THREE.BoxGeometry(10, 10, 10);
    case "PROTO_MESH_HULL": return new THREE.TorusKnotGeometry(5, 1.5, 100, 16);

    case "TEDDY_BEAR": {
      // Composite: 8 spheres matching the particle formation regions
      const addS = (r: number, tx: number, ty: number, tz: number) => {
        const g = new THREE.SphereGeometry(r, 16, 12).toNonIndexed();
        g.translate(tx, ty, tz);
        return g;
      };
      const parts = [
        addS(8.0,  0,  0.0, 0),   // body
        addS(6.0,  0, 10.0, 0),   // head
        addS(2.0, -4, 14.0, 2),   // ear L
        addS(2.0,  4, 14.0, 2),   // ear R
        addS(3.0, -6,  2.0, 0),   // arm L
        addS(3.0,  6,  2.0, 0),   // arm R
        addS(4.0, -4, -8.0, 0),   // leg L
        addS(4.0,  4, -8.0, 0),   // leg R
      ];
      const merged = mergeGeometries(parts, false);
      parts.forEach(p => p.dispose());
      if (merged) { merged.computeVertexNormals(); return merged; }
      return new THREE.SphereGeometry(7, 32, 32);
    }

    default: return new THREE.IcosahedronGeometry(6, 1);
  }
}
