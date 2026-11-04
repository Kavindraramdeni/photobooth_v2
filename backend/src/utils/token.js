const crypto = require('crypto');

const DEFAULT_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || 'snapbooth-secure-default-key-32bytes!!';

/**
 * Sign a token with HMAC-SHA256
 * @param {Object} payload 
 * @param {number} expiresInSeconds - default 24h
 * @param {string} secret 
 * @returns {string} base64url encoded token
 */
function signToken(payload, expiresInSeconds = 86400, secret = DEFAULT_SECRET) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  const jsonStr = JSON.stringify(data);
  const bodyB64 = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyB64);
  const signature = hmac.digest('base64url');
  return `${bodyB64}.${signature}`;
}

/**
 * Verify a token signed with signToken
 * @param {string} token 
 * @param {string} secret 
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyToken(token, secret = DEFAULT_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [bodyB64, signature] = parts;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyB64);
  const expectedSig = hmac.digest('base64url');

  if (signature.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
};
