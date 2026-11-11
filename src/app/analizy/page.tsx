import type { Metadata } from "next";
import { AnalysisExplorer } from "@/components/explorer/AnalysisExplorer";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Eksplorator danych o hospitalizacjach",
  description: "Hospitalizacje według grup JGP: zmiany w czasie, świadczeniodawcy i śmiertelność, tryb przyjęcia i województwa.",
  path: "/analizy",
});

export default function AnalysesPage() {
  return <AnalysisExplorer />;
}
