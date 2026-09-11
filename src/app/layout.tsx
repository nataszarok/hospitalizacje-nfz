import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hospitalizacje w Polsce",
  description: "Analiza liczby hospitalizacji, śmiertelności i trybu przyjęcia · NFZ 2025",
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
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
