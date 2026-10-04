# RAGION SHOP Mini App v5

Perbaikan untuk penggunaan di HP/Telegram Mini App:

- Setiap produk memiliki tombol **BELI SEKARANG**.
- Menekan beli langsung membuat order lokal dan membuka PAYMENT.
- PAYMENT selalu menampilkan QRIS dan form upload bukti transfer.
- Upload bukti memakai `/api/payment-proof` dan memverifikasi `Telegram.WebApp.initData`.
- Setelah berhasil, bukti + nama pembeli + @username + Telegram ID + order + total dikirim ke admin Telegram.
- Menu menggunakan custom gradient, berganti palette otomatis setiap 3 detik.
- Banner 3 slide otomatis setiap 5 detik.
- Klik menu memicu suara langsung melalui audio TTS URL pada gesture klik dan fallback ke SpeechSynthesis perangkat.

## Vercel Environment Variables

Production:

- `BOT_TOKEN` = token bot Telegram baru
- `ADMIN_IDS` = `6532672277`
- `STORE_NAME` = `RAGION SHOP`

## Deploy

Upload isi folder ke project Vercel yang sama, lalu Redeploy.

Pastikan Mini App dibuka dari tombol **BUKA RAGION SHOP** di Telegram agar `Telegram.WebApp.initData` tersedia.

## Alur pembayaran

ORDER → BELI SEKARANG → PAYMENT → QRIS → PILIH BUKTI TRANSFER → KIRIM BUKTI KE ADMIN.
