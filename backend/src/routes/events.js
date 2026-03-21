const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');
const { checkEventLimit } = require('../middleware/planEnforcement');

/**
 * Generate a URL-safe slug from event name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50) + '-' + Date.now().toString(36);
}

/**
 * GET /api/events
 * List all events for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, name, slug, date, venue, status, created_at,
        photos(count)
      `)
      .eq('owner_id', req.user.id)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id
 * Get single event details — PUBLIC (booth needs this without a token)
 */
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

    let query = supabase.from('events').select('*');
    if (isUUID) {
      query = query.eq('id', param);
    } else {
      query = query.eq('slug', param);
    }

    const { data: event, error } = await query.single();
    if (error || !event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events
 * Create a new event
 */
router.post('/', requireAuth, checkEventLimit, async (req, res) => {
  try {
    const {
      name,
      date,
      venue,
      clientName,
      clientEmail,
      branding = {},
      settings = {},
    } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required' });
    }

    const eventId = uuidv4();
    const slug = generateSlug(name);

    // Default branding
    const defaultBranding = {
      eventName: name,
      primaryColor: '#1a1a2e',
      secondaryColor: '#ffffff',
      footerText: name,
      overlayText: '',
      showDate: true,
      template: 'classic',
      logoUrl: null,
      ...branding,
    };

    // Default settings
    const defaultSettings = {
      countdownSeconds: 3,
      photosPerSession: 1,
      allowRetakes: true,
      allowAI: true,
      allowGIF: true,
      allowBoomerang: true,
      allowPrint: true,
      printCopies: 1,
      aiStyles: ['anime', 'vintage', 'watercolor', 'cyberpunk', 'oilpainting', 'comic'],
      sessionTimeout: 60, // seconds before reset
      operatorPin: '',
      ...settings,
    };

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: eventId,
        name,
        slug,
        date,
        venue: venue || '',
        client_name: clientName || '',
        client_email: clientEmail || '',
        branding: defaultBranding,
        settings: defaultSettings,
        status: 'active',
        owner_id: req.user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/events/:id
 * Update event (branding, settings, etc.)
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: event, error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/events/:id
 * Archive an event (soft delete)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id/stats
 * Get analytics summary for an event
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [photosResult, analyticsResult] = await Promise.all([
      supabase.from('photos').select('mode, created_at').eq('event_id', id),
      supabase.from('analytics').select('action, created_at').eq('event_id', id),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];

    const stats = {
      totalPhotos: photos.filter((p) => p.mode === 'single').length,
      totalGIFs: photos.filter((p) => p.mode === 'gif').length,
      totalBoomerangs: photos.filter((p) => p.mode === 'boomerang').length,
      totalStrips: photos.filter((p) => p.mode === 'strip').length,
      totalAIGenerated: analytics.filter((a) => a.action === 'ai_generated').length,
      totalShares: analytics.filter((a) => a.action === 'photo_shared').length,
      totalPrints: analytics.filter((a) => a.action === 'photo_printed').length,
      totalSessions: new Set(photos.map((p) => p.session_id)).size,
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id/analytics
 * Return per-day breakdown for the last N days
 */
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [photosRes, analyticsRes] = await Promise.all([
      supabase.from('photos').select('mode, created_at').eq('event_id', id).gte('created_at', since),
      supabase.from('analytics').select('action, created_at').eq('event_id', id).gte('created_at', since),
    ]);

    // Build day-by-day buckets
    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      buckets[d] = { date: d, photos: 0, gifs: 0, boomerangs: 0, strips: 0, shares: 0, prints: 0 };
    }

    (photosRes.data || []).forEach((p) => {
      const d = p.created_at.slice(0, 10);
      if (!buckets[d]) return;
      if (p.mode === 'single') buckets[d].photos++;
      else if (p.mode === 'gif') buckets[d].gifs++;
      else if (p.mode === 'boomerang') buckets[d].boomerangs++;
      else if (p.mode === 'strip') buckets[d].strips++;
    });

    (analyticsRes.data || []).forEach((a) => {
      const d = a.created_at.slice(0, 10);
      if (!buckets[d]) return;
      if (a.action === 'photo_shared') buckets[d].shares++;
      if (a.action === 'photo_printed') buckets[d].prints++;
    });

    res.json({ rows: Object.values(buckets) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events/:id/webhook-test
 * Send a test payload to the event's configured webhook URL
 */
router.post('/:id/webhook-test', async (req, res) => {
  try {
    const { id } = req.params;
    const { url: overrideUrl } = req.body;

    const { data: event } = await supabase.from('events').select('id, name, settings').eq('id', id).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const webhookUrl = overrideUrl || event?.settings?.webhookUrl;
    if (!webhookUrl) return res.status(400).json({ error: 'No webhook URL configured' });

    const payload = JSON.stringify({
      trigger: 'webhook.test',
      event_id: event.id,
      event_name: event.name,
      message: 'This is a test webhook from SnapBooth AI 🎉',
      timestamp: new Date().toISOString(),
    });

    const headers = { 'Content-Type': 'application/json' };
    if (event?.settings?.webhookSecret) {
      const crypto = require('crypto');
      headers['X-SnapBooth-Signature'] = crypto
        .createHmac('sha256', event.settings.webhookSecret)
        .update(payload)
        .digest('hex');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(8000),
    });

    res.json({ success: response.ok, status: response.status });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/events/:id/qr
 * Return QR code data for a booth event (URL + slug for the booth link)
 */
router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event } = await supabase
      .from('events')
      .select('id, slug, name')
      .or(`id.eq.${id},slug.eq.${id}`)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const boothUrl = `${frontendUrl}/booth?event=${event.slug || event.id}`;
    const galleryUrl = `${frontendUrl}/gallery/${event.slug || event.id}`;

    res.json({ boothUrl, galleryUrl, slug: event.slug, name: event.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events/:id/upload-asset
 * Upload a branding asset (logo, frame, idle image) to R2.
 * Accepts multipart/form-data with field "file" and query param "type" (logo|frame|idle).
 * Returns { url } — the public R2 URL stored in event branding.
 */
const multer = require('multer');
const { uploadToStorage } = require('../services/storage');
const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/:id/upload-asset', requireAuth, assetUpload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const type = req.query.type || 'logo'; // logo | frame | idle
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `branding/${id}/${type}_${Date.now()}.${ext}`;
    const url = await uploadToStorage(req.file.buffer, key, req.file.mimetype);

    // Update the event's branding in DB
    const brandingField = type === 'logo' ? 'logoUrl' : type === 'frame' ? 'frameUrl' : 'idleImageUrl';
    const { data: event } = await supabase.from('events').select('branding').eq('id', id).single();
    const updatedBranding = { ...(event?.branding || {}), [brandingField]: url };
    await supabase.from('events').update({ branding: updatedBranding }).eq('id', id).eq('owner_id', req.user.id);

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
