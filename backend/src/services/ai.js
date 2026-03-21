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

const AI_STYLES = {
  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    prompt: `Masterpiece anime-style illustration rendered in the aesthetic tradition of Studio Ghibli and modern Japanese animation studios. 
The subject is a real person photographed in a photobooth — preserve their exact facial structure, eye shape, skin tone, hair colour, hair length, and overall likeness with absolute fidelity. 
Their face must remain completely recognisable as the same individual. 
Apply soft cel shading with clean, confident ink outlines to the face. 
Eyes should be rendered in classic anime style — slightly enlarged, luminous, with detailed iris reflections and catchlights. 
Skin should have a smooth, porcelain-like quality with subtle gradient shading — warm highlights on forehead, nose bridge, and cheekbones, cool shadow beneath the chin and along the neck. 
Hair should be stylised into defined flowing sections with strong directional highlights and deep shadow separations, as seen in high-production anime titles. 
Clothing should be faithfully reproduced but rendered with anime fabric textures — clean folds, bold shadow shapes, and saturated colour values. 
The background should be transformed into a painterly anime environment — soft bokeh in pastel tones, distant foliage or architectural elements hinted in impressionistic style. 
Overall colour palette should be warm, saturated, and harmonious. 
Lighting should feel cinematic yet soft — a key light from the upper left, gentle fill from the right, and a subtle rim light that separates the subject from the background. 
Final image should feel like a frame extracted from a premium anime film — professional, polished, and emotionally expressive.`,
    negativePrompt: 'ugly, deformed, extra limbs, poorly drawn face, mutation, out of frame, low quality, blurry, grainy, watermark, signature, text, nsfw, nudity, bad anatomy, wrong proportions, duplicate, cloned face',
    strength: 0.78,
  },

  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    prompt: `Transform this photograph into a authentic vintage film portrait captured on Kodachrome 64 slide film in the early 1970s. 
The subject is a real person — preserve their exact facial features, expression, skin tone, hair, and clothing with complete accuracy. Their identity must be unmistakably preserved. 
Apply genuine analogue film characteristics: introduce subtle but visible film grain across the entire image with a natural, organic texture — not digital noise. 
Colour grading should replicate Kodachrome's iconic palette — warm golden-amber midtones, slightly lifted blacks that fade to a milky brown rather than pure black, slightly desaturated cool tones, rich warm skin rendition. 
Highlights should bloom softly without clipping — a gentle halation effect around bright areas like skin and light sources. 
Shadows should have a warm brownish-green cast typical of expired Kodachrome. 
Contrast should be moderate — not flat but not punchy — with a characteristic mid-tone compression. 
Add a very subtle vignette that darkens the corners, as if shot with a slightly older lens. 
The image should feel timeless, warm, and nostalgic — like a photograph discovered in an old family album from 1972. 
Skin tones should feel rich and sun-kissed. The overall mood should be warm, intimate, and deeply human.`,
    negativePrompt: 'modern digital look, oversaturated, HDR, harsh contrast, sharp edges, clean blacks, digital noise, overexposed, cold tones, blue shadows, modern colour grading',
    strength: 0.58,
  },

  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    prompt: `Transform this photograph into a masterful watercolor portrait painting in the tradition of contemporary illustrative watercolor art. 
The subject is a real person — preserve their exact facial features, proportions, skin tone, hair colour, and expression with full fidelity. The person must remain completely recognisable. 
The face should be rendered with careful, controlled washes — soft gradients of transparent colour layered to build form, with wet-on-wet blending on the cheeks and forehead creating beautiful soft transitions. 
Apply the classic watercolor technique of leaving deliberate white paper areas for highlights on the nose, cheekbones, and eyes — these unpainted areas create the luminosity that defines fine watercolor portraiture. 
The eyes should be rendered with slightly more detail and precision than the rest of the face — crisp dark pupils, careful iris work, and subtle wet reflections. 
Hair should be painted with confident, sweeping brushstrokes in varied tones — dark concentrated washes at the roots fading to lighter tones at the tips, with individual strand details suggested rather than explicitly drawn. 
Clothing should be rendered loosely with gestural washes — suggest the form and colour without tight photographic detail. 
The background should dissolve into loose, abstract washes of complementary colours — perhaps soft blues, warm yellows, or gentle greens bleeding into each other in a wet-on-wet technique. 
Visible brushstrokes should be apparent and expressive — this is a painting, not a photo filter. 
Paper texture should show through the thinner washes. 
The overall impression should be of a skilled human artist's work — emotionally resonant, technically accomplished, and uniquely beautiful.`,
    negativePrompt: 'photorealistic, digital painting, harsh lines, black outlines, thick paint, oil paint texture, 3d render, overworked, muddy colours, loss of white areas, overdetailed background',
    strength: 0.75,
  },

  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    prompt: `Transform this photograph into a cinematic cyberpunk portrait in the visual style of Blade Runner 2049, Ghost in the Shell, and Cyberpunk 2077 promotional art. 
The subject is a real person — their exact face, bone structure, eyes, skin tone, and hair must be preserved with complete accuracy. This is critical. Do not alter their facial features in any way. 
Lighting should be dramatically transformed: add a powerful neon rim light from the left side in electric blue or cyan that traces the cheekbone, ear, and shoulder. 
Add a secondary fill light from the right in warm magenta or deep violet that softly illuminates the shadow side of the face. 
The overall scene should feel like it is set in a rain-soaked megacity at night. 
Reflect neon signage in wet surfaces — subtle reflections of Chinese characters, corporate logos, and coloured lights on skin and clothing surfaces. 
The background should be a dense urban nightscape: towering skyscrapers with thousands of lit windows receding into atmospheric haze, holographic advertisements floating in the air, flying vehicle trails as streaks of light. 
Transform the subject's clothing into cyberpunk attire — tactical jacket, chrome accents, embedded LED strips — while maintaining their body posture and position. 
Colour grading: deep teal and orange in the shadows, electric blue and magenta in the highlights, with the midtones pushed toward a desaturated noir aesthetic. 
Overall mood should feel dangerous, futuristic, and cinematic — like a still frame from a $200 million science fiction film.`,
    negativePrompt: 'daytime, natural light, bright colours, countryside, pastoral, warm sunlight, simple background, low contrast, flat lighting, anime, cartoon, painted',
    strength: 0.82,
  },

  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    prompt: `Transform this photograph into a masterpiece oil painting portrait in the tradition of the Dutch Golden Age masters — Rembrandt van Rijn, Frans Hals, and Johannes Vermeer. 
The subject is a real person — their exact facial features, skin tone, hair, and expression must be meticulously preserved. The painting should be unmistakably a portrait of this specific individual. 
Lighting should follow the Rembrandt lighting technique: a single warm light source from the upper left creating a characteristic triangular highlight on the shadow cheek. 
Deep, luminous shadows with the characteristic Rembrandt warmth — rich browns, dark siennas, and deep ochres building up in the shadow areas through multiple transparent glazes. 
Skin should be rendered with extraordinary care — the warm undertones of living flesh built up through layered translucent glazes of vermillion, yellow ochre, and titanium white. 
Visible impasto brushstrokes in the lighter areas — thick, confident strokes of lead white mixed with pale flesh tones for the highlights on the forehead and nose. 
The background should be a deep, atmospheric dark — soft vignetting into near-black at the edges, with a sense of depth created through subtle tonal variations. 
Clothing should be rendered with the same mastery — rich fabric textures, the sheen of silk or the weight of wool suggested through careful paint handling. 
Craquelure — the fine network of cracks in aged oil paint — should be subtly visible throughout the work. 
The image should feel as though it was painted 350 years ago and has been preserved in perfect condition in a major museum collection.`,
    negativePrompt: 'modern, photograph, digital, flat, cartoon, anime, watercolor, sketch, bright background, contemporary clothing style, digital brush',
    strength: 0.76,
  },

  comic: {
    name: 'Comic Book',
    emoji: '💥',
    prompt: `Transform this photograph into a premium comic book illustration in the style of high-production Marvel and DC Comics artwork from the modern era — think Alex Ross's painted realism meets Jim Lee's dynamic linework. 
The subject is a real person — their face, features, and expression must be clearly preserved and recognisable. Do not change their fundamental appearance. 
Render the entire image with bold, confident ink outlines — varying in weight from thick 3pt boundary lines around the figure to delicate 0.5pt detail lines within. 
Apply flat colour fills in the base layer — clean, saturated comic book colours without photographic gradients. 
Then layer cel-shaded shadows as flat dark shapes — no gradients, just sharp shadow forms that define the anatomy and add dimension. 
Add bright, flat highlight spots to the highest points — top of the skull, nose bridge, cheekbones, shoulders. 
Eyes should be compelling and expressive — slightly stylised but clearly depicting the real person's eyes. 
The background should be a dynamic comic panel environment: bold action lines radiating outward, or a dramatic urban backdrop rendered in flat graphic style with bold outlines. 
Use halftone dot patterns in the midtone areas — classic Ben-Day dots that reference the printing heritage of comic books. 
Colour should be bold and primary-leaning — vivid reds, deep blues, bright yellows, clean blacks. 
Add subtle speed lines or energy effects around the figure to create dynamism. 
The final result should look like a premium variant cover for a major superhero title — dramatic, powerful, and technically flawless.`,
    negativePrompt: 'realistic photograph, painterly, watercolor, soft edges, gradients, muted colours, blurry, anime, manga, low detail, poorly drawn, amateur',
    strength: 0.80,
  },

  renaissance: {
    name: 'Renaissance',
    emoji: '🎨',
    prompt: `Transform this photograph into a Renaissance oil painting in the style of Leonardo da Vinci or Raphael. Preserve the person's exact facial features and likeness. Apply soft sfumato shading, warm amber lighting from one side, and a dark classical background. Clothing should be rendered in period-appropriate Renaissance attire with rich fabrics. The overall feel should be a museum-quality Renaissance portrait.`,
    negativePrompt: 'modern, digital, cartoon, anime, flat colours, harsh lighting, photography',
    strength: 0.78,
  },

  statue: {
    name: 'Marble Statue',
    emoji: '🏛️',
    prompt: `Transform the person in this photograph into a classical white marble statue. Preserve their exact facial features and likeness. The entire body and clothing should appear carved from brilliant white marble with realistic stone texture, subtle veining, and cool grey shadows. The background should be a classical museum or ancient Greek setting. Lighting should be dramatic studio lighting that reveals the marble texture.`,
    negativePrompt: 'color, painted, modern, digital, cartoon, blurry',
    strength: 0.82,
  },

  eighties: {
    name: '80s Yearbook',
    emoji: '✨',
    prompt: `Make this person look like a 1980s high school yearbook photo. Preserve their exact face and likeness. Add period-appropriate 1980s hairstyle, clothing with shoulder pads or polo shirt. Use warm studio lighting with a gradient blue/purple backdrop typical of school portrait photography in the 1980s. Add subtle film grain and the slightly oversaturated look of 1980s portrait photography.`,
    negativePrompt: 'modern, digital clean, 21st century, contemporary clothing, neutral background',
    strength: 0.70,
  },

  psychedelic: {
    name: 'Psychedelic',
    emoji: '🌈',
    prompt: `Create a 1960s psychedelic hand-drawn poster-style illustration based on this person. Use bright bold solid colors and swirling shapes around them. Transform the background into swirling rainbow patterns, kaleidoscopic geometric shapes, and flowing organic forms. Keep the person's face recognisable but stylise it with bold outlines and vivid saturated colours. Do not add any text.`,
    negativePrompt: 'realistic, muted colors, grayscale, modern, digital, text, words',
    strength: 0.80,
  },

  pixelart: {
    name: '8-bit Pixel',
    emoji: '🎮',
    prompt: `Transform this image into a cute minimalist 8-bit pixel art character on a colorful retro background. The pixel size should be visible and large (like an 80x80 pixel grid scaled up). Use a limited bright color palette. The person's face should be clearly recognisable in pixel art style. Add a simple pixel art background with stars or a game-like environment.`,
    negativePrompt: 'photorealistic, smooth, anti-aliased, high resolution details, blurry',
    strength: 0.85,
  },

  daguerreotype: {
    name: '19th Century',
    emoji: '🎩',
    prompt: `Make this photograph look like a 19th century daguerreotype portrait. Preserve the person's face exactly. Transform their clothing into period-appropriate Victorian attire — formal suit, cravat, or Victorian dress. The image should be sepia-toned with the characteristic metallic sheen of a daguerreotype. Add slight vignetting, film scratches, and the soft focus of early photography. The background should suggest a Victorian studio with draped fabric.`,
    negativePrompt: 'modern, colorful, casual clothing, digital, sharp, HDR',
    strength: 0.72,
  },

  old: {
    name: 'Aged',
    emoji: '👴',
    prompt: `Make the person in this photograph look extremely old — in their 90s — while keeping their face completely recognisable. Add deep wrinkles across the forehead, around the eyes, and mouth. Make the hair white or silver. Add age spots, loose skin under the chin, and the characteristic drooping of very advanced age. Keep their expression and the background the same. This should be a photorealistic transformation.`,
    negativePrompt: 'young, smooth skin, dark hair, cartoon, anime, painted',
    strength: 0.75,
  },
};


// ─── TIER 1: Gemini — native img2img with face preservation ──────────────────
// Uses gemini-2.0-flash-preview-image-generation for style transfer.
// Preserves the person's face, lighting, and composition.
// Set GEMINI_API_KEY on Render to enable.
async function generateWithGemini(imageBuffer, styleKey) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;

  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Resize for Gemini — 1024x1024 max, JPEG
  const resized = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = resized.toString('base64');

  // Use the rich AI_STYLES prompts directly — same cinematic quality for Gemini
  // Prefix with face-preservation instruction critical for Gemini
  const faceInstruction = `CRITICAL REQUIREMENT: This image contains a real person's face. 
You must preserve their exact facial features, bone structure, eye shape, skin tone, hair colour and length, 
and overall identity with 100% fidelity. The person must be completely recognisable as the same individual after transformation. 
Do not alter their face, change their expression, or modify their physical appearance in any way. 
Only the artistic style, lighting, background, and colour grading should change. `;

  const prompt = faceInstruction + (AI_STYLES[styleKey]?.prompt || AI_STYLES.anime.prompt);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['Text', 'Image'],
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn('[AI] Gemini failed:', res.status, err.slice(0, 300));
    return null;
  }

  const data = await res.json();

  // Extract image from response parts
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart?.inlineData?.data) {
    console.warn('[AI] Gemini: no image in response', JSON.stringify(parts).slice(0, 200));
    return null;
  }

  const outputBuffer = await sharp(Buffer.from(imagePart.inlineData.data, 'base64'))
    .resize(1024, 1024, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: outputBuffer, style: style.name, styleKey, tier: 'gemini' };
}

// ─── TIER 2: Fal.ai — FLUX.1 img2img (cinematic quality, face preserved) ──────
// Best quality tier. Uses FLUX.1-dev with face preservation.
// Sign up free at fal.ai — get $5 credit (~500 test images)
// Set FAL_API_KEY on Render to enable.
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

  // CF Workers AI REST API expects multipart/form-data for img2img
  const formData = new FormData();
  formData.append('prompt', style.prompt);
  formData.append('negative_prompt', style.negativePrompt || '');
  formData.append('strength', String(style.strength));
  formData.append('num_steps', '20');
  formData.append('guidance', '7.5');
  formData.append('image', new Blob([resized], { type: 'image/jpeg' }), 'photo.jpg');

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AI_TOKEN}`,
      // No Content-Type header — let fetch set it with boundary for FormData
    },
    body: formData,
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
