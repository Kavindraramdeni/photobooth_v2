require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ── Safe route loader ─────────────────────────────────────────────────────────
// Wraps each require() so a broken route file never crashes the whole server.
// If a route fails to load, that path returns 503 with the error message.
function safeRoute(name, path) {
  try {
    const mod = require(path);
    if (typeof mod !== 'function' && typeof mod.handle !== 'function') {
      throw new Error(`${name} did not export a router (got ${typeof mod})`);
    }
    console.log(`✅ Loaded route: ${name}`);
    return mod;
  } catch (err) {
    console.error(`❌ Failed to load route ${name}: ${err.message}`);
    // Return a fallback router that explains the error
    const fallback = express.Router();
    fallback.use((req, res) => {
      res.status(503).json({
        error: `Route /${name} failed to initialise`,
        detail: err.message,
      });
    });
    return fallback;
  }
}

app.use('/api/photos',    safeRoute('photos',    './routes/photos'));
app.use('/api/events',    safeRoute('events',    './routes/events'));
app.use('/api/ai',        safeRoute('ai',        './routes/ai'));
app.use('/api/analytics', safeRoute('analytics', './routes/analytics'));
app.use('/api/share',     safeRoute('share',     './routes/share'));
app.use('/api/leads',     safeRoute('leads',     './routes/leads'));
app.use('/api/billing',   safeRoute('billing',   './routes/billing'));
app.use('/api/gallery',   safeRoute('gallery',   './routes/gallery'));

app.get('/', (req, res) => res.json({ name: 'SnapBooth AI Backend', status: 'ok', version: '2.0.0' }));

app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }));

// Keep Render free tier awake (pings /health every 14 min)
if (process.env.RENDER) {
  const SELF = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  setInterval(() => fetch(`${SELF}/health`).catch(() => {}), 14 * 60 * 1000);
}

io.on('connection', (socket) => {
  socket.on('join-event', (eventId) => socket.join(`event-${eventId}`));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🚀 SnapBooth Backend running on port ${PORT}`));
