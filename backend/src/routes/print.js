const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const requireAuth = require('../middleware/requireAuth');
const { verifyToken } = require('../utils/token');

/**
 * Helper to check event operator or owner permission
 */
async function authorizeEventAccess(req, eventId) {
  // Check Supabase Auth user
  if (req.user?.id) {
    const { data: event } = await supabase
      .from('events')
      .select('id, owner_id')
      .eq('id', eventId)
      .eq('owner_id', req.user.id)
      .maybeSingle();
    if (event) return { role: 'owner', eventId };
  }

  // Check Bearer token (operator / booth)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const parsed = verifyToken(token);
    if (parsed && (parsed.role === 'operator' || parsed.role === 'booth') && parsed.eventId === eventId) {
      return parsed;
    }
  }

  return null;
}

/**
 * POST /api/print/queue
 * Enqueue a new photo print job
 */
router.post('/queue', async (req, res) => {
  try {
    const { eventId, photoId, copies = 1, layout = '4x6', printerId } = req.body;

    if (!eventId || !photoId) {
      return res.status(400).json({ error: 'eventId and photoId are required' });
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, status')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'active') {
      return res.status(404).json({ error: 'Active event not found' });
    }

    const { data: job, error } = await supabase
      .from('print_jobs')
      .insert({
        event_id: eventId,
        photo_id: photoId,
        copies: Math.max(1, Math.min(copies, 10)),
        layout,
        printer_id: printerId || 'default-printer',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Track analytics
    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'photo_printed',
      metadata: { photoId, copies, layout, jobId: job.id },
    }).catch(() => {});

    // Notify kiosk & printer manager via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('print-job-created', job);
    }

    res.status(201).json({ success: true, job });
  } catch (err) {
    console.error('Print queue error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/print/queue/:eventId
 * Retrieve pending or recent print jobs
 */
router.get('/queue/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('print_jobs')
      .select('*, photos(url, thumb_url, mode)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    res.json({ jobs: jobs || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/print/queue/:jobId
 * Update print job status (e.g. printing, completed, failed)
 */
router.patch('/queue/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, errorMessage } = req.body;

    const validStatuses = ['pending', 'printing', 'completed', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const { data: job, error } = await supabase
      .from('print_jobs')
      .update({
        ...(status && { status }),
        ...(errorMessage !== undefined && { error_message: errorMessage }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${job.event_id}`).emit('print-job-updated', job);
    }

    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
