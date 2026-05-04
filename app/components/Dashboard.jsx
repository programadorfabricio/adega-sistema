"use client";
import { useState, useEffect } from "react";
import { supabase, C, base, fmt, today, hora } from "./shared/constants";

export default function Dashboard({ setPage }) {
  const [stats, setStats] = useState({ vendasHoje: 0, totalHoje: 0, estoqueBaixo: 0, esgotados: 0, saldoMes: 0, comandasAbertas: 0 });
  const [recentes, setRecentes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [grafico7dias, setGrafico7dias] = useState([]);

  useEffect(() => {
    async function load() {
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
      const mesAtual = today().slice(0, 7) + "-01";
      const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate() - 6); seteDiasAtras.setHours(0,0,0,0);

      const [{ data: vendas }, { data: produtos }, { data: fin }, { data: comandas }, { data: ultimasVendas }, { data: vendasSemana }] = await Promise.all([
        supabase.from("vendas").select("*").gte("created_at", inicioHoje.toISOString()).eq("status", "concluida"),
        supabase.from("produtos").select("*").eq("ativo", true),
        supabase.from("financeiro").select("*").gte("data", mesAtual),
        supabase.from("comandas").select("*").eq("status", "aberta"),
        supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(5),
        supabase.from("vendas").select("*").eq("status", "concluida").gte("created_at", seteDiasAtras.toISOString()),
      ]);

      const esgotados = (produtos || []).filter(p => p.estoque_atual === 0);
      const baixos = (produtos || []).filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);
      const totalHoje = (vendas || []).reduce((a, v) => a + Number(v.total), 0);
      const entradas = (fin || []).filter(f => f.tipo === "entrada").reduce((a, f) => a + Number(f.valor), 0);
      const saidas = (fin || []).filter(f => f.tipo === "saida").reduce((a, f) => a + Number(f.valor), 0);

      setStats({ vendasHoje: vendas?.length || 0, totalHoje, estoqueBaixo: baixos.length, esgotados: esgotados.length, saldoMes: entradas - saidas, comandasAbertas: comandas?.length || 0 });
      setRecentes(ultimasVendas || []);
      setAlertas([...esgotados, ...baixos]);

      // Monta dados dos últimos 7 dias
      const diasMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        diasMap[key] = { dia: key, total: 0, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
      }
      (vendasSemana || []).forEach(v => {
        const key = v.created_at?.split("T")[0];
        if (diasMap[key]) diasMap[key].total += Number(v.total);
      });
      setGrafico7dias(Object.values(diasMap));
    }

    load();
    const channel = supabase.channel("dashboard-rt")
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
    { label: "Esgotados", val: stats.esgotados, color: stats.esgotados > 0 ? "#a855f7" : C.green, icon: "🚫", action: () => setPage("estoque") },
    { label: "Estoque Baixo", val: stats.estoqueBaixo, color: stats.estoqueBaixo > 0 ? C.red : C.green, icon: "📦", action: () => setPage("estoque") },
  ];

  return (
    <div>
      <div style={base.pageTitle}>Dashboard</div>

      {alertas.filter(p => p.estoque_atual === 0).length > 0 && (
        <div style={base.alert("#a855f7")}>
          🚫 <strong>{alertas.filter(p => p.estoque_atual === 0).length} esgotado(s):</strong> {alertas.filter(p => p.estoque_atual === 0).map(p => p.nome).join(", ")}
        </div>
      )}
      {alertas.filter(p => p.estoque_atual > 0).length > 0 && (
        <div style={base.alert(C.red)}>
          ⚠️ <strong>{alertas.filter(p => p.estoque_atual > 0).length} estoque baixo:</strong> {alertas.filter(p => p.estoque_atual > 0).map(p => p.nome).join(", ")}
        </div>
      )}

      <div className="grid-5col" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={c.action} style={{ ...base.card, cursor: c.action ? "pointer" : "default" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ ...base.card, marginBottom: 16 }}>
        <div style={base.sectionTitle}>Últimas Vendas</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={base.th}>Horário</th><th style={base.th}>Pagamento</th><th style={base.th}>Total</th></tr></thead>
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

      <div style={{ ...base.card, marginBottom: 16 }}>
        <div style={base.sectionTitle}>📈 Faturamento — Últimos 7 Dias</div>
        {grafico7dias.length > 0 && (() => {
          const maxVal = Math.max(...grafico7dias.map(d => d.total), 1);
          return (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
              {grafico7dias.map((d, i) => {
                const isHoje = i === grafico7dias.length - 1;
                const altura = d.total > 0 ? Math.max((d.total / maxVal) * 80, 6) : 4;
                return (
                  <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {d.total > 0 && <div style={{ fontSize: 10, color: isHoje ? C.accent : C.muted, fontWeight: 700 }}>{fmt(d.total).replace("R$ ", "")}</div>}
                    <div style={{ width: "100%", height: altura, background: isHoje ? C.accent : `${C.accent}40`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                    <div style={{ fontSize: 10, color: isHoje ? C.accent : C.muted, fontWeight: isHoje ? 700 : 400 }}>{d.label}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div style={base.card}>
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
              color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}