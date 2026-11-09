import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import fs from "node:fs";
import path from "node:path";

const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";
const ICONE_APPLE = fs.existsSync(path.join(process.cwd(), "public", "icons", `${SCHEMA}-apple.png`))
  ? `/icons/${SCHEMA}-apple.png` : "/icons/padrao-apple.png";

export const metadata = {
  title: process.env.NEXT_PUBLIC_NOME_ADEGA || "Adega FH",
  description: "Sistema de gestão para adega",
  // App instalado na tela inicial (iPhone usa o apple-touch-icon; Android usa o manifest)
  appleWebApp: { capable: true, title: process.env.NEXT_PUBLIC_NOME_ADEGA || "Adega FH", statusBarStyle: "black-translucent" },
  icons: { apple: ICONE_APPLE },
};

export const viewport = {
  themeColor: process.env.NEXT_PUBLIC_TEMA === "claro" ? "#f4f2ec" : "#0a0900",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
