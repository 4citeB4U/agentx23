/**
 * Agent Lee — Telephony Bridge
 * Layer 34: TelephonyBridge | LEEWAY-CORE-2026
 *
 * Receives inbound calls (Twilio webhook or SIP) and orchestrates:
 * 1. Whisper STT transcription
 * 2. Intent routing through ResearchFirstGate
 * 3. TTS response via VoiceStateMachine
 * 4. Call transcript storage in InsForge `call_transcripts` table
 */

import { createClient } from '@insforge/sdk';
import { Router, Request, Response } from 'express';
import type { RequestHandler } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Whisper STT ────────────────────────────────────────────────────────────
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    // Use whisper CLI: pip install openai-whisper
    const { stdout } = await execFileAsync('whisper', [
      audioPath,
      '--model', process.env.WHISPER_MODEL || 'base.en',
      '--output_format', 'txt',
      '--output_dir', '/tmp',
      '--language', 'en',
    ], { timeout: 60000 });

    const txtPath = audioPath.replace(/\.[^.]+$/, '.txt');
    if (fs.existsSync(txtPath)) {
      return fs.readFileSync(txtPath, 'utf8').trim();
    }
    return stdout?.trim() || '';
  } catch (e) {
    console.error('[TelephonyBridge] Whisper STT failed:', e);
    return '';
  }
}

// ── Twilio TwiML Helper ───────────────────────────────────────────────────
function buildTwiML(message: string): string {
  const voice = process.env.TWILIO_VOICE || 'Polly.Matthew-Neural';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Say>
  <Pause length="1"/>
</Response>`;
}

// ── Store Transcript to InsForge ──────────────────────────────────────────
async function storeTranscript(data: {
  caller:           string;
  call_sid?:        string;
  transcript:       string;
  agent_response:   string;
  tasks_extracted:  string[];
  duration_sec?:    number;
  disposition?:     string;
}): Promise<void> {
  await insforge.database.from('call_transcripts').insert([{
    caller:          data.caller,
    call_sid:        data.call_sid,
    transcript:      data.transcript,
    agent_response:  data.agent_response,
    tasks_extracted: data.tasks_extracted,
    duration_sec:    data.duration_sec || 0,
    disposition:     data.disposition || 'completed',
    success:         true,
  }]).select();
}

// ── Express Router ────────────────────────────────────────────────────────
export const telephonyRouter = Router();

// Twilio webhook — inbound call
const handleInboundCall: RequestHandler = async (req, res) => {
  const caller = req.body?.From || req.query?.From || 'unknown';
  const callSid = req.body?.CallSid || req.query?.CallSid;

  console.log(`[TelephonyBridge] Inbound call from ${caller}`);

  // Greet caller and gather speech
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Yo. You reached Agent Lee. How can I help you today?</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/telephony/voice" method="POST">
  </Gather>
</Response>`);
};
telephonyRouter.post('/inbound', handleInboundCall);

// Twilio webhook — voice input
const handleVoiceInput: RequestHandler = async (req, res) => {
  const speechResult = req.body?.SpeechResult || '';
  const caller       = req.body?.From        || 'unknown';
  const callSid      = req.body?.CallSid;

  console.log(`[TelephonyBridge] STT result: "${speechResult}"`);

  if (!speechResult) {
    res.set('Content-Type', 'text/xml');
    res.send(buildTwiML("I didn't catch that. Feel free to call back — I'll be here."));
    return;
  }

  // Route through backend chat endpoint for full Layer response
  let agentReply = '';
  try {
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch(`http://localhost:${process.env.BACKEND_PORT || 8001}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Neural-Handshake': process.env.NEURAL_HANDSHAKE || 'AGENT_LEE_SOVEREIGN_V1',
      },
      body: JSON.stringify({ message: speechResult, channel: 'phone', caller }),
    });
    const data = await resp.json() as { reply?: string };
    agentReply = data.reply || '';
  } catch (e) {
    console.error('[TelephonyBridge] Chat API failed:', e);
    agentReply = 'My systems hit a snag. Call me back and we will sort it out.';
  }

  // Extract simple task items mentioned (quick heuristic)
  const tasksExtracted = speechResult.match(/\b(call|schedule|research|check|send|find|order|book)\b[^,.]+/gi) || [];

  // Store transcript
  await storeTranscript({
    caller,
    call_sid:        callSid,
    transcript:      speechResult,
    agent_response:  agentReply,
    tasks_extracted: tasksExtracted,
    disposition:     'completed',
  });

  // Reply via TwiML (first 2 sentences to keep it natural)
  const spokenReply = agentReply.split(/[.!?]/).slice(0, 3).join('. ').trim();
  res.set('Content-Type', 'text/xml');
  res.send(buildTwiML(spokenReply || 'Got it. I will take care of that right away.'));
};
telephonyRouter.post('/voice', handleVoiceInput);

// Status callback
const handleStatus: RequestHandler = (req, res) => {
  console.log('[TelephonyBridge] Status:', req.body?.CallStatus, 'Duration:', req.body?.CallDuration);
  res.sendStatus(200);
};
telephonyRouter.post('/status', handleStatus);

// Health check
telephonyRouter.get('/health', (_req, res) => {
  res.json({ layer: 34, name: 'TelephonyBridge', status: 'online', standard: 'LEEWAY-CORE-2026' });
});
