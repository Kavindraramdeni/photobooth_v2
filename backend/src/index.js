require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const photoRoutes    = require('./routes/photos');
const eventRoutes    = require('./routes/events');
const aiRoutes       = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const shareRoutes    = require('./routes/share');
const leadsRoutes    = require('./routes/leads');
const billingRoutes  = require('./routes/billing');
// storage.js exports: uploadToStorage, getSignedDownloadUrl, deleteFromStorage

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: function (origin, callback) { return callback(null, true); },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Stripe webhook needs raw body — mount BEFORE json middleware for that route
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.use('/api/photos',    photoRoutes);
app.use('/api/events',    eventRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/share',     shareRoutes);
app.use('/api/leads',     leadsRoutes);
app.use('/api/billing',   billingRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'SnapBooth AI Backend', status: 'ok', version: '2.0.0' });
});

// Health check — also used by keep-alive pings
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// Keep-alive self-ping every 14 minutes to prevent Render free-tier sleep
// Only runs in production
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`;
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/health`);
      console.log('[keep-alive] pinged');
    } catch (e) {
      console.warn('[keep-alive] ping failed:', e.message);
    }
  }, 14 * 60 * 1000); // every 14 min
}

io.on('connection', (socket) => {
  socket.on('join-event', (eventId) => socket.join(`event-${eventId}`));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  httpServer.listen(PORT, () => {
    console.log(`🚀 SnapBooth Backend running on port ${PORT}`);
  });
}

start();
