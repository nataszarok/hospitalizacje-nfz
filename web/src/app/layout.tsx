import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";

export const metadata: Metadata = {
  title: "Hospitalizacje w Polsce",
  description: "Analiza wolumenu, śmiertelności i trybu przyjęcia · NFZ 2025",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" {...mantineHtmlProps}>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body><MantineProvider defaultColorScheme="light">{children}</MantineProvider></body>
    </html>
  );
}
