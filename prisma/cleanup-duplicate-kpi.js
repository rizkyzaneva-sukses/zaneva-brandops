/**
 * Cleanup script: remove duplicate KpiItem records with the same name.
 * Keeps the canonical seed record (e.g. 'kpi-omzet-lainnya') and deletes
 * any UI-created duplicates (random UUID ids).
 *
 * Run: node prisma/cleanup-duplicate-kpi.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all active KpiItems grouped by name
  const allItems = await prisma.kpiItem.findMany({ where: { is_active: true }, orderBy: { created_at: 'asc' } });

  const byName = {};
  for (const item of allItems) {
    if (!byName[item.name]) byName[item.name] = [];
    byName[item.name].push(item);
  }

  for (const [name, items] of Object.entries(byName)) {
    if (items.length <= 1) continue;

    console.log(`\nDuplicate found: "${name}" (${items.length} records)`);

    // Prefer the record with the canonical seed id (no UUID pattern)
    const canonical = items.find(i => !i.id.includes('-') || i.id.startsWith('kpi-')) || items[0];
    const duplicates = items.filter(i => i.id !== canonical.id);

    console.log(`  Keeping: ${canonical.id}`);

    for (const dup of duplicates) {
      console.log(`  Deleting: ${dup.id}`);
      await prisma.kpiDailySnapshot.deleteMany({ where: { kpi_item_id: dup.id } });
      await prisma.kpiWeeklyTarget.deleteMany({ where: { kpi_item_id: dup.id } });
      await prisma.kpiBrandConfig.deleteMany({ where: { kpi_item_id: dup.id } });
      await prisma.kpiItem.update({ where: { id: dup.id }, data: { is_active: false } });
      console.log(`  ✅ Deleted brand configs, targets, snapshots for ${dup.id}`);
    }
  }

  console.log('\n✅ Cleanup selesai!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
