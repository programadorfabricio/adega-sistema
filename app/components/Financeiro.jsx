"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today } from "./shared/constants";
import MonthPicker from "./shared/MonthPicker";

export default function Financeiro() {
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
    const channel = supabase.channel("financeiro-rt")
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
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
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
          <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
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
              <input style={base.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="compras, aluguel..." />
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