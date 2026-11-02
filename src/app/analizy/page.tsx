import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Analizy hospitalizacji i szpitali | ${SITE_NAME}`,
  description: "Hospitalizacje, śmiertelność i tryb przyjęcia według grup JGP oraz profile i porównania szpitali publicznych.",
};

export default function AnalysesPage() {
  return <Dashboard />;
}
