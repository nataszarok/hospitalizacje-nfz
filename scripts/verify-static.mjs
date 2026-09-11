import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile("public/data/dashboard.json", "utf8"));
if (!Array.isArray(data.facts) || data.facts.length === 0) throw new Error("Static dataset has no facts.");
if (!Array.isArray(data.products) || data.products.length === 0) throw new Error("Static dataset has no products.");
const E10 = "5.51.01.0005010";
const facilities = new Set(); let hospitalizations = 0;
for (const [ow,nip,product,,, ,hospMin] of data.facts) {
  if (product !== E10) continue;
  facilities.add(`${ow}|${nip}`); hospitalizations += hospMin;
}
if (facilities.size !== 143 || hospitalizations !== 8326) throw new Error(`E10 verification failed: ${facilities.size} facilities / ${hospitalizations} hospitalizations.`);
console.log(`Static dataset OK: ${data.facts.length.toLocaleString("en-US")} facts. E10: 143 facilities / 8326 hospitalizations.`);
