const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const VALID_ROLES = new Set([
  'owner',
  'admin',
  'brand_manager',
  'creative',
  'public_relation',
  'admin_marketplace',
  'rnd',
]);

const VALID_BRAND_STATUS = new Set(['active', 'inactive']);
const VALID_STANDUP_STATUS = new Set(['draft', 'submitted']);
const VALID_REPORT_STATUS = new Set(['draft', 'submitted', 'reviewed']);
const VALID_REPORT_CATEGORY = new Set(['creative', 'public_relation', 'marketplace', 'rnd', 'general']);
const VALID_KPI_CATEGORY = new Set(['manual', 'auto_daily_log', 'auto_sum']);
const VALID_KPI_UNIT = new Set(['currency', 'number', 'percent']);
const VALID_KPI_AGGREGATION = new Set(['sum', 'avg', 'count']);
const VALID_KPI_PLATFORM = new Set(['shopee', 'tiktok']);
const DEFAULT_PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD || 'zaneva123';
const IMPORT_IMPORTED_USERS_ACTIVE = process.env.IMPORT_IMPORTED_USERS_ACTIVE === 'true';

const BRAND_ALIASES = {
  ZANEVA: { preferredId: 'brand-zaneva', preferredName: 'Zaneva' },
  "BESYARI": { preferredId: 'brand-besyari', preferredName: 'Be.Syari' },
  OBERBE: { preferredId: 'brand-oberbe', preferredName: 'Oberbe' },
  MUSWIM: { preferredId: 'brand-msw', preferredName: 'Muslimah Swimwear' },
  ELYASR: { preferredId: 'brand-elyasr', preferredName: 'ELYASR' },
};

const KPI_OVERRIDES = {
  'Omzet Shopee': { id: 'kpi-omzet-shopee', name: 'Omzet Shopee', auto_source_role: 'brand_manager', auto_source: 'omzet_shopee', auto_aggregation: 'sum', unit: 'currency', order_num: 1, platform: 'shopee' },
  'Omzet TikTok Shop': { id: 'kpi-omzet-tiktok', name: 'Omzet TikTok', auto_source_role: 'brand_manager', auto_source: 'omzet_tiktok', auto_aggregation: 'sum', unit: 'currency', order_num: 2, platform: 'tiktok' },
  'Omzet MP Lain': { id: 'kpi-omzet-lainnya', name: 'Omzet Lainnya', auto_source_role: 'brand_manager', auto_source: 'omzet_lainnya', auto_aggregation: 'sum', unit: 'currency', order_num: 3 },
  'Total GMV': { id: 'kpi-total-gmv', name: 'Total GMV', auto_source_role: null, auto_source: null, auto_aggregation: 'sum', unit: 'currency', category: 'auto_sum', order_num: 4 },
  'Spending Iklan': { id: 'kpi-iklan-spend', name: 'Iklan Spend', auto_source_role: 'owner', auto_source: 'iklan_spend', auto_aggregation: 'sum', unit: 'currency', order_num: 5 },
  'ROAS Iklan': { id: 'kpi-roas-iklan', name: 'ROAS Iklan', auto_source_role: 'owner', auto_source: 'roas_iklan', auto_aggregation: 'avg', unit: 'number', order_num: 6 },
  'Affiliator Aktif Posting': { id: 'kpi-affiliator-aktif', name: 'Affiliator Aktif', auto_source_role: 'public_relation', auto_source: 'affiliator_aktif_count', auto_aggregation: 'avg', unit: 'number', order_num: 7 },
  'Affiliator Baru Direkrut': { id: 'kpi-affiliator-baru', name: 'Affiliator Baru', auto_source_role: 'public_relation', auto_source: 'affiliator_baru_count', auto_aggregation: 'sum', unit: 'number', order_num: 8 },
  'Follow-up dilakukan': { id: 'kpi-followup-dilakukan', name: 'Follow-up Dilakukan', auto_source_role: 'public_relation', auto_source: 'followup_count', auto_aggregation: 'sum', unit: 'number', order_num: 9 },
  'Total Order Masuk': { id: 'kpi-total-order', name: 'Total Order', auto_source_role: 'admin_marketplace', auto_source: 'total_order', auto_aggregation: 'sum', unit: 'number', order_num: 10 },
  'Rating Toko Rata-rata': { id: 'kpi-rating-toko', name: 'Rating Toko Rata-rata', auto_source_role: 'admin_marketplace', auto_source: 'rating_toko', auto_aggregation: 'avg', unit: 'percent', order_num: 11 },
  'Upload Shopee Video': { id: 'kpi-upload-shopee-video', name: 'Upload Shopee Video', auto_source_role: 'admin_marketplace', auto_source: 'upload_shopee_video', auto_aggregation: 'sum', unit: 'number', order_num: 12, platform: 'shopee' },
  'Upload Tiktok Video': { id: 'kpi-upload-tiktok-video', name: 'Upload Tiktok Video', auto_source_role: 'admin_marketplace', auto_source: 'upload_tiktok_video', auto_aggregation: 'sum', unit: 'number', order_num: 13, platform: 'tiktok' },
  'Campaign Aktif': { id: 'kpi-campaign-aktif', name: 'Campaign Aktif', auto_source_role: 'admin_marketplace', auto_source: 'campaign_aktif', auto_aggregation: 'sum', unit: 'number', order_num: 14 },
  'Konten Publish': { id: 'kpi-konten-publish', name: 'Konten Publish', auto_source_role: 'creative', auto_source: 'konten_publish', auto_aggregation: 'sum', unit: 'number', order_num: 15 },
  'Editing Feeds': { id: 'kpi-editing-feeds', name: 'Editing Feeds', auto_source_role: 'creative', auto_source: 'editing_feeds', auto_aggregation: 'sum', unit: 'number', order_num: 16 },
  'Editing Video Asli': { id: 'kpi-editing-video-asli', name: 'Editing Video Asli', auto_source_role: 'creative', auto_source: 'editing_video_asli', auto_aggregation: 'sum', unit: 'number', order_num: 17 },
  'Editing Video AI': { id: 'kpi-editing-video-ai', name: 'Editing Video AI', auto_source_role: 'creative', auto_source: 'editing_video_ai', auto_aggregation: 'sum', unit: 'number', order_num: 18 },
};

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeRole(role) {
  const value = String(role || '').trim();
  return VALID_ROLES.has(value) ? value : null;
}

function normalizeStatus(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function normalizePlatform(platform) {
  const value = String(platform || '').trim().toLowerCase();
  return VALID_KPI_PLATFORM.has(value) ? value : null;
}

function parseDateOnly(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return new Date(`${raw}T00:00:00`);
}

function getTimestamp(value, fallback = 0) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function pickPreferredRole(roles) {
  const priority = {
    owner: 7,
    admin: 6,
    brand_manager: 5,
    admin_marketplace: 4,
    public_relation: 3,
    creative: 2,
    rnd: 1,
  };

  return roles
    .filter(Boolean)
    .sort((a, b) => (priority[b] || 0) - (priority[a] || 0))[0] || 'creative';
}

function getBrandAlias(name) {
  const token = normalizeToken(name);
  return BRAND_ALIASES[token] || {
    preferredId: `brand-${slugify(name) || 'unknown'}`,
    preferredName: String(name || '').trim() || 'Unknown',
  };
}

function buildImportedKpis(sourceItems) {
  const imported = [];
  const legacyIdToNewId = new Map();
  const legacyAnswerKeyToDailyLogKey = new Map();
  const seen = new Set();

  for (const item of sourceItems || []) {
    const override = KPI_OVERRIDES[item.name] || {};
    const id = override.id || `kpi-${slugify(item.name)}`;
    if (seen.has(id)) {
      legacyIdToNewId.set(item.id, id);
      if (item.auto_source && override.auto_source) {
        legacyAnswerKeyToDailyLogKey.set(item.auto_source, override.auto_source);
      }
      continue;
    }

    const importedItem = {
      id,
      name: override.name || item.name,
      category: VALID_KPI_CATEGORY.has(override.category || item.category) ? (override.category || item.category) : 'manual',
      auto_source_role: normalizeRole(override.auto_source_role ?? item.auto_source_role) || null,
      auto_source: override.auto_source || item.auto_source || null,
      auto_aggregation: VALID_KPI_AGGREGATION.has(override.auto_aggregation || item.auto_aggregation) ? (override.auto_aggregation || item.auto_aggregation) : 'sum',
      unit: VALID_KPI_UNIT.has(override.unit || item.unit) ? (override.unit || item.unit) : 'number',
      platform: normalizePlatform(override.platform ?? item.platform),
      order_num: Number.isFinite(override.order_num) ? override.order_num : Number(item.order_num || 0),
      is_active: item.is_active !== false,
      description: item.description || null,
      legacy_id: item.id,
      legacy_auto_source: item.auto_source || null,
    };

    imported.push(importedItem);
    seen.add(id);
    legacyIdToNewId.set(item.id, id);
    if (item.auto_source && importedItem.auto_source && /^q_/i.test(item.auto_source)) {
      legacyAnswerKeyToDailyLogKey.set(item.auto_source, importedItem.auto_source);
    }
  }

  return { imported, legacyIdToNewId, legacyAnswerKeyToDailyLogKey };
}

function enrichDailyLog(row, legacyAnswerKeyToDailyLogKey) {
  const dailyLog = { ...(row.daily_log || {}) };
  const answers = row.answers || {};

  for (const [legacyKey, normalizedKey] of legacyAnswerKeyToDailyLogKey.entries()) {
    if (dailyLog[normalizedKey] == null && answers[legacyKey] != null && String(answers[legacyKey]).trim() !== '') {
      dailyLog[normalizedKey] = answers[legacyKey];
    }
  }

  return dailyLog;
}

async function main() {
  const exportPath = process.argv[2];
  if (!exportPath) {
    throw new Error('Usage: node prisma/import-export.js <path-to-export.json>');
  }

  const resolvedPath = path.resolve(exportPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Export file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const data = JSON.parse(raw);
  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  const skipped = [];

  const existingBrands = await prisma.brand.findMany();
  const brandsById = new Map(existingBrands.map((brand) => [brand.id, brand]));
  const brandsByToken = new Map(existingBrands.map((brand) => [normalizeToken(brand.name), brand]));
  const sourceBrandIds = new Set((data.Brand || []).map((brand) => brand.id));

  const brandMappings = new Map();
  const allSourceBrands = new Map();

  for (const brand of data.Brand || []) {
    allSourceBrands.set(brand.id, brand);
  }

  for (const record of [...(data.Standup || []), ...(data.DailyReport || []), ...(data.KpiWeeklyTarget || []), ...(data.KpiBrandConfig || [])]) {
    const token = normalizeToken(record.brand_name);
    const alias = record.brand_name ? getBrandAlias(record.brand_name) : null;
    const isRecognizedBrand =
      (record.brand_id && sourceBrandIds.has(record.brand_id)) ||
      Boolean(token && (BRAND_ALIASES[token] || brandsByToken.has(token) || (alias && brandsByToken.has(normalizeToken(alias.preferredName)))));

    if (!isRecognizedBrand) continue;

    const id = record.brand_id || `name:${record.brand_name}`;
    if (!allSourceBrands.has(id)) {
      allSourceBrands.set(id, {
        id: record.brand_id || null,
        name: record.brand_name || null,
        status: 'active',
        description: '',
        logo_url: null,
      });
    }
  }

  for (const sourceBrand of allSourceBrands.values()) {
    if (!sourceBrand.name) continue;

    const alias = getBrandAlias(sourceBrand.name);
    const token = normalizeToken(sourceBrand.name);
    let targetBrand =
      (alias.preferredId && brandsById.get(alias.preferredId)) ||
      brandsByToken.get(token) ||
      brandsByToken.get(normalizeToken(alias.preferredName)) ||
      null;

    if (!targetBrand) {
      targetBrand = await prisma.brand.upsert({
        where: { id: alias.preferredId },
        update: {
          name: alias.preferredName,
          description: sourceBrand.description || null,
          logo_url: sourceBrand.logo_url || null,
          status: VALID_BRAND_STATUS.has(sourceBrand.status) ? sourceBrand.status : 'active',
        },
        create: {
          id: alias.preferredId,
          name: alias.preferredName,
          description: sourceBrand.description || null,
          logo_url: sourceBrand.logo_url || null,
          status: VALID_BRAND_STATUS.has(sourceBrand.status) ? sourceBrand.status : 'active',
        },
      });

      brandsById.set(targetBrand.id, targetBrand);
      brandsByToken.set(normalizeToken(targetBrand.name), targetBrand);
    }

    if (sourceBrand.id) {
      brandMappings.set(sourceBrand.id, targetBrand);
    }
    brandMappings.set(`name:${sourceBrand.name}`, targetBrand);
  }

  const validBrandIdsWithActivity = new Set();
  for (const row of data.Standup || []) {
    const targetBrand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
    if (targetBrand) validBrandIdsWithActivity.add(targetBrand.id);
  }
  for (const row of data.KpiWeeklyTarget || []) {
    const targetBrand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
    if (targetBrand) validBrandIdsWithActivity.add(targetBrand.id);
  }

  const userDrafts = new Map();
  const collectUser = (email, name, role, sourceBrandId, sourceBrandName) => {
    const normalizedRole = normalizeRole(role);
    if (!email || !normalizedRole) return;

    const key = String(email).trim().toLowerCase();
    if (!key) return;

    const draft = userDrafts.get(key) || { email: key, names: [], roles: [], brandIds: [], brandNames: [] };
    if (name) draft.names.push(String(name).trim());
    draft.roles.push(normalizedRole);

    const mappedBrand = brandMappings.get(sourceBrandId) || brandMappings.get(`name:${sourceBrandName}`);
    if (mappedBrand) {
      draft.brandIds.push(mappedBrand.id);
      draft.brandNames.push(mappedBrand.name);
    }

    userDrafts.set(key, draft);
  };

  for (const row of data.Standup || []) {
    collectUser(row.created_by, row.user_name, row.user_role, row.brand_id, row.brand_name);
  }
  for (const row of data.DailyReport || []) {
    collectUser(row.created_by, row.submitted_by_name, row.submitted_by_role, row.brand_id, row.brand_name);
  }

  const existingUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const usersByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
  const importedUsers = new Map();

  for (const draft of userDrafts.values()) {
    const role = pickPreferredRole(draft.roles);
    const fullName = draft.names.find(Boolean) || draft.email.split('@')[0];
    const brandId = ['owner', 'admin'].includes(role) ? null : draft.brandIds[0] || null;
    const brandName = ['owner', 'admin'].includes(role) ? null : draft.brandNames[0] || null;

    const user = await prisma.user.upsert({
      where: { email: draft.email },
      update: {
        full_name: fullName,
        role,
        brand_id: brandId,
        brand_name: brandName,
        is_active: IMPORT_IMPORTED_USERS_ACTIVE,
      },
      create: {
        email: draft.email,
        password: passwordHash,
        full_name: fullName,
        role,
        brand_id: brandId,
        brand_name: brandName,
        is_active: IMPORT_IMPORTED_USERS_ACTIVE,
      },
      select: { id: true, email: true, full_name: true, role: true, brand_id: true, brand_name: true },
    });

    usersByEmail.set(user.email.toLowerCase(), user);
    importedUsers.set(user.email.toLowerCase(), user);
  }

  const { imported: importedKpis, legacyIdToNewId, legacyAnswerKeyToDailyLogKey } = buildImportedKpis(data.KpiItem || []);

  const standupConfigs = (data.StandupConfig || [])
    .filter((row) => normalizeRole(row.role) && ['pagi', 'sore'].includes(row.session))
    .map((row) => ({
      id: row.id,
      role: row.role,
      session: row.session,
      sections: row.sections || [],
      brand_id: null,
    }));

  const brandConfigRows = [];
  const brandConfigKeys = new Set();
  const addBrandConfig = (brand, kpiId) => {
    if (!brand || !kpiId) return;
    const key = `${brand.id}:${kpiId}`;
    if (brandConfigKeys.has(key)) return;
    const kpi = importedKpis.find((item) => item.id === kpiId);
    if (!kpi) return;
    brandConfigKeys.add(key);
    brandConfigRows.push({
      brand_id: brand.id,
      brand_name: brand.name,
      kpi_item_id: kpi.id,
      kpi_name: kpi.name,
      is_enabled: true,
    });
  };

  for (const row of data.KpiBrandConfig || []) {
    const brand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
    addBrandConfig(brand, legacyIdToNewId.get(row.kpi_item_id));
  }

  for (const brandId of validBrandIdsWithActivity) {
    const brand = brandsById.get(brandId);
    if (!brand) continue;
    for (const kpi of importedKpis) addBrandConfig(brand, kpi.id);
  }

  const weeklyTargets = [];
  const weeklyTargetKeys = new Set();
  for (const row of data.KpiWeeklyTarget || []) {
    const brand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
    const kpiItemId = legacyIdToNewId.get(row.kpi_item_id);
    const weekStart = parseDateOnly(row.week_start_date);
    const weekEnd = parseDateOnly(row.week_end_date);
    if (!brand || !kpiItemId || !row.week_label || !weekStart || !weekEnd) {
      skipped.push({ type: 'kpi_target', id: row.id, reason: 'Missing brand, KPI mapping, or week dates' });
      continue;
    }

    const key = `${brand.id}:${row.week_label}:${kpiItemId}`;
    if (weeklyTargetKeys.has(key)) continue;
    weeklyTargetKeys.add(key);

    const kpi = importedKpis.find((item) => item.id === kpiItemId);
    weeklyTargets.push({
      brand_id: brand.id,
      brand_name: brand.name,
      kpi_item_id: kpiItemId,
      kpi_name: kpi ? kpi.name : row.kpi_name || 'Unknown KPI',
      week_label: row.week_label,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      target_value: Number(row.target_value || 0),
    });
  }

  const standupRows = [];
  const standupRowsByComposite = new Map();
  for (const row of data.Standup || []) {
    const role = normalizeRole(row.user_role);
    const brand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
    const user = usersByEmail.get(String(row.created_by || '').trim().toLowerCase());
    const standupDate = parseDateOnly(row.standup_date);
    const session = ['pagi', 'sore'].includes(row.session) ? row.session : null;

    if (!role || !brand || !user || !standupDate || !session) {
      skipped.push({
        type: 'standup',
        id: row.id,
        reason: !role ? 'Invalid role' : !brand ? 'Unknown brand' : !user ? 'Missing user mapping' : !standupDate ? 'Invalid standup date' : 'Invalid session',
      });
      continue;
    }

    const preparedRow = {
      id: row.id,
      brand_id: brand.id,
      brand_name: brand.name,
      user_id: user.id,
      user_name: row.user_name || user.full_name,
      user_role: role,
      session,
      standup_date: standupDate,
      answers: row.answers || {},
      daily_log: enrichDailyLog(row, legacyAnswerKeyToDailyLogKey),
      status: normalizeStatus(row.status, VALID_STANDUP_STATUS, 'draft'),
      _sort_time: Math.max(getTimestamp(row.updated_date), getTimestamp(row.created_date), standupDate.getTime()),
    };

    const compositeKey = `${preparedRow.brand_id}:${preparedRow.user_id}:${preparedRow.session}:${row.standup_date}`;
    const existing = standupRowsByComposite.get(compositeKey);
    if (!existing || preparedRow._sort_time >= existing._sort_time) {
      if (existing) {
        skipped.push({
          type: 'standup_duplicate',
          id: existing.id,
          replacement_id: preparedRow.id,
          reason: 'Replaced by newer record for the same brand/user/session/date',
        });
      }
      standupRowsByComposite.set(compositeKey, preparedRow);
    } else {
      skipped.push({
        type: 'standup_duplicate',
        id: preparedRow.id,
        replacement_id: existing.id,
        reason: 'Skipped because an equivalent newer record already exists in the import batch',
      });
    }
  }

  for (const preparedRow of standupRowsByComposite.values()) {
    const { _sort_time, ...persistedRow } = preparedRow;
    standupRows.push(persistedRow);
  }

  await prisma.$transaction(async (tx) => {
    await tx.kpiDailySnapshot.deleteMany({});
    await tx.kpiWeeklyTarget.deleteMany({});
    await tx.kpiBrandConfig.deleteMany({});
    await tx.kpiItem.deleteMany({});
    await tx.standupConfig.deleteMany({});

    if (importedKpis.length > 0) {
      await tx.kpiItem.createMany({
        data: importedKpis.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          auto_source_role: item.auto_source_role,
          auto_source: item.auto_source,
          auto_aggregation: item.auto_aggregation,
          unit: item.unit,
          platform: item.platform,
          order_num: item.order_num,
          is_active: item.is_active,
          description: item.description,
        })),
      });
    }

    if (standupConfigs.length > 0) {
      await tx.standupConfig.createMany({ data: standupConfigs });
    }

    if (brandConfigRows.length > 0) {
      await tx.kpiBrandConfig.createMany({ data: brandConfigRows });
    }

    if (weeklyTargets.length > 0) {
      await tx.kpiWeeklyTarget.createMany({ data: weeklyTargets });
    }

    for (const row of standupRows) {
      await tx.standup.upsert({
        where: { id: row.id },
        update: {
          brand_id: row.brand_id,
          brand_name: row.brand_name,
          user_id: row.user_id,
          user_name: row.user_name,
          user_role: row.user_role,
          session: row.session,
          standup_date: row.standup_date,
          answers: row.answers,
          daily_log: row.daily_log,
          status: row.status,
        },
        create: {
          id: row.id,
          brand_id: row.brand_id,
          brand_name: row.brand_name,
          user_id: row.user_id,
          user_name: row.user_name,
          user_role: row.user_role,
          session: row.session,
          standup_date: row.standup_date,
          answers: row.answers,
          daily_log: row.daily_log,
          status: row.status,
        },
      });
    }

    for (const row of data.DailyReport || []) {
      const brand = brandMappings.get(row.brand_id) || brandMappings.get(`name:${row.brand_name}`);
      const user = usersByEmail.get(String(row.created_by || '').trim().toLowerCase());
      const reportDate = parseDateOnly(row.report_date);

      if (!brand || !user || !reportDate) {
        skipped.push({
          type: 'daily_report',
          id: row.id,
          reason: !brand ? 'Unknown brand' : !user ? 'Missing user mapping' : 'Invalid report date',
        });
        continue;
      }

      await tx.dailyReport.upsert({
        where: { id: row.id },
        update: {
          brand_id: brand.id,
          brand_name: brand.name,
          user_id: user.id,
          report_date: reportDate,
          title: row.title || 'Laporan Harian',
          content: row.content || '',
          category: normalizeStatus(row.category, VALID_REPORT_CATEGORY, 'general'),
          status: normalizeStatus(row.status, VALID_REPORT_STATUS, 'draft'),
          submitted_by_name: row.submitted_by_name || user.full_name,
          submitted_by_role: normalizeRole(row.submitted_by_role) || 'admin',
        },
        create: {
          id: row.id,
          brand_id: brand.id,
          brand_name: brand.name,
          user_id: user.id,
          report_date: reportDate,
          title: row.title || 'Laporan Harian',
          content: row.content || '',
          category: normalizeStatus(row.category, VALID_REPORT_CATEGORY, 'general'),
          status: normalizeStatus(row.status, VALID_REPORT_STATUS, 'draft'),
          submitted_by_name: row.submitted_by_name || user.full_name,
          submitted_by_role: normalizeRole(row.submitted_by_role) || 'admin',
        },
      });
    }
  });

  const counts = {
    Brand: await prisma.brand.count(),
    User: await prisma.user.count(),
    Standup: await prisma.standup.count(),
    StandupConfig: await prisma.standupConfig.count(),
    DailyReport: await prisma.dailyReport.count(),
    KpiItem: await prisma.kpiItem.count(),
    KpiBrandConfig: await prisma.kpiBrandConfig.count(),
    KpiWeeklyTarget: await prisma.kpiWeeklyTarget.count(),
  };

  const summary = {
    source_file: resolvedPath,
    imported_user_emails: Array.from(importedUsers.keys()).sort(),
    skipped,
    counts,
    default_password_for_imported_users: DEFAULT_PASSWORD,
    imported_users_active: IMPORT_IMPORTED_USERS_ACTIVE,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
