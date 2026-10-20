/**
 * Pocketplan Email Verification Template
 * Brand color: #e45153, Font: Poppins, responsive email HTML + text
 */

export const getEmailTemplate = ({ name, verificationUrl, appUrl = 'https://pocketplan.my.id' }) => {
  const currentYear = new Date().getFullYear();
  const rawName = name ? String(name).trim() : 'Sobat Pocketplan';
  const recipientName = rawName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const targetUrl = verificationUrl || `${appUrl}/verification`;
  const subject = 'Verifikasi Alamat Email Anda — Pocketplan';

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
    .wrapper { width: 100%; background: #f8fafc; padding: 32px 12px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #e45153 0%, #c93e42 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: #ffffff; font-size: 22px; margin-bottom: 10px; }
    .brand-title { font-size: 24px; font-weight: 700; margin: 0; color: #ffffff; }
    .brand-tag { font-size: 13px; color: rgba(255,255,255,0.9); margin-top: 4px; margin-bottom: 0; }
    .body { padding: 32px 28px 24px; font-size: 15px; line-height: 1.6; color: #334155; }
    .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin: 0 0 14px; }
    .cta-wrap { text-align: center; margin: 28px 0; }
    .btn { background: #e45153; background: linear-gradient(135deg, #e45153 0%, #d83c3e 100%); color: #ffffff !important; display: inline-block; padding: 14px 34px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 50px; box-shadow: 0 6px 16px rgba(228,81,83,0.35); }
    .raw-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; word-break: break-all; color: #64748b; margin: 16px 0; }
    .raw-link { color: #e45153; text-decoration: underline; }
    .callout { background: #fff1f2; border-left: 4px solid #e45153; border-radius: 4px; padding: 10px 14px; margin: 18px 0; font-size: 13px; color: #9f1239; }
    .footer { background: #f1f5f9; padding: 22px 24px; text-align: center; font-size: 12px; line-height: 1.6; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <div class="card">
            <div class="header">
              <div class="logo-badge">👛</div>
              <h1 class="brand-title">Pocketplan</h1>
              <p class="brand-tag">Smart Financial Planner & Tracker</p>
            </div>
            <div class="body">
              <h2 class="greeting">Halo, ${recipientName}! 👋</h2>
              <p style="margin:0 0 16px;">Terima kasih telah bergabung di <strong>Pocketplan</strong>. Untuk melindungi keamanan akun keuangan Anda dan mengaktifkan akses penuh dashboard web, mohon konfirmasi alamat email Anda.</p>
              <div class="cta-wrap">
                <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn">Verifikasi Email Saya</a>
              </div>
              <div class="callout">
                ⏱️ <strong>Batas Waktu:</strong> Tautan ini berlaku selama <strong>24 jam</strong>.
              </div>
              <p style="font-size:13px; margin:16px 0 6px; color:#64748b;">Jika tombol di atas tidak berfungsi, salin dan buka tautan berikut di browser Anda:</p>
              <div class="raw-box"><a href="${targetUrl}" class="raw-link" target="_blank" rel="noopener noreferrer">${targetUrl}</a></div>
            </div>
            <div class="footer">
              <div>© ${currentYear} <strong>Pocketplan</strong>. Hak cipta dilindungi.</div>
              <div style="margin-top:6px; color:#94a3b8;">Abaikan jika tidak merasa mendaftar atau meminta verifikasi akun Pocketplan.</div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const text = `Halo, ${recipientName}!

Terima kasih telah bergabung di Pocketplan.

Untuk mengamankan akun keuangan Anda dan mengaktifkan akses penuh ke aplikasi web Pocketplan, silakan klik tautan berikut untuk memverifikasi email Anda:

${targetUrl}

Tautan ini berlaku selama 24 jam.
Jika Anda tidak merasa mendaftar akun Pocketplan, silakan abaikan email ini.

© ${currentYear} Pocketplan. Hak cipta dilindungi.`;

  return { subject, html, text };
};
