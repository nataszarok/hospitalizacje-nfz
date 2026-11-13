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

// Ryczałt / za wykonanie kart szpitali (scripts/build_hospital_payment.py): każdy szpital z kartą. Hospitalizacje zakresów
// w roku = hospitalizacje szpitala w plikach placówek (metoda min); kwoty zakresów = kwoty szpitala w plikach grup
// (tolerancja 0,1% na zaokrąglenia i kody spoza katalogu grup).
{
  const keys = JSON.parse(await readFile("build-data/hospitals/index.json", "utf8")).pages.map(([key]) => key);
  const { size, data: payment } = await readGzipJson("build-data/hospitals/payment.json.gz");
  const pagesIndex = JSON.parse(await readFile("build-data/jgp/index.json", "utf8"));
  const facilityIndex = JSON.parse(await readFile(path.join(DIR, "facilities", "index.json"), "utf8"));
  const facilityTotals = new Map();
  for (const name of (await readdir(path.join(DIR, "facilities"))).filter((file) => file.endsWith(".json.gz"))) {
    const { data: section } = await readGzipJson(path.join(DIR, "facilities", name));
    section.rows.facility.forEach((facility, i) => {
      const [ow, nip] = facilityIndex.facilities[facility];
      const id = `${ow}|${nip}|${facilityIndex.years[section.rows.year[i]]}`;
      if (keys.some((key) => id.startsWith(`${key}|`))) facilityTotals.set(id, (facilityTotals.get(id) ?? 0) + section.rows.hMin[i]);
    });
  }
  const groupTotals = new Map();
  for (const code of pagesIndex.groups) {
    const { data: group } = await readGzipJson(path.join("build-data/jgp", `${code}.json.gz`));
    for (const [year, rows] of Object.entries(group.valuePln?.providers ?? {})) {
      for (const [key, value] of rows) if (keys.includes(key)) groupTotals.set(`${key}|${year}`, (groupTotals.get(`${key}|${year}`) ?? 0) + value);
    }
  }
  for (const key of keys) {
    const hospital = payment.hospitals[key];
    if (!hospital?.hosp?.length) throw new Error(`payment.json.gz: no hospitalizations for ${key} (run scripts/build_hospital_payment.py).`);
    hospital.years.forEach((year, y) => {
      const sum = hospital.value.filter(([yearIndex]) => yearIndex === y).reduce((total, row) => total + row[3], 0);
      const expected = groupTotals.get(`${key}|${year}`) ?? 0;
      if (Math.abs(sum - expected) > Math.max(1000, expected * 0.001)) throw new Error(`payment.json.gz: ${key} ${year} settlements sum to ${sum}, group files have ${expected}.`);
      const hosp = hospital.hosp.filter(([yearIndex]) => yearIndex === y).reduce((total, row) => total + row[3], 0);
      const facility = facilityTotals.get(`${key}|${year}`) ?? 0;
      if (hosp !== facility) throw new Error(`payment.json.gz: ${key} ${year} has ${hosp} hospitalizations, facilities/ has ${facility}.`);
    });
  }
  console.log(`Hospital payment OK: ${keys.length} hospitals, ${(size / 1024).toFixed(1)} KiB.`);
}

// Umowy NFZ kart szpitali (scripts/build_nfz_contracts.py, API NFZ „Umowy”): każdy szpital z kartą ma umowy przynajmniej
// w jednym roku, a pozycje planu wskazują istniejące umowy i produkty.
{
  const keys = JSON.parse(await readFile("build-data/hospitals/index.json", "utf8")).pages.map(([key]) => key);
  const { size, data: contracts } = await readGzipJson("build-data/hospitals/contracts.json.gz");
  for (const key of keys) {
    const hospital = contracts.hospitals[key];
    if (!hospital) throw new Error(`contracts.json.gz: no contracts for ${key} (run scripts/build_nfz_contracts.py).`);
    // Lata bez umów są możliwe (np. świadczeniodawca od 2020 r.); pusta lista lat już nie.
    if (!hospital.years.length) throw new Error(`contracts.json.gz: ${key} has no agreements in any year.`);
    for (const [agreement, product] of hospital.plans) {
      if (!hospital.agreements[agreement] || !hospital.products[product]) throw new Error(`contracts.json.gz: ${key} plan points to a missing agreement or product.`);
    }
  }
  console.log(`NFZ contracts OK: ${keys.length} hospitals, ${(size / 1024).toFixed(1)} KiB.`);
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

// Placówki × lata (scripts/build_facility_years.py) i długość pobytu × lata (scripts/build_duration_years.py):
// suma hospitalizacji roku = suma faktów pliku roku.
for (const [folder, script] of [["facilities", "build_facility_years.py"], ["durations", "build_duration_years.py"]]) {
  const sections = (await readdir(path.join(DIR, folder))).filter((name) => name.endsWith(".json.gz"));
  if (!sections.length) throw new Error(`${folder}/ is empty (run scripts/${script}).`);
  const totals = new Map(index.years.map((year) => [year, 0]));
  let size = 0;
  for (const name of sections) {
    const file = await readGzipJson(path.join(DIR, folder, name));
    size += file.size;
    file.data.rows.year.forEach((year, i) => totals.set(index.years[year], totals.get(index.years[year]) + file.data.rows.hMin[i]));
    // Placówki: zgony w szpitalu do dymka mapy (format v2).
    if (folder === "facilities" && (file.data.version !== 2 || file.data.rows.dMin?.length !== file.data.rows.hMin.length || file.data.rows.dSim?.length !== file.data.rows.hMin.length)) {
      throw new Error(`${folder}/${name}: expected version 2 with dMin/dSim columns (run scripts/${script}).`);
    }
  }
  for (const year of [index.years[0], index.latestYear]) {
    const { data } = await readGzipJson(path.join(DIR, `${year}.json.gz`));
    const expected = data.facts.hMin.reduce((sum, value) => sum + value, 0);
    if (totals.get(year) !== expected) throw new Error(`${folder}/: ${year} sums to ${totals.get(year)} hospitalizations, year file has ${expected}.`);
  }
  console.log(`${folder} OK: ${sections.length} sections, ${(size / 1024).toFixed(0)} KiB.`);
}
{
  const facilityIndex = JSON.parse(await readFile(path.join(DIR, "facilities", "index.json"), "utf8"));
  if (facilityIndex.version !== 1 || facilityIndex.years.join() !== index.years.join() || facilityIndex.facilities.length !== facilityIndex.active.length) {
    throw new Error("facilities/index.json: wrong version, years or active list.");
  }
}

// Punkty miast na mapie eksploratora (scripts/build_cities_map.py): ten sam rzut co mapa województw.
{
  const { size, data: cities } = await readGzipJson("public/data/cities-map.json.gz");
  const { data: map } = await readGzipJson("public/data/regions-map.json.gz");
  if (cities.version !== 1 || cities.viewBox.join() !== map.viewBox.join()) throw new Error("cities-map.json.gz: wrong version or viewBox differs from regions-map.json.gz.");
  const codes = new Set(map.regions.map(([ow]) => ow));
  const bad = cities.cities.find(([name, ow, x, y, population]) => !name || !codes.has(ow) || !(x >= 0 && x <= cities.viewBox[0] && y >= 0 && y <= cities.viewBox[1]) || !(population > 0));
  if (bad) throw new Error(`cities-map.json.gz: invalid city ${JSON.stringify(bad)}.`);
  if (cities.cities.length < 300) throw new Error(`cities-map.json.gz: only ${cities.cities.length} cities.`);
  console.log(`Cities map OK: ${cities.cities.length} cities, ${(size / 1024).toFixed(1)} KiB.`);
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
