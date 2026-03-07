const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // Your R2 public domain

/**
 * Upload a buffer to R2
 * @param {Buffer} buffer - Image/GIF buffer
 * @param {string} key - Storage path e.g. "events/wedding2024/photo_abc.jpg"
 * @param {string} contentType - MIME type
 * @returns {string} Public URL
 */
async function uploadToStorage(buffer, key, contentType = 'image/jpeg') {
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

/**
 * Generate a signed URL for temporary access (private buckets)
 */
async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete a file from storage
 */
async function deleteFromStorage(key) {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3.send(command);
}

module.exports = { uploadToStorage, getSignedDownloadUrl, deleteFromStorage };
