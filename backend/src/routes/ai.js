const express = require('express');
const multer = require('multer');
const router = express.Router();

const { generateAIImage, applyAIFilter, AI_STYLES } = require('../services/ai');
const { uploadToStorage } = require('../services/storage');
const { generateQRDataURL, buildGalleryUrl } = require('../services/sharing');
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

/**
 * POST /api/ai/generate
 * Generate AI-transformed photo (HuggingFace img2img)
 */
router.post('/generate', upload.single('photo'), async (req, res) => {
  try {
    const { styleKey = 'anime', eventId, photoId, customPrompt } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Photo required' });

    // Check if model is available (HuggingFace free tier may be loading)
    let result;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        result = await generateAIImage(req.file.buffer, styleKey, customPrompt);
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

    // Upload AI image to storage
    const aiId = uuidv4();
    const storageKey = `events/${eventId || 'unknown'}/ai/${aiId}.jpg`;
    const aiUrl = await uploadToStorage(result.buffer, storageKey, 'image/jpeg');

    // Save to DB linked to original photo
    const galleryUrl = eventId ? buildGalleryUrl(eventId, aiId) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

    await supabase.from('photos').insert({
      id: aiId,
      event_id: eventId,
      url: aiUrl,
      gallery_url: galleryUrl,
      storage_key: storageKey,
      mode: 'ai',
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

    const galleryUrl = eventId ? buildGalleryUrl(eventId, aiId) : aiUrl;
    const qrDataUrl = await generateQRDataURL(galleryUrl);

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
