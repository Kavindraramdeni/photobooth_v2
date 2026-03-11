const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const requireAuth = require('../middleware/requireAuth');

// Service-role client for admin operations (creating users etc.)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Anon client for auth operations (login etc.)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * POST /api/auth/signup
 * Create a new user account
 * Body: { email, password, name }
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: false, // Sends verification email
    });

    if (error) {
      // Surface friendly errors
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      userId: data.user.id,
    });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Sign in with email + password, returns JWT
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login')) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (error.message.includes('Email not confirmed')) {
        return res.status(401).json({ error: 'Please verify your email before logging in' });
      }
      throw error;
    }

    res.json({
      success: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || '',
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/refresh
 * Exchange a refresh token for a new access token
 * Body: { refreshToken }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });

    if (error) return res.status(401).json({ error: 'Invalid refresh token' });

    res.json({
      success: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.user_metadata?.name || '',
      createdAt: req.user.created_at,
    },
  });
});

/**
 * POST /api/auth/logout
 * Signs out the current session
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await req.supabaseUser.auth.signOut();
    res.json({ success: true });
  } catch (error) {
    // Always succeed on logout - client should clear tokens regardless
    res.json({ success: true });
  }
});

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email
 * Body: { email }
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const redirectTo = `${process.env.FRONTEND_URL}/reset-password`;

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) throw error;

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If an account exists, a reset email has been sent.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/auth/update-profile
 * Update display name
 */
router.patch('/update-profile', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      user_metadata: { name: name.trim() },
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires current password verification)
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    // Verify current password by attempting sign-in
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });
    if (signInError) return res.status(401).json({ error: 'Current password is incorrect' });

    // Update password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: newPassword });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
