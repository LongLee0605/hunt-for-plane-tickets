# Flight Deal Watcher (React + Vite + Tailwind)

Ung dung theo doi gia ve voi frontend React/Vite/Tailwind va backend Express API.

## Kien truc

- `src/client/*`: giao dien React + Tailwind.
- `src/server/index.ts`: REST API (`/api/rules`, `/api/deals`, `/api/scan`, `/api/status`).
- `GET /api/deals?scope=matching`: tat ca chuyen van con khop rule (tuyen, ngay, hang, gia tran).
- `src/lib/*`: scanner, provider, notifier, D1 access.
- `cloudflare/scan-trigger/*`: Cloudflare Worker cron trigger.

## Chay local

```bash
npm install
cp .env.example .env.local
npm run dev
```

- Frontend: `http://localhost:5173` (hoac port khac neu 5173 da bi chiem; xem log Vite)
- API: `http://localhost:8787` — **bat buoc** khi dung UI: `npm run dev` chay ca Vite va API; neu chi `npm run dev:web` thi `/api/*` se loi.

Luu y: khoang ngay quet Travelpayouts duoc tinh theo lich **UTC** de tranh lech ngay o may timezone (VD Viet Nam).

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

- `DB_MODE`: `local` (dev) hoac `d1` (production).
- `TRAVELPAYOUTS_BASE_URL`
- `TRAVELPAYOUTS_TOKEN`
- `TRAVELPAYOUTS_MAX_CALENDAR_MONTHS` (tu chon, mac dinh 12): gioi han so thang goi API calendar khi khoang ngay rule dai.
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `NOTIFY_TO_EMAIL`
- `CRON_SECRET`
- `APP_BASE_URL`
- `PORT` (mac dinh `8787`)

## Che do DB

- Local dev: de `DB_MODE=local`, du lieu luu trong `data/store.json`.
- Production Cloudflare: de `DB_MODE=d1` va cung cap day du `CLOUDFLARE_*`.

## Du lieu gia ve (Travelpayouts)

- Ung dung lay gia theo **tung ngay trong thang** qua `/v1/prices/calendar`, moi ngay co mot muc gia kem ma hang `airline` — phu hop loc VN/VJ.
- Endpoint `/v1/prices/cheap` chi tra **mot** muc re nhat cho ngay/tuyen; hang bay co the khong phai VN/VJ nen truoc day hay ra **0 chuyen**.
