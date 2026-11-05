const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../utils/token');
const supabase = require('../services/database');

/**
 * requireBoothSession middleware
 * Validates either:
 *  1. X-Booth-Session header (signed booth or operator token) matching eventId
 *  2. Authorization: Bearer <token> (signed booth/operator token OR owner token/Supabase JWT)
 * Rejects unauthorized uploads with HTTP 403 Forbidden
 */
async function requireBoothSession(req, res, next) {
  try {
    const boothHeader = req.headers['x-booth-session'];
    const authHeader = req.headers.authorization;
    let token = boothHeader;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token && req.body) {
      token = req.body.sessionToken || req.body.boothToken;
    }

    if (!token) {
      return res.status(403).json({ error: 'Valid event booth session required' });
    }

    const targetEventId = req.body?.eventId || req.params?.id || req.params?.eventId || req.query?.eventId;

    // 1. Check if token is a signed scoped token (booth or operator)
    const sessionPayload = verifyToken(token);
    if (sessionPayload && (sessionPayload.role === 'booth' || sessionPayload.role === 'operator')) {
      if (targetEventId && sessionPayload.eventId && sessionPayload.eventId !== targetEventId) {
        return res.status(403).json({ error: 'Valid event booth session required' });
      }
      req.boothSession = sessionPayload;
      req.sessionEventId = sessionPayload.eventId;
      return next();
    }

    // 2. Check if token is a signed owner token
    if (sessionPayload) {
      const ownerId = sessionPayload.sub || sessionPayload.id;
      if (targetEventId && ownerId) {
        const { data: event } = await supabase
          .from('events')
          .select('id, owner_id')
          .eq('id', targetEventId)
          .maybeSingle();

        if (event && event.owner_id === ownerId) {
          req.user = { id: ownerId, role: sessionPayload.role || 'owner' };
          return next();
        }
      }
    }

    // 3. Check database auth client (supports mockDb in test suite)
    if (supabase.auth && typeof supabase.auth.getUser === 'function') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          if (targetEventId) {
            const { data: event } = await supabase
              .from('events')
              .select('id, owner_id')
              .eq('id', targetEventId)
              .maybeSingle();

            if (!event || event.owner_id !== user.id) {
              return res.status(403).json({ error: 'Valid event booth session required' });
            }
          }
          req.user = user;
          return next();
        }
      } catch (e) {
        // Continue to external check
      }
    }

    // 4. Check if token is an authenticated event owner Supabase JWT (production)
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      try {
        const supabaseUser = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY || 'anon-key',
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user }, error } = await supabaseUser.auth.getUser();

        if (!error && user) {
          if (targetEventId) {
            const { data: event } = await supabase
              .from('events')
              .select('id, owner_id')
              .eq('id', targetEventId)
              .maybeSingle();

            if (!event || event.owner_id !== user.id) {
              return res.status(403).json({ error: 'Valid event booth session required' });
            }
          }
          req.user = user;
          return next();
        }
      } catch (authErr) {
        // Fall through to 403
      }
    }

    return res.status(403).json({ error: 'Valid event booth session required' });
  } catch (err) {
    console.error('Booth session verification error:', err);
    return res.status(403).json({ error: 'Valid event booth session required' });
  }
}

module.exports = requireBoothSession;
