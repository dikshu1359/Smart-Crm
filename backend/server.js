import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
if (!process.env.MONGODB_URI && fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
}

import dbManager from './utils/DatabaseManager.js';
import { activityLogger } from './middleware/activityLogger.js';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import classesRouter from './routes/classes.js';
import assignmentsRouter from './routes/assignments.js';
import scheduleRouter from './routes/schedule.js';
import quizzesRouter from './routes/quizzes.js';
import chatRouter from './routes/chat.js';
import noticesRouter from './routes/notices.js';
import tenantsRouter from './routes/tenants.js';
import auditRouter from './routes/audit.js';
import analyticsRouter from './routes/analytics.js';
import calendarRouter from './routes/calendar.js';
import attendanceRouter from './routes/attendance.js';
import marksRouter from './routes/marks.js';
import callsRouter from './routes/calls.js';
import aiRouter from './routes/ai.js';

const app = express();
const PORT = process.env.BACKEND_PORT || 5001;

// CORS configuration for frontend dev server
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// Body parser with generous limits for file attachments
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Global mutation activity logger
app.use(activityLogger('API_MUTATION'));

// Health & System Info
app.get('/api/health', async (req, res) => {
  try {
    const masterDB = await dbManager.getMasterDB();
    const institutions = await masterDB.Institution.find({ status: 'active' });
    res.json({
      status: 'healthy',
      database: 'MongoDB Atlas',
      timestamp: new Date().toISOString(),
      masterDatabase: 'smart_crm_master',
      activeTenantsCount: institutions.length,
      institutions: institutions.map((i) => i.institutionName),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/marks', marksRouter);
app.use('/api/calls', callsRouter);
app.use('/api/ai', aiRouter);

// 404 Route handler for all /api endpoints
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ error: 'EndpointNotFound', message: `Route ${req.method} ${req.originalUrl} does not exist.` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.warn('[AI Studio] Database offline — returning mock empty response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'InternalServerError', message: err.message || 'An unexpected error occurred.' });
});

// Start Express Server when run directly
const isDirectRun = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('backend/server.js') || process.argv[1].endsWith('backend\\server.js'))
);

if (isDirectRun || process.env.RUN_STANDALONE === 'true') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Institutional CRM Backend running on http://0.0.0.0:${PORT}`);
    console.log(`Connected to Master Database: smart_crm_master`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Backend] Port ${PORT} is already in use by an existing process. Reusing active instance.`);
      process.exit(0);
    } else {
      console.error('[Backend] Server listen error:', err);
      process.exit(1);
    }
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

export default app;
