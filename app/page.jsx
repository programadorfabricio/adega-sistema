"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hkonlaamribaopfvwcps.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhrb25sYWFtcmliYW9wZnZ3Y3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzcwNjksImV4cCI6MjA5MzI1MzA2OX0.NMjf92ryAbVG2Owr_L3Jxq25htt-Fem_i1tKTxXigN4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── TEMA ────────────────────────────────────────────────
const C = {
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
  white: "#ffffff",
};

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const today = () => new Date().toISOString().split("T")[0];
const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ─── ESTILOS BASE ────────────────────────────────────────
const base = {
  input: {
    background: "#1a1800",
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
    background: "#1a1800",
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
  btn: (bg = C.accent, color = "#000") => ({
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
  btnSm: (bg = C.accent, color = "#000") => ({
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
    borderBottom: `1px solid ${C.border}20`,
    color: C.text,
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
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 28,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
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

// ─── SIDEBAR ────────────────────────────────────────────
const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "📊", group: "PRINCIPAL", cargos: ["admin","gerente"] },
  { id: "comandas", label: "Comandas", icon: "🍺", group: "PRINCIPAL", cargos: ["admin","gerente","atendente"] },
  { id: "venda", label: "Venda Rápida", icon: "⚡", group: "PRINCIPAL", cargos: ["admin","gerente","atendente"] },
  { id: "estoque", label: "Estoque", icon: "📦", group: "GESTÃO", cargos: ["admin","gerente"] },
  { id: "financeiro", label: "Financeiro", icon: "💰", group: "GESTÃO", cargos: ["admin","gerente"] },
  { id: "historico", label: "Histórico", icon: "📋", group: "GESTÃO", cargos: ["admin","gerente"] },
  { id: "relatorios", label: "Relatórios", icon: "📈", group: "GESTÃO", cargos: ["admin","gerente"] },
  { id: "configuracoes", label: "Configurações", icon: "⚙️", group: "SISTEMA", cargos: ["admin"] },
];

// ─── TELA DE LOGIN ───────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("usuarios").select("*").eq("ativo", true).order("nome")
      .then(({ data }) => { setUsuarios(data || []); setLoading(false); });
  }, []);

  const digitarPin = (num) => {
    if (pin.length >= 4) return;
    const novo = pin + num;
    setPin(novo);
    setErro("");
    if (novo.length === 4) verificarPin(novo);
  };

  const verificarPin = (p) => {
    const user = selecionado;
    if (!user) return;
    if (user.pin === p) {
      onLogin(user);
    } else {
      setErro("PIN incorreto. Tente novamente.");
      setTimeout(() => setPin(""), 600);
    }
  };

  const voltar = () => { setSelecionado(null); setPin(""); setErro(""); };

  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.muted }}>Carregando...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🍺</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, letterSpacing: "-0.02em" }}>Adega</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Sistema de Gestão</div>
        </div>

        {!selecionado ? (
          /* Seleção de usuário */
          <div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 20 }}>Quem está acessando?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {usuarios.map(u => (
                <button key={u.id} onClick={() => setSelecionado(u)} style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "16px 20px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "border-color 0.2s",
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${cargoCor[u.cargo] || C.muted}20`, border: `1px solid ${cargoCor[u.cargo] || C.muted}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {u.cargo === "admin" ? "👑" : u.cargo === "gerente" ? "🔑" : "👤"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{u.nome}</div>
                    <div style={{ fontSize: 12 }}><span style={{ ...base.tag(cargoCor[u.cargo] || C.muted) }}>{u.cargo}</span></div>
                  </div>
                  <div style={{ marginLeft: "auto", color: C.muted, fontSize: 18 }}>›</div>
                </button>
              ))}
              {usuarios.length === 0 && (
                <div style={{ ...base.card, textAlign: "center", color: C.muted, padding: 32 }}>
                  Nenhum usuário cadastrado.<br />
                  <span style={{ fontSize: 12 }}>Cadastre usuários em Configurações.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Teclado PIN */
          <div>
            <button onClick={voltar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
              ← Trocar usuário
            </button>

            <div style={{ ...base.card, textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{selecionado.cargo === "admin" ? "👑" : selecionado.cargo === "gerente" ? "🔑" : "👤"}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{selecionado.nome}</div>
              <div style={{ marginTop: 4 }}><span style={base.tag(cargoCor[selecionado.cargo] || C.muted)}>{selecionado.cargo}</span></div>
            </div>

            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 16 }}>Digite seu PIN</div>

            {/* Indicador de dígitos */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 28 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: i < pin.length ? C.accent : "transparent",
                  border: `2px solid ${i < pin.length ? C.accent : C.border}`,
                  transition: "all 0.15s",
                }} />
              ))}
            </div>

            {erro && <div style={{ ...base.alert(C.red), marginBottom: 16, justifyContent: "center" }}>{erro}</div>}

            {/* Teclado numérico */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => digitarPin(String(n))} style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "20px",
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.text,
                  cursor: "pointer",
                  transition: "background 0.1s, border-color 0.1s",
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  {n}
                </button>
              ))}
              <div />
              <button onClick={() => digitarPin("0")} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "20px", fontSize: 22,
                fontWeight: 700, color: C.text, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
              }}>0</button>
              <button onClick={() => setPin(p => p.slice(0,-1))} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "20px", fontSize: 18,
                color: C.muted, cursor: "pointer",
              }}>⌫</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, open, setOpen, usuario, onLogout }) {
  const pages = PAGES.filter(p => p.cargos.includes(usuario?.cargo));
  const groups = [...new Set(pages.map(p => p.group))];
  const navigate = (id) => { setPage(id); setOpen(false); };
  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  return (
    <>
      <style>{`
        .sidebar { width: 260px; position: relative; left: 0; }
        .topbar { display: none; }
        .overlay { display: none; }
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; height: 100vh;
            transform: translateX(${open ? "0" : "-100%"});
            transition: transform 0.28s ease;
            z-index: 50;
            width: 260px !important;
          }
          .overlay { display: ${open ? "block" : "none"}; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 40; }
          .topbar { display: flex !important; }
          .main-content { padding: 16px !important; padding-top: 70px !important; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div className="overlay" onClick={() => setOpen(false)} />

      <div className="sidebar" style={{
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0, minHeight: "100vh",
      }}>
        <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 2 }}>🍺</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.accent }}>Adega</div>
            <div style={{ fontSize: 11, color: C.muted }}>Sistema de Gestão</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Usuário logado */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cargoCor[usuario?.cargo] || C.muted}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {usuario?.cargo === "admin" ? "👑" : usuario?.cargo === "gerente" ? "🔑" : "👤"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario?.nome}</div>
            <span style={base.tag(cargoCor[usuario?.cargo] || C.muted)}>{usuario?.cargo}</span>
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.15em", padding: "16px 24px 6px", textTransform: "uppercase" }}>{group}</div>
              {pages.filter(p => p.group === group).map(p => {
                const active = page === p.id;
                return (
                  <button key={p.id} onClick={() => navigate(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", padding: "12px 24px",
                    background: active ? C.accentBg : "transparent",
                    borderLeft: `3px solid ${active ? C.accent : "transparent"}`,
                    border: "none", borderLeftWidth: 3, borderLeftStyle: "solid",
                    borderLeftColor: active ? C.accent : "transparent",
                    color: active ? C.accent : C.muted,
                    fontSize: 14, fontWeight: active ? 700 : 400,
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 17 }}>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={onLogout} style={{ ...base.btnOutline, width: "100%", fontSize: 13, color: C.red, borderColor: `${C.red}40` }}>
            🚪 Sair
          </button>
        </div>
      </div>
    </>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────
function Dashboard({ setPage }) {
  const [stats, setStats] = useState({ vendasHoje: 0, totalHoje: 0, estoqueBaixo: 0, saldoMes: 0, comandasAbertas: 0 });
  const [recentes, setRecentes] = useState([]);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    async function load() {
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
      const mesAtual = today().slice(0, 7) + "-01";

      const [{ data: vendas }, { data: produtos }, { data: fin }, { data: comandas }, { data: ultimasVendas }] = await Promise.all([
        supabase.from("vendas").select("*").gte("created_at", inicioHoje.toISOString()).eq("status", "concluida"),
        supabase.from("produtos").select("*").eq("ativo", true),
        supabase.from("financeiro").select("*").gte("data", mesAtual),
        supabase.from("comandas").select("*").eq("status", "aberta"),
        supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(5),
      ]);

      const esgotados = (produtos || []).filter(p => p.estoque_atual === 0);
      const estoqueBaixo = (produtos || []).filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);
      const totalHoje = (vendas || []).reduce((a, v) => a + Number(v.total), 0);
      const entradas = (fin || []).filter(f => f.tipo === "entrada").reduce((a, f) => a + Number(f.valor), 0);
      const saidas = (fin || []).filter(f => f.tipo === "saida").reduce((a, f) => a + Number(f.valor), 0);

      setStats({ vendasHoje: vendas?.length || 0, totalHoje, estoqueBaixo: estoqueBaixo.length, esgotados: esgotados.length, saldoMes: entradas - saidas, comandasAbertas: comandas?.length || 0 });
      setRecentes(ultimasVendas || []);
      setAlertas([...esgotados, ...estoqueBaixo]);
    }
    load();

    const channel = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro" }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const cards = [
    { label: "Comandas Abertas", val: stats.comandasAbertas, color: C.accent, icon: "🍺", action: () => setPage("comandas") },
    { label: "Vendas Hoje", val: stats.vendasHoje, color: C.blue, icon: "⚡" },
    { label: "Faturamento Hoje", val: fmt(stats.totalHoje), color: C.green, icon: "💵" },
    { label: "Esgotados", val: stats.esgotados || 0, color: stats.esgotados > 0 ? "#a855f7" : C.green, icon: "🚫", action: () => setPage("estoque") },
    { label: "Estoque Baixo", val: stats.estoqueBaixo, color: stats.estoqueBaixo > 0 ? C.red : C.green, icon: "📦", action: () => setPage("estoque") },
  ];

  return (
    <div>
      <div style={base.pageTitle}>Dashboard</div>

      {alertas.filter(p => p.estoque_atual === 0).length > 0 && (
        <div style={base.alert("#a855f7")}>
          🚫 <strong>{alertas.filter(p => p.estoque_atual === 0).length} produto(s) esgotado(s):</strong> {alertas.filter(p => p.estoque_atual === 0).map(p => p.nome).join(", ")}
        </div>
      )}
      {alertas.filter(p => p.estoque_atual > 0).length > 0 && (
        <div style={base.alert(C.red)}>
          ⚠️ <strong>{alertas.filter(p => p.estoque_atual > 0).length} produto(s) com estoque baixo:</strong> {alertas.filter(p => p.estoque_atual > 0).map(p => p.nome).join(", ")}
        </div>
      )}

      <div className="grid-5col" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={c.action} style={{
            ...base.card,
            cursor: c.action ? "pointer" : "default",
            borderColor: c.action ? `${C.accent}30` : C.border,
            transition: "border-color 0.2s",
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={base.card}>
        <div style={base.sectionTitle}>Últimas Vendas</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Horário</th>
              <th style={base.th}>Pagamento</th>
              <th style={base.th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {recentes.map(v => (
              <tr key={v.id}>
                <td style={base.td}>{hora(v.created_at)}</td>
                <td style={base.td}><span style={base.tag(C.accent)}>{v.forma_pagamento || "—"}</span></td>
                <td style={{ ...base.td, color: C.green, fontWeight: 700 }}>{fmt(v.total)}</td>
              </tr>
            ))}
            {recentes.length === 0 && <tr><td colSpan={3} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda hoje</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Acesso Rápido */}
      <div style={{ ...base.card, marginTop: 16 }}>
        <div style={base.sectionTitle}>⚡ Acesso Rápido</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { label: "Comandas", icon: "🍺", page: "comandas", cor: C.accent },
            { label: "Venda Rápida", icon: "⚡", page: "venda", cor: C.blue },
            { label: "Estoque", icon: "📦", page: "estoque", cor: "#f97316" },
            { label: "Financeiro", icon: "💰", page: "financeiro", cor: C.green },
            { label: "Relatórios", icon: "📈", page: "relatorios", cor: "#a855f7" },
            { label: "Configurações", icon: "⚙️", page: "configuracoes", cor: C.muted },
          ].map(item => (
            <button key={item.page} onClick={() => setPage(item.page)} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: C.card2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "10px 16px",
              color: C.text, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.cor; e.currentTarget.style.background = `${item.cor}15`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card2; }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MODAL FECHAR CONTA ──────────────────────────────────
function ModalFecharConta({ selected, totalComanda, pagamento, setPagamento, loading, onConfirmar, onCancelar }) {
  const [modo, setModo] = useState("total");
  const [numPessoas, setNumPessoas] = useState(2);
  const [pessoasPagamento, setPessoasPagamento] = useState([
    { nome: "Pessoa 1", forma: "pix", valor: "" },
    { nome: "Pessoa 2", forma: "pix", valor: "" },
  ]);

  const formas = [
    { value: "pix", label: "PIX", cor: C.blue },
    { value: "dinheiro", label: "Dinheiro", cor: C.green },
    { value: "cartao_debito", label: "Débito", cor: "#a855f7" },
    { value: "cartao_credito", label: "Crédito", cor: "#f97316" },
  ];

  const aplicarDivisao = (n) => {
    setNumPessoas(n);
    const valorIgual = (totalComanda / n).toFixed(2);
    setPessoasPagamento(Array.from({ length: n }, (_, i) => ({
      nome: `Pessoa ${i + 1}`,
      forma: "pix",
      valor: valorIgual,
    })));
  };

  const updatePessoa = (i, campo, val) => {
    setPessoasPagamento(p => p.map((x, idx) => idx === i ? { ...x, [campo]: val } : x));
  };

  const totalDividido = pessoasPagamento.reduce((a, p) => a + Number(p.valor || 0), 0);
  const diferenca = totalComanda - totalDividido;

  return (
    <div style={base.modal}>
      <div style={{ ...base.modalBox, maxWidth: 520 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 16 }}>💰 Fechar Conta</div>

        {/* Info */}
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>Cliente</div>
            <div style={{ fontWeight: 700 }}>👤 {selected?.nome_cliente}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.muted }}>Total</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.accent }}>{fmt(totalComanda)}</div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ id: "total", label: "💳 Pagar Total" }, { id: "dividir", label: "🤝 Dividir Conta" }].map(tab => (
            <button key={tab.id} onClick={() => { setModo(tab.id); if (tab.id === "dividir") aplicarDivisao(2); }} style={{
              flex: 1, padding: "10px", borderRadius: 10,
              border: `2px solid ${modo === tab.id ? C.accent : C.border}`,
              background: modo === tab.id ? C.accentBg : C.card2,
              color: modo === tab.id ? C.accent : C.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* MODO TOTAL */}
        {modo === "total" && (
          <div style={{ marginBottom: 16 }}>
            <label style={base.label}>Forma de Pagamento</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {formas.map(f => (
                <button key={f.value} onClick={() => setPagamento(f.value)} style={{
                  padding: "10px 0", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12,
                  border: `2px solid ${pagamento === f.value ? f.cor : C.border}`,
                  background: pagamento === f.value ? `${f.cor}20` : C.card2,
                  color: pagamento === f.value ? f.cor : C.muted,
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* MODO DIVIDIR */}
        {modo === "dividir" && (
          <div style={{ marginBottom: 16 }}>
            {/* Botões rápidos */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Quantas pessoas?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => aplicarDivisao(n)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 15,
                    border: `2px solid ${numPessoas === n ? C.accent : C.border}`,
                    background: numPessoas === n ? C.accentBg : "transparent",
                    color: numPessoas === n ? C.accent : C.muted,
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Lista de pessoas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 10 }}>
              {pessoasPagamento.map((p, i) => (
                <div key={i} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8, alignItems: "end" }}>
                    <div>
                      <label style={base.label}>Nome</label>
                      <input style={base.input} value={p.nome} onChange={e => updatePessoa(i, "nome", e.target.value)} />
                    </div>
                    <div>
                      <label style={base.label}>Pagamento</label>
                      <select style={base.select} value={p.forma} onChange={e => updatePessoa(i, "forma", e.target.value)}>
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_debito">Débito</option>
                        <option value="cartao_credito">Crédito</option>
                      </select>
                    </div>
                    <div>
                      <label style={base.label}>Valor (R$)</label>
                      <input style={base.input} type="number" value={p.valor} onChange={e => updatePessoa(i, "valor", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo */}
            <div style={{ background: Math.abs(diferenca) < 0.01 ? `${C.green}15` : `${C.red}15`, border: `1px solid ${Math.abs(diferenca) < 0.01 ? C.green : C.red}40`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted }}>Total dividido</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{fmt(totalDividido)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: C.muted }}>{Math.abs(diferenca) < 0.01 ? "✅ Fechado" : diferenca > 0 ? "⚠️ Faltam" : "⚠️ Excesso"}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: Math.abs(diferenca) < 0.01 ? C.green : C.red }}>{Math.abs(diferenca) < 0.01 ? "Tudo certo!" : fmt(Math.abs(diferenca))}</div>
              </div>
            </div>
          </div>
        )}

        <div style={base.row}>
          <button style={{ ...base.btn(C.green, "#fff"), flex: 1, padding: "13px", fontSize: 15 }} onClick={onConfirmar} disabled={loading}>
            {loading ? "Processando..." : "✅ Confirmar Pagamento"}
          </button>
          <button style={base.btnOutline} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMANDAS ────────────────────────────────────────────
function Comandas() {
  const [comandas, setComandas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [itens, setItens] = useState([]);
  const [modalNova, setModalNova] = useState(false);
  const [modalPedido, setModalPedido] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [mesa, setMesa] = useState("");
  const [busca, setBusca] = useState("");
  const [pagamento, setPagamento] = useState("pix");
  const [loading, setLoading] = useState(false);

  const loadComandas = useCallback(async () => {
    const { data } = await supabase.from("comandas").select("*, comanda_itens(*)").eq("status", "aberta").order("created_at", { ascending: false });
    setComandas(data || []);
  }, []);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    setProdutos(data || []);
  }, []);

  const atualizandoManual = useRef(false);

  useEffect(() => {
    loadComandas();
    loadProdutos();

    const channel = supabase.channel("comandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => {
        if (!atualizandoManual.current) loadComandas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comanda_itens" }, () => {
        if (atualizandoManual.current) return; // ignora se foi atualização manual
        loadComandas();
        setSelected(prev => {
          if (prev) {
            supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", prev.id)
              .then(({ data }) => setItens(data || []));
          }
          return prev;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, () => {
        if (!atualizandoManual.current) loadProdutos();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadComandas, loadProdutos]);

  const loadItens = useCallback(async (comandaId) => {
    const { data } = await supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", comandaId);
    setItens(data || []);
  }, []);

  const abrirComanda = async () => {
    if (!nomeCliente) return;
    await supabase.from("comandas").insert({ nome_cliente: nomeCliente, mesa: mesa || null, status: "aberta", total: 0 });
    setNomeCliente(""); setMesa(""); setModalNova(false);
    loadComandas();
  };

  const selecionarComanda = async (c) => {
    setSelected(c);
    await loadItens(c.id);
  };

  const adicionarItem = async (produto) => {
    if (!selected) return;

    // Verifica estoque antes de adicionar
    const { data: prodAtual } = await supabase.from("produtos").select("estoque_atual").eq("id", produto.id).single();
    if (!prodAtual || prodAtual.estoque_atual <= 0) return; // já bloqueado visualmente

    const existente = itens.find(i => i.produto_id === produto.id);
    if (existente) {
      await supabase.from("comanda_itens").update({ quantidade: existente.quantidade + 1, subtotal: (existente.quantidade + 1) * Number(produto.preco) }).eq("id", existente.id);
    } else {
      await supabase.from("comanda_itens").insert({ comanda_id: selected.id, produto_id: produto.id, quantidade: 1, preco_unitario: produto.preco, subtotal: produto.preco });
    }

    // Baixa 1 no estoque
    await supabase.from("produtos").update({ estoque_atual: prodAtual.estoque_atual - 1 }).eq("id", produto.id);

    // Atualiza tudo sem fechar o modal
    const [{ data: itensAtualizados }, { data: produtosAtualizados }] = await Promise.all([
      supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", selected.id),
      supabase.from("produtos").select("*").eq("ativo", true).order("categoria"),
    ]);

    setItens(itensAtualizados || []);
    setProdutos(produtosAtualizados || []);
    const total = (itensAtualizados || []).reduce((a, i) => a + Number(i.subtotal), 0);
    await supabase.from("comandas").update({ total }).eq("id", selected.id);
    // Não fecha o modal nem recarrega tudo para não travar a tela
  };

  const removerItem = async (item) => {
    await supabase.from("comanda_itens").delete().eq("id", item.id);
    // Devolve ao estoque
    const { data: prod } = await supabase.from("produtos").select("estoque_atual").eq("id", item.produto_id).single();
    if (prod) await supabase.from("produtos").update({ estoque_atual: prod.estoque_atual + item.quantidade }).eq("id", item.produto_id);
    const { data: itensAtualizados } = await supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", selected.id);
    setItens(itensAtualizados || []);
    const total = (itensAtualizados || []).reduce((a, i) => a + Number(i.subtotal), 0);
    await supabase.from("comandas").update({ total }).eq("id", selected.id);
    loadComandas();
  };

  const fecharComanda = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const total = itens.reduce((a, i) => a + Number(i.subtotal), 0);
      const { data: venda } = await supabase.from("vendas").insert({ total, forma_pagamento: pagamento, status: "concluida" }).select().single();
      if (venda) {
        await supabase.from("venda_itens").insert(itens.map(i => ({ venda_id: venda.id, produto_id: i.produto_id, nome_produto: i.produtos?.nome || "", quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal })));
        await supabase.from("financeiro").insert({ tipo: "entrada", descricao: `Comanda - ${selected.nome_cliente}`, valor: total, categoria: "venda" });
        for (const item of itens) {
          const { data: prod } = await supabase.from("produtos").select("estoque_atual").eq("id", item.produto_id).single();
          if (prod) {
            await supabase.from("produtos").update({ estoque_atual: Math.max(0, prod.estoque_atual - item.quantidade) }).eq("id", item.produto_id);
          }
        }
      }
      await supabase.from("comandas").update({ status: "fechada", total, forma_pagamento: pagamento }).eq("id", selected.id);
      setSelected(null); setItens([]); setModalFechar(false);
      loadComandas();
    } catch (err) {
      console.error("Erro ao fechar comanda:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalComanda = itens.reduce((a, i) => a + Number(i.subtotal), 0);
  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20 }}>
        <div style={base.pageTitle}>Comandas</div>
        <button style={base.btn()} onClick={() => setModalNova(true)}>+ Nova Comanda</button>
      </div>

      {/* Mobile: mostra detalhe em tela cheia quando comanda selecionada */}
      <style>{`
        @media (max-width: 768px) {
          .comanda-lista { display: ${selected ? "none" : "block"} !important; }
          .comanda-detalhe { display: ${selected ? "block" : "none"} !important; }
          .comanda-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="comanda-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        {/* Lista de comandas */}
        <div className="comanda-lista">
          <div style={base.sectionTitle}>Abertas ({comandas.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comandas.map(c => (
              <div key={c.id} onClick={() => selecionarComanda(c)} style={{
                ...base.card,
                cursor: "pointer",
                borderColor: selected?.id === c.id ? C.accent : C.border,
                borderWidth: selected?.id === c.id ? 2 : 1,
                transition: "border-color 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, marginBottom: 2 }}>👤 {c.nome_cliente}</div>
                    {c.mesa && <div style={{ fontSize: 12, color: C.muted }}>Mesa {c.mesa}</div>}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hora(c.created_at)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: C.accent, fontSize: 16 }}>{fmt(c.total)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.comanda_itens?.length || 0} itens</div>
                  </div>
                </div>
              </div>
            ))}
            {comandas.length === 0 && (
              <div style={{ ...base.card, textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>
                Nenhuma comanda aberta
              </div>
            )}
          </div>
        </div>

        {/* Detalhe da comanda */}
        <div className="comanda-detalhe">
          {selected ? (
            <div>
              {/* Botão voltar mobile */}
              <button onClick={() => setSelected(null)} style={{
                display: "none", background: "transparent", border: "none",
                color: C.muted, fontSize: 13, cursor: "pointer",
                marginBottom: 12, alignItems: "center", gap: 6,
              }} className="btn-voltar-mobile">
                ← Voltar
              </button>
              <style>{`.btn-voltar-mobile { @media (max-width: 768px) { display: flex !important; } }`}</style>

              <div style={{ ...base.card, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginBottom: 4, display: "block" }}>← Voltar</button>
                    <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>👤 {selected.nome_cliente}</div>
                    {selected.mesa && <div style={{ fontSize: 13, color: C.muted }}>Mesa {selected.mesa}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={base.btn(C.blue, "#fff")} onClick={() => { setBusca(""); setModalPedido(true); }}>+ Adicionar Item</button>
                    <button style={base.btn(C.green, "#fff")} onClick={() => setModalFechar(true)}>✅ Fechar Conta</button>
                  </div>
                </div>

                {/* Tabela de itens - versão cards no mobile */}
                <style>{`
                  @media (max-width: 768px) {
                    .comanda-table { display: none !important; }
                    .comanda-cards { display: flex !important; }
                    .estoque-table thead th:nth-child(1),
                    .estoque-table tbody td:nth-child(1) { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .estoque-table thead th:nth-child(5),
                    .estoque-table tbody td:nth-child(5),
                    .estoque-table thead th:nth-child(4),
                    .estoque-table tbody td:nth-child(4) { display: none !important; }
                  }
                  @media (min-width: 769px) {
                    .comanda-cards { display: none !important; }
                  }
                `}</style>

                {/* Cards para mobile */}
                <div className="comanda-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
                  {itens.map(i => (
                    <div key={i.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 2 }}>{i.produtos?.nome || "—"}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{i.quantidade}x · {fmt(i.preco_unitario)} cada</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <span style={{ fontWeight: 800, color: C.accent, fontSize: 15 }}>{fmt(i.subtotal)}</span>
                        <button style={base.btnSm(C.red, "#fff")} onClick={() => removerItem(i)}>✕</button>
                      </div>
                    </div>
                  ))}
                  {itens.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 13 }}>Nenhum item ainda</div>}
                </div>

                {/* Tabela para desktop */}
                <table className="comanda-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={base.th}>Produto</th>
                      <th style={base.th}>Qtd</th>
                      <th style={base.th}>Unit.</th>
                      <th style={base.th}>Subtotal</th>
                      <th style={base.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(i => (
                      <tr key={i.id}>
                        <td style={base.td}>{i.produtos?.nome || "—"}</td>
                        <td style={base.td}>{i.quantidade}</td>
                        <td style={base.td}>{fmt(i.preco_unitario)}</td>
                        <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</td>
                        <td style={base.td}>
                          <button style={base.btnSm(C.red, "#fff")} onClick={() => removerItem(i)}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {itens.length === 0 && <tr><td colSpan={5} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum item ainda</td></tr>}
                  </tbody>
                </table>

                {itens.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>
                      Total: <span style={{ color: C.accent }}>{fmt(totalComanda)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ ...base.card, textAlign: "center", color: C.muted, fontSize: 13, padding: 60 }}>
              Selecione uma comanda ao lado para ver os detalhes
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Comanda */}
      {modalNova && (
        <div style={base.modal}>
          <div style={base.modalBox}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 20 }}>Nova Comanda</div>
            <div style={{ marginBottom: 14 }}>
              <label style={base.label}>Nome do Cliente *</label>
              <input style={base.input} value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Ex: João, Mesa 3..." autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={base.label}>Mesa (opcional)</label>
              <input style={base.input} value={mesa} onChange={e => setMesa(e.target.value)} placeholder="Ex: 1, 2, 3..." />
            </div>
            <div style={base.row}>
              <button style={base.btn()} onClick={abrirComanda}>Abrir Comanda</button>
              <button style={base.btnOutline} onClick={() => setModalNova(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Pedido */}
      {modalPedido && (
        <div style={base.modal}>
          <div style={{ ...base.modalBox, maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Adicionar Item</div>
              <button style={base.btnSm(C.border, C.muted)} onClick={() => setModalPedido(false)}>✕ Fechar</button>
            </div>
            <input style={{ ...base.input, marginBottom: 16 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar produto..." autoFocus />
            {["espeto", "bebida", "outro"].map(cat => {
              const itenscat = produtosFiltrados.filter(p => p.categoria === cat);
              if (!itenscat.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={base.sectionTitle}>{cat === "espeto" ? "🍢 Espetos" : cat === "bebida" ? "🍺 Bebidas" : "📦 Outros"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {itenscat.map(p => {
                      const esgotado = p.estoque_atual <= 0;
                      return (
                        <button key={p.id}
                          onClick={() => !esgotado && adicionarItem(p)}
                          onTouchEnd={(e) => { e.preventDefault(); if (!esgotado) adicionarItem(p); }}
                          style={{
                            background: esgotado ? "#111100" : C.card2,
                            border: `1px solid ${C.border}`,
                            borderRadius: 10,
                            padding: "12px 14px",
                            cursor: esgotado ? "not-allowed" : "pointer",
                            textAlign: "left",
                            opacity: esgotado ? 0.5 : 1,
                            position: "relative",
                            WebkitTapHighlightColor: "transparent",
                          }}>
                          {esgotado && (
                            <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700, color: "#a855f7", background: "#a855f720", padding: "2px 6px", borderRadius: 4 }}>
                              ESGOTADO
                            </div>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 600, color: esgotado ? C.muted : C.text, marginBottom: 2 }}>{p.nome}</div>
                          <div style={{ fontSize: 13, color: esgotado ? C.muted : C.accent, fontWeight: 800 }}>{fmt(p.preco)}</div>
                          <div style={{ fontSize: 11, color: p.estoque_atual <= 0 ? "#a855f7" : p.estoque_atual <= p.estoque_minimo ? C.red : C.muted, marginTop: 2 }}>
                            estoque: {p.estoque_atual}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Fechar Conta */}
      {modalFechar && (
        <ModalFecharConta
          selected={selected}
          totalComanda={totalComanda}
          pagamento={pagamento}
          setPagamento={setPagamento}
          loading={loading}
          onConfirmar={fecharComanda}
          onCancelar={() => setModalFechar(false)}
        />
      )}
    </div>
  );
}

// ─── VENDA RÁPIDA ────────────────────────────────────────
function VendaRapida() {
  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState("");
  const [pagamento, setPagamento] = useState("pix");
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    // Remove duplicatas pelo id único — ordena por nome para exibição limpa
    const unicos = (data || []).filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
    setProdutos(unicos);
  }, []);

  useEffect(() => {
    loadProdutos();
    const channel = supabase.channel("venda-rapida-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, loadProdutos)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadProdutos]);

  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const total = carrinho.reduce((a, i) => a + i.subtotal, 0);

  const add = (p) => {
    if (p.estoque_atual <= 0) return;
    // Verifica se a quantidade no carrinho já atingiu o estoque
    const noCarrinho = carrinho.find(i => i.produto_id === p.id);
    const qtdNoCarrinho = noCarrinho ? noCarrinho.quantidade : 0;
    if (qtdNoCarrinho >= p.estoque_atual) return;
    setCarrinho(c => {
      const ex = c.find(i => i.produto_id === p.id);
      if (ex) return c.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.preco_unitario } : i);
      return [...c, { produto_id: p.id, nome_produto: p.nome, quantidade: 1, preco_unitario: p.preco, subtotal: p.preco }];
    });
  };

  const changeQtd = (id, qtd) => {
    if (qtd < 1) return setCarrinho(c => c.filter(i => i.produto_id !== id));
    const prod = produtos.find(p => p.id === id);
    if (prod && qtd > prod.estoque_atual) return; // não deixa passar do estoque
    setCarrinho(c => c.map(i => i.produto_id === id ? { ...i, quantidade: qtd, subtotal: qtd * i.preco_unitario } : i));
  };

  const finalizar = async () => {
    if (!carrinho.length) return;
    setLoading(true);
    const { data: venda } = await supabase.from("vendas").insert({ total, forma_pagamento: pagamento, status: "concluida" }).select().single();
    if (venda) {
      await supabase.from("venda_itens").insert(carrinho.map(i => ({ ...i, venda_id: venda.id })));
      await supabase.from("financeiro").insert({ tipo: "entrada", descricao: `Venda Rápida`, valor: total, categoria: "venda" });
      // Baixa estoque de cada item vendido
      for (const item of carrinho) {
        const { data: prod } = await supabase.from("produtos").select("estoque_atual").eq("id", item.produto_id).single();
        if (prod) await supabase.from("produtos").update({ estoque_atual: Math.max(0, prod.estoque_atual - item.quantidade) }).eq("id", item.produto_id);
      }
    }
    setCarrinho([]); setSucesso(true); setLoading(false);
    setTimeout(() => setSucesso(false), 3000);
  };

  return (
    <div>
      <div style={base.pageTitle}>⚡ Venda Rápida</div>
      {sucesso && <div style={base.alert(C.green)}>✅ Venda registrada com sucesso!</div>}
      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div>
          <div style={{ ...base.card, marginBottom: 12 }}>
            <input style={base.input} placeholder="🔍 Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div style={{ ...base.card, maxHeight: 500, overflowY: "auto" }}>
            {["espeto", "bebida", "outro"].map(cat => {
              const itens = filtrados.filter(p => p.categoria === cat);
              if (!itens.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={base.sectionTitle}>{cat === "espeto" ? "🍢 Espetos" : cat === "bebida" ? "🍺 Bebidas" : "📦 Outros"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                    {itens.map(p => {
                      const noCarrinho = carrinho.find(i => i.produto_id === p.id);
                      const qtdCarrinho = noCarrinho ? noCarrinho.quantidade : 0;
                      const disponivelReal = p.estoque_atual - qtdCarrinho;
                      const esgotado = disponivelReal <= 0;
                      return (
                        <button key={p.id} onClick={() => add(p)} disabled={esgotado} style={{
                          background: esgotado ? "#111100" : C.card2,
                          border: `1px solid ${C.border}`,
                          borderRadius: 10, padding: "12px 14px",
                          cursor: esgotado ? "not-allowed" : "pointer",
                          textAlign: "left", opacity: esgotado ? 0.5 : 1,
                          position: "relative",
                        }}>
                          {esgotado && (
                            <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700, color: "#a855f7", background: "#a855f720", padding: "2px 6px", borderRadius: 4 }}>
                              ESGOTADO
                            </div>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 600, color: esgotado ? C.muted : C.text, marginBottom: 2 }}>{p.nome}</div>
                          <div style={{ fontSize: 13, color: esgotado ? C.muted : C.accent, fontWeight: 800 }}>{fmt(p.preco)}</div>
                          <div style={{ fontSize: 11, color: esgotado ? "#a855f7" : disponivelReal <= p.estoque_minimo ? C.red : C.muted, marginTop: 2 }}>
                            disponível: {Math.max(0, disponivelReal)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={base.card}>
          <div style={base.sectionTitle}>🛒 Carrinho</div>
          {carrinho.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>Selecione produtos ao lado</div>}
          <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
            {carrinho.map(i => (
              <div key={i.produto_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, fontSize: 13, color: C.text }}>{i.nome_produto}</div>
                <div style={base.row}>
                  <button onClick={() => changeQtd(i.produto_id, i.quantidade - 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center", color: C.text }}>{i.quantidade}</span>
                  <button onClick={() => changeQtd(i.produto_id, i.quantidade + 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>+</button>
                </div>
                <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, minWidth: 70, textAlign: "right" }}>{fmt(i.subtotal)}</div>
              </div>
            ))}
          </div>
          {carrinho.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={base.label}>Pagamento</label>
                <select style={base.select} value={pagamento} onChange={e => setPagamento(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, marginBottom: 14, color: C.text }}>
                <span>Total</span><span style={{ color: C.accent }}>{fmt(total)}</span>
              </div>
              <button style={{ ...base.btn(C.green, "#fff"), width: "100%", padding: "13px", fontSize: 15 }} onClick={finalizar} disabled={loading}>
                {loading ? "Registrando..." : "✅ Finalizar Venda"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ESTOQUE ─────────────────────────────────────────────
function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ nome: "", categoria: "bebida", preco: "", estoque_atual: "", estoque_minimo: "5", unidade: "un" });
  const [showForm, setShowForm] = useState(false);
  const [entradaModal, setEntradaModal] = useState(null);
  const [qtdEntrada, setQtdEntrada] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    setProdutos(data || []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("estoque-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const alertas = produtos.filter(p => p.estoque_atual <= p.estoque_minimo);
  const esgotados = produtos.filter(p => p.estoque_atual === 0);
  const baixos = produtos.filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);

  const abrirEdicao = (p) => {
    setEditModal(p);
    setEditForm({ nome: p.nome, categoria: p.categoria, preco: p.preco, estoque_minimo: p.estoque_minimo, unidade: p.unidade });
  };

  const salvarEdicao = async () => {
    if (!editModal) return;
    await supabase.from("produtos").update({ ...editForm, preco: Number(editForm.preco), estoque_minimo: Number(editForm.estoque_minimo) }).eq("id", editModal.id);
    setEditModal(null); load();
  };

  const [erroForm, setErroForm] = useState("");

  const salvar = async () => {
    if (!form.nome || !form.preco) return;
    // Verifica se já existe produto com esse nome
    const { data: existente } = await supabase.from("produtos").select("id").eq("nome", form.nome).eq("ativo", true).single();
    if (existente) {
      setErroForm(`Já existe um produto com o nome "${form.nome}". Use um nome diferente ou edite o produto existente.`);
      return;
    }
    setErroForm("");
    await supabase.from("produtos").insert({ ...form, preco: Number(form.preco), estoque_atual: Number(form.estoque_atual), estoque_minimo: Number(form.estoque_minimo) });
    setForm({ nome: "", categoria: "bebida", preco: "", estoque_atual: "", estoque_minimo: "5", unidade: "un" });
    setShowForm(false); load();
  };

  const entradaEstoque = async () => {
    if (!qtdEntrada || !entradaModal) return;
    await supabase.from("produtos").update({ estoque_atual: entradaModal.estoque_atual + Number(qtdEntrada) }).eq("id", entradaModal.id);
    await supabase.from("estoque_movimentacoes").insert({ produto_id: entradaModal.id, tipo: "entrada", quantidade: Number(qtdEntrada), motivo: "reposição manual" });
    setEntradaModal(null); setQtdEntrada(""); load();
  };

  const desativar = async (id) => {
    await supabase.from("produtos").update({ ativo: false }).eq("id", id);
    load();
  };

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20 }}>
        <div style={base.pageTitle}>Estoque</div>
        <button style={base.btn()} onClick={() => setShowForm(!showForm)}>+ Novo Produto</button>
      </div>

      {esgotados.length > 0 && <div style={base.alert("#6b21a8")}>🚫 <strong>{esgotados.length} produto(s) esgotado(s):</strong> {esgotados.map(p => p.nome).join(", ")}</div>}
      {baixos.length > 0 && <div style={base.alert(C.red)}>⚠️ <strong>{baixos.length} produto(s) com estoque baixo:</strong> {baixos.map(p => p.nome).join(", ")}</div>}

      {showForm && (
        <div style={{ ...base.card, marginBottom: 16 }}>
          <div style={base.sectionTitle}>Novo Produto</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Nome *", key: "nome", type: "text", placeholder: "Ex: Heineken 600ml" },
              { label: "Preço (R$) *", key: "preco", type: "number", placeholder: "0,00" },
              { label: "Estoque Atual", key: "estoque_atual", type: "number", placeholder: "0" },
              { label: "Estoque Mínimo", key: "estoque_minimo", type: "number", placeholder: "5" },
              { label: "Unidade", key: "unidade", type: "text", placeholder: "un, kg, l..." },
            ].map(f => (
              <div key={f.key}>
                <label style={base.label}>{f.label}</label>
                <input style={base.input} type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label style={base.label}>Categoria</label>
              <select style={base.select} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                <option value="bebida">🍺 Bebida</option>
                <option value="espeto">🍢 Espeto</option>
                <option value="outro">📦 Outro</option>
              </select>
            </div>
          </div>
          <div style={base.row}>
            <button style={base.btn(C.green, "#fff")} onClick={salvar}>Salvar Produto</button>
            <button style={base.btnOutline} onClick={() => { setShowForm(false); setErroForm(""); }}>Cancelar</button>
          </div>
          {erroForm && <div style={{ ...base.alert(C.red), marginTop: 12, marginBottom: 0 }}>⚠️ {erroForm}</div>}
        </div>
      )}

      {entradaModal && (
        <div style={base.modal}>
          <div style={base.modalBox}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>Entrada de Estoque</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{entradaModal.nome} · Atual: {entradaModal.estoque_atual}</div>
            <label style={base.label}>Quantidade a adicionar</label>
            <input style={{ ...base.input, marginBottom: 16 }} type="number" value={qtdEntrada} onChange={e => setQtdEntrada(e.target.value)} placeholder="Ex: 24" autoFocus />
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={entradaEstoque}>Confirmar</button>
              <button style={base.btnOutline} onClick={() => { setEntradaModal(null); setQtdEntrada(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div style={base.modal}>
          <div style={base.modalBox}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 20 }}>✏️ Editar Produto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={base.label}>Nome</label>
                <input style={base.input} value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div>
                <label style={base.label}>Preço (R$)</label>
                <input style={base.input} type="number" value={editForm.preco} onChange={e => setEditForm({ ...editForm, preco: e.target.value })} />
              </div>
              <div>
                <label style={base.label}>Estoque Mínimo</label>
                <input style={base.input} type="number" value={editForm.estoque_minimo} onChange={e => setEditForm({ ...editForm, estoque_minimo: e.target.value })} />
              </div>
              <div>
                <label style={base.label}>Categoria</label>
                <select style={base.select} value={editForm.categoria} onChange={e => setEditForm({ ...editForm, categoria: e.target.value })}>
                  <option value="bebida">🍺 Bebida</option>
                  <option value="espeto">🍢 Espeto</option>
                  <option value="outro">📦 Outro</option>
                </select>
              </div>
              <div>
                <label style={base.label}>Unidade</label>
                <input style={base.input} value={editForm.unidade} onChange={e => setEditForm({ ...editForm, unidade: e.target.value })} />
              </div>
            </div>
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={salvarEdicao}>Salvar</button>
              <button style={base.btnOutline} onClick={() => setEditModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={base.card}>
        <style>{`
          @media (max-width: 768px) {
            .estoque-table { display: none !important; }
            .estoque-cards { display: flex !important; }
          }
          @media (min-width: 769px) {
            .estoque-cards { display: none !important; }
          }
        `}</style>

        {/* Cards mobile */}
        <div className="estoque-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
          {produtos.map(p => {
            const esgotado = p.estoque_atual === 0;
            const baixo = !esgotado && p.estoque_atual <= p.estoque_minimo;
            const statusCor = esgotado ? "#6b21a8" : baixo ? C.red : C.green;
            const statusLabel = esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
            return (
              <div key={p.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{p.nome}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={base.tag(C.accent)}>{p.categoria}</span>
                      <span style={base.tag(statusCor)}>{statusLabel}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>{fmt(p.preco)}</div>
                    <div style={{ color: esgotado ? "#6b21a8" : C.text, fontWeight: 700, fontSize: 13 }}>{p.estoque_atual} {p.unidade}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={base.btnSm(C.blue, "#fff")} onClick={() => abrirEdicao(p)}>✏️ Editar</button>
                  <button style={base.btnSm()} onClick={() => setEntradaModal(p)}>+ Entrada</button>
                  <button style={base.btnSm(C.red, "#fff")} onClick={() => desativar(p.id)}>Remover</button>
                </div>
              </div>
            );
          })}
          {produtos.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 32, fontSize: 13 }}>Nenhum produto cadastrado</div>}
        </div>

        {/* Tabela desktop */}
        <table className="estoque-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Produto</th>
              <th style={base.th}>Categoria</th>
              <th style={base.th}>Preço</th>
              <th style={base.th}>Estoque</th>
              <th style={base.th}>Mínimo</th>
              <th style={base.th}>Status</th>
              <th style={base.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => {
              const esgotado = p.estoque_atual === 0;
              const baixo = !esgotado && p.estoque_atual <= p.estoque_minimo;
              const statusCor = esgotado ? "#6b21a8" : baixo ? C.red : C.green;
              const statusLabel = esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
              return (
                <tr key={p.id}>
                  <td style={base.td}>{p.nome}</td>
                  <td style={base.td}><span style={base.tag(C.accent)}>{p.categoria}</span></td>
                  <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(p.preco)}</td>
                  <td style={{ ...base.td, fontWeight: 700, color: esgotado ? "#6b21a8" : C.text }}>{p.estoque_atual} {p.unidade}</td>
                  <td style={base.td}>{p.estoque_minimo}</td>
                  <td style={base.td}><span style={base.tag(statusCor)}>{statusLabel}</span></td>
                  <td style={base.td}>
                    <div style={base.row}>
                      <button style={base.btnSm(C.blue, "#fff")} onClick={() => abrirEdicao(p)}>✏️ Editar</button>
                      <button style={base.btnSm()} onClick={() => setEntradaModal(p)}>+ Entrada</button>
                      <button style={base.btnSm(C.red, "#fff")} onClick={() => desativar(p.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {produtos.length === 0 && <tr><td colSpan={7} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum produto cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MÊS PICKER ──────────────────────────────────────────
function MonthPicker({ value, onChange }) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = value.split("-").map(Number);

  const anterior = () => {
    const d = new Date(ano, mes - 2);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`);
  };

  const proximo = () => {
    const d = new Date(ano, mes);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px" }}>
      <button onClick={anterior} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>‹</button>
      <span style={{ fontWeight: 700, fontSize: 14, color: C.text, minWidth: 110, textAlign: "center" }}>
        {meses[mes - 1]} de {ano}
      </span>
      <button onClick={proximo} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>›</button>
    </div>
  );
}

// ─── FINANCEIRO ───────────────────────────────────────────
function Financeiro() {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState({ tipo: "saida", descricao: "", valor: "", categoria: "", data: today() });
  const [showForm, setShowForm] = useState(false);
  const [filtroMes, setFiltroMes] = useState(today().slice(0, 7));

  const load = useCallback(async () => {
    const { data } = await supabase.from("financeiro").select("*").gte("data", filtroMes + "-01").order("data", { ascending: false });
    setRegistros(data || []);
  }, [filtroMes]);

  useEffect(() => {
    load();
    const channel = supabase.channel("financeiro-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const entradas = registros.filter(r => r.tipo === "entrada").reduce((a, r) => a + Number(r.valor), 0);
  const saidas = registros.filter(r => r.tipo === "saida").reduce((a, r) => a + Number(r.valor), 0);

  const salvar = async () => {
    if (!form.descricao || !form.valor) return;
    await supabase.from("financeiro").insert({ ...form, valor: Number(form.valor) });
    setForm({ tipo: "saida", descricao: "", valor: "", categoria: "", data: today() });
    setShowForm(false); load();
  };

  const excluir = async (id) => {
    await supabase.from("financeiro").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20 }}>
        <div style={base.pageTitle}>Financeiro</div>
        <div style={base.row}>
          <MonthPicker value={filtroMes} onChange={setFiltroMes} />
          <button style={base.btn(C.green, "#fff")} onClick={() => { setForm({ ...form, tipo: "entrada" }); setShowForm(true); }}>+ Entrada</button>
          <button style={base.btn(C.red, "#fff")} onClick={() => { setForm({ ...form, tipo: "saida" }); setShowForm(true); }}>− Saída</button>
        </div>
      </div>

      <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Entradas", val: fmt(entradas), color: C.green, icon: "📈" },
          { label: "Total Saídas", val: fmt(saidas), color: C.red, icon: "📉" },
          { label: "Saldo do Período", val: fmt(entradas - saidas), color: entradas - saidas >= 0 ? C.green : C.red, icon: "💰" },
        ].map((st, i) => (
          <div key={i} style={base.card}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{st.icon}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{st.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: st.color }}>{st.val}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ ...base.card, marginBottom: 16 }}>
          <div style={base.sectionTitle}>Novo Lançamento</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={base.label}>Tipo</label>
              <select style={base.select} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="entrada">📈 Entrada</option>
                <option value="saida">📉 Saída</option>
              </select>
            </div>
            <div>
              <label style={base.label}>Descrição *</label>
              <input style={base.input} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Compra de cerveja" />
            </div>
            <div>
              <label style={base.label}>Valor (R$) *</label>
              <input style={base.input} type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div>
              <label style={base.label}>Categoria</label>
              <input style={base.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="compras, aluguel, salário..." />
            </div>
            <div>
              <label style={base.label}>Data</label>
              <input style={base.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
          </div>
          <div style={base.row}>
            <button style={base.btn(C.green, "#fff")} onClick={salvar}>Salvar</button>
            <button style={base.btnOutline} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={base.card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Data</th>
              <th style={base.th}>Descrição</th>
              <th style={base.th}>Categoria</th>
              <th style={base.th}>Tipo</th>
              <th style={base.th}>Valor</th>
              <th style={base.th}></th>
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id}>
                <td style={base.td}>{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td style={base.td}>{r.descricao}</td>
                <td style={base.td}><span style={base.tag(C.muted)}>{r.categoria || "—"}</span></td>
                <td style={base.td}><span style={base.tag(r.tipo === "entrada" ? C.green : C.red)}>{r.tipo === "entrada" ? "📈 Entrada" : "📉 Saída"}</span></td>
                <td style={{ ...base.td, color: r.tipo === "entrada" ? C.green : C.red, fontWeight: 700 }}>{r.tipo === "saida" ? "− " : "+ "}{fmt(r.valor)}</td>
                <td style={base.td}><button style={base.btnSm(C.red, "#fff")} onClick={() => excluir(r.id)}>✕</button></td>
              </tr>
            ))}
            {registros.length === 0 && <tr><td colSpan={6} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum lançamento no período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HISTÓRICO ────────────────────────────────────────────
function Historico() {
  const [vendas, setVendas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [itens, setItens] = useState([]);

  const loadVendas = useCallback(async () => {
    const { data } = await supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(50);
    setVendas(data || []);
  }, []);

  useEffect(() => {
    loadVendas();
    const channel = supabase.channel("historico-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, loadVendas)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadVendas]);

  const verDetalhes = async (v) => {
    setSelected(v);
    const { data } = await supabase.from("venda_itens").select("*").eq("venda_id", v.id);
    setItens(data || []);
  };

  const totalDia = vendas.filter(v => v.created_at?.startsWith(today())).reduce((a, v) => a + Number(v.total), 0);

  return (
    <div>
      <div style={base.pageTitle}>Histórico de Vendas</div>
      <div style={{ ...base.card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Faturamento Hoje</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>{fmt(totalDia)}</div>
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>{vendas.filter(v => v.created_at?.startsWith(today())).length} vendas hoje</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16 }}>
        <div style={base.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={base.th}>Data/Hora</th>
                <th style={base.th}>Pagamento</th>
                <th style={base.th}>Total</th>
                <th style={base.th}></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id} style={{ background: selected?.id === v.id ? C.accentBg : "transparent" }}>
                  <td style={base.td}>{dataHora(v.created_at)}</td>
                  <td style={base.td}><span style={base.tag(C.accent)}>{v.forma_pagamento || "—"}</span></td>
                  <td style={{ ...base.td, color: C.green, fontWeight: 700 }}>{fmt(v.total)}</td>
                  <td style={base.td}><button style={base.btnSm()} onClick={() => verDetalhes(v)}>Ver</button></td>
                </tr>
              ))}
              {vendas.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda registrada</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={base.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: C.text }}>Detalhes da Venda</div>
              <button style={base.btnSm(C.card2, C.muted)} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Data/Hora</div>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{dataHora(selected.created_at)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Pagamento</div>
            <div style={{ marginBottom: 16 }}><span style={base.tag(C.accent)}>{selected.forma_pagamento}</span></div>
            <div style={base.sectionTitle}>Itens</div>
            {itens.map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: C.text }}>{i.nome_produto} × {i.quantidade}</span>
                <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>
              <span style={{ color: C.text }}>Total</span>
              <span style={{ color: C.accent }}>{fmt(selected.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────
function Configuracoes() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome: "", cargo: "atendente", pin: "" });
  const [showForm, setShowForm] = useState(false);
  const [config, setConfig] = useState({ nome_estabelecimento: "Adega", telefone: "", endereco: "" });
  const [savedConfig, setSavedConfig] = useState(false);
  const [editUsuario, setEditUsuario] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});

  const loadUsuarios = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("*").order("created_at");
    setUsuarios(data || []);
  }, []);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  const salvarUsuario = async () => {
    if (!form.nome) return;
    await supabase.from("usuarios").insert(form);
    setForm({ nome: "", cargo: "atendente", pin: "" });
    setShowForm(false); loadUsuarios();
  };

  const removerUsuario = async (id) => {
    await supabase.from("usuarios").delete().eq("id", id);
    loadUsuarios();
  };

  const abrirEdicaoUsuario = (u) => {
    setEditUsuario(u);
    setEditUserForm({ nome: u.nome, cargo: u.cargo, pin: u.pin || "" });
  };

  const salvarEdicaoUsuario = async () => {
    if (!editUsuario) return;
    await supabase.from("usuarios").update(editUserForm).eq("id", editUsuario.id);
    setEditUsuario(null); loadUsuarios();
  };

  const salvarConfig = () => {
    localStorage.setItem("adega_config", JSON.stringify(config));
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
  };

  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  return (
    <div>
      <div style={base.pageTitle}>⚙️ Configurações</div>

      {/* Config do estabelecimento */}
      <div style={{ ...base.card, marginBottom: 20 }}>
        <div style={base.sectionTitle}>🏪 Estabelecimento</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={base.label}>Nome do Estabelecimento</label>
            <input style={base.input} value={config.nome_estabelecimento} onChange={e => setConfig({ ...config, nome_estabelecimento: e.target.value })} />
          </div>
          <div>
            <label style={base.label}>Telefone/WhatsApp</label>
            <input style={base.input} value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} placeholder="(19) 99999-9999" />
          </div>
          <div>
            <label style={base.label}>Endereço</label>
            <input style={base.input} value={config.endereco} onChange={e => setConfig({ ...config, endereco: e.target.value })} placeholder="Rua, número, bairro..." />
          </div>
        </div>
        <div style={base.row}>
          <button style={base.btn()} onClick={salvarConfig}>Salvar Configurações</button>
          {savedConfig && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✅ Salvo!</span>}
        </div>
      </div>

      {/* Usuários */}
      <div style={base.card}>
        <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={base.sectionTitle}>👥 Usuários do Sistema</div>
          <button style={base.btn()} onClick={() => setShowForm(!showForm)}>+ Novo Usuário</button>
        </div>

        {showForm && (
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={base.label}>Nome *</label>
                <input style={base.input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" autoFocus />
              </div>
              <div>
                <label style={base.label}>Cargo</label>
                <select style={base.select} value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                  <option value="admin">👑 Admin</option>
                  <option value="gerente">🔑 Gerente</option>
                  <option value="atendente">👤 Atendente</option>
                </select>
              </div>
              <div>
                <label style={base.label}>PIN de acesso (opcional)</label>
                <input style={base.input} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="Ex: 1234" maxLength={6} />
              </div>
            </div>
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={salvarUsuario}>Salvar</button>
              <button style={base.btnOutline} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Nome</th>
              <th style={base.th}>Cargo</th>
              <th style={base.th}>PIN</th>
              <th style={base.th}>Cadastrado em</th>
              <th style={base.th}></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td style={base.td}>{u.nome}</td>
                <td style={base.td}><span style={base.tag(cargoCor[u.cargo] || C.muted)}>{u.cargo}</span></td>
                <td style={base.td}>{u.pin ? "••••" : "—"}</td>
                <td style={base.td}>{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                <td style={base.td}>
                  <div style={base.row}>
                    <button style={base.btnSm(C.blue, "#fff")} onClick={() => abrirEdicaoUsuario(u)}>✏️ Editar</button>
                    <button style={base.btnSm(C.red, "#fff")} onClick={() => removerUsuario(u.id)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={5} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum usuário cadastrado</td></tr>}
          </tbody>
        </table>

        {editUsuario && (
          <div style={base.modal}>
            <div style={base.modalBox}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 20 }}>✏️ Editar Usuário</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={base.label}>Nome</label>
                  <input style={base.input} value={editUserForm.nome} onChange={e => setEditUserForm({ ...editUserForm, nome: e.target.value })} />
                </div>
                <div>
                  <label style={base.label}>Cargo</label>
                  <select style={base.select} value={editUserForm.cargo} onChange={e => setEditUserForm({ ...editUserForm, cargo: e.target.value })}>
                    <option value="admin">👑 Admin</option>
                    <option value="gerente">🔑 Gerente</option>
                    <option value="atendente">👤 Atendente</option>
                  </select>
                </div>
                <div>
                  <label style={base.label}>Novo PIN</label>
                  <input style={base.input} value={editUserForm.pin} onChange={e => setEditUserForm({ ...editUserForm, pin: e.target.value })} placeholder="Digite o novo PIN" maxLength={6} />
                </div>
              </div>
              <div style={base.row}>
                <button style={base.btn(C.green, "#fff")} onClick={salvarEdicaoUsuario}>Salvar</button>
                <button style={base.btnOutline} onClick={() => setEditUsuario(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RELATÓRIOS ──────────────────────────────────────────
function Relatorios() {
  const [vendas, setVendas] = useState([]);
  const [periodo, setPeriodo] = useState(today().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const inicio = periodo + "-01";
    const fim = new Date(periodo + "-01");
    fim.setMonth(fim.getMonth() + 1);
    const fimStr = fim.toISOString().split("T")[0];
    const { data } = await supabase.from("vendas").select("*, venda_itens(*)").eq("status", "concluida").gte("created_at", inicio).lt("created_at", fimStr).order("created_at", { ascending: false });
    setVendas(data || []);
    setLoading(false);
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  // Agrupamento por forma de pagamento
  const porPagamento = ["pix", "dinheiro", "cartao_debito", "cartao_credito"].map(forma => {
    const itens = vendas.filter(v => v.forma_pagamento === forma);
    return { forma, quantidade: itens.length, total: itens.reduce((a, v) => a + Number(v.total), 0) };
  }).filter(p => p.quantidade > 0);

  // Agrupamento por dia
  const porDia = vendas.reduce((acc, v) => {
    const dia = v.created_at?.split("T")[0];
    if (!acc[dia]) acc[dia] = { dia, quantidade: 0, total: 0 };
    acc[dia].quantidade += 1;
    acc[dia].total += Number(v.total);
    return acc;
  }, {});
  const diasOrdenados = Object.values(porDia).sort((a, b) => b.dia.localeCompare(a.dia));

  // Produtos mais vendidos
  const produtosVendidos = {};
  vendas.forEach(v => {
    (v.venda_itens || []).forEach(i => {
      if (!produtosVendidos[i.nome_produto]) produtosVendidos[i.nome_produto] = { nome: i.nome_produto, quantidade: 0, total: 0 };
      produtosVendidos[i.nome_produto].quantidade += i.quantidade;
      produtosVendidos[i.nome_produto].total += Number(i.subtotal);
    });
  });
  const topProdutos = Object.values(produtosVendidos).sort((a, b) => b.total - a.total).slice(0, 10);

  const totalGeral = vendas.reduce((a, v) => a + Number(v.total), 0);
  const ticketMedio = vendas.length > 0 ? totalGeral / vendas.length : 0;

  const formaNome = { pix: "PIX", dinheiro: "Dinheiro", cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito" };
  const formaCor = { pix: C.blue, dinheiro: C.green, cartao_debito: "#a855f7", cartao_credito: "#f97316" };

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20 }}>
        <div style={base.pageTitle}>📈 Relatórios</div>
        <MonthPicker value={periodo} onChange={setPeriodo} />
      </div>

      {loading && <div style={{ ...base.card, textAlign: "center", color: C.muted, padding: 40 }}>Carregando...</div>}

      {!loading && (
        <>
          {/* Resumo geral */}
          <div className="grid-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
            {[
              { label: "Total Faturado", val: fmt(totalGeral), color: C.accent, icon: "💰" },
              { label: "Nº de Vendas", val: vendas.length, color: C.blue, icon: "🧾" },
              { label: "Ticket Médio", val: fmt(ticketMedio), color: C.green, icon: "📊" },
              { label: "Melhor Dia", val: diasOrdenados.length > 0 ? fmt(Math.max(...diasOrdenados.map(d => d.total))) : "R$ 0,00", color: "#f97316", icon: "🏆" },
            ].map((c, i) => (
              <div key={i} style={base.card}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* Por forma de pagamento */}
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={base.card}>
              <div style={base.sectionTitle}>💳 Por Forma de Pagamento</div>
              {porPagamento.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>Sem dados no período</div>}
              {porPagamento.map(p => {
                const pct = totalGeral > 0 ? (p.total / totalGeral) * 100 : 0;
                const cor = formaCor[p.forma] || C.muted;
                return (
                  <div key={p.forma} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{formaNome[p.forma]}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{p.quantidade} venda(s)</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: cor }}>{fmt(p.total)}</span>
                    </div>
                    <div style={{ background: C.border, borderRadius: 100, height: 6 }}>
                      <div style={{ background: cor, borderRadius: 100, height: 6, width: `${pct}%`, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, textAlign: "right" }}>{pct.toFixed(1)}% do total</div>
                  </div>
                );
              })}
            </div>

            {/* Produtos mais vendidos */}
            <div style={base.card}>
              <div style={base.sectionTitle}>🏆 Produtos Mais Vendidos</div>
              {topProdutos.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>Sem dados no período</div>}
              {topProdutos.map((p, i) => (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? C.accent : i === 1 ? "#9ca3af" : i === 2 ? "#c49a00" : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: i < 3 ? "#000" : C.muted, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.quantidade} unidade(s)</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{fmt(p.total)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Por dia */}
          <div style={base.card}>
            <div style={base.sectionTitle}>📅 Vendas por Dia</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={base.th}>Data</th>
                  <th style={base.th}>Nº Vendas</th>
                  <th style={base.th}>Faturamento</th>
                  <th style={base.th}>Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {diasOrdenados.map(d => (
                  <tr key={d.dia}>
                    <td style={base.td}>{new Date(d.dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                    <td style={base.td}>{d.quantidade}</td>
                    <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(d.total)}</td>
                    <td style={{ ...base.td, color: C.green }}>{fmt(d.total / d.quantidade)}</td>
                  </tr>
                ))}
                {diasOrdenados.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda no período</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogin = (user) => {
    setUsuario(user);
    const primeiraPage = PAGES.find(p => p.cargos.includes(user.cargo));
    setPage(primeiraPage?.id || "dashboard");
  };

  const handleLogout = () => { setUsuario(null); setPage("dashboard"); };

  const pageLabel = PAGES.find(p => p.id === page);

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard setPage={setPage} />;
      case "comandas": return <Comandas />;
      case "venda": return <VendaRapida />;
      case "estoque": return <Estoque />;
      case "financeiro": return <Financeiro />;
      case "historico": return <Historico />;
      case "relatorios": return <Relatorios />;
      case "configuracoes": return <Configuracoes />;
      default: return <Dashboard setPage={setPage} />;
    }
  };

  if (!usuario) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ display: "flex", background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @media (max-width: 768px) {
          .grid-2col, .grid-3col, .grid-4col, .grid-5col { grid-template-columns: 1fr !important; }
          .grid-auto { grid-template-columns: 1fr 1fr !important; }
          .page-title { font-size: 18px !important; }
          .hide-mobile { display: none !important; }
          table { display: block !important; overflow-x: auto !important; white-space: nowrap !important; }
          .flex-wrap-mobile { flex-wrap: wrap !important; }
          .modal-box { max-width: 95vw !important; margin: 10px !important; }
        }
      `}</style>

      <Sidebar page={page} setPage={setPage} open={sidebarOpen} setOpen={setSidebarOpen} usuario={usuario} onLogout={handleLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="topbar" style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 56,
          background: C.card, borderBottom: `1px solid ${C.border}`,
          alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", zIndex: 30,
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 24, cursor: "pointer" }}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{pageLabel?.icon}</span>
            <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{pageLabel?.label}</span>
          </div>
          <span style={{ fontSize: 20 }}>🍺</span>
        </div>

        <div className="main-content" style={{ flex: 1, padding: 28, overflowY: "auto" }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}