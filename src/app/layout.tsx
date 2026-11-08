import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import "../styles/portal.css";
import { SiteHeader } from "@/components/portal/SiteHeader";
import { SITE_NAME } from "@/lib/site";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";

// Krój tekstu (font zmienny, wszystkie grubości): zmienna --font-body.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-body",
});

// Krój tytułów portalu (lekki, ciasny): zmienna --font-display.
const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Portal o publicznej ochronie zdrowia: hospitalizacje, szpitale publiczne, wyceny JGP i artykuły na podstawie danych NFZ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // `data-scroll-behavior`: płynne przewijanie tylko do kotwic na stronie, zmiana strony bez animacji.
    <html lang="pl" data-scroll-behavior="smooth" {...mantineHtmlProps}>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body className={`${inter.className} ${inter.variable} ${interTight.variable}`} suppressHydrationWarning>
        <MantineProvider
          defaultColorScheme="light"
          theme={{
            fontFamily: inter.style.fontFamily,
            headings: { fontFamily: interTight.style.fontFamily, fontWeight: "400" },
            // Kolor interfejsu = zieleń portalu (--color-primary); niebieski zostaje dla danych na wykresach.
            colors: { atlas: ["#E9F6F2", "#D3EDE6", "#A6DBCD", "#75C8B3", "#4DB79E", "#2AA58A", "#0F937F", "#087F75", "#076B63", "#055850"] },
            primaryColor: "atlas",
            primaryShade: 7,
          }}
        >
          <div className="atlas-portal">
            <SiteHeader />
            {children}
          </div>
        </MantineProvider>
      </body>
    </html>
  );
}
