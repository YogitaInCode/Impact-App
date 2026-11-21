import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { publicRouter } from './src/routes/public.ts';
import { coreRouter } from './src/routes/core.ts';
import { studentsRouter } from './src/routes/students.ts';
import { attendanceRouter } from './src/routes/attendance.ts';
import { financeRouter } from './src/routes/finance.ts';
import { systemRouter } from './src/routes/system.ts';
import { academicsRouter } from './src/routes/academics.ts';
import { lifecycleRouter } from './src/routes/lifecycle.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'IMPACT CAMPUS', timestamp: new Date().toISOString() });
  });

  // Public non-PII institutional route
  app.use('/api/public', publicRouter);

  // Authenticated & RBAC-enforced domain routes
  app.use('/api', coreRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/academics', academicsRouter);
  app.use('/api/lifecycle', lifecycleRouter);
  app.use('/api/system', systemRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IMPACT CAMPUS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
