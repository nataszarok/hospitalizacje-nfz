import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { StaticDataset } from "@/lib/staticData";

// Odczyt zbioru podczas budowania strony (statyczny eksport). Tylko dla komponentów serwerowych.
export async function readStaticDatasetFromDisk(file = join(process.cwd(), "public", "data", "dashboard.json.gz")): Promise<StaticDataset> {
  return JSON.parse(gunzipSync(await readFile(file)).toString("utf8")) as StaticDataset;
}
