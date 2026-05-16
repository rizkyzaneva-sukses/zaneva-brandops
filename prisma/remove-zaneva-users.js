/**
 * One-time cleanup script: hapus 5 user Zaneva yang sudah tidak aktif
 * Jalankan sekali di server: node prisma/remove-zaneva-users.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAILS_TO_REMOVE = [
  'marketplace.zaneva@zaneva.id', // Budi (Marketplace Zaneva)
  'rnd.zaneva@zaneva.id',         // Ayu (RnD Zaneva)
  'creative.zaneva@zaneva.id',    // Dian (Creative Zaneva)
  'bm.zaneva@zaneva.id',          // Sari (BM Zaneva)
  'pr.zaneva@zaneva.id',          // Rini (PR Zaneva)
];

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS_TO_REMOVE } },
    select: { id: true, email: true, full_name: true },
  });

  if (users.length === 0) {
    console.log('Tidak ada user yang ditemukan dengan email tersebut.');
    return;
  }

  console.log(`Ditemukan ${users.length} user:`);
  users.forEach(u => console.log(`  - ${u.full_name} (${u.email})`));

  const userIds = users.map(u => u.id);

  const standupCount = await prisma.standup.count({ where: { user_id: { in: userIds } } });
  const reportCount = await prisma.dailyReport.count({ where: { user_id: { in: userIds } } });

  console.log(`\nAkan dihapus:`);
  console.log(`  - ${standupCount} standup records`);
  console.log(`  - ${reportCount} daily report records`);
  console.log(`  - ${users.length} user accounts`);

  await prisma.standup.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.dailyReport.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log('\n✅ Selesai! Semua data berhasil dihapus.');
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
