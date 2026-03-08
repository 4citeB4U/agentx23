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
