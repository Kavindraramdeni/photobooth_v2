/**
 * Print Service - Handle printing to physical printers
 * FIXED: Race condition, error handling, memory leaks
 */

export interface PrintJob {
  id: string;
  photoId: string;
  eventId: string;
  copies: number;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export class PrintService {
  private printQueue: PrintJob[] = [];
  private printingPromise: Promise<void> | null = null; // FIX: Prevent race condition

  /**
   * Add photo to print queue
   */
  async queuePrint(photoId: string, eventId: string, copies: number = 1): Promise<PrintJob> {
    if (!photoId || !eventId) {
      throw new Error('photoId and eventId required');
    }

    if (copies < 1 || copies > 10) {
      throw new Error('Copies must be between 1 and 10');
    }

    const job: PrintJob = {
      id: `print-${Date.now()}`,
      photoId,
      eventId,
      copies,
      status: 'pending',
      createdAt: new Date(),
    };

    this.printQueue.push(job);

    // Start processing queue without race condition
    this.processPrintQueue().catch(err => console.error('Queue processing error:', err));

    return job;
  }

  /**
   * Process print queue (non-concurrent)
   */
  private async processPrintQueue() {
    // FIX: Use promise to prevent concurrent processing
    if (this.printingPromise) {
      return this.printingPromise; // Wait for current processing
    }

    if (this.printQueue.length === 0) {
      return;
    }

    this.printingPromise = this._processPrintQueueInternal();
    
    try {
      await this.printingPromise;
    } finally {
      this.printingPromise = null; // Clear reference for cleanup
    }
  }

  /**
   * Internal queue processing logic
   */
  private async _processPrintQueueInternal() {
    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift();
      if (!job) break;

      try {
        job.status = 'printing';
        await this.sendToPrinter(job);
        job.status = 'completed';
        job.completedAt = new Date();
      } catch (error: any) {
        job.status = 'failed';
        job.error = error.message || 'Unknown error';
        console.error(`Print job ${job.id} failed:`, job.error);
      }
    }
  }

  /**
   * Send job to physical printer via USB
   */
  private async sendToPrinter(job: PrintJob): Promise<void> {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('sb_access_token') : null;

      const response = await fetch(`${API_BASE}/api/events/${job.eventId}/print`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          photoId: job.photoId,
          copies: job.copies,
          jobId: job.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Print failed: ${error.error || response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Print job failed');
      }

      // Simulate print delay (2-5 seconds per copy)
      await new Promise(resolve => setTimeout(resolve, job.copies * 2000));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get print queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    printing: number;
    completed: number;
    failed: number;
    isProcessing: boolean;
  } {
    return {
      total: this.printQueue.length,
      pending: this.printQueue.filter(j => j.status === 'pending').length,
      printing: this.printQueue.filter(j => j.status === 'printing').length,
      completed: this.printQueue.filter(j => j.status === 'completed').length,
      failed: this.printQueue.filter(j => j.status === 'failed').length,
      isProcessing: this.printingPromise !== null,
    };
  }

  /**
   * Check if printer is connected (with timeout)
   */
  async checkPrinterStatus(timeoutMs: number = 5000): Promise<boolean> {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${API_BASE}/api/printer/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        return data.connected && data.ready;
      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          console.warn('Printer status check timeout');
        }
        return false;
      }
    } catch (error) {
      console.error('Printer status check error:', error);
      return false;
    }
  }

  /**
   * Clear completed jobs from queue (memory cleanup)
   */
  clearCompleted() {
    const initialLength = this.printQueue.length;
    this.printQueue = this.printQueue.filter(j => j.status !== 'completed' && j.status !== 'failed');
    return initialLength - this.printQueue.length;
  }

  /**
   * Get job status by ID
   */
  getJobStatus(jobId: string): PrintJob | undefined {
    return this.printQueue.find(j => j.id === jobId);
  }
}

export const printService = new PrintService();
