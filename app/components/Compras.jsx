"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today, semEstoque } from "./shared/constants";
import MonthPicker from "./shared/MonthPicker";

// ─── FORNECEDORES E COMPRAS ──────────────────────────────
// Cada compra soma no estoque e (opcional) atualiza o custo do produto.
// Paga na hora: lança a saída no Financeiro. A pagar: fica na lista até marcar como paga.

const FORMAS = { pix: "PIX", dinheiro: "Dinheiro", boleto: "Boleto", cartao: "Cartão", transferencia: "Transferência" };
const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const dataBR = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const telWhats = (tel) => { const d = String(tel || "").replace(/\D/g, ""); return d ? (d.length <= 11 ? `55${d}` : d) : ""; };
const diasAte = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000);

const FORN_VAZIO = { nome: "", telefone: "", contato: "", observacao: "" };

export default function Compras() {
  const [aba, setAba] = useState("compras");
  const [periodo, setPeriodo] = useState(today().slice(0, 7));
  const [compras, setCompras] = useState([]);
  const [aPagar, setAPagar] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [aberta, setAberta] = useState(null);       // compra expandida
  const [itensAberta, setItensAberta] = useState([]);
  const [aviso, setAviso] = useState("");

  // nova compra
  const [nova, setNova] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [dataCompra, setDataCompra] = useState(today());
  const [itens, setItens] = useState([]);           // [{ produto_id, nome_produto, quantidade, custo_unitario }]
  const [busca, setBusca] = useState("");
  const [atualizarCusto, setAtualizarCusto] = useState(true);
  const [statusPag, setStatusPag] = useState("paga");
  const [forma, setForma] = useState("pix");
  const [vencimento, setVencimento] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // pagar compra a pagar
  const [pagando, setPagando] = useState(null);
  const [formaPagar, setFormaPagar] = useState("pix");

  // fornecedor
  const [formForn, setFormForn] = useState(null);   // null fechado; {} novo; {id,...} edição

  const mostrarAviso = (m) => { setAviso(m); setTimeout(() => setAviso(""), 2500); };

  const load = useCallback(async () => {
    const inicio = `${periodo}-01`;
    const fim = new Date(`${periodo}-01T00:00:00`); fim.setMonth(fim.getMonth() + 1);
    const fimStr = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-01`;
    const [{ data: cs }, { data: ap }, { data: fs }] = await Promise.all([
      supabase.from("compras").select("*").gte("data", inicio).lt("data", fimStr).order("data", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("compras").select("*").eq("status", "a_pagar").order("vencimento", { ascending: true, nullsFirst: false }),
      supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    ]);
    setCompras(cs || []); setAPagar(ap || []); setFornecedores(fs || []);
  }, [periodo]);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
    setProdutos(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadProdutos(); }, [loadProdutos]);

  const temCusto = produtos.some(p => "preco_custo" in p);
  const totalNova = r2(itens.reduce((a, i) => a + num(i.quantidade) * num(i.custo_unitario), 0));
  const compradoMes = compras.reduce((a, c) => a + Number(c.total), 0);
  const totalAPagar = aPagar.reduce((a, c) => a + Number(c.total), 0);
  const vencendo = aPagar.filter(c => c.vencimento && diasAte(c.vencimento) <= 7);

  // ─── Nova compra ───────────────────────────────────────
  const abrirNova = () => {
    setFornecedorId(""); setDataCompra(today()); setItens([]); setBusca(""); setAtualizarCusto(true);
    setStatusPag("paga"); setForma("pix"); setVencimento(""); setObs(""); setErro(""); setNova(true);
  };

  const addProduto = (p) => {
    setItens(is => is.some(i => i.produto_id === p.id) ? is : [...is, {
      produto_id: p.id, nome_produto: p.nome, quantidade: "1",
      custo_unitario: p.preco_custo !== null && p.preco_custo !== undefined ? String(p.preco_custo) : "",
    }]);
    setBusca("");
  };
  const mudarItem = (idx, campo, val) => setItens(is => is.map((i, k) => k === idx ? { ...i, [campo]: val } : i));

  const salvarCompra = async () => {
    setErro("");
    const validos = itens.filter(i => num(i.quantidade) > 0);
    if (!validos.length) return setErro("Adicione pelo menos um produto com quantidade.");
    if (validos.some(i => i.custo_unitario === "" || num(i.custo_unitario) < 0)) return setErro("Coloque quanto custou cada produto (pode ser 0 se veio de brinde).");
    setSalvando(true);
    const forn = fornecedores.find(f => f.id === fornecedorId);
    const pagaAgora = statusPag === "paga";
    const { data: compra, error } = await supabase.from("compras").insert({
      fornecedor_id: forn?.id || null, fornecedor_nome: forn?.nome || null,
      data: dataCompra || today(), total: totalNova,
      status: pagaAgora ? "paga" : "a_pagar",
      forma_pagamento: pagaAgora ? forma : null,
      vencimento: pagaAgora ? null : (vencimento || null),
      pago_em: pagaAgora ? new Date().toISOString() : null,
      observacao: obs.trim() || null,
    }).select().single();
    if (error || !compra) { setSalvando(false); return setErro("Não foi possível salvar a compra. Tente de novo."); }

    await supabase.from("compra_itens").insert(validos.map(i => ({
      compra_id: compra.id, produto_id: i.produto_id, nome_produto: i.nome_produto,
      quantidade: num(i.quantidade), custo_unitario: num(i.custo_unitario), subtotal: r2(num(i.quantidade) * num(i.custo_unitario)),
    })));

    // Estoque sobe e o custo fica atualizado
    const { data: atuais } = await supabase.from("produtos").select("*").in("id", validos.map(i => i.produto_id));
    for (const i of validos) {
      const p = (atuais || []).find(x => x.id === i.produto_id);
      if (!p) continue;
      const dados = {};
      if (!semEstoque(p)) dados.estoque_atual = Number(p.estoque_atual || 0) + num(i.quantidade);
      if (atualizarCusto && "preco_custo" in p) dados.preco_custo = num(i.custo_unitario);
      if (Object.keys(dados).length) await supabase.from("produtos").update(dados).eq("id", p.id);
      if (!semEstoque(p)) await supabase.from("estoque_movimentacoes").insert({ produto_id: p.id, tipo: "entrada", quantidade: num(i.quantidade), motivo: `compra #${compra.numero}${forn ? ` · ${forn.nome}` : ""}` });
    }

    if (pagaAgora) {
      await supabase.from("financeiro").insert({ tipo: "saida", descricao: `Compra #${compra.numero}${forn ? ` - ${forn.nome}` : ""}`, valor: totalNova, categoria: "compras", data: dataCompra || today() });
    }

    setSalvando(false); setNova(false); load(); loadProdutos();
    mostrarAviso(`Compra #${compra.numero} registrada · estoque atualizado`);
  };

  // ─── Pagar compra a pagar ──────────────────────────────
  const confirmarPagamento = async () => {
    const c = pagando; if (!c) return;
    await supabase.from("compras").update({ status: "paga", forma_pagamento: formaPagar, pago_em: new Date().toISOString() }).eq("id", c.id);
    await supabase.from("financeiro").insert({ tipo: "saida", descricao: `Compra #${c.numero}${c.fornecedor_nome ? ` - ${c.fornecedor_nome}` : ""}`, valor: c.total, categoria: "compras", data: today() });
    setPagando(null); load(); mostrarAviso(`Compra #${c.numero} paga · lançada no Financeiro`);
  };

  const abrirItens = async (c) => {
    if (aberta === c.id) { setAberta(null); return; }
    setAberta(c.id); setItensAberta([]);
    const { data } = await supabase.from("compra_itens").select("*").eq("compra_id", c.id);
    setItensAberta(data || []);
  };

  // ─── Fornecedores ──────────────────────────────────────
  const salvarFornecedor = async () => {
    if (!formForn?.nome?.trim()) return;
    const dados = { nome: formForn.nome.trim(), telefone: formForn.telefone?.trim() || null, contato: formForn.contato?.trim() || null, observacao: formForn.observacao?.trim() || null };
    if (formForn.id) await supabase.from("fornecedores").update(dados).eq("id", formForn.id);
    else await supabase.from("fornecedores").insert(dados);
    setFormForn(null); load();
  };
  const desativarFornecedor = async (f) => {
    await supabase.from("fornecedores").update({ ativo: false }).eq("id", f.id);
    load();
  };

  const filtrados = busca.trim() ? produtos.filter(p => semAcento(p.nome).includes(semAcento(busca.trim())) || String(p.codigo_barras || "") === busca.trim()).slice(0, 8) : [];
  const compradoPorFornecedor = (id) => compras.filter(c => c.fornecedor_id === id).reduce((a, c) => a + Number(c.total), 0);

  const abaBtn = (id, label) => (
    <button key={id} onClick={() => setAba(id)} style={{
      padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
      border: `2px solid ${aba === id ? C.accent : C.border}`, background: aba === id ? C.accentBg : C.card2, color: aba === id ? C.accent : C.muted,
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...base.pageTitle, marginBottom: 0 }}>🚚 Compras</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={base.btn(C.card2, C.text)} onClick={() => setFormForn({ ...FORN_VAZIO })}>+ Fornecedor</button>
          <button style={base.btn()} onClick={abrirNova}>+ Nova compra</button>
        </div>
      </div>

      {aviso && <div style={base.alert(C.green)}>✅ {aviso}</div>}
      {vencendo.length > 0 && (
        <div style={base.alert(C.red)}>⏰ {vencendo.length} conta{vencendo.length > 1 ? "s" : ""} de fornecedor vencendo em até 7 dias: {fmt(vencendo.reduce((a, c) => a + Number(c.total), 0))}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {abaBtn("compras", "🧾 Compras")}
        {abaBtn("fornecedores", `🏭 Fornecedores (${fornecedores.length})`)}
      </div>

      {aba === "compras" && (
        <>
          <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Comprado no mês", val: fmt(compradoMes), cor: C.accent, sub: `${compras.length} compra${compras.length === 1 ? "" : "s"}` },
              { label: "A pagar a fornecedores", val: fmt(totalAPagar), cor: totalAPagar > 0 ? C.red : C.green, sub: `${aPagar.length} em aberto` },
              { label: "Vence em até 7 dias", val: fmt(vencendo.reduce((a, c) => a + Number(c.total), 0)), cor: vencendo.length ? C.red : C.muted, sub: vencendo.length ? `${vencendo.length} conta(s)` : "nada vencendo" },
            ].map(s => (
              <div key={s.label} style={base.card}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.cor }}>{s.val}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {aPagar.length > 0 && (
            <div style={{ ...base.card, marginBottom: 16 }}>
              <div style={base.sectionTitle}>💸 Contas a pagar</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {aPagar.map(c => {
                  const d = c.vencimento ? diasAte(c.vencimento) : null;
                  const cor = d === null ? C.muted : d < 0 ? C.red : d <= 7 ? "#f97316" : C.muted;
                  return (
                    <div key={c.id} style={{ ...base.row, justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>#{c.numero} · {c.fornecedor_nome || "Sem fornecedor"} · {fmt(c.total)}</div>
                        <div style={{ fontSize: 12, color: cor }}>{c.vencimento ? (d < 0 ? `venceu há ${-d} dia(s) · ${dataBR(c.vencimento)}` : d === 0 ? "vence hoje" : `vence em ${d} dia(s) · ${dataBR(c.vencimento)}`) : "sem vencimento"} · comprado em {dataBR(c.data)}</div>
                      </div>
                      <button style={base.btnSm(C.green, "#fff")} onClick={() => { setPagando(c); setFormaPagar("pix"); }}>✅ Paguei</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={base.card}>
            <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ ...base.sectionTitle, marginBottom: 0 }}>📦 Compras do mês</div>
              <MonthPicker value={periodo} onChange={setPeriodo} />
            </div>
            {compras.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>Nenhuma compra neste mês. Clique em “+ Nova compra” quando chegar mercadoria.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {compras.map(c => (
                <div key={c.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ ...base.row, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>#{c.numero} · {c.fornecedor_nome || "Sem fornecedor"}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{dataBR(c.data)}{c.forma_pagamento ? ` · ${FORMAS[c.forma_pagamento] || c.forma_pagamento}` : ""}{c.observacao ? ` · ${c.observacao}` : ""}</div>
                    </div>
                    <div style={{ ...base.row, gap: 8 }}>
                      <span style={base.tag(c.status === "paga" ? C.green : C.red)}>{c.status === "paga" ? "paga" : "a pagar"}</span>
                      <span style={{ fontWeight: 900, color: C.accent }}>{fmt(c.total)}</span>
                      <button style={base.btnSm(C.card, C.text)} onClick={() => abrirItens(c)}>{aberta === c.id ? "▲" : "▼ Itens"}</button>
                    </div>
                  </div>
                  {aberta === c.id && (
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 8 }}>
                      {itensAberta.map(i => (
                        <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span style={{ color: C.text }}>{Number(i.quantidade).toLocaleString("pt-BR")} × {i.nome_produto} <span style={{ color: C.muted }}>({fmt(i.custo_unitario)} cada)</span></span>
                          <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</span>
                        </div>
                      ))}
                      {itensAberta.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Carregando…</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {aba === "fornecedores" && (
        <div style={base.card}>
          {fornecedores.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>Nenhum fornecedor cadastrado ainda.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {fornecedores.map(f => (
              <div key={f.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, color: C.text, marginBottom: 4 }}>🏭 {f.nome}</div>
                {f.contato && <div style={{ fontSize: 12, color: C.muted }}>👤 {f.contato}</div>}
                {f.telefone && <div style={{ fontSize: 12, color: C.muted }}>📞 {f.telefone}</div>}
                {f.observacao && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{f.observacao}</div>}
                <div style={{ fontSize: 12, color: C.accent, margin: "8px 0" }}>Comprado no mês: <strong>{fmt(compradoPorFornecedor(f.id))}</strong></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {f.telefone && <button style={base.btnSm(C.green, "#fff")} onClick={() => window.open(`https://wa.me/${telWhats(f.telefone)}`, "_blank")}>💬 WhatsApp</button>}
                  <button style={base.btnSm(C.blue, "#fff")} onClick={() => setFormForn({ ...f })}>✏️ Editar</button>
                  <button style={base.btnSm(C.card, C.red)} onClick={() => desativarFornecedor(f)}>Remover</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: nova compra */}
      {nova && (
        <div style={base.modal} onClick={() => !salvando && setNova(false)}>
          <div style={{ ...base.modalBox, maxWidth: 760, maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>🚚 Nova compra</div>
              <button onClick={() => setNova(false)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={base.label}>Fornecedor</label>
                <select style={base.select} value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                  <option value="">Sem fornecedor</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={base.label}>Data</label>
                <input style={base.input} type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
              </div>
            </div>

            <label style={base.label}>Produtos que chegaram</label>
            <input style={base.input} placeholder="🔍 Digite o nome ou bipe o código…" value={busca} onChange={e => setBusca(e.target.value)} />
            {filtrados.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {filtrados.map(p => (
                  <button key={p.id} onClick={() => addProduto(p)} style={{ display: "flex", justifyContent: "space-between", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 13, color: C.text }}>{p.nome}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{semEstoque(p) ? "sem controle de estoque" : `estoque: ${p.estoque_atual} ${p.unidade || ""}`}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {itens.length === 0 && <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Nenhum produto ainda</div>}
              {itens.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px 90px 30px", gap: 6, fontSize: 11, color: C.muted, marginBottom: 4 }}>
                  <span>Produto</span><span>Qtd</span><span>Custo de cada (R$)</span><span style={{ textAlign: "right" }}>Subtotal</span><span />
                </div>
              )}
              {itens.map((i, idx) => (
                <div key={i.produto_id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px 90px 30px", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.text }}>{i.nome_produto}</span>
                  <input style={base.input} type="number" inputMode="decimal" value={i.quantidade} onChange={e => mudarItem(idx, "quantidade", e.target.value)} />
                  <input style={base.input} type="number" inputMode="decimal" placeholder="0,00" value={i.custo_unitario} onChange={e => mudarItem(idx, "custo_unitario", e.target.value)} />
                  <span style={{ fontSize: 13, color: C.accent, fontWeight: 700, textAlign: "right" }}>{fmt(num(i.quantidade) * num(i.custo_unitario))}</span>
                  <button onClick={() => setItens(is => is.filter((_, k) => k !== idx))} style={{ ...base.btnSm(C.card, C.red), padding: "4px 8px" }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 6 }}>
                <span>Total da compra</span><span style={{ color: C.accent }}>{fmt(totalNova)}</span>
              </div>
            </div>

            {temCusto && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontSize: 13, cursor: "pointer", margin: "12px 0" }}>
                <input type="checkbox" checked={atualizarCusto} onChange={e => setAtualizarCusto(e.target.checked)} />
                Atualizar o custo dos produtos com o valor desta compra <span style={{ color: C.muted, fontSize: 11 }}>(mantém o lucro certo)</span>
              </label>
            )}

            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              {[{ id: "paga", label: "✅ Paguei agora" }, { id: "a_pagar", label: "📅 Vou pagar depois" }].map(o => (
                <button key={o.id} onClick={() => setStatusPag(o.id)} style={{
                  flex: 1, padding: 10, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  border: `2px solid ${statusPag === o.id ? C.accent : C.border}`, background: statusPag === o.id ? C.accentBg : C.card2, color: statusPag === o.id ? C.accent : C.muted,
                }}>{o.label}</button>
              ))}
            </div>
            {statusPag === "paga" ? (
              <div style={{ marginBottom: 10 }}>
                <label style={base.label}>Como pagou?</label>
                <select style={base.select} value={forma} onChange={e => setForma(e.target.value)}>
                  {Object.entries(FORMAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Entra como saída no Financeiro.</div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <label style={base.label}>Vencimento</label>
                <input style={base.input} type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Fica em “Contas a pagar” até você marcar como paga.</div>
              </div>
            )}
            <label style={base.label}>Observação</label>
            <input style={base.input} placeholder="Ex.: nota 1234, boleto em 28 dias" value={obs} onChange={e => setObs(e.target.value)} />

            {erro && <div style={{ ...base.alert(C.red), marginTop: 12, marginBottom: 0 }}>{erro}</div>}
            <button style={{ ...base.btn(C.green, "#fff"), width: "100%", padding: 13, fontSize: 15, marginTop: 14 }} onClick={salvarCompra} disabled={salvando}>
              {salvando ? "Salvando..." : `Registrar compra · ${fmt(totalNova)}`}
            </button>
          </div>
        </div>
      )}

      {/* Modal: pagar */}
      {pagando && (
        <div style={base.modal} onClick={() => setPagando(null)}>
          <div style={base.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>✅ Pagar compra #{pagando.numero}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{pagando.fornecedor_nome || "Sem fornecedor"} · {fmt(pagando.total)}</div>
            <label style={base.label}>Como pagou?</label>
            <select style={{ ...base.select, marginBottom: 16 }} value={formaPagar} onChange={e => setFormaPagar(e.target.value)}>
              {Object.entries(FORMAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={base.row}>
              <button style={{ ...base.btn(C.green, "#fff"), flex: 1 }} onClick={confirmarPagamento}>Confirmar pagamento</button>
              <button style={base.btnOutline} onClick={() => setPagando(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: fornecedor */}
      {formForn && (
        <div style={base.modal} onClick={() => setFormForn(null)}>
          <div style={base.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 14 }}>🏭 {formForn.id ? "Editar fornecedor" : "Novo fornecedor"}</div>
            {[
              { k: "nome", l: "Nome *", ph: "Ex.: Distribuidora Ambev Campinas" },
              { k: "contato", l: "Vendedor / contato", ph: "Ex.: João" },
              { k: "telefone", l: "WhatsApp", ph: "(19) 99999-9999" },
              { k: "observacao", l: "Observação", ph: "Ex.: entrega terça e sexta, pedido mínimo R$ 500" },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 10 }}>
                <label style={base.label}>{f.l}</label>
                <input style={base.input} placeholder={f.ph} value={formForn[f.k] || ""} onChange={e => setFormForn({ ...formForn, [f.k]: e.target.value })} />
              </div>
            ))}
            <div style={{ ...base.row, marginTop: 6 }}>
              <button style={{ ...base.btn(C.green, "#fff"), flex: 1 }} onClick={salvarFornecedor}>Salvar</button>
              <button style={base.btnOutline} onClick={() => setFormForn(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
