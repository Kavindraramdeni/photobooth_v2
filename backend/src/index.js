require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const photoRoutes = require('./routes/photos');
const eventRoutes = require('./routes/events');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const shareRoutes = require('./routes/share');
const { ensureBucketExists } = require('./services/storage');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Open CORS - allow all Vercel URLs + localhost
app.use(cors({
  origin: function (origin, callback) {
    return callback(null, true); // Allow all origins (tighten after go-live)
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.use('/api/photos', photoRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/share', shareRoutes);

// Root route - fixes "Cannot GET /"
app.get('/', (req, res) => {
  res.json({ name: 'SnapBooth AI Backend', status: 'ok', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  socket.on('join-event', (eventId) => socket.join(`event-${eventId}`));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await ensureBucketExists();
    httpServer.listen(PORT, () => {
      console.log(`🚀 SnapBooth Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
