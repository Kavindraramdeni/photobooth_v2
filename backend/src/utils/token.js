const crypto = require('crypto');

const DEFAULT_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || 'snapbooth-secure-default-key-32bytes!!';

/**
 * Sign a token with standard HMAC-SHA256 (JWT format)
 * @param {Object} payload 
 * @param {number} expiresInSeconds - default 24h
 * @param {string} secret 
 * @returns {string} base64url encoded JWT token (header.payload.signature)
 */
function signToken(payload, expiresInSeconds = 86400, secret = DEFAULT_SECRET) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(data)).toString('base64url');
  const toSign = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(toSign).digest('base64url');
  return `${toSign}.${signature}`;
}

/**
 * Verify a token signed with signToken
 * Supports standard 3-part JWTs and legacy 2-part tokens
 * @param {string} token 
 * @param {string} secret 
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyToken(token, secret = DEFAULT_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 2) return null;

  let payloadB64;
  let signature;
  let toVerify;

  if (parts.length === 3) {
    const [headerB64, bodyB64, sig] = parts;
    payloadB64 = bodyB64;
    signature = sig;
    toVerify = `${headerB64}.${bodyB64}`;
  } else {
    const [bodyB64, sig] = parts;
    payloadB64 = bodyB64;
    signature = sig;
    toVerify = bodyB64;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(toVerify);
  const expectedSig = hmac.digest('base64url');

  if (signature.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
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
