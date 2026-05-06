const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const supabase = require('../services/database');

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
 * List all events (admin)
 */
router.get('/', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id, name, slug, date, venue, status, created_at,
        photos(count)
      `)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/events/:id
 * Get single event details
 */
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;

    // Try by slug first, then by UUID — avoids PostgREST .or() parsing issues with hyphens
    let event = null;

    const bySlug = await supabase.from('events').select('*').eq('slug', param).maybeSingle();
    if (bySlug.data) {
      event = bySlug.data;
    } else {
      // Only try UUID lookup if it looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
      if (isUUID) {
        const byId = await supabase.from('events').select('*').eq('id', param).maybeSingle();
        if (byId.data) event = byId.data;
      }
    }

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/events
 * Create a new event
 */
router.post('/', async (req, res) => {
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
      operatorPin: '1234',
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
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: event, error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
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
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

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
 * Create a style for this event
 */
router.post('/:id/styles', async (req, res) => {
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
 */
router.put('/:id/styles/:styleId', async (req, res) => {
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
 */
router.delete('/:id/styles/:styleId', async (req, res) => {
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
 * POST /api/events/:id/upload-asset?type=logo|frame|idle
 * Upload branding asset and update event branding fields
 */
router.post('/:id/upload-asset', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const type = (req.query.type || '').toString();
    if (!['logo', 'frame', 'idle'].includes(type)) return res.status(400).json({ error: 'Invalid asset type' });

    const ext = (req.file.mimetype || '').includes('png') ? 'png' : (req.file.mimetype || '').includes('mp4') ? 'mp4' : 'jpg';
    const key = `events/${req.params.id}/${type}_${Date.now()}.${ext}`;
    const url = await uploadToStorage(req.file.buffer, key, req.file.mimetype || 'application/octet-stream');

    const { data: existing } = await supabase.from('events').select('branding').eq('id', req.params.id).single();
    const branding = existing?.branding || {};
    if (type === 'logo') branding.logoUrl = url;
    if (type === 'frame') branding.frameUrl = url;
    if (type === 'idle') branding.idleMediaUrl = url;

    const { error } = await supabase.from('events').update({ branding }).eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

/**
 * POST /api/events/:id/styles/:styleId/image
 * Receives multipart/form-data with field 'file'
 * Resizes to portrait 3:4, stores in R2, updates DB
 */
const multer = require('multer');
const sharp = require('sharp');
const { uploadToStorage } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post('/:id/styles/:styleId/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const processed = await sharp(req.file.buffer)
      .resize(400, 533, { fit: 'cover', position: 'entropy' })
      .jpeg({ quality: 88 })
      .toBuffer();

    const key = `events/${req.params.id}/styles/preview_${req.params.styleId}.jpg`;

    const url = await uploadToStorage(processed, key, 'image/jpeg');

    console.log("UPLOAD URL:", url); // 👈 ADD THIS

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

module.exports = router;

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
 * Add a new frame overlay
 */
router.post('/:id/frames', _upload.single('file'), async (req, res) => {
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
 * Update frame (toggle active, set default, etc.)
 */
router.patch('/:id/frames/:frameId', async (req, res) => {
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
 * Set as default overlay
 */
router.post('/:id/frames/:frameId/default', async (req, res) => {
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

/**
 * DELETE /api/events/:id/frames/:frameId
 * Delete a frame overlay
 */
router.delete('/:id/frames/:frameId', async (req, res) => {
  try {
    const { data: frame } = await supabase
      .from('event_frames')
      .select('url')
      .eq('id', req.params.frameId)
      .eq('event_id', req.params.id)
      .single();

    if (frame?.url) {
      try {
        await deleteFromStorage(frame.url);
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
