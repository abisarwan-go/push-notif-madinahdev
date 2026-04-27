# Project Analysis: Current State and Push MVP

## 1) Current Architecture (validated)

### Stack
- Frontend: React + TypeScript + Vite (`src/react-app`).
- Backend API: Hono on Cloudflare Workers (`src/worker/index.ts`).
- Infra/deploy: Wrangler config in `wrangler.json`.

### Runtime flow today
1. Browser loads the SPA (`index.html` -> `src/react-app/main.tsx`).
2. `App.tsx` renders template UI (counter + one API button).
3. API button calls `GET /api/`.
4. Worker route responds with static JSON `{ name: "Cloudflare" }`.

### What is implemented
- Basic React template UI and state.
- Single Worker API route.
- Cloudflare assets + SPA fallback configured in `wrangler.json`.
- Scripts for local dev, build, deploy, and type generation (`package.json`).

### Current limitations
- No push notifications implementation yet.
- No browser service worker registration.
- No push subscription persistence/bindings.
- No tests (unit/integration/e2e).
- Minimal error handling around network/API failures.

## 2) Push Notifications MVP Specification

## Goal
Deliver a first end-to-end Web Push flow:
- user grants notification permission,
- browser subscribes to push,
- subscription is stored,
- backend triggers a test notification.

## Proposed MVP components

### Frontend
- Add a "Enable notifications" action in React app.
- Register a browser service worker (for push events and notification display).
- Request permission with `Notification.requestPermission()`.
- Create subscription with `PushManager.subscribe(...)` using VAPID public key.
- Send subscription JSON to Worker API (`POST /api/push/subscribe`).
- Add minimal UX states: idle/loading/success/error/permission denied.

### Browser service worker
- Handle `push` event and display notification.
- Handle `notificationclick` to open/focus app URL.
- Keep payload contract small: `title`, `body`, optional `url`.

### Worker API
- `POST /api/push/subscribe`: validate and store subscription.
- `POST /api/push/unsubscribe`: remove subscription.
- `POST /api/push/test`: trigger a test notification to one or many subscribers.
- Add input validation and structured error responses.

### Storage and bindings
- Use one binding-backed store for subscriptions (KV or D1; KV is simpler for MVP).
- Add required bindings in `wrangler.json`.
- Regenerate types after bindings changes (`npm run cf-typegen`).

### Security and operations baseline
- Protect send/test endpoint (token or simple auth guard for MVP).
- Rate limit push-send endpoints.
- Remove invalid/stale subscriptions on provider errors (404/410 equivalents).
- Add logs for subscribe/send failures for troubleshooting.

## 3) Recommended Implementation Order (fastest path)

1. **Define payload + endpoints contract**
   - Request/response schema for subscribe/unsubscribe/test.
2. **Add bindings and types**
   - Update `wrangler.json`.
   - Run `npm run cf-typegen`.
3. **Implement Worker endpoints**
   - Create API handlers with validation and storage logic.
4. **Implement browser service worker**
   - Add push and click handlers.
5. **Implement frontend opt-in flow**
   - Register service worker, subscribe, call backend.
6. **Add basic hardening**
   - Auth guard for test endpoint, stale subscription cleanup, simple rate limiting.
7. **Add minimal tests**
   - API handler tests + one smoke test for subscription flow.

## 4) Risk Register and Mitigations

- Permission denied by users:
  - Provide clear CTA copy and fallback UI.
- Subscription churn/expiry:
  - Prune invalid subscriptions during send attempts.
- Endpoint abuse:
  - Add auth + rate limiting before exposing push trigger publicly.
- Delivery visibility:
  - Add logs/metrics around send attempts and failures.

## 5) Cloudflare Notes (current docs check)

- Workers limits should be verified against Cloudflare's official limits page before production sizing:
  - https://developers.cloudflare.com/workers/platform/limits/
- Keep `wrangler.json` and generated Worker types in sync whenever bindings change.
