const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const { generateQRDataURL, buildGalleryUrl, buildWhatsAppUrl } = require('../services/sharing');

/**
 * GET /api/share/:photoId
 * Get sharing info for a photo
 */
router.get('/:photoId', async (req, res) => {
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, events(name, slug)')
      .eq('id', req.params.photoId)
      .single();

    if (error || !photo) return res.status(404).json({ error: 'Photo not found' });

    const eventName = photo.events?.name || '';
    const galleryUrl = photo.gallery_url || buildGalleryUrl(photo.events?.slug || photo.event_id, photo.id);

    const qrCode = await generateQRDataURL(galleryUrl);
    const whatsappUrl = buildWhatsAppUrl(photo.url, eventName);

    // Track share
    await supabase.from('analytics').insert({
      event_id: photo.event_id,
      action: 'photo_shared',
      metadata: { photoId: photo.id },
    });

    res.json({
      photo: {
        id: photo.id,
        url: photo.url,
        galleryUrl,
        qrCode,
        whatsappUrl,
        downloadUrl: photo.url,
        eventName,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
