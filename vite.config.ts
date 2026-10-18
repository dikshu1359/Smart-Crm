import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

import http from 'http';
import { spawn } from 'child_process';

function backendServerPlugin() {
  let backendProcess: any = null;
  return {
    name: 'backend-server-runner',
    configureServer() {
      // Check if backend is already running on port 5001
      const req = http.get('http://127.0.0.1:5001/api/health', (res) => {
        if (res.statusCode === 200) {
          // Backend is already alive and running
          return;
        }
      });

      req.on('error', () => {
        // Backend not running on port 5001; spawn it
        if (!backendProcess) {
          try {
            backendProcess = spawn('node', ['backend/server.js'], {
              stdio: 'inherit',
              env: { ...process.env, BACKEND_PORT: '5001' },
            });
            backendProcess.on('error', (err: any) => {
              console.warn('[Vite Plugin] Backend spawn notice:', err.message);
            });
            process.on('exit', () => {
              if (backendProcess) backendProcess.kill();
            });
          } catch (err: any) {
            console.warn('[Vite Plugin] Could not spawn backend:', err.message);
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), backendServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
      },
    },
  };
});
