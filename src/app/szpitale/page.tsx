import type { Metadata } from "next";
import { HospitalsPage } from "@/components/hospitals/HospitalsPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Szpitale publiczne | ${SITE_NAME}`,
  description: "Profil szpitala: oddziały, łóżka, świadczenia i wyniki finansowe oraz porównanie z grupą podobnych placówek.",
};

export default function HospitalsRoute() {
  return <HospitalsPage />;
}
