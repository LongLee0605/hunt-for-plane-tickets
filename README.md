# Flight Deal Watcher (React + Vite + Tailwind)

Ung dung theo doi gia ve voi frontend React/Vite/Tailwind va backend Express API.

## Kien truc

- `src/client/*`: giao dien React + Tailwind.
- `src/server/index.ts`: REST API (`/api/rules`, `/api/deals`, `/api/scan`, `/api/status`).
- `src/lib/*`: scanner, provider, notifier, D1 access.
- `cloudflare/scan-trigger/*`: Cloudflare Worker cron trigger.

## Chay local

```bash
npm install
cp .env.example .env.local
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Build frontend

```bash
npm run build
```

## Khoi tao D1 schema

```bash
npx wrangler d1 execute hunt-for-plane --file migrations/0001_init.sql
```

## Worker scan dinh ky (local)

```bash
npm run worker
```

Mac dinh cron moi 10 phut (`SCAN_CRON=*/10 * * * *`).

## Cloudflare Cron Trigger (production)

```bash
npx wrangler secret put CRON_SECRET --config cloudflare/scan-trigger/wrangler.toml
npx wrangler deploy --config cloudflare/scan-trigger/wrangler.toml --var APP_BASE_URL:https://<your-api-domain>
```

Worker se goi `POST /api/scan/cron` moi 10 phut.

## Bien moi truong

- `TRAVELPAYOUTS_BASE_URL`
- `TRAVELPAYOUTS_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `NOTIFY_TO_EMAIL`
- `CRON_SECRET`
- `APP_BASE_URL`
- `PORT` (mac dinh `8787`)
