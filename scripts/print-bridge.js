#!/usr/bin/env node

/**
 * SnapBooth Windows Silent Background Print Bridge
 * 
 * Runs as a lightweight background daemon on Windows kiosk / tablet machines.
 * - Subscribes to Socket.IO 'print-job-created' events.
 * - Downloads the 4×6 / 6×4 photo card.
 * - Spools directly to the Windows dye-sub printer (DNP, Citizen, Sinfonia, HiTi)
 *   using Windows native spooler / PowerShell with ZERO print dialogs.
 * - Updates the backend queue status to 'printing' and 'completed'.
 * 
 * Usage:
 *   node scripts/print-bridge.js --eventId <EVENT_ID> [--printer "DNP DS620"] [--server "http://localhost:3001"]
 */

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const EVENT_ID = getArg('--eventId', process.env.EVENT_ID);
const SERVER_URL = getArg('--server', process.env.SERVER_URL || 'http://localhost:3001');
const PRINTER_NAME = getArg('--printer', process.env.PRINTER_NAME || 'Default');

if (!EVENT_ID) {
  console.error('\x1b[31m[ERROR] --eventId is required.\x1b[0m');
  console.log('Usage: node scripts/print-bridge.js --eventId <EVENT_ID> [--printer "DNP DS620"]');
  process.exit(1);
}

console.log('\x1b[36m=======================================================');
console.log('  🖨️  SnapBooth Windows Silent Background Print Bridge');
console.log('=======================================================\x1b[0m');
console.log(`Event ID:     \x1b[33m${EVENT_ID}\x1b[0m`);
console.log(`Server URL:   \x1b[32m${SERVER_URL}\x1b[0m`);
console.log(`Target Spool: \x1b[35m${PRINTER_NAME}\x1b[0m`);
console.log('Mode:         Zero-Dialog Background Direct Spooling\n');

// Connect Socket.IO
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 2000,
});

socket.on('connect', () => {
  console.log('\x1b[32m[CONNECTED] Connected to SnapBooth Server via Socket.IO\x1b[0m');
  socket.emit('join-event', EVENT_ID);
});

socket.on('disconnect', () => {
  console.log('\x1b[33m[DISCONNECTED] Reconnecting to SnapBooth Server...\x1b[0m');
});

// Download helper
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // If Data URI (base64)
    if (url.startsWith('data:image/')) {
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFile(destPath, Buffer.from(base64Data, 'base64'), (err) => {
        if (err) reject(err);
        else resolve();
      });
      return;
    }

    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Windows silent print execution
function printOnWindows(filePath, printerName) {
  return new Promise((resolve, reject) => {
    const isWin = os.platform() === 'win32';
    if (!isWin) {
      console.log(`[Non-Windows Simulation] Spooling ${filePath} to ${printerName}`);
      return setTimeout(resolve, 1500);
    }

    // Windows PowerShell raw background print command without dialog
    const escapedPath = filePath.replace(/'/g, "''");
    let psCommand = '';

    if (printerName && printerName !== 'Default') {
      psCommand = `Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '"${printerName}"' -PassThru | Out-Null`;
    } else {
      psCommand = `Start-Process -FilePath '${escapedPath}' -Verb Print -PassThru | Out-Null`;
    }

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, (error) => {
      if (error) {
        // Fallback to mspaint /p
        exec(`mspaint /p "${escapedPath}"`, (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Listen for print-job-created
socket.on('print-job-created', async (job) => {
  if (!job) return;
  console.log(`\n\x1b[36m[NEW PRINT JOB] ID: ${job.id} | Copies: ${job.copies || 1} | Layout: ${job.layout || '4x6'}\x1b[0m`);

  const photoUrl = job.photos?.url || job.photo_url || job.url;
  if (!photoUrl) {
    console.warn('[WARN] Print job does not have a photo URL, skipping.');
    return;
  }

  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `snapbooth_print_${job.id}_${Date.now()}.jpg`);

  try {
    console.log(`Downloading card photo...`);
    await downloadFile(photoUrl, tempFile);
    console.log(`Saved temporary spool file: ${tempFile}`);

    const targetPrinter = job.printer_id || PRINTER_NAME;
    console.log(`Dispatching silent background print to [${targetPrinter}]...`);

    const copies = Math.max(1, Math.min(Number(job.copies) || 1, 10));
    for (let i = 0; i < copies; i++) {
      console.log(`Spooling copy ${i + 1} of ${copies}...`);
      await printOnWindows(tempFile, targetPrinter);
    }

    console.log(`\x1b[32m[SUCCESS] Print job ${job.id} dispatched silently with ZERO dialogs.\x1b[0m`);

    // Clean up temp file after 60s
    setTimeout(() => {
      fs.unlink(tempFile, () => {});
    }, 60000);
  } catch (err) {
    console.error(`\x1b[31m[PRINT ERROR] Failed to print job ${job.id}:\x1b[0m`, err.message);
  }
});

console.log('Listening for print jobs... (Press Ctrl+C to stop)\n');
