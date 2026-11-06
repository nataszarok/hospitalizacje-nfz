import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const DIR = "public/data/hospitalizations";
const MAX_PAGES_FILE_BYTES = 25 * 1024 * 1024;
const E10 = "5.51.01.0005010";
// Punkty kontrolne: E10 w danym roku (metoda min), policzone niezależnie z pliku źródłowego (awk).
// Każdy rok w index.json musi mieć punkt kontrolny.
// 2017: do września E10 obejmowało więcej przypadków (zmiana katalogu JGP od października 2017 r.).
const E10_CHECKS = {
  "2017": { facilities: 140, hospitalizations: 20596 },
  "2018": { facilities: 138, hospitalizations: 10431 },
  "2019": { facilities: 139, hospitalizations: 10643 },
  "2020": { facilities: 139, hospitalizations: 8062 },
  "2021": { facilities: 141, hospitalizations: 8352 },
  "2022": { facilities: 139, hospitalizations: 8612 },
  "2023": { facilities: 142, hospitalizations: 8534 },
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

// Pliki w formacie słownikowo-kolumnowym (src/lib/hospitalizationCodec.ts): sprawdzamy indeksy i odtwarzamy wiersze.
function rowsFromColumns(columns, keys, name) {
  if (!columns || Array.isArray(columns)) throw new Error(`${name}: expected columns, got ${Array.isArray(columns) ? "rows" : "nothing"}.`);
  const length = columns[keys[0]]?.length ?? 0;
  for (const key of keys) if (columns[key]?.length !== length) throw new Error(`${name}: column ${key} has ${columns[key]?.length} values instead of ${length}.`);
  return Array.from({ length }, (_, i) => keys.map((key) => columns[key][i]));
}

function lookup(list, i, name) {
  if (list[i] === undefined) throw new Error(`${name}: index ${i} outside the dictionary.`);
  return list[i];
}

const VALUE_KEYS = ["hSim", "hMin", "dSim", "dMin"];
const MONTH_KEYS = ["year", "month", "product", "group", ...VALUE_KEYS];

function monthlyRows(columns, years, groups, name) {
  return rowsFromColumns(columns, MONTH_KEYS, name).map(([year, month, product, group, ...values]) => [lookup(years, year, name), month, product, lookup(groups, group, name), ...values]);
}

const index = JSON.parse(await readFile(path.join(DIR, "index.json"), "utf8"));
if (!Array.isArray(index.years) || index.years.length === 0) throw new Error("index.json has no years.");
if (index.latestYear !== [...index.years].sort().at(-1)) throw new Error("index.json latestYear is not the newest year.");

let totalSize = 0;
for (const year of index.years) {
  const { size, data } = await readGzipJson(path.join(DIR, `${year}.json.gz`));
  totalSize += size;
  if (data.analysisYear !== year) throw new Error(`${year}.json.gz has analysisYear ${data.analysisYear}.`);
  if (data.version !== 2) throw new Error(`${year}.json.gz has version ${data.version} instead of 2.`);
  data.facts = rowsFromColumns(data.facts, ["facility", "product", "duration", "admission", ...VALUE_KEYS], `${year}.json.gz`)
    .map(([facility, product, duration, admission, ...values]) => {
      const [ow, nip] = lookup(data.facilities, facility, `${year}.json.gz`);
      return [ow, nip, lookup(data.products, product, `${year}.json.gz`)[0], lookup(data.durations, duration, `${year}.json.gz`), lookup(data.admissions, admission, `${year}.json.gz`), ...values];
    });
  if (data.facts.length === 0) throw new Error(`${year}: static dataset has no facts.`);
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
  if (!check) throw new Error(`${year}: no E10 checkpoint in E10_CHECKS (count E10 in the source file and add it).`);
  if (check && (e10Facilities.size !== check.facilities || e10Hospitalizations !== check.hospitalizations)) {
    throw new Error(`${year}: E10 verification failed: ${e10Facilities.size} facilities / ${e10Hospitalizations} hospitalizations.`);
  }
  console.log(`${year}: ${data.facts.length.toLocaleString("en-US")} facts, E10 ${e10Facilities.size} facilities / ${e10Hospitalizations} hospitalizations${check ? " (checked)" : ""}, ${(size / 1024 / 1024).toFixed(2)} MiB.`);
}

const { size: trendsSize, data: trends } = await readGzipJson(path.join(DIR, "trends.json.gz"));
if (trends.version !== 2) throw new Error(`trends.json.gz has version ${trends.version} instead of 2.`);
trends.monthly = monthlyRows(trends.monthly, trends.years, trends.groups, "trends.json.gz");
trends.regional = rowsFromColumns(trends.regional, ["year", "branch", "product", "group", ...VALUE_KEYS], "trends.json.gz")
  .map(([year, branch, product, group, ...values]) => [lookup(trends.years, year, "trends.json.gz"), lookup(trends.branches, branch, "trends.json.gz"), product, lookup(trends.groups, group, "trends.json.gz"), ...values]);
if (JSON.stringify(trends.years) !== JSON.stringify(index.years)) throw new Error("trends.json.gz years differ from index.json.");
if (!trends.monthly?.length || !trends.regional?.length) throw new Error("trends.json.gz has no rows.");

console.log(`Trends OK: ${trends.monthly.length.toLocaleString("en-US")} monthly rows, ${(trendsSize / 1024).toFixed(0)} KiB.`);

// Trend miesięczny według OW NFZ (plik na każdy OW) musi sumować się do trendu krajowego.
const regionalDir = path.join(DIR, "trends-regions");
const regionalSums = new Map();
let regionalSize = 0;
let regionalRows = 0;
const regionCodes = (await readdir(regionalDir)).filter((name) => name.endsWith(".json.gz")).sort();
if (regionCodes.length !== 16) throw new Error(`trends-regions/ has ${regionCodes.length} files instead of 16.`);
for (const name of regionCodes) {
  const { size, data: regional } = await readGzipJson(path.join(regionalDir, name));
  regionalSize += size;
  if (regional.version !== 3 || `${regional.owNfz}.json.gz` !== name) throw new Error(`trends-regions/${name} has a wrong header.`);
  regional.rows = monthlyRows(regional.rows, regional.years, regional.groups, `trends-regions/${name}`);
  if (JSON.stringify(regional.years) !== JSON.stringify(index.years)) throw new Error(`trends-regions/${name} years differ from index.json.`);
  regionalRows += regional.rows.length;
  for (const [year, month, product, group, hSim, hMin] of regional.rows) {
    const key = `${year}|${month}|${product}|${group}`;
    const sum = regionalSums.get(key) ?? [0, 0];
    regionalSums.set(key, [sum[0] + hSim, sum[1] + hMin]);
  }
}
const nationalSums = new Map();
for (const [year, month, product, group, hSim, hMin] of trends.monthly) nationalSums.set(`${year}|${month}|${product}|${group}`, [hSim, hMin]);
if (regionalSums.size !== nationalSums.size) throw new Error("trends-regions/ covers different months or products than trends.json.gz.");
for (const [key, [hSim, hMin]] of nationalSums) {
  const sum = regionalSums.get(key);
  if (!sum || sum[0] !== hSim || sum[1] !== hMin) throw new Error(`trends-regions/ does not add up to trends.json.gz for ${key}.`);
}
console.log(`Regional trends OK: ${regionCodes.length} files, ${regionalRows.toLocaleString("en-US")} rows, ${(regionalSize / 1024).toFixed(0)} KiB.`);
console.log(`Hospitalization data OK: ${index.years.join(", ")}; ${((totalSize + trendsSize + regionalSize) / 1024 / 1024).toFixed(2)} MiB in total.`);

// Pliki stron grup (scripts/build_jgp_pages.py, format v3: wiersze kolumnami): jeden na każdą grupę JGP z trendów,
// a ich hospitalizacje (metoda min) sumują się do trendu krajowego grupy w każdym miesiącu i trybie.
{
  const pagesIndex = JSON.parse(await readFile("build-data/jgp/index.json", "utf8"));
  const trendGroups = [...new Set(trends.products.map(([, jgp]) => jgp).filter(Boolean))].sort();
  if (JSON.stringify(pagesIndex.groups) !== JSON.stringify(trendGroups)) throw new Error("build-data/jgp/index.json groups differ from trends.json.gz.");
  const ADMISSION = { p: 0, u: 1, o: 2 };
  const expected = new Map();
  for (const [year, month, product, admission, , hMin] of trends.monthly) {
    const jgp = trends.products[product][1];
    const key = `${jgp}|${index.years.indexOf(year) * 12 + month - 1}|${ADMISSION[admission]}`;
    expected.set(key, (expected.get(key) ?? 0) + hMin);
  }
  let totalSize = 0;
  let largest = [0, ""];
  for (const code of pagesIndex.groups) {
    const file = path.join("build-data/jgp", `${code}.json.gz`);
    const { size, data: group } = await readGzipJson(file);
    totalSize += size;
    if (size > largest[0]) largest = [size, code];
    if (group.version !== 3 || group.jgp !== code || JSON.stringify(group.years) !== JSON.stringify(index.years)) throw new Error(`${file} has a wrong header.`);
    const actual = new Map();
    group.rows = rowsFromColumns(group.rows, ["provider", "month", "admission", "hospitalizations", "deaths"], file);
    for (const [provider, month, admission, h] of group.rows) {
      if (!group.providers[provider]) throw new Error(`${file}: row points to a missing provider ${provider}.`);
      const key = `${code}|${month}|${admission}`;
      actual.set(key, (actual.get(key) ?? 0) + h);
    }
    for (const [key, h] of expected) {
      if (!key.startsWith(`${code}|`)) continue;
      if ((actual.get(key) ?? 0) !== h) throw new Error(`${file} does not add up to trends.json.gz for ${key}: ${actual.get(key) ?? 0} vs ${h}.`);
    }
  }
  console.log(`Group pages OK: ${pagesIndex.groups.length} groups, ${(totalSize / 1024 / 1024).toFixed(2)} MiB, largest ${largest[1]} ${(largest[0] / 1024).toFixed(0)} KiB.`);
}

// Metoda cal (kalibracja „<5”, scripts/calibrate_below5.py w build_hospitalizations.py): kolumny hCal/dCal tylko dla lat
// z index.json → calibration. W pliku roku cal ≥ min, zgony cal ≤ pobyty cal, nadwyżka cal − min równa podsumowaniu
// (pobyty i zgony), trendy sumują się do pliku roku; lata bez kalibracji nie mają hCal, a w trendach mają null.
{
  const calibration = index.calibration ?? {};
  const { data: rawTrends } = await readGzipJson(path.join(DIR, "trends.json.gz"));
  const m = rawTrends.monthly;
  for (const year of index.years) {
    const summary = calibration[year];
    const { data: yearFile } = await readGzipJson(path.join(DIR, `${year}.json.gz`));
    const f = yearFile.facts;
    if (!summary) {
      if (f.hCal || f.dCal) throw new Error(`${year}.json.gz has hCal/dCal but index.json has no calibration for ${year}.`);
      continue;
    }
    if (f.hCal?.length !== f.hMin.length || f.dCal?.length !== f.dMin.length) throw new Error(`${year}.json.gz: hCal/dCal missing or of wrong length.`);
    let extraH = 0, extraD = 0, h = 0, d = 0;
    for (let i = 0; i < f.hMin.length; i++) {
      if (f.hCal[i] < f.hMin[i] || f.dCal[i] < f.dMin[i] || f.dCal[i] > f.hCal[i]) throw new Error(`${year}.json.gz: fact ${i} has hMin ${f.hMin[i]}, hCal ${f.hCal[i]}, dMin ${f.dMin[i]}, dCal ${f.dCal[i]}.`);
      extraH += f.hCal[i] - f.hMin[i]; extraD += f.dCal[i] - f.dMin[i]; h += f.hCal[i]; d += f.dCal[i];
    }
    if (extraH !== summary.staysCal - summary.staysMin || extraD !== summary.deathsCal - summary.deathsMin) {
      throw new Error(`${year}.json.gz: cal excess ${extraH} stays / ${extraD} deaths differs from index.json calibration.`);
    }
    const yearIndex = rawTrends.years.indexOf(year);
    let th = 0, td = 0;
    for (let i = 0; i < m.year.length; i++) if (m.year[i] === yearIndex) { th += m.hCal[i]; td += m.dCal[i]; }
    if (th !== h || td !== d) throw new Error(`trends.json.gz ${year}: hCal/dCal ${th}/${td} differ from ${year}.json.gz ${h}/${d}.`);
    console.log(`Calibration OK: ${year}, ${summary.groups} groups = API, stays cal ${h.toLocaleString("en-US")}, deaths cal ${d.toLocaleString("en-US")}.`);
  }
  for (let i = 0; i < m.year.length; i++) {
    const withCal = Boolean(calibration[rawTrends.years[m.year[i]]]);
    if (withCal !== (m.hCal[i] !== null) || withCal !== (m.dCal[i] !== null)) throw new Error(`trends.json.gz: hCal/dCal must be set exactly for calibrated years (row ${i}).`);
  }
}

// Mapa województw (scripts/build_regions_map.py): 16 województw z kodami OW jak w danych.
{
  const { size, data: map } = await readGzipJson("public/data/regions-map.json.gz");
  const { data: latest } = await readGzipJson(path.join(DIR, `${index.latestYear}.json.gz`));
  const expected = latest.regions.map(([ow]) => ow).sort().join(",");
  const actual = map.regions.map(([ow]) => ow).sort().join(",");
  if (actual !== expected) throw new Error(`regions-map.json.gz regions (${actual}) differ from the dataset (${expected}).`);
  if (map.regions.some(([, , pathData]) => !/^M\d/.test(pathData))) throw new Error("regions-map.json.gz has an empty or invalid path.");
  console.log(`Regions map OK: ${map.regions.length} voivodeships, ${(size / 1024).toFixed(1)} KiB.`);
}

// Wyceny JGP (scripts/build_valuations.py): format krotek, unikalne kody grup.
{
  const { size, data: valuations } = await readGzipJson("public/data/wyceny_jgp_2025.json.gz");
  if (valuations.version !== 2 || !valuations.fields?.includes("kod_jgp") || !valuations.fields.includes("pkt_hospitalizacja")) {
    throw new Error("wyceny_jgp_2025.json.gz is not in the tuple format (version 2).");
  }
  const codes = valuations.rows.map((row) => row[valuations.fields.indexOf("kod_jgp")]);
  if (!codes.length || new Set(codes).size !== codes.length) throw new Error("wyceny_jgp_2025.json.gz has no rows or duplicate group codes.");
  console.log(`Valuations OK: ${codes.length} groups, ${(size / 1024).toFixed(1)} KiB.`);
}

// Sieć szpitali PSZ (scripts/build_psz.py): unikalne NIP-y, poziomy z listy.
{
  const { size, data: psz } = await readGzipJson("public/data/psz.json.gz");
  const nips = psz.rows.map(([nip]) => nip);
  if (psz.version !== 1 || nips.length < 400 || new Set(nips).size !== nips.length) throw new Error("psz.json.gz is not version 1, has too few rows or duplicate NIPs.");
  if (psz.rows.some(([nip, level]) => !/^\d{10}$/.test(nip) || !psz.levels[level])) throw new Error("psz.json.gz has an invalid NIP or level.");
  console.log(`PSZ OK: ${nips.length} providers (list ${psz.listDate}), ${(size / 1024).toFixed(1)} KiB.`);
}
