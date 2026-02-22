import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface CssOrbRef {
    setMood: (mood: 'neutral' | 'angry' | 'happy' | 'thinking') => void;
    setDensity: (density: 'sparse' | 'dense') => void;
    toggleMicrophone: (enabled: boolean) => Promise<void>;
    triggerSpeech: (text: string) => void;
}

export const CssOrb = forwardRef<CssOrbRef, {}>((props, ref) => {
    const [mood, setMood] = useState<'neutral' | 'angry' | 'happy' | 'thinking'>('neutral');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Audio Context (Mocked for visual reactivity if needed, or real)
    const audioContextRef = useRef<AudioContext | null>(null);

    useImperativeHandle(ref, () => ({
        setMood: (m) => setMood(m),
        setDensity: () => { }, // No-op for CSS orb
        toggleMicrophone: async (enabled) => {
            // Simplified mic handling or visual only
        },
        triggerSpeech: (text) => {
            const utterance = new SpeechSynthesisUtterance(text);
            // Try to find a robotic voice
            const voices = window.speechSynthesis.getVoices();
            const robotVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Robot')) || voices[0];
            if (robotVoice) utterance.voice = robotVoice;

            utterance.pitch = 0.8;
            utterance.rate = 1.1;

            const originalMood = mood;
            setMood('thinking');
            setIsSpeaking(true);

            utterance.onend = () => {
                setMood(originalMood);
                setIsSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        }
    }));

    // Mood styles
    const getMoodStyles = () => {
        switch (mood) {
            case 'angry':
                return 'shadow-[0_0_60px_rgba(255,0,0,0.6)] bg-red-500 border-red-400';
            case 'happy':
                return 'shadow-[0_0_60px_rgba(0,255,100,0.6)] bg-green-400 border-green-300';
            case 'thinking':
                return 'shadow-[0_0_60px_rgba(180,0,255,0.6)] bg-purple-500 border-purple-400 animate-pulse';
            case 'neutral':
            default:
                return 'shadow-[0_0_60px_rgba(0,240,255,0.6)] bg-accent-cyan border-accent-cyan';
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center relative">
            {/* Core Orb */}
            <div className={`
                w-32 h-32 rounded-full border-4 transition-all duration-500 relative z-10
                ${getMoodStyles()}
                ${isSpeaking ? 'animate-bounce' : 'animate-[float_6s_ease-in-out_infinite]'}
            `}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/80 to-transparent opacity-50 blur-sm"></div>
            </div>

            {/* Outer Rings */}
            <div className={`absolute w-48 h-48 rounded-full border border-current opacity-30 animate-[spin_10s_linear_infinite] ${mood === 'angry' ? 'text-red-500' : 'text-accent-cyan'}`}></div>
            <div className={`absolute w-64 h-64 rounded-full border border-dashed border-current opacity-20 animate-[spin_15s_linear_infinite_reverse] ${mood === 'angry' ? 'text-red-500' : 'text-accent-cyan'}`}></div>
        </div>
    );
});
