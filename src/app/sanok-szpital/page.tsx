import type { Metadata } from "next";
import { SanokHospitalPage } from "@/components/sanok/SanokHospitalPage";

export const metadata: Metadata = {
  title: "SP ZOZ w Sanoku · Hospitalizacje w Polsce",
  description: "Wszystkie kody JGP SP ZOZ w Sanoku: oddziały, pacjenci, hospitalizacje i wartość rozliczonych świadczeń.",
};

export default function SanokHospitalRoute() {
  return <SanokHospitalPage />;
}
