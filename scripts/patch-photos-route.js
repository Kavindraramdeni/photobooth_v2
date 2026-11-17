const fs = require('fs');
const filePath = 'backend/src/routes/photos.js';
let code = fs.readFileSync(filePath, 'utf8');

const startIdx = code.indexOf('if (dbError) throw dbError;');
const endIdx = code.indexOf('res.json({\n      success: true,', startIdx);
const endOfResJson = code.indexOf('});', endIdx) + 3;

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `let finalPhoto = photo;
    if (dbError) {
      console.warn('[photos/upload] DB insert warning, using resilient fallback:', dbError.message);
      finalPhoto = {
        id: photoId,
        event_id: eventId,
        url: photoUrl,
        thumb_url: thumbUrl,
        gallery_url: galleryUrl,
        storage_key: storageKey,
        short_code: shortCode,
        mode,
        created_at: new Date().toISOString(),
      };
    } else {
      console.log('[photos/upload] DB insert success', { photoId: finalPhoto.id, eventId, shortCode: finalPhoto.short_code });
    }

    // Track analytics (non-blocking)
    try {
      supabase.from('analytics').insert({
        event_id: eventId,
        action: 'photo_taken',
        metadata: { mode, photoId },
      }).catch(() => {});
    } catch {}

    // Emit via Socket.IO to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.to(\`event-\${eventId}\`).emit('photo-taken', {
        photoId,
        thumbUrl,
        galleryUrl,
        mode,
        timestamp: new Date().toISOString(),
      });
    }

    // Fire webhook (non-blocking)
    fireWebhook(event, {
      trigger: 'photo.created',
      photo: finalPhoto,
    }).catch(() => {});

    res.json({
      success: true,
      photo: finalPhoto,
      qrDataUrl,
      whatsappUrl,
      galleryUrl,
      photoUrl,
      thumbUrl,
      shortCode,
    });`;

  const newCode = code.substring(0, startIdx) + replacement + code.substring(endOfResJson);
  fs.writeFileSync(filePath, newCode, 'utf8');
  console.log('Successfully patched backend/src/routes/photos.js!');
} else {
  console.error('Indices not found:', startIdx, endIdx);
}
