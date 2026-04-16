const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const supabase = require("../services/database");

function generateSlug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) +
    "-" +
    Date.now().toString(36)
  );
}

async function resolveEventIdentifier(identifier) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .or(`id.eq.${identifier},slug.eq.${identifier}`)
    .maybeSingle();

  return { event: data, error };
}

router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    let query = supabase
      .from("events")
      .select(
        `
        id, name, slug, date, venue, status, created_at,
        photos(count)
      `,
      )
      .order("date", { ascending: false });

    if (slug) {
      query = query.eq("slug", slug);
    }

    const { data: events, error } = await query;
    if (error) throw error;
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:idOrSlug", async (req, res) => {
  try {
    const { event, error } = await resolveEventIdentifier(req.params.idOrSlug);
    if (error || !event)
      return res.status(404).json({ error: "Event not found" });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      date,
      venue,
      clientName,
      clientEmail,
      branding = {},
      settings = {},
    } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: "Name and date are required" });
    }

    const eventId = uuidv4();
    const slug = generateSlug(name);

    const defaultBranding = {
      eventName: name,
      primaryColor: "#1a1a2e",
      secondaryColor: "#ffffff",
      footerText: name,
      overlayText: "",
      showDate: true,
      template: "classic",
      logoUrl: null,
      ...branding,
    };

    const defaultSettings = {
      countdownSeconds: 3,
      photosPerSession: 1,
      allowRetakes: true,
      allowAI: true,
      allowGIF: true,
      allowBoomerang: true,
      allowPrint: true,
      printCopies: 1,
      aiStyles: [
        "anime",
        "vintage",
        "watercolor",
        "cyberpunk",
        "oilpainting",
        "comic",
      ],
      sessionTimeout: 60,
      operatorPin: "1234",
      ...settings,
    };

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        id: eventId,
        name,
        slug,
        date,
        venue: venue || "",
        client_name: clientName || "",
        client_email: clientEmail || "",
        branding: defaultBranding,
        settings: defaultSettings,
        status: "active",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error("Event creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:idOrSlug", async (req, res) => {
  try {
    const { event, error: lookupError } = await resolveEventIdentifier(
      req.params.idOrSlug,
    );
    if (lookupError || !event)
      return res.status(404).json({ error: "Event not found" });

    const { data: updatedEvent, error } = await supabase
      .from("events")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", event.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, event: updatedEvent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:idOrSlug", async (req, res) => {
  try {
    const { event, error: lookupError } = await resolveEventIdentifier(
      req.params.idOrSlug,
    );
    if (lookupError || !event)
      return res.status(404).json({ error: "Event not found" });

    const { error } = await supabase
      .from("events")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", event.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:idOrSlug/stats", async (req, res) => {
  try {
    const { event, error: lookupError } = await resolveEventIdentifier(
      req.params.idOrSlug,
    );
    if (lookupError || !event)
      return res.status(404).json({ error: "Event not found" });

    const [photosResult, analyticsResult] = await Promise.all([
      supabase
        .from("photos")
        .select("mode, created_at, session_id")
        .eq("event_id", event.id),
      supabase
        .from("analytics")
        .select("action, created_at")
        .eq("event_id", event.id),
    ]);

    const photos = photosResult.data || [];
    const analytics = analyticsResult.data || [];

    const stats = {
      totalPhotos: photos.length,
      totalGIFs: photos.filter((p) => p.mode === "gif").length,
      totalBoomerangs: photos.filter((p) => p.mode === "boomerang").length,
      totalStrips: photos.filter((p) => p.mode === "strip").length,
      totalAIGenerated: analytics.filter((a) => a.action === "ai_generated")
        .length,
      totalShares: analytics.filter((a) => a.action === "photo_shared").length,
      totalPrints: analytics.filter((a) => a.action === "photo_printed").length,
      totalSessions: new Set(photos.map((p) => p.session_id).filter(Boolean))
        .size,
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
