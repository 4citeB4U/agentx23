import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Raspberry Pi / offline-safe production build config
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 8000,
        strictPort: false,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8001',
                changeOrigin: true
            }
        }
    },
    build: {
        // Pi: target modern browsers only — smaller output, no legacy polyfills
        target: 'es2020',
        // esbuild minifier is ~10x faster than terser, lower RAM use on Pi
        minify: 'esbuild',
        cssMinify: true,
        // No sourcemaps in prod — saves disk + RAM on Pi
        sourcemap: false,
        // Inline assets ≤ 4 KB to reduce round-trips
        assetsInlineLimit: 4096,
        // Warn at 800 KB per chunk
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Heavy 3-D lib in its own lazy chunk
                    'vendor-three': ['three'],
                    // Core UI framework
                    'vendor-react': ['react', 'react-dom'],
                    // Icon set
                    'vendor-icons': ['lucide-react'],
                    // Binary/storage helpers
                    'vendor-data': ['idb', 'jszip'],
                }
            }
        }
    }
});
