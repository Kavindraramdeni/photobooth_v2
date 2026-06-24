/**
 * Green Screen Service
 * Temporary implementation for build success
 */

export class GreenScreenService {
  private isInitialized = false;

  async initialize() {
    this.isInitialized = true;
    console.log('GreenScreenService initialized');
  }

  async processFrame(
    sourceCanvas: HTMLCanvasElement,
    backgroundImage?: HTMLImageElement | string,
    options?: {
      blur?: boolean;
      blurAmount?: number;
    }
  ): Promise<HTMLCanvasElement> {
    return sourceCanvas;
  }

  dispose() {
    this.isInitialized = false;
  }
}

export const greenScreenService = new GreenScreenService();
