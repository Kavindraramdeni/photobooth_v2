/**
 * Kiosk Mode Controller
 * Handles fullscreen, navigation lock, and exit prevention
 */

export class KioskController {
  private isKioskActive = false;

  /**
   * Enter kiosk mode
   */
  async enterKiosk(options?: { lockRotation?: boolean; adjustSafeArea?: boolean }) {
    this.isKioskActive = true;

    // Request fullscreen
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }

    // Disable back button
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.preventBack);

    // Disable keyboard shortcuts
    document.addEventListener('keydown', this.preventExit);

    // Hide browser UI
    document.body.style.overflow = 'hidden';

    // Lock orientation if requested
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary' | 'any' | 'natural') => Promise<void>;
    };

    if (options?.lockRotation && typeof orientation.lock === 'function') {
      try {
        await orientation.lock('portrait-primary');
      } catch (err) {
        console.warn('Orientation lock not supported:', err);
      }
    }

    // Adjust for notch/safe area
    if (options?.adjustSafeArea) {
      const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue(
        '--safe-area-inset-top'
      );
      if (safeAreaTop) {
        document.documentElement.style.paddingTop = safeAreaTop;
      }
    }
  }

  /**
   * Exit kiosk mode
   */
  exitKiosk() {
    this.isKioskActive = false;

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if ((document as any).webkitFullscreenElement) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozFullScreenElement) {
      (document as any).mozCancelFullScreen();
    }

    // Remove event listeners
    window.removeEventListener('popstate', this.preventBack);
    document.removeEventListener('keydown', this.preventExit);

    // Restore UI
    document.body.style.overflow = 'auto';
  }

  /**
   * Prevent browser back button
   */
  private preventBack = (e: PopStateEvent) => {
    if (this.isKioskActive) {
      window.history.pushState(null, '', window.location.href);
    }
  };

  /**
   * Prevent exit keyboard shortcuts
   */
  private preventExit = (e: KeyboardEvent) => {
    if (!this.isKioskActive) return;

    // Block: Alt+F4, Cmd+Q, Escape, etc.
    if (
      (e.altKey && e.key === 'F4') || // Alt+F4
      (e.metaKey && e.key === 'q') || // Cmd+Q
      e.key === 'Escape' || // Escape
      (e.ctrlKey && e.key === 'w') // Ctrl+W
    ) {
      e.preventDefault();
    }
  };

  isActive() {
    return this.isKioskActive;
  }
}

export const kioskController = new KioskController();
