/**
 * storage.js — dual storage: Cloudflare R2 (primary) + Supabase Storage (fallback)
 *
 * Priority:
 *   1. R2  — if R2_ENDPOINT + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME are set
 *   2. Supabase Storage — uses SUPABASE_URL + SUPABASE_SERVICE_KEY (always available)
 *
 * This means uploads work immediately out of the box using Supabase,
 * and automatically switch to R2 once those env vars are configured.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

// ── R2 config ─────────────────────────────────────────────────────────────────
const R2_CONFIGURED = !!(
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

let s3, BUCKET, PUBLIC_URL;
if (R2_CONFIGURED) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  BUCKET = process.env.R2_BUCKET_NAME;
  PUBLIC_URL = process.env.R2_PUBLIC_URL;
  console.log('✅ Storage: Cloudflare R2 configured');
} else {
  console.log('ℹ️  Storage: R2 not configured — using Supabase Storage fallback');
}

// ── Supabase Storage fallback ─────────────────────────────────────────────────
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = 'photobooth-media';

async function uploadToSupabase(buffer, key, contentType) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('No storage configured. Set R2 env vars or SUPABASE_SERVICE_KEY on Render.');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error');
    // If bucket doesn't exist, try to create it first
    if (res.status === 404 || err.includes('not found')) {
      await createSupabaseBucket();
      // Retry once
      const retry = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: buffer,
      });
      if (!retry.ok) throw new Error(`Supabase upload failed: ${await retry.text()}`);
    } else {
      throw new Error(`Supabase upload failed (${res.status}): ${err.slice(0, 200)}`);
    }
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}`;
}

async function createSupabaseBucket() {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: true }),
    });
  } catch { /* ignore */ }
}

// ── Main API ──────────────────────────────────────────────────────────────────

async function uploadToStorage(buffer, key, contentType = 'image/jpeg') {
  if (R2_CONFIGURED) {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });
    await s3.send(command);
    return `${PUBLIC_URL}/${key}`;
  }

  // Fallback: Supabase Storage
  return uploadToSupabase(buffer, key, contentType);
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (R2_CONFIGURED) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3, command, { expiresIn });
  }
  // Supabase public URLs don't need signing
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}`;
}

async function deleteFromStorage(key) {
  if (R2_CONFIGURED) {
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await s3.send(command);
    return;
  }
  // Supabase delete
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch { /* ignore delete errors */ }
}

module.exports = { uploadToStorage, getSignedDownloadUrl, deleteFromStorage };
