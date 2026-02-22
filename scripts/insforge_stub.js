#!/usr/bin/env node
// InsForge Stub — satisfies @insforge/mcp health-check on localhost:7130
// @insforge/mcp checks GET http://localhost:7130/api/health before starting.
// This stub answers 200 OK so the MCP can initialize.

import http from 'http';

const PORT = Number(process.env.INSFORGE_STUB_PORT || 7130);

const ROUTES = {
  '/api/health': { status: 'ok', service: 'insforge-stub', version: '1.0.0' },
  '/health':     { status: 'ok', service: 'insforge-stub', version: '1.0.0' },
  '/':           { status: 'ok', service: 'insforge-stub', note: 'stub backend for @insforge/mcp' }
};

const server = http.createServer((req, res) => {
  const body = ROUTES[req.url] || { status: 'ok' };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[insforge-stub] Health stub listening on http://127.0.0.1:${PORT}`);
  console.log(`[insforge-stub] @insforge/mcp health-check route: GET /api/health -> 200 OK`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[insforge-stub] Port ${PORT} already in use — assuming real InsForge is running`);
    process.exit(0);
  }
  console.error('[insforge-stub] Error:', err.message);
  process.exit(1);
});

// Keep alive
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
