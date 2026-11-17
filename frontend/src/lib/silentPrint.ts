/**
 * Silent Background Printing Utility
 * Handles zero-dialog direct background printing to DNP/Citizen dye-sub printers
 * and local print station queues.
 */

import { api } from './api';
import { queueOfflinePrint } from './offlineQueue';

export interface SilentPrintOptions {
  eventId: string;
  photoId?: string;
  photoUrl: string;
  copies?: number;
  layout?: '4x6' | '6x4' | 'strip';
  printerId?: string;
}

/**
 * Execute a silent background print job
 * 1. Enqueues job to backend print queue (updates paper monitor & telemetry)
 * 2. Renders into a hidden zero-margin iframe to trigger silent driver spooling
 */
export async function executeSilentPrint(options: SilentPrintOptions): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const { eventId, photoId, photoUrl, copies = 1, layout = '4x6', printerId } = options;

  let jobId: string | undefined;

  // 1. Enqueue to backend print queue
  try {
    const res = await api.post('/print/queue', {
      eventId,
      photoId: photoId || `photo-${Date.now()}`,
      copies,
      layout,
      printerId,
      silent: true,
    });
    jobId = res.data?.job?.id;
  } catch (err: any) {
    console.warn('[SilentPrint] Queue enqueue warning, caching to Touchpix-grade offline queue:', err.message);
    queueOfflinePrint({
      eventId,
      photoId: photoId || `photo-${Date.now()}`,
      photoUrl,
      copies,
    }).catch(() => {});
  }

  // 2. Trigger silent physical driver spooling via hidden iframe
  try {
    if (typeof window !== 'undefined') {
      const isLandscape = layout === '6x4';
      const pageSize = isLandscape ? '6in 4in landscape' : '4in 6in portrait';

      // Remove existing print iframes if any
      const existingIframe = document.getElementById('snapbooth-silent-print-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'snapbooth-silent-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <title>Silent Print Job</title>
            <style>
              @page {
                size: ${pageSize};
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                image-rendering: -webkit-optimize-contrast;
              }
            </style>
          </head>
          <body>
            <img src="${photoUrl}" id="print-target" />
            <script>
              const target = document.getElementById('print-target');
              function doPrint() {
                try {
                  window.focus();
                  window.print();
                } catch(e) {}
              }
              if (target.complete) {
                setTimeout(doPrint, 50);
              } else {
                target.onload = () => setTimeout(doPrint, 50);
              }
            </script>
          </body>
          </html>
        `);
        doc.close();

        // Cleanup iframe after 40 seconds
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 40000);
      }
    }
    return { success: true, jobId };
  } catch (err: any) {
    console.error('[SilentPrint] Execution failed:', err);
    return { success: false, error: err.message };
  }
}
