const { createClient } = require('@supabase/supabase-js');

/**
 * requireAuth middleware
 * Validates Supabase JWT from Authorization: Bearer <token>
 * Attaches req.user = { id, email, ... } on success
 * Returns 401 if missing or invalid
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.split(' ')[1];

    // Create a per-request client using the user's JWT
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabaseUser.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    req.supabaseUser = supabaseUser;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = requireAuth;
