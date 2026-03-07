const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

// Lazy-load stripe so missing STRIPE_SECRET_KEY doesn't crash the server at startup.
// Routes will return 503 if key is not configured.
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: ['1 active event', '500 photos/month', 'QR sharing', 'Basic AI filters', '7-day gallery'],
    eventLimit: 1,
    photoLimit: 500,
    aiGenerations: 50,
    galleryDays: 7,
  },
  pro: {
    name: 'Pro',
    price: 79,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: ['Unlimited events', '5000 photos/month', 'AI generative images', 'GIF & Boomerang', '30-day gallery', 'Analytics dashboard'],
    eventLimit: -1, // unlimited
    photoLimit: 5000,
    aiGenerations: 500,
    galleryDays: 30,
  },
  business: {
    name: 'Business',
    price: 149,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    features: ['Unlimited everything', 'White-label branding', 'Multi-operator', 'Priority support', '90-day gallery', 'Custom domain'],
    eventLimit: -1,
    photoLimit: -1,
    aiGenerations: -1,
    galleryDays: 90,
  },
};

// ─── GET /api/billing/plans ───────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// ─── POST /api/billing/checkout ──────────────────────────────────────────────
// Creates a Stripe Checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { planKey, operatorEmail, operatorName, isAnnual = false } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    // Check if operator already exists
    let { data: operator } = await supabase
      .from('operators')
      .select('*')
      .eq('email', operatorEmail)
      .single();

    // Create Stripe customer if new
    let customerId = operator?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: operatorEmail,
        name: operatorName,
        metadata: { plan: planKey },
      });
      customerId = customer.id;
    }

    // Build line items — pay-per-event uses one-time price
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: isAnnual ? plan.annualPriceId : plan.priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7, // 7-day free trial on all plans
        metadata: { planKey, operatorEmail },
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscribed=true&plan=${planKey}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?cancelled=true`,
      allow_promotion_codes: true,
      metadata: { planKey, operatorEmail, operatorName },
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/billing/checkout/event ────────────────────────────────────────
// Pay-per-event: one-time $19 charge
router.post('/checkout/event', async (req, res) => {
  try {
    const { operatorEmail, operatorName, eventName } = req.body;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Single Event Access',
              description: `SnapBooth AI — ${eventName || 'One Event'}`,
            },
            unit_amount: 1900, // $19
          },
          quantity: 1,
        },
      ],
      customer_email: operatorEmail,
      success_url: `${process.env.FRONTEND_URL}/dashboard?event_paid=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { type: 'per_event', operatorEmail, operatorName, eventName },
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/billing/portal ────────────────────────────────────────────────
// Opens Stripe Customer Portal for self-service billing management
router.post('/portal', async (req, res) => {
  try {
    const { operatorEmail } = req.body;

    const { data: operator } = await supabase
      .from('operators')
      .select('stripe_customer_id')
      .eq('email', operatorEmail)
      .single();

    if (!operator?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: operator.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({ portalUrl: portalSession.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/billing/webhook ───────────────────────────────────────────────
// Stripe webhook — keep subscription status in sync
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { planKey, operatorEmail, operatorName } = session.metadata;

        // Upsert operator record
        await supabase.from('operators').upsert({
          email: operatorEmail,
          name: operatorName || '',
          plan: planKey || 'per_event',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: 'trialing',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });

        console.log(`✅ New subscription: ${operatorEmail} → ${planKey}`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('operators')
          .update({
            subscription_status: sub.status,
            plan: sub.metadata?.planKey || 'none',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await supabase
          .from('operators')
          .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', invoice.customer);
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/billing/status ─────────────────────────────────────────────────
router.get('/status/:email', async (req, res) => {
  try {
    const { data: operator } = await supabase
      .from('operators')
      .select('plan, subscription_status, trial_ends_at, created_at')
      .eq('email', decodeURIComponent(req.params.email))
      .single();

    if (!operator) return res.json({ status: 'none', plan: null });

    const isActive = ['active', 'trialing'].includes(operator.subscription_status);
    const isTrialing = operator.subscription_status === 'trialing';
    const trialDaysLeft = isTrialing
      ? Math.max(0, Math.ceil((new Date(operator.trial_ends_at) - Date.now()) / 86400000))
      : 0;

    res.json({
      status: operator.subscription_status,
      plan: operator.plan,
      isActive,
      isTrialing,
      trialDaysLeft,
      planDetails: PLANS[operator.plan] || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
