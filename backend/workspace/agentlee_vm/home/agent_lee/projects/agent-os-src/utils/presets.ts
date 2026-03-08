/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UTIL.PRESETS
REGION: 🔵 UTIL
============================================================================ */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const geometryCache = new Map<string, THREE.BufferGeometry>();

function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIndexed = g.toNonIndexed();
  Object.keys(nonIndexed.attributes).forEach(attr => {
    if (attr !== 'position' && attr !== 'normal') nonIndexed.deleteAttribute(attr);
  });
  return nonIndexed;
}

function add(parts: THREE.BufferGeometry[], g: THREE.BufferGeometry, m: THREE.Matrix4) {
  const c = normalize(g);
  c.applyMatrix4(m);
  parts.push(c);
}

function merged(parts: THREE.BufferGeometry[]) {
  const out = mergeGeometries(parts, false);
  if (!out) throw new Error("mergeGeometries failed");
  out.computeBoundingBox();
  if (out.boundingBox) {
    const center = new THREE.Vector3();
    out.boundingBox.getCenter(center);
    out.translate(-center.x, -center.y, -center.z);
  }
  out.computeVertexNormals();
  parts.forEach(p => p.dispose());
  return out;
}

export function buildPresetGeometry(id: string): THREE.BufferGeometry {
  if (geometryCache.has(id)) return geometryCache.get(id)!;

  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();

  switch (id) {
    case "TREE":
      add(parts, new THREE.CylinderGeometry(2, 3, 10, 8), m.makeTranslation(0, -5, 0));
      add(parts, new THREE.ConeGeometry(8, 12, 8), m.makeTranslation(0, 4, 0));
      add(parts, new THREE.ConeGeometry(6, 10, 8), m.makeTranslation(0, 10, 0));
      break;

    case "TEDDY_BEAR":
      add(parts, new THREE.SphereGeometry(8, 16, 12), m.makeTranslation(0, 0, 0));    // body
      add(parts, new THREE.SphereGeometry(6, 16, 12), m.makeTranslation(0, 10, 0));   // head
      add(parts, new THREE.SphereGeometry(2, 8, 8),   m.makeTranslation(-4, 14, 2));  // ear L
      add(parts, new THREE.SphereGeometry(2, 8, 8),   m.makeTranslation(4, 14, 2));   // ear R
      add(parts, new THREE.SphereGeometry(3, 8, 8),   m.makeTranslation(-6, 2, 0));   // arm L
      add(parts, new THREE.SphereGeometry(3, 8, 8),   m.makeTranslation(6, 2, 0));    // arm R
      add(parts, new THREE.SphereGeometry(4, 8, 8),   m.makeTranslation(-4, -8, 0));  // leg L
      add(parts, new THREE.SphereGeometry(4, 8, 8),   m.makeTranslation(4, -8, 0));   // leg R
      break;

    case "STAR":
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        add(parts, new THREE.ConeGeometry(4, 12, 4),
          new THREE.Matrix4().makeRotationZ(angle).multiply(new THREE.Matrix4().makeTranslation(0, 6, 0)));
      }
      break;

    case "SPORTS_CAR":
      add(parts, new THREE.BoxGeometry(20, 4, 10), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.BoxGeometry(10, 5, 8),  m.makeTranslation(-2, 4, 0));
      add(parts, new THREE.CylinderGeometry(2, 2, 2, 12), new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(-7, -2, 5)));
      add(parts, new THREE.CylinderGeometry(2, 2, 2, 12), new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(7, -2, 5)));
      add(parts, new THREE.CylinderGeometry(2, 2, 2, 12), new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(-7, -2, -5)));
      add(parts, new THREE.CylinderGeometry(2, 2, 2, 12), new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(7, -2, -5)));
      break;

    case "PICKUP_TRUCK":
      add(parts, new THREE.BoxGeometry(20, 5, 10), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.BoxGeometry(8, 6, 9),   m.makeTranslation(-4, 5, 0));
      add(parts, new THREE.BoxGeometry(10, 4, 9),  m.makeTranslation(5, 4.5, 0));
      break;

    case "HOUSE":
      add(parts, new THREE.BoxGeometry(12, 12, 12), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.ConeGeometry(10, 8, 4), new THREE.Matrix4().makeRotationY(Math.PI/4).multiply(new THREE.Matrix4().makeTranslation(0, 10, 0)));
      add(parts, new THREE.BoxGeometry(2, 6, 1),   m.makeTranslation(0, -3, 6));
      break;

    case "ROCKET":
      add(parts, new THREE.CylinderGeometry(3, 5, 15, 16), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.ConeGeometry(5, 6, 16),          m.makeTranslation(0, 10.5, 0));
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        add(parts, new THREE.BoxGeometry(5, 4, 1),
          new THREE.Matrix4().makeRotationY(angle).multiply(new THREE.Matrix4().makeTranslation(4, -6, 0)));
      }
      break;

    case "AIRPLANE":
      add(parts, new THREE.CylinderGeometry(2, 2, 20, 12), new THREE.Matrix4().makeRotationX(Math.PI/2));
      add(parts, new THREE.BoxGeometry(25, 1, 6),  m.makeTranslation(0, 0, -2));
      add(parts, new THREE.BoxGeometry(8, 1, 3),   m.makeTranslation(0, 0, 8));
      add(parts, new THREE.BoxGeometry(1, 4, 3),   m.makeTranslation(0, 2, 8));
      break;

    case "ROBOT_HEAD":
      add(parts, new THREE.BoxGeometry(10, 10, 10), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.SphereGeometry(1.5, 8, 8), m.makeTranslation(-2.5, 2, 5));
      add(parts, new THREE.SphereGeometry(1.5, 8, 8), m.makeTranslation(2.5, 2, 5));
      add(parts, new THREE.CylinderGeometry(1, 1, 4, 8), m.makeTranslation(-6, 0, 0));
      add(parts, new THREE.CylinderGeometry(1, 1, 4, 8), m.makeTranslation(6, 0, 0));
      break;

    case "GUITAR":
      add(parts, new THREE.BoxGeometry(8, 12, 3),     m.makeTranslation(0, -8, 0));
      add(parts, new THREE.CylinderGeometry(1, 1, 20, 8), m.makeTranslation(0, 8, 0));
      add(parts, new THREE.BoxGeometry(3, 4, 1),      m.makeTranslation(0, 18, 0));
      break;

    case "DINOSAUR":
      add(parts, new THREE.BoxGeometry(6, 8, 15), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.CylinderGeometry(1.5, 2, 10, 8), new THREE.Matrix4().makeRotationX(-0.5).multiply(new THREE.Matrix4().makeTranslation(0, 4, 8)));
      add(parts, new THREE.BoxGeometry(4, 3, 5), m.makeTranslation(0, 8, 11));
      add(parts, new THREE.CylinderGeometry(1, 2, 12, 8), new THREE.Matrix4().makeRotationX(0.5).multiply(new THREE.Matrix4().makeTranslation(0, -4, -8)));
      break;

    case "GALAXY":
      add(parts, new THREE.TorusGeometry(12, 0.5, 8, 100), new THREE.Matrix4().makeRotationX(Math.PI/2));
      add(parts, new THREE.TorusGeometry(8, 0.3, 8, 100),  new THREE.Matrix4().makeRotationX(Math.PI/2.2));
      add(parts, new THREE.SphereGeometry(3, 16, 16), m.makeTranslation(0, 0, 0));
      break;

    case "DIAMOND":
      add(parts, new THREE.OctahedronGeometry(12, 0), m.makeTranslation(0, 0, 0));
      break;

    case "LION":
      add(parts, new THREE.SphereGeometry(7, 16, 16),  m.makeTranslation(0, 2, 0));
      add(parts, new THREE.TorusGeometry(8, 3, 12, 32), m.makeTranslation(0, 2, -1));
      add(parts, new THREE.BoxGeometry(8, 6, 14),       m.makeTranslation(0, -6, -4));
      break;

    case "CROWN":
      add(parts, new THREE.TorusGeometry(8, 1.5, 12, 32), new THREE.Matrix4().makeRotationX(Math.PI/2));
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        add(parts, new THREE.ConeGeometry(1.5, 6, 4),
          new THREE.Matrix4().makeTranslation(Math.cos(angle) * 8, 4, Math.sin(angle) * 8));
      }
      break;

    case "DRAGON":
      for (let i = 0; i < 10; i++) {
        const t = i / 10;
        add(parts, new THREE.SphereGeometry(5 - t * 3, 12, 12),
          new THREE.Matrix4().makeTranslation(Math.sin(t * 4) * 8, t * 40 - 20, Math.cos(t * 4) * 8));
      }
      add(parts, new THREE.BoxGeometry(20, 2, 15), new THREE.Matrix4().makeRotationZ(0.5).multiply(new THREE.Matrix4().makeTranslation(-12, 0, 0)));
      add(parts, new THREE.BoxGeometry(20, 2, 15), new THREE.Matrix4().makeRotationZ(-0.5).multiply(new THREE.Matrix4().makeTranslation(12, 0, 0)));
      break;

    case "CASTLE": {
      add(parts, new THREE.BoxGeometry(20, 10, 20), m.makeTranslation(0, 0, 0));
      const turretGeo = new THREE.CylinderGeometry(3, 3, 18, 8);
      add(parts, turretGeo, m.makeTranslation(-10, 4, -10));
      add(parts, turretGeo, m.makeTranslation(10, 4, -10));
      add(parts, turretGeo, m.makeTranslation(-10, 4, 10));
      add(parts, turretGeo, m.makeTranslation(10, 4, 10));
      add(parts, new THREE.ConeGeometry(4, 8, 8), m.makeTranslation(-10, 15, -10));
      add(parts, new THREE.ConeGeometry(4, 8, 8), m.makeTranslation(10, 15, -10));
      break;
    }

    case "SPACESHIP":
      add(parts, new THREE.TorusGeometry(10, 2, 8, 100), new THREE.Matrix4().makeRotationX(Math.PI/2));
      add(parts, new THREE.SphereGeometry(6, 16, 16),    m.makeTranslation(0, 1, 0));
      add(parts, new THREE.CylinderGeometry(4, 6, 4, 16), m.makeTranslation(0, -3, 0));
      break;

    case "PHOENIX":
      add(parts, new THREE.SphereGeometry(5, 12, 12), m.makeTranslation(0, 0, 0));
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        add(parts, new THREE.BoxGeometry(15, 1, 4),
          new THREE.Matrix4().makeRotationY(ang)
            .multiply(new THREE.Matrix4().makeRotationZ(0.8))
            .multiply(new THREE.Matrix4().makeTranslation(10, 0, 0)));
      }
      break;

    case "HELMET":
      add(parts, new THREE.SphereGeometry(10, 16, 16), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.BoxGeometry(12, 6, 8),      m.makeTranslation(0, 0, 6));
      add(parts, new THREE.CylinderGeometry(11, 11, 2, 32), new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(0, -2, 0)));
      break;

    case "CORVETTE":
      add(parts, new THREE.BoxGeometry(22, 3, 10), m.makeTranslation(0, 0, 0));
      add(parts, new THREE.BoxGeometry(10, 4, 8),  m.makeTranslation(-2, 3, 0));
      add(parts, new THREE.BoxGeometry(8, 2, 9),   m.makeTranslation(7, 1, 0));
      add(parts, new THREE.BoxGeometry(3, 2, 10),  m.makeTranslation(-10, 2, 0));
      break;

    case "SEMI_TRUCK":
      add(parts, new THREE.BoxGeometry(10, 10, 8), m.makeTranslation(-10, 0, 0));
      add(parts, new THREE.BoxGeometry(25, 12, 8), m.makeTranslation(8, 1, 0));
      add(parts, new THREE.CylinderGeometry(0.5, 0.5, 15, 8), m.makeTranslation(-6, 5, 4));
      add(parts, new THREE.CylinderGeometry(0.5, 0.5, 15, 8), m.makeTranslation(-6, 5, -4));
      break;

    case "BOXING_GLOVES":
      add(parts, new THREE.SphereGeometry(6, 16, 16), m.makeTranslation(-8, 0, 0));
      add(parts, new THREE.BoxGeometry(4, 8, 6),      m.makeTranslation(-8, -6, 0));
      add(parts, new THREE.SphereGeometry(6, 16, 16), m.makeTranslation(8, 0, 0));
      add(parts, new THREE.BoxGeometry(4, 8, 6),      m.makeTranslation(8, -6, 0));
      break;

    case "AIR_JORDANS":
      add(parts, new THREE.BoxGeometry(14, 4, 6), m.makeTranslation(0, -6, 0));
      add(parts, new THREE.BoxGeometry(12, 8, 6), m.makeTranslation(-1, 0, 0));
      add(parts, new THREE.BoxGeometry(6, 10, 5), m.makeTranslation(-4, 4, 0));
      break;

    default:
      add(parts, new THREE.IcosahedronGeometry(10, 1), m.makeTranslation(0, 0, 0));
  }

  const finalGeom = merged(parts);
  geometryCache.set(id, finalGeom);
  return finalGeom;
}
