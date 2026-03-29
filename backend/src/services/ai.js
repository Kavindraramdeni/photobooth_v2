/**
 * backend/src/services/ai.js
 *
 * AI image generation with three-tier approach:
 *
 * TIER 1 — Cloudflare Workers AI (FREE up to 10k requests/day)
 *   Model: @cf/runwayml/stable-diffusion-v1-5-img2img  ← TRUE img2img, transforms YOUR photo
 *   Requires: CF_ACCOUNT_ID + CF_AI_TOKEN env vars
 *   Get free at: dash.cloudflare.com → AI → Workers AI → API Token
 *
 * TIER 2 — HuggingFace Inference API (FREE, slower)
 *   Uses FLUX.1-schnell — text-to-image only (no img2img on free tier)
 *   NOTE: Result will NOT match the guest's face — it's a styled image, not a transformation
 *   Requires: HUGGINGFACE_API_TOKEN env var
 *
 * TIER 3 — Local Sharp filters (INSTANT, zero cost, always works)
 *   Real colour grading applied to the actual guest photo
 *   Looks like Instagram filters — quick and reliable
 */

let sharp;
try {
  sharp = require('sharp');
} catch(e) {
  console.error('[ai] sharp failed to load:', e.message);
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM AI_STYLES — ultra-quality prompts for Gemini
// ══════════════════════════════════════════════════════════════════════════════

const AI_STYLES = {

  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    prompt: `Transform this into a masterpiece anime portrait in the tradition of Studio Ghibli and premium Japanese animation.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's face must remain 100% recognisable. Preserve exact bone structure, eye shape, nose, lips, skin tone, hair colour and length. Identity must be unmistakable.

STYLE DIRECTION: Apply luminous cel-shading with precise ink outlines. Eyes enlarged slightly with catchlight reflections and deep iris detail. Skin rendered in smooth porcelain gradients — warm highlights on brow, nose bridge, cheekbones; cool shadows under chin and jaw. Hair stylised into flowing sections with bold directional highlights and deep shadow separations.

MULTI-PERSON: If multiple people are present, transform ALL of them with equal quality and care. Preserve each person's distinct features, skin tone, and identity. Capture the group dynamic and relationship between subjects.

ENVIRONMENT: Background transformed into a painterly anime landscape — soft bokeh in warm pastels, distant architecture or nature suggested impressionistically. Rich golden-hour or twilight atmosphere.

CINEMATIC QUALITY: Lighting from upper-left with gentle fill from right and a subtle violet rim light. Warm, saturated, harmonious colour palette. Final image should feel extracted from a ₹500 crore anime feature film.`,
    negativePrompt: 'ugly, deformed, extra limbs, poorly drawn face, mutation, watermark, text, nsfw, bad anatomy, wrong proportions, duplicate faces, inconsistent art style',
    strength: 0.78,
  },

  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: `Based on the provided image, generate a cinematic cyberpunk portrait maintaining the exact facial identity, structure, eyes, skin tone, and hair of the young Indian man. He remains leaning on the graffiti wall (now cyberpunk-themed) in the rainy urban tunnel, which is transformed into a dense megacity at night with towering skyscrapers, holographic ads, flying vehicle trails, and rain catching the light. All people present are transformed into a cyberpunk style while retaining their individual looks.

LIGHTING: Dramatic neon rim lighting from the left—electric cyan or cobalt blue tracing cheekbone, ear, and shoulder. Secondary magenta or deep violet fill from the right. Wet skin and clothing reflect neon signage, Chinese characters, corporate holograms, and rain droplets.

WARDROBE: He wears tactical cyberpunk jackets with chrome accents and embedded LED elements, replacing the colorblock windcheater and cargo pants, with hands in pockets.

VEHICLE: The black BMW Mi4 with glowing headlights remains beside him, reflecting the complex neon environment and rain.

COLOUR GRADE: Deep teal and amber shadows, electric blue and magenta highlights, desaturated noir midtones. Final image must look like a high-budget $200M science fiction film still, hyper-realistic, 8K, sharp focus on subject, bokeh background."
  },

  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: `Transform this into an authentic Kodachrome 64 portrait from the early 1970s.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's exact features, expression, skin tone, hair, and clothing must be fully preserved. Their identity must remain unmistakable.

FILM CHARACTERISTICS: Introduce visible organic film grain across the entire frame — not digital noise, but genuine silver halide texture. Colour palette replicates Kodachrome: warm golden-amber midtones, milky lifted blacks, desaturated cool tones, rich warm skin rendition. Highlights bloom softly with halation around bright areas. Shadows have warm brownish-green cast.

LENS CHARACTER: Slight vignette darkening the corners as if shot with a vintage 50mm lens. Very subtle chromatic aberration at the edges. Focus is sharp on faces but the background renders in warm, creamy bokeh.

MULTI-PERSON: Apply identical film treatment to ALL people in the frame. Everyone gets the same warm, timeless Kodachrome grade. Capture the warmth of the group relationship — family, friends, the human moment.

MOOD: Timeless, intimate, nostalgic. Like a treasured family photograph discovered in a 1972 album. Skin tones rich and sun-kissed. The overall mood deeply human and irreplaceable.`,
    negativePrompt: 'modern digital look, HDR, oversaturated, cold tones, blue shadows, clean blacks, sharp digital edges, contemporary colour grading',
    strength: 0.58,
  },

  renaissance: {
    name: 'Renaissance',
    emoji: '🎨',
    prompt: `Transform this into a masterwork Renaissance oil painting in the tradition of Leonardo da Vinci, Raphael, and Titian.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's exact facial features, bone structure, eye shape, and likeness must be completely preserved and immediately recognisable.

PAINTING TECHNIQUE: Apply Leonardo's sfumato — imperceptible transitions between light and shadow with no harsh outlines. Skin modelled with translucent glazes, warm amber undertones in highlights, cool blue-grey in deep shadows. Eyes rendered with extraordinary precision — luminous, deep, revealing inner life as only Renaissance masters achieved.

LIGHTING: Single warm light source from upper left at 45 degrees — the classic chiaroscuro of Renaissance portraiture. Rich amber-gold illumination on the lit side, deep warm shadows on the other. The light seems to emanate from within the painting.

MULTI-PERSON: ALL people transformed into Renaissance subjects. Each person receives their own masterful portrait treatment. Clothing rendered in period-appropriate rich fabrics — velvet, silk, brocade — with remarkable textile detail. If it's a group, compose them as a Renaissance group portrait with natural dignity and hierarchy.

BACKGROUND: Dark classical background typical of Flemish portraiture, or a distant Tuscan landscape with soft atmospheric perspective. Gold or dark walnut frame aesthetic implied by the composition.

MUSEUM QUALITY: The final image should appear as a genuine masterwork hanging in the Uffizi or the Louvre. Luminous, technically flawless, deeply human.`,
    negativePrompt: 'modern, digital, cartoon, flat colours, harsh lighting, photography style, contemporary clothing, selfie quality',
    strength: 0.78,
  },

  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: `Transform this into a premium comic book illustration in the style of Alex Ross's painted realism meets Jim Lee's dynamic linework.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's face must remain completely recognisable. Their expressions, features, and identity must be clearly preserved in comic style.

LINEWORK: Bold, confident ink outlines varying from thick 3pt boundary lines around figures to delicate 0.5pt detail lines within. Outlines suggest form and movement — thicker where figures overlap background, lighter on interior detail.

COLOUR AND SHADING: Flat colour fills as the base layer — clean, saturated, primary-leaning comic book palette. Cel-shaded shadows as flat geometric shapes — no photographic gradients, just sharp shadow forms that define anatomy. Bright flat highlight spots on highest points — skull, nose, cheekbones, shoulders.

MULTI-PERSON: Transform ALL people into comic book characters. Each person gets their own heroic or characterful treatment. If it's a group, compose them as a dynamic team — Marvel Cinematic Universe ensemble energy, each character distinct and powerful.

SPECIAL EFFECTS: Ben-Day halftone dots in midtone areas — classic printing heritage. Speed lines or energy effects around the composition to create dynamism. Bold action-oriented background.

FINISH: This should look like the variant cover of a major Marvel or DC title — dramatic, powerful, technically impeccable, worth framing.`,
    negativePrompt: 'realistic photograph, painterly gradients, soft edges, anime, manga, low detail, amateur art, muted colours',
    strength: 0.80,
  },

  statue: {
    name: 'Marble Statue',
    emoji: '🏛️',
    prompt: `Transform every person in this photo into a classical white Carrara marble sculpture.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Despite the stone transformation, every person's exact facial features, bone structure, nose, lips, and overall likeness must remain completely recognisable in marble form.

MARBLE QUALITY: The entire figure carved from brilliant white Carrara marble — the same stone as Michelangelo's David. Realistic stone texture with subtle grey veining running through the marble. The stone should feel heavy, permanent, cool to the touch.

LIGHTING: Dramatic museum-quality studio lighting that reveals the three-dimensionality of the stone. Strong key light from above-left casting deep shadows in eye sockets, under the nose, and below the chin. Secondary fill light prevents total shadow loss. The marble luminosity is captured — it glows slightly from within.

MULTI-PERSON: ALL people in the photo transformed into marble. If it's a group, render them as a classical multi-figure marble tableau — like the Laocoön group or a Bernini composition. Their relative positions and interactions preserved but eternalized in stone.

SETTING: Place the statue(s) in a grand classical museum hall — marble floors, high ceilings with skylights, other classical sculptures visible in the background. Or against pure white for maximum drama.

DETAIL: Clothing transformed into flowing marble-carved drapery with deep fold shadows. Hair carved in stone with remarkable detail — individual strands suggested by the chisel.`,
    negativePrompt: 'color, painted, modern clothing, digital render, cartoon, blurry, low quality, gold or bronze material',
    strength: 0.82,
  },

  eighties: {
    name: '80s Yearbook',
    emoji: '✨',
    prompt: `Transform this into an authentic 1980s high school or college portrait, exactly as if it were taken by the school photographer in 1986.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's exact face, features, expression, and likeness must be fully preserved. Only the styling and photography aesthetic changes.

HAIR AND STYLING: Add period-appropriate 1980s hairstyles — big permed hair for women, feathered or side-parted hair for men, shoulder pads visible in clothing. Polo shirts, blazers with padded shoulders, or preppy sweaters typical of 1980s school portraits.

PHOTOGRAPHY STYLE: The distinctive gradient blue-to-purple studio backdrop used by school photographers in the 1980s. Slightly overexposed skin tones typical of flash photography of the era. Warm, slightly orangey colour cast of 1980s portrait film. Soft-focus quality of a medium-format studio camera. Very subtle film grain.

MULTI-PERSON: ALL people get the full 1980s treatment. If it's a group, render them as a class photo or group portrait — everyone in their 1980s styling, arranged naturally.

AUTHENTICITY: Every detail should scream 1986 — the lighting, the backdrop, the film stock, the styling. This should be completely convincing as a genuine yearbook photo from that era.`,
    negativePrompt: 'modern, 21st century, digital clean look, contemporary clothing, neutral background, HDR, oversaturated',
    strength: 0.70,
  },

  psychedelic: {
    name: 'Psychedelic',
    emoji: '🌈',
    prompt: `Transform this into a breathtaking 1960s psychedelic concert poster illustration.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's face must remain recognisable despite the radical stylistic transformation. Preserve their features, expression, and identity in the illustration.

STYLE: The visual language of Wes Wilson and Victor Moscoso — the masters of psychedelic poster art. Bold outline style with organic flowing forms. Every background element melting into swirling patterns and kaleidoscopic geometric shapes.

COLOUR: Pure saturated electric colours pushed to maximum vibrancy — acid green, hot magenta, electric blue, solar orange, deep violet. Colours that seem to vibrate against each other. No muted tones, no greys, everything at full saturation and brightness.

MULTI-PERSON: ALL people illustrated with equal psychedelic treatment. Their forms integrated into the swirling composition — figures becoming part of the larger pattern while remaining identifiable. Group compositions become a kaleidoscopic vision of interconnected humanity.

DETAILS: Swirling Art Nouveau borders around the composition. Mandala-like geometric patterns in the background. Rainbow halos around figures. The human forms partially dissolving into and emerging from the psychedelic patterns. Flowers, stars, cosmic imagery integrated throughout.

FINISH: No text. Pure image. Should look like an original 1967 Fillmore West poster — the ultimate psychedelic artefact.`,
    negativePrompt: 'realistic, photographic, muted colours, grayscale, modern, text, words, digital clean, subtle',
    strength: 0.85,
  },

  pixelart: {
    name: '8-bit Pixel',
    emoji: '🎮',
    prompt: `Transform this into adorable retro 8-bit pixel art in the style of a 1980s arcade or NES game.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person must remain recognisable as a pixel art character. Their distinctive features — hair colour, skin tone, and overall look — must be clearly represented in pixel form.

PIXEL STYLE: Large, clearly visible square pixels — as if rendered on an 80×80 pixel grid then scaled up. Limited colour palette of 16–32 vivid colours maximum, typical of NES/Famicom hardware. Clean, flat colour fills within each pixel block — no antialiasing, no gradients.

CHARACTER DESIGN: Each person becomes a charming pixel art game character with big expressive pixel eyes and a recognisable silhouette. Clothing simplified into bold colour blocks. Hair represented as coloured pixel shapes that capture the essence of the person's real hair.

MULTI-PERSON: ALL people rendered as pixel characters. If it's a group, they become a party of RPG adventurers or a fighting game character select screen. Each person has their own distinct pixel sprite with different colours and silhouette.

ENVIRONMENT: Bright, colourful pixel art background — a fantasy RPG town, a side-scrolling platformer level, a space shooter background, or an arcade game setting. Health bars, score counters, or other game UI elements optional but charming. Stars, ground tiles, and environmental elements all in matching pixel art style.`,
    negativePrompt: 'smooth, antialiased, photorealistic, high resolution detail, blurry, modern 3D, vector art',
    strength: 0.88,
  },

  daguerreotype: {
    name: '19th Century',
    emoji: '🎩',
    prompt: `Transform this into an authentic mid-19th century daguerreotype portrait, as if captured by a French photographer in 1858.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's exact facial features must be preserved and recognisable. The daguerreotype treatment changes the aesthetic but not the identity.

DAGUERREOTYPE CHARACTERISTICS: The characteristic silver-mirror surface of genuine daguerreotypes — the image appears to float in a metallic sheen that shifts from positive to negative depending on viewing angle. Slightly soft focus typical of early photographic lenses. Long exposure time implied by the stillness and formal pose.

COLOUR AND TONE: Full monochrome with the distinctive warm sepia-silver tone of a daguerreotype — not standard black and white photography, but the specific warm grey-brown tones of silver iodide. Subtle brown oxidation around the edges. The metallic quality of the image surface.

CLOTHING AND STYLING: Transform everyone into period-appropriate Victorian attire. Men in frock coats, cravats, high collars, top hats nearby. Women in Victorian dresses with corsets, high collars, and elaborate hair. Accessories like pocket watches, gloves, and period jewellery.

MULTI-PERSON: ALL people transformed into Victorian subjects. A group becomes a formal Victorian family portrait — stiff, dignified, eternal. The formality and gravity of 19th century portrait photography applied to all subjects.

SETTING: A Victorian portrait studio with draped fabric backdrops, ornate furniture, potted ferns. Or a period outdoor setting. The image should have slight physical imperfections — dust specks, edge vignetting, the occasional chemical irregularity authentic to the period.`,
    negativePrompt: 'modern, colour, casual clothing, digital, sharp clean HDR, contemporary',
    strength: 0.75,
  },

  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: `Transform this into a magnificent Old Master oil painting in the tradition of Rembrandt van Rijn and Johannes Vermeer.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Every person's exact face, features, bone structure, and likeness must be preserved with complete fidelity. They must be immediately recognisable in the painting.

PAINTING TECHNIQUE: Rembrandt's chiaroscuro — figures emerging from deep shadow into warm golden light. Rich, thick impasto texture on lit areas of skin — you can see the brushstrokes where the paint was built up. Thin glazes in shadow areas creating depth and translucency. The characteristic warm amber-brown-gold palette of Old Master painting.

SKIN AND FLESH: Flesh tones built up in layers — cool grey underpainting, warm orange-red mid-layer, final warm golden highlights. The skin glows with inner warmth. Every pore, wrinkle, and expression line rendered with dignity and humanity.

MULTI-PERSON: ALL people painted with equal Old Master quality. A group becomes a Dutch Golden Age group portrait — think The Night Watch. Each person fully realised, their individual characters captured in paint. Their clothing rendered with extraordinary textile detail — velvet, silk, linen, lace all distinguishable by brushstroke technique.

LIGHTING: Single warm light source from upper left — the classic Rembrandt lighting. Deep warm shadows. The background almost entirely dark, with figures emerging from the darkness like they're stepping out of time itself.

CANVAS TEXTURE: Visible canvas weave texture throughout. The painting should look genuinely old — craquelure (fine crack network) in the paint surface suggesting age and authenticity.`,
    negativePrompt: 'modern, digital render, flat colours, cartoon, anime, contemporary photography, sharp clean lines',
    strength: 0.82,
  },

  old: {
    name: 'Aged',
    emoji: '👴',
    prompt: `Age every person in this photo to their 85–95 year old appearance while keeping them completely recognisable.

FACE PRESERVATION — ABSOLUTE REQUIREMENT: Despite the aging, every person must remain immediately recognisable as themselves. Their essential facial structure, distinctive features, and personality must survive the decades.

AGING DETAILS — SKIN: Deep horizontal furrows across the forehead. Pronounced crow's feet radiating from outer eye corners. Nasolabial folds (laugh lines) deeply carved from nose to mouth corners. Age spots (solar lentigines) scattered across cheeks, forehead, and hands. Vertical lip lines. Jowls developing along the jaw. The characteristic thinning and loosening of very aged skin.

AGING DETAILS — FEATURES: Eyes slightly more deeply set, upper eyelids heavier. The nose slightly more pronounced. Ears slightly larger (they never stop growing). Lips thinner. The overall face slightly narrower as fat pads shrink.

HAIR: Completely white or silver — pure white for most, steel grey for others. Thinning at the temples and crown. Women's hair in the white styles typical of elderly women. Men either white-haired or showing age-appropriate thinning. Eyebrows white and slightly more sparse.

MULTI-PERSON: Age ALL people in the photo — every single person gets the same elderly transformation. A young couple becomes an elderly couple who have lived a full life together. A group of friends becomes a reunion of octogenarians. Apply consistent aging across all subjects.

PHOTOREALISM: The aging must be completely photorealistic — not cartoonish or exaggerated. This should be convincing medical-quality age progression. The person's grandchildren would recognise them.`,
    negativePrompt: 'young, smooth skin, dark hair, cartoon, animated, painted, unrealistic, exaggerated, artificial looking',
    strength: 0.78,
  },

};


// ─── TIER 1: Gemini — native img2img with face preservation ──────────────────
// Uses @google/genai SDK with gemini-2.0-flash-exp model
// Same approach as gembooth — SDK handles the image modality correctly
async function generateWithGemini(imageBuffer, styleKey) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;

  // Lazy-load SDK so server still starts if package isn't installed yet
  let GoogleGenAI, Modality;
  try {
    const sdk = require('@google/genai');
    GoogleGenAI = sdk.GoogleGenAI;
    Modality = sdk.Modality;
  } catch (e) {
    console.warn('[Gemini] @google/genai SDK not installed:', e.message);
    return null;
  }

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  const resized = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = resized.toString('base64');

  const faceInstruction = `CRITICAL: Preserve the person's exact face, identity, and features. Only the artistic style should change. `;
  const prompt = faceInstruction + (style.prompt || 'Transform in an artistic style.');

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  // Try models in order — gemini-2.0-flash-exp is confirmed working with SDK
  const MODEL_NAMES = [
    'gemini-3.1-flash-image-preview',
  ];

  for (const modelName of MODEL_NAMES) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        config: {
          responseModalities: Modality
            ? [Modality.TEXT, Modality.IMAGE]
            : ['TEXT', 'IMAGE'],
        },
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/jpeg',
              },
            },
            { text: prompt },
          ],
        }],
      });

      // Find the image part in the response
      const parts = response?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.data);

      if (!imagePart) {
        console.warn(`[Gemini] ${modelName}: no image in response`);
        continue;
      }

      console.log(`[Gemini] ✅ Generated via ${modelName}`);
      const outputBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      return { buffer: outputBuffer, style: style.name, styleKey, tier: 'gemini' };

    } catch (err) {
      console.warn(`[Gemini] ${modelName} error:`, err.message?.slice(0, 150));
      continue;
    }
  }

  throw new Error('Gemini: all models failed — check GEMINI_API_KEY and account access');
}


async function generateWithFal(imageBuffer, styleKey) {
  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Convert image to base64 data URL for Fal
  const resized = await sharp(imageBuffer)
    .resize(768, 768, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${resized.toString('base64')}`;

  // FLUX.1-schnell img2img — fast, cinematic quality, face preserved
  const res = await fetch('https://fal.run/fal-ai/flux/schnell/image-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: base64Image,
      prompt: style.prompt,
      negative_prompt: style.negativePrompt,
      strength: style.strength,
      num_inference_steps: 4,
      guidance_scale: 3.5,
      num_images: 1,
      image_size: 'square_hd',
      enable_safety_checker: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Fal.ai failed:', res.status, err.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) { console.warn('[AI] Fal.ai: no image URL in response'); return null; }

  // Download the generated image
  const imgRes = await fetch(imageUrl);
  const outputBuffer = await sharp(Buffer.from(await imgRes.arrayBuffer()))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'fal' };
}

// ─── TIER 2: Cloudflare Workers AI — img2img (free, good quality) ─────────────
// Uses SD v1-5 img2img which takes the ACTUAL guest photo and transforms it.
// This is the correct model for photobooth use — the person's face is preserved.
async function generateWithCloudflare(imageBuffer, styleKey) {
  const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Resize to 512x512 — SD v1-5 native resolution, use JPEG to keep payload small
  const resized = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85 })
    .toBuffer();

  // CF Workers AI img2img expects JSON with image as number array
  const imageArray = Array.from(resized);

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: (style.prompt || 'artistic style transfer').slice(0, 500),
      negative_prompt: style.negativePrompt || 'blurry, low quality',
      strength: style.strength || 0.75,
      num_steps: 20,
      guidance: 7.5,
      image: imageArray,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Cloudflare img2img failed:', res.status, err.slice(0, 300));
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'cloudflare' };
}

// ─── TIER 3: HuggingFace — text-to-image fallback ──────────────────────────────
// IMPORTANT: This generates a NEW styled portrait from the prompt.
// The guest's face is NOT preserved. Used only when Cloudflare is unavailable.
const HF_MODELS = {
  anime:       'black-forest-labs/FLUX.1-schnell',
  vintage:     'black-forest-labs/FLUX.1-schnell',
  watercolor:  'black-forest-labs/FLUX.1-schnell',
  cyberpunk:   'black-forest-labs/FLUX.1-schnell',
  oilpainting: 'black-forest-labs/FLUX.1-schnell',
  comic:       'black-forest-labs/FLUX.1-schnell',
};

async function generateWithHuggingFace(imageBuffer, styleKey) {
  const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
  if (!HF_TOKEN) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  const model = HF_MODELS[styleKey] || HF_MODELS.anime;
  const prompt = `${style.prompt}, photobooth photo, high quality, one person`;

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { num_inference_steps: 4, width: 512, height: 512 },
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 503) {
      let waitTime = 30;
      try { waitTime = JSON.parse(err).estimated_time || 30; } catch {}
      throw new Error(`MODEL_LOADING:${Math.ceil(waitTime)}`);
    }
    console.warn('[AI] HuggingFace failed:', res.status, err.slice(0, 200));
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  const outputBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  // Mark as text2img so frontend can show a note if desired
  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'huggingface', isText2Image: true };
}

// ─── TIER 4: Local Sharp filters — instant fallback, always works ───────────────
// This IS img2img — it applies real colour grading to the ACTUAL guest photo.
// Much better than HuggingFace for keeping the person's face.
async function generateWithSharp(imageBuffer, styleKey) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;
  if (!sharp) return { buffer: imageBuffer, style: style.name, styleKey, tier: 'passthrough' };

  let img = sharp(imageBuffer).resize(1024, 1024, { fit: 'cover' });

  switch (styleKey) {
    case 'anime':
      // Boost saturation + sharpen + slight warm tint = anime-like
      img = img.modulate({ brightness: 1.05, saturation: 2.0 })
               .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
               .tint({ r: 255, g: 245, b: 235 });
      break;
    case 'vintage':
      // Desaturate + warm tone + grain effect
      img = img.modulate({ brightness: 1.1, saturation: 0.6 })
               .tint({ r: 255, g: 230, b: 190 })
               .gamma(1.2);
      break;
    case 'watercolor':
      // Soften + pastel colours + slight blur
      img = img.modulate({ brightness: 1.15, saturation: 1.4 })
               .blur(0.8)
               .sharpen({ sigma: 0.5 })
               .tint({ r: 235, g: 240, b: 255 });
      break;
    case 'cyberpunk':
      // High contrast + cool blue/purple tint + punchy saturation
      img = img.modulate({ brightness: 0.85, saturation: 2.5 })
               .tint({ r: 160, g: 180, b: 255 })
               .sharpen({ sigma: 1.5 });
      break;
    case 'oilpainting':
      // Rich contrast + warm tones + strong sharpen
      img = img.modulate({ brightness: 1.0, saturation: 1.6 })
               .sharpen({ sigma: 2.5, m1: 2, m2: 0.5 })
               .tint({ r: 255, g: 240, b: 210 });
      break;
    case 'comic':
      // Max saturation + hard sharpen + slight posterize effect
      img = img.modulate({ brightness: 1.1, saturation: 3.0 })
               .sharpen({ sigma: 3.0, m1: 3, m2: 0.2 })
               .gamma(0.8);
      break;
    default:
      img = img.modulate({ brightness: 1.05, saturation: 1.5 });
  }

  const buffer = await img.jpeg({ quality: 92 }).toBuffer();
  return { buffer, style: style.name, styleKey, tier: 'local' };
}

// ─── Main entry point ─────────────────────────────────────────────────────────
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  let result;

  // Tier 1: Gemini — highest quality, face preserved, style transfer
  result = await generateWithGemini(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Gemini failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Gemini (cinematic quality)'); return result; }

  // Tier 2: Fal.ai FLUX img2img — cinematic quality, face preserved
  result = await generateWithFal(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Fal.ai failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Fal.ai FLUX'); return result; }

  // Tier 3: Cloudflare img2img — free, good quality, preserves face
  result = await generateWithCloudflare(imageBuffer, styleKey).catch(err => {
    console.warn('[AI] Cloudflare failed:', err.message);
    return null;
  });
  if (result) { console.log('[AI] ✅ Generated via Cloudflare img2img'); return result; }

  // Tier 3: Sharp local filters — instant, face preserved, colour grading
  // NOTE: HuggingFace FLUX is text-to-image only — it ignores the guest photo entirely
  // and generates a random styled person. Sharp is better for a photobooth until
  // Cloudflare img2img is configured (set CF_ACCOUNT_ID + CF_AI_TOKEN on Render).
  result = await generateWithSharp(imageBuffer, styleKey);
  console.log('[AI] ✅ Generated via local Sharp filters (face preserved)');
  return result;

  // Tier 3: HuggingFace — disabled for now (text2img, does not use guest photo)
  // Re-enable below once CF img2img is set up, as a fallback for style variety
  // try {
  //   result = await generateWithHuggingFace(imageBuffer, styleKey);
  // } catch (err) {
  //   if (err.message.startsWith('MODEL_LOADING:')) throw err;
  // }
}

// ─── Apply filter only (no generation) ───────────────────────────────────────
async function applyAIFilter(imageBuffer, styleKey) {
  return generateWithSharp(imageBuffer, styleKey);
}

module.exports = { generateAIImage, applyAIFilter, AI_STYLES };
