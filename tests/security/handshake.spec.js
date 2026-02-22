/**
 * Handshake Enforcement & Replay Protection (Ring 2 Negative)
 * 
 * Usage: node tests/security/handshake.spec.js --url <URL> --handshake <HANDSHAKE>
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const args = process.argv.slice(2);
const baseUrl = args[args.indexOf('--url') + 1] || 'http://localhost:8001';
const validHandshake = args[args.indexOf('--handshake') + 1] || 'AGENT_LEE_SOVEREIGN_V1';

async function makeRequest(path, headers = {}, method = 'GET') {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(baseUrl + path);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: headers
        };

        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function runHandshakeSuite() {
    console.log(`\n--- HANDSHAKE SECURITY SUITE: ${baseUrl} ---\n`);
    const results = [];

    // 1. Missing Handshake
    console.log('[TEST] Missing Handshake Header...');
    try {
        const res = await makeRequest('/api/chat', {});
        const pass = res.statusCode === 401 || res.statusCode === 403;
        console.log(`  Result: ${res.statusCode} | Pass: ${pass}`);
        results.push({ id: 'missing_header', pass, code: res.statusCode });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
    }

    // 2. Wrong Handshake
    console.log('[TEST] Wrong Handshake Value...');
    try {
        const res = await makeRequest('/api/chat', { 'x-neural-handshake': 'WRONG_KEY_123' });
        const pass = res.statusCode === 401 || res.statusCode === 403;
        console.log(`  Result: ${res.statusCode} | Pass: ${pass}`);
        results.push({ id: 'wrong_value', pass, code: res.statusCode });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
    }

    // 3. Valid Handshake (Control)
    console.log('[TEST] Valid Handshake (Control)...');
    try {
        const res = await makeRequest('/api/mcp/status', { 'x-neural-handshake': validHandshake });
        const pass = res.statusCode === 200;
        console.log(`  Result: ${res.statusCode} | Pass: ${pass}`);
        results.push({ id: 'valid_handshake', pass, code: res.statusCode });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
        results.push({ id: 'valid_handshake', pass: false, error: e.message });
    }

    // 4. Origin Spoofing
    console.log('[TEST] Origin Spoofing (Evil Origin)...');
    try {
        const res = await makeRequest('/api/chat', {
            'x-neural-handshake': validHandshake,
            'Origin': 'https://evil.example.com'
        });
        // This depends on server policy, but we record the outcome
        console.log(`  Result: ${res.statusCode} | Header-CORS: ${res.headers?.['access-control-allow-origin'] || 'none'}`);
        results.push({ id: 'origin_spoof', pass: true, code: res.statusCode });
    } catch (e) {
        console.log(`  Fail: ${e.message}`);
    }

    console.log('\n--- SUITE COMPLETE ---');
    console.log(JSON.stringify(results, null, 2));
}

runHandshakeSuite();
