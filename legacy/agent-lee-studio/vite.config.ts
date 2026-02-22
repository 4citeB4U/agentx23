import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const vitePort = Number(env.VITE_PORT || 8000);
  const backendPort = Number(env.VITE_BACKEND_PORT || env.VITE_API_PORT || 8001);
  return {
    server: {
      port: Number.isNaN(vitePort) ? 8000 : vitePort,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${Number.isNaN(backendPort) ? 8001 : backendPort}`,
          changeOrigin: true,
          secure: false
        }
      },
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
    },
    plugins: [react(), tailwindcss()],
    define: {
      global: 'window',
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-3d-core': ['three'],
            'vendor-3d-controls': ['three/examples/jsm/controls/OrbitControls'],
            'vendor-3d-postprocessing': ['three/examples/jsm/postprocessing/EffectComposer', 'three/examples/jsm/postprocessing/RenderPass', 'three/examples/jsm/postprocessing/UnrealBloomPass'],
            'vendor-ui': ['lucide-react'],
            'vendor-data': ['idb', 'jszip']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        process: "process/browser",
        stream: "stream-browserify",
        zlib: "browserify-zlib",
        util: "util",
        buffer: "buffer",
        crypto: "crypto-browserify",
      }
    }
  };
});
