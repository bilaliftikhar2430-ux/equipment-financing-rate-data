#!/usr/bin/env node
/**
 * Deposits data/rate-report.json to Zenodo (CERN/OpenAIRE), getting a
 * permanent, citable DOI. Not tested end-to-end against a real Zenodo
 * account yet -- there's no token available to verify this against the
 * live API, so this is written carefully against Zenodo's documented
 * REST API contract, not run-and-confirmed. Run once manually after
 * setting ZENODO_TOKEN to confirm before trusting it in the scheduled
 * workflow.
 *
 * First run: creates a new deposition, uploads the file, sets metadata,
 * publishes it, and saves the returned deposition id to
 * .zenodo-deposition-id so future runs know this is a NEW VERSION of an
 * existing dataset (same concept DOI, new version DOI) instead of a
 * fresh, disconnected deposition every time.
 *
 * Requires a Zenodo personal access token with deposit:write and
 * deposit:actions scopes: https://zenodo.org/account/settings/applications/
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZENODO_TOKEN = process.env.ZENODO_TOKEN;
const ZENODO_BASE = process.env.ZENODO_SANDBOX === 'true' ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
const IDS_FILE = path.join(__dirname, '..', '.zenodo-deposition-id');
const DATA_FILE = path.join(__dirname, '..', 'data', 'rate-report.json');

if (!ZENODO_TOKEN) throw new Error('Missing required environment variable: ZENODO_TOKEN');

const METADATA = {
  metadata: {
    title: 'Equipment Financing Rate Report',
    upload_type: 'dataset',
    description:
      'Aggregate commercial equipment financing rate and estimated monthly payment benchmarks by category, computed from real per-machine price and rate data tracked by Equipment Capital Index. CC BY 4.0.',
    creators: [{ name: 'Equipment Capital Index' }],
    access_right: 'open',
    license: 'cc-by-4.0',
    keywords: ['equipment financing', 'commercial lending', 'open data', 'finance'],
    related_identifiers: [
      { identifier: 'https://www.equipmentcapitalindex.com/press', relation: 'isSupplementTo', scheme: 'url' },
      {
        identifier: 'https://github.com/bilaliftikhar2430-ux/equipment-financing-rate-data',
        relation: 'isSupplementTo',
        scheme: 'url',
      },
    ],
  },
};

async function zenodoFetch(urlPath, options = {}) {
  const res = await fetch(`${ZENODO_BASE}${urlPath}?access_token=${ZENODO_TOKEN}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`Zenodo API ${options.method || 'GET'} ${urlPath} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function createNewDeposition() {
  return zenodoFetch('/deposit/depositions', { method: 'POST', body: JSON.stringify({}) });
}

async function createNewVersion(existingId) {
  const result = await zenodoFetch(`/deposit/depositions/${existingId}/actions/newversion`, { method: 'POST' });
  // The "latest draft" link points at the new draft deposition to edit.
  const draftUrl = result.links.latest_draft;
  const draftId = draftUrl.split('/').pop();
  return draftId;
}

async function uploadFile(depositionId, bucketUrl) {
  const fileBuffer = readFileSync(DATA_FILE);
  const res = await fetch(`${bucketUrl}/rate-report.json?access_token=${ZENODO_TOKEN}`, {
    method: 'PUT',
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const hasExisting = existsSync(IDS_FILE);
  let depositionId;
  let bucketUrl;

  if (!hasExisting) {
    console.log('No existing deposition -- creating the first one.');
    const dep = await createNewDeposition();
    depositionId = dep.id;
    bucketUrl = dep.links.bucket;
    await zenodoFetch(`/deposit/depositions/${depositionId}`, { method: 'PUT', body: JSON.stringify(METADATA) });
  } else {
    const existingId = readFileSync(IDS_FILE, 'utf-8').trim();
    console.log(`Existing deposition ${existingId} found -- creating a new version.`);
    depositionId = await createNewVersion(existingId);
    const dep = await zenodoFetch(`/deposit/depositions/${depositionId}`);
    bucketUrl = dep.links.bucket;
    // Remove the old file copy carried over into the new draft version
    // before uploading the fresh one, so the version doesn't accumulate
    // duplicate/stale files over time.
    for (const f of dep.files ?? []) {
      await zenodoFetch(`/deposit/depositions/${depositionId}/files/${f.id}`, { method: 'DELETE' });
    }
  }

  console.log('Uploading data/rate-report.json...');
  await uploadFile(depositionId, bucketUrl);

  console.log('Publishing...');
  const published = await zenodoFetch(`/deposit/depositions/${depositionId}/actions/publish`, { method: 'POST' });

  writeFileSync(IDS_FILE, String(depositionId) + '\n');
  console.log(`Published. DOI: ${published.doi}`);
  console.log(`Record: ${published.links.record_html}`);
}

main().catch((err) => {
  console.error('zenodo-deposit.mjs failed:', err);
  process.exitCode = 1;
});
