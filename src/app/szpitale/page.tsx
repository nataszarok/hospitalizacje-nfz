import type { Metadata } from "next";
import { HospitalCatalogPage } from "@/components/hospitals/HospitalCatalogPage";
import { buildHospitalCatalog } from "@/lib/hospitalCatalog";
import { pageMetadata } from "@/lib/pageMetadata";
import {
  readFacilityYearsFromDisk, readFinancialResultsFromDisk, readHospitalProfilesFromDisk, readPszLevelsFromDisk, readRegionsMapFromDisk,
} from "@/lib/staticDataServer";

export const metadata: Metadata = pageMetadata({
  title: "Szpitale",
  description: "Katalog szpitali i świadczeniodawców z umową z NFZ: hospitalizacje w kolejnych latach, zmiana rok do roku, śmiertelność, łóżka i sieć szpitali. Dane NFZ i RPWDL.",
  path: "/szpitale",
});

export default async function HospitalCatalogRoute() {
  const [{ index, sections }, psz, profiles, financial, map] = await Promise.all([
    readFacilityYearsFromDisk(), readPszLevelsFromDisk(), readHospitalProfilesFromDisk(), readFinancialResultsFromDisk(), readRegionsMapFromDisk(),
  ]);
  const regions = Object.fromEntries((map?.regions ?? []).map(([ow, name]) => [ow, name]));
  return <HospitalCatalogPage catalog={buildHospitalCatalog({ index, sections, psz: psz.byNip, pszLevels: psz.levels, profiles, financial, regions })} />;
}
