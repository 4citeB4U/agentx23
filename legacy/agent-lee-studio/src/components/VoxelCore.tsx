import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { SovereignIdentity } from '../services/SovereignIdentity';

export interface VoxelCoreRef {
    setMood: (mood: 'neutral' | 'angry' | 'happy' | 'thinking') => void;
    setDensity: (density: 'sparse' | 'dense') => void;
    toggleMicrophone: (enabled: boolean) => Promise<void>;
    triggerSpeech: (text: string) => void;
}

const VOXEL_COUNT_BASE = 15000;

export const VoxelCore = forwardRef<VoxelCoreRef, {}>((props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const dummy = new THREE.Object3D();

    const timeRef = useRef(0);
    const moodRef = useRef<'neutral' | 'angry' | 'happy' | 'thinking'>('neutral');
    const densityRef = useRef(1);
    const isMicActiveRef = useRef(false);

    const config = {
        colors: {
            neutral: new THREE.Color('#00ffff'),
            angry: new THREE.Color('#ff0000'),
            happy: new THREE.Color('#00ff44'),
            thinking: new THREE.Color('#aa00ff')
        }
    };

    useImperativeHandle(ref, () => ({
        setMood: (mood) => { moodRef.current = mood; },
        setDensity: (val) => { densityRef.current = val === 'dense' ? 2 : 0.5; },
        toggleMicrophone: async (enabled) => {
            if (enabled) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const analyser = audioCtx.createAnalyser();
                    const source = audioCtx.createMediaStreamSource(stream);
                    source.connect(analyser);
                    analyser.fftSize = 64;
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    audioContextRef.current = audioCtx;
                    analyserRef.current = analyser;
                    dataArrayRef.current = dataArray;
                    isMicActiveRef.current = true;
                } catch (e) {
                    console.error("Mic access denied", e);
                }
            } else {
                isMicActiveRef.current = false;
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
            }
        },
        triggerSpeech: async (text) => {
            if (!text) return;

            try {
                // Determine voice from persona/env (Defaulting to Andrew for Agent Lee vibe)
                const voice = 'en-US-AndrewMultilingualNeural';
                const body = { text, voice };
                const signedHeaders = await SovereignIdentity.signRequest(body);

                // Initialize Audio Context if not present
                if (!audioContextRef.current) {
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    audioContextRef.current = new AudioCtx();
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    analyserRef.current.fftSize = 64;
                    dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
                }

                const response = await fetch(`/api/chat/tts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...signedHeaders
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error('TTS_GENERATION_FAILED');

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);

                // Connect to analyser for pulse effect
                const source = audioContextRef.current.createMediaElementSource(audio);
                source.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);

                const originalMood = moodRef.current;
                moodRef.current = 'thinking';

                audio.play();
                audio.onended = () => {
                    moodRef.current = originalMood;
                    URL.revokeObjectURL(url);
                    // Disconnect to avoid leak/crossover if mic is toggled
                    source.disconnect();
                };
            } catch (err) {
                console.error('[voice] Sovereign TTS failure:', err);
                // Fallback to basic synth if backend fails
                const utterance = new SpeechSynthesisUtterance(text);
                window.speechSynthesis.speak(utterance);
            }
        }
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        // scene.background = null; // Transparent

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        camera.position.set(0, 0, 8);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0;
        bloomPass.strength = 1.2;
        bloomPass.radius = 0.5;

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.InstancedMesh(geometry, material, VOXEL_COUNT_BASE);

        for (let i = 0; i < VOXEL_COUNT_BASE; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 2.5 * Math.cbrt(Math.random());
            dummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        composerRef.current = composer;
        meshRef.current = mesh;

        const animate = () => {
            requestAnimationFrame(animate);
            timeRef.current += 0.01;
            controls.update();

            let audioLevel = 0;
            if (isMicActiveRef.current && analyserRef.current && dataArrayRef.current) {
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                let sum = 0;
                for (let i = 0; i < 10; i++) sum += dataArrayRef.current[i];
                audioLevel = sum / 10 / 255.0;
            } else {
                audioLevel = (Math.sin(timeRef.current * 2) * 0.5 + 0.5) * 0.1;
            }

            const currentColor = mesh.material.color;
            currentColor.lerp(config.colors[moodRef.current], 0.05);

            const baseScale = 1.0 + (audioLevel * 0.5);
            mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, baseScale, 0.1));
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.2 + (audioLevel * 2.0), 0.1);

            composer.render();
        };

        animate();

        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
            composerRef.current.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    return <div ref={containerRef} className="w-full h-full bg-transparent relative pointer-events-none" />;
});
