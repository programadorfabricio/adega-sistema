"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today, dataHora } from "./shared/constants";

export default function Historico() {
  const [vendas, setVendas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const loadVendas = useCallback(async () => {
    const { data } = await supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(50);
    setVendas(data || []);
  }, []);

  useEffect(() => {
    loadVendas();
    const channel = supabase.channel("historico-rt")
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

  const vendasFiltradas = vendas
    .filter(v => filtroPagamento === "todos" || v.forma_pagamento === filtroPagamento)
    .filter(v => !busca || fmt(v.total).includes(busca) || v.forma_pagamento?.includes(busca.toLowerCase()))
    .filter(v => !dataInicio || v.created_at?.slice(0, 10) >= dataInicio)
    .filter(v => !dataFim || v.created_at?.slice(0, 10) <= dataFim);

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

      {/* Barra de filtros */}
      <div style={{ ...base.card, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...base.input, flex: 1, minWidth: 180 }} placeholder="🔍 Buscar por valor..." value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" style={{ ...base.input, width: "auto" }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          <span style={{ color: C.muted, fontSize: 13 }}>até</span>
          <input type="date" style={{ ...base.input, width: "auto" }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
          {(dataInicio || dataFim) && (
            <button onClick={() => { setDataInicio(""); setDataFim(""); }} style={base.btnSm(C.red, "#fff")}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { val: "todos", label: "Todos" },
            { val: "pix", label: "PIX" },
            { val: "dinheiro", label: "Dinheiro" },
            { val: "cartao_debito", label: "Débito" },
            { val: "cartao_credito", label: "Crédito" },
          ].map(f => (
            <button key={f.val} onClick={() => setFiltroPagamento(f.val)} style={{
              ...base.btnSm(filtroPagamento === f.val ? C.accent : C.card2, filtroPagamento === f.val ? "#000" : C.muted),
              border: `1px solid ${filtroPagamento === f.val ? C.accent : C.border}`,
              padding: "8px 14px", fontSize: 13,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16 }}>
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
              {vendasFiltradas.map(v => (
                <tr key={v.id} style={{ background: selected?.id === v.id ? C.accentBg : "transparent" }}>
                  <td style={base.td}>{dataHora(v.created_at)}</td>
                  <td style={base.td}><span style={base.tag(C.accent)}>{v.forma_pagamento || "—"}</span></td>
                  <td style={{ ...base.td, color: C.green, fontWeight: 700 }}>{fmt(v.total)}</td>
                  <td style={base.td}><button style={base.btnSm()} onClick={() => verDetalhes(v)}>Ver</button></td>
                </tr>
              ))}
              {vendasFiltradas.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda encontrada</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={base.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: C.text }}>Detalhes</div>
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