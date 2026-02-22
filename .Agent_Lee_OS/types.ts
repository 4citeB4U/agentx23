export enum Tab {
    COMMS = 'COMMS',
    MESSAGES = 'MESSAGES',
    LIVE = 'LIVE',
    PHONE = 'PHONE',
    FILES = 'FILES',
    CODE = 'CODE',
    SYSTEM = 'SYSTEM',
    TUNNEL = 'TUNNEL',
    TELEMETRY = 'TELEMETRY',
    APPS = 'APPS'
}

export type SystemMode = 'VS_CODE' | 'TERMINAL' | 'BROWSER' | 'AI_AGENT';

export type CoreShape = 'sphere' | 'house' | 'tree' | 'dna' | 'heart' | 'star' | 'teddy_bear';

export interface CoreConfig {
    shape: CoreShape;
    density: number;
    brightness: number;
    speed: number;
    autoMorphEnabled: boolean;
    morphSpeed: number;
}

export interface Message {
    id: string;
    sender: 'user' | 'agent' | 'system';
    text: string;
    timestamp: string;
    /** Origin channel: web, voice, telegram, or system */
    source?: 'web' | 'voice' | 'telegram' | 'system';
}

export interface AgentContact {
    id: string;
    name: string;
    role: string;
    status: 'online' | 'offline' | 'decryption_active';
    avatarColor: string;
    location?: string;
}

export interface SystemStatus {
    encryption: string;
    stability: number;
    battery: number;
    securityLevel: string;
    mode: SystemMode;
}
