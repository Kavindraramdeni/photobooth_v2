const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../utils/token');
const supabase = require('../services/database');

/**
 * requireAuth middleware
 * Validates:
 * 1. Scoped or signed token via verifyToken
 * 2. Supabase JWT via database.auth.getUser or createClient
 * Attaches req.user = { id, email, role, ... } on success
 * Returns 401 if missing or invalid
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Check if it's a signed or scoped token (operator/staff/booth/owner/user)
    const scoped = verifyToken(token);
    if (scoped) {
      req.user = {
        id: scoped.sub || scoped.id || `${scoped.role}:${scoped.eventId}`,
        role: scoped.role || 'user',
        eventId: scoped.eventId,
        email: scoped.email,
      };
      req.isScopedToken = true;
      return next();
    }

    // 2. Check active database auth client (supports mockDb in test suite)
    if (supabase.auth && typeof supabase.auth.getUser === 'function') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          req.user = { ...user, role: user.role || 'user' };
          return next();
        }
      } catch (e) {
        // Continue to external check
      }
    }

    // 3. Otherwise validate as Supabase user JWT if valid project URL is present
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      const supabaseUser = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || 'anon-key',
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: { user }, error } = await supabaseUser.auth.getUser();

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.user = { ...user, role: user.role || 'user' };
      req.supabaseUser = supabaseUser;
      return next();
    }

    return res.status(401).json({ error: 'Invalid or expired token' });
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = requireAuth;
