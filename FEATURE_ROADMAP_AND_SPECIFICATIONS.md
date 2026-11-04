# SnapBooth AI — Future Feature Roadmap & Technical Specifications

This document outlines the architecture, data models, and implementation roadmaps for the **missing capabilities** required to elevate SnapBooth AI into an enterprise-grade commercial photo booth platform.

---

## 1. High-Priority Hardware & Peripheral Support

### 1.1 Professional Camera Integration (DSLR & Mirrorless)
* **Target Hardware:** Canon EOS (Rebel, R-series), Nikon Z-series, Sony Alpha.
* **Architecture:**
  * Kiosk devices (especially Windows/macOS kiosks) communicate via a lightweight local agent (`localhost:3099`) or WebUSB using `gPhoto2` / `Canon EDSDK`.
  * The local agent streams a live-view preview (MJPEG) over WebSocket to `CountdownScreen.tsx`.
  * On shutter trigger, the local agent fires the camera shutter, downloads the RAW/High-Res JPEG to local memory, runs image processing via `sharp`, and posts the final composite to the backend.

### 1.2 Physical Thermal Printer Integration
* **Target Hardware:** DNP DS620A, Citizen CY-02, HiTi P525L, AirPrint thermal printers.
* **Architecture:**
  * Real implementation of `printService.ts`:
  * Connects to a local print spooler daemon via IPP (Internet Printing Protocol) or standard Node.js printer bindings (`node-printer` or `electron-pos-printer`).
  * Cuts 4x6" media into dual 2x6" strips automatically using printer firmware cut commands.

### 1.3 Hardware Triggers & Lighting Sync
* **Foot Pedal / Wireless Clicker:** Standard Keyboard event listeners (`Space`, `Enter`) in `BoothMain.tsx` to enable hands-free activation.
* **Strobe Flash Sync:** WebSerial / WebBluetooth signal sent to an Arduino/ESP32 relay module to trigger external studio strobes during capture.

---

## 2. Capture & Media Enhancements

### 2.1 MP4 Video & Boomerang Generator
* **Current Gap:** Only exports `.gif` (256-color palette banding, cannot be shared to Instagram Stories/TikTok).
* **Technical Specification:**
  * Update `backend/src/services/gif.js` to add `createBoomerangVideo(buffers, options)`.
  * Command pipeline:
    ```bash
    ffmpeg -framerate 10 -i frame_%03d.jpg -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1[v]" -c:v libx264 -pix_fmt yuv420p -movflags +faststart output.mp4
    ```
  * Generates an H.264 MP4 with `yuv420p` pixel format compatible with iOS Safari, Instagram, and WhatsApp.

### 2.2 Client-Side AR Digital Props
* **Specification:**
  * Integrate `@mediapipe/face_mesh` or `@vladmandic/face-api` into `react-webcam`.
  * Track 6 standard facial landmarks (left eye, right eye, nose tip, lips, forehead).
  * Render SVG/PNG digital assets (sunglasses, crowns, mustache, party hats) onto an overlay canvas atop the live camera preview.

### 2.3 Audio Countdown & Voice Coaching
* **Specification:**
  * Add lightweight Web Audio synthesized sound generator in `CountdownScreen.tsx`:
    * Beep frequency: 880Hz (A5) for 3, 2, 1.
    * Shutter sound frequency: 1760Hz (A6) with white-noise shutter burst.
  * Audio toggle configurable in event settings (`settings.allowAudio = true`).

---

## 3. Venue & Kiosk Reliability

### 3.1 Offline Resilient Kiosk Queueing (IndexedDB)
* **The Problem:** Poor venue Wi-Fi halts the kiosk.
* **Technical Specification:**
  * Use `Dexie.js` or standard `idb` on the browser to store pending capture records:
    ```typescript
    interface OfflineCapture {
      id: string;
      eventId: string;
      blob: Blob;
      mode: 'single' | 'gif' | 'boomerang' | 'strip';
      status: 'pending' | 'syncing' | 'failed';
      createdAt: number;
    }
    ```
  * When `navigator.onLine` is false:
    1. Save photo to IndexedDB.
    2. Show immediate success screen to the guest with an offline message: *"Saved! Your photo will be sent once the booth syncs."*
  * When `navigator.onLine` fires true:
    1. Background worker uploads pending queue sequentially.
    2. Dispatches queued SMS/emails via backend.

### 3.2 Live Venue Slideshow Mode (`/slideshow/[slug]`)
* **Specification:**
  * Add route `frontend/src/app/slideshow/[slug]/page.tsx`.
  * Minimalist, zero-chrome fullscreen layout intended for HDMI connection to projectors or TV screens.
  * Listens to Socket.IO event `photo-uploaded` and animates incoming photos using a Ken Burns pan-and-zoom effect with event branding watermark.

### 3.3 Custom Survey & Corporate Form Builder
* **Specification:**
  * Add JSON schema field `events.settings.leadQuestions`:
    ```json
    [
      { "id": "company", "label": "Company Name", "type": "text", "required": true },
      { "id": "role", "label": "Job Title", "type": "text", "required": false },
      { "id": "optin", "label": "I agree to receive product updates", "type": "checkbox", "required": true }
    ]
    ```
  * Dynamically render form in `LeadCaptureModal.tsx` and save custom response payload into `leads.metadata`.

---

## 4. Multi-Tenant SaaS & Agency Fleet Operations

### 4.1 Custom Domains & White-Labeling (CNAME Provisioning)
* **Architecture:**
  * Next.js Middleware inspects `request.headers.get('host')`.
  * If the host does not match `snapbooth.app`, query Supabase `events` or `user_subscriptions` by `custom_domain`.
  * Rewrite incoming request directly to `/gallery/[slug]` or `/booth/[slug]` without branding badges.

### 4.2 Multi-Booth Kiosk Fleet Monitoring
* **Specification:**
  * When a booth joins an event via WebSocket:
    `socket.emit('register-booth', { boothName: 'Main Entrance', batteryLevel: 0.88, isCharging: true })`
  * Admin Live Dashboard displays a real-time status card for each active iPad (online/offline indicator, battery %, current session count).

### 4.3 Automated Cloud Backup (Google Drive / Dropbox)
* **Specification:**
  * Add OAuth2 token management for Google Drive and Dropbox in `backend/src/services/cloudSync.js`.
  * Upon photo upload completion, dispatch background task to upload high-resolution original directly to client's shared folder:
    `/SnapBooth Events/{Event_Name}/{Date}/photo_{id}.jpg`.
