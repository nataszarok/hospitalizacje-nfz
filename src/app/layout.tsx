import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import "../styles/portal.css";
import { SiteHeader } from "@/components/portal/SiteHeader";
import { SITE_NAME } from "@/lib/site";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Portal o publicznej ochronie zdrowia: hospitalizacje, szpitale publiczne, wyceny JGP i artykuły na podstawie danych NFZ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" {...mantineHtmlProps}>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body className={inter.className} suppressHydrationWarning>
        <MantineProvider
          defaultColorScheme="light"
          theme={{
            fontFamily: inter.style.fontFamily,
            headings: { fontFamily: inter.style.fontFamily },
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
