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
