/**
 * Voice Integrity & Latency Audit (Ring 2 / Ring 1)
 * 
 * Usage: node tests/security/voice-integrity.spec.js --url <URL> --handshake <HANDSHAKE>
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const args = process.argv.slice(2);
const baseUrl = args[args.indexOf('--url') + 1] || 'http://localhost:8001';
const validHandshake = args[args.indexOf('--handshake') + 1] || 'AGENT_LEE_SOVEREIGN_V1';

async function makePostRequest(path, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(baseUrl + path);
        const dataStr = JSON.stringify(body);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'x-neural-handshake': validHandshake,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(dataStr)
            }
        };

        const start = Date.now();
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const latency = Date.now() - start;
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(data),
                    latency
                });
            });
        });

        req.on('error', (e) => resolve({ error: e.message, statusCode: 0 }));
        req.write(dataStr);
        req.end();
    });
}

async function runVoiceSuite() {
    console.log(`\n--- VOICE INTEGRITY SUITE: ${baseUrl} ---\n`);
    const results = [];

    // 1. Direct TTS Generation
    console.log('[TEST] Direct TTS Generation (Short)...');
    try {
        const res = await makePostRequest('/api/chat/tts', { text: 'System check active.' });
        const hasAudio = res.statusCode === 200 && (res.headers['content-type'] === 'audio/mpeg' || res.headers['content-type'] === 'audio/wav');
        const sizeOk = res.body.length > 1000;
        const pass = hasAudio && sizeOk;

        console.log(`  Result: ${res.statusCode} | Content: ${res.headers['content-type']} | Size: ${res.body.length} | Latency: ${res.latency}ms | Pass: ${pass}`);
        results.push({ id: 'direct_tts', pass, latency: res.latency, size: res.body.length });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
    }

    // 2. Persona Chat with Voice Trigger
    console.log('[TEST] Chat with Persona & Voice Bridge...');
    try {
        const res = await makePostRequest('/api/chat', {
            text: 'Say "Voice check pass" briefly.',
            source: 'voice'
        });

        // Chat should return metadata including voice_state
        const bodyObj = JSON.parse(res.body.toString());
        const hasVoiceRef = bodyObj.voice_url || bodyObj.voice_state;
        const pass = res.statusCode === 200 && hasVoiceRef;

        console.log(`  Result: ${res.statusCode} | VoiceState: ${bodyObj.voice_state || 'none'} | Pass: ${pass}`);
        results.push({ id: 'chat_voice_bridge', pass, status: res.statusCode });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
    }

    console.log('\n--- SUITE COMPLETE ---');
    console.log(JSON.stringify(results, null, 2));
}

runVoiceSuite();
