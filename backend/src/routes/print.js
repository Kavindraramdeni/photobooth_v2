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
    const { eventId, photoId, copies = 1, layout = '4x6', printerId, silent = true } = req.body;

    if (!eventId || !photoId) {
      return res.status(400).json({ error: 'eventId and photoId are required' });
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, status, settings')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'active') {
      return res.status(404).json({ error: 'Active event not found' });
    }

    const copiesCount = Math.max(1, Math.min(Number(copies) || 1, 10));

    // Calculate updated paper count
    const settings = event.settings || {};
    const rollCapacity = Number(settings.rollCapacity) || 400;
    const currentPaper = settings.paperRemaining !== undefined ? Number(settings.paperRemaining) : rollCapacity;
    const newPaper = Math.max(0, currentPaper - copiesCount);

    const { data: job, error } = await supabase
      .from('print_jobs')
      .insert({
        event_id: eventId,
        photo_id: photoId,
        copies: copiesCount,
        layout,
        printer_id: printerId || settings.printerName || 'DNP DS620 Dye-Sub',
        status: 'pending',
      })
      .select('*, photos(url, thumb_url, mode)')
      .single();

    if (error) throw error;

    // Update event settings paper count
    await supabase
      .from('events')
      .update({
        settings: {
          ...settings,
          paperRemaining: newPaper,
        },
      })
      .eq('id', eventId)
      .catch(() => {});

    // Track analytics
    await supabase.from('analytics').insert({
      event_id: eventId,
      action: 'photo_printed',
      metadata: { photoId, copies: copiesCount, layout, jobId: job.id, silent },
    }).catch(() => {});

    // Notify kiosk & printer manager via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('print-job-created', job);
      io.to(`event-${eventId}`).emit('printer-status-updated', {
        printerName: settings.printerName || 'DNP DS620 Dye-Sub',
        status: newPaper <= 10 ? 'paper_low' : 'printing',
        paperRemaining: newPaper,
        rollCapacity,
        paperPercentage: Math.round((newPaper / rollCapacity) * 100),
      });
    }

    res.status(201).json({
      success: true,
      job,
      paperRemaining: newPaper,
      rollCapacity,
    });
  } catch (err) {
    console.error('Print queue error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/print/status/:eventId
 * Retrieve live printer telemetry, queue count, and paper supply
 */
router.get('/status/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, settings')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const settings = event.settings || {};
    const rollCapacity = Number(settings.rollCapacity) || 400;
    const paperRemaining = settings.paperRemaining !== undefined ? Number(settings.paperRemaining) : rollCapacity;
    const paperPercentage = Math.round((paperRemaining / rollCapacity) * 100);

    // Get queue counts
    const { data: queueJobs } = await supabase
      .from('print_jobs')
      .select('status')
      .eq('event_id', eventId);

    const jobs = queueJobs || [];
    const pendingCount = jobs.filter(j => j.status === 'pending' || j.status === 'printing').length;
    const completedCount = jobs.filter(j => j.status === 'completed').length;

    let printerStatus = 'ready';
    if (paperRemaining <= 0) {
      printerStatus = 'paper_out';
    } else if (paperRemaining <= 35) {
      printerStatus = 'paper_low';
    } else if (pendingCount > 0) {
      printerStatus = 'printing';
    }

    res.json({
      success: true,
      printer: {
        name: settings.printerName || 'DNP DS620 Dye-Sub (4×6)',
        status: printerStatus,
        paperRemaining,
        rollCapacity,
        paperPercentage,
        silentPrinting: settings.silentPrinting !== false,
        pendingJobs: pendingCount,
        completedJobs: completedCount,
        totalJobs: jobs.length,
      },
    });
  } catch (err) {
    console.error('Printer status error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/print/status/:eventId
 * Update printer configuration (name, silent print, paper limits)
 */
router.post('/status/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { printerName, silentPrinting, rollCapacity, paperRemaining } = req.body;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, settings')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updatedSettings = {
      ...(event.settings || {}),
      ...(printerName !== undefined && { printerName }),
      ...(silentPrinting !== undefined && { silentPrinting: Boolean(silentPrinting) }),
      ...(rollCapacity !== undefined && { rollCapacity: Number(rollCapacity) }),
      ...(paperRemaining !== undefined && { paperRemaining: Number(paperRemaining) }),
    };

    const { error: updateErr } = await supabase
      .from('events')
      .update({ settings: updatedSettings })
      .eq('id', eventId);

    if (updateErr) throw updateErr;

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('printer-status-updated', {
        printerName: updatedSettings.printerName,
        silentPrinting: updatedSettings.silentPrinting,
        paperRemaining: updatedSettings.paperRemaining,
        rollCapacity: updatedSettings.rollCapacity,
      });
    }

    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/print/reset-roll/:eventId
 * Reset paper count to fresh roll capacity (e.g. 400 prints)
 */
router.post('/reset-roll/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { capacity } = req.body;

    const { data: event } = await supabase
      .from('events')
      .select('id, settings')
      .eq('id', eventId)
      .maybeSingle();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const rollCapacity = Number(capacity) || Number(event.settings?.rollCapacity) || 400;

    const updatedSettings = {
      ...(event.settings || {}),
      rollCapacity,
      paperRemaining: rollCapacity,
    };

    await supabase
      .from('events')
      .update({ settings: updatedSettings })
      .eq('id', eventId);

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('printer-status-updated', {
        status: 'ready',
        paperRemaining: rollCapacity,
        rollCapacity,
        paperPercentage: 100,
      });
    }

    res.json({ success: true, paperRemaining: rollCapacity, rollCapacity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/print/reprint/:jobId
 * 1-Click reprint of any past print job
 */
router.post('/reprint/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: originalJob, error } = await supabase
      .from('print_jobs')
      .select('*, photos(url, thumb_url, mode)')
      .eq('id', jobId)
      .maybeSingle();

    if (error || !originalJob) {
      return res.status(404).json({ error: 'Original print job not found' });
    }

    // Insert new print job
    const { data: newJob, error: insertErr } = await supabase
      .from('print_jobs')
      .insert({
        event_id: originalJob.event_id,
        photo_id: originalJob.photo_id,
        copies: originalJob.copies || 1,
        layout: originalJob.layout || '4x6',
        printer_id: originalJob.printer_id,
        status: 'pending',
      })
      .select('*, photos(url, thumb_url, mode)')
      .single();

    if (insertErr) throw insertErr;

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${originalJob.event_id}`).emit('print-job-created', newJob);
    }

    res.json({ success: true, job: newJob });
  } catch (err) {
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
