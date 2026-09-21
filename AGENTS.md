# Keel

Chromium MV3 Pomodoro that adds friction when Jev classifies a page as off-task. Local setup and the privacy copy live in README.md.

## Shape

pnpm workspace: `packages/contracts`, `apps/extension` (WXT MV3), `apps/api` (Next.js App Router). Wire types, Zod schemas, storage keys, and runtime messages live only in contracts. Change a shared shape there first.

The background worker owns the session. Popup and content scripts send `ExtensionRuntimeRequest` messages; they do not write session storage.

## Session

Mutations go through `executeSessionCommand`, `recordOverride`, and `recordEvaluation`, which `enqueue` so `chrome.storage.local` and the session-end alarm stay consistent. Remaining time is derived from an absolute `endsAt`. Pause stores `pausedRemainingMs` and clears `endsAt`. Completing or ending a session clears `goal`, `allowedExamples`, and `interventionTimestamps`.

Evaluation runs only while `snapshot.status === "running"`. SPA URL changes are a 1s location heartbeat. DOM mutations debounce 900ms (2.5s max wait) and throttle to one evaluation per 5s.

## Page text

`extractPageContext` keeps hostname, title (≤200 chars), and ≤1,500 characters of visible main-content text. It drops forms, editors, scripts, chrome, hidden nodes, and `[data-keel-ui]`. Fingerprint is SHA-256 of `hostname\ntitle\nexcerpt`. Pages with no title and excerpt under 40 characters are skipped.

Jev treats page text as evidence, never as instructions. The API does not persist excerpts.

## Evaluation and friction

Background path: parse page → require a running session → cache key `sessionId:overrides:fingerprint` (30min `chrome.storage.session`) → POST `/api/v1/evaluations` → confirm the same session is still running (`matchesSession`) → `decideIntervention`.

Missing, timed-out, or invalid evaluations resolve to `allow`. The content script repeats the active/sessionId/fingerprint check before mounting an intervention.

While a session is running, a bottom-right status bar shows the latest Jev alignment, mix, and distraction for the current page. It starts as "Reading this page", then the evaluation, or "Couldn't classify" on failure. The bar hides while a toast or interstitial is mounted and returns after Continue anyway.

Intervene only on confident distraction: `alignment.value === "off_task"`, off_task probability ≥ 0.75, and distraction probability ≥ 0.75. Escalation counts intervention timestamps in the last 10 minutes: toast, then interstitial 5s, then interstitial 15s.

"Continue anyway" records an override (max 3 `allowedExamples`) and clears the evaluation cache. Overlay and status UI mount in a closed shadow root marked `data-keel-ui`. Color tokens match `popup/theme.css`; overlay CSS is the string in `intervention/mount.ts`; status bar CSS is the string in `status/mount.ts`.

## API

`POST /api/v1/evaluations` requires `x-keel-installation-id` (UUID). Body is `evaluationRequestSchema` (`.strict()`, ≤8,192 bytes). Jev via Vercel AI Gateway: model `typesafe-ai/jev`, `only: ["typesafe-ai"]`, and `zeroDataRetention` in production (Hobby plans reject ZDR; local omits it). The route aborts at 2.5s; the extension client aborts at 4s and treats failure as allow.

Rate limits hash installation id and client IP. Production requires Upstash and denies when Redis is missing or the check throws. Local non-production permits requests without Upstash.

Each install mints an anonymous UUID in extension settings. `WXT_PUBLIC_API_BASE_URL` is baked into `host_permissions` at build time.

## Verify

Colocated `*.test.ts` (vitest). DOM extraction tests need `// @vitest-environment happy-dom`. Policy, session remaining-time math, scheduler, and cache-key identity have unit coverage; keep those failing until the new behavior is intentional. `pnpm test` and `pnpm typecheck` from the repo root.
