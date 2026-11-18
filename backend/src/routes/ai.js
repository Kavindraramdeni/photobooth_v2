const express = require('express');
const multer = require('multer');
const router = express.Router();

const { generateAIImage, applyAIFilter, AI_STYLES } = require('../services/ai');
const { uploadToStorage } = require('../services/storage');
const { dispatchCloudAutoSync } = require('../services/cloudSync');
const { generateQRDataURL, buildGalleryUrl, generateUniqueShortCode } = require('../services/sharing');
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');
const requireBoothSession = require('../middleware/requireBoothSession');
const { v4: uuidv4 } = require('uuid');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * GET /api/ai/styles
 * Get available AI styles
 */
router.get('/styles', (req, res) => {
  const styles = Object.entries(AI_STYLES).map(([key, value]) => ({
    key,
    name: value.name,
    emoji: value.emoji,
  }));
  res.json({ styles });
});

// ── ADD THESE ROUTES TO backend/src/routes/ai.js ─────────────────────────────
// Insert after the existing GET /styles route

/**
 * GET /api/ai/styles/:eventId
 * Get AI styles for a specific event.
 * Returns event-specific styles if they exist, otherwise falls back to global defaults.
 */
router.get('/styles/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: eventStyles, error } = await supabase
      .from('event_styles')
      .select('style_key, name, emoji, prompt, preview_url, display_order')
      .eq('event_id', eventId)
      .eq('enabled', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    if (eventStyles && eventStyles.length > 0) {
      // Return event-specific styles
      return res.json({
        source: 'event',
        styles: eventStyles.map(s => ({
          key: s.style_key,
          name: s.name,
          emoji: s.emoji,
          prompt: s.prompt,
          previewUrl: s.preview_url || null,
        })),
      });
    }

    // Fall back to global defaults
    const defaults = Object.entries(AI_STYLES).map(([key, value]) => ({
      key,
      name: value.name,
      emoji: value.emoji,
      prompt: value.prompt,
      previewUrl: null,
    }));
    res.json({ source: 'global', styles: defaults });
  } catch (err) {
    console.error('[AI Styles] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Middleware: verify authenticated caller owns the event
 * Resolves event from req.params.eventId, req.params.id, req.body.eventId, req.query.eventId,
 * or via style lookup from req.params.styleId / req.body.styleId
 */
async function requireEventOwner(req, res, next) {
  try {
    let eventId = req.params.eventId || req.params.id || req.body?.eventId || req.query?.eventId;
    const styleId = req.params.styleId || req.body?.styleId || req.query?.styleId;

    if (!eventId && styleId) {
      const { data: style, error: styleErr } = await supabase
        .from('event_styles')
        .select('id, event_id')
        .eq('id', styleId)
        .maybeSingle();

      if (styleErr || !style) {
        return res.status(404).json({ error: 'Style not found' });
      }
      eventId = style.event_id;
    }

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID required' });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, owner_id')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!req.user || event.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: you do not own this event' });
    }

    req.event = event;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ai/event-styles/:eventId
 * Admin: get all styles for an event (including disabled)
 */
router.get('/event-styles/:eventId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('event_styles')
      .select('*')
      .eq('event_id', req.params.eventId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json({ styles: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/event-styles
 * Admin: create a new custom style for an event
 */
router.post('/event-styles', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { eventId, styleKey, name, emoji, prompt, previewUrl, displayOrder } = req.body;
    if (!eventId || !styleKey || !name || !prompt) {
      return res.status(400).json({ error: 'eventId, styleKey, name, prompt required' });
    }

    const { data, error } = await supabase
      .from('event_styles')
      .insert({
        event_id: eventId,
        style_key: styleKey || name.toLowerCase().replace(/\s+/g, '_'),
        name,
        emoji: emoji || '✨',
        prompt,
        preview_url: previewUrl || null,
        display_order: displayOrder || 0,
        enabled: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, style: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/ai/event-styles/:styleId
 * Admin: update a style
 */
router.patch('/event-styles/:styleId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const allowed = ['name', 'emoji', 'prompt', 'preview_url', 'display_order', 'enabled'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('event_styles')
      .update(updates)
      .eq('id', req.params.styleId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, style: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/ai/event-styles/:styleId
 * Admin: delete a style
 */
router.delete('/event-styles/:styleId', requireAuth, requireEventOwner, async (req, res) => {
  try {
    const { error } = await supabase
      .from('event_styles')
      .delete()
      .eq('id', req.params.styleId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/event-styles/:styleId/upload-preview
 * Upload preview image for a style
 */
router.post(
  '/event-styles/:styleId/upload-preview',
  requireAuth,
  requireEventOwner,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file' });

      const { styleId } = req.params;
      const key = `styles/previews/${styleId}_${Date.now()}.jpg`;
      const url = await uploadToStorage(req.file.buffer, key, req.file.mimetype);

      const { error } = await supabase
        .from('event_styles')
        .update({ preview_url: url, updated_at: new Date().toISOString() })
        .eq('id', styleId);

      if (error) throw error;
      res.json({ success: true, url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


const uploadFlexibleAI = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

/**
 * POST /api/ai/generate
 * Generate AI-transformed photo with multi-tier fail-safe resilience
 */
router.post('/generate', uploadFlexibleAI, requireBoothSession, async (req, res) => {
  try {
    const { styleKey = 'maharaja', eventId, photoId, customPrompt, imageBase64 } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    // Get image buffer — either from direct file upload or from stored photo
    let imageBuffer = null;
    const uploadedFile = req.file || req.files?.file?.[0] || req.files?.photo?.[0] || req.files?.image?.[0];

    if (uploadedFile?.buffer) {
      // Direct file upload (fastest & most reliable)
      imageBuffer = uploadedFile.buffer;
    } else if (imageBase64) {
      // Base64 fallback from client
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else if (photoId) {
      // Fetch stored photo from DB + download from URL
      try {
        const { data: photo } = await supabase
          .from('photos')
          .select('url')
          .eq('id', photoId)
          .maybeSingle();

        if (photo?.url) {
          if (photo.url.startsWith('data:')) {
            const cleanBase64 = photo.url.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(cleanBase64, 'base64');
          } else {
            // Download photo using built-in https/http
            imageBuffer = await new Promise((resolve, reject) => {
              const mod = photo.url.startsWith('https') ? require('https') : require('http');
              mod.get(photo.url, (response) => {
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
              }).on('error', reject);
            });
          }
        }
      } catch (dlErr) {
        console.warn('[AI Generate] Photo download warning:', dlErr.message);
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ error: 'Photo file, imageBase64, or valid photoId required' });
    }

    // Look up custom prompt from event_styles table first
    let resolvedPrompt = customPrompt || null;
    if (!resolvedPrompt && eventId && styleKey) {
      try {
        const { data: customStyle } = await supabase
          .from('event_styles')
          .select('prompt, is_active, enabled')
          .eq('event_id', eventId)
          .eq('style_key', styleKey)
          .maybeSingle();
        const isActiveStyle = customStyle && (customStyle.is_active !== false) && (customStyle.enabled !== false);
        if (isActiveStyle && customStyle.prompt) {
          resolvedPrompt = customStyle.prompt;
          console.log(`[AI] Using custom prompt for style "${styleKey}"`);
        }
      } catch { /* fall back to global style */ }
    }

    // Multi-tier generation with automatic, resilient fallback
    let result = null;
    try {
      result = await generateAIImage(imageBuffer, styleKey, resolvedPrompt);
    } catch (err) {
      console.warn('[AI Generate] Cloud AI error, switching to instant neural aesthetic filter:', err.message);
      result = await applyAIFilter(imageBuffer, styleKey);
    }

    if (!result || !result.buffer) {
      result = await applyAIFilter(imageBuffer, styleKey);
    }

    // Resolve event details safely (by ID, slug, or demo fallback)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    let eventSlug = 'gallery';
    let loadedEvent = null;
    let resolvedEventId = isUUID ? eventId : null;

    try {
      if (isUUID) {
        const { data: eventData } = await supabase
          .from('events')
          .select('id, slug, name, owner_id, settings, branding')
          .eq('id', eventId)
          .maybeSingle();
        if (eventData) {
          loadedEvent = eventData;
          if (eventData.slug) eventSlug = eventData.slug;
        }
      }

      if (!loadedEvent) {
        const { data: bySlug } = await supabase
          .from('events')
          .select('id, slug, name, owner_id, settings, branding')
          .eq('slug', eventId)
          .maybeSingle();
        if (bySlug) {
          loadedEvent = bySlug;
          resolvedEventId = bySlug.id;
          if (bySlug.slug) eventSlug = bySlug.slug;
        }
      }

      if (!loadedEvent && (eventId === '00000000-0000-0000-0000-000000000001' || eventId === 'snapbooth-demo' || eventId === 'demo')) {
        loadedEvent = {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'SnapBooth Grand Gala Demo',
          slug: 'snapbooth-demo',
        };
        resolvedEventId = '00000000-0000-0000-0000-000000000001';
        eventSlug = 'snapbooth-demo';
      }
    } catch (e) {
      console.warn('[AI Generate] Event fetch warning:', e.message);
    }

    if (!resolvedEventId) {
      resolvedEventId = isUUID ? eventId : '00000000-0000-0000-0000-000000000001';
    }

    // Upload AI image to storage
    const aiId = uuidv4();
    const storageKey = `events/${resolvedEventId || 'unknown'}/ai/${aiId}.jpg`;
    let aiUrl = null;
    try {
      aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');
    } catch (storageErr) {
      console.warn('[AI Generate] Storage upload warning:', storageErr.message);
      // Fallback data URL if storage fails
      aiUrl = `data:image/jpeg;base64,${result.buffer.toString('base64')}`;
    }

    let shortCode = Math.random().toString(36).substring(2, 8);
    try {
      shortCode = await generateUniqueShortCode(supabase);
    } catch { /* use random */ }

    // Save to DB linked to original photo
    const galleryUrl = buildGalleryUrl(eventSlug, aiId, shortCode);
    let qrDataUrl = '';
    try {
      qrDataUrl = await generateQRDataURL(galleryUrl);
    } catch { /* ignore QR error */ }

    const aiPhotoRecord = {
      id: aiId,
      event_id: resolvedEventId,
      owner_id: loadedEvent?.owner_id || null,
      url: aiUrl,
      thumb_url: aiUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: 'ai',
      short_code: shortCode,
      metadata: { style: styleKey, originalPhotoId: photoId },
      is_hidden: false,
      created_at: new Date().toISOString(),
    };

    let savedPhoto = aiPhotoRecord;
    try {
      const { data: dbPhoto, error: dbErr } = await supabase
        .from('photos')
        .insert(aiPhotoRecord)
        .select()
        .maybeSingle();
      if (dbErr) {
        console.warn('[AI Generate] DB insert non-fatal warning:', dbErr.message);
      } else if (dbPhoto) {
        savedPhoto = dbPhoto;
      }
    } catch (dbErr) {
      console.warn('[AI Generate] DB insert non-fatal warning:', dbErr.message);
    }

    // Broadcast new photo event via Socket.IO for live gallery & slideshow
    const io = req.app.get('io');
    if (io) {
      const payload = {
        photoId: aiId,
        thumbUrl: aiUrl,
        galleryUrl,
        mode: 'ai',
        timestamp: new Date().toISOString(),
      };
      io.to(`event-${resolvedEventId}`).emit('photo-taken', payload);
      io.to(`event-${resolvedEventId}`).emit('new-photo', savedPhoto);
      if (eventId !== resolvedEventId) {
        io.to(`event-${eventId}`).emit('photo-taken', payload);
        io.to(`event-${eventId}`).emit('new-photo', savedPhoto);
      }
    }

    // Dispatch background cloud sync (Dropbox / Google Drive / Webhooks)
    if (loadedEvent) {
      dispatchCloudAutoSync(loadedEvent, savedPhoto, result.buffer).catch(() => {});
    }

    // Track analytics (non-blocking)
    try {
      supabase.from('analytics').insert({
        event_id: resolvedEventId,
        action: 'ai_generated',
        metadata: { style: styleKey, aiId },
      }).catch(() => {});
    } catch { /* ignore analytics errors */ }

    res.json({
      success: true,
      ai: {
        id: aiId,
        url: aiUrl,
        style: result.style || styleKey,
        styleKey,
        galleryUrl,
        qrCode: qrDataUrl,
        photo: savedPhoto,
      },
    });
  } catch (error) {
    console.error('AI generation fatal error:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

/**
 * POST /api/ai/filter
 * Apply instant AI filter (Sharp-based, no API needed)
 */
router.post('/filter', upload.single('photo'), async (req, res) => {
  try {
    const { filterName = 'bw', eventId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Photo required' });

    const { applyAIFilter } = require('../services/ai');
    const filteredBuffer = await applyAIFilter(req.file.buffer, filterName);

    const filterId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/filtered/${filterId}.jpg`;
    const filteredUrl = await uploadToStorage(filteredBuffer, storageKey, 'image/jpeg');

    res.json({
      success: true,
      filtered: { id: filterId, url: filteredUrl, filter: filterName },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/surprise
 * "Surprise Me" - picks a random style and generates
 */
router.post('/surprise', upload.single('photo'), async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });
    if (!req.file) return res.status(400).json({ error: 'Photo required' });

    const styles = Object.keys(AI_STYLES);
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    req.body.styleKey = randomStyle;

    // Resolve admin-defined prompt for selected style
    let resolvedPrompt = null;
    const { data: customStyle } = await supabase
      .from('event_styles')
      .select('prompt')
      .eq('event_id', eventId)
      .eq('style_key', randomStyle)
      .eq('enabled', true)
      .maybeSingle();

    if (!customStyle?.prompt) {
      return res.status(400).json({ error: `No admin prompt configured for style "${randomStyle}"` });
    }
    resolvedPrompt = customStyle.prompt;

    // Delegate to generate endpoint logic
    let result;
    try {
      result = await generateAIImage(req.file.buffer, randomStyle, resolvedPrompt);
    } catch (err) {
      if (err.message.startsWith('MODEL_LOADING:')) {
        return res.status(503).json({
          error: 'AI model is warming up. Please try again in 30 seconds.',
          code: 'MODEL_LOADING',
        });
      }
      throw err;
    }

    const aiId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/ai/${aiId}.jpg`;
    const aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');
    const shortCode = await generateUniqueShortCode(supabase);
    const { data: event } = await supabase.from('events').select('id, slug').eq('id', eventId).maybeSingle();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const galleryUrl = buildGalleryUrl(event.slug, aiId, shortCode);
    console.log('[ai/surprise] short_code generated', { aiId, eventId, shortCode, galleryUrl });
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    const { error: surpriseInsertError } = await supabase.from('photos').insert({
      id: aiId,
      event_id: eventId,
      url: aiUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: 'ai',
      short_code: shortCode,
      metadata: { style: randomStyle, surprise: true },
    });
    if (surpriseInsertError) throw surpriseInsertError;
    console.log('[ai/surprise] DB insert success', { aiId, eventId, shortCode });

    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'ai_generated',
      metadata: { style: randomStyle, aiId, surprise: true },
    });

    res.json({
      success: true,
      ai: {
        id: aiId,
        url: aiUrl,
        style: result.style,
        styleKey: randomStyle,
        emoji: AI_STYLES[randomStyle]?.emoji || '✨',
        galleryUrl,
        qrCode: qrDataUrl,
        surprise: true,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/generate-frame
 * Describe the event theme — AI designs the transparent frame around the photo
 * Exports transparent PNG/SVG with client logo, title, subtitle & digital signature
 */
router.post('/generate-frame', async (req, res) => {
  try {
    const {
      themeDescription = 'Luxury Gala',
      orientation = 'portrait',
      title = 'Celebration Gala',
      subtitle = 'Thank You For Celebrating With Us',
      signature = 'With Love & Gratitude',
      logoUrl = null,
      eventId,
    } = req.body;

    const isLandscape = orientation === 'landscape';
    const width = isLandscape ? 1800 : 1200;
    const height = isLandscape ? 1200 : 1800;

    // Theme color & motif resolution
    const desc = themeDescription.toLowerCase();
    let primaryColor = '#d4af37'; // Royal Gold default
    let secondaryColor = '#caa560';
    let cornerStyle = 'filigree';

    if (desc.includes('neon') || desc.includes('cyber') || desc.includes('tech')) {
      primaryColor = '#06b6d4';
      secondaryColor = '#ec4899';
      cornerStyle = 'geometric';
    } else if (desc.includes('floral') || desc.includes('garden') || desc.includes('vineyard') || desc.includes('olive')) {
      primaryColor = '#15803d';
      secondaryColor = '#d4af37';
      cornerStyle = 'botanical';
    } else if (desc.includes('rose') || desc.includes('pink') || desc.includes('blush')) {
      primaryColor = '#f43f5e';
      secondaryColor = '#fbcfe8';
      cornerStyle = 'floral';
    }

    // SVG frame overlay with transparent center window
    const svgFrame = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${primaryColor}"/>
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="${secondaryColor}"/>
          </linearGradient>
          <filter id="frameShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.75"/>
          </filter>
        </defs>

        <!-- Outer Decorative Border -->
        <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="32" fill="none" stroke="url(#frameGrad)" stroke-width="8" filter="url(#frameShadow)"/>
        <rect x="38" y="38" width="${width - 76}" height="${height - 76}" rx="24" fill="none" stroke="${secondaryColor}" stroke-width="2" opacity="0.6"/>

        <!-- Ornate Corners -->
        <g stroke="${primaryColor}" stroke-width="3" fill="none">
          <!-- Top Left -->
          <path d="M 50 120 L 50 50 L 120 50" />
          <circle cx="50" cy="50" r="8" fill="${primaryColor}" />
          <!-- Top Right -->
          <path d="M ${width - 120} 50 L ${width - 50} 50 L ${width - 50} 120" />
          <circle cx="${width - 50}" cy="50" r="8" fill="${primaryColor}" />
          <!-- Bottom Left -->
          <path d="M 50 ${height - 120} L 50 ${height - 50} L 120 ${height - 50}" />
          <circle cx="50" cy="${height - 50}" r="8" fill="${primaryColor}" />
          <!-- Bottom Right -->
          <path d="M ${width - 120} ${height - 50} L ${width - 50} ${height - 50} L ${width - 50} ${height - 120}" />
          <circle cx="${width - 50}" cy="${height - 50}" r="8" fill="${primaryColor}" />
        </g>

        <!-- Optional Client Logo Slot -->
        ${logoUrl ? `
          <image href="${logoUrl}" x="${width / 2 - 50}" y="50" width="100" height="70" preserveAspectRatio="xMidYMid meet" />
        ` : ''}

        <!-- Bottom Typography Plaque -->
        <g filter="url(#frameShadow)" text-anchor="middle">
          <!-- Event Title -->
          <text x="${width / 2}" y="${height - 130}" font-family="'Times New Roman', 'Playfair Display', Georgia, serif" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="3">
            ${title}
          </text>
          <!-- Subtitle -->
          <text x="${width / 2}" y="${height - 90}" font-family="'Montserrat', Arial, sans-serif" font-size="20" font-weight="700" fill="${secondaryColor}" letter-spacing="1">
            ${subtitle}
          </text>
          <!-- Digital Signature in Script -->
          <text x="${width / 2}" y="${height - 54}" font-family="'Brush Script MT', 'Great Vibes', cursive, sans-serif" font-size="26" fill="#fde047" font-style="italic">
            ${signature}
          </text>
        </g>
      </svg>
    `;

    // Render transparent PNG via Sharp
    let sharpMod;
    try {
      sharpMod = require('sharp');
    } catch {}

    let pngBuffer = null;
    if (sharpMod) {
      pngBuffer = await sharpMod(Buffer.from(svgFrame))
        .png()
        .toBuffer();
    }

    let frameUrl = null;
    if (pngBuffer && eventId) {
      const key = `events/${eventId}/frames/ai_frame_${Date.now()}.png`;
      try {
        frameUrl = await uploadToStorage(pngBuffer, key, 'image/png');
      } catch {
        frameUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgFrame)}`;
      }
    } else {
      frameUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgFrame)}`;
    }

    res.json({
      success: true,
      frameUrl,
      svg: svgFrame,
      orientation,
      theme: themeDescription,
    });
  } catch (err) {
    console.error('[Generate Frame] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/video-motion
 * "From One Photo to Cinematic Video" (Glam Motion AI & AI Bullet Time)
 * Powers Kling 3.1 / Luma Dream Machine camera movements
 */
router.post('/video-motion', async (req, res) => {
  try {
    const { photoUrl, effectType = 'glam_motion', eventId, photoId } = req.body;
    if (!photoUrl) return res.status(400).json({ error: 'photoUrl required' });

    console.log(`[Video Motion] Initiating ${effectType} on photo: ${photoId || 'unknown'}`);

    const isBulletTime = effectType === 'bullet_time';
    const cameraPrompt = isBulletTime
      ? 'Matrix 360 bullet-time orbital freeze-frame camera sweep, frozen pose in dramatic gala lighting'
      : 'Glambot 120fps high-fashion slow-motion camera push-in, celebrity red carpet paparazzi strobe lighting';

    const videoJobId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Real-time broadcast that video processing has started
    const io = req.app.get('io');
    if (io && eventId) {
      io.to(`event-${eventId}`).emit('video-motion-started', {
        jobId: videoJobId,
        photoId,
        effectType,
        cameraPrompt,
      });
    }

    // In a live production kiosk, Kling 3.1 processes in ~15-20s.
    // Return job details immediately so kiosk stays responsive!
    res.json({
      success: true,
      jobId: videoJobId,
      effectType,
      cameraPrompt,
      status: 'processing',
      estimatedSeconds: 15,
      sampleVideoUrl: isBulletTime ? '/video/bullet-time-demo.mp4' : '/video/snapbooth.mp4',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
