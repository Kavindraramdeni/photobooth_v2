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
const routeStatus = {};
function safeRoute(name, path) {
  try {
    const mod = require(path);
    if (typeof mod !== 'function' && typeof mod.handle !== 'function') {
      const keys = Object.keys(mod || {});
      throw new Error(`${name} did not export a router (got ${typeof mod}, keys: [${keys.join(', ')}])`);
    }
    console.log(`✅ Loaded route: ${name}`);
    routeStatus[name] = 'ok';
    return mod;
  } catch (err) {
    const msg = err.message;
    console.error(`❌ Failed to load route ${name}: ${msg}`);
    routeStatus[name] = { error: msg };
    const fallback = express.Router();
    fallback.use((req, res) => res.status(503).json({ error: `Route /${name} failed`, detail: msg }));
    return fallback;
  }
}

app.use('/api/photos',    safeRoute('photos',    './routes/photos'));
app.use('/api/photos/share', safeRoute('share', './routes/share')); // alias for frontend calls
app.use('/api/events',    safeRoute('events',    './routes/events'));
app.use('/api/auth',      safeRoute('auth',      './routes/auth'));
app.use('/api/ai',        safeRoute('ai',        './routes/ai'));
app.use('/api/analytics', safeRoute('analytics', './routes/analytics'));
app.use('/api/share',     safeRoute('share',     './routes/share'));
app.use('/api/leads',     safeRoute('leads',     './routes/leads'));
app.use('/api/billing',   safeRoute('billing',   './routes/billing'));
app.use('/api/gallery',   safeRoute('gallery',   './routes/gallery'));

app.get('/', (req, res) => res.json({ name: 'SnapBooth AI Backend', status: 'ok', version: '2.0.0' }));

app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }));

// Debug endpoint — shows which routes loaded OK vs failed
app.get('/debug/routes', (req, res) => res.json(routeStatus));

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

// ─── Auto-seed demo event on startup ─────────────────────────────────────────
async function seedDemoEvent() {
  try {
    const supabase = require('./services/database');
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('slug', 'snapbooth-demo')
      .single();

    if (existing) return;

    await supabase.from('events').insert({
      name: 'SnapBooth Live Demo',
      slug: 'snapbooth-demo',
      date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Live Demo',
      status: 'active',
      branding: {
        primaryColor: '#7c3aed',
        eventName: 'SnapBooth Demo',
        overlayText: '✨ Powered by SnapBooth AI',
      },
      settings: {
        operatorPin: '',
        allowAI: true,
        allowGIF: true,
        allowBoomerang: true,
        allowStrip: false,
        allowPrint: false,
        allowRetakes: true,
        leadCapture: false,
        autoGallery: true,
        modes: ['single', 'gif', 'boomerang'],
        countdownSeconds: 3,
      },
    });
    console.log('🌱 Demo event created (slug: snapbooth-demo)');
  } catch (e) {
    console.warn('⚠️  Could not seed demo event:', e.message);
  }
}

seedDemoEvent();
