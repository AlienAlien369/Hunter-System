import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import questRoutes from './routes/quests.js';
import statsRoutes from './routes/stats.js';
import rankRoutes from './routes/rank.js';
import authRoutes from './routes/auth.js';
import nutritionRoutes from './routes/nutrition.js';
import activityRoutes from './routes/activity.js';
import { initDatabase } from './db.js';

// Load the project root .env (works regardless of CWD)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Allowed CORS origins
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://hunter-system.vercel.app',
  'https://hunter-system-kss0.onrender.com',
].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, same-origin, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(null, true); // Allow all in dev; tighten in production if needed
  },
  credentials: true, // Allow cookies to be sent
}));
app.use(cookieParser());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/rank', rankRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/activity', activityRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve frontend static files in production
const possibleFrontendPaths = [
  process.env.FRONTEND_DIST_PATH,                 // Explicit env var
  '/usr/share/nginx/html',                        // Docker production
  join(__dirname, '../../dist'),                    // Local dev: server/dist → ../../dist
].filter(Boolean) as string[];

// Debug: log which paths exist
for (const p of possibleFrontendPaths) {
  const indexPath = join(p, 'index.html');
  const exists = existsSync(indexPath);
  console.log(`Frontend path ${p}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  if (exists) {
    try {
      const files = readdirSync(p);
      console.log(`  Files: ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`);
    } catch {}
  }
}

const frontendPath = possibleFrontendPaths.find(p => existsSync(join(p, 'index.html')));
if (frontendPath) {
  app.use(express.static(frontendPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
  });
  console.log(`✅ Serving frontend from ${frontendPath}`);
} else {
  console.error('❌ No frontend dist found! Checked:', possibleFrontendPaths);
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Frontend not built. Set FRONTEND_DIST_PATH env var.' });
  });
}

async function main() {
  try {
    await initDatabase();
    console.log('Database connected successfully');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Auth endpoints: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
