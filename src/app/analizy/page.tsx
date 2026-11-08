import type { Metadata } from "next";
import { AnalysisExplorer } from "@/components/explorer/AnalysisExplorer";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Eksplorator danych o hospitalizacjach | ${SITE_NAME}`,
  description: "Hospitalizacje według grup JGP: zmiany w czasie, świadczeniodawcy i śmiertelność, tryb przyjęcia i województwa.",
};

export default function AnalysesPage() {
  return <AnalysisExplorer />;
}
