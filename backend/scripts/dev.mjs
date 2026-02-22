import { spawn } from 'child_process';

const requestedPort = Number(process.env.PORT || '8001');
let port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8001;

// Avoid the most common conflict: frontend/ngrok on 8000.
// If the user explicitly wants 8000, they can set FORCE_PORT=1.
if (port === 8000 && process.env.FORCE_PORT !== '1') {
  console.warn('[backend:dev] PORT=8000 detected; switching to PORT=8001 to avoid frontend port conflicts. Set FORCE_PORT=1 to override.');
  port = 8001;
}

process.env.PORT = String(port);

// Keep websocket separate from HTTP.
if (!process.env.WS_PORT) {
  process.env.WS_PORT = '8003';
}

const child = spawn(
  'tsx',
  ['watch', 'src/index.ts'],
  {
    stdio: 'inherit',
    shell: true,
    env: process.env
  }
);

child.on('exit', (code) => process.exit(code ?? 1));
