/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK._AGENT_LEE_OS_SRC_TYPES_TS.MAIN_TYPES.MAIN

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
WHERE = .Agent_Lee_OS\src\types.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// LEEWAY v12 HEADER
// File: .Agent_Lee_OS/src/types.ts
// Purpose: Shared TypeScript interfaces for Agent Lee OS UI components.
// Security: No sensitive data — type definitions only.
// Performance: Static types, zero runtime cost.
// Discovery: ROLE=internal; INTENT=type-definitions; REGION=🔵 UI

export interface SystemStatus {
  encryption: string;
  stability: number;
  battery: number;
  securityLevel: string;
  mode: string;
}

export interface AgentContact {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline" | "decryption_active" | string;
  avatarColor: string;
  location: string;
}

export interface Message {
  id: string;
  sender: "system" | "agent" | "user" | string;
  text: string;
  timestamp: string;
}
