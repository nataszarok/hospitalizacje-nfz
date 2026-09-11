import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data_exports", "supabase");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const OUTPUT = path.join(OUTPUT_DIR, "dashboard.json.gz");

function parseCsvLine(line) {
  const out = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { out.push(value); value = ""; }
    else value += c;
  }
  out.push(value);
  return out;
}

async function readCsv(name) {
  const text = await readFile(path.join(DATA, name), "utf8");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

const [configRows, productRows, regionRows, facilityRows, populationRows] = await Promise.all([
  readCsv("app_config.csv"), readCsv("products.csv"), readCsv("nfz_regions.csv"),
  readCsv("facilities.csv"), readCsv("population_voivodeship.csv"),
]);
const config = Object.fromEntries(configRows.map((r) => [r.key, r.value]));
const products = productRows.map((r) => [r.product_code, r.jgp_code || null, r.product_name || null]);
const regions = regionRows.sort((a,b) => Number(a.sort_order)-Number(b.sort_order)).map((r) => [r.ow_nfz, r.voivodeship]);
const facilities = facilityRows.map((r) => [r.ow_nfz, r.nip, r.provider_name, r.city || ""]);
const populations = populationRows.map((r) => [r.ow_nfz, Number(r.population)]);

const facts = [];
const input = createInterface({
  input: createReadStream(path.join(DATA, "facility_product_duration_admission.csv")),
  crlfDelay: Infinity,
});
let headers = null;
for await (const line of input) {
  if (!headers) { headers = parseCsvLine(line.replace(/^\uFEFF/, "")); continue; }
  if (!line) continue;
  const values = parseCsvLine(line);
  const r = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  facts.push([
    r.ow_nfz, r.nip, r.product_code, r.duration_group,
    String(r.admission_code ?? r.admission_mode ?? ""),
    Number(r.hosp_sim), Number(r.hosp_min), Number(r.deaths_sim), Number(r.deaths_min),
  ]);
}

const dataset = {
  version: 1,
  analysisYear: config.analysis_year || "2025",
  defaultProductCode: config.default_product_code || products[0]?.[0] || "",
  products,
  regions,
  facilities,
  populations,
  facts,
};

await mkdir(OUTPUT_DIR, { recursive: true });
for (const name of await readdir(OUTPUT_DIR)) {
  if (name === "dashboard.json" || /^dashboard-facts-\d+\.json$/.test(name)) {
    await rm(path.join(OUTPUT_DIR, name), { force: true });
  }
}

const json = JSON.stringify(dataset);
const gz = gzipSync(Buffer.from(json), { level: 9 });
await writeFile(OUTPUT, gz);

console.log(`Generated ${OUTPUT} with ${facts.length.toLocaleString("en-US")} fact rows.`);
console.log(`Compressed size: ${(gz.length / 1024 / 1024).toFixed(2)} MiB.`);
