# Project: WhatsApp VPS Bidirectional Marketing Integration

## Architecture
This project connects the local Next.js 16 / React 19 / Prisma marketing platform with the production WhatsApp bot on the VPS. 

```
+-------------------------------------------------------------------------+
|                              VPS Server                                 |
|  - Cazador, Cerrador, Logística, Seguimiento (Unmodified, 100% intact)  |
|  - marketing_adapter.js (Isolated plugin, admin whitelist, !mkt hook)   |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS / REST (X-WhatsApp-Bot-Token)
                                     v
+-------------------------------------------------------------------------+
|                  Next.js Marketing Engine (Local / Production)           |
|                                                                         |
|  [/api/whatsapp/v1/*] Gateway                                           |
|    ├── auth.ts (crypto.timingSafeEqual against WHATSAPP_BOT_API_KEY)     |
|    ├── status/route.ts (Health, connected accounts, credit balance)     |
|    ├── content/generate/route.ts (Scene, background cutout, banner, copy)|
|    ├── publish/preview/route.ts (Confirmation token & short code store) |
|    └── publish/confirm/route.ts (Dispatches to Meta & TikTok APIs)      |
|                                                                         |
|  Underlying Engines:                                                    |
|    ├── Image Engine: Sharp (cutout & banner compositing), Pollinations  |
|    ├── Copy Engine: Google Gemini AI (Ficha, Precio, Confianza)         |
|    ├── Publishing Engine: Meta Graph API (IG/FB) & TikTok API v2        |
|    └── Confirmation Engine: In-memory/DB preview store with 15m TTL     |
+-------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Test Harness Setup | Configure Vitest and test utilities for automated API integration testing | M1 | Survey |
| 2 | Gateway Token Auth | Secure M2M authentication with `WHATSAPP_BOT_API_KEY` via `crypto.timingSafeEqual` | M1 | R1 |
| 3 | System Status Endpoint | Endpoint `/api/whatsapp/v1/status` reporting system health, credits, accounts | M1 | R1 |
| 4 | Non-invasive VPS Adapter | Reference `vps/marketing_adapter.js` with admin phone whitelist and command hook | M1 | R1 |
| 5 | Background Removal Service | Route WhatsApp image cutout requests to Sharp / external fallback tiers | M2 | R2 |
| 6 | Studio Scene Generator | Route WhatsApp scene requests to Pollinations Flux / procedural SVG | M2 | R2 |
| 7 | Banner Baking Compositor | Sharp composite banner generation with WhatsApp CTA | M2 | R2 |
| 8 | WhatsApp Copy Kit Generator | Generate structured sales copies (Ficha, Precio, Confianza) for chat | M2 | R2 |
| 9 | Content Generation Endpoint | Unified `/api/whatsapp/v1/content/generate` delivering media + copy | M2 | R2 |
| 10| Preview Store & Token Engine | Generate preview, human-friendly short code (`PUB-XXXX`), and crypto token (15m TTL) | M3 | R3 |
| 11| Preview Endpoint | `/api/whatsapp/v1/publish/preview` generating preview media + confirmation prompt | M3 | R3 |
| 12| Confirmation & Multi-publish | `/api/whatsapp/v1/publish/confirm` validating token and firing Meta/TikTok | M3 | R3 |
| 13| Meta & TikTok Dispatcher | Service invoking Meta Graph API (IG/FB) and TikTok v2 with error handling | M3 | R3 |
| 14| Full E2E Test Suite | Automated opaque-box test suite (Tiers 1-4) testing all features | E2E-TEST | Criteria |
| 15| Final E2E Integration Pass | 100% pass of all E2E tests + adversarial coverage hardening (Tier 5) | M4 | Final |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Gateway, Auth & VPS Adapter | Test runner setup (Vitest), token authentication guard, `/api/whatsapp/v1/status`, tenant resolver, and `vps/marketing_adapter.js` | none | IN_PROGRESS |
| M2 | Content & Image Processing Service | Modular image service (Sharp cutout, studio scenes, banner baking), copy generation, and `/api/whatsapp/v1/content/generate` | M1 interface contracts | PLANNED |
| M3 | Multichannel Publishing & Confirmation | Preview store with TTL, `/api/whatsapp/v1/publish/preview`, `/api/whatsapp/v1/publish/confirm`, and Meta/TikTok dispatcher | M1 interface contracts | PLANNED |
| E2E-TEST | E2E Testing Suite Track | Requirement-driven opaque-box test harness and test cases (Tiers 1-4), creates `TEST_READY.md` | none | IN_PROGRESS |
| M4 | Final E2E Pass & Hardening | Pass 100% of E2E tests (Tiers 1-4) and execute Tier 5 adversarial hardening | M1, M2, M3, E2E-TEST | PLANNED |

## Interface Contracts

### 1. Authentication & Security
- **Header**: `x-whatsapp-bot-token: <WHATSAPP_BOT_API_KEY>` or `authorization: Bearer <WHATSAPP_BOT_API_KEY>`.
- **Validation**: Strict constant-time comparison (`crypto.timingSafeEqual`).
- **Response on auth failure**: Status `401 Unauthorized`: `{ success: false, error: "Unauthorized: Invalid or missing bot token" }`.

### 2. Status Endpoint (`GET /api/whatsapp/v1/status`)
- **Query / Body**: None required. Optional `userId` for specific tenant.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "system": {
      "status": "online",
      "version": "1.0.0",
      "timestamp": "2026-11-13T17:30:00Z"
    },
    "tenant": {
      "userId": "string",
      "creditsBalance": 100,
      "planType": "pro"
    },
    "connectedAccounts": {
      "instagram": { "connected": true, "accountName": "my_shop" },
      "facebook": { "connected": true, "accountName": "My Shop Page" },
      "tiktok": { "connected": true, "accountName": "@myshop" }
    }
  }
  ```

### 3. Content Generation Endpoint (`POST /api/whatsapp/v1/content/generate`)
- **Request Body**:
  ```json
  {
    "action": "scene" | "cutout" | "banner" | "full_kit",
    "imageUrl": "string (optional/required for cutout/banner)",
    "productNiche": "string (e.g. 'kitchen', 'tech', 'retail', 'fitness')",
    "headline": "string (optional for banner)",
    "subline": "string (optional for banner)",
    "ctaText": "string (optional, default: 'Pedir por WhatsApp')",
    "topic": "string (for copy generation)",
    "price": "string (for sales script)"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "media": {
      "type": "IMAGE",
      "url": "https://...",
      "aspectRatio": "4:5"
    },
    "copies": {
      "whatsappClosing": "string (ready-to-send WhatsApp pitch)",
      "whatsappFicha": "string (structured specs)",
      "whatsappPrecio": "string (price objection rebuttal)",
      "whatsappConfianza": "string (guarantee script)"
    },
    "creditsRemaining": 98
  }
  ```

### 4. Publishing Preview Endpoint (`POST /api/whatsapp/v1/publish/preview`)
- **Request Body**:
  ```json
  {
    "mediaUrl": "string (required, public URL of image/video)",
    "mediaType": "IMAGE" | "VIDEO",
    "caption": "string (optional base caption)",
    "platforms": ["INSTAGRAM", "FACEBOOK", "TIKTOK", "WHATSAPP_STATUS"],
    "productInfo": { "title": "string", "price": "string" }
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "confirmation": {
      "shortCode": "PUB-8492",
      "confirmationToken": "cftok_9f8a7b6c5d4e3f2a1...",
      "expiresAt": "2026-11-13T17:45:00Z",
      "expiresInSeconds": 900
    },
    "preview": {
      "mediaUrl": "https://...",
      "mediaType": "IMAGE",
      "targetPlatforms": ["INSTAGRAM", "FACEBOOK", "TIKTOK"],
      "platformCopies": {
        "instagram": "Copy formatted with hashtags for IG...",
        "facebook": "Copy formatted for FB Page...",
        "tiktok": "Video caption with viral hashtags..."
      },
      "confirmationPrompt": "Por favor responde 'SI PUB-8492' para publicar en Instagram, Facebook y TikTok, o 'NO PUB-8492' para cancelar."
    }
  }
  ```

### 5. Publishing Confirmation Endpoint (`POST /api/whatsapp/v1/publish/confirm`)
- **Request Body**:
  ```json
  {
    "shortCode": "PUB-8492",
    "confirmationToken": "cftok_9f8a7b6c5d4e3f2a1... (optional if shortCode supplied)",
    "confirmed": true
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "status": "PUBLISHED",
    "shortCode": "PUB-8492",
    "results": {
      "instagram": { "status": "PUBLISHED", "id": "180293849102" },
      "facebook": { "status": "PUBLISHED", "id": "938201928301" },
      "tiktok": { "status": "PUBLISHED", "publishId": "v.inbox.12345" }
    },
    "summary": "Publicación exitosa en Instagram, Facebook y TikTok."
  }
  ```
- **Cancellation Response (200 OK)**:
  ```json
  {
    "success": true,
    "status": "CANCELLED",
    "shortCode": "PUB-8492",
    "message": "Publicación cancelada correctamente."
  }
  ```

### 6. VPS Command Adapter Contract (`vps/marketing_adapter.js`)
- **Exports**: `isMarketingCommand(message)`, `handleMarketingCommand(message, whatsappClient)`.
- **Command syntax**:
  - `!mkt estado`: Calls `/api/whatsapp/v1/status` and replies with summary.
  - `!mkt foto [nicho]`: Calls `/api/whatsapp/v1/content/generate` with quoted/attached image and returns media + copies.
  - `!mkt publicar [canales]`: Calls `/api/whatsapp/v1/publish/preview` and sends preview image + prompt.
  - `SI PUB-XXXX`: Calls `/api/whatsapp/v1/publish/confirm` with `confirmed: true`.
  - `NO PUB-XXXX`: Calls `/api/whatsapp/v1/publish/confirm` with `confirmed: false`.

## Code Layout
- **M1 Owns**:
  - `vitest.config.ts` (test setup)
  - `src/lib/whatsapp/auth.ts` (token verification)
  - `src/lib/whatsapp/tenant.ts` (tenant/user resolution)
  - `src/app/api/whatsapp/v1/status/route.ts` (status route)
  - `vps/marketing_adapter.js` (isolated VPS adapter script)
  - `tests/integration/m1-gateway-auth.test.ts`
- **M2 Owns**:
  - `src/lib/whatsapp/content.service.ts` (image & copy processing logic)
  - `src/app/api/whatsapp/v1/content/generate/route.ts` (content generate route)
  - `tests/integration/m2-content-generation.test.ts`
- **M3 Owns**:
  - `src/lib/whatsapp/preview-store.ts` (confirmation tokens, short codes, TTL management)
  - `src/lib/whatsapp/social-dispatcher.ts` (multi-channel publishing calls to Meta & TikTok)
  - `src/app/api/whatsapp/v1/publish/preview/route.ts` (preview route)
  - `src/app/api/whatsapp/v1/publish/confirm/route.ts` (confirm route)
  - `tests/integration/m3-publishing-confirmation.test.ts`
- **E2E-TEST Owns**:
  - `tests/e2e/e2e-runner.ts` / test files under `tests/e2e/`
  - `TEST_INFRA.md`
  - `TEST_READY.md`
