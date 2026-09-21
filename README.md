# Keel

Keel is a Chromium Pomodoro extension. You set a goal and start a timer. Jev classifies the page you are on. Keel shows a toast, then a timed overlay, when the page looks off-task.

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

Anyone can install it. No invite or access keys. Each install mints an anonymous local UUID. The API combines that identifier with the request IP for shared Upstash rate limits. Production fails closed when Upstash is unavailable; local development permits requests without Upstash credentials.

Zero Data Retention is requested automatically in production. Hobby AI Gateway plans reject that option, so local development omits it. Set `AI_GATEWAY_ZERO_DATA_RETENTION=true` or `false` to override.

Run the API and extension in separate terminals:

```sh
pnpm dev:api
pnpm dev
```

The API listens on port 3000. The extension dev server uses 4173 so it does not intercept `localhost:3000`.

For a production build:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @keel/extension zip
```

Load `apps/extension/.output/chrome-mv3` as an unpacked extension from `chrome://extensions` or `brave://extensions` with Developer mode enabled.

## Privacy boundaries

Page evaluation runs only during an active session. The extension sends the hostname, title, and at most 1,500 characters of visible page text. It excludes form controls, editable regions, scripts, styles, hidden content, Keel UI, URLs, and query strings. The API does not persist page content, and the Jev request asks Vercel AI Gateway for zero-data-retention routing.
