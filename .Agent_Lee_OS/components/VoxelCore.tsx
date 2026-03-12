/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: UI.ENGINE._AGENT_LEE_OS_COMPONENTS_VOXELCORE_TSX.MAIN_UI.BANNER
REGION: 🔵 UI
============================================================================ */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CoreConfig, CoreShape } from "../types";

interface VoxelCoreProps {
  active: boolean;
  config: CoreConfig;
  audioIntensity: number;
  interactive?: boolean;
  isSpeaking?: boolean; // true while Agent Lee's voice is playing
}

// --- DISTINCT SHAPE ALGORITHMS ---
const getTargetPosition = (
  i: number,
  count: number,
  shape: CoreShape,
): { x: number; y: number; z: number } => {
  const p = { x: 0, y: 0, z: 0 };
  const rand = () => (Math.random() - 0.5) * 2; // -1 to 1

  if (shape === "sphere") {
    const r = 5.0 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    p.x = r * Math.sin(phi) * Math.cos(theta);
    p.y = r * Math.sin(phi) * Math.sin(theta);
    p.z = r * Math.cos(phi);
  } else if (shape === "cube") {
    // Particles on the 6 faces of a cube
    const size = 5.0;
    const half = size / 2;
    const face = Math.floor(Math.random() * 6);
    const u = rand() * half;
    const v = rand() * half;
    if (face === 0) {
      p.x = half;
      p.y = u;
      p.z = v;
    } else if (face === 1) {
      p.x = -half;
      p.y = u;
      p.z = v;
    } else if (face === 2) {
      p.y = half;
      p.x = u;
      p.z = v;
    } else if (face === 3) {
      p.y = -half;
      p.x = u;
      p.z = v;
    } else if (face === 4) {
      p.z = half;
      p.x = u;
      p.y = v;
    } else {
      p.z = -half;
      p.x = u;
      p.y = v;
    }
  } else if (shape === "torus") {
    // Donut surface: major radius R, minor radius r
    const R = 4.0,
      r = 1.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 2;
    p.x = (R + r * Math.cos(phi)) * Math.cos(theta);
    p.z = (R + r * Math.cos(phi)) * Math.sin(theta);
    p.y = r * Math.sin(phi);
  } else if (shape === "house") {
    const isRoof = Math.random() > 0.6;
    if (isRoof) {
      const h = 3.5;
      const y = Math.random() * h;
      const scale = (h - y) / h;
      const w = scale * 4.5;
      p.x = rand() * w;
      p.z = rand() * w;
      p.y = y + 1.5;
    } else {
      p.x = rand() * 4.5;
      p.z = rand() * 4.5;
      p.y = Math.random() * 5 - 3.5;
    }
  } else if (shape === "tree") {
    const isTrunk = Math.random() > 0.75;
    if (isTrunk) {
      const r = 1.0;
      const theta = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * r;
      p.x = rad * Math.cos(theta);
      p.z = rad * Math.sin(theta);
      p.y = Math.random() * 4 - 5;
    } else {
      const layer = Math.floor(Math.random() * 3);
      let yBase = -1;
      let h = 4;
      let wBase = 4;

      if (layer === 1) {
        yBase = 1;
        h = 3.5;
        wBase = 3;
      }
      if (layer === 2) {
        yBase = 3;
        h = 2.5;
        wBase = 2;
      }

      const yRel = Math.random() * h;
      const scale = (h - yRel) / h;
      const r = scale * wBase;
      const theta = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * r;

      p.x = rad * Math.cos(theta);
      p.z = rand() * Math.sin(theta);
      p.y = yBase + yRel;
    }
  } else if (shape === "helix") {
    // Single helix spiraling upward
    const t = (i / count) * Math.PI * 10;
    const r = 3.5;
    const h = 12;
    const y = (i / count) * h - h / 2;
    p.x = r * Math.cos(t);
    p.z = r * Math.sin(t);
    p.y = y + rand() * 0.3;
  } else if (shape === "heart") {
    let found = false;
    while (!found) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI;
      const sc = 0.25;
      const xH = 16 * Math.pow(Math.sin(v), 3) * Math.cos(u);
      const zH = 16 * Math.pow(Math.sin(v), 3) * Math.sin(u);
      const yH =
        13 * Math.cos(v) -
        5 * Math.cos(2 * v) -
        2 * Math.cos(3 * v) -
        Math.cos(4 * v);
      p.x = xH * sc;
      p.y = yH * sc;
      p.z = zH * sc * Math.sin(v);
      found = true;
    }
  } else if (shape === "star") {
    const rInner = 2.0;
    const rOuter = 6.0;
    const isCore = Math.random() > 0.7;
    if (isCore) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * rInner;
      p.x = r * Math.sin(phi) * Math.cos(theta);
      p.y = r * Math.sin(phi) * Math.sin(theta);
      p.z = r * Math.cos(phi);
    } else {
      const axis = Math.floor(Math.random() * 6);
      const dist = Math.random() * (rOuter - rInner) + rInner;
      const taper = 1 - (dist - rInner) / (rOuter - rInner);
      const spread = 1.0 * taper;
      if (axis === 0) {
        p.x = dist;
        p.y = rand() * spread;
        p.z = rand() * spread;
      } else if (axis === 1) {
        p.x = -dist;
        p.y = rand() * spread;
        p.z = rand() * spread;
      } else if (axis === 2) {
        p.y = dist;
        p.x = rand() * spread;
        p.z = rand() * spread;
      } else if (axis === 3) {
        p.y = -dist;
        p.x = rand() * spread;
        p.z = rand() * spread;
      } else if (axis === 4) {
        p.z = dist;
        p.x = rand() * spread;
        p.y = rand() * spread;
      } else {
        p.z = -dist;
        p.x = rand() * spread;
        p.y = rand() * spread;
      }
    }
  } else if (shape === "teddy_bear") {
    // Probabilistic distribution across 8 body parts
    const rInSphere = (r: number, cx: number, cy: number, cz: number) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random()) * r;
      p.x = cx + rad * Math.sin(phi) * Math.cos(theta);
      p.y = cy + rad * Math.sin(phi) * Math.sin(theta);
      p.z = cz + rad * Math.cos(phi);
    };
    const part = Math.random();
    if (part < 0.3)
      rInSphere(4.0, 0, 0.0, 0); // body
    else if (part < 0.55)
      rInSphere(3.0, 0, 5.0, 0); // head
    else if (part < 0.63)
      rInSphere(1.0, -2, 7.0, 0); // ear L
    else if (part < 0.71)
      rInSphere(1.0, 2, 7.0, 0); // ear R
    else if (part < 0.8)
      rInSphere(1.5, -3, 1.0, 0); // arm L
    else if (part < 0.89)
      rInSphere(1.5, 3, 1.0, 0); // arm R
    else if (part < 0.94)
      rInSphere(2.0, -2, -4.0, 0); // leg L
    else rInSphere(2.0, 2, -4.0, 0); // leg R
  } else if (shape === "giraffe") {
    // Body (ellipsoid) + long neck (cylinder) + head (sphere) + 4 legs
    const rInSphere = (
      rx: number,
      ry: number,
      rz: number,
      cx: number,
      cy: number,
      cz: number,
    ) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random());
      p.x = cx + rad * rx * Math.sin(phi) * Math.cos(theta);
      p.y = cy + rad * ry * Math.sin(phi) * Math.sin(theta);
      p.z = cz + rad * rz * Math.cos(phi);
    };
    const part = Math.random();
    if (part < 0.28)
      rInSphere(3.0, 2.0, 2.0, 0, -0.5, 0); // body
    else if (part < 0.55) {
      // neck
      const t = Math.random();
      const theta = Math.random() * Math.PI * 2;
      p.x = Math.cos(theta) * 0.7 * (1 - t * 0.3);
      p.y = t * 6.0 + 0.5;
      p.z = Math.sin(theta) * 0.7 * (1 - t * 0.3);
    } else if (part < 0.68)
      rInSphere(1.3, 1.0, 0.9, 0.5, 6.8, 0); // head
    else if (part < 0.76) {
      // leg FL
      const theta = Math.random() * Math.PI * 2;
      p.x = -1.5 + Math.cos(theta) * 0.4;
      p.y = -1.5 - Math.random() * 3.5;
      p.z = 1.2 + Math.sin(theta) * 0.4;
    } else if (part < 0.84) {
      // leg FR
      const theta = Math.random() * Math.PI * 2;
      p.x = 1.5 + Math.cos(theta) * 0.4;
      p.y = -1.5 - Math.random() * 3.5;
      p.z = 1.2 + Math.sin(theta) * 0.4;
    } else if (part < 0.92) {
      // leg RL
      const theta = Math.random() * Math.PI * 2;
      p.x = -1.5 + Math.cos(theta) * 0.4;
      p.y = -1.5 - Math.random() * 3.5;
      p.z = -1.2 + Math.sin(theta) * 0.4;
    } else {
      // leg RR
      const theta = Math.random() * Math.PI * 2;
      p.x = 1.5 + Math.cos(theta) * 0.4;
      p.y = -1.5 - Math.random() * 3.5;
      p.z = -1.2 + Math.sin(theta) * 0.4;
    }
  } else if (shape === "spaceship") {
    // Fuselage (elongated cone) + swept delta wings + cockpit bulge
    const part = Math.random();
    if (part < 0.48) {
      // Main fuselage — tapered cylinder
      const t = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const fuseR = 1.4 * (1 - t * 0.6);
      const r = Math.sqrt(Math.random()) * fuseR;
      p.x = r * Math.cos(theta);
      p.y = t * 8 - 4;
      p.z = r * Math.sin(theta);
    } else if (part < 0.78) {
      // Delta wings — angled out from mid-fuselage
      const side = Math.random() > 0.5 ? 1 : -1;
      const t = Math.random(); // 0=root, 1=tip
      const sweep = t * 4.5;
      p.x = side * (1.0 + sweep);
      p.y = -1.5 - t * 2.0;
      p.z = rand() * (1.2 * (1 - t));
    } else {
      // Cockpit dome — front sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * 1.2;
      p.x = r * Math.sin(phi) * Math.cos(theta);
      p.y = 3.8 + r * 0.7;
      p.z = r * Math.sin(phi) * Math.sin(theta);
    }
  } else if (shape === "corvette") {
    // Low-slung sports car — wide flat body + windshield + wheels
    const part = Math.random();
    if (part < 0.55) {
      // Wide flat body (ellipsoid)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random());
      p.x = 4.5 * rad * Math.sin(phi) * Math.cos(theta);
      p.y = 0.9 * rad * Math.sin(phi) * Math.sin(theta) - 0.3;
      p.z = 2.0 * rad * Math.cos(phi);
    } else if (part < 0.75) {
      // Curved roof / windshield
      const t = Math.random();
      const angle = Math.random() * Math.PI;
      p.x = rand() * (3.5 - t * 1.5);
      p.y = 0.8 + Math.sin(angle) * 1.5 * t;
      p.z = Math.cos(angle) * 1.8 * (1 - t * 0.5);
    } else {
      // 4 wheels
      const wheel = Math.floor(Math.random() * 4);
      const wx = wheel < 2 ? -3.2 : 3.2;
      const wz = wheel % 2 === 0 ? 2.2 : -2.2;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.0;
      p.x = wx + rand() * 0.4;
      p.y = -1.2 + r * Math.sin(theta);
      p.z = wz + r * Math.cos(theta) * 0.35;
    }
  } else if (shape === "shield") {
    // Heraldic shield — wide flat top, sides, pointed bottom
    let found = false;
    while (!found) {
      const x = rand() * 5.0;
      const y = Math.random() * 9 - 3.5; // -3.5 to 5.5
      // Upper section (y>0): full width 4.5; lower section tapers to point
      const halfW = y >= 0 ? 4.5 : 4.5 * Math.max(0, (y + 3.5) / 3.5);
      if (Math.abs(x) <= halfW) {
        p.x = x;
        p.y = y;
        p.z = rand() * 0.6;
        found = true;
      }
    }
  } else if (shape === "crown") {
    // Crown — circular band with 5 upward spikes
    const part = Math.random();
    if (part < 0.45) {
      // Circular band (torus section)
      const R = 4.0,
        r = 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = rand() * Math.PI * 0.5; // partial torus = band not full donut
      p.x = (R + r * Math.cos(phi)) * Math.cos(theta);
      p.z = (R + r * Math.cos(phi)) * Math.sin(theta);
      p.y = r * Math.sin(phi) - 1.5;
    } else {
      // 5 spikes pointing up
      const numSpikes = 5;
      const spike = Math.floor(Math.random() * numSpikes);
      const angle = (spike / numSpikes) * Math.PI * 2;
      const t = Math.random(); // 0=base, 1=tip
      const R = 4.0;
      const baseSpread = 0.8 * (1 - t);
      const spikeAngle = angle + rand() * 0.2;
      p.x = Math.cos(spikeAngle) * (R - baseSpread * 0.2);
      p.z = Math.sin(spikeAngle) * (R - baseSpread * 0.2);
      p.y = -0.5 + t * 5.0;
    }
  } else if (shape === "butterfly") {
    // Symmetric wings — upper large wing + lower smaller wing, mirrored on X
    const side = Math.random() > 0.5 ? 1 : -1;
    const isUpper = Math.random() > 0.38;
    if (isUpper) {
      // Upper wing — large teardrop ellipse
      const angle = Math.random() * Math.PI;
      const r = 4.5 * Math.sin(angle);
      p.x = side * (0.4 + r * Math.abs(Math.cos(angle)) * 0.7);
      p.y = r * Math.sin(angle) * 0.55 + 1.2;
      p.z = rand() * 0.5;
    } else {
      // Lower wing — smaller swept shape
      const angle = Math.random() * Math.PI;
      const r = 2.8 * Math.sin(angle);
      p.x = side * (0.4 + r * Math.abs(Math.cos(angle * 0.6)) * 0.8);
      p.y = -(r * Math.sin(angle) * 0.5 + 0.8);
      p.z = rand() * 0.5;
    }
  } else if (shape === "lightning") {
    // Zigzag lightning bolt — 5 angled segments
    const segs = [
      { x1: 0.5, y1: 6.5, x2: -2.0, y2: 2.5 },
      { x1: -2.0, y1: 2.5, x2: 1.5, y2: 0.5 },
      { x1: 1.5, y1: 0.5, x2: -2.5, y2: -2.5 },
      { x1: -2.5, y1: -2.5, x2: 1.0, y2: -4.5 },
      { x1: 1.0, y1: -4.5, x2: -1.0, y2: -6.5 },
    ];
    const seg = segs[Math.floor(Math.random() * segs.length)];
    const t = Math.random();
    const thick = 0.45;
    p.x = seg.x1 + (seg.x2 - seg.x1) * t + rand() * thick;
    p.y = seg.y1 + (seg.y2 - seg.y1) * t;
    p.z = rand() * thick;
  } else if (shape === "lotus") {
    // 8-petal lotus flower — petals curve upward from center
    const numPetals = 8;
    const petal = Math.floor(Math.random() * numPetals);
    const angle = (petal / numPetals) * Math.PI * 2;
    const t = Math.random(); // 0=center, 1=tip
    const petalWidth = Math.sin(t * Math.PI) * 1.4;
    const r = 0.8 + t * 3.8;
    const petalOffset = rand() * petalWidth;
    // Petals curve upward along their length
    const lift = Math.sin(t * Math.PI * 0.85) * 2.0 - 0.5;
    p.x = Math.cos(angle) * r + Math.sin(angle) * petalOffset;
    p.z = Math.sin(angle) * r - Math.cos(angle) * petalOffset;
    p.y = lift;
  } else if (shape === "icosahedron") {
    // Particles clustered at the 12 vertices of an icosahedron
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts = [
      [0, 1, phi],
      [0, -1, phi],
      [0, 1, -phi],
      [0, -1, -phi],
      [1, phi, 0],
      [-1, phi, 0],
      [1, -phi, 0],
      [-1, -phi, 0],
      [phi, 0, 1],
      [-phi, 0, 1],
      [phi, 0, -1],
      [-phi, 0, -1],
    ];
    const v = verts[Math.floor(Math.random() * verts.length)];
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    const r = 4.5 + rand() * 1.2;
    p.x = (v[0] / len) * r;
    p.y = (v[1] / len) * r;
    p.z = (v[2] / len) * r;
  } else if (shape === "humanoid") {
    // Head + torso + arms + legs — pillar-like humanoid form
    const rInSphere = (r: number, cx: number, cy: number, cz: number) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random()) * r;
      p.x = cx + rad * Math.sin(phi) * Math.cos(theta);
      p.y = cy + rad * Math.sin(phi) * Math.sin(theta);
      p.z = cz + rad * Math.cos(phi);
    };
    const rInCyl = (
      radius: number,
      halfH: number,
      cx: number,
      cy: number,
      cz: number,
    ) => {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      p.x = cx + r * Math.cos(theta);
      p.y = cy + rand() * halfH;
      p.z = cz + r * Math.sin(theta);
    };
    const part = Math.random();
    if (part < 0.12)
      rInSphere(1.3, 0, 7.2, 0); // head
    else if (part < 0.38)
      rInSphere(1.9, 0, 4.0, 0); // torso
    else if (part < 0.52)
      rInCyl(0.65, 2.2, -2.8, 4.0, 0); // arm L
    else if (part < 0.66)
      rInCyl(0.65, 2.2, 2.8, 4.0, 0); // arm R
    else if (part < 0.83)
      rInCyl(0.85, 3.0, -1.0, 0.5, 0); // leg L
    else rInCyl(0.85, 3.0, 1.0, 0.5, 0); // leg R
  } else if (shape === "ankh") {
    // Egyptian/African symbol of life — loop (torus) + crossbar + stem
    const part = Math.random();
    if (part < 0.38) {
      // Loop: torus above crossbar, R=2, r=0.7, centered at y=4
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 2;
      const R = 2.0,
        r = 0.7;
      p.x = (R + r * Math.cos(phi)) * Math.cos(theta);
      p.z = (R + r * Math.cos(phi)) * Math.sin(theta) * 0.35;
      p.y = r * Math.sin(phi) + 4.0;
    } else if (part < 0.58) {
      // Crossbar: horizontal bar from -3 to +3 at y=1.2
      p.x = (Math.random() * 2 - 1) * 3.2;
      p.y = 1.2 + rand() * 0.55;
      p.z = rand() * 0.4;
    } else {
      // Stem: vertical bar from y=-4 to y=1.2
      p.x = rand() * 0.7;
      p.y = Math.random() * 5.2 - 4.0;
      p.z = rand() * 0.4;
    }
  } else if (shape === "merkaba") {
    // Star tetrahedron (sacred geometry) — two interlocking tetrahedra
    const isUp = Math.random() > 0.5;
    const t = Math.random(),
      a = Math.random() * Math.PI * 2;
    const r = 5.0 * Math.cbrt(t);
    // Tetrahedron surface: 4 triangular faces sampled via barycentric
    const faceIdx = Math.floor(Math.random() * 4);
    const h = 5.5;
    const verts = isUp
      ? [
          // Point-up tetrahedron
          [
            [0, h, 0],
            [h * 0.82, -h * 0.33, h * 0.82],
            [-h * 0.82 * 2, -h * 0.33, 0],
            [0, -h * 0.33, -h * 0.82 * 1.4],
          ],
        ]
      : [
          // Point-down tetrahedron (rotated 180° on X)
          [
            [0, -h, 0],
            [h * 0.82, h * 0.33, h * 0.82],
            [-h * 0.82 * 2, h * 0.33, 0],
            [0, h * 0.33, -h * 0.82 * 1.4],
          ],
        ];
    const faces = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2, 3],
    ];
    const face = faces[faceIdx % 4];
    const vs = verts[0];
    let u = Math.random(),
      v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    p.x = u * vs[face[0]][0] + v * vs[face[1]][0] + w * vs[face[2]][0];
    p.y = u * vs[face[0]][1] + v * vs[face[1]][1] + w * vs[face[2]][1];
    p.z = u * vs[face[0]][2] + v * vs[face[1]][2] + w * vs[face[2]][2];
    p.x *= 0.5;
    p.y *= 0.5;
    p.z *= 0.5;
  } else if (shape === "thirdEye") {
    // Eye almond shape with central iris — spiritual vision symbol
    const t = Math.random() * Math.PI; // 0..pi covers full arc
    const eyeHalfW = 5.5;
    const eyeHalfH = 2.2;
    const isIris = Math.random() > 0.65;
    if (isIris) {
      // Iris/pupil: filled circle
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.6;
      p.x = r * Math.cos(theta);
      p.y = r * Math.sin(theta) * 0.7;
      p.z = rand() * 0.5;
    } else {
      // Eye outline: almond curve — two arcs meeting at tips
      const arc = Math.random() > 0.5 ? 1 : -1;
      const angle = Math.random() * Math.PI;
      p.x = eyeHalfW * Math.cos(angle) * arc;
      p.y = eyeHalfH * Math.sin(angle) * arc;
      p.z = rand() * 0.3;
      // flatten to almond — narrow the Y at extremes
      p.y *= Math.sin(angle);
    }
  } else if (shape === "infinity") {
    // Lemniscate (figure-8) path in 3D
    const t = Math.random() * Math.PI * 2;
    const scale = 4.5;
    const a = 1.0,
      b = 2.0;
    p.x = (scale * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
    p.y = (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
    p.z = rand() * 0.6;
    // Add tube thickness
    const nx = -Math.sin(t),
      ny = Math.cos(t);
    const thick = Math.random() * 0.8;
    p.x += nx * thick;
    p.y += ny * thick;
  } else if (shape === "crescent") {
    // Crescent moon — arc of outer circle minus inner offset circle
    let found = false;
    while (!found) {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 5.0;
      const cx = r * Math.cos(theta);
      const cy = r * Math.sin(theta);
      // Outside main circle of radius 5
      const inOuter = r <= 5.0;
      // Inside occluding circle (offset right, radius 3.8)
      const dx = cx - 2.2,
        dy = cy;
      const inInner = Math.sqrt(dx * dx + dy * dy) <= 3.8;
      if (inOuter && !inInner) {
        p.x = cx;
        p.y = cy;
        p.z = rand() * 0.6;
        found = true;
      }
    }
  } else if (shape === "sunburst") {
    // Radiating tribal sun — center disk + 10 tapered rays
    const isRay = Math.random() > 0.3;
    if (isRay) {
      const numRays = 10;
      const ray = Math.floor(Math.random() * numRays);
      const angle = (ray / numRays) * Math.PI * 2;
      const t = Math.random(); // 0=center, 1=tip
      const rayLen = 5.0;
      const halfW = (1 - t) * 0.9;
      const dist = 2.2 + t * rayLen;
      const perp = rand() * halfW;
      p.x = Math.cos(angle) * dist + Math.sin(angle) * perp;
      p.z = Math.sin(angle) * dist - Math.cos(angle) * perp;
      p.y = rand() * 0.5;
    } else {
      // Center disk
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 2.2;
      p.x = r * Math.cos(theta);
      p.z = r * Math.sin(theta);
      p.y = rand() * 0.5;
    }
  } else if (shape === "pyramid") {
    // 4-sided ancient Egyptian pyramid — square base + 4 triangular faces
    const isBase = Math.random() > 0.7;
    if (isBase) {
      // Square base
      p.x = rand() * 5.0;
      p.z = rand() * 5.0;
      p.y = -3.5;
    } else {
      // 4 triangular faces
      const face = Math.floor(Math.random() * 4);
      const t = Math.random();
      const u = Math.random() * (1 - t);
      const base = 5.0,
        halfH = 5.0;
      // Face normals: N, S, E, W
      if (face === 0) {
        // North face
        p.x = (t * 2 - t) * base + (u * 2 - u) * base;
        p.z = -base * (1 - t);
        p.y = t * halfH - 3.5;
        p.x = (Math.random() * 2 - 1) * base * (1 - t);
      } else if (face === 1) {
        // South face
        p.x = (Math.random() * 2 - 1) * base * (1 - t);
        p.z = base * (1 - t);
        p.y = t * halfH - 3.5;
      } else if (face === 2) {
        // East face
        p.z = (Math.random() * 2 - 1) * base * (1 - t);
        p.x = base * (1 - t);
        p.y = t * halfH - 3.5;
      } else {
        // West face
        p.z = (Math.random() * 2 - 1) * base * (1 - t);
        p.x = -base * (1 - t);
        p.y = t * halfH - 3.5;
      }
    }
  } else {
    // Fallback — sphere
    const r = 5.0 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    p.x = r * Math.sin(phi) * Math.cos(theta);
    p.y = r * Math.sin(phi) * Math.sin(theta);
    p.z = r * Math.cos(phi);
  }
  return p;
};

// Convert to non-indexed only if geometry still has an index buffer.
// THREE r175+ ships non-indexed primitives, so the call is a no-op + console warning.
const ensureNonIndexed = (geo: THREE.BufferGeometry): THREE.BufferGeometry =>
  geo.index !== null ? geo.toNonIndexed() : geo;

// --- CORE GEOMETRY per shape ---
// Each geometry is built from the SAME math/dimensions as the particle formations
// so the solid core matches EXACTLY the shape the particle cloud is forming.
const buildCoreGeometry = (shape: CoreShape): THREE.BufferGeometry => {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(2.2, 32, 32);

    case "heart": {
      // Exact heart parametric: same formula as getTargetPosition('heart'), sc=0.25
      // x = 16sin³(t)·sc, y = (13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))·sc
      const sc = 0.27;
      const heartPath = new THREE.Shape();
      const steps = 128;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3) * sc;
        const y =
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
          sc;
        if (i === 0) heartPath.moveTo(x, y);
        else heartPath.lineTo(x, y);
      }
      heartPath.closePath();
      return new THREE.ExtrudeGeometry(heartPath, {
        depth: 1.4,
        bevelEnabled: true,
        bevelSize: 0.18,
        bevelThickness: 0.18,
        bevelSegments: 4,
      });
    }

    case "star": {
      // 6-axis star matching particle formation: 6 ray arms extending to rOuter=6, inner join at rInner=2
      const starPath = new THREE.Shape();
      const outerR = 3.2,
        innerR = 1.3,
        spikes = 6;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = r * Math.cos(angle),
          y = r * Math.sin(angle);
        if (i === 0) starPath.moveTo(x, y);
        else starPath.lineTo(x, y);
      }
      starPath.closePath();
      return new THREE.ExtrudeGeometry(starPath, {
        depth: 1.2,
        bevelEnabled: true,
        bevelSize: 0.12,
        bevelThickness: 0.12,
        bevelSegments: 2,
      });
    }

    case "house": {
      // House silhouette: rectangular base (walls) + triangular roof, matching particle dims
      const housePath = new THREE.Shape();
      housePath.moveTo(-2.5, -3.5); // bottom-left
      housePath.lineTo(2.5, -3.5); // bottom-right
      housePath.lineTo(2.5, 0.8); // wall top-right
      housePath.lineTo(0.0, 3.5); // roof peak
      housePath.lineTo(-2.5, 0.8); // wall top-left
      housePath.closePath();
      return new THREE.ExtrudeGeometry(housePath, {
        depth: 2.2,
        bevelEnabled: false,
      });
    }

    case "tree": {
      // Layered canopy cone matching the 3-layer particle tree + trunk
      // Use a single tall cone scaled to cover the full canopy range
      const treePath = new THREE.Shape();
      treePath.moveTo(0, 5.0); // apex
      treePath.lineTo(3.8, -1.0); // wide base of canopy
      treePath.lineTo(0.9, -1.0); // shoulder inward
      treePath.lineTo(0.9, -5.0); // trunk bottom-right
      treePath.lineTo(-0.9, -5.0); // trunk bottom-left
      treePath.lineTo(-0.9, -1.0); // shoulder inward
      treePath.lineTo(-3.8, -1.0); // wide base left
      treePath.closePath();
      return new THREE.ExtrudeGeometry(treePath, {
        depth: 1.8,
        bevelEnabled: false,
      });
    }

    case "cube":
      return new THREE.BoxGeometry(8, 8, 8);

    case "torus":
      return new THREE.TorusGeometry(4.0, 1.5, 16, 80);

    case "icosahedron":
      return new THREE.IcosahedronGeometry(4.5, 0);

    case "helix": {
      // Single-strand helix — TorusKnot (p=1, q=4) gives one spiral wind
      return new THREE.TorusKnotGeometry(1.8, 0.45, 128, 12, 1, 4);
    }

    case "giraffe": {
      const addS = (r: number, tx: number, ty: number, tz: number) => {
        const g = ensureNonIndexed(new THREE.SphereGeometry(r, 12, 10));
        g.translate(tx, ty, tz);
        return g;
      };
      const neckParts: THREE.BufferGeometry[] = [];
      for (let ni = 0; ni < 6; ni++)
        neckParts.push(addS(0.75, 0, ni * 1.0 + 0.5, 0));
      const gParts = [
        addS(3.0, 0, -0.5, 0), // body
        addS(1.3, 0.5, 6.8, 0), // head
        addS(0.5, -1.0, 5.2, 0), // leg FL
        addS(0.5, 1.0, 5.2, 0), // leg FR
        ...neckParts,
      ];
      const merged = mergeGeometries(gParts, false);
      gParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.SphereGeometry(3.0, 24, 24);
    }

    case "spaceship": {
      const fuselage = ensureNonIndexed(
        new THREE.CylinderGeometry(0.5, 1.4, 8.0, 12),
      );
      fuselage.translate(0, 0, 0);
      const cockpit = ensureNonIndexed(new THREE.SphereGeometry(1.0, 12, 10));
      cockpit.scale(1, 0.75, 1);
      cockpit.translate(0, 4.2, 0);
      const wingL = ensureNonIndexed(new THREE.BoxGeometry(4.5, 0.25, 2.0));
      wingL.translate(-2.7, -1.2, 0);
      const wingR = ensureNonIndexed(new THREE.BoxGeometry(4.5, 0.25, 2.0));
      wingR.translate(2.7, -1.2, 0);
      const sParts = [fuselage, cockpit, wingL, wingR];
      const merged = mergeGeometries(sParts, false);
      sParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.ConeGeometry(1.4, 8, 12);
    }

    case "corvette": {
      const body = ensureNonIndexed(new THREE.BoxGeometry(8.5, 1.4, 4.0));
      body.translate(0, 0, 0);
      const roof = ensureNonIndexed(new THREE.SphereGeometry(1, 10, 8));
      roof.scale(3.0, 0.8, 1.8);
      roof.translate(0, 1.0, 0.2);
      const cParts = [body, roof];
      const merged = mergeGeometries(cParts, false);
      cParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.BoxGeometry(8.5, 1.4, 4.0);
    }

    case "shield": {
      const shPath = new THREE.Shape();
      shPath.moveTo(-4.5, 5.0);
      shPath.lineTo(4.5, 5.0);
      shPath.lineTo(4.5, 0.0);
      shPath.bezierCurveTo(4.5, -1.8, 2.2, -3.2, 0.0, -4.5);
      shPath.bezierCurveTo(-2.2, -3.2, -4.5, -1.8, -4.5, 0.0);
      shPath.closePath();
      return new THREE.ExtrudeGeometry(shPath, {
        depth: 1.0,
        bevelEnabled: true,
        bevelSize: 0.2,
        bevelThickness: 0.2,
        bevelSegments: 3,
      });
    }

    case "crown": {
      const band = ensureNonIndexed(
        new THREE.TorusGeometry(4.0, 0.85, 8, 40, Math.PI * 2),
      );
      band.translate(0, -1.5, 0);
      const spikeParts: THREE.BufferGeometry[] = [band];
      for (let si = 0; si < 5; si++) {
        const angle = (si / 5) * Math.PI * 2;
        const spike = ensureNonIndexed(new THREE.ConeGeometry(0.55, 5.0, 8));
        spike.translate(Math.cos(angle) * 4.0, 1.5, Math.sin(angle) * 4.0);
        spikeParts.push(spike);
      }
      const merged = mergeGeometries(spikeParts, false);
      spikeParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.TorusGeometry(4.0, 0.85, 8, 40);
    }

    case "butterfly": {
      // Upper wings (large) + lower wings (small) extruded shapes
      const wingU = new THREE.Shape();
      wingU.moveTo(0, 0);
      wingU.bezierCurveTo(1.0, 2.0, 5.0, 4.0, 5.5, 1.5);
      wingU.bezierCurveTo(5.0, -0.5, 2.0, -0.5, 0, 0);
      const wingL = new THREE.Shape();
      wingL.moveTo(0, 0);
      wingL.bezierCurveTo(0.8, -1.2, 3.5, -3.0, 3.0, -1.0);
      wingL.bezierCurveTo(2.5, 0.0, 1.0, 0.0, 0, 0);
      const geoUR = ensureNonIndexed(
        new THREE.ExtrudeGeometry(wingU, {
          depth: 0.3,
          bevelEnabled: false,
        }),
      );
      const geoUL = geoUR.clone();
      geoUL.scale(-1, 1, 1);
      const geoLR = ensureNonIndexed(
        new THREE.ExtrudeGeometry(wingL, {
          depth: 0.3,
          bevelEnabled: false,
        }),
      );
      const geoLL = geoLR.clone();
      geoLL.scale(-1, 1, 1);
      geoUR.translate(0, 1.2, 0);
      geoUL.translate(0, 1.2, 0);
      const bParts = [geoUR, geoUL, geoLR, geoLL];
      const merged = mergeGeometries(bParts, false);
      bParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.IcosahedronGeometry(3, 1);
    }

    case "lightning": {
      const boltPath = new THREE.Shape();
      boltPath.moveTo(0.5, 6.5);
      boltPath.lineTo(-2.0, 2.5);
      boltPath.lineTo(1.5, 0.5);
      boltPath.lineTo(-2.5, -2.5);
      boltPath.lineTo(1.0, -4.5);
      boltPath.lineTo(-1.0, -6.5);
      boltPath.lineTo(-1.8, -6.0);
      boltPath.lineTo(0.2, -4.0);
      boltPath.lineTo(-2.0, -2.0);
      boltPath.lineTo(0.5, 0.0);
      boltPath.lineTo(-2.8, 2.2);
      boltPath.lineTo(-0.5, 6.5);
      boltPath.closePath();
      return new THREE.ExtrudeGeometry(boltPath, {
        depth: 0.8,
        bevelEnabled: false,
      });
    }

    case "lotus": {
      // 8 petals combined into one geometry via mergeGeometries
      const petalGeos: THREE.BufferGeometry[] = [];
      for (let pi = 0; pi < 8; pi++) {
        const angle = (pi / 8) * Math.PI * 2;
        const petal = new THREE.Shape();
        petal.moveTo(0, 0.5);
        petal.bezierCurveTo(1.2, 1.5, 1.5, 4.0, 0, 4.8);
        petal.bezierCurveTo(-1.5, 4.0, -1.2, 1.5, 0, 0.5);
        const geo = ensureNonIndexed(
          new THREE.ExtrudeGeometry(petal, {
            depth: 0.25,
            bevelEnabled: false,
          }),
        );
        geo.rotateX(-Math.PI * 0.25); // curve petals upward
        geo.rotateZ(angle);
        petalGeos.push(geo);
      }
      const merged = mergeGeometries(petalGeos, false);
      petalGeos.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.IcosahedronGeometry(3, 2);
    }

    case "humanoid": {
      const addS = (r: number, tx: number, ty: number, tz: number) => {
        const g = ensureNonIndexed(new THREE.SphereGeometry(r, 10, 8));
        g.translate(tx, ty, tz);
        return g;
      };
      const addC = (
        r: number,
        h: number,
        tx: number,
        ty: number,
        tz: number,
      ) => {
        const g = ensureNonIndexed(new THREE.CapsuleGeometry(r, h, 4, 8));
        g.translate(tx, ty, tz);
        return g;
      };
      const hParts = [
        addS(1.3, 0, 7.2, 0), // head
        addS(1.9, 0, 4.0, 0), // torso
        addC(0.6, 2.5, -2.8, 4.0, 0), // arm L
        addC(0.6, 2.5, 2.8, 4.0, 0), // arm R
        addC(0.8, 3.2, -1.0, 0.5, 0), // leg L
        addC(0.8, 3.2, 1.0, 0.5, 0), // leg R
      ];
      const merged = mergeGeometries(hParts, false);
      hParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.SphereGeometry(3, 24, 24);
    }

    case "teddy_bear": {
      // Composite bear silhouette — matches the 8-region particle distribution exactly
      const addSphere = (r: number, tx: number, ty: number, tz: number) => {
        const g = ensureNonIndexed(new THREE.SphereGeometry(r, 16, 12));
        g.translate(tx, ty, tz);
        return g;
      };
      const parts = [
        addSphere(4.0, 0, 0.0, 0), // body
        addSphere(3.0, 0, 5.0, 0), // head
        addSphere(1.0, -2, 7.0, 0), // ear L
        addSphere(1.0, 2, 7.0, 0), // ear R
        addSphere(1.5, -3, 1.0, 0), // arm L
        addSphere(1.5, 3, 1.0, 0), // arm R
        addSphere(2.0, -2, -4.0, 0), // leg L
        addSphere(2.0, 2, -4.0, 0), // leg R
      ];
      const merged = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.SphereGeometry(4.0, 32, 32); // fallback
    }

    case "ankh": {
      // Loop (torus) + crossbar (box) + stem (box)
      const loop = ensureNonIndexed(new THREE.TorusGeometry(2.0, 0.65, 12, 40));
      loop.translate(0, 4.0, 0);
      const crossbar = ensureNonIndexed(new THREE.BoxGeometry(6.4, 1.1, 0.7));
      crossbar.translate(0, 1.2, 0);
      const stem = ensureNonIndexed(new THREE.BoxGeometry(1.4, 5.2, 0.7));
      stem.translate(0, -1.5, 0);
      const aParts = [loop, crossbar, stem];
      const merged = mergeGeometries(aParts, false);
      aParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.TorusGeometry(2.0, 0.65, 12, 40);
    }

    case "merkaba": {
      // Two interlocking tetrahedra — star tetrahedron
      const t1 = ensureNonIndexed(new THREE.TetrahedronGeometry(3.5, 0));
      t1.rotateX(Math.PI / 6);
      const t2 = ensureNonIndexed(new THREE.TetrahedronGeometry(3.5, 0));
      t2.rotateX(-Math.PI / 6);
      t2.rotateY(Math.PI);
      const mParts = [t1, t2];
      const merged = mergeGeometries(mParts, false);
      mParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.OctahedronGeometry(3.0, 0);
    }

    case "thirdEye": {
      // Almond eye shape extruded with iris sphere
      const eyePath = new THREE.Shape();
      eyePath.moveTo(-5.5, 0);
      eyePath.quadraticCurveTo(0, 2.2, 5.5, 0);
      eyePath.quadraticCurveTo(0, -2.2, -5.5, 0);
      const eyeGeo = ensureNonIndexed(
        new THREE.ExtrudeGeometry(eyePath, {
          depth: 0.6,
          bevelEnabled: true,
          bevelThickness: 0.2,
          bevelSize: 0.2,
          bevelSegments: 3,
        }),
      );
      eyeGeo.translate(0, 0, -0.3);
      const iris = ensureNonIndexed(new THREE.SphereGeometry(1.6, 16, 16));
      iris.scale(1, 0.7, 0.5);
      const eParts = [eyeGeo, iris];
      const merged = mergeGeometries(eParts, false);
      eParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.SphereGeometry(2.5, 32, 32);
    }

    case "infinity": {
      // Figure-8 (lemniscate) — two linked tori
      const tA = ensureNonIndexed(new THREE.TorusGeometry(2.4, 0.75, 12, 64));
      tA.translate(-2.4, 0, 0);
      const tB = ensureNonIndexed(new THREE.TorusGeometry(2.4, 0.75, 12, 64));
      tB.translate(2.4, 0, 0);
      const iParts = [tA, tB];
      const merged = mergeGeometries(iParts, false);
      iParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.TorusGeometry(2.4, 0.75, 12, 64);
    }

    case "crescent": {
      // Crescent moon — extruded 2D path
      const moon = new THREE.Shape();
      moon.absarc(0, 0, 5.0, -Math.PI / 2, Math.PI / 2, false);
      const hole = new THREE.Path();
      hole.absarc(2.2, 0, 3.8, Math.PI / 2, -Math.PI / 2, true);
      moon.holes.push(hole);
      const cGeo = ensureNonIndexed(
        new THREE.ExtrudeGeometry(moon, {
          depth: 1.2,
          bevelEnabled: true,
          bevelThickness: 0.2,
          bevelSize: 0.2,
          bevelSegments: 3,
        }),
      );
      cGeo.translate(-1.1, 0, -0.6);
      cGeo.computeVertexNormals();
      return cGeo;
    }

    case "sunburst": {
      // Center disk + 10 tapered ray cones
      const disk = ensureNonIndexed(
        new THREE.CylinderGeometry(2.2, 2.2, 0.8, 32),
      );
      const rayParts: THREE.BufferGeometry[] = [disk];
      for (let ri = 0; ri < 10; ri++) {
        const angle = (ri / 10) * Math.PI * 2;
        const ray = ensureNonIndexed(new THREE.ConeGeometry(0.7, 5.0, 8));
        ray.translate(0, 4.7, 0);
        ray.rotateZ(-Math.PI / 2);
        ray.rotateY(angle);
        rayParts.push(ray);
      }
      const merged = mergeGeometries(rayParts, false);
      rayParts.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.CylinderGeometry(2.2, 2.2, 0.8, 32);
    }

    case "pyramid": {
      // 4-sided Egyptian pyramid — CylinderGeometry with radialSegments=4
      const pyr = new THREE.CylinderGeometry(0, 5.0, 8.5, 4, 1);
      pyr.rotateY(Math.PI / 4); // face the square to camera
      pyr.translate(0, -0.75, 0); // center vertically
      pyr.computeVertexNormals();
      return pyr;
    }

    default:
      return new THREE.IcosahedronGeometry(2.2, 3);
  }
};

export const VoxelCore: React.FC<VoxelCoreProps> = ({
  active,
  config,
  audioIntensity,
  interactive = true,
  isSpeaking = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // REFS to hold Three.js state persistently
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const particlesRef = useRef<THREE.InstancedMesh | null>(null);
  const particles2Ref = useRef<THREE.InstancedMesh | null>(null);
  const innerGroupRef = useRef<THREE.Group | null>(null);
  const outerGroupRef = useRef<THREE.Group | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const targetPositionsRef = useRef<Float32Array | null>(null);
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const speedsRef = useRef<Float32Array | null>(null);

  // Core morph state — shrink → swap geometry → grow
  const coreMorphStateRef = useRef<"idle" | "shrinking" | "growing">("idle");
  const coreMorphProgressRef = useRef(0);
  const coreMorphTargetShapeRef = useRef<CoreShape>(config.shape);

  const configRef = useRef(config);
  const audioRef = useRef(audioIntensity);
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    audioRef.current = audioIntensity;
  }, [audioIntensity]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // --- UPDATE TARGETS ON SHAPE CHANGE ---
  useEffect(() => {
    const count = config.density;
    const targets = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const p = getTargetPosition(i, count, config.shape);
      targets[i * 3] = p.x;
      targets[i * 3 + 1] = p.y;
      targets[i * 3 + 2] = p.z;
    }
    targetPositionsRef.current = targets;

    // Trigger core morph: shrink → swap geometry to match new shape → grow
    coreMorphTargetShapeRef.current = config.shape;
    coreMorphStateRef.current = "shrinking";
    coreMorphProgressRef.current = 0;
    if (coreMeshRef.current) coreMeshRef.current.visible = true;
  }, [config.shape, config.density]);

  // --- INITIALIZATION (Run Once) ---
  useEffect(() => {
    if (!mountRef.current) return;
    mountRef.current.innerHTML = "";

    // 1. Setup Scene
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 20);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // WebGL unavailable (headless/server environment) — render a static fallback div
      if (mountRef.current) {
        const fallback = document.createElement("div");
        fallback.style.cssText =
          "width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#00A3FF;font-family:monospace;font-size:12px;opacity:0.5;";
        fallback.textContent = "VOXEL CORE // OFFLINE";
        mountRef.current.appendChild(fallback);
      }
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Controls (Persistent)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.minDistance = 5;
    controls.maxDistance = 60;
    controls.autoRotate = false;
    controlsRef.current = controls;

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // 4. Objects — two counter-rotating groups
    // innerGroup: core sphere + inner particles  (rotate CW on Y)
    // outerGroup: outer particle shell           (rotate CCW on Y)
    const innerGroup = new THREE.Group();
    const outerGroup = new THREE.Group();
    scene.add(innerGroup);
    scene.add(outerGroup);
    innerGroupRef.current = innerGroup;
    outerGroupRef.current = outerGroup;

    const innerGeo = buildCoreGeometry(configRef.current.shape);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x00ffff,
      emissiveIntensity: 2,
      roughness: 0.1,
      metalness: 0.6,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerGroup.add(innerMesh);
    coreMeshRef.current = innerMesh;

    const maxParticles = 20000;
    // Half in inner group (CW), half in outer group (CCW)
    const half = maxParticles / 2;
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pGeo2 = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const pMat2 = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const particles = new THREE.InstancedMesh(pGeo, pMat, half);
    const particles2 = new THREE.InstancedMesh(pGeo2, pMat2, half);
    innerGroup.add(particles);
    outerGroup.add(particles2);
    particlesRef.current = particles;
    particles2Ref.current = particles2;

    const currentPos = new Float32Array(maxParticles * 3);
    const speeds = new Float32Array(maxParticles);
    const initialTargets = new Float32Array(maxParticles * 3);

    for (let i = 0; i < maxParticles; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      currentPos[i * 3] = x;
      currentPos[i * 3 + 1] = y;
      currentPos[i * 3 + 2] = z;
      initialTargets[i * 3] = x;
      initialTargets[i * 3 + 1] = y;
      initialTargets[i * 3 + 2] = z;
      speeds[i] = 0.02 + Math.random() * 0.03;
    }

    currentPositionsRef.current = currentPos;
    targetPositionsRef.current = initialTargets;
    speedsRef.current = speeds;

    // 5. Animation Loop
    let frameId = 0;
    const dummy = new THREE.Object3D();
    let prevTime = performance.now();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - prevTime) / 1000;
      prevTime = now;
      const time = now / 1000;

      controls.update();

      const cfg = configRef.current;
      const aud = audioRef.current;
      const speaking = isSpeakingRef.current;
      const ig = innerGroupRef.current!;
      const og = outerGroupRef.current!;

      // Counter-rotating groups — inner CW, outer CCW
      const rotSpeed = speaking ? 0.014 * cfg.speed : 0.006 * cfg.speed;
      ig.rotation.y += rotSpeed; // clockwise
      og.rotation.y -= rotSpeed * 1.3; // counter-clockwise, slightly faster
      // Tilt axes opposite each other for 3-D feel
      ig.rotation.z =
        Math.sin(time * (speaking ? 0.7 : 0.25)) * (speaking ? 0.18 : 0.08);
      og.rotation.x =
        Math.sin(time * (speaking ? 0.5 : 0.18)) * (speaking ? 0.15 : 0.06);

      // Color logic — speaking shifts hue toward bright cyan; idle rotates slowly
      const hue = speaking
        ? 0.55 + Math.sin(time * 4) * 0.05
        : (time * 0.05) % 1;
      const compHue = (hue + 0.5) % 1;
      const speakingLightness = speaking
        ? 0.75 + Math.sin(time * 8) * 0.15
        : 0.6;

      (particles.material as THREE.MeshBasicMaterial).color.setHSL(
        hue,
        1.0,
        speakingLightness,
      );
      (particles2.material as THREE.MeshBasicMaterial).color.setHSL(
        compHue,
        1.0,
        speakingLightness,
      );
      const coreIntensity = speaking ? 2.5 + Math.sin(time * 10) * 1.0 : 2.0;
      innerMat.emissive.setHSL(compHue, 1.0, 0.5 + aud);
      innerMat.emissiveIntensity = coreIntensity;

      // Core morph + pulse scale
      if (coreMeshRef.current) {
        const pulse = speaking ? 1.0 + Math.sin(time * 9) * 0.12 : 1.0;
        const morphState = coreMorphStateRef.current;
        if (morphState === "shrinking") {
          coreMorphProgressRef.current = Math.min(
            1,
            coreMorphProgressRef.current + delta * 5,
          );
          const s = 1 - coreMorphProgressRef.current;
          coreMeshRef.current.scale.setScalar(pulse * s);
          if (coreMorphProgressRef.current >= 1) {
            // Swap geometry to match new shape
            const newGeo = buildCoreGeometry(coreMorphTargetShapeRef.current);
            coreMeshRef.current.geometry.dispose();
            coreMeshRef.current.geometry = newGeo;
            coreMorphStateRef.current = "growing";
            coreMorphProgressRef.current = 0;
          }
        } else if (morphState === "growing") {
          coreMorphProgressRef.current = Math.min(
            1,
            coreMorphProgressRef.current + delta * 5,
          );
          const s = coreMorphProgressRef.current;
          coreMeshRef.current.scale.setScalar(pulse * s);
          if (coreMorphProgressRef.current >= 1)
            coreMorphStateRef.current = "idle";
        } else {
          coreMeshRef.current.scale.setScalar(pulse);
        }
      }

      // Particle Logic — split across two counter-rotating groups
      const count = cfg.density;
      const innerCount = Math.floor(count / 2);
      const outerCount = count - innerCount;
      const current = currentPositionsRef.current!;
      const targets = targetPositionsRef.current!;
      const speedBuf = speedsRef.current!;

      particles.count = innerCount;
      particles2.count = outerCount;

      const jitter = (speaking ? 0.14 : 0.05) * (1 + aud * 5);

      // Inner particles (CW group)
      for (let i = 0; i < innerCount; i++) {
        const ix = i * 3;
        const spd = speedBuf[i] * cfg.speed * 60 * delta;
        current[ix] += (targets[ix] - current[ix]) * spd;
        current[ix + 1] += (targets[ix + 1] - current[ix + 1]) * spd;
        current[ix + 2] += (targets[ix + 2] - current[ix + 2]) * spd;
        dummy.position.set(
          current[ix] + (Math.random() - 0.5) * jitter,
          current[ix + 1] + (Math.random() - 0.5) * jitter,
          current[ix + 2] + (Math.random() - 0.5) * jitter,
        );
        dummy.lookAt(0, 0, 0);
        dummy.scale.setScalar((1 + aud) * (Math.random() * 0.5 + 0.5));
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      // Outer particles (CCW group) — use second half of position buffers
      for (let i = 0; i < outerCount; i++) {
        const src = innerCount + i;
        const ix = src * 3;
        const spd = speedBuf[src] * cfg.speed * 60 * delta;
        current[ix] += (targets[ix] - current[ix]) * spd;
        current[ix + 1] += (targets[ix + 1] - current[ix + 1]) * spd;
        current[ix + 2] += (targets[ix + 2] - current[ix + 2]) * spd;
        dummy.position.set(
          current[ix] + (Math.random() - 0.5) * jitter,
          current[ix + 1] + (Math.random() - 0.5) * jitter,
          current[ix + 2] + (Math.random() - 0.5) * jitter,
        );
        dummy.lookAt(0, 0, 0);
        dummy.scale.setScalar((1 + aud) * (Math.random() * 0.5 + 0.5));
        dummy.updateMatrix();
        particles2.setMatrixAt(i, dummy.matrix);
      }
      particles2.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 6. Resize Observer for Smooth Container Resizing
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (mountRef.current && renderer.domElement)
        mountRef.current.removeChild(renderer.domElement);
      if (mountRef.current) mountRef.current.innerHTML = "";
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full relative z-10 ${interactive ? "pointer-events-auto" : "pointer-events-none"}`}
    />
  );
};
