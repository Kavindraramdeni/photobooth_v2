const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

/**
 * POST /api/analytics/track
 * Track a user action
 */
router.post('/track', async (req, res) => {
  try {
    const { eventId, action, metadata = {} } = req.body;
    if (!eventId || !action) return res.status(400).json({ error: 'eventId and action required' });

    await supabase.from('analytics').insert({
      event_id: eventId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get overall dashboard stats (all events)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResult, photosResult, analyticsResult] = await Promise.all([
      supabase.from('events').select('id, name, date, status').eq('status', 'active'),
      supabase.from('photos').select('event_id, mode, created_at').gte('created_at', since),
      supabase.from('analytics').select('event_id, action, created_at').gte('created_at', since),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];
    const events = eventsResult.data || [];

    // Build daily stats for chart
    const dailyStats = {};
    photos.forEach((p) => {
      const day = p.created_at.split('T')[0];
      if (!dailyStats[day]) dailyStats[day] = { photos: 0, gifs: 0, ai: 0 };
      if (p.mode === 'single') dailyStats[day].photos++;
      if (p.mode === 'gif' || p.mode === 'boomerang') dailyStats[day].gifs++;
      if (p.mode === 'ai') dailyStats[day].ai++;
    });

    // Per-event stats
    const eventStats = events.map((e) => {
      const eventPhotos = photos.filter((p) => p.event_id === e.id);
      const eventAnalytics = analytics.filter((a) => a.event_id === e.id);
      return {
        ...e,
        photoCount: eventPhotos.length,
        shareCount: eventAnalytics.filter((a) => a.action === 'photo_shared').length,
        printCount: eventAnalytics.filter((a) => a.action === 'photo_printed').length,
        aiCount: eventAnalytics.filter((a) => a.action === 'ai_generated').length,
      };
    });

    res.json({
      summary: {
        totalEvents: events.length,
        totalPhotos: photos.filter((p) => p.mode === 'single').length,
        totalGIFs: photos.filter((p) => ['gif', 'boomerang'].includes(p.mode)).length,
        totalAI: photos.filter((p) => p.mode === 'ai').length,
        totalShares: analytics.filter((a) => a.action === 'photo_shared').length,
        totalPrints: analytics.filter((a) => a.action === 'photo_printed').length,
      },
      dailyStats: Object.entries(dailyStats)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      eventStats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
