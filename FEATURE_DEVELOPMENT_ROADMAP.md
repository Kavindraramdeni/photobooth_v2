# SnapBooth Feature Development Roadmap

This document outlines the official 3-phase, 25-feature roadmap for **SnapBooth AI**.

---

## Phase 1 – Essential Improvements (Highest Priority)

Focus on security, data privacy, and kiosk capture reliability.

| No. | Feature | What It Does | Status |
|:---:|:---|:---|:---:|
| **1** | **Secure Event Access** | Protect event data and prevent unauthorized access. | ⏳ Pending |
| **2** | **Secure Photo Upload** | Allow uploads only from authorized event devices and guests. | ⏳ Pending |
| **3** | **Photo Privacy Control** | Hide private photos properly, including direct API access. | ⏳ Pending |
| **4** | **Operator Login** | Give booth operators secure access without sharing admin credentials. | ⏳ Pending |
| **5** | **Event Staff Management** | Add staff accounts with different permissions. | ⏳ Pending |
| **6** | **Secure Live Gallery** | Give guests controlled access to event photos. | ⏳ Pending |
| **7** | **Upload Reliability** | Prevent failed uploads and duplicate photos. | ⏳ Pending |
| **8** | **Offline Capture & Sync** | Continue capturing photos without internet and sync later. | ⏳ Pending |

---

## Phase 2 – Professional Photo Booth Features (Product Improvements)

Focus on booth hardware integrations, operations, and venue guest experience.

| No. | Feature | What It Does | Status |
|:---:|:---|:---|:---:|
| **9** | **Multi-Booth Management** | Connect multiple photo booths to one event. | ⏳ Pending |
| **10** | **Printer Manager** | Manage connected printers and print jobs. | ⏳ Pending |
| **11** | **Print Queue** | Queue, retry and track printing jobs. | ⏳ Pending |
| **12** | **Print Templates** | Create custom layouts, strips and photo frames. | ⏳ Pending |
| **13** | **Live Slideshow** | Display approved event photos on a large screen. | ⏳ Pending |
| **14** | **Photo Moderation** | Approve or reject photos before public display. | ⏳ Pending |
| **15** | **QR Code Sharing** | Let guests scan and download their photos via Session & Event QR. | ⏳ Pending |
| **16** | **Guest Self-Service Gallery** | Let guests find and download photos via session code or event gallery (face-search dropped). | ⏳ Pending |
| **17** | **Event Branding** | Customize logos, colors, overlays and gallery design. | ⏳ Pending |

---

## Phase 3 – Business and Revenue Features

Focus on SaaS monetization, client CRM, multi-tenant agency tools, and automation.

| No. | Feature | What It Does | Status |
|:---:|:---|:---|:---:|
| **18** | **Subscription Management** | Free, Pro and Business plans. | ⏳ Pending |
| **19** | **AI Credit System** | Charge credits for AI transformations. | ⏳ Pending |
| **20** | **Usage Dashboard** | Track photos, storage, AI and printing usage. | ⏳ Pending |
| **21** | **Team/Organization Accounts** | Manage multiple employees and events. | ⏳ Pending |
| **22** | **Customer CRM** | Manage event customers and enquiries. | ⏳ Pending |
| **23** | **Automated Event Reports** | Generate downloadable event performance reports. | ⏳ Pending |
| **24** | **White-label Galleries** | Let customers use their own branding and domain. | ⏳ Pending |
| **25** | **Scheduled Gallery Delivery** | Automatically send gallery links after events. | ⏳ Pending |

---

## Architectural Privacy Standard: Deprecation of Biometric Face-Search

> **Notice:** The previously proposed "Find My Photos" face-search capability has been **permanently dropped** from the platform roadmap in favor of **Instant Session QR Delivery (`/p/[code]`)** and **Event Gallery QR Delivery (`/gallery/[slug]`)**:
> - **Zero Biometric Footprint:** Prevents GDPR Article 9 special-category biometric liabilities and Illinois BIPA compliance exposure.
> - **Bandwidth & Performance:** Eliminates client-side neural network downloads (~20MB `@vladmandic/face-api` model weights) on mobile venue connections.
> - **Session Privacy:** Each kiosk photo session generates an ephemeral 6-character Base62 short code (`/p/[code]`), isolating guest captures directly to their group.

---

## Detailed Innovative Feature Specifications

For in-depth architectural blueprints and revenue models on the **20 high-value differentiator features** (including *Instant Session QR Delivery*, *Live Social Wall*, *Digital Guestbook*, *Smart Print Manager*, *WhatsApp Delivery*, and *Sponsor Branding*), see:

📄 **[INNOVATIVE_FEATURES_SPECIFICATIONS.md](file:///c:/Users/Kavin/antigravity/photobooth_v2-main/INNOVATIVE_FEATURES_SPECIFICATIONS.md)**

