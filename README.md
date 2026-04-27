# Flight Deal Watcher

Ung dung web theo doi gia ve theo rule va gui canh bao qua Gmail.

## Tinh nang hien tai

- Tao rule: diem di/den, khoang ngay bay, gia tran, hang bay.
- Scan du lieu qua provider abstraction (`Vietnam Airlines`, `Vietjet`).
- Luu deal va tranh gui email trung lap.
- Trigger scan thu cong qua UI hoac chay worker cron.

## Kien truc

- `src/app/api/*`: REST API cho rules, scan, deals, status.
- `src/lib/providers/*`: adapter lay du lieu theo tung hang bay.
- `src/lib/scanner.ts`: engine scan, match, notify.
- `src/lib/notifier.ts`: gui email qua Gmail app password.
- `src/lib/db.ts`: ket noi truc tiep Cloudflare D1 qua REST API.

## Cai dat

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mo [http://localhost:3000](http://localhost:3000).

## Khoi tao D1 schema

```bash
npx wrangler d1 execute hunt-for-plane --file migrations/0001_init.sql
```

## Worker scan dinh ky

```bash
npm run worker
```

Mac dinh cron moi 10 phut (`SCAN_CRON=*/10 * * * *`).

## Bien moi truong

- `TRAVELPAYOUTS_BASE_URL`: API base URL cua Travelpayouts.
- `TRAVELPAYOUTS_TOKEN`: token Data API (dang ky affiliate co the su dung voi tai khoan ca nhan).
- `CLOUDFLARE_ACCOUNT_ID`: account id Cloudflare.
- `CLOUDFLARE_API_TOKEN`: API token co quyen D1 edit.
- `CLOUDFLARE_D1_DATABASE_ID`: ID cua D1 database.
- `GMAIL_USER`: Gmail sender.
- `GMAIL_APP_PASSWORD`: app password cua Gmail sender.
- `NOTIFY_TO_EMAIL`: email nguoi nhan canh bao.

## Do chinh xac du lieu

- He thong chi dung duy nhat Travelpayouts Data API.
- KHONG dung crawl va KHONG dung du lieu mock fallback.
- Chi gui canh bao khi co du lieu thuc tu API.

## Cloudflare D1

- Da tao san `wrangler.toml` voi:
  - `name = "hunt-for-plane"`
  - `database_name = "hunt-for-plane"`
  - `database_id = "10520127-e469-4ceb-bd1b-2c82079a9aed"`
