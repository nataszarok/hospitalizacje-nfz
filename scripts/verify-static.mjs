import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const DIR = "public/data/hospitalizations";
const MAX_PAGES_FILE_BYTES = 25 * 1024 * 1024;
const E10 = "5.51.01.0005010";
// Punkty kontrolne: E10 w danym roku (metoda min). Nowy rok? Dopisz wartości po sprawdzeniu źródła.
const E10_CHECKS = {
  "2024": { facilities: 142, hospitalizations: 8236 },
  "2025": { facilities: 143, hospitalizations: 8326 },
};

async function readGzipJson(file) {
  const size = (await stat(file)).size;
  if (size > MAX_PAGES_FILE_BYTES) {
    throw new Error(`${file} exceeds Cloudflare Pages 25 MiB limit: ${(size / 1024 / 1024).toFixed(2)} MiB.`);
  }
  return { size, data: JSON.parse(gunzipSync(await readFile(file)).toString("utf8")) };
}

const index = JSON.parse(await readFile(path.join(DIR, "index.json"), "utf8"));
if (!Array.isArray(index.years) || index.years.length === 0) throw new Error("index.json has no years.");
if (index.latestYear !== [...index.years].sort().at(-1)) throw new Error("index.json latestYear is not the newest year.");

let totalSize = 0;
for (const year of index.years) {
  const { size, data } = await readGzipJson(path.join(DIR, `${year}.json.gz`));
  totalSize += size;
  if (data.analysisYear !== year) throw new Error(`${year}.json.gz has analysisYear ${data.analysisYear}.`);
  if (!Array.isArray(data.facts) || data.facts.length === 0) throw new Error(`${year}: static dataset has no facts.`);
  if (!Array.isArray(data.products) || data.products.length === 0) throw new Error(`${year}: static dataset has no products.`);

  const productCodes = new Set(data.products.map(([code]) => code));
  const facilityKeys = new Set(data.facilities.map(([ow, nip]) => `${ow}|${nip}`));
  const e10Facilities = new Set();
  let e10Hospitalizations = 0;
  for (const [ow, nip, product, , , , hospMin] of data.facts) {
    if (!productCodes.has(product)) throw new Error(`${year}: fact with unknown product ${product}.`);
    if (!facilityKeys.has(`${ow}|${nip}`)) throw new Error(`${year}: fact with unknown provider ${ow}|${nip}.`);
    if (product !== E10) continue;
    e10Facilities.add(`${ow}|${nip}`);
    e10Hospitalizations += hospMin;
  }

  const check = E10_CHECKS[year];
  if (check && (e10Facilities.size !== check.facilities || e10Hospitalizations !== check.hospitalizations)) {
    throw new Error(`${year}: E10 verification failed: ${e10Facilities.size} facilities / ${e10Hospitalizations} hospitalizations.`);
  }
  console.log(`${year}: ${data.facts.length.toLocaleString("en-US")} facts, E10 ${e10Facilities.size} facilities / ${e10Hospitalizations} hospitalizations${check ? " (checked)" : ""}, ${(size / 1024 / 1024).toFixed(2)} MiB.`);
}

const { size: trendsSize, data: trends } = await readGzipJson(path.join(DIR, "trends.json.gz"));
if (JSON.stringify(trends.years) !== JSON.stringify(index.years)) throw new Error("trends.json.gz years differ from index.json.");
if (!trends.monthly?.length || !trends.regional?.length) throw new Error("trends.json.gz has no rows.");

console.log(`Trends OK: ${trends.monthly.length.toLocaleString("en-US")} monthly rows, ${(trendsSize / 1024).toFixed(0)} KiB.`);

// Trend miesięczny według OW NFZ musi sumować się do trendu krajowego.
const { size: regionalSize, data: regionalTrends } = await readGzipJson(path.join(DIR, "trends-regions.json.gz"));
if (JSON.stringify(regionalTrends.years) !== JSON.stringify(index.years)) throw new Error("trends-regions.json.gz years differ from index.json.");
const nationalSums = new Map();
for (const [year, month, product, group, hSim, hMin] of trends.monthly) nationalSums.set(`${year}|${month}|${product}|${group}`, [hSim, hMin]);
const regionalSums = new Map();
for (const [year, month, , product, group, hSim, hMin] of regionalTrends.rows) {
  const key = `${year}|${month}|${product}|${group}`;
  const sum = regionalSums.get(key) ?? [0, 0];
  regionalSums.set(key, [sum[0] + hSim, sum[1] + hMin]);
}
if (regionalSums.size !== nationalSums.size) throw new Error("trends-regions.json.gz covers different months or products than trends.json.gz.");
for (const [key, [hSim, hMin]] of nationalSums) {
  const sum = regionalSums.get(key);
  if (!sum || sum[0] !== hSim || sum[1] !== hMin) throw new Error(`trends-regions.json.gz does not add up to trends.json.gz for ${key}.`);
}
console.log(`Regional trends OK: ${regionalTrends.rows.length.toLocaleString("en-US")} rows, ${(regionalSize / 1024).toFixed(0)} KiB.`);
console.log(`Hospitalization data OK: ${index.years.join(", ")}; ${((totalSize + trendsSize + regionalSize) / 1024 / 1024).toFixed(2)} MiB in total.`);

// Pliki stron grup (scripts/build_jgp_pages.py) muszą sumować się do trendu krajowego grupy.
const pageCodes = JSON.parse(await readFile("src/lib/jgpPageCodes.json", "utf8"));
for (const code of pageCodes) {
  const file = path.join("public/data/jgp", `${code}.json.gz`);
  const { size, data: group } = await readGzipJson(file);
  if (JSON.stringify(group.years) !== JSON.stringify(index.years)) throw new Error(`${file} years differ from index.json.`);
  const productIndexes = new Set(trends.products.flatMap(([, jgp], i) => jgp === code ? [i] : []));
  const expected = new Map();
  for (const [year, month, product, admission, hSim, hMin] of trends.monthly) {
    if (!productIndexes.has(product)) continue;
    const key = `${year}|${month}|${admission}`;
    const sum = expected.get(key) ?? [0, 0];
    expected.set(key, [sum[0] + hSim, sum[1] + hMin]);
  }
  const actual = new Map();
  for (const [year, month, , , admission, hSim, hMin] of group.monthly) {
    const key = `${year}|${month}|${admission}`;
    const sum = actual.get(key) ?? [0, 0];
    actual.set(key, [sum[0] + hSim, sum[1] + hMin]);
  }
  if (actual.size !== expected.size) throw new Error(`${file} covers different months than trends.json.gz.`);
  for (const [key, [hSim, hMin]] of expected) {
    const sum = actual.get(key);
    if (!sum || sum[0] !== hSim || sum[1] !== hMin) throw new Error(`${file} does not add up to trends.json.gz for ${key}.`);
  }
  console.log(`Group page ${code} OK: ${group.monthly.length.toLocaleString("en-US")} monthly rows${group.valuePln ? `, PLN ${Object.keys(group.valuePln.national).at(0)}–${Object.keys(group.valuePln.national).at(-1)}` : ""}, ${(size / 1024).toFixed(0)} KiB.`);
}
