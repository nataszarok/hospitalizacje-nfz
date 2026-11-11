import type { Metadata } from "next";
import { HospitalsPage } from "@/components/hospitals/HospitalsPage";
import { pageMetadata } from "@/lib/pageMetadata";

// Jedna strona dla wszystkich szpitali (`?hospital=`), więc jeden obraz podglądu: ogólny.
// Karta szpitala z własną ścieżką dostanie obraz z `renderPreviewPng` (jak `/og/jgp/<KOD>.png`).
export const metadata: Metadata = pageMetadata({
  title: "Szpitale publiczne",
  description: "Profil szpitala: oddziały, łóżka, świadczenia i wyniki finansowe oraz porównanie z grupą podobnych placówek.",
  path: "/szpitale",
});

export default function HospitalsRoute() {
  return <HospitalsPage />;
}
