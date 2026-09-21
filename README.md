# Focus Guardian

Focus Guardian is a Chromium extension that pairs a goal-based Pomodoro timer with Jev page classification. While a focus session is running, it checks the visible content of visited pages and adds progressively stronger friction when a page appears unrelated to the current goal.

## Local setup

Install dependencies:

```sh
pnpm install
```

Create `apps/api/.env.local` for the Next.js API:

```dotenv
AI_GATEWAY_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Create `apps/extension/.env.local` for the extension:

```dotenv
WXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

The extension is open to every installer; there are no invite or pasted access keys. Each installation creates an anonymous local UUID. The API combines that identifier with the request IP for shared Upstash rate limits. Production fails closed when Upstash is unavailable; local development permits requests without Upstash credentials.

Run the API and extension in separate terminals:

```sh
pnpm dev:api
pnpm dev
```

For a production build:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @focus-guardian/extension zip
```

Load `apps/extension/.output/chrome-mv3` as an unpacked extension from `chrome://extensions` or `brave://extensions` with Developer mode enabled.

## Privacy boundaries

Page evaluation runs only during an active session. The extension sends the hostname, title, and at most 1,500 characters of visible page text. It excludes form controls, editable regions, scripts, styles, hidden content, Focus Guardian UI, URLs, and query strings. The API does not persist page content, and the Jev request asks Vercel AI Gateway for zero-data-retention routing.
