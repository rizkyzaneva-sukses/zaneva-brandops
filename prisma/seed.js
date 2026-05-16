const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database ZANEVA BrandOps...');

  // Create Brands
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { id: 'brand-zaneva' },
      update: {},
      create: { id: 'brand-zaneva', name: 'Zaneva', description: 'Muslim women activewear', status: 'active' },
    }),
    prisma.brand.upsert({
      where: { id: 'brand-besyari' },
      update: {},
      create: { id: 'brand-besyari', name: 'Be.Syari', description: 'Syari fashion line', status: 'active' },
    }),
    prisma.brand.upsert({
      where: { id: 'brand-oberbe' },
      update: {},
      create: { id: 'brand-oberbe', name: 'Oberbe', description: 'Premium line', status: 'active' },
    }),
    prisma.brand.upsert({
      where: { id: 'brand-msw' },
      update: {},
      create: { id: 'brand-msw', name: 'Muslimah Swimwear', description: 'Modest swimwear', status: 'active' },
    }),
  ]);

  console.log(`✅ ${brands.length} brands created`);

  // Create Users
  const hash = (p) => bcrypt.hashSync(p, 10);
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'owner@zaneva.id' },
      update: {},
      create: {
        id: 'user-owner',
        email: 'owner@zaneva.id',
        password: hash('owner123'),
        full_name: 'Rizky (Owner)',
        role: 'owner',
        brand_id: null,
        brand_name: null,
      },
    }),
    prisma.user.upsert({
      where: { email: 'bm.zaneva@zaneva.id' },
      update: {},
      create: {
        id: 'user-bm-zaneva',
        email: 'bm.zaneva@zaneva.id',
        password: hash('bm123'),
        full_name: 'Sari (BM Zaneva)',
        role: 'brand_manager',
        brand_id: 'brand-zaneva',
        brand_name: 'Zaneva',
      },
    }),
    prisma.user.upsert({
      where: { email: 'creative.zaneva@zaneva.id' },
      update: {},
      create: {
        id: 'user-creative-zaneva',
        email: 'creative.zaneva@zaneva.id',
        password: hash('creative123'),
        full_name: 'Dian (Creative Zaneva)',
        role: 'creative',
        brand_id: 'brand-zaneva',
        brand_name: 'Zaneva',
      },
    }),
    prisma.user.upsert({
      where: { email: 'pr.zaneva@zaneva.id' },
      update: {},
      create: {
        id: 'user-pr-zaneva',
        email: 'pr.zaneva@zaneva.id',
        password: hash('pr123'),
        full_name: 'Rini (PR Zaneva)',
        role: 'public_relation',
        brand_id: 'brand-zaneva',
        brand_name: 'Zaneva',
      },
    }),
    prisma.user.upsert({
      where: { email: 'marketplace.zaneva@zaneva.id' },
      update: {},
      create: {
        id: 'user-mp-zaneva',
        email: 'marketplace.zaneva@zaneva.id',
        password: hash('mp123'),
        full_name: 'Budi (Marketplace Zaneva)',
        role: 'admin_marketplace',
        brand_id: 'brand-zaneva',
        brand_name: 'Zaneva',
      },
    }),
    prisma.user.upsert({
      where: { email: 'rnd.zaneva@zaneva.id' },
      update: {},
      create: {
        id: 'user-rnd-zaneva',
        email: 'rnd.zaneva@zaneva.id',
        password: hash('rnd123'),
        full_name: 'Ayu (RnD Zaneva)',
        role: 'rnd',
        brand_id: 'brand-zaneva',
        brand_name: 'Zaneva',
      },
    }),
    prisma.user.upsert({
      where: { email: 'bm.besyari@zaneva.id' },
      update: {},
      create: {
        id: 'user-bm-besyari',
        email: 'bm.besyari@zaneva.id',
        password: hash('bm123'),
        full_name: 'Fitri (BM Be.Syari)',
        role: 'brand_manager',
        brand_id: 'brand-besyari',
        brand_name: 'Be.Syari',
      },
    }),
  ]);

  console.log(`✅ ${users.length} users created`);

  // Create KPI Items (Master)
  const kpiItems = await Promise.all([
    prisma.kpiItem.upsert({ where: { id: 'kpi-omzet-shopee' }, update: {}, create: { id: 'kpi-omzet-shopee', name: 'Omzet Shopee', category: 'auto_daily_log', auto_source_role: 'brand_manager', auto_source: 'omzet_shopee', auto_aggregation: 'sum', unit: 'currency', order_num: 1 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-omzet-tiktok' }, update: {}, create: { id: 'kpi-omzet-tiktok', name: 'Omzet TikTok', category: 'auto_daily_log', auto_source_role: 'brand_manager', auto_source: 'omzet_tiktok', auto_aggregation: 'sum', unit: 'currency', order_num: 2 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-omzet-lainnya' }, update: {}, create: { id: 'kpi-omzet-lainnya', name: 'Omzet Lainnya FIX', category: 'auto_daily_log', auto_source_role: 'brand_manager', auto_source: 'omzet_lainnya', auto_aggregation: 'sum', unit: 'currency', order_num: 3, description: 'KPI omzet lainnya yang diambil dari Daily Log sore.' } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-total-gmv' }, update: {}, create: { id: 'kpi-total-gmv', name: 'Total GMV', category: 'auto_sum', auto_aggregation: 'sum', unit: 'currency', order_num: 4, description: 'Omzet Shopee + TikTok + Omzet Lainnya FIX' } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-roas-iklan' }, update: {}, create: { id: 'kpi-roas-iklan', name: 'ROAS Iklan', category: 'auto_daily_log', auto_source_role: 'brand_manager', auto_source: 'roas_iklan', auto_aggregation: 'avg', unit: 'number', order_num: 5 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-total-order' }, update: {}, create: { id: 'kpi-total-order', name: 'Total Order', category: 'auto_daily_log', auto_source_role: 'admin_marketplace', auto_source: 'total_order', auto_aggregation: 'sum', unit: 'number', order_num: 6 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-roas-marketplace' }, update: {}, create: { id: 'kpi-roas-marketplace', name: 'ROAS Marketplace', category: 'auto_daily_log', auto_source_role: 'admin_marketplace', auto_source: 'roas_daily', auto_aggregation: 'avg', unit: 'number', order_num: 7 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-affiliator-aktif' }, update: {}, create: { id: 'kpi-affiliator-aktif', name: 'Affiliator Aktif', category: 'auto_daily_log', auto_source_role: 'public_relation', auto_source: 'affiliator_aktif_count', auto_aggregation: 'avg', unit: 'number', order_num: 8 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-affiliator-baru' }, update: {}, create: { id: 'kpi-affiliator-baru', name: 'Affiliator Baru', category: 'auto_daily_log', auto_source_role: 'public_relation', auto_source: 'affiliator_baru_count', auto_aggregation: 'sum', unit: 'number', order_num: 9 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-iklan-spend' }, update: {}, create: { id: 'kpi-iklan-spend', name: 'Iklan Spend', category: 'auto_daily_log', auto_source_role: 'admin_marketplace', auto_source: 'iklan_spend', auto_aggregation: 'sum', unit: 'currency', order_num: 10 } }),
    prisma.kpiItem.upsert({ where: { id: 'kpi-campaign-aktif' }, update: {}, create: { id: 'kpi-campaign-aktif', name: 'Campaign Aktif', category: 'auto_daily_log', auto_source_role: 'brand_manager', auto_source: 'campaign_aktif', auto_aggregation: 'avg', unit: 'number', order_num: 11 } }),
  ]);

  console.log(`✅ ${kpiItems.length} KPI items created`);

  // Create KPI Brand Configs for Zaneva
  const kpiIds = ['kpi-omzet-shopee', 'kpi-omzet-tiktok', 'kpi-omzet-lainnya', 'kpi-total-gmv', 'kpi-roas-iklan', 'kpi-total-order', 'kpi-roas-marketplace', 'kpi-affiliator-aktif', 'kpi-affiliator-baru', 'kpi-iklan-spend', 'kpi-campaign-aktif'];
  const kpiNames = { 'kpi-omzet-shopee': 'Omzet Shopee', 'kpi-omzet-tiktok': 'Omzet TikTok', 'kpi-omzet-lainnya': 'Omzet Lainnya FIX', 'kpi-total-gmv': 'Total GMV', 'kpi-roas-iklan': 'ROAS Iklan', 'kpi-total-order': 'Total Order', 'kpi-roas-marketplace': 'ROAS Marketplace', 'kpi-affiliator-aktif': 'Affiliator Aktif', 'kpi-affiliator-baru': 'Affiliator Baru', 'kpi-iklan-spend': 'Iklan Spend', 'kpi-campaign-aktif': 'Campaign Aktif' };

  for (const kpiId of kpiIds) {
    for (const brand of [{ id: 'brand-zaneva', name: 'Zaneva' }, { id: 'brand-besyari', name: 'Be.Syari' }]) {
      await prisma.kpiBrandConfig.upsert({
        where: { brand_id_kpi_item_id: { brand_id: brand.id, kpi_item_id: kpiId } },
        update: {},
        create: { brand_id: brand.id, brand_name: brand.name, kpi_item_id: kpiId, kpi_name: kpiNames[kpiId], is_enabled: true },
      });
    }
  }

  console.log('✅ KPI brand configs created');

  // Create weekly targets for current week
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekNum = getISOWeek(monday);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const weekLabel = `W${weekNum} - ${monthNames[monday.getMonth()]} ${monday.getFullYear()}`;

  const targets = [
    { kpi_item_id: 'kpi-omzet-shopee', kpi_name: 'Omzet Shopee', target_value: 25000000 },
    { kpi_item_id: 'kpi-omzet-tiktok', kpi_name: 'Omzet TikTok', target_value: 15000000 },
    { kpi_item_id: 'kpi-omzet-lainnya', kpi_name: 'Omzet Lainnya FIX', target_value: 10000000 },
    { kpi_item_id: 'kpi-total-gmv', kpi_name: 'Total GMV', target_value: 50000000 },
    { kpi_item_id: 'kpi-roas-iklan', kpi_name: 'ROAS Iklan', target_value: 3.5 },
    { kpi_item_id: 'kpi-total-order', kpi_name: 'Total Order', target_value: 500 },
    { kpi_item_id: 'kpi-affiliator-aktif', kpi_name: 'Affiliator Aktif', target_value: 50 },
    { kpi_item_id: 'kpi-affiliator-baru', kpi_name: 'Affiliator Baru', target_value: 10 },
    { kpi_item_id: 'kpi-iklan-spend', kpi_name: 'Iklan Spend', target_value: 5000000 },
    { kpi_item_id: 'kpi-campaign-aktif', kpi_name: 'Campaign Aktif', target_value: 5 },
  ];

  for (const t of targets) {
    await prisma.kpiWeeklyTarget.upsert({
      where: { brand_id_week_label_kpi_item_id: { brand_id: 'brand-zaneva', week_label: weekLabel, kpi_item_id: t.kpi_item_id } },
      update: {},
      create: { brand_id: 'brand-zaneva', brand_name: 'Zaneva', week_label: weekLabel, week_start_date: monday, week_end_date: sunday, ...t },
    });
  }

  console.log('✅ Weekly targets created for', weekLabel);
  console.log('\n✨ Seed selesai!');
  console.log('\n📋 Demo accounts:');
  console.log('  owner@zaneva.id         / owner123      (Owner)');
  console.log('  bm.zaneva@zaneva.id     / bm123         (Brand Manager - Zaneva)');
  console.log('  creative.zaneva@zaneva.id / creative123 (Creative - Zaneva)');
  console.log('  pr.zaneva@zaneva.id     / pr123         (PR - Zaneva)');
  console.log('  marketplace.zaneva@zaneva.id / mp123   (Marketplace - Zaneva)');
  console.log('  rnd.zaneva@zaneva.id    / rnd123        (RnD - Zaneva)');
  console.log('  bm.besyari@zaneva.id    / bm123         (Brand Manager - Be.Syari)');
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
