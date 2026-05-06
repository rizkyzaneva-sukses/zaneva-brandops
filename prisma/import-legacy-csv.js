/**
 * Import legacy CSV data (targets + actuals) into the new BrandOps app.
 *
 * Usage:
 *   node prisma/import-legacy-csv.js
 *   # or with explicit DATABASE_URL:
 *   DATABASE_URL="postgresql://..." node prisma/import-legacy-csv.js
 *
 * Expects these files in the project root:
 *   - targets_2026-01_to_2026-04.csv
 *   - actuals_2026-01_to_2026-04.csv
 *
 * What it does:
 *   1. Creates new KpiItem entries for each unique KPI found in the CSVs
 *   2. Creates KpiBrandConfig entries (brand ↔ KPI mapping)
 *   3. Splits monthly targets into weekly KpiWeeklyTarget records (÷4 weeks)
 *   4. Imports actuals as KpiDailySnapshot records (one per week per KPI)
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

// ─── BRAND MAPPING ────────────────────────────────────────────────────────────
const BRAND_MAP = {
    ZANEVA: { id: 'brand-zaneva', name: 'Zaneva' },
    OBERBE: { id: 'brand-oberbe', name: 'Oberbe' },
    "BE.SYAR'I": { id: 'brand-besyari', name: "Be.Syari" },
    BESYARI: { id: 'brand-besyari', name: "Be.Syari" },
    MUSWIM: { id: 'brand-msw', name: 'Muslimah Swimwear' },
};

function getBrand(csvBrand) {
    const upper = String(csvBrand || '').trim().toUpperCase();
    // Handle BE.SYAR'I variations
    if (upper.includes('SYAR') || upper.includes('BESYAR')) {
        return BRAND_MAP["BE.SYAR'I"];
    }
    return BRAND_MAP[upper] || null;
}

// ─── MONTH MAPPING ────────────────────────────────────────────────────────────
const MONTH_MAP = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// ─── WEEK HELPERS ─────────────────────────────────────────────────────────────
// Get all ISO weeks that fall within a given month
function getWeeksInMonth(year, monthIndex) {
    const weeks = [];
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    // Start from the Monday of the week containing the 1st
    let current = new Date(firstDay);
    // Find the Monday of the first week that has days in this month
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    current.setDate(current.getDate() + mondayOffset);

    while (current <= lastDay) {
        const monday = new Date(current);
        const sunday = new Date(current);
        sunday.setDate(monday.getDate() + 6);

        // Only include weeks where at least part falls in this month
        if (sunday >= firstDay && monday <= lastDay) {
            const weekNum = getISOWeekNumber(monday);
            const monthAbbr = getMonthAbbr(monday);
            weeks.push({
                week_label: `W${weekNum} - ${monthAbbr} ${year}`,
                week_start: formatDate(monday),
                week_end: formatDate(sunday),
                week_start_date: monday,
                week_end_date: sunday,
            });
        }

        current.setDate(current.getDate() + 7);
    }

    return weeks;
}

function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getMonthAbbr(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return months[date.getMonth()];
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Get the Monday of a given ISO week number in a year
function getMondayOfWeek(year, weekNumber) {
    // Jan 4 is always in ISO week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Mon=1 ... Sun=7
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));

    const targetMonday = new Date(mondayOfWeek1);
    targetMonday.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
    return targetMonday;
}

function getWeekInfoForWeekNumber(year, weekNumber) {
    const monday = getMondayOfWeek(year, weekNumber);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekNum = getISOWeekNumber(monday);
    const monthAbbr = getMonthAbbr(monday);

    return {
        week_label: `W${weekNum} - ${monthAbbr} ${year}`,
        week_start: formatDate(monday),
        week_end: formatDate(sunday),
        week_start_date: monday,
        week_end_date: sunday,
    };
}

// ─── KPI SLUG GENERATION ──────────────────────────────────────────────────────
function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

// ─── UNIT MAPPING ─────────────────────────────────────────────────────────────
function mapUnit(csvUnit) {
    const u = String(csvUnit || '').trim().toLowerCase();
    if (u === 'rp' || u === 'currency') return 'currency';
    if (u === '%' || u === 'percent') return 'percent';
    return 'number';
}

// ─── GROUP TO ROLE MAPPING ────────────────────────────────────────────────────
function mapGroupToRole(group) {
    const g = String(group || '').trim().toLowerCase();
    if (g === 'creative') return 'creative';
    if (g === 'marketing') return 'brand_manager';
    if (g === 'rnd' || g === 'r&d') return 'rnd';
    return null;
}

// ─── PARSE NUMBER (handles dots as thousands separator) ───────────────────────
function parseNumValue(val) {
    if (!val && val !== 0) return 0;
    let str = String(val).trim();
    // Handle numbers like "639.579" which are thousands separators (not decimals)
    // If it has exactly 3 digits after a dot, treat dot as thousands separator
    // But "8.089" with 3 digits after dot could be thousands too
    // Strategy: if the value contains a dot and the part after dot is exactly 3 digits, treat as thousands
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, '');
    } else if (/^\d+\.\d{3}$/.test(str)) {
        str = str.replace(/\./g, '');
    }
    // Also handle comma as decimal separator
    str = str.replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    const targetsPath = path.resolve(__dirname, '..', 'targets_2026-01_to_2026-04.csv');
    const actualsPath = path.resolve(__dirname, '..', 'actuals_2026-01_to_2026-04.csv');

    if (!fs.existsSync(targetsPath)) throw new Error(`Targets file not found: ${targetsPath}`);
    if (!fs.existsSync(actualsPath)) throw new Error(`Actuals file not found: ${actualsPath}`);

    const targetsCsv = fs.readFileSync(targetsPath, 'utf8');
    const actualsCsv = fs.readFileSync(actualsPath, 'utf8');

    const targetsRows = parse(targetsCsv, { columns: true, skip_empty_lines: true, trim: true });
    const actualsRows = parse(actualsCsv, { columns: true, skip_empty_lines: true, trim: true });

    console.log(`Parsed ${targetsRows.length} target rows, ${actualsRows.length} actual rows`);

    // ─── Step 1: Collect unique KPIs ──────────────────────────────────────────
    const kpiMap = new Map(); // key: "group|kpi_name" -> KPI definition

    function collectKpi(group, kpiName, unit) {
        if (!group || !kpiName) return null;
        const key = `${group.trim()}|${kpiName.trim()}`;
        if (!kpiMap.has(key)) {
            const id = `kpi-legacy-${slugify(group)}-${slugify(kpiName)}`;
            kpiMap.set(key, {
                id,
                name: kpiName.trim(),
                group: group.trim(),
                category: 'manual',
                auto_source_role: mapGroupToRole(group),
                auto_source: null,
                auto_aggregation: 'sum',
                unit: mapUnit(unit),
                platform: null,
                order_num: 0,
                is_active: true,
                description: `Legacy import - ${group} - ${kpiName}`,
            });
        }
        return kpiMap.get(key);
    }

    // Collect from targets
    for (const row of targetsRows) {
        if (row.Group && row.KPI) {
            collectKpi(row.Group, row.KPI, row.Unit);
        }
    }

    // Collect from actuals
    for (const row of actualsRows) {
        if (row.Group && row.KPI) {
            collectKpi(row.Group, row.KPI, row.Unit);
        }
    }

    // Assign order numbers
    let orderNum = 100; // Start at 100 to not conflict with existing KPIs
    for (const kpi of kpiMap.values()) {
        kpi.order_num = orderNum++;
    }

    console.log(`Found ${kpiMap.size} unique KPIs`);

    // ─── Step 2: Ensure brands exist ─────────────────────────────────────────
    const brandIds = new Set();
    for (const row of [...targetsRows, ...actualsRows]) {
        const brand = getBrand(row.Brand);
        if (brand) brandIds.add(brand.id);
    }

    for (const brandKey of Object.keys(BRAND_MAP)) {
        const b = BRAND_MAP[brandKey];
        if (brandIds.has(b.id)) {
            await prisma.brand.upsert({
                where: { id: b.id },
                update: { name: b.name },
                create: { id: b.id, name: b.name, status: 'active' },
            });
            console.log(`  Brand ensured: ${b.name} (${b.id})`);
        }
    }

    // ─── Step 3: Create KPI Items ─────────────────────────────────────────────
    for (const kpi of kpiMap.values()) {
        await prisma.kpiItem.upsert({
            where: { id: kpi.id },
            update: {
                name: kpi.name,
                category: kpi.category,
                auto_source_role: kpi.auto_source_role,
                auto_source: kpi.auto_source,
                auto_aggregation: kpi.auto_aggregation,
                unit: kpi.unit,
                platform: kpi.platform,
                order_num: kpi.order_num,
                is_active: kpi.is_active,
                description: kpi.description,
            },
            create: {
                id: kpi.id,
                name: kpi.name,
                category: kpi.category,
                auto_source_role: kpi.auto_source_role,
                auto_source: kpi.auto_source,
                auto_aggregation: kpi.auto_aggregation,
                unit: kpi.unit,
                platform: kpi.platform,
                order_num: kpi.order_num,
                is_active: kpi.is_active,
                description: kpi.description,
            },
        });
    }
    console.log(`Created/updated ${kpiMap.size} KPI items`);

    // ─── Step 4: Create KpiBrandConfig entries ────────────────────────────────
    const brandConfigKeys = new Set();
    const brandConfigs = [];

    for (const row of [...targetsRows, ...actualsRows]) {
        const brand = getBrand(row.Brand);
        if (!brand || !row.Group || !row.KPI) continue;
        const kpiKey = `${row.Group.trim()}|${row.KPI.trim()}`;
        const kpi = kpiMap.get(kpiKey);
        if (!kpi) continue;

        const configKey = `${brand.id}:${kpi.id}`;
        if (brandConfigKeys.has(configKey)) continue;
        brandConfigKeys.add(configKey);

        brandConfigs.push({
            brand_id: brand.id,
            brand_name: brand.name,
            kpi_item_id: kpi.id,
            kpi_name: kpi.name,
            is_enabled: true,
        });
    }

    for (const config of brandConfigs) {
        await prisma.kpiBrandConfig.upsert({
            where: {
                brand_id_kpi_item_id: {
                    brand_id: config.brand_id,
                    kpi_item_id: config.kpi_item_id,
                },
            },
            update: { kpi_name: config.kpi_name, is_enabled: true },
            create: config,
        });
    }
    console.log(`Created/updated ${brandConfigs.length} brand-KPI configs`);

    // ─── Step 5: Import targets (monthly → weekly split ÷4) ──────────────────
    let targetCount = 0;
    const skippedTargets = [];

    for (const row of targetsRows) {
        const brand = getBrand(row.Brand);
        if (!brand || !row.Group || !row.KPI || !row.Month || !row.Year) {
            if (row.Group && row.KPI) {
                skippedTargets.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: 'Missing brand/month/year' });
            }
            continue;
        }

        const kpiKey = `${row.Group.trim()}|${row.KPI.trim()}`;
        const kpi = kpiMap.get(kpiKey);
        if (!kpi) {
            skippedTargets.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: 'KPI not found in map' });
            continue;
        }

        const year = parseInt(row.Year);
        const monthIndex = MONTH_MAP[row.Month.trim()];
        if (monthIndex === undefined) {
            skippedTargets.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: `Invalid month: ${row.Month}` });
            continue;
        }

        const monthlyTarget = parseNumValue(row['Target Value']);
        const weeks = getWeeksInMonth(year, monthIndex);

        if (weeks.length === 0) {
            skippedTargets.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: 'No weeks found for month' });
            continue;
        }

        const weeklyTarget = monthlyTarget / weeks.length;

        for (const week of weeks) {
            await prisma.kpiWeeklyTarget.upsert({
                where: {
                    brand_id_week_label_kpi_item_id: {
                        brand_id: brand.id,
                        week_label: week.week_label,
                        kpi_item_id: kpi.id,
                    },
                },
                update: { target_value: weeklyTarget },
                create: {
                    brand_id: brand.id,
                    brand_name: brand.name,
                    kpi_item_id: kpi.id,
                    kpi_name: kpi.name,
                    week_label: week.week_label,
                    week_start_date: week.week_start_date,
                    week_end_date: week.week_end_date,
                    target_value: weeklyTarget,
                },
            });
            targetCount++;
        }
    }

    console.log(`Created/updated ${targetCount} weekly target records`);
    if (skippedTargets.length > 0) {
        console.log(`Skipped ${skippedTargets.length} target rows (incomplete data)`);
    }

    // ─── Step 6: Import actuals as KpiDailySnapshot ───────────────────────────
    let snapshotCount = 0;
    const skippedActuals = [];

    for (const row of actualsRows) {
        const brand = getBrand(row.Brand);
        if (!brand || !row.Group || !row.KPI || !row.Week || !row.Year) {
            if (row.Group && row.KPI) {
                skippedActuals.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: 'Missing brand/week/year' });
            }
            continue;
        }

        const kpiKey = `${row.Group.trim()}|${row.KPI.trim()}`;
        const kpi = kpiMap.get(kpiKey);
        if (!kpi) {
            skippedActuals.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: 'KPI not found in map' });
            continue;
        }

        const year = parseInt(row.Year);
        const weekNumber = parseInt(row.Week);
        if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 53) {
            skippedActuals.push({ brand: row.Brand, group: row.Group, kpi: row.KPI, reason: `Invalid week: ${row.Week}` });
            continue;
        }

        const weekInfo = getWeekInfoForWeekNumber(year, weekNumber);
        const actualValue = parseNumValue(row['Actual Value']);

        // Use the Sunday (end of week) as snapshot_date for weekly data
        const snapshotDate = weekInfo.week_end_date;

        // Get the target for this week to calculate pct_of_target
        let targetValue = 0;
        const existingTarget = await prisma.kpiWeeklyTarget.findUnique({
            where: {
                brand_id_week_label_kpi_item_id: {
                    brand_id: brand.id,
                    week_label: weekInfo.week_label,
                    kpi_item_id: kpi.id,
                },
            },
        });
        if (existingTarget) {
            targetValue = existingTarget.target_value;
        }

        const pctOfTarget = targetValue > 0 ? Math.round((actualValue / targetValue) * 100) : 0;

        await prisma.kpiDailySnapshot.upsert({
            where: {
                brand_id_snapshot_date_kpi_item_id: {
                    brand_id: brand.id,
                    snapshot_date: snapshotDate,
                    kpi_item_id: kpi.id,
                },
            },
            update: {
                daily_value: actualValue,
                cumulative_value: actualValue,
                target_value: targetValue,
                pct_of_target: pctOfTarget,
                week_label: weekInfo.week_label,
            },
            create: {
                brand_id: brand.id,
                snapshot_date: snapshotDate,
                week_label: weekInfo.week_label,
                kpi_item_id: kpi.id,
                kpi_name: kpi.name,
                daily_value: actualValue,
                cumulative_value: actualValue,
                target_value: targetValue,
                pct_of_target: pctOfTarget,
            },
        });
        snapshotCount++;
    }

    console.log(`Created/updated ${snapshotCount} daily snapshot records`);
    if (skippedActuals.length > 0) {
        console.log(`Skipped ${skippedActuals.length} actual rows (incomplete data)`);
    }

    // ─── Summary ──────────────────────────────────────────────────────────────
    const counts = {
        KpiItem: await prisma.kpiItem.count(),
        KpiBrandConfig: await prisma.kpiBrandConfig.count(),
        KpiWeeklyTarget: await prisma.kpiWeeklyTarget.count(),
        KpiDailySnapshot: await prisma.kpiDailySnapshot.count(),
    };

    console.log('\n═══ IMPORT SUMMARY ═══');
    console.log(`KPI Items total in DB: ${counts.KpiItem}`);
    console.log(`Brand Configs total in DB: ${counts.KpiBrandConfig}`);
    console.log(`Weekly Targets total in DB: ${counts.KpiWeeklyTarget}`);
    console.log(`Daily Snapshots total in DB: ${counts.KpiDailySnapshot}`);
    console.log('\nKPIs imported:');
    for (const [key, kpi] of kpiMap.entries()) {
        console.log(`  [${kpi.unit}] ${key} → ${kpi.id}`);
    }
    if (skippedTargets.length > 0) {
        console.log(`\nSkipped targets (${skippedTargets.length}):`);
        for (const s of skippedTargets.slice(0, 10)) {
            console.log(`  ${s.brand} | ${s.group} | ${s.kpi} → ${s.reason}`);
        }
        if (skippedTargets.length > 10) console.log(`  ... and ${skippedTargets.length - 10} more`);
    }
    if (skippedActuals.length > 0) {
        console.log(`\nSkipped actuals (${skippedActuals.length}):`);
        for (const s of skippedActuals.slice(0, 10)) {
            console.log(`  ${s.brand} | ${s.group} | ${s.kpi} → ${s.reason}`);
        }
        if (skippedActuals.length > 10) console.log(`  ... and ${skippedActuals.length - 10} more`);
    }
}

main()
    .catch((error) => {
        console.error('Import failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
