import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── CORES ────────────────────────────────────────────────
export const C = {
  bg: "#0a0900",
  card: "#131200",
  card2: "#1a1800",
  border: "#2a2700",
  accent: "#f5c000",
  accentDark: "#c49a00",
  accentBg: "rgba(245,192,0,0.08)",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  text: "#f5f0e0",
  muted: "#7a7560",
};

// ─── UTILS ────────────────────────────────────────────────
export const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
export const today = () => new Date().toISOString().split("T")[0];
export const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ─── ESTILOS BASE ─────────────────────────────────────────
export const base = {
  input: {
    background: "#1a1800",
    border: `1px solid #2a2700`,
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f5f0e0",
    fontSize: 14,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    background: "#1a1800",
    border: `1px solid #2a2700`,
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f5f0e0",
    fontSize: 14,
    width: "100%",
    outline: "none",
  },
  card: {
    background: "#131200",
    border: `1px solid #2a2700`,
    borderRadius: 16,
    padding: 20,
  },
  btn: (bg = "#f5c000", color = "#000") => ({
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
  btnSm: (bg = "#f5c000", color = "#000") => ({
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
    border: `1px solid #2a2700`,
    borderRadius: 8,
    padding: "10px 18px",
    color: "#7a7560",
    fontSize: 14,
    cursor: "pointer",
  },
  label: { fontSize: 12, color: "#7a7560", marginBottom: 4, display: "block" },
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
    color: "#7a7560",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    padding: "10px 14px",
    borderBottom: `1px solid #2a2700`,
  },
  td: {
    padding: "12px 14px",
    fontSize: 14,
    borderBottom: `1px solid #2a270020`,
    color: "#f5f0e0",
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalBox: {
    background: "#131200",
    border: `1px solid #2a2700`,
    borderRadius: 18,
    padding: 28,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  row: { display: "flex", gap: 10, alignItems: "center" },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#f5f0e0", marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#7a7560",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 12,
  },
  alert: (color = "#ef4444") => ({
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
  { id: "estoque", label: "Estoque", icon: "📦", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "financeiro", label: "Financeiro", icon: "💰", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "historico", label: "Histórico", icon: "📋", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "relatorios", label: "Relatórios", icon: "📈", group: "GESTÃO", cargos: ["admin", "gerente"] },
  { id: "configuracoes", label: "Configurações", icon: "⚙️", group: "SISTEMA", cargos: ["admin"] },
];