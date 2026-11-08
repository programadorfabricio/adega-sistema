import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cada adega usa um schema próprio no mesmo projeto Supabase.
// Defina NEXT_PUBLIC_SUPABASE_SCHEMA no deploy de cada cliente (padrão: public).
export const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: SCHEMA } });

// ─── MARCA DO CLIENTE ─────────────────────────────────────
// Configurável por deploy, sem mexer no código.
export const MARCA = {
  nome: process.env.NEXT_PUBLIC_NOME_ADEGA || "Adega FH",
  // Logo: NEXT_PUBLIC_LOGO_URL ou, por padrão, public/logos/<schema>.png
  logo: process.env.NEXT_PUBLIC_LOGO_URL || (SCHEMA !== "public" ? `/logos/${SCHEMA}.png` : ""),
  emoji: process.env.NEXT_PUBLIC_EMOJI || "🍺",
};

// Telas escondidas neste cliente, ex: NEXT_PUBLIC_OCULTAR_PAGINAS=comandas
export const PAGINAS_OCULTAS = (process.env.NEXT_PUBLIC_OCULTAR_PAGINAS || "").split(",").map(s => s.trim()).filter(Boolean);

// Produtos preparados na hora (copão, drinks, combos) não controlam estoque
export const semEstoque = (p) => p?.controla_estoque === false;

// Lista curta de nomes pros alertas ("A, B, C e mais 12")
export const resumoNomes = (lista, max = 6) => {
  const nomes = lista.map(p => p.nome);
  return nomes.length <= max ? nomes.join(", ") : `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
};

// ─── APARÊNCIA (por cliente, no deploy da Vercel) ─────────
// NEXT_PUBLIC_TEMA=claro          → fundo claro (padrão: escuro)
// NEXT_PUBLIC_ESCALA=1.15         → letras e botões maiores (0.8 a 1.5)
// NEXT_PUBLIC_HORARIOS=1          → hora em cada item lançado na comanda
// NEXT_PUBLIC_CARRINHO_LARGO=1    → carrinho da Venda Rápida mais largo
export const TEMA = process.env.NEXT_PUBLIC_TEMA === "claro" ? "claro" : "escuro";
export const ESCALA = Math.min(1.5, Math.max(0.8, Number(process.env.NEXT_PUBLIC_ESCALA) || 1));
export const MOSTRAR_HORARIOS = process.env.NEXT_PUBLIC_HORARIOS === "1";
export const CARRINHO_LARGO = process.env.NEXT_PUBLIC_CARRINHO_LARGO === "1";
// NEXT_PUBLIC_PEDIDO_ONLINE=1      → página /pedir e pedidos online no Delivery
export const PEDIDO_ONLINE = process.env.NEXT_PUBLIC_PEDIDO_ONLINE === "1";
// NEXT_PUBLIC_LOGIN_LOJA=1         → pede a conta da loja (e-mail/senha) antes do PIN e confere o PIN no banco
//                                    (obrigatório antes de trancar o banco da adega com supabase/trava.sql)
export const LOGIN_LOJA = process.env.NEXT_PUBLIC_LOGIN_LOJA === "1";

const ACCENT = process.env.NEXT_PUBLIC_COR_DESTAQUE || (TEMA === "claro" ? "#d97706" : "#f5c000");
const hexToRgba = (hex, a) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ─── CORES ────────────────────────────────────────────────
const ESCURO = {
  bg: "#0a0900",
  card: "#131200",
  card2: "#1a1800",
  border: "#2a2700",
  accentDark: "#c49a00",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  text: "#f5f0e0",
  muted: "#7a7560",
  esgotado: "#111100",
  overlay: "rgba(0,0,0,0.85)",
};
const CLARO = {
  bg: "#f4f2ec",
  card: "#ffffff",
  card2: "#f3f0e8",
  border: "#ddd7c6",
  accentDark: "#b45309",
  green: "#16a34a",
  red: "#dc2626",
  blue: "#2563eb",
  text: "#1f1c14",
  muted: "#6b6452",
  esgotado: "#ebe8df",
  overlay: "rgba(30,25,10,0.55)",
};
export const C = {
  ...(TEMA === "claro" ? CLARO : ESCURO),
  accent: ACCENT,
  accentBg: hexToRgba(ACCENT, TEMA === "claro" ? 0.12 : 0.08),
};

// ─── UTILS ────────────────────────────────────────────────
export const fmt = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const today = () => new Date().toISOString().split("T")[0];
export const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ─── ESTILOS BASE ─────────────────────────────────────────
export const base = {
  input: {
    background: C.card2,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    color: C.text,
    fontSize: 14,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    background: C.card2,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    color: C.text,
    fontSize: 14,
    width: "100%",
    outline: "none",
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 20,
  },
  btn: (bg = ACCENT, color = "#000") => ({
    background: bg,
    color,
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  }),
  btnSm: (bg = ACCENT, color = "#000") => ({
    background: bg,
    color,
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  }),
  btnOutline: {
    background: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 18px",
    color: C.muted,
    fontSize: 14,
    cursor: "pointer",
  },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, display: "block" },
  tag: (color) => ({
    background: `${color}20`,
    color,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 100,
    display: "inline-block",
    letterSpacing: "0.05em",
  }),
  th: {
    textAlign: "left",
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    padding: "10px 14px",
    borderBottom: `1px solid ${C.border}`,
  },
  td: {
    padding: "12px 14px",
    fontSize: 14,
    borderBottom: `1px solid ${C.border}${TEMA === "claro" ? "" : "20"}`,
    color: C.text,
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: C.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalBox: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 28,
    width: "100%",
    maxWidth: 480,
    maxHeight: `${Math.round(90 / ESCALA)}vh`,
    overflowY: "auto",
  },
  row: { display: "flex", gap: 10, alignItems: "center" },
  pageTitle: { fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 12,
  },
  alert: (color = C.red) => ({
    background: `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 16,
    fontSize: 13,
    color,
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
};

// ─── PAGES CONFIG ─────────────────────────────────────────
export const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "📊", group: "PRINCIPAL", cargos: ["admin", "gerente"] },
  { id: "comandas", label: "Comandas", icon: "🍺", group: "PRINCIPAL", cargos: ["admin", "gerente", "atendente"] },
  { id: "venda", label: "Venda Rápida", icon: "⚡", group: "PRINCIPAL", cargos: ["admin", "gerente", "atendente"] },
  { id: "delivery", label: "Delivery", icon: "🛵", group: "PRINCIPAL", cargos: ["admin", "gerente", "atendente"] },
  { id: "caixa", label: "Caixa", icon: "🧾", group: "PRINCIPAL", cargos: ["admin", "gerente", "atendente"] },
  { id: "estoque", label: "Estoque", icon: "📦", group: "GESTÃO", cargos: ["admin", "gerente"] },
  // requer: só aparece se a loja tiver essa tabela (módulo ativado no banco)
  { id: "compras", label: "Compras", icon: "🚚", group: "GESTÃO", cargos: ["admin", "gerente"], requer: "compras" },
  { id: "financeiro", label: "Financeiro", icon: "💰", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "historico", label: "Histórico", icon: "📋", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "relatorios", label: "Relatórios", icon: "📈", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "configuracoes", label: "Configurações", icon: "⚙️", group: "SISTEMA", cargos: ["admin"] },
];