"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today } from "./shared/constants";
import MonthPicker from "./shared/MonthPicker";

export default function Relatorios() {
  const [vendas, setVendas] = useState([]);
  const [periodo, setPeriodo] = useState(today().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const inicio = periodo + "-01";
    const fim = new Date(periodo + "-01");
    fim.setMonth(fim.getMonth() + 1);
    const { data } = await supabase.from("vendas").select("*, venda_itens(*)").eq("status", "concluida").gte("created_at", inicio).lt("created_at", fim.toISOString().split("T")[0]).order("created_at", { ascending: false });
    setVendas(data || []);
    setLoading(false);
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const formas = ["pix", "dinheiro", "cartao_debito", "cartao_credito"];
  const formaNome = { pix: "PIX", dinheiro: "Dinheiro", cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito" };
  const formaCor = { pix: C.blue, dinheiro: C.green, cartao_debito: "#a855f7", cartao_credito: "#f97316" };

  const totalGeral = vendas.reduce((a, v) => a + Number(v.total), 0);
  const ticketMedio = vendas.length > 0 ? totalGeral / vendas.length : 0;

  const porPagamento = formas.map(forma => {
    const itens = vendas.filter(v => v.forma_pagamento === forma);
    return { forma, quantidade: itens.length, total: itens.reduce((a, v) => a + Number(v.total), 0) };
  }).filter(p => p.quantidade > 0);

  const porDia = Object.values(vendas.reduce((acc, v) => {
    const dia = v.created_at?.split("T")[0];
    if (!acc[dia]) acc[dia] = { dia, quantidade: 0, total: 0 };
    acc[dia].quantidade += 1;
    acc[dia].total += Number(v.total);
    return acc;
  }, {})).sort((a, b) => b.dia.localeCompare(a.dia));

  const produtosVendidos = {};
  vendas.forEach(v => {
    (v.venda_itens || []).forEach(i => {
      if (!produtosVendidos[i.nome_produto]) produtosVendidos[i.nome_produto] = { nome: i.nome_produto, quantidade: 0, total: 0 };
      produtosVendidos[i.nome_produto].quantidade += i.quantidade;
      produtosVendidos[i.nome_produto].total += Number(i.subtotal);
    });
  });
  const topProdutos = Object.values(produtosVendidos).sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20 }}>
        <div style={base.pageTitle}>📈 Relatórios</div>
        <MonthPicker value={periodo} onChange={setPeriodo} />
      </div>

      {loading && <div style={{ ...base.card, textAlign: "center", color: C.muted, padding: 40 }}>Carregando...</div>}

      {!loading && (
        <>
          <div className="grid-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
            {[
              { label: "Total Faturado", val: fmt(totalGeral), color: C.accent, icon: "💰" },
              { label: "Nº de Vendas", val: vendas.length, color: C.blue, icon: "🧾" },
              { label: "Ticket Médio", val: fmt(ticketMedio), color: C.green, icon: "📊" },
              { label: "Melhor Dia", val: porDia.length > 0 ? fmt(Math.max(...porDia.map(d => d.total))) : "R$ 0,00", color: "#f97316", icon: "🏆" },
            ].map((c, i) => (
              <div key={i} style={base.card}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.val}</div>
              </div>
            ))}
          </div>

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
                      <div style={{ background: cor, borderRadius: 100, height: 6, width: `${pct}%` }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, textAlign: "right" }}>{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>

            <div style={base.card}>
              <div style={base.sectionTitle}>🏆 Produtos Mais Vendidos</div>
              {topProdutos.map((p, i) => (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? C.accent : i === 1 ? "#9ca3af" : i === 2 ? "#c49a00" : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: i < 3 ? "#000" : C.muted, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.quantidade} un</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{fmt(p.total)}</div>
                </div>
              ))}
              {topProdutos.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>Sem dados no período</div>}
            </div>
          </div>

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
                {porDia.map(d => (
                  <tr key={d.dia}>
                    <td style={base.td}>{new Date(d.dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                    <td style={base.td}>{d.quantidade}</td>
                    <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(d.total)}</td>
                    <td style={{ ...base.td, color: C.green }}>{fmt(d.total / d.quantidade)}</td>
                  </tr>
                ))}
                {porDia.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda no período</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}