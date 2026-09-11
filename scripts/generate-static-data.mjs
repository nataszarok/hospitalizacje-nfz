import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data_exports", "supabase");
const OUTPUT = path.join(ROOT, "public", "data", "dashboard.json");

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
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, parseCsvLine(line)[i] ?? ""])));
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

await mkdir(path.dirname(OUTPUT), { recursive: true });
const out = createWriteStream(OUTPUT, "utf8");
out.write('{"version":1');
out.write(',"analysisYear":' + JSON.stringify(config.analysis_year || "2025"));
out.write(',"defaultProductCode":' + JSON.stringify(config.default_product_code || products[0]?.[0] || ""));
out.write(',"products":' + JSON.stringify(products));
out.write(',"regions":' + JSON.stringify(regions));
out.write(',"facilities":' + JSON.stringify(facilities));
out.write(',"populations":' + JSON.stringify(populations));
out.write(',"facts":[');

const input = createInterface({ input: createReadStream(path.join(DATA, "facility_product_duration_admission.csv")), crlfDelay: Infinity });
let headers = null;
let first = true;
let count = 0;
for await (const line of input) {
  if (!headers) { headers = parseCsvLine(line.replace(/^\uFEFF/, "")); continue; }
  if (!line) continue;
  const values = parseCsvLine(line);
  const r = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  // Compact array: region, nip, product, duration, admission, hospSim, hospMin, deathsSim, deathsMin
  const fact = [r.ow_nfz, r.nip, r.product_code, r.duration_group, String(r.admission_code ?? r.admission_mode ?? ""), Number(r.hosp_sim), Number(r.hosp_min), Number(r.deaths_sim), Number(r.deaths_min)];
  if (!first) out.write(',');
  out.write(JSON.stringify(fact));
  first = false; count++;
}
out.end(']}');
await new Promise((resolve, reject) => { out.on("finish", resolve); out.on("error", reject); });
console.log(`Generated ${OUTPUT} with ${count.toLocaleString("en-US")} fact rows.`);
