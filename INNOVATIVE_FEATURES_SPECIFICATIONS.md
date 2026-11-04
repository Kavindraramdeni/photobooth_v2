# SnapBooth AI — Innovative & High-Value Feature Specifications

This document defines the technical architecture, user experience, and revenue models for the **20 high-value, differentiated features** that elevate SnapBooth from a basic photo booth CRUD utility into an enterprise event engagement platform.

---

## 1. Guest Experience Features

### 1. Instant Session Delivery (Dynamic Session QR & WhatsApp Delivery)
* **Value Proposition:** Direct, privacy-preserving session delivery without face scanning or biometric data collection. Each guest session mints a distinct short code (`/p/[code]`), giving guests immediate access to their exact photos with 1-tap download and instant WhatsApp sharing.
* **Technical Architecture:**
  * **Short Code Engine:** 6-character collision-resistant Base62 generator (`backend/src/services/sharing.js`).
  * **Instant Session QR:** Kiosk generates a high-contrast QR pointing to `yourapp.com/p/:code`.
  * **WhatsApp Dispatch:** Direct phone number capture dispatches session link through WhatsApp Cloud API or Twilio.
  * **Zero Biometric Footprint:** No face scanning, no vector embeddings, and zero facial biometric storage.

---

### 2. Live Social Wall (`/wall/:slug`)
* **Value Proposition:** Displays high-energy, real-time photo animations on venue projectors, LED walls, or large TV screens during weddings, galas, and corporate events.
* **Technical Architecture:**
  * **Route:** Dedicated fullscreen route `frontend/src/app/wall/[slug]/page.tsx` with zero navigation bars.
  * **Moderation Pipeline:** Only photos with `is_hidden = false` and `is_approved = true` are shown.
  * **Display Engine:** WebGL / CSS Ken Burns pan-and-zoom animation with live QR code in the corner inviting new guests to step into the booth.
  * **Real-time Sync:** Socket.IO event `photo-approved` triggers an animated card flip onto the screen.

---

### 3. Digital Guestbook & Video Messages
* **Value Proposition:** Guests at weddings or milestone birthdays can leave a photo paired with a handwritten digital wish, audio greeting, or short 15-second video message.
* **Technical Architecture:**
  * **Media Capture:** `MediaRecorder` API captures 1080p WebM/MP4 video clips with audio.
  * **Digital Signature Canvas:** Guests sign or draw personalized congratulations using an HTML5 touch canvas.
  * **Compilation:** Backend combines the guest photo and handwritten note into a printable PDF memory book for the event host.

---

### 4. Themed AI Experience Booth
* **Value Proposition:** Guests transform into stylized characters: Vintage Kodachrome, 1980s Retro Yearbook, Studio Ghibli Anime, Cyberpunk, Renaissance Oil Painting, or Brand Mascots.
* **Technical Architecture:**
  * **Tier 1 (Face-Preserving img2img):** Cloudflare Workers AI (`stable-diffusion-v1-5-img2img`) with strict prompt conditioning and structural edge weighting.
  * **Live Feedback:** WebSocket emits progress steps (`"Analyzing portrait..."` $\rightarrow$ `"Applying artistic style..."` $\rightarrow$ `"Finalizing render..."`) to keep guests entertained during the 4–6 second generation.

---

### 5. Video Messages & Boomerangs
* **Value Proposition:** Fast-paced dynamic movement that is instantly ready for Instagram Reels, TikTok, and WhatsApp Stories.
* **Technical Architecture:**
  * Generates both high-res animated **GIF** and **MP4 (H.264 / AAC)** using FFmpeg reverse-loop filters (`[0:v]reverse[r];[0:v][r]concat`).
  * Optimized file size (< 3.5 MB) to ensure fast delivery over mobile data.

---

## 2. Event Organizer Features

### 6. Live Event Analytics & Telemetry
* **Metrics Tracked:**
  * Real-time captures, unique guest sessions, and peak capture hours.
  * Social shares (WhatsApp vs Instagram vs SMS).
  * Thermal print count and paper remaining estimates.
  * AI style popularity rankings (e.g., "Cyberpunk: 42%, Anime: 31%").
* **Visualization:** Live Recharts charts streaming metrics via Socket.IO directly to the operator dashboard.

---

### 7. Multi-Booth Control Center
* **Value Proposition:** Large conventions or multi-room venues with 2 to 10 iPads operating simultaneously under a single event umbrella.
* **Technical Architecture:**
  * Each kiosk identifies itself on startup: `booth_id`, `name` (e.g., "Hall A - Main Entrance"), `battery_level`, `device_model`, `online_status`.
  * Central admin dashboard allows the event director to pause, change branding, update countdown timers, or lock all booths simultaneously.

---

### 8. Smart Print Manager
* **Value Proposition:** Eliminates printer jams, prevents queue locks, and guarantees balanced printing across multiple hardware units.
* **Technical Architecture:**
  * **Queue Spooler:** Non-blocking FIFO queue with automatic retries on printer error.
  * **Printer Pooling:** Load-balances print requests between Printer 1 and Printer 2.
  * **Operator Controls:** Set per-session print limits (e.g., max 2 copies per group) to prevent paper waste.

---

### 9. Template Marketplace
* **Value Proposition:** Operators can purchase, download, or customize ready-made overlay templates for weddings, Halloween, Christmas, corporate galas, and graduations.
* **Technical Architecture:**
  * JSON-based multi-layer template engine (background, photo slots, PNG frames, dynamic typography, event date stamps).
  * Community & agency sharing library where designers can publish and sell theme packs.

---

### 10. Operator Task & Equipment Management
* **Value Proposition:** Event agency owners can assign technicians and operators to specific events, provide digital setup checklists, and track equipment inventory (cameras, printers, stands, backdrops).
* **Technical Architecture:**
  * Role-based access: `operator` accounts have access only to their assigned event dates and setup instructions without seeing company revenue.

---

## 3. Advanced & Revenue-Generating Features

| No. | Feature | Business Benefit & Monetization Model |
|:---:|:---|:---|
| **11** | **WhatsApp Photo Delivery** | Highest open rates (> 95%). Guests receive their photos directly in a branded WhatsApp message via Twilio / Meta WhatsApp Cloud API. |
| **12** | **Digital Invitations & RSVP** | Up-sell event hosts an all-in-one platform: send digital invitations with QR codes that double as the guest's photo booth pass. |
| **13** | **Event Highlights Reel** | Backend auto-generates a 60-second video montage compiling top photos, boomerangs, and audio messages set to background music for social sharing. |
| **14** | **AI Background Replacement** | Replaces physical green screens with real-time semantic background segmentation (`@imgly/background-removal` or server-side depth matting). |
| **15** | **Sponsor Branding & Monetization** | Corporate clients sell digital ad space: sponsor logo watermark, sponsored email banners, and sponsor CTA buttons on guest download pages. |
| **16** | **White-label Agency Platform** | High-tier SaaS plan: Agencies host galleries and kiosks under their own custom domain (`photos.agencyname.com`) with zero SnapBooth branding. |
| **17** | **Custom Event Microsites** | Dedicated SEO-optimized event landing page featuring a countdown clock, venue map, live gallery, and sponsor shoutouts. |
| **18** | **Guest Consent & GDPR Manager** | Configurable consent checkboxes (Terms of Service, Marketing emails, Face search consent) ensuring strict legal compliance. |
| **19** | **Corporate Lead Generation** | Configurable modal capturing custom fields (Company Name, Job Title, Purchase Timeline) with automatic export to HubSpot or CSV. |
| **20** | **Automated Gallery Expiration** | Scheduled background worker automatically sets galleries to read-only or archives media after 7/30/90 days based on the customer's plan tier. |
