"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today, dataHora } from "./shared/constants";

export default function Historico() {
  const [vendas, setVendas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [itens, setItens] = useState([]);

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