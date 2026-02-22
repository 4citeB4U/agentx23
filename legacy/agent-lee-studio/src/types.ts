export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  encrypted?: boolean;
}

export interface AgentContact {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'busy' | 'decryption_active';
  avatarColor: string;
  location?: string;
}

export enum Tab {
  COMMS = 'COMMS',
  LIVE = 'LIVE',
  FILES = 'FILES',
  CODE = 'CODE',
  SYSTEM = 'SYSTEM'
}

export type SystemMode = 'VS_CODE' | 'ANTI_GRAVITY' | 'DUAL_LINK';

export type CoreShape = 'sphere' | 'house' | 'tree' | 'dna' | 'heart' | 'star';

export interface CoreConfig {
    shape: CoreShape;
    density: number;
    brightness: number;
    speed: number;
    autoMorphEnabled: boolean;
    morphSpeed: number;
}

export interface SystemStatus {
  encryption: 'AES-1024' | 'QUANTUM-256';
  stability: number;
  battery: number;
  securityLevel: 'STARK SECURE' | 'COMPROMISED';
  mode: SystemMode;
}