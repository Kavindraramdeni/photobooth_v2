const express = require('express');
const multer = require('multer');
const router = express.Router();

let generateAIImage, applyAIFilter, AI_STYLES;
try {
  ({ generateAIImage, applyAIFilter, AI_STYLES } = require('../services/ai'));
} catch(e) { console.error('[ai route] services/ai failed:', e.message, e.stack); throw e; }

let uploadToStorage;
try {
  ({ uploadToStorage } = require('../services/storage'));
} catch(e) { console.error('[ai route] services/storage failed:', e.message, e.stack); throw e; }

let generateQRDataURL, buildGalleryUrl;
try {
  ({ generateQRDataURL, buildGalleryUrl } = require('../services/sharing'));
} catch(e) { console.error('[ai route] services/sharing failed:', e.message, e.stack); throw e; }

const supabase = require('../services/database');
const { v4: uuidv4 } = require('uuid');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * GET /api/ai/styles
 */
router.get('/styles', (req, res) => {
  const styles = Object.entries(AI_STYLES).map(([key, value]) => ({
    key, name: value.name, emoji: value.emoji,
  }));
  res.json({ styles });
});

/**
 * POST /api/ai/filter
 * Apply instant Sharp filter. Accepts either:
 *   - multipart 'photo' file upload, OR
 *   - JSON body { photoId, filterName } → fetches photo from DB/storage
 */
router.post('/filter', upload.single('photo'), async (req, res) => {
  try {
    const { filterName = 'bw', eventId, photoId } = req.body;

    let imageBuffer;

    if (req.file) {
      // Direct upload
      imageBuffer = req.file.buffer;
    } else if (photoId) {
      // Fetch from DB → get URL → fetch buffer (server-side, no CORS)
      const { data: photo } = await supabase
        .from('photos').select('url').eq('id', photoId).single();
      if (!photo?.url) return res.status(404).json({ error: 'Photo not found' });
      const r = await fetch(photo.url);
      if (!r.ok) return res.status(502).json({ error: 'Could not fetch photo from storage' });
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'Photo file or photoId required' });
    }

    const filteredBuffer = await applyAIFilter(imageBuffer, filterName);

    const filterId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/filtered/${filterId}.jpg`;
    const filteredUrl = await uploadToStorage(filteredBuffer, storageKey, 'image/jpeg');

    // Save to DB if eventId provided
    if (eventId) {
      await supabase.from('photos').insert({
        id: filterId, event_id: eventId, url: filteredUrl,
        storage_key: storageKey, mode: 'ai',
        metadata: { filter: filterName, originalPhotoId: photoId },
      });
    }

    res.json({ success: true, filtered: { id: filterId, url: filteredUrl, filter: filterName } });
  } catch (error) {
    console.error('Filter error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/generate
 * HuggingFace img2img. Accepts file upload OR photoId.
 */
router.post('/generate', upload.single('photo'), async (req, res) => {
  try {
    const { styleKey = 'anime', eventId, photoId, customPrompt } = req.body;

    let imageBuffer;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (photoId) {
      const { data: photo } = await supabase
        .from('photos').select('url').eq('id', photoId).single();
      if (!photo?.url) return res.status(404).json({ error: 'Photo not found' });
      const r = await fetch(photo.url);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'Photo file or photoId required' });
    }

    let result;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        result = await generateAIImage(imageBuffer, styleKey, customPrompt);
        break;
      } catch (err) {
        if (err.message.startsWith('MODEL_LOADING:')) {
          const waitTime = parseInt(err.message.split(':')[1]) || 30;
          retryCount++;
          if (retryCount < maxRetries) {
            const io = req.app.get('io');
            if (eventId) io.to(`event-${eventId}`).emit('ai-status', {
              status: 'loading', message: `AI model warming up... (${waitTime}s)`, waitTime,
            });
            await new Promise((r) => setTimeout(r, waitTime * 1000));
          } else {
            throw new Error('AI model unavailable. Please try again in a few minutes.');
          }
        } else { throw err; }
      }
    }

    const aiId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/ai/${aiId}.jpg`;
    const aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');
    const galleryUrl = eventId ? buildGalleryUrl(eventId, aiId) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    await supabase.from('photos').insert({
      id: aiId, event_id: eventId, url: aiUrl, gallery_url: galleryUrl,
      storage_key: storageKey, mode: 'ai',
      metadata: { style: styleKey, originalPhotoId: photoId },
    });

    if (eventId) {
      await supabase.from('analytics').insert({
        event_id: eventId, action: 'ai_generated', metadata: { style: styleKey, aiId },
      });
    }

    res.json({ success: true, ai: { id: aiId, url: aiUrl, style: result.style, styleKey, galleryUrl, qrCode: qrDataUrl } });
  } catch (error) {
    console.error('AI generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/surprise
 */
router.post('/surprise', upload.single('photo'), async (req, res) => {
  try {
    const { eventId, photoId } = req.body;

    let imageBuffer;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (photoId) {
      const { data: photo } = await supabase
        .from('photos').select('url').eq('id', photoId).single();
      if (!photo?.url) return res.status(404).json({ error: 'Photo not found' });
      const r = await fetch(photo.url);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'Photo file or photoId required' });
    }

    const styles = Object.keys(AI_STYLES);
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    let result;
    try {
      result = await generateAIImage(imageBuffer, randomStyle);
    } catch (err) {
      if (err.message.startsWith('MODEL_LOADING:')) {
        return res.status(503).json({ error: 'AI model warming up. Try again in 30 seconds.', code: 'MODEL_LOADING' });
      }
      throw err;
    }

    const aiId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/ai/${aiId}.jpg`;
    const aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');
    const galleryUrl = eventId ? buildGalleryUrl(eventId, aiId) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    res.json({
      success: true,
      ai: { id: aiId, url: aiUrl, style: result.style, styleKey: randomStyle,
            emoji: AI_STYLES[randomStyle].emoji, galleryUrl, qrCode: qrDataUrl, surprise: true },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/**
 * GET /api/ai/status
 * Returns which AI tier is active based on env vars + a live ping to Cloudflare.
 * No auth required — used by admin dashboard to show AI health.
 */
router.get('/status', async (req, res) => {
  const hasCF = !!(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);
  const hasHF = !!(process.env.HUGGINGFACE_API_TOKEN);

  const tiers = {
    cloudflare: { configured: hasCF, status: 'unknown', model: '@cf/bytedance/stable-diffusion-xl-lightning' },
    huggingface: { configured: hasHF, status: 'unknown', model: 'black-forest-labs/FLUX.1-schnell' },
    sharp: { configured: true, status: 'active', model: 'Local colour grading (always available)' },
  };

  // Quick ping Cloudflare if configured
  if (hasCF) {
    try {
      const pingRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/models/search?per_page=1`,
        { headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}` }, signal: AbortSignal.timeout(5000) }
      );
      tiers.cloudflare.status = pingRes.ok ? 'active' : 'error';
      if (!pingRes.ok) tiers.cloudflare.error = `HTTP ${pingRes.status}`;
    } catch (e) {
      tiers.cloudflare.status = 'error';
      tiers.cloudflare.error = e.message;
    }
  } else {
    tiers.cloudflare.status = 'not_configured';
  }

  if (hasHF) {
    tiers.huggingface.status = 'configured'; // HF warms up on demand, can't ping cheaply
  } else {
    tiers.huggingface.status = 'not_configured';
  }

  // Determine active tier
  let activeTier = 'sharp';
  let activeTierLabel = '⚡ Sharp filters (local)';
  if (hasGemini) {
    activeTier = 'gemini';
    activeTierLabel = '✨ Gemini 2.0 Flash (highest quality)';
  } else if (hasFal) {
    activeTier = 'fal';
    activeTierLabel = '🎬 Fal.ai FLUX img2img (cinematic)';
    tiers.fal.status = 'active';
  } else if (tiers.cloudflare.status === 'active') {
    activeTier = 'cloudflare';
    activeTierLabel = '☁️ Cloudflare Workers AI (img2img)';
  } else if (tiers.huggingface.status === 'configured') {
    activeTier = 'huggingface';
    activeTierLabel = '🤗 HuggingFace FLUX.1';
  }

  res.json({
    activeTier,
    activeTierLabel,
    tiers,
    summary: {
      cloudflare: hasCF ? tiers.cloudflare.status : 'not_configured',
      huggingface: hasHF ? 'configured' : 'not_configured',
      sharp: 'always_available',
    }
  });
});

module.exports = router;
