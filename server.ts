import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables (.env first, then fallback to .env.example)
dotenv.config();
if (!process.env.MONGODB_URI && fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
}

import app from './backend/server.js';
import { setupWebSocketServer } from './backend/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const httpServer = http.createServer(app);

  // Setup application WebSocket server for real-time messaging, WebRTC signaling, and calls on /ws
  setupWebSocketServer(httpServer);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Intercept any unhandled /api requests so Vite never returns index.html for API calls
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({
          error: 'EndpointNotFound',
          message: `API route ${req.method} ${req.originalUrl} not found.`,
        });
      }
      next();
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`EduSync CRM full-stack application running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Full-Stack Server] Startup error:', err);
  process.exit(1);
});
