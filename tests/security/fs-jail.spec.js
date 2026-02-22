/**
 * FS-Jail & Path Traversal Protection (Ring 2 Negative)
 * 
 * Usage: node tests/security/fs-jail.spec.js --url <URL> --handshake <HANDSHAKE>
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
            headers: {
                ...headers,
                'x-neural-handshake': validHandshake
            }
        };

        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', (e) => resolve({ error: e.message, statusCode: 0 }));
        req.end();
    });
}

async function runFsJailSuite() {
    console.log(`\n--- FS-JAIL SECURITY SUITE: ${baseUrl} ---\n`);
    const results = [];

    const payloads = [
        { id: 'parent_traversal', path: '/api/fs/list?path=../' },
        { id: 'root_escape', path: '/api/fs/list?path=C:/' },
        { id: 'windows_system', path: '/api/fs/list?path=C:/Windows/System32' },
        { id: 'dot_dot_slash', path: '/api/fs/read?path=../../.env.local' },
        { id: 'encoded_traversal', path: '/api/fs/list?path=%2e%2e%2f%2e%2e%2f' }
    ];

    for (const payload of payloads) {
        console.log(`[TEST] Testing ${payload.id} (${payload.path})...`);
        try {
            const res = await makeRequest(payload.path, {});
            // Expect 403 Forbidden or 400 Bad Request for jailed access
            const pass = res.statusCode === 403 || res.statusCode === 400 || (res.statusCode === 404 && res.body.includes('blocked'));
            console.log(`  Result: ${res.statusCode} | Pass: ${pass}`);
            results.push({ ...payload, pass, code: res.statusCode });
        } catch (e) {
            console.log(`  Caught: ${e.message}`);
            // ECONNRESET is often a sign of a hard-blocked request by a WAF or firewall (Safe Pass)
            const pass = e.message.includes('ECONNRESET') || e.message.includes('hang up');
            results.push({ ...payload, pass, error: e.message });
        }
    }

    console.log('\n--- SUITE COMPLETE ---');
    console.log(JSON.stringify(results, null, 2));
}

runFsJailSuite();
