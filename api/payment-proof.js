const crypto = require('crypto');
const fs = require('fs/promises');
const { IncomingForm } = require('formidable');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function validateInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false, reason: 'Telegram session tidak ditemukan.' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'Hash Telegram tidak ditemukan.' };

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 24 * 60 * 60) {
    return { ok: false, reason: 'Sesi Telegram sudah kedaluwarsa.' };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Data Telegram tidak valid.' };
  }

  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch {}
  if (!user?.id) return { ok: false, reason: 'Data user Telegram tidak ditemukan.' };

  return { ok: true, user };
}

async function telegram(method, body) {
  const token = process.env.BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram API ${method} gagal`);
  return data.result;
}

async function sendProofFile(chatId, file) {
  const token = process.env.BOT_TOKEN;
  const buffer = await fs.readFile(file.filepath);
  const isImage = String(file.mimetype || '').startsWith('image/');
  const field = isImage ? 'photo' : 'document';
  const endpoint = isImage ? 'sendPhoto' : 'sendDocument';

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append(field, new Blob([buffer], { type: file.mimetype || 'application/octet-stream' }), file.originalFilename || 'bukti-transfer');

  const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
    method: 'POST',
    body: form
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram API ${endpoint} gagal`);
  return data.result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method tidak diizinkan.' });
  if (!process.env.BOT_TOKEN) return json(res, 500, { ok: false, message: 'BOT_TOKEN belum diatur di Vercel.' });
  if (!process.env.ADMIN_IDS) return json(res, 500, { ok: false, message: 'ADMIN_IDS belum diatur di Vercel.' });

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
    return json(res, 413, { ok: false, message: 'File terlalu besar. Maksimal 10 MB.' });
  }

  const form = new IncomingForm({
    multiples: false,
    maxFileSize: MAX_FILE_SIZE,
    keepExtensions: true,
    allowEmptyFiles: false
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
    });

    const scalar = value => Array.isArray(value) ? value[0] : value;
    const initData = scalar(fields.initData);
    const validation = validateInitData(initData, process.env.BOT_TOKEN);
    if (!validation.ok) return json(res, 401, { ok: false, message: validation.reason });

    const user = validation.user;
    const orderId = String(scalar(fields.orderId) || `ORD-${Date.now()}`).slice(0, 80);
    const productName = String(scalar(fields.productName) || 'Produk digital').slice(0, 200);
    const amount = String(scalar(fields.amount) || 'Rp 0').slice(0, 50);
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Pembeli';
    const username = user.username ? `@${user.username}` : 'tanpa username';
    const file = files.proof;
    const uploadedFile = Array.isArray(file) ? file[0] : file;

    if (!uploadedFile) return json(res, 400, { ok: false, message: 'Bukti pembayaran belum dipilih.' });

    const adminIds = process.env.ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean);
    const storeName = process.env.STORE_NAME || 'RAGION SHOP';
    const message = [
      `🔔 <b>KONFIRMASI PEMBAYARAN BARU</b>`,
      ``,
      `🏪 <b>${escapeHtml(storeName)}</b>`,
      `🧾 Order ID: <code>${escapeHtml(orderId)}</code>`,
      `📦 Produk: <b>${escapeHtml(productName)}</b>`,
      `💰 Total: <b>${escapeHtml(amount)}</b>`,
      ``,
      `👤 Pembeli: <a href="tg://user?id=${user.id}">${escapeHtml(displayName)}</a>`,
      `🔗 Username: <b>${escapeHtml(username)}</b>`,
      `🆔 Telegram ID: <code>${escapeHtml(user.id)}</code>`,
      `📌 Status: <b>MENUNGGU KONFIRMASI ADMIN</b>`
    ].join('\n');

    for (const adminId of adminIds) {
      try {
        await telegram('sendMessage', { chat_id: adminId, text: message, parse_mode: 'HTML' });
        await sendProofFile(adminId, uploadedFile);
      } catch (error) {
        console.error(`Gagal kirim ke admin ${adminId}:`, error.message);
      }
    }

    // Kirim konfirmasi balik ke pembeli.
    try {
      await telegram('sendMessage', {
        chat_id: user.id,
        text: `✅ <b>Bukti pembayaran berhasil dikirim.</b>\n\nOrder <code>${escapeHtml(orderId)}</code> sedang menunggu konfirmasi admin.`,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.warn('Konfirmasi ke user gagal:', error.message);
    }

    return json(res, 200, { ok: true, message: 'Bukti pembayaran berhasil dikirim ke admin.' });
  } catch (error) {
    console.error('PAYMENT PROOF ERROR:', error);
    const message = /maxFileSize/i.test(error.message || '')
      ? 'File terlalu besar. Maksimal 10 MB.'
      : 'Gagal memproses bukti pembayaran.';
    return json(res, 500, { ok: false, message });
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
