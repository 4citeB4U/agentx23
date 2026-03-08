// LEEWAY HEADER BLOCK
// File: .Agent_Lee_OS/types.ts
// Purpose: Type definitions for Agent Lee OS
// Security: LEEWAY-CORE-2026 compliant
// Performance: Sovereign type safety
// Discovery: Part of Agent Lee OS frontend
export enum Tab {
  COMMS = "COMMS",
  MESSAGES = "MESSAGES",
  LIVE = "LIVE",
  PHONE = "PHONE",
  FILES = "FILES",
  CODE = "CODE",
  SYSTEM = "SYSTEM",
  TUNNEL = "TUNNEL",
  TELEMETRY = "TELEMETRY",
  APPS = "APPS",
  VM = "VM",
}

export type SystemMode = "VS_CODE" | "TERMINAL" | "BROWSER" | "AI_AGENT";

// LEEWAY v12 HEADER
// File: .Agent_Lee_OS/types.ts
// Purpose: Canonical shape definitions for VoxelCore
// 16 Canonical Shapes
export type CoreShape =
  | "sphere"
  | "cube"
  | "torus"
  | "teddy_bear"
  | "giraffe"
  | "spaceship"
  | "corvette"
  | "heart"
  | "shield"
  | "crown"
  | "butterfly"
  | "lightning"
  | "lotus"
  | "icosahedron"
  | "helix"
  | "humanoid"
  | "house"
  | "tree"
  | "star";

export interface CoreConfig {
  shape: CoreShape;
  density: number;
  brightness: number;
  speed: number;
  autoMorphEnabled: boolean;
  morphSpeed: number;
  /** LEEWAY: Optional emotion for color-emotion mapping */
  emotion?: "anger" | "joy" | "focus" | "empathy" | string;
}

export interface Message {
  id: string;
  sender: "user" | "agent" | "system";
  text: string;
  timestamp: string;
  /** Origin channel: web, voice, telegram, or system */
  source?: "web" | "voice" | "telegram" | "system";
}

export interface AgentContact {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline" | "decryption_active";
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
