import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CoreShape, CoreConfig } from '../types';

interface VoxelCoreProps {
  active: boolean;
  config: CoreConfig;
  audioIntensity: number; 
  interactive?: boolean;
  isSpeaking?: boolean; // true while Agent Lee's voice is playing
}

// --- DISTINCT SHAPE ALGORITHMS ---
const getTargetPosition = (i: number, count: number, shape: CoreShape): {x: number, y: number, z: number} => {
    const p = { x: 0, y: 0, z: 0 };
    const rand = () => (Math.random() - 0.5) * 2; // -1 to 1

    if (shape === 'house') {
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
            p.y = (Math.random() * 5) - 3.5; 
        }
    }
    else if (shape === 'tree') {
        const isTrunk = Math.random() > 0.75; 
        if (isTrunk) {
            const r = 1.0;
            const theta = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * r;
            p.x = rad * Math.cos(theta);
            p.z = rad * Math.sin(theta);
            p.y = (Math.random() * 4) - 5; 
        } else {
            const layer = Math.floor(Math.random() * 3); 
            let yBase = -1;
            let h = 4;
            let wBase = 4;
            
            if(layer === 1) { yBase = 1; h = 3.5; wBase = 3; }
            if(layer === 2) { yBase = 3; h = 2.5; wBase = 2; }

            const yRel = Math.random() * h;
            const scale = (h - yRel) / h;
            const r = scale * wBase;
            const theta = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * r;
            
            p.x = rad * Math.cos(theta);
            p.z = rad * Math.sin(theta);
            p.y = yBase + yRel;
        }
    }
    else if (shape === 'dna') {
        const t = (i / count) * Math.PI * 8; 
        const r = 3.5;
        const h = 12;
        const y = ((i / count) * h) - (h/2);
        
        if (i % 2 === 0) {
            p.x = r * Math.cos(t);
            p.z = r * Math.sin(t);
            p.y = y;
        } else {
            p.x = r * Math.cos(t + Math.PI);
            p.z = r * Math.sin(t + Math.PI);
            p.y = y;
        }
        
        if (Math.random() > 0.8) {
            const alpha = Math.random(); 
            const x1 = r * Math.cos(t);
            const z1 = r * Math.sin(t);
            const x2 = r * Math.cos(t + Math.PI);
            const z2 = r * Math.sin(t + Math.PI);
            p.x = x1 + (x2 - x1) * alpha;
            p.z = z1 + (z2 - z1) * alpha;
            p.y = y;
        }
    }
    else if (shape === 'heart') {
        let found = false;
        while (!found) {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            const sc = 0.25;
            const xH = 16 * Math.pow(Math.sin(v), 3) * Math.cos(u); 
            const zH = 16 * Math.pow(Math.sin(v), 3) * Math.sin(u);
            const yH = 13*Math.cos(v) - 5*Math.cos(2*v) - 2*Math.cos(3*v) - Math.cos(4*v);
            p.x = xH * sc;
            p.y = yH * sc;
            p.z = zH * sc * Math.sin(v); 
            found = true;
        }
    }
    else if (shape === 'star') {
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
             const taper = 1 - ((dist - rInner) / (rOuter - rInner)); 
             const spread = 1.0 * taper;
             if (axis === 0) { p.x = dist; p.y = rand()*spread; p.z = rand()*spread; }
             else if (axis === 1) { p.x = -dist; p.y = rand()*spread; p.z = rand()*spread; }
             else if (axis === 2) { p.y = dist; p.x = rand()*spread; p.z = rand()*spread; }
             else if (axis === 3) { p.y = -dist; p.x = rand()*spread; p.z = rand()*spread; }
             else if (axis === 4) { p.z = dist; p.x = rand()*spread; p.y = rand()*spread; }
             else { p.z = -dist; p.x = rand()*spread; p.y = rand()*spread; }
        }
    }
    else if (shape === 'teddy_bear') {
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
        if      (part < 0.30) rInSphere(4.0,  0,  0.0,  0);  // body
        else if (part < 0.55) rInSphere(3.0,  0,  5.0,  0);  // head
        else if (part < 0.63) rInSphere(1.0, -2,  7.0,  0);  // ear L
        else if (part < 0.71) rInSphere(1.0,  2,  7.0,  0);  // ear R
        else if (part < 0.80) rInSphere(1.5, -3,  1.0,  0);  // arm L
        else if (part < 0.89) rInSphere(1.5,  3,  1.0,  0);  // arm R
        else if (part < 0.94) rInSphere(2.0, -2, -4.0,  0);  // leg L
        else                  rInSphere(2.0,  2, -4.0,  0);  // leg R
    }
    else {
        const r = 5.0 * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        p.x = r * Math.sin(phi) * Math.cos(theta);
        p.y = r * Math.sin(phi) * Math.sin(theta);
        p.z = r * Math.cos(phi);
    }
    return p;
};

// --- CORE GEOMETRY per shape ---
// Each geometry is built from the SAME math/dimensions as the particle formations
// so the solid core matches EXACTLY the shape the particle cloud is forming.
const buildCoreGeometry = (shape: CoreShape): THREE.BufferGeometry => {
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(2.2, 32, 32);

    case 'heart': {
      // Exact heart parametric: same formula as getTargetPosition('heart'), sc=0.25
      // x = 16sin³(t)·sc, y = (13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))·sc
      const sc = 0.27;
      const heartPath = new THREE.Shape();
      const steps = 128;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3) * sc;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * sc;
        if (i === 0) heartPath.moveTo(x, y);
        else heartPath.lineTo(x, y);
      }
      heartPath.closePath();
      return new THREE.ExtrudeGeometry(heartPath, {
        depth: 1.4, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.18, bevelSegments: 4
      });
    }

    case 'star': {
      // 6-axis star matching particle formation: 6 ray arms extending to rOuter=6, inner join at rInner=2
      const starPath = new THREE.Shape();
      const outerR = 3.2, innerR = 1.3, spikes = 6;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = r * Math.cos(angle), y = r * Math.sin(angle);
        if (i === 0) starPath.moveTo(x, y); else starPath.lineTo(x, y);
      }
      starPath.closePath();
      return new THREE.ExtrudeGeometry(starPath, {
        depth: 1.2, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2
      });
    }

    case 'house': {
      // House silhouette: rectangular base (walls) + triangular roof, matching particle dims
      const housePath = new THREE.Shape();
      housePath.moveTo(-2.5, -3.5);  // bottom-left
      housePath.lineTo( 2.5, -3.5);  // bottom-right
      housePath.lineTo( 2.5,  0.8);  // wall top-right
      housePath.lineTo( 0.0,  3.5);  // roof peak
      housePath.lineTo(-2.5,  0.8);  // wall top-left
      housePath.closePath();
      return new THREE.ExtrudeGeometry(housePath, { depth: 2.2, bevelEnabled: false });
    }

    case 'tree': {
      // Layered canopy cone matching the 3-layer particle tree + trunk
      // Use a single tall cone scaled to cover the full canopy range
      const treePath = new THREE.Shape();
      treePath.moveTo(0, 5.0);        // apex
      treePath.lineTo( 3.8, -1.0);    // wide base of canopy
      treePath.lineTo( 0.9, -1.0);    // shoulder inward
      treePath.lineTo( 0.9, -5.0);    // trunk bottom-right
      treePath.lineTo(-0.9, -5.0);    // trunk bottom-left
      treePath.lineTo(-0.9, -1.0);    // shoulder inward
      treePath.lineTo(-3.8, -1.0);    // wide base left
      treePath.closePath();
      return new THREE.ExtrudeGeometry(treePath, { depth: 1.8, bevelEnabled: false });
    }

    case 'dna': {
      // Double-helix: TorusKnot captures the intertwined spiral exactly
      return new THREE.TorusKnotGeometry(1.6, 0.4, 100, 10, 2, 3);
    }

    case 'teddy_bear': {
      // Composite bear silhouette — matches the 8-region particle distribution exactly
      const addSphere = (r: number, tx: number, ty: number, tz: number) => {
        const g = new THREE.SphereGeometry(r, 16, 12).toNonIndexed();
        g.translate(tx, ty, tz);
        return g;
      };
      const parts = [
        addSphere(4.0,  0,  0.0, 0),  // body
        addSphere(3.0,  0,  5.0, 0),  // head
        addSphere(1.0, -2,  7.0, 0),  // ear L
        addSphere(1.0,  2,  7.0, 0),  // ear R
        addSphere(1.5, -3,  1.0, 0),  // arm L
        addSphere(1.5,  3,  1.0, 0),  // arm R
        addSphere(2.0, -2, -4.0, 0),  // leg L
        addSphere(2.0,  2, -4.0, 0),  // leg R
      ];
      const merged = mergeGeometries(parts, false);
      parts.forEach(p => p.dispose());
      if (merged) {
        merged.computeVertexNormals();
        return merged;
      }
      return new THREE.SphereGeometry(4.0, 32, 32); // fallback
    }

    default:
      return new THREE.IcosahedronGeometry(2.2, 3);
  }
};

export const VoxelCore: React.FC<VoxelCoreProps> = ({ active, config, audioIntensity, interactive = true, isSpeaking = false }) => {
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
  const coreMorphStateRef = useRef<'idle'|'shrinking'|'growing'>('idle');
  const coreMorphProgressRef = useRef(0);
  const coreMorphTargetShapeRef = useRef<CoreShape>(config.shape);
  
  const configRef = useRef(config);
  const audioRef = useRef(audioIntensity);
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { audioRef.current = audioIntensity; }, [audioIntensity]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // --- UPDATE TARGETS ON SHAPE CHANGE ---
  useEffect(() => {
      const count = config.density;
      const targets = new Float32Array(count * 3);
      
      for (let i = 0; i < count; i++) {
          const p = getTargetPosition(i, count, config.shape);
          targets[i*3] = p.x;
          targets[i*3+1] = p.y;
          targets[i*3+2] = p.z;
      }
      targetPositionsRef.current = targets;
      
      // Trigger core morph: shrink → swap geometry to match new shape → grow
      coreMorphTargetShapeRef.current = config.shape;
      coreMorphStateRef.current = 'shrinking';
      coreMorphProgressRef.current = 0;
      if (coreMeshRef.current) coreMeshRef.current.visible = true;

  }, [config.shape, config.density]);

  // --- INITIALIZATION (Run Once) ---
  useEffect(() => {
    if (!mountRef.current) return;
        mountRef.current.innerHTML = '';

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
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      // WebGL unavailable (headless/server environment) — render a static fallback div
      if (mountRef.current) {
        const fallback = document.createElement('div');
        fallback.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#00A3FF;font-family:monospace;font-size:12px;opacity:0.5;';
        fallback.textContent = 'VOXEL CORE // OFFLINE';
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
        color: 0x000000, emissive: 0x00ffff, emissiveIntensity: 2, roughness: 0.1, metalness: 0.6
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
        const x = (Math.random()-0.5) * 20;
        const y = (Math.random()-0.5) * 20;
        const z = (Math.random()-0.5) * 20;
        currentPos[i*3] = x; currentPos[i*3+1] = y; currentPos[i*3+2] = z;
        initialTargets[i*3] = x; initialTargets[i*3+1] = y; initialTargets[i*3+2] = z;
        speeds[i] = 0.02 + Math.random() * 0.03;
    }
    
    currentPositionsRef.current = currentPos;
    targetPositionsRef.current = initialTargets; 
    speedsRef.current = speeds;

    // 5. Animation Loop
    let frameId = 0;
    const dummy = new THREE.Object3D();
    const clock = new THREE.Clock();

    const animate = () => {
        frameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        
        controls.update();

        const cfg = configRef.current;
        const aud = audioRef.current;
        const speaking = isSpeakingRef.current;
        const ig = innerGroupRef.current!;
        const og = outerGroupRef.current!;

        // Counter-rotating groups — inner CW, outer CCW
        const rotSpeed = speaking ? 0.014 * cfg.speed : 0.006 * cfg.speed;
        ig.rotation.y += rotSpeed;           // clockwise
        og.rotation.y -= rotSpeed * 1.3;     // counter-clockwise, slightly faster
        // Tilt axes opposite each other for 3-D feel
        ig.rotation.z = Math.sin(time * (speaking ? 0.7 : 0.25)) * (speaking ? 0.18 : 0.08);
        og.rotation.x = Math.sin(time * (speaking ? 0.5 : 0.18)) * (speaking ? 0.15 : 0.06);

        // Color logic — speaking shifts hue toward bright cyan; idle rotates slowly
        const hue = speaking
          ? 0.55 + Math.sin(time * 4) * 0.05
          : (time * 0.05) % 1;
        const compHue = (hue + 0.5) % 1;
        const speakingLightness = speaking ? 0.75 + Math.sin(time * 8) * 0.15 : 0.6;
        
        (particles.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1.0, speakingLightness);
        (particles2.material as THREE.MeshBasicMaterial).color.setHSL(compHue, 1.0, speakingLightness);
        const coreIntensity = speaking ? 2.5 + Math.sin(time * 10) * 1.0 : 2.0;
        innerMat.emissive.setHSL(compHue, 1.0, 0.5 + aud);
        innerMat.emissiveIntensity = coreIntensity;

        // Core morph + pulse scale
        if (coreMeshRef.current) {
          const pulse = speaking ? 1.0 + Math.sin(time * 9) * 0.12 : 1.0;
          const morphState = coreMorphStateRef.current;
          if (morphState === 'shrinking') {
            coreMorphProgressRef.current = Math.min(1, coreMorphProgressRef.current + delta * 5);
            const s = 1 - coreMorphProgressRef.current;
            coreMeshRef.current.scale.setScalar(pulse * s);
            if (coreMorphProgressRef.current >= 1) {
              // Swap geometry to match new shape
              const newGeo = buildCoreGeometry(coreMorphTargetShapeRef.current);
              coreMeshRef.current.geometry.dispose();
              coreMeshRef.current.geometry = newGeo;
              coreMorphStateRef.current = 'growing';
              coreMorphProgressRef.current = 0;
            }
          } else if (morphState === 'growing') {
            coreMorphProgressRef.current = Math.min(1, coreMorphProgressRef.current + delta * 5);
            const s = coreMorphProgressRef.current;
            coreMeshRef.current.scale.setScalar(pulse * s);
            if (coreMorphProgressRef.current >= 1) coreMorphStateRef.current = 'idle';
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
            current[ix]   += (targets[ix]   - current[ix])   * spd;
            current[ix+1] += (targets[ix+1] - current[ix+1]) * spd;
            current[ix+2] += (targets[ix+2] - current[ix+2]) * spd;
            dummy.position.set(
                current[ix]   + (Math.random()-0.5)*jitter,
                current[ix+1] + (Math.random()-0.5)*jitter,
                current[ix+2] + (Math.random()-0.5)*jitter
            );
            dummy.lookAt(0, 0, 0);
            dummy.scale.setScalar((1 + aud) * (Math.random()*0.5 + 0.5));
            dummy.updateMatrix();
            particles.setMatrixAt(i, dummy.matrix);
        }
        particles.instanceMatrix.needsUpdate = true;

        // Outer particles (CCW group) — use second half of position buffers
        for (let i = 0; i < outerCount; i++) {
            const src = innerCount + i;
            const ix = src * 3;
            const spd = speedBuf[src] * cfg.speed * 60 * delta;
            current[ix]   += (targets[ix]   - current[ix])   * spd;
            current[ix+1] += (targets[ix+1] - current[ix+1]) * spd;
            current[ix+2] += (targets[ix+2] - current[ix+2]) * spd;
            dummy.position.set(
                current[ix]   + (Math.random()-0.5)*jitter,
                current[ix+1] + (Math.random()-0.5)*jitter,
                current[ix+2] + (Math.random()-0.5)*jitter
            );
            dummy.lookAt(0, 0, 0);
            dummy.scale.setScalar((1 + aud) * (Math.random()*0.5 + 0.5));
            dummy.updateMatrix();
            particles2.setMatrixAt(i, dummy.matrix);
        }
        particles2.instanceMatrix.needsUpdate = true;
        
        renderer.render(scene, camera);
    };
    
    animate();

    // 6. Resize Observer for Smooth Container Resizing
    const handleResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
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
        if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
        if (mountRef.current) mountRef.current.innerHTML = '';
        renderer.dispose();
        controls.dispose();
    };
  }, []); 

  return (
    <div 
        ref={mountRef} 
                className={`w-full h-full relative z-10 ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
    />
  );
};