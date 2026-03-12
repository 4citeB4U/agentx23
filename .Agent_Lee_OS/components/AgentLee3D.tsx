/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UI.AGENTLEE_3D
REGION: 🔵 UI
PURPOSE: Spiritually and culturally resonant 3D particle morphing face for Agent Lee.
         Shapes: ankh, lotus, merkaba, thirdEye, infinity, crescent, pyramid, sunburst.
SECURITY: No sensitive data — pure 3D rendering component.
============================================================================ */

import { Float, MeshDistortMaterial, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ShapeType } from "../types";

// ==========================================
// GLSL SHADERS
// ==========================================
const vertexShader = `
  uniform float uTime;
  uniform float uSpeaking;
  uniform float uMorphProgress;
  uniform float uSize;

  attribute vec3 targetPosition;
  attribute float aRandom;

  varying float vDistance;
  varying float vSpeaking;
  varying float vRandom;

  void main() {
    vSpeaking = uSpeaking;
    vRandom = aRandom;

    // Morph between current and target shape
    vec3 pos = mix(position, targetPosition, uMorphProgress);

    // Organic noise jitter
    pos += vec3(
      sin(uTime * 2.0 + aRandom * 10.0),
      cos(uTime * 2.5 + aRandom * 12.0),
      sin(uTime * 1.8 + aRandom * 8.0)
    ) * 0.02;

    // Burst/Wave effect when speaking
    if (uSpeaking > 0.01) {
      float dist = length(pos);
      float wave = sin(uTime * 12.0 - dist * 5.0 + aRandom * 2.0) * 0.2 * uSpeaking;
      float burst = (sin(uTime * 25.0 + aRandom * 6.28) * 0.05 + 0.1) * uSpeaking;
      pos += normalize(pos) * (wave + burst);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vDistance = length(pos);

    gl_PointSize = uSize * (60.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uSpeaking;
  varying float vDistance;
  varying float vSpeaking;
  varying float vRandom;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.1, dist);
    vec3 color = uColor;

    alpha *= pow(1.0 - dist * 2.0, 0.5);

    if (vSpeaking > 0.01) {
      float pulse = sin(vRandom * 10.0 + vSpeaking * 5.0) * 0.5 + 0.5;
      color = mix(color, vec3(1.0, 1.0, 1.0), vSpeaking * 0.4 * pulse);
    }

    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;

// ==========================================
// PARTICLE COUNT
// ==========================================
const PARTICLE_COUNT = 80000;
const geometryCache: Record<string, THREE.BufferGeometry> = {};

// ==========================================
// SPIRITUAL & ETHNIC SHAPE GEOMETRIES
// ==========================================
export const getSamplingGeometry = (shape: ShapeType): THREE.BufferGeometry => {
  if (geometryCache[shape]) return geometryCache[shape];

  const geometries: THREE.BufferGeometry[] = [];

  switch (shape) {
    case "ankh": {
      // African/Egyptian symbol of life
      const loop = new THREE.TorusGeometry(0.35, 0.12, 16, 32);
      loop.translate(0, 0.8, 0);
      const cross = new THREE.BoxGeometry(1.2, 0.2, 0.2);
      cross.translate(0, 0.2, 0);
      const stem = new THREE.BoxGeometry(0.25, 1.2, 0.2);
      stem.translate(0, -0.5, 0);
      geometries.push(loop, cross, stem);
      break;
    }

    case "lotus": {
      // Eastern/Universal spiritual purity symbol
      const createPetal = (rZ: number, scaleY: number) => {
        const petal = new THREE.SphereGeometry(1, 32, 16);
        petal.scale(0.3, scaleY, 0.1);
        petal.translate(0, scaleY * 0.5, 0);
        petal.rotateZ(rZ);
        petal.translate(0, -0.5, 0);
        return petal;
      };
      geometries.push(
        createPetal(0, 1.2),
        createPetal(-0.4, 1.0),
        createPetal(0.4, 1.0),
        createPetal(-0.8, 0.8),
        createPetal(0.8, 0.8),
        createPetal(-1.2, 0.6),
        createPetal(1.2, 0.6),
      );
      break;
    }

    case "merkaba": {
      // Sacred geometry — star tetrahedron
      const tet1 = new THREE.TetrahedronGeometry(1.2, 0);
      const tet2 = new THREE.TetrahedronGeometry(1.2, 0);
      tet1.rotateX(Math.PI / 4);
      tet1.rotateZ(Math.PI / 4);
      tet2.rotateX(-Math.PI / 4);
      tet2.rotateZ(-Math.PI / 4);
      geometries.push(tet1, tet2);
      break;
    }

    case "thirdEye": {
      // Mysticism / Spiritual vision — eye with iris
      const eyeShape = new THREE.Shape();
      eyeShape.moveTo(-1.4, 0);
      eyeShape.quadraticCurveTo(0, 1.0, 1.4, 0);
      eyeShape.quadraticCurveTo(0, -1.0, -1.4, 0);
      const eyeBase = new THREE.ExtrudeGeometry(eyeShape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
      });
      eyeBase.translate(0, 0, -0.1);
      const pupil = new THREE.SphereGeometry(0.45, 32, 32);
      pupil.scale(1, 1, 0.5);
      geometries.push(eyeBase, pupil);
      break;
    }

    case "infinity": {
      // Limitless — lemniscate (figure-8) as two linked tori
      const t1 = new THREE.TorusGeometry(0.5, 0.18, 16, 64);
      t1.translate(-0.5, 0, 0);
      const t2 = new THREE.TorusGeometry(0.5, 0.18, 16, 64);
      t2.translate(0.5, 0, 0);
      geometries.push(t1, t2);
      break;
    }

    case "crescent": {
      // Islamic / Celestial / Ethnic moon
      const moonShape = new THREE.Shape();
      moonShape.absarc(0, 0, 1.2, -Math.PI / 2, Math.PI / 2, false);
      moonShape.absarc(0.4, 0, 0.9, Math.PI / 2, -Math.PI / 2, true);
      const moonGeo = new THREE.ExtrudeGeometry(moonShape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
      });
      moonGeo.translate(-0.2, 0, -0.15);
      geometries.push(moonGeo);
      break;
    }

    case "sunburst": {
      // Energy / Tribal radiating sun
      const center = new THREE.SphereGeometry(0.5, 32, 32);
      geometries.push(center);
      for (let i = 0; i < 12; i++) {
        const ray = new THREE.ConeGeometry(0.1, 0.75, 8);
        ray.translate(0, 0.85, 0);
        ray.rotateZ(((Math.PI * 2) / 12) * i);
        geometries.push(ray);
      }
      break;
    }

    case "pyramid": {
      // Ancient Egyptian 4-sided pyramid
      const pyr = new THREE.CylinderGeometry(0, 1.2, 1.5, 4, 1);
      pyr.rotateY(Math.PI / 4);
      geometries.push(pyr);
      break;
    }

    default:
      geometries.push(new THREE.SphereGeometry(1, 32, 32));
  }

  const result =
    geometries.length === 1 ? geometries[0] : mergeBufferGeometries(geometries);
  geometryCache[shape] = result;
  return result;
};

// ==========================================
// GEOMETRY MERGE UTILITY
// ==========================================
const mergeBufferGeometries = (geometries: THREE.BufferGeometry[]) => {
  let totalCount = 0;
  geometries.forEach((g) => (totalCount += g.getAttribute("position").count));

  const mergedPos = new Float32Array(totalCount * 3);
  let offset = 0;
  geometries.forEach((g) => {
    const pos = g.getAttribute("position").array;
    mergedPos.set(pos, offset);
    offset += pos.length;
  });

  const mergedGeo = new THREE.BufferGeometry();
  mergedGeo.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
  return mergedGeo;
};

// ==========================================
// SURFACE POINT SAMPLER
// ==========================================
const samplePointsFromGeometry = (
  geometry: THREE.BufferGeometry,
  count: number,
): Float32Array => {
  const points = new Float32Array(count * 3);
  const posAttr = geometry.getAttribute("position");
  const indexAttr = geometry.getIndex();

  if (!posAttr) return points;

  const vertexCount = posAttr.count;
  const hasIndex = !!indexAttr;
  const triangleCount = hasIndex
    ? indexAttr.count / 3
    : Math.floor(vertexCount / 3);
  const posArray = posAttr.array;
  const indexArray = hasIndex ? indexAttr.array : null;

  for (let i = 0; i < count; i++) {
    const triIndex = Math.floor(Math.random() * triangleCount);

    let i1: number, i2: number, i3: number;
    if (hasIndex && indexArray) {
      i1 = indexArray[triIndex * 3];
      i2 = indexArray[triIndex * 3 + 1];
      i3 = indexArray[triIndex * 3 + 2];
    } else {
      i1 = triIndex * 3;
      i2 = triIndex * 3 + 1;
      i3 = triIndex * 3 + 2;
    }

    const ax = posArray[i1 * 3],
      ay = posArray[i1 * 3 + 1],
      az = posArray[i1 * 3 + 2];
    const bx = posArray[i2 * 3],
      by = posArray[i2 * 3 + 1],
      bz = posArray[i2 * 3 + 2];
    const cx = posArray[i3 * 3],
      cy = posArray[i3 * 3 + 1],
      cz = posArray[i3 * 3 + 2];

    let u = Math.random(),
      v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    points[i * 3] = u * ax + v * bx + w * cx;
    points[i * 3 + 1] = u * ay + v * by + w * cy;
    points[i * 3 + 2] = u * az + v * bz + w * cz;
  }
  return points;
};

// ==========================================
// MORPHING PARTICLE CLOUD
// ==========================================
const MorphingParticles = ({
  shape,
  isSpeaking,
  color,
}: {
  shape: ShapeType;
  isSpeaking: boolean;
  color: string;
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const basePositions = useMemo(() => {
    const geo = getSamplingGeometry("ankh");
    return samplePointsFromGeometry(geo, PARTICLE_COUNT);
  }, []);

  const randoms = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) arr[i] = Math.random();
    return arr;
  }, []);

  const [targetPositions, setTargetPositions] = useState(basePositions);
  const [prevPositions, setPrevPositions] = useState(basePositions);
  const morphProgress = useRef(1);

  useEffect(() => {
    const newGeo = getSamplingGeometry(shape);
    const newPoints = samplePointsFromGeometry(newGeo, PARTICLE_COUNT);
    setPrevPositions(targetPositions);
    setTargetPositions(newPoints);
    morphProgress.current = 0;
  }, [shape]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !materialRef.current) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uSpeaking.value = THREE.MathUtils.lerp(
      materialRef.current.uniforms.uSpeaking.value,
      isSpeaking ? 1.0 : 0.0,
      0.1,
    );

    if (morphProgress.current < 1) {
      morphProgress.current += delta * 1.2;
      if (morphProgress.current > 1) morphProgress.current = 1;
      materialRef.current.uniforms.uMorphProgress.value = morphProgress.current;

      if (morphProgress.current >= 1) {
        const geo = pointsRef.current.geometry;
        const posAttr = geo.getAttribute("position");
        (posAttr.array as Float32Array).set(targetPositions);
        posAttr.needsUpdate = true;
        materialRef.current.uniforms.uMorphProgress.value = 0;
      }
    }
    pointsRef.current.rotation.y += 0.003;
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeaking: { value: 0 },
      uMorphProgress: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: 0.018 },
    }),
    [],
  );

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(color);
    }
  }, [color]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={prevPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-targetPosition"
          count={PARTICLE_COUNT}
          array={targetPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={PARTICLE_COUNT}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// ==========================================
// SOLID CORE MESH
// ==========================================
const MorphingCore = ({
  shape,
  isSpeaking,
  color,
}: {
  shape: ShapeType;
  isSpeaking: boolean;
  color: string;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [pulse, setPulse] = useState(0);

  const geometry = useMemo(() => getSamplingGeometry(shape), [shape]);

  useEffect(() => {
    setPulse(1);
    const timer = setTimeout(() => setPulse(0), 500);
    return () => clearTimeout(timer);
  }, [shape]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y -= 0.006;

    let targetScale = 1;
    if (isSpeaking) {
      targetScale = 1 + Math.sin(state.clock.elapsedTime * 25) * 0.04;
    }
    if (pulse > 0) {
      targetScale *= 1 + Math.sin(state.clock.elapsedTime * 40) * 0.2;
    }

    groupRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1,
    );
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <MeshDistortMaterial
          color={color}
          speed={isSpeaking ? 5 : 1.5}
          distort={isSpeaking ? 0.25 : 0.08}
          roughness={0.01}
          metalness={1.0}
          emissive={color}
          emissiveIntensity={isSpeaking ? 2.0 : 0.5}
        />
      </mesh>
    </group>
  );
};

// ==========================================
// SHAPE LABEL CONFIG
// ==========================================
export const SHAPE_LABELS: Record<ShapeType, string> = {
  ankh: "Ankh — Life",
  lotus: "Lotus — Purity",
  merkaba: "Merkaba — Sacred",
  thirdEye: "Third Eye — Vision",
  infinity: "Infinity — Eternal",
  crescent: "Crescent — Celestial",
  pyramid: "Pyramid — Knowledge",
  sunburst: "Sunburst — Energy",
};

// ==========================================
// MAIN EXPORTED COMPONENT
// ==========================================
export interface AgentLee3DProps {
  shape: ShapeType;
  isSpeaking: boolean;
  coreColor: string;
  particleColor: string;
}

export const AgentLee3D: React.FC<AgentLee3DProps> = ({
  shape,
  isSpeaking,
  coreColor,
  particleColor,
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        style={{ pointerEvents: "auto" }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={2.0} />
        <spotLight
          position={[-10, 10, 10]}
          angle={0.15}
          penumbra={1}
          intensity={1.5}
        />
        {/* Backlight for depth */}
        <pointLight position={[0, 0, -5]} intensity={1.0} color="#ffffff" />

        <OrbitControls enableDamping dampingFactor={0.05} />

        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <MorphingCore
            shape={shape}
            isSpeaking={isSpeaking}
            color={coreColor}
          />
          <MorphingParticles
            shape={shape}
            isSpeaking={isSpeaking}
            color={particleColor}
          />
        </Float>
      </Canvas>
    </div>
  );
};
