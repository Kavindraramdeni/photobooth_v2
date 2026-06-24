/**
 * Green Screen / Virtual Background Service
 * Real-time background removal and replacement using MediaPipe
 */
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export class GreenScreenService {
  private segmenter: SelfieSegmenter | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.segmenter = new SelfieSegmenter({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        },
      });

      await this.segmenter.initialize();
      this.isInitialized = true;
      console.log('GreenScreenService initialized');
    } catch (error) {
      console.error('Failed to initialize GreenScreenService:', error);
      throw error;
    }
  }

  /**
   * Remove background from video/image and apply custom background
   */
  async processFrame(
    sourceCanvas: HTMLCanvasElement,
    backgroundImage: HTMLImageElement | string,
    options?: {
      blur?: boolean;
      blurAmount?: number;
    }
  ): Promise<HTMLCanvasElement> {
    if (!this.segmenter) {
      throw new Error('GreenScreenService not initialized');
    }

    try {
      const ctx = sourceCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Get segmentation mask
      const results = await this.segmenter.estimateMask(sourceCanvas);

      if (!results.mask) {
        throw new Error('Failed to generate segmentation mask');
      }

      // Create output canvas
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = sourceCanvas.width;
      outputCanvas.height = sourceCanvas.height;
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) throw new Error('Output canvas context not available');

      // Draw background image
      if (typeof backgroundImage === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(null);
          img.onerror = reject;
          img.src = backgroundImage;
        });
        outputCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
      } else {
        outputCtx.drawImage(backgroundImage, 0, 0, outputCanvas.width, outputCanvas.height);
      }

      // Get image data
      const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const data = imageData.data;
      const maskData = results.mask.getAsFloat32Array();

      // Apply mask: keep foreground (person), show background
      for (let i = 0; i < maskData.length; i++) {
        const maskValue = maskData[i]; // 0 = background, 1 = person

        if (maskValue < 0.5) {
          // Background - keep it from background image
          // Do nothing, background already drawn
        } else {
          // Foreground (person) - keep original image
          const pixelIndex = i * 4;
          // Keep the original pixel
        }
      }

      // Composite foreground on top
      const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
      const outputData = outputImageData.data;

      for (let i = 0; i < maskData.length; i++) {
        const maskValue = maskData[i];
        const pixelIndex = i * 4;

        if (maskValue > 0.5) {
          // Copy foreground pixel
          outputData[pixelIndex] = data[pixelIndex]; // R
          outputData[pixelIndex + 1] = data[pixelIndex + 1]; // G
          outputData[pixelIndex + 2] = data[pixelIndex + 2]; // B
          outputData[pixelIndex + 3] = 255; // A
        }
      }

      outputCtx.putImageData(outputImageData, 0, 0);

      // Optional: apply blur to background
      if (options?.blur && options?.blurAmount) {
        this.applyBackgroundBlur(outputCanvas, maskData, options.blurAmount);
      }

      return outputCanvas;
    } catch (error) {
      console.error('Frame processing error:', error);
      throw error;
    }
  }

  /**
   * Blur background instead of replacing it
   */
  private applyBackgroundBlur(
    canvas: HTMLCanvasElement,
    maskData: Float32Array,
    blurAmount: number
  ) {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple blur filter for background
      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] < 0.5) {
          // Background pixel - apply blur effect
          const pixelIndex = i * 4;
          // Reduce color intensity (simple blur effect)
          const blurFactor = 1 - blurAmount / 100;
          data[pixelIndex] *= blurFactor; // R
          data[pixelIndex + 1] *= blurFactor; // G
          data[pixelIndex + 2] *= blurFactor; // B
        }
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.warn('Background blur error:', error);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
      this.isInitialized = false;
    }
  }
}

export const greenScreenService = new GreenScreenService();
