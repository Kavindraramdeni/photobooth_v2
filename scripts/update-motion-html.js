const fs = require('fs');

const rawB64 = fs.readFileSync('C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/scratch/raw_b64.txt', 'utf8').trim();
const celebB64 = fs.readFileSync('C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/scratch/portrait_b64.txt', 'utf8').trim();

let html = fs.readFileSync('C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/free_in_app_motion_engine.html', 'utf8');

const newSources = `
    const SOURCES = {
      portrait: 'data:image/jpeg;base64,${celebB64}',
      tatler: 'tatler_sample.jpg',
      raw: 'data:image/jpeg;base64,${rawB64}'
    };

    let currentImg = new Image();
    currentImg.src = SOURCES.raw;
`;

html = html.replace(/const SOURCES = \{[\s\S]*?currentImg\.src = SOURCES\.portrait;/, newSources.trim());

// Also make the Raw Photo button active by default
html = html.replace(
  'class="flex-1 py-1 px-1.5 rounded-lg font-bold transition-all bg-white/20 text-white">\n          Celebrity Red Carpet',
  'class="flex-1 py-1 px-1.5 rounded-lg font-bold transition-all text-zinc-400 hover:text-white">\n          Celebrity Red Carpet'
);
html = html.replace(
  'class="flex-1 py-1 px-1.5 rounded-lg font-bold transition-all text-zinc-400 hover:text-white">\n          Raw Photo',
  'class="flex-1 py-1 px-1.5 rounded-lg font-bold transition-all bg-white/20 text-white">\n          Raw Photo'
);

fs.writeFileSync('C:/Users/Kavin/.gemini/antigravity/brain/02f0c71b-6b34-409b-9c13-326f7f7be5ec/free_in_app_motion_engine.html', html);
console.log('Successfully updated free_in_app_motion_engine.html with embedded real photo base64!');
