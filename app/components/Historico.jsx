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
  const [aba, setAba] = useState("vendas");
  const [comandasFechadas, setComandasFechadas] = useState([]);
  const [selectedComanda, setSelectedComanda] = useState(null);
  const [itensComanda, setItensComanda] = useState([]);

  const loadVendas = useCallback(async () => {
    const { data } = await supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(50);
    setVendas(data || []);
  }, []);

  const loadComandasFechadas = useCallback(async () => {
    const { data } = await supabase.from("comandas").select("*, comanda_itens(*, produtos(nome))").eq("status", "fechada").order("created_at", { ascending: false }).limit(50);
    setComandasFechadas(data || []);
  }, []);

  useEffect(() => {
    loadVendas();
    loadComandasFechadas();
    const channel = supabase.channel("historico-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, loadVendas)
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, loadComandasFechadas)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadVendas, loadComandasFechadas]);

  const verDetalhes = async (v) => {
    if (selected?.id === v.id) { setSelected(null); setItens([]); return; }
    setSelected(v);
    const { data } = await supabase.from("venda_itens").select("*").eq("venda_id", v.id);
    setItens(data || []);
  };

  const verDetalhesComanda = (c) => {
    if (selectedComanda?.id === c.id) { setSelectedComanda(null); setItensComanda([]); return; }
    setSelectedComanda(c);
    setItensComanda(c.comanda_itens || []);
  };

  const totalDia = vendas.filter(v => v.created_at?.startsWith(today())).reduce((a, v) => a + Number(v.total), 0);

  const vendasFiltradas = vendas
    .filter(v => filtroPagamento === "todos" || v.forma_pagamento === filtroPagamento)
    .filter(v => !busca || fmt(v.total).includes(busca) || v.forma_pagamento?.includes(busca.toLowerCase()))
    .filter(v => !dataInicio || v.created_at?.slice(0, 10) >= dataInicio)
    .filter(v => !dataFim || v.created_at?.slice(0, 10) <= dataFim);

  return (
    <div>
      <div style={base.pageTitle}>Histórico</div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{ id: "vendas", label: "⚡ Vendas" }, { id: "comandas", label: "🍺 Comandas Fechadas" }].map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)} style={{
            padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
            border: `2px solid ${aba === tab.id ? C.accent : C.border}`,
            background: aba === tab.id ? C.accentBg : C.card2,
            color: aba === tab.id ? C.accent : C.muted,
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ ...base.card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Faturamento Hoje</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>{fmt(totalDia)}</div>
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>{vendas.filter(v => v.created_at?.startsWith(today())).length} vendas hoje</div>
      </div>

      {aba === "vendas" && (
        <>
          <div style={{ ...base.card, marginBottom: 16 }}>
            <input style={{ ...base.input, marginBottom: 10 }} placeholder="🔍 Buscar por valor..." value={busca} onChange={e => setBusca(e.target.value)} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <input type="date" style={{ ...base.input, flex: 1 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              <span style={{ color: C.muted, fontSize: 13 }}>até</span>
              <input type="date" style={{ ...base.input, flex: 1 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
              {(dataInicio || dataFim) && <button onClick={() => { setDataInicio(""); setDataFim(""); }} style={base.btnSm(C.red, "#fff")}>✕ Limpar</button>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ val: "todos", label: "Todos" }, { val: "pix", label: "PIX" }, { val: "dinheiro", label: "Dinheiro" }, { val: "cartao_debito", label: "Débito" }, { val: "cartao_credito", label: "Crédito" }].map(f => (
                <button key={f.val} onClick={() => setFiltroPagamento(f.val)} style={{ ...base.btnSm(filtroPagamento === f.val ? C.accent : C.card2, filtroPagamento === f.val ? "#000" : C.muted), border: `1px solid ${filtroPagamento === f.val ? C.accent : C.border}`, padding: "8px 14px", fontSize: 13 }}>{f.label}</button>
              ))}
            </div>
          </div>

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
                  <>
                    <tr key={v.id} style={{ background: selected?.id === v.id ? C.accentBg : "transparent" }}>
                      <td style={base.td}>{dataHora(v.created_at)}</td>
                      <td style={base.td}><span style={base.tag(C.accent)}>{v.forma_pagamento || "—"}</span></td>
                      <td style={{ ...base.td, color: C.green, fontWeight: 700 }}>{fmt(v.total)}</td>
                      <td style={base.td}>
                        <button style={base.btnSm(selected?.id === v.id ? C.card2 : C.accent, selected?.id === v.id ? C.muted : "#000")} onClick={() => verDetalhes(v)}>
                          {selected?.id === v.id ? "▲ Fechar" : "▼ Ver"}
                        </button>
                      </td>
                    </tr>
                    {selected?.id === v.id && (
                      <tr key={v.id + "-detail"}>
                        <td colSpan={4} style={{ padding: "0 0 12px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ background: C.card2, borderRadius: 10, padding: "14px 16px", margin: "0 0 4px 0" }}>
                            <div style={{ ...base.sectionTitle, marginBottom: 10 }}>Itens da venda</div>
                            {itens.map(i => (
                              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                                <span style={{ color: C.text }}>{i.nome_produto} × {i.quantidade}</span>
                                <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</span>
                              </div>
                            ))}
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                              <span style={{ color: C.text }}>Total</span>
                              <span style={{ color: C.accent }}>{fmt(v.total)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {vendasFiltradas.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma venda encontrada</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "comandas" && (
        <div style={base.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={base.th}>Data/Hora</th>
                <th style={base.th}>Cliente</th>
                <th style={base.th}>Atendente</th>
                <th style={base.th}>Total</th>
                <th style={base.th}></th>
              </tr>
            </thead>
            <tbody>
              {comandasFechadas.map(c => (
                <>
                  <tr key={c.id} style={{ background: selectedComanda?.id === c.id ? C.accentBg : "transparent" }}>
                    <td style={base.td}>{dataHora(c.created_at)}</td>
                    <td style={base.td}>{c.nome_cliente}</td>
                    <td style={base.td}><span style={base.tag(C.muted)}>{c.atendente_nome || "—"}</span></td>
                    <td style={{ ...base.td, color: C.green, fontWeight: 700 }}>{fmt(c.total)}</td>
                    <td style={base.td}>
                      <button style={base.btnSm(selectedComanda?.id === c.id ? C.card2 : C.accent, selectedComanda?.id === c.id ? C.muted : "#000")} onClick={() => verDetalhesComanda(c)}>
                        {selectedComanda?.id === c.id ? "▲ Fechar" : "▼ Ver"}
                      </button>
                    </td>
                  </tr>
                  {selectedComanda?.id === c.id && (
                    <tr key={c.id + "-detail"}>
                      <td colSpan={5} style={{ padding: "0 0 12px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ background: C.card2, borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ ...base.sectionTitle, marginBottom: 10 }}>Itens da comanda</div>
                          {itensComanda.map(i => (
                            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                              <span style={{ color: C.text }}>{i.produtos?.nome || "—"} × {i.quantidade}</span>
                              <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                            <span style={{ color: C.text }}>Total</span>
                            <span style={{ color: C.accent }}>{fmt(c.total)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {comandasFechadas.length === 0 && <tr><td colSpan={5} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhuma comanda fechada</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}