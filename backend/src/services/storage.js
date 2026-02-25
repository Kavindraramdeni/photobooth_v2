const { createClient } = require('@supabase/supabase-js');

// Use Supabase Storage instead of R2 — no extra account needed!
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET_NAME = 'photobooth-media';

/**
 * Ensure the storage bucket exists and is public
 */
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.find((b) => b.name === BUCKET_NAME);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    });
    console.log(`✅ Created Supabase storage bucket: ${BUCKET_NAME}`);
  }
}

// Auto-create bucket on startup
ensureBucket().catch(console.error);

/**
 * Upload a buffer to Supabase Storage
 * @param {Buffer} buffer - Image/GIF buffer
 * @param {string} key - Storage path e.g. "events/wedding2024/photo_abc.jpg"
 * @param {string} contentType - MIME type
 * @returns {string} Public URL
 */
async function uploadToStorage(buffer, key, contentType = 'image/jpeg') {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(key, buffer, {
      contentType,
      upsert: true,
      cacheControl: '31536000',
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(key);

  return urlData.publicUrl;
}

/**
 * Get a signed URL for temporary access
 */
async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(key, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Delete a file from storage
 */
async function deleteFromStorage(key) {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([key]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

module.exports = { uploadToStorage, getSignedDownloadUrl, deleteFromStorage, ensureBucketExists: ensureBucket };
