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
- `data/store.json`: luu du lieu local cho MVP.

## Cai dat

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mo [http://localhost:3000](http://localhost:3000).

## Worker scan dinh ky

```bash
npm run worker
```

Mac dinh cron moi 10 phut (`SCAN_CRON=*/10 * * * *`).

## Bien moi truong

- `TRAVELPAYOUTS_BASE_URL`: API base URL cua Travelpayouts.
- `TRAVELPAYOUTS_TOKEN`: token Data API (dang ky affiliate co the su dung voi tai khoan ca nhan).
- `GMAIL_USER`: Gmail sender.
- `GMAIL_APP_PASSWORD`: app password cua Gmail sender.
- `NOTIFY_TO_EMAIL`: email nguoi nhan canh bao.

## Do chinh xac du lieu

- He thong chi dung duy nhat Travelpayouts Data API.
- KHONG dung crawl va KHONG dung du lieu mock fallback.
- Chi gui canh bao khi co du lieu thuc tu API.
