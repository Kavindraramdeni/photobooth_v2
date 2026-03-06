const axios = require('axios');
const sharp = require('sharp');

const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

// AI style presets for the "Surprise Me" feature
const AI_STYLES = {
  anime: {
    name: 'Anime Art',
    emoji: '🎌',
    model: 'Linaqruf/anything-v3.0',
    prompt: 'anime style illustration, high quality, detailed, vibrant colors',
    negative: 'ugly, blurry, low quality',
  },
  vintage: {
    name: 'Vintage Film',
    emoji: '📷',
    model: 'runwayml/stable-diffusion-v1-5',
    prompt: 'vintage film photography, retro aesthetic, grain, warm tones, 1970s style',
    negative: 'modern, digital, sharp, oversaturated',
  },
  watercolor: {
    name: 'Watercolor',
    emoji: '🎨',
    model: 'runwayml/stable-diffusion-v1-5',
    prompt: 'beautiful watercolor painting, artistic, soft colors, paper texture',
    negative: 'photo, realistic, digital art',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    emoji: '🌆',
    model: 'runwayml/stable-diffusion-v1-5',
    prompt: 'cyberpunk style, neon lights, futuristic city, dramatic lighting, blade runner aesthetic',
    negative: 'natural, daytime, bright',
  },
  oilpainting: {
    name: 'Oil Painting',
    emoji: '🖼️',
    model: 'runwayml/stable-diffusion-v1-5',
    prompt: 'oil painting style, impressionist, brushstrokes, classical art, museum quality',
    negative: 'photo, modern, digital',
  },
  comic: {
    name: 'Comic Book',
    emoji: '💥',
    model: 'ogkalu/comic-shazam',
    prompt: 'comic book style, bold outlines, bright colors, halftone dots, action style',
    negative: 'realistic, photograph',
  },
};

/**
 * Generate AI-transformed image using HuggingFace img2img
 * @param {Buffer} imageBuffer - Original photo buffer
 * @param {string} styleKey - Key from AI_STYLES
 * @param {string} customPrompt - Optional custom prompt override
 */
async function generateAIImage(imageBuffer, styleKey = 'anime', customPrompt = null) {
  const style = AI_STYLES[styleKey] || AI_STYLES.anime;

  // Resize image for faster AI processing (512x512 is optimal for SD)
  const resizedBuffer = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Image = resizedBuffer.toString('base64');
  const prompt = customPrompt || `${style.prompt}, portrait photo of a person`;

  try {
    const response = await axios.post(
      `${HF_API_URL}/${style.model}`,
      {
        inputs: {
          prompt,
          negative_prompt: style.negative,
          image: base64Image,
          strength: 0.65,
          guidance_scale: 7.5,
          num_inference_steps: 25,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 120000, // 2 min timeout for free tier
      }
    );

    // Upscale back to reasonable resolution
    const generatedBuffer = await sharp(Buffer.from(response.data))
      .resize(1024, 1024, { fit: 'cover' })
      .jpeg({ quality: 95 })
      .toBuffer();

    return {
      success: true,
      buffer: generatedBuffer,
      style: style.name,
      styleKey,
    };
  } catch (error) {
    // HuggingFace free tier returns 503 when model is loading
    if (error.response?.status === 503) {
      const waitTime = error.response.headers['x-wait-estimated-time'] || 30;
      throw new Error(`MODEL_LOADING:${waitTime}`);
    }
    throw new Error(`AI generation failed: ${error.message}`);
  }
}

/**
 * Apply quick AI filter (faster than full generation - just style transfer)
 * Uses a simpler classification approach with CSS filters as fallback
 */
async function applyAIFilter(imageBuffer, filterName) {
  // Basic filters using Sharp (instant, no API needed)
  const filters = {
    bw: (img) => img.grayscale().modulate({ brightness: 1.1, saturation: 0 }),
    warm: (img) => img.modulate({ brightness: 1.05, saturation: 1.2 }).tint({ r: 255, g: 240, b: 220 }),
    cool: (img) => img.modulate({ brightness: 1.05, saturation: 1.1 }).tint({ r: 220, g: 235, b: 255 }),
    vivid: (img) => img.modulate({ brightness: 1.1, saturation: 1.8 }),
    fade: (img) => img.modulate({ brightness: 1.15, saturation: 0.6 }),
    dramatic: (img) => img.modulate({ brightness: 0.9, saturation: 1.3 }).linear(1.2, -20),
  };

  const filterFn = filters[filterName] || filters.bw;
  const processedBuffer = await filterFn(sharp(imageBuffer)).jpeg({ quality: 95 }).toBuffer();

  return processedBuffer;
}

module.exports = { generateAIImage, applyAIFilter, AI_STYLES };
