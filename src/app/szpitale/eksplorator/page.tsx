import type { Metadata } from "next";
import { HospitalsPage } from "@/components/hospitals/HospitalsPage";
import { HOSPITAL_EXPLORER_PATH } from "@/lib/dashboardNavigation";
import { pageMetadata } from "@/lib/pageMetadata";

// Jedna strona dla wszystkich szpitali (`?hospital=`), więc jeden obraz podglądu: ogólny.
export const metadata: Metadata = pageMetadata({
  title: "Porównanie szpitali",
  description: "Porównanie szpitala z grupą podobnych placówek dobranych przez model par: hospitalizacje, oddziały, łóżka i finanse.",
  path: HOSPITAL_EXPLORER_PATH,
});

export default function HospitalsRoute() {
  return <HospitalsPage />;
}
