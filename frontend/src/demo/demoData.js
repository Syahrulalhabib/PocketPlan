// Demo data for Pocketplan offline demo mode

function getPastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export const demoUser = {
  id: 'demo-john',
  name: 'John Doe',
  email: 'john.doe@pocketplan.app',
  photoURL: undefined,
  isDemo: true
};

export const demoBaseBalance = 3500000;

export const demoGoals = [
  {
    id: 'g-demo-1',
    name: 'Motor Baru',
    type: 'Saving',
    amount: 7500000,
    target: 15000000,
    category: 'Transport',
    createdAt: getPastDate(45)
  },
  {
    id: 'g-demo-2',
    name: 'Liburan Bali',
    type: 'Saving',
    amount: 2100000,
    target: 6000000,
    category: 'Liburan',
    createdAt: getPastDate(30)
  },
  {
    id: 'g-demo-3',
    name: 'Laptop Kerja',
    type: 'Saving',
    amount: 8000000,
    target: 10000000,
    category: 'Elektronik',
    createdAt: getPastDate(60)
  }
];

export const demoTransactions = [
  { id: 't-demo-01', type: 'Income', category: 'Gaji', amount: 8500000, description: 'Gaji Bulanan Utama', date: getPastDate(25) },
  { id: 't-demo-02', type: 'Expense', category: 'Tagihan', amount: 420000, description: 'Listrik & Internet Rumah', date: getPastDate(24) },
  { id: 't-demo-03', type: 'Expense', category: 'Makanan', amount: 45000, description: 'Sarapan Nasi Uduk', date: getPastDate(22) },
  { id: 't-demo-04', type: 'Expense', category: 'Transport', amount: 150000, description: 'Bensin Motor Bulanan', date: getPastDate(21) },
  { id: 't-demo-05', type: 'Expense', category: 'Belanja', amount: 480000, description: 'Belanja Bulanan Supermarket', date: getPastDate(19) },
  { id: 't-demo-06', type: 'Expense', category: 'Makanan', amount: 65000, description: 'Makan Siang Geprek + Es Teh', date: getPastDate(18) },
  { id: 't-demo-07', type: 'Income', category: 'Bonus', amount: 1200000, description: 'Bonus Proyek Freelance', date: getPastDate(16) },
  { id: 't-demo-08', type: 'Expense', category: 'Hiburan', amount: 110000, description: 'Nonton Bioskop Weekend', date: getPastDate(15) },
  { id: 't-demo-09', type: 'Expense', category: 'Makanan', amount: 85000, description: 'Kopi Kenangan & Snack Sore', date: getPastDate(14) },
  { id: 't-demo-10', type: 'Expense', category: 'Transport', amount: 50000, description: 'Top Up E-Toll', date: getPastDate(12) },
  { id: 't-demo-11', type: 'Expense', category: 'Transport', amount: 650000, description: 'Service Berkala & Oli Motor', date: getPastDate(11) },
  { id: 't-demo-12', type: 'Expense', category: 'Makanan', amount: 55000, description: 'Makan Malam Sate Ayam', date: getPastDate(9) },
  { id: 't-demo-13', type: 'Expense', category: 'Belanja', amount: 125000, description: 'Perlengkapan Mandi & Cuci', date: getPastDate(8) },
  { id: 't-demo-14', type: 'Expense', category: 'Hiburan', amount: 180000, description: 'Langganan Streaming & Spotify', date: getPastDate(7) },
  { id: 't-demo-15', type: 'Expense', category: 'Makanan', amount: 40000, description: 'Makan Siang Warteg', date: getPastDate(5) },
  { id: 't-demo-16', type: 'Expense', category: 'Tagihan', amount: 150000, description: 'Paket Data & Pulsa', date: getPastDate(4) },
  { id: 't-demo-17', type: 'Expense', category: 'Makanan', amount: 75000, description: 'Pesan Antar Martabak', date: getPastDate(3) },
  { id: 't-demo-18', type: 'Expense', category: 'Belanja', amount: 95000, description: 'Beli Kaos Polos', date: getPastDate(2) },
  { id: 't-demo-19', type: 'Expense', category: 'Makanan', amount: 35000, description: 'Makan Siang Soto Ayam', date: getPastDate(1) },
  { id: 't-demo-20', type: 'Expense', category: 'Transport', amount: 25000, description: 'Parkir Harian', date: getPastDate(0) }
];
