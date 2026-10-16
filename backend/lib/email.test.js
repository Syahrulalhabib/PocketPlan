import assert from 'assert';
import { getEmailTemplate } from './emailTemplate.js';
import { sendVerificationMail } from './mailer.js';

console.log('Running Email Verification Template & Mailer tests...');

// 1. Template validation
const sampleUrl = 'https://pocketplan.my.id/verification?mode=verifyEmail&oobCode=test-code-123';
const template = getEmailTemplate({
  name: 'Syahrul Habib',
  verificationUrl: sampleUrl
});

assert.strictEqual(template.subject, 'Verifikasi Alamat Email Anda — Pocketplan', 'Subject must be clear and professional');
assert.ok(template.html.includes('#e45153'), 'Template must include brand color #e45153');
assert.ok(template.html.includes('Poppins'), 'Template must include Poppins typography');
assert.ok(template.html.includes('Pocketplan'), 'Template must include Pocketplan branding');
assert.ok(template.html.includes('Syahrul Habib'), 'Template must address recipient by name');
assert.ok(template.html.includes('Verifikasi Email Saya'), 'Template must include prominent CTA button');
assert.ok(template.html.includes(sampleUrl), 'Template must include raw fallback URL');
assert.ok(template.html.includes('Abaikan jika tidak merasa mendaftar'), 'Template footer must include ignore notice');
assert.ok(template.html.includes('Hak cipta dilindungi'), 'Template footer must include copyright notice');
assert.ok(template.text.includes(sampleUrl), 'Plain text version must include target URL');
assert.ok(template.text.includes('Syahrul Habib'), 'Plain text version must address user');

console.log('  ✔ Email template structure & brand assets verified');

// 2. Email recipient validation
assert.rejects(
  async () => {
    await sendVerificationMail({ to: 'invalid-email', name: 'Test', verificationUrl: sampleUrl });
  },
  /tidak valid/,
  'Mailer must reject invalid email address'
);

console.log('  ✔ Mailer input boundary validation passed');

console.log('All Email Verification tests passed! ✅');
