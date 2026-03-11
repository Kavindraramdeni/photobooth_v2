const supabase = require('../services/database');

// ─── Plan feature definitions ─────────────────────────────────────────────────
const PLAN_FEATURES = {
  free: {
    eventLimit: 2,
    photoLimit: 100,
    aiFilters: false,
    aiGenerative: false,
    gifBoomerang: false,
    stripMode: false,
    branding: false,
    analytics: false,
    webhook: false,
    whiteLabel: false,
    galleryDays: 3,
  },
  starter: {
    eventLimit: 5,
    photoLimit: 500,
    aiFilters: true,
    aiGenerative: false,
    gifBoomerang: true,
    stripMode: false,
    branding: true,
    analytics: false,
    webhook: false,
    whiteLabel: false,
    galleryDays: 7,
  },
  pro: {
    eventLimit: -1,
    photoLimit: 5000,
    aiFilters: true,
    aiGenerative: true,
    gifBoomerang: true,
    stripMode: true,
    branding: true,
    analytics: true,
    webhook: true,
    whiteLabel: false,
    galleryDays: 30,
  },
  business: {
    eventLimit: -1,
    photoLimit: -1,
    aiFilters: true,
    aiGenerative: true,
    gifBoomerang: true,
    stripMode: true,
    branding: true,
    analytics: true,
    webhook: true,
    whiteLabel: true,
    galleryDays: 90,
  },
};

// ─── Get a user's current plan + features ────────────────────────────────────
async function getUserPlanFeatures(userId) {
  const { data } = await supabase
    .from('user_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single();

  const activePlan = (data && ['active', 'trialing'].includes(data.status)) ? data.plan : 'free';
  const features = PLAN_FEATURES[activePlan] || PLAN_FEATURES.free;
  return { plan: activePlan, features };
}

// ─── requireFeature(featureName) ─────────────────────────────────────────────
// Usage: router.post('/ai', requireAuth, requireFeature('aiFilters'), handler)
function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const { plan, features } = await getUserPlanFeatures(req.user.id);
      if (!features[featureName]) {
        return res.status(403).json({
          error: `This feature requires a higher plan`,
          feature: featureName,
          currentPlan: plan,
          upgradeUrl: '/pricing',
        });
      }
      req.planFeatures = features;
      req.userPlan = plan;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// ─── checkEventLimit ──────────────────────────────────────────────────────────
// Middleware to check event creation limit before POST /api/events
async function checkEventLimit(req, res, next) {
  try {
    const { plan, features } = await getUserPlanFeatures(req.user.id);

    if (features.eventLimit === -1) {
      req.planFeatures = features;
      req.userPlan = plan;
      return next();
    }

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', req.user.id)
      .gte('created_at', monthStart);

    if ((count || 0) >= features.eventLimit) {
      return res.status(403).json({
        error: `You've reached your ${features.eventLimit} event limit for this month`,
        currentPlan: plan,
        eventsThisMonth: count,
        eventLimit: features.eventLimit,
        upgradeUrl: '/pricing',
      });
    }

    req.planFeatures = features;
    req.userPlan = plan;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── checkPhotoLimit ──────────────────────────────────────────────────────────
// Middleware to check photo quota before POST /api/photos/upload
async function checkPhotoLimit(req, res, next) {
  try {
    const { plan, features } = await getUserPlanFeatures(req.user.id);

    if (features.photoLimit === -1) {
      req.planFeatures = features;
      req.userPlan = plan;
      return next();
    }

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // Get all events owned by this user
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('owner_id', req.user.id);

    const eventIds = (events || []).map(e => e.id);

    let photoCount = 0;
    if (eventIds.length > 0) {
      const { count } = await supabase
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .gte('created_at', monthStart);
      photoCount = count || 0;
    }

    if (photoCount >= features.photoLimit) {
      return res.status(403).json({
        error: `You've reached your ${features.photoLimit} photo limit for this month`,
        currentPlan: plan,
        photosThisMonth: photoCount,
        photoLimit: features.photoLimit,
        upgradeUrl: '/pricing',
      });
    }

    req.planFeatures = features;
    req.userPlan = plan;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { requireFeature, checkEventLimit, checkPhotoLimit, getUserPlanFeatures, PLAN_FEATURES };
