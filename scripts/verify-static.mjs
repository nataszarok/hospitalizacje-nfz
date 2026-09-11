import { readFile, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const FILE = "public/data/dashboard.json.gz";
const MAX_PAGES_FILE_BYTES = 25 * 1024 * 1024;
const E10 = "5.51.01.0005010";

const size = (await stat(FILE)).size;
if (size > MAX_PAGES_FILE_BYTES) {
  throw new Error(`dashboard.json.gz exceeds Cloudflare Pages 25 MiB limit: ${(size / 1024 / 1024).toFixed(2)} MiB.`);
}

const compressed = await readFile(FILE);
const dataset = JSON.parse(gunzipSync(compressed).toString("utf8"));

if (!Array.isArray(dataset.facts) || dataset.facts.length === 0) throw new Error("Static dataset has no facts.");
if (!Array.isArray(dataset.products) || dataset.products.length === 0) throw new Error("Static dataset has no products.");

const facilities = new Set();
let hospitalizations = 0;
for (const [ow,nip,product,,, ,hospMin] of dataset.facts) {
  if (product !== E10) continue;
  facilities.add(`${ow}|${nip}`);
  hospitalizations += hospMin;
}

if (facilities.size !== 143 || hospitalizations !== 8326) {
  throw new Error(`E10 verification failed: ${facilities.size} facilities / ${hospitalizations} hospitalizations.`);
}

console.log(`Static dataset OK: ${dataset.facts.length.toLocaleString("en-US")} facts. E10: 143 facilities / 8326 hospitalizations.`);
console.log(`Cloudflare asset size OK: ${(size / 1024 / 1024).toFixed(2)} MiB.`);
