"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt } from "./shared/constants";

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ nome: "", categoria: "bebida", preco: "", estoque_atual: "", estoque_minimo: "5", unidade: "un" });
  const [showForm, setShowForm] = useState(false);
  const [entradaModal, setEntradaModal] = useState(null);
  const [qtdEntrada, setQtdEntrada] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [erroForm, setErroForm] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    setProdutos(data || []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("estoque-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const esgotados = produtos.filter(p => p.estoque_atual === 0);
  const baixos = produtos.filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);

  const salvar = async () => {
    if (!form.nome || !form.preco) return;
    const { data: existente } = await supabase.from("produtos").select("id").eq("nome", form.nome).eq("ativo", true).single();
    if (existente) { setErroForm(`Já existe um produto com o nome "${form.nome}".`); return; }
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

  const salvarEdicao = async () => {
    if (!editModal) return;
    await supabase.from("produtos").update({ ...editForm, preco: Number(editForm.preco), estoque_minimo: Number(editForm.estoque_minimo) }).eq("id", editModal.id);
    setEditModal(null); load();
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

      {esgotados.length > 0 && <div style={base.alert("#a855f7")}>🚫 <strong>{esgotados.length} esgotado(s):</strong> {esgotados.map(p => p.nome).join(", ")}</div>}
      {baixos.length > 0 && <div style={base.alert(C.red)}>⚠️ <strong>{baixos.length} estoque baixo:</strong> {baixos.map(p => p.nome).join(", ")}</div>}

      {showForm && (
        <div style={{ ...base.card, marginBottom: 16 }}>
          <div style={base.sectionTitle}>Novo Produto</div>
          <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
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
            <button style={base.btn(C.green, "#fff")} onClick={salvar}>Salvar</button>
            <button style={base.btnOutline} onClick={() => { setShowForm(false); setErroForm(""); }}>Cancelar</button>
          </div>
          {erroForm && <div style={{ ...base.alert(C.red), marginTop: 12, marginBottom: 0 }}>⚠️ {erroForm}</div>}
        </div>
      )}

      {/* Modal Entrada */}
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

      {/* Modal Editar */}
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

      {/* Tabela desktop / Cards mobile */}
      <div style={base.card}>
        <style>{`
          @media (max-width: 768px) { .estoque-table { display: none !important; } .estoque-cards { display: flex !important; } }
          @media (min-width: 769px) { .estoque-cards { display: none !important; } }
        `}</style>

        {/* Cards mobile */}
        <div className="estoque-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
          {produtos.map(p => {
            const esgotado = p.estoque_atual === 0;
            const baixo = !esgotado && p.estoque_atual <= p.estoque_minimo;
            const statusCor = esgotado ? "#a855f7" : baixo ? C.red : C.green;
            const statusLabel = esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
            return (
              <div key={p.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{p.nome}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={base.tag(C.accent)}>{p.categoria}</span>
                      <span style={base.tag(statusCor)}>{statusLabel}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>{fmt(p.preco)}</div>
                    <div style={{ color: esgotado ? "#a855f7" : C.text, fontWeight: 700, fontSize: 13 }}>{p.estoque_atual} {p.unidade}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={base.btnSm(C.blue, "#fff")} onClick={() => { setEditModal(p); setEditForm({ nome: p.nome, categoria: p.categoria, preco: p.preco, estoque_minimo: p.estoque_minimo, unidade: p.unidade }); }}>✏️ Editar</button>
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
              const statusCor = esgotado ? "#a855f7" : baixo ? C.red : C.green;
              const statusLabel = esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
              return (
                <tr key={p.id}>
                  <td style={base.td}>{p.nome}</td>
                  <td style={base.td}><span style={base.tag(C.accent)}>{p.categoria}</span></td>
                  <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(p.preco)}</td>
                  <td style={{ ...base.td, fontWeight: 700, color: esgotado ? "#a855f7" : C.text }}>{p.estoque_atual} {p.unidade}</td>
                  <td style={base.td}>{p.estoque_minimo}</td>
                  <td style={base.td}><span style={base.tag(statusCor)}>{statusLabel}</span></td>
                  <td style={base.td}>
                    <div style={base.row}>
                      <button style={base.btnSm(C.blue, "#fff")} onClick={() => { setEditModal(p); setEditForm({ nome: p.nome, categoria: p.categoria, preco: p.preco, estoque_minimo: p.estoque_minimo, unidade: p.unidade }); }}>✏️ Editar</button>
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