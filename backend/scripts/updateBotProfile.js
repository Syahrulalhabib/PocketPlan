import fetch from 'node-fetch'; // or global fetch in Node 18+

const token = process.env.TELEGRAM_BOT_TOKEN || '8857383541:AAGc_EpP0l1AvtlzXWLmXmsM9r9BTWvLpj4';

async function updateBot() {
  console.log('Updating bot profile...');

  // 1. Set Bot Name
  const nameRes = await (await fetch(`https://api.telegram.org/bot${token}/setMyName`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'PocketPlan | Pocky 🪙' })
  })).json();
  console.log('setName:', nameRes);

  // 2. Set Short Description (Bio in user profile, max 120 chars)
  const shortDesc = 'Hai! Aku Pocky 🪙 asisten keuangan PocketPlan. Kirim foto struk belanja untuk scan AI atau catat uangmu di sini!';
  const shortRes = await (await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ short_description: shortDesc })
  })).json();
  console.log('setShortDesc:', shortRes);

  // 3. Set Description (Shown when opening bot before pressing Start, max 512 chars)
  const desc = [
    'Halo! Aku Pocky 🪙, asisten keuangan pribadi pintarmu dari PocketPlan!',
    '',
    'Fitur pintar Pocky:',
    '🧾 Scan Struk AI: Kirim foto struk belanja, Pocky baca & catat otomatis!',
    '💸 Catat Kilat: Ketik langsung "kopi 25k" atau "/masuk gaji 2jt"',
    '🎯 Target Impian: Bikin celengan & pantau impianmu',
    '📊 Cek Keuangan: Pantau saldo & riwayat kapan saja',
    '🌐 Sinkron Website: Terhubung langsung ke web PocketPlan',
    '',
    'Tekan START di bawah untuk mulai kelola keuanganmu bareng Pocky! ✨'
  ].join('\n');

  const descRes = await (await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: desc })
  })).json();
  console.log('setDesc:', descRes);

  // 4. Set Bot Menu Commands
  const commands = [
    { command: 'start', description: 'Mulai & sapa Pocky 🪙' },
    { command: 'catat', description: 'Catat pengeluaran baru 💸' },
    { command: 'masuk', description: 'Catat pemasukan uang 💰' },
    { command: 'saldo', description: 'Cek total saldo dompet 📊' },
    { command: 'riwayat', description: '5 transaksi terakhir 📜' },
    { command: 'goals', description: 'Cek target & progres celengan 🎯' },
    { command: 'koreksi', description: 'Koreksi nominal struk/catatan ✏️' },
    { command: 'batal', description: 'Batalkan transaksi terakhir 🗑️' },
    { command: 'help', description: 'Panduan lengkap Pocky 📖' },
    { command: 'web', description: 'Dapatkan kode login website 🔗' }
  ];
  const cmdRes = await (await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands })
  })).json();
  console.log('setCommands:', cmdRes);

  // Verify
  const updatedDesc = await (await fetch(`https://api.telegram.org/bot${token}/getMyDescription`)).json();
  const updatedShortDesc = await (await fetch(`https://api.telegram.org/bot${token}/getMyShortDescription`)).json();
  console.log('Current Description:', updatedDesc);
  console.log('Current Short Description:', updatedShortDesc);
}

updateBot().catch(console.error);
