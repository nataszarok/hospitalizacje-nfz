import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Analizy | ${SITE_NAME}`,
  description: "Szczegółowe analizy hospitalizacji, śmiertelności, trybu przyjęć oraz szpitali.",
};

export default function AnalysesPage() {
  return <Dashboard />;
}
