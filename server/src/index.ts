import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import questionRoutes from './routes/questions.routes';
import examRoutes from './routes/exams.routes';
import attemptRoutes from './routes/attempts.routes';
import violationRoutes from './routes/violations.routes';
import { startScheduler } from './services/scheduler';

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'exam-shield' }));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/violations', violationRoutes);

// Serve captured proctoring evidence (proctors review via dashboard).
app.use('/captures', express.static(path.resolve(process.cwd(), config.captureDir)));

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Exam Shield API listening on http://localhost:${config.port}`);
  startScheduler();
});
