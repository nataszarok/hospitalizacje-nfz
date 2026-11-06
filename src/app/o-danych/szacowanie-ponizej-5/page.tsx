import type { Metadata } from "next";
import { Below5MethodPage } from "@/components/about/Below5MethodPage";
import { SITE_NAME } from "@/lib/site";
import { readCalibrationSummariesFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `Szacowanie wartości <5 | ${SITE_NAME}`,
  description: "Metoda kalibrowana szacowania ukrytych wartości <5 w danych NFZ o hospitalizacjach: źródła, wzory, kontrola i ograniczenia.",
};

export default async function Below5MethodRoute() {
  return <Below5MethodPage summaries={await readCalibrationSummariesFromDisk()} />;
}
