#!/usr/bin/env node
/**
 * Regenerates data/rate-report.json from live production data. Mirrors the
 * exact aggregation logic on equipmentcapitalindex.com/press so this
 * repo's numbers never drift from what the site itself states -- one
 * source of truth, computed twice from the same underlying rows rather
 * than copy-pasted and left to go stale.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SITE_BASE_URL = process.env.SITE_BASE_URL || 'https://www.equipmentcapitalindex.com';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_KEY');
}

const categoryLabel = (c) => c.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');

async function main() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/equipment_financing_pages`);
  url.searchParams.set('select', 'category,base_apr,monthly_payment,updated_at');
  url.searchParams.set('is_published', 'eq.true');
  url.searchParams.set('lease_type', 'eq.capital-lease');

  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();

  const byCategory = new Map();
  for (const row of rows) {
    const s = byCategory.get(row.category) ?? { count: 0, aprTotal: 0, paymentTotal: 0 };
    s.count += 1;
    s.aprTotal += Number(row.base_apr);
    s.paymentTotal += Number(row.monthly_payment);
    byCategory.set(row.category, s);
  }

  const categories = [...byCategory.entries()]
    .map(([category, s]) => ({
      category,
      label: categoryLabel(category),
      machines_tracked: s.count,
      avg_apr_percent: Number((s.aprTotal / s.count).toFixed(2)),
      avg_estimated_monthly_payment_usd: Math.round(s.paymentTotal / s.count),
    }))
    .sort((a, b) => b.machines_tracked - a.machines_tracked);

  const mostRecentUpdate = rows.reduce((latest, row) => {
    if (!row.updated_at) return latest;
    return !latest || row.updated_at > latest ? row.updated_at : latest;
  }, null);

  const report = {
    $schema: 'https://www.equipmentcapitalindex.com/press',
    generated_at: new Date().toISOString(),
    data_as_of: mostRecentUpdate,
    source: SITE_BASE_URL,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    methodology: `${SITE_BASE_URL}/methodology`,
    total_machines_tracked: rows.length,
    site_avg_apr_percent: rows.length ? Number((rows.reduce((s, r) => s + Number(r.base_apr), 0) / rows.length).toFixed(2)) : null,
    site_avg_estimated_monthly_payment_usd: rows.length
      ? Math.round(rows.reduce((s, r) => s + Number(r.monthly_payment), 0) / rows.length)
      : null,
    categories,
  };

  const outPath = path.join(__dirname, '..', 'data', 'rate-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${outPath} (${rows.length} rows, ${categories.length} categories).`);
}

main().catch((err) => {
  console.error('generate-report.mjs failed:', err);
  process.exitCode = 1;
});
