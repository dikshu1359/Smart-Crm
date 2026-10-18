import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const isCloudEnv = Boolean(process.env.K_SERVICE || process.env.AIS_APPLET_ID);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // Configure clientPort: 443 for Cloud Run / preview environments where SSL terminates at 443,
      // avoiding WebSocket closed without opened when client defaults to port 24678/3000.
      hmr: {
        clientPort: isCloudEnv ? 443 : 3000,
      },
    },
  };
});
