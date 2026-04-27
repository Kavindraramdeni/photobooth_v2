const express = require('express');
const multer = require('multer');
const router = express.Router();

const { generateAIImage, applyAIFilter, AI_STYLES } = require('../services/ai');
const { uploadToStorage } = require('../services/storage');
const { generateQRDataURL, buildGalleryUrl, generateUniqueShortCode } = require('../services/sharing');
const supabase = require('../services/database');
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
 * GET /api/ai/event-styles/:eventId
 * Admin: get all styles for an event (including disabled)
 */
router.get('/event-styles/:eventId', async (req, res) => {
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
router.post('/event-styles', async (req, res) => {
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
router.patch('/event-styles/:styleId', async (req, res) => {
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
router.delete('/event-styles/:styleId', async (req, res) => {
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


/**
 * POST /api/ai/generate
 * Generate AI-transformed photo (HuggingFace img2img)
 */
router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    const { styleKey = 'anime', eventId, photoId, customPrompt } = req.body;

    // Get image buffer — either from direct upload or from stored photo
    let imageBuffer = null;

    if (req.file) {
      // Direct file upload (legacy path)
      imageBuffer = req.file.buffer;
    } else if (photoId) {
      // Fetch stored photo from DB + download from URL
      const { data: photo } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .maybeSingle();

      if (!photo?.url) return res.status(404).json({ error: 'Photo not found' });

      // Download photo using built-in https/http (no external dependency)
      imageBuffer = await new Promise((resolve, reject) => {
        const mod = photo.url.startsWith('https') ? require('https') : require('http');
        mod.get(photo.url, (response) => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
          response.on('error', reject);
        }).on('error', reject);
      });
    } else {
      return res.status(400).json({ error: 'Photo or photoId required' });
    }

    // Look up custom prompt from event_styles table first
    let resolvedPrompt = customPrompt || null;
    if (!resolvedPrompt && eventId && styleKey) {
      try {
        const { data: customStyle } = await supabase
          .from('event_styles')
          .select('prompt')
          .eq('event_id', eventId)
          .eq('style_key', styleKey)
          .eq('is_active', true)
          .maybeSingle();
        if (customStyle?.prompt) {
          resolvedPrompt = customStyle.prompt;
          console.log(`[AI] Using custom prompt for style "${styleKey}"`);
        }
      } catch { /* fall back to global style */ }
    }

    // Check if model is available (HuggingFace free tier may be loading)
    let result;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        result = await generateAIImage(imageBuffer, styleKey, resolvedPrompt);
        break;
      } catch (err) {
        if (err.message.startsWith('MODEL_LOADING:')) {
          const waitTime = parseInt(err.message.split(':')[1]) || 30;
          retryCount++;

          if (retryCount < maxRetries) {
            // Emit loading state to frontend
            const io = req.app.get('io');
            if (eventId) {
              io.to(`event-${eventId}`).emit('ai-status', {
                status: 'loading',
                message: `AI model warming up... (${waitTime}s)`,
                waitTime,
              });
            }
            await new Promise((r) => setTimeout(r, waitTime * 1000));
          } else {
            throw new Error('AI model unavailable. Please try again in a few minutes.');
          }
        } else {
          throw err;
        }
      }
    }

    let event = null;
    if (eventId) {
      const { data } = await supabase.from('events').select('id, slug, name').eq('id', eventId).maybeSingle();
      event = data || null;
    }

    // Upload AI image to storage
    const aiId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/ai/${aiId}.jpg`;
    const aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');
    const shortCode = await generateUniqueShortCode(supabase);

    // Save to DB linked to original photo
    const galleryUrl = eventId ? buildGalleryUrl(event?.slug || eventId, aiId, shortCode) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    await supabase.from('photos').insert({
      id: aiId,
      event_id: eventId,
      url: aiUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: 'ai',
      short_code: shortCode,
      metadata: { style: styleKey, originalPhotoId: photoId },
    });

    // Track analytics
    if (eventId) {
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'ai_generated',
        metadata: { style: styleKey, aiId },
      });
    }

    res.json({
      success: true,
      ai: {
        id: aiId,
        url: aiUrl,
        style: result.style,
        styleKey,
        galleryUrl,
        qrCode: qrDataUrl,
      },
    });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: error.message });
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
    if (!req.file) return res.status(400).json({ error: 'Photo required' });

    const styles = Object.keys(AI_STYLES);
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    req.body.styleKey = randomStyle;

    // Delegate to generate endpoint logic
    let result;
    try {
      result = await generateAIImage(req.file.buffer, randomStyle);
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
    let event = null;
    if (eventId) {
      const { data } = await supabase.from('events').select('id, slug').eq('id', eventId).maybeSingle();
      event = data || null;
    }

    const galleryUrl = eventId ? buildGalleryUrl(event?.slug || eventId, aiId, shortCode) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    if (eventId) {
      await supabase.from('photos').insert({
        id: aiId,
        event_id: eventId,
        url: aiUrl,
        gallery_url: galleryUrl,
        storage_key: storageKey,
        mode: 'ai',
        short_code: shortCode,
        metadata: { style: randomStyle, surprise: true },
      });
      await supabase.from('analytics').insert({
        event_id: eventId,
        action: 'ai_generated',
        metadata: { style: randomStyle, aiId, surprise: true },
      });
    }

    res.json({
      success: true,
      ai: {
        id: aiId,
        url: aiUrl,
        style: result.style,
        styleKey: randomStyle,
        emoji: AI_STYLES[randomStyle].emoji,
        galleryUrl,
        qrCode: qrDataUrl,
        surprise: true,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
