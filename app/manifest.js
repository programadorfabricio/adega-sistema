import fs from "node:fs";
import path from "node:path";

// Instalar como app (celular/computador). Nome e ícone vêm do deploy de cada adega.
const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";
const NOME = process.env.NEXT_PUBLIC_NOME_ADEGA || "Adega FH";
const CLARO = process.env.NEXT_PUBLIC_TEMA === "claro";

function icone(tam) {
  const proprio = `/icons/${SCHEMA}-${tam}.png`;
  return fs.existsSync(path.join(process.cwd(), "public", proprio)) ? proprio : `/icons/padrao-${tam}.png`;
}

export default function manifest() {
  return {
    name: NOME,
    short_name: NOME.length > 12 ? NOME.replace(/^Adega\s+/i, "") : NOME,
    description: "Caixa, estoque e delivery da adega",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: CLARO ? "#f4f2ec" : "#0a0900",
    theme_color: CLARO ? "#f4f2ec" : "#0a0900",
    lang: "pt-BR",
    icons: [
      { src: icone(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icone(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icone(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
