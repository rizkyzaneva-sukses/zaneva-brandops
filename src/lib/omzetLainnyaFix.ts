import { prisma } from '@/lib/prisma';

export const OMZET_LAINNYA_FIX_ID = 'kpi-omzet-lainnya';
export const OMZET_LAINNYA_FIX_NAME = 'Omzet Lainnya FIX';
export const OMZET_LAINNYA_FIX_SOURCE = 'omzet_lainnya';
const OMZET_LAINNYA_ORDER = 3;
const ZANEVA_BRAND_ID = 'brand-zaneva';

function isOmzetLainnyaVariant(value: string | null | undefined) {
  if (!value) return false;
  return /^omzet lainnya(?:\s*(?:fix|\d+))?$/i.test(value.trim());
}

function isCanonicalShape(item: {
  id: string;
  name: string;
  category: string;
  auto_source_role: string | null;
  auto_source: string | null;
  auto_aggregation: string;
  unit: string;
  is_active: boolean;
}) {
  return (
    item.id === OMZET_LAINNYA_FIX_ID &&
    item.name === OMZET_LAINNYA_FIX_NAME &&
    item.category === 'auto_daily_log' &&
    item.auto_source_role === 'brand_manager' &&
    item.auto_source === OMZET_LAINNYA_FIX_SOURCE &&
    item.auto_aggregation === 'sum' &&
    item.unit === 'currency' &&
    item.is_active
  );
}

export function isOmzetLainnyaFixName(name: string) {
  return isOmzetLainnyaVariant(name);
}

export async function ensureOmzetLainnyaFix() {
  const matched = await prisma.kpiItem.findMany({
    where: {
      OR: [
        { id: OMZET_LAINNYA_FIX_ID },
        { auto_source: OMZET_LAINNYA_FIX_SOURCE },
        { name: { startsWith: 'Omzet Lainnya', mode: 'insensitive' } },
      ],
    },
    orderBy: [{ created_at: 'asc' }],
  });

  const canonical = matched.find((item) => item.id === OMZET_LAINNYA_FIX_ID) || null;
  const duplicateIds = matched
    .filter((item) => item.id !== OMZET_LAINNYA_FIX_ID && (isOmzetLainnyaVariant(item.name) || item.auto_source === OMZET_LAINNYA_FIX_SOURCE))
    .map((item) => item.id);

  const zanevaConfig = canonical
    ? await prisma.kpiBrandConfig.findUnique({
      where: {
        brand_id_kpi_item_id: {
          brand_id: ZANEVA_BRAND_ID,
          kpi_item_id: OMZET_LAINNYA_FIX_ID,
        },
      },
    })
    : null;

  if (canonical && duplicateIds.length === 0 && isCanonicalShape(canonical) && zanevaConfig?.is_enabled && zanevaConfig.kpi_name === OMZET_LAINNYA_FIX_NAME) {
    return canonical;
  }

  return prisma.$transaction(async (tx) => {
    const items = await tx.kpiItem.findMany({
      where: {
        OR: [
          { id: OMZET_LAINNYA_FIX_ID },
          { auto_source: OMZET_LAINNYA_FIX_SOURCE },
          { name: { startsWith: 'Omzet Lainnya', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ created_at: 'asc' }],
    });

    const sourceIds = Array.from(
      new Set(
        items
          .filter((item) => isOmzetLainnyaVariant(item.name) || item.auto_source === OMZET_LAINNYA_FIX_SOURCE || item.id === OMZET_LAINNYA_FIX_ID)
          .map((item) => item.id)
      )
    );

    const canonicalItem = await tx.kpiItem.upsert({
      where: { id: OMZET_LAINNYA_FIX_ID },
      update: {
        name: OMZET_LAINNYA_FIX_NAME,
        category: 'auto_daily_log',
        auto_source_role: 'brand_manager',
        auto_source: OMZET_LAINNYA_FIX_SOURCE,
        auto_aggregation: 'sum',
        unit: 'currency',
        order_num: OMZET_LAINNYA_ORDER,
        is_active: true,
        higher_is_better: true,
        description: 'KPI omzet lainnya yang diambil dari Daily Log sore.',
      },
      create: {
        id: OMZET_LAINNYA_FIX_ID,
        name: OMZET_LAINNYA_FIX_NAME,
        category: 'auto_daily_log',
        auto_source_role: 'brand_manager',
        auto_source: OMZET_LAINNYA_FIX_SOURCE,
        auto_aggregation: 'sum',
        unit: 'currency',
        order_num: OMZET_LAINNYA_ORDER,
        is_active: true,
        higher_is_better: true,
        description: 'KPI omzet lainnya yang diambil dari Daily Log sore.',
      },
    });

    const relevantIds = Array.from(new Set([...sourceIds, OMZET_LAINNYA_FIX_ID]));
    const duplicateSourceIds = relevantIds.filter((id) => id !== OMZET_LAINNYA_FIX_ID);

    const configs = await tx.kpiBrandConfig.findMany({
      where: { kpi_item_id: { in: relevantIds } },
      orderBy: [{ updated_at: 'desc' }],
    });

    const configsByBrand = new Map<string, typeof configs>();
    for (const config of configs) {
      const group = configsByBrand.get(config.brand_id) || [];
      group.push(config);
      configsByBrand.set(config.brand_id, group);
    }

    for (const [brandId, group] of configsByBrand.entries()) {
      const latest = group[0];
      await tx.kpiBrandConfig.upsert({
        where: {
          brand_id_kpi_item_id: {
            brand_id: brandId,
            kpi_item_id: OMZET_LAINNYA_FIX_ID,
          },
        },
        update: {
          brand_name: latest.brand_name,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          is_enabled: group.some((item) => item.is_enabled),
        },
        create: {
          brand_id: brandId,
          brand_name: latest.brand_name,
          kpi_item_id: OMZET_LAINNYA_FIX_ID,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          is_enabled: group.some((item) => item.is_enabled),
        },
      });
    }

    const zanevaBrand = await tx.brand.findUnique({ where: { id: ZANEVA_BRAND_ID } });
    if (zanevaBrand) {
      await tx.kpiBrandConfig.upsert({
        where: {
          brand_id_kpi_item_id: {
            brand_id: zanevaBrand.id,
            kpi_item_id: OMZET_LAINNYA_FIX_ID,
          },
        },
        update: {
          brand_name: zanevaBrand.name,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          is_enabled: true,
        },
        create: {
          brand_id: zanevaBrand.id,
          brand_name: zanevaBrand.name,
          kpi_item_id: OMZET_LAINNYA_FIX_ID,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          is_enabled: true,
        },
      });
    }

    const targets = await tx.kpiWeeklyTarget.findMany({
      where: { kpi_item_id: { in: relevantIds } },
      orderBy: [{ updated_at: 'desc' }],
    });

    const targetsByWeek = new Map<string, typeof targets>();
    for (const target of targets) {
      const key = `${target.brand_id}::${target.week_label}`;
      const group = targetsByWeek.get(key) || [];
      group.push(target);
      targetsByWeek.set(key, group);
    }

    for (const group of targetsByWeek.values()) {
      const latest = group[0];
      await tx.kpiWeeklyTarget.upsert({
        where: {
          brand_id_week_label_kpi_item_id: {
            brand_id: latest.brand_id,
            week_label: latest.week_label,
            kpi_item_id: OMZET_LAINNYA_FIX_ID,
          },
        },
        update: {
          brand_name: latest.brand_name,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          week_start_date: latest.week_start_date,
          week_end_date: latest.week_end_date,
          target_value: latest.target_value,
        },
        create: {
          brand_id: latest.brand_id,
          brand_name: latest.brand_name,
          kpi_item_id: OMZET_LAINNYA_FIX_ID,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          week_label: latest.week_label,
          week_start_date: latest.week_start_date,
          week_end_date: latest.week_end_date,
          target_value: latest.target_value,
        },
      });
    }

    const snapshots = await tx.kpiDailySnapshot.findMany({
      where: { kpi_item_id: { in: relevantIds } },
      orderBy: [{ updated_at: 'desc' }],
    });

    const snapshotsByDay = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots) {
      const key = `${snapshot.brand_id}::${snapshot.week_label}::${snapshot.snapshot_date.toISOString()}`;
      const group = snapshotsByDay.get(key) || [];
      group.push(snapshot);
      snapshotsByDay.set(key, group);
    }

    for (const group of snapshotsByDay.values()) {
      const latest = group[0];
      await tx.kpiDailySnapshot.upsert({
        where: {
          brand_id_snapshot_date_kpi_item_id: {
            brand_id: latest.brand_id,
            snapshot_date: latest.snapshot_date,
            kpi_item_id: OMZET_LAINNYA_FIX_ID,
          },
        },
        update: {
          week_label: latest.week_label,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          daily_value: latest.daily_value,
          cumulative_value: latest.cumulative_value,
          target_value: latest.target_value,
          pct_of_target: latest.pct_of_target,
        },
        create: {
          brand_id: latest.brand_id,
          snapshot_date: latest.snapshot_date,
          week_label: latest.week_label,
          kpi_item_id: OMZET_LAINNYA_FIX_ID,
          kpi_name: OMZET_LAINNYA_FIX_NAME,
          daily_value: latest.daily_value,
          cumulative_value: latest.cumulative_value,
          target_value: latest.target_value,
          pct_of_target: latest.pct_of_target,
        },
      });
    }

    await tx.kpiBrandConfig.updateMany({
      where: { kpi_item_id: OMZET_LAINNYA_FIX_ID },
      data: { kpi_name: OMZET_LAINNYA_FIX_NAME },
    });

    await tx.kpiWeeklyTarget.updateMany({
      where: { kpi_item_id: OMZET_LAINNYA_FIX_ID },
      data: { kpi_name: OMZET_LAINNYA_FIX_NAME },
    });

    await tx.kpiDailySnapshot.updateMany({
      where: { kpi_item_id: OMZET_LAINNYA_FIX_ID },
      data: { kpi_name: OMZET_LAINNYA_FIX_NAME },
    });

    if (duplicateSourceIds.length > 0) {
      await tx.kpiBrandConfig.deleteMany({ where: { kpi_item_id: { in: duplicateSourceIds } } });
      await tx.kpiWeeklyTarget.deleteMany({ where: { kpi_item_id: { in: duplicateSourceIds } } });
      await tx.kpiDailySnapshot.deleteMany({ where: { kpi_item_id: { in: duplicateSourceIds } } });
      await tx.kpiItem.updateMany({
        where: { id: { in: duplicateSourceIds } },
        data: { is_active: false },
      });
    }

    return canonicalItem;
  });
}
