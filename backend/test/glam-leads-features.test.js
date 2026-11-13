const { describe, it } = require('node:test');
const assert = require('node:assert');
const { applyGlamFilter } = require('../src/services/imageProcessor');
const sharp = require('sharp');

describe('Celebrity Glam Filter & Image Processing', () => {
  it('applies signature kardashian_bw monochrome high-contrast filter', async () => {
    // Generate a simple test image buffer
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 150, b: 100 },
      },
    }).jpeg().toBuffer();

    const result = await applyGlamFilter(testBuffer, {
      mode: 'kardashian_bw',
      intensity: 8,
    });

    assert.ok(Buffer.isBuffer(result));
    assert.ok(result.length > 0);

    const meta = await sharp(result).metadata();
    assert.ok(meta.width > 0 && meta.height > 0);

    // Verify it is monochrome (R == G == B on pixels)
    const rawPixels = await sharp(result).raw().toBuffer();
    // Sample first pixel
    assert.strictEqual(rawPixels[0], rawPixels[1]);
    assert.strictEqual(rawPixels[1], rawPixels[2]);
  });

  it('applies hollywood_glow warm luminous filter', async () => {
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 180, g: 160, b: 140 },
      },
    }).jpeg().toBuffer();

    const result = await applyGlamFilter(testBuffer, {
      mode: 'hollywood_glow',
      intensity: 7,
    });

    assert.ok(Buffer.isBuffer(result));
    assert.ok(result.length > 0);

    const meta = await sharp(result).metadata();
    assert.strictEqual(meta.channels, 3, 'Hollywood glow preserves full 3-channel color');
  });
});
