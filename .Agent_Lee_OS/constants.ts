/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK._AGENT_LEE_OS_CONSTANTS_TS.MAIN_AGENT_LEE_OS_CONSTANTS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = constants module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\constants.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

import { AgentContact, Message, SystemStatus } from './types';

export const INITIAL_STATUS: SystemStatus = {
  encryption: 'AES-1024',
  stability: 99.8,
  battery: 87,
  securityLevel: 'STARK SECURE',
  mode: 'VS_CODE'
};

export const MOCK_CONTACTS: AgentContact[] = [
  {
    id: 'c1',
    name: 'P. POTTS',
    role: 'CEO // STARK IND.',
    status: 'decryption_active',
    avatarColor: 'bg-yellow-500',
    location: '042-MALIBU-RES'
  },
  {
    id: 'c2',
    name: 'S. ROGERS',
    role: 'AVNGR-01',
    status: 'offline',
    avatarColor: 'bg-blue-600',
    location: '[REDACTED] - 40.7128° N'
  },
  {
    id: 'c3',
    name: 'N. FURY',
    role: 'EYE-SKY',
    status: 'online',
    avatarColor: 'bg-gray-700',
    location: 'HELICARRIER-V3'
  }
];

export const BACKEND_URL = '';
export const NEURAL_HANDSHAKE_KEY = 'sovereign_shake_v1';

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender: 'system',
    text: 'SECURE HANDSHAKE ESTABLISHED',
    timestamp: '14:02:44'
  },
  {
    id: 'm2',
    sender: 'system',
    text: 'ROUTING THROUGH HONG KONG SUB-SERVER',
    timestamp: '14:02:45'
  },
  {
    id: 'm3',
    sender: 'agent',
    text: 'Tony, the board meeting is in 5 minutes. Where are you?',
    timestamp: '14:02:48'
  },
  {
    id: 'm4',
    sender: 'system',
    text: 'BIOMETRICS: NORMAL',
    timestamp: '14:02:48'
  }
];