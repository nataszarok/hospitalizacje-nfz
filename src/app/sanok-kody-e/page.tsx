import type { Metadata } from "next";
import { SanokCodesPage } from "@/components/sanok/SanokCodesPage";

export const metadata: Metadata = {
  title: "Kody E w Sanoku · Hospitalizacje w Polsce",
  description: "Hospitalizacje z kodami JGP z grupy E w dwóch placówkach w Sanoku: liczba i udział pobytów 6+ dni.",
};

export default function SanokCodesRoute() {
  return <SanokCodesPage />;
}
