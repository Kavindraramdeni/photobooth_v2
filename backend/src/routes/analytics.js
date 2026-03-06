/**
 * backend/src/routes/analytics.js  (FULL REPLACEMENT)
 *
 * Routes:
 *   POST /api/analytics/track               — log any action
 *   GET  /api/analytics/dashboard           — all events summary
 *   GET  /api/analytics/event/:eventId      — per-event charts + stats
 *     ?range=today|7d|30d (default 7d)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// ─── POST /track ─────────────────────────────────────────────────────────────

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /dashboard ───────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResult, photosResult, analyticsResult] = await Promise.all([
      supabase.from('events').select('id, name, date, status').eq('status', 'active'),
      supabase.from('photos').select('event_id, mode, created_at').gte('created_at', since),
      supabase.from('analytics').select('event_id, action, created_at').gte('created_at', since),
    ]);

    const photos    = photosResult.data    || [];
    const analytics = analyticsResult.data || [];
    const events    = eventsResult.data    || [];

    const dailyStats = {};
    photos.forEach(p => {
      const day = p.created_at.split('T')[0];
      if (!dailyStats[day]) dailyStats[day] = { photos: 0, gifs: 0, ai: 0 };
      if (p.mode === 'single' || p.mode === 'strip') dailyStats[day].photos++;
      if (p.mode === 'gif' || p.mode === 'boomerang')  dailyStats[day].gifs++;
      if (p.mode === 'ai')                              dailyStats[day].ai++;
    });

    const eventStats = events.map(e => {
      const ep = photos.filter(p => p.event_id === e.id);
      const ea = analytics.filter(a => a.event_id === e.id);
      return {
        ...e,
        photoCount: ep.length,
        shareCount: ea.filter(a => a.action === 'photo_shared').length,
        printCount: ea.filter(a => a.action === 'photo_printed').length,
        aiCount:    ea.filter(a => a.action === 'ai_generated').length,
      };
    });

    res.json({
      summary: {
        totalEvents:  events.length,
        totalPhotos:  photos.filter(p => ['single', 'strip'].includes(p.mode)).length,
        totalGIFs:    photos.filter(p => ['gif', 'boomerang'].includes(p.mode)).length,
        totalAI:      photos.filter(p => p.mode === 'ai').length,
        totalShares:  analytics.filter(a => a.action === 'photo_shared').length,
        totalPrints:  analytics.filter(a => a.action === 'photo_printed').length,
      },
      dailyStats: Object.entries(dailyStats)
        .map(([date, s]) => ({ date, ...s }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      eventStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /event/:eventId ──────────────────────────────────────────────────────
// Returns per-event analytics including hourly breakdown, mode pie, daily chart.

router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { range = '7d' } = req.query;

    // Calculate since date
    const rangeMs = range === 'today'
      ? Date.now() - (new Date().getHours() * 3600 + new Date().getMinutes() * 60) * 1000
      : range === '7d'  ? Date.now() - 7  * 86400_000
      :                   Date.now() - 30 * 86400_000;
    const since = new Date(rangeMs).toISOString();

    const [photosResult, analyticsResult] = await Promise.all([
      supabase.from('photos')
        .select('id, mode, created_at')
        .eq('event_id', eventId)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
      supabase.from('analytics')
        .select('action, created_at, metadata')
        .eq('event_id', eventId)
        .gte('created_at', since),
    ]);

    const photos    = photosResult.data    || [];
    const analytics = analyticsResult.data || [];

    // ── Daily breakdown ──────────────────────────────────────────────────────
    const dailyMap = {};
    photos.forEach(p => {
      const day = p.created_at.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, photos: 0, gifs: 0, ai: 0 };
      if (['single', 'strip'].includes(p.mode))  dailyMap[day].photos++;
      if (['gif', 'boomerang'].includes(p.mode)) dailyMap[day].gifs++;
      if (p.mode === 'ai')                        dailyMap[day].ai++;
    });
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // ── Hourly breakdown ─────────────────────────────────────────────────────
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: `${String(h).padStart(2, '0')}:00`, photos: 0 };
    }
    photos.forEach(p => {
      const h = new Date(p.created_at).getHours();
      hourlyMap[h].photos++;
    });
    // Only include hours with activity ±2 hours for cleaner chart
    const activeHours = Object.values(hourlyMap).filter(h => h.photos > 0);
    const hourly = Object.values(hourlyMap); // all 24 for full heatmap

    // ── Peak hour ────────────────────────────────────────────────────────────
    const peakHour = activeHours.reduce(
      (best, h) => (h.photos > (best?.photos || 0) ? h : best),
      null
    )?.hour || null;

    // ── Mode breakdown (pie chart) ───────────────────────────────────────────
    const modeCounts = { Photo: 0, Strip: 0, GIF: 0, Boomerang: 0, AI: 0 };
    photos.forEach(p => {
      if (p.mode === 'single')    modeCounts['Photo']++;
      if (p.mode === 'strip')     modeCounts['Strip']++;
      if (p.mode === 'gif')       modeCounts['GIF']++;
      if (p.mode === 'boomerang') modeCounts['Boomerang']++;
      if (p.mode === 'ai')        modeCounts['AI']++;
    });
    const modeColors = {
      Photo: '#7c3aed', Strip: '#a855f7', GIF: '#06b6d4',
      Boomerang: '#0ea5e9', AI: '#f59e0b',
    };
    const modes = Object.entries(modeCounts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: modeColors[name] || '#888' }));

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalShares  = analytics.filter(a => a.action === 'photo_shared').length;
    const totalEmails  = analytics.filter(a => a.action === 'photo_emailed').length;
    const totalSMS     = analytics.filter(a => a.action === 'photo_sms_sent').length;
    const totalPrints  = analytics.filter(a => a.action === 'photo_printed').length;
    const shareRate    = photos.length > 0
      ? Math.round((totalShares / photos.length) * 100) : 0;

    res.json({
      summary: {
        totalPhotos: photos.filter(p => ['single', 'strip'].includes(p.mode)).length,
        totalGIFs:   photos.filter(p => ['gif', 'boomerang'].includes(p.mode)).length,
        totalAI:     photos.filter(p => p.mode === 'ai').length,
        totalShares,
        totalEmails,
        totalSMS,
        totalPrints,
        shareRate,
        peakHour,
        avgSessionMin: 2, // placeholder — would need session tracking to compute
      },
      daily,
      hourly,
      modes,
    });
  } catch (err) {
    console.error('/api/analytics/event error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
