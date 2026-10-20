# Staging Guide — PocketPlan

## Alur Kerja

```
feature/xxx  →  PR ke staging  →  CI pass  →  merge  →  test preview  →  PR staging→main  →  production
```

## Test Web di Staging

1. Push ke branch `staging` (atau PR ke staging di-merge)
2. Vercel otomatis deploy preview → dapat URL seperti `https://pocketplan-xxx-yyy.vercel.app`
3. Buka URL preview, cek fitur yang diubah
4. Banner merah "STAGING ENVIRONMENT" harus muncul di atas halaman

## Test Bot di Staging

Bot Telegram tetap mengarah ke production. Untuk test staging, kirim update buatan:

```bash
cd backend
node scripts/testStaging.js <preview-url> "<command>"
```

Contoh:
```bash
node scripts/testStaging.js https://pocketplan-abc123.vercel.app "/saldo"
node scripts/testStaging.js https://pocketplan-abc123.vercel.app "kopi 25rb"
node scripts/testStaging.js https://pocketplan-abc123.vercel.app "/streak"
```

Balasan bot masuk ke chat Telegram developer (chat ID dari `DEV_TELEGRAM_IDS`).

## Smoke Test Checklist

### Web
- [ ] Landing page load
- [ ] Login/register
- [ ] Email verification terkirim
- [ ] Dashboard + chart
- [ ] Tambah/hapus transaksi
- [ ] Tambah goal
- [ ] Receipt scanner
- [ ] Dark/light theme
- [ ] Profile page

### Bot
- [ ] `/start` → bot membalas
- [ ] `/saldo` → tampil saldo
- [ ] `kopi 25rb` → transaksi tercatat
- [ ] `/streak` → tampil streak

## Rollback

| Situasi | Aksi |
|---|---|
| Merge ke main broken | `git revert <merge-commit> && git push` |
| Production down urgent | Vercel Dashboard → Deployments → deployment lama → "Promote to Production" |
| Staging broken | Fix di branch baru → PR ke staging lagi |

## Pengaman yang Aktif

- **Webhook guard**: non-production hanya proses chat ID dari `DEV_TELEGRAM_IDS`
- **Cron gate**: `/api/cron/reminders` ditolak di non-production
- **CORS**: preview URL `*.vercel.app` otomatis diizinkan
- **Staging banner**: strip merah di atas halaman saat `VITE_STAGING_BANNER=true`
