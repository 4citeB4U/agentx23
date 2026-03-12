/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK._AGENT_LEE_OS_TYPES_TS.MAIN_AGENT_LEE_OS_TYPES.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = types module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\types.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

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
// 24 Canonical Shapes — includes Modern Spiritual, Ethnic, African American, Universal Symbols
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
  | "star"
  | "ankh"
  | "merkaba"
  | "thirdEye"
  | "infinity"
  | "crescent"
  | "sunburst"
  | "pyramid";

// ShapeType — used by AgentLee3D particle morphing system
export type ShapeType =
  | "ankh"
  | "lotus"
  | "merkaba"
  | "thirdEye"
  | "infinity"
  | "crescent"
  | "pyramid"
  | "sunburst";

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
