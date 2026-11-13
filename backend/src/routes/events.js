const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');
const { deleteFromStorage } = require('../services/storage');

const { signToken, verifyToken } = require('../utils/token');

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
 * List all events for the authenticated owner
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
 * Get single event details.
 * If authenticated owner, returns full record.
 * If public / kiosk guest, returns sanitized public DTO without credentials.
 */
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    let event = null;

    const bySlug = await supabase.from('events').select('*').eq('slug', param).maybeSingle();
    if (bySlug.data) {
      event = bySlug.data;
    } else {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
      if (isUUID) {
        const byId = await supabase.from('events').select('*').eq('id', param).maybeSingle();
        if (byId.data) event = byId.data;
      }
    }

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if the request is from the event owner
    let isOwner = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user && event.owner_id && user.id === event.owner_id) {
        isOwner = true;
      }
    }

    const durationSeconds = 7 * 24 * 3600;
    const boothToken = (event.status !== 'archived') ? signToken({
      role: 'booth',
      eventId: event.id,
      sub: `booth:${event.id}`,
    }, durationSeconds) : undefined;

    // Owner gets full record
    if (isOwner) {
      return res.json({ event: { ...event, boothToken }, boothToken });
    }

    // Public / Booth caller: sanitize sensitive credentials
    const safeSettings = { ...(event.settings || {}) };
    delete safeSettings.operatorPin;
    delete safeSettings.webhookSecret;
    const hasPassword = !!(event.gallery_password || safeSettings.galleryPassword);
    delete safeSettings.galleryPassword;

    const publicEvent = {
      id: event.id,
      name: event.name,
      slug: event.slug,
      date: event.date,
      venue: event.venue,
      status: event.status,
      branding: event.branding,
      settings: safeSettings,
      hasGalleryPassword: hasPassword,
      created_at: event.created_at,
      boothToken,
    };

    res.json({ event: publicEvent, boothToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events
 * Create a new event (Authenticated owner only)
 */
router.post('/', requireAuth, async (req, res) => {
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
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

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
      sessionTimeout: 60,
      operatorPin: settings.operatorPin && settings.operatorPin !== '1234' ? settings.operatorPin : randomPin,
      ...settings,
    };

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        id: eventId,
        owner_id: req.user.id,
        name,
        slug,
        date,
        venue: venue || '',
        client_name: clientName || '',
        client_email: clientEmail || '',
        branding: defaultBranding,
        settings: defaultSettings,
        operator_pin: defaultSettings.operatorPin,
        status: 'active',
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
 * Update event (Authenticated owner only)
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, venue, clientName, clientEmail, branding, settings, status, gallery_password, operator_pin } = req.body;

    // Strict allowlist — forbid changing owner_id, id, created_at
    const safeUpdates = {
      ...(name && { name }),
      ...(date && { date }),
      ...(venue !== undefined && { venue }),
      ...(clientName !== undefined && { client_name: clientName }),
      ...(clientEmail !== undefined && { client_email: clientEmail }),
      ...(branding && { branding }),
      ...(settings && { settings }),
      ...(status && { status }),
      ...(gallery_password !== undefined && { gallery_password }),
      ...((operator_pin !== undefined || settings?.operatorPin !== undefined) && {
        operator_pin: String(operator_pin !== undefined ? operator_pin : settings.operatorPin),
      }),
      updated_at: new Date().toISOString(),
    };

    const { data: event, error } = await supabase
      .from('events')
      .update(safeUpdates)
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .select()
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    // Broadcast event-updated with sanitized settings and branding to Socket.IO room event-${id}
    const io = req.app.get('io');
    if (io) {
      const safeBroadcastSettings = { ...(event.settings || {}) };
      delete safeBroadcastSettings.operatorPin;
      delete safeBroadcastSettings.webhookSecret;
      delete safeBroadcastSettings.galleryPassword;

      io.to(`event-${id}`).emit('event-updated', {
        type: 'event-updated',
        branding: event.branding,
        settings: safeBroadcastSettings,
      });
    }

    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/events/:id
 * Archive an event (Authenticated owner only)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error, count } = await supabase
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error || count === 0) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Middleware: verify the authenticated user is the owner of the event
 */
async function requireEventOwner(req, res, next) {
  try {
    const eventId = req.params.id;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    const { data: event, error } = await supabase
      .from('events')
      .select('id, owner_id')
      .eq('id', eventId)
      .maybeSingle();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    req.event = event;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/events/:id/operator-login
 * Authenticate operator via PIN and issue scoped operator token
 */
router.post('/:id/operator-login', async (req, res) => {
  try {
    const { pin } = req.body;
    const { id } = req.params;

    if (!pin) {
      return res.status(401).json({ error: 'Invalid operator PIN' });
    }

    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, slug, status, settings, branding, operator_pin')
      .eq('id', id)
      .maybeSingle();

    if (error || !event) {
      return res.status(401).json({ error: 'Invalid operator PIN' });
    }

    const expectedPin = String(event.operator_pin || event.settings?.operatorPin || '').trim();
    if (!expectedPin) {
      return res.status(401).json({ error: 'Invalid operator PIN' });
    }

    const inputPin = String(pin).trim();
    const hashExpected = crypto.createHash('sha256').update(expectedPin).digest();
    const hashProvided = crypto.createHash('sha256').update(inputPin).digest();

    if (!crypto.timingSafeEqual(hashExpected, hashProvided)) {
      return res.status(401).json({ error: 'Invalid operator PIN' });
    }

    const durationSeconds = 12 * 3600;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const token = signToken({
      role: 'operator',
      eventId: event.id,
      sub: `operator:${event.id}`,
    }, durationSeconds);

    res.json({
      token,
      operator: {
        role: 'operator',
        eventId: event.id,
        expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/booth-session
 * Issue scoped booth session token for photo/media uploads (Owner or Operator JWT)
 */
router.post(['/:id/booth-session', '/:id/booth-token'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, slug, status, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ error: 'Event is not active' });
    }

    const isOwner = req.user.id === event.owner_id;
    const isOperator = req.user.role === 'operator' && req.user.eventId === event.id;

    if (!isOwner && !isOperator) {
      return res.status(403).json({ error: 'Access denied: not authorized for this event' });
    }

    const durationSeconds = 24 * 3600;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const sessionToken = signToken({
      role: 'booth',
      eventId: event.id,
      sub: `booth:${event.id}`,
    }, durationSeconds);

    res.json({
      sessionToken,
      boothToken: sessionToken,
      eventId: event.id,
      expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/events/:id/staff
 * List staff members for an event (Owner only)
 */
router.get('/:id/staff', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: event } = await supabase
      .from('events')
      .select('settings')
      .eq('id', id)
      .single();

    let staff = event?.settings?.staff || [];
    try {
      const { data: dbStaff } = await supabase
        .from('event_staff')
        .select('*')
        .eq('event_id', id);
      if (dbStaff && dbStaff.length > 0) {
        staff = dbStaff;
      }
    } catch { /* ignore if table not present */ }

    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/staff
 * Add staff member to an event (Owner only)
 */
router.post('/:id/staff', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role = 'operator', name = '' } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const { data: event } = await supabase
      .from('events')
      .select('settings')
      .eq('id', id)
      .single();

    const currentSettings = event?.settings || {};
    const existingStaff = currentSettings.staff || [];
    const newStaff = {
      id: uuidv4(),
      eventId: id,
      email: email.trim().toLowerCase(),
      role: ['operator', 'moderator', 'assistant'].includes(role) ? role : 'operator',
      name: name.trim(),
      created_at: new Date().toISOString(),
    };

    const updatedStaff = [...existingStaff.filter(s => s.email !== newStaff.email), newStaff];

    const { error: updateError } = await supabase
      .from('events')
      .update({
        settings: { ...currentSettings, staff: updatedStaff },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    try {
      await supabase.from('event_staff').upsert({
        event_id: id,
        email: newStaff.email,
        role: newStaff.role,
      });
    } catch { /* ignore if table not present */ }

    res.status(201).json({ success: true, staff: newStaff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/gallery-auth
 * Verify password for a protected gallery
 */
router.post('/:id/gallery-auth', async (req, res) => {
  try {
    const { password } = req.body;
    const { id } = req.params;

    const { data: event } = await supabase
      .from('events')
      .select('gallery_password, settings')
      .eq('id', id)
      .maybeSingle();

    if (!event) return res.status(404).json({ ok: false, error: 'Event not found' });

    const expectedPassword = event.gallery_password || event.settings?.galleryPassword;
    if (!expectedPassword || expectedPassword === password) {
      return res.json({ ok: true });
    }

    res.status(401).json({ ok: false, error: 'Incorrect password' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/events/:id/webhook-test
 * Dispatch test payload to webhook URL
 */
router.post('/:id/webhook-test', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) return res.status(400).json({ ok: false, error: 'webhookUrl required' });

    const testPayload = {
      event: 'test.ping',
      event_id: req.params.id,
      timestamp: new Date().toISOString(),
      message: 'Webhook configuration test successful',
    };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(6000),
    });

    res.json({ ok: resp.ok, status: resp.status });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/events/:id/stats
 * Get analytics summary for an event (Owner only)
 */
router.get('/:id/stats', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const [photosResult, analyticsResult] = await Promise.all([
      supabase.from('photos').select('mode, created_at').eq('event_id', id),
      supabase.from('analytics').select('action, created_at').eq('event_id', id),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];

    const stats = {
      totalPhotos: photos.length, // all photos regardless of mode
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


// ─── AI STYLES ROUTES ──────────────────────────────────────────────────────────

/**
 * GET /api/events/:id/styles
 * Public — booth fetches event-specific styles
 */
router.get('/:id/styles', async (req, res) => {
  try {
    const { data: styles, error } = await supabase
      .from('event_styles')
      .select('id, style_key, name, prompt, preview_image_url, emoji, sort_order')
      .eq('event_id', req.params.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ styles: styles || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/styles
 * Create a style for this event (Owner only)
 */
router.post('/:id/styles', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { name, prompt, emoji, preview_image_url, sort_order, style_key } = req.body;
    if (!name || !prompt) return res.status(400).json({ error: 'name and prompt required' });

    const key = style_key || name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) + '_' + Date.now().toString(36);

    const { data, error } = await supabase
      .from('event_styles')
      .insert({ event_id: req.params.id, style_key: key, name, prompt, emoji: emoji || '✨', preview_image_url: preview_image_url || null, sort_order: sort_order || 0, is_active: true })
      .select().single();

    if (error) throw error;
    res.json({ style: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/events/:id/styles/:styleId
 * Update event style (Owner only)
 */
router.put('/:id/styles/:styleId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { name, prompt, emoji, preview_image_url, sort_order, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (prompt !== undefined) updates.prompt = prompt;
    if (emoji !== undefined) updates.emoji = emoji;
    if (preview_image_url !== undefined) updates.preview_image_url = preview_image_url;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('event_styles')
      .update(updates)
      .eq('id', req.params.styleId)
      .eq('event_id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ style: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/events/:id/styles/:styleId
 * Delete event style (Owner only)
 */
router.delete('/:id/styles/:styleId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { error } = await supabase
      .from('event_styles')
      .delete()
      .eq('id', req.params.styleId)
      .eq('event_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/styles/:styleId/image
 * Receives multipart/form-data with field 'file'
 * Resizes to portrait 3:4, stores in R2, updates DB (Owner only)
 */
const multer = require('multer');
const sharp = require('sharp');
const { uploadToStorage } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post('/:id/styles/:styleId/image', requireAuth, requireEventOwner, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const processed = await sharp(req.file.buffer)
      .resize(400, 533, { fit: 'cover', position: 'entropy' })
      .jpeg({ quality: 88 })
      .toBuffer();

    const key = `events/${req.params.id}/styles/preview_${req.params.styleId}.jpg`;

    const url = await uploadToStorage(processed, key, 'image/jpeg');

    console.log("UPLOAD URL:", url);

    const { error } = await supabase
      .from('event_styles')
      .update({ preview_image_url: url })
      .eq('id', req.params.styleId)
      .eq('event_id', req.params.id);

    if (error) throw error;

    res.json({ success: true, url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
/**

 */

// ═══════════════════════════════════════════════════════════════════════════════


const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/events/:id/upload-asset?type=idle|logo|frame
 * 
 * Handles uploading:
 * - Idle screen background (type=idle) → stored in branding
 * - Event logo (type=logo) → stored in branding
 * - Frame overlay (type=frame) → stored in event_frames
 */
router.post('/:id/upload-asset', requireAuth, requireEventOwner, uploadAsset.single('file'), async (req, res) => {
  try {
    // Validate inputs
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetType = req.query.type; // 'idle', 'logo', or 'frame'
    
    if (!['idle', 'logo', 'frame'].includes(assetType)) {
      return res.status(400).json({ error: 'Invalid asset type. Must be: idle, logo, or frame' });
    }

    const eventId = req.params.id;

    // ─────────────────────────────────────────────────────────────────────────

    // CASE 1: IDLE SCREEN BACKGROUND
    if (assetType === 'idle') {
      const processed = await sharp(req.file.buffer)
        .resize(1920, 1080, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      const key = `events/${eventId}/idle-background.jpg`;
      const url = await uploadToStorage(processed, key, 'image/jpeg');

      // Save to branding.idleBackgroundUrl
      const { data: event, error: updateError } = await supabase
        .from('events')
        .select('branding')
        .eq('id', eventId)
        .single();

      if (updateError) throw updateError;

      const updatedBranding = {
        ...event.branding,
        idleBackgroundUrl: url,
      };

      const { error: brandingError } = await supabase
        .from('events')
        .update({ branding: updatedBranding })
        .eq('id', eventId);

      if (brandingError) throw brandingError;

      console.log(`[Upload] Idle background: ${url}`);
      return res.json({ success: true, url, type: 'idle' });
    }

    // ─────────────────────────────────────────────────────────────────────────

    // CASE 2: LOGO
    if (assetType === 'logo') {
      // Keep as PNG for transparency
      const processed = await sharp(req.file.buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 95 })
        .toBuffer();

      const key = `events/${eventId}/logo.png`;
      const url = await uploadToStorage(processed, key, 'image/png');

      // Save to branding.logoUrl
      const { data: event, error: updateError } = await supabase
        .from('events')
        .select('branding')
        .eq('id', eventId)
        .single();

      if (updateError) throw updateError;

      const updatedBranding = {
        ...event.branding,
        logoUrl: url,
      };

      const { error: brandingError } = await supabase
        .from('events')
        .update({ branding: updatedBranding })
        .eq('id', eventId);

      if (brandingError) throw brandingError;

      console.log(`[Upload] Logo: ${url}`);
      return res.json({ success: true, url, type: 'logo' });
    }

    // ─────────────────────────────────────────────────────────────────────────

    // CASE 3: FRAME OVERLAY
    if (assetType === 'frame') {
      const frameName = req.body.name || `Frame ${Date.now()}`;

      // Keep as PNG for transparency on frame overlays
      const processed = await sharp(req.file.buffer)
        .png()
        .toBuffer();

      const frameId = require('crypto').randomUUID();
      const key = `events/${eventId}/frames/${frameId}.png`;
      const url = await uploadToStorage(processed, key, 'image/png');

      // Save to event_frames table
      const { data: frame, error: frameError } = await supabase
        .from('event_frames')
        .insert({
          id: frameId,
          event_id: eventId,
          name: frameName,
          url,
          is_active: true,
          is_default: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (frameError) throw frameError;

      console.log(`[Upload] Frame: ${url}`);
      return res.json({ success: true, url, type: 'frame', frame });
    }

  } catch (error) {
    console.error(`[Upload] Error (${req.query.type}):`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DELETE /api/events/:id/frames/:frameId
 * Delete a frame overlay (Owner only)
 */
router.delete('/:id/frames/:frameId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { data: frame } = await supabase
      .from('event_frames')
      .select('url')
      .eq('id', req.params.frameId)
      .eq('event_id', req.params.id)
      .single();

    if (frame?.url) {
      try {
        let storageKey = frame.url;
        if (storageKey.includes('/events/')) {
          storageKey = storageKey.slice(storageKey.indexOf('events/'));
        } else if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
          try {
            const urlObj = new URL(storageKey);
            storageKey = urlObj.pathname.replace(/^\/storage\/v1\/object\/(?:public\/)?[^/]+\//, '').replace(/^\//, '');
          } catch { /* use as is */ }
        }
        await deleteFromStorage(storageKey);
      } catch { /* ignore storage errors */ }
    }

    await supabase
      .from('event_frames')
      .delete()
      .eq('id', req.params.frameId)
      .eq('event_id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FRAME OVERLAYS — store multiple PNG frames guests can apply during preview
 * ═════════════════════════════════════════════════════════════════════════════
 */
const _multer = require('multer');
const _upload = _multer({ storage: _multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * GET /api/events/:id/frames
 * Fetch all frames for an event
 */
router.get('/:id/frames', async (req, res) => {
  try {
    const { data: frames } = await supabase
      .from('event_frames')
      .select('*')
      .eq('event_id', req.params.id)
      .order('sort_order', { ascending: true });
    res.json({ frames: frames || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/frames
 * Add a new frame overlay (Owner only)
 */
router.post('/:id/frames', requireAuth, requireEventOwner, _upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Frame image required' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Frame name required' });

    const frameId = require('crypto').randomUUID();
    const key = `events/${req.params.id}/frames/${frameId}.png`;
    const url = await uploadToStorage(req.file.buffer, key, 'image/png');

    const { data: frame } = await supabase
      .from('event_frames')
      .insert({
        id: frameId,
        event_id: req.params.id,
        name,
        url,
        is_active: true,
        is_default: false,
      })
      .select()
      .single();

    res.json({ frame });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/events/:id/frames/:frameId
 * Update frame (toggle active, set default, etc.) (Owner only)
 */
router.patch('/:id/frames/:frameId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { isActive, isDefault } = req.body;
    const update = {};
    if (isActive !== undefined) update.is_active = isActive;
    if (isDefault !== undefined) {
      if (isDefault) {
        // Set this as default, unset all others for this event
        await supabase.from('event_frames')
          .update({ is_default: false })
          .eq('event_id', req.params.id);
      }
      update.is_default = isDefault;
    }

    const { data: frame } = await supabase
      .from('event_frames')
      .update(update)
      .eq('id', req.params.frameId)
      .eq('event_id', req.params.id)
      .select()
      .single();

    res.json({ frame });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/:id/frames/:frameId/default
 * Set as default overlay (Owner only)
 */
router.post('/:id/frames/:frameId/default', requireAuth, requireEventOwner, async (req, res) => {
  try {
    await supabase.from('event_frames')
      .update({ is_default: false })
      .eq('event_id', req.params.id);

    const { data: frame } = await supabase
      .from('event_frames')
      .update({ is_default: true })
      .eq('id', req.params.frameId)
      .eq('event_id', req.params.id)
      .select()
      .single();

    res.json({ frame });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Multi-Booth Kiosk Fleet Monitoring ──────────────────────────────────────
const kioskFleet = new Map();

/**
 * POST /api/events/:id/kiosks/heartbeat
 * Kiosk fleet heartbeat and telemetry
 */
router.post('/:id/kiosks/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      kioskId,
      kioskName = 'Kiosk Station',
      batteryLevel,
      isOnline = true,
      pendingQueue = 0,
      version = '2.0.0',
    } = req.body;

    if (!kioskId) return res.status(400).json({ error: 'kioskId required' });

    if (!kioskFleet.has(id)) {
      kioskFleet.set(id, new Map());
    }

    const eventKiosks = kioskFleet.get(id);
    const kioskData = {
      kioskId,
      kioskName,
      batteryLevel: batteryLevel !== undefined ? batteryLevel : null,
      isOnline,
      pendingQueue,
      version,
      lastHeartbeat: new Date().toISOString(),
    };
    eventKiosks.set(kioskId, kioskData);

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${id}`).emit('kiosk-heartbeat', kioskData);
    }

    res.json({ ok: true, timestamp: kioskData.lastHeartbeat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/events/:id/kiosks
 * List all active kiosks for an event (Owner only)
 */
router.get('/:id/kiosks', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event } = await supabase
      .from('events')
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const eventKiosks = kioskFleet.get(id);
    const kiosks = eventKiosks ? Array.from(eventKiosks.values()) : [];

    const now = Date.now();
    const enriched = kiosks.map((k) => {
      const diff = now - new Date(k.lastHeartbeat).getTime();
      return {
        ...k,
        status: diff < 60000 ? 'online' : diff < 180000 ? 'idle' : 'offline',
      };
    });

    res.json({ kiosks: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
