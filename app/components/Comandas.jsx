"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, C, base, fmt, hora } from "./shared/constants";
import TrocoCalculator from "./shared/TrocoCalculator";

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
  const podeConfirmar = modo === "total" || Math.abs(diferenca) < 0.01;

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              {formas.map(f => (
                <button key={f.value} onClick={() => setPagamento(f.value)} style={{
                  padding: "10px 0", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12,
                  border: `2px solid ${pagamento === f.value ? f.cor : C.border}`,
                  background: pagamento === f.value ? `${f.cor}20` : C.card2,
                  color: pagamento === f.value ? f.cor : C.muted,
                }}>{f.label}</button>
              ))}
            </div>
            {pagamento === "dinheiro" && <TrocoCalculator total={totalComanda} />}
          </div>
        )}

        {/* MODO DIVIDIR */}
        {modo === "dividir" && (
          <div style={{ marginBottom: 16 }}>
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

            {/* Resumo divisão */}
            <div style={{ background: Math.abs(diferenca) < 0.01 ? `${C.green}15` : `${C.red}15`, border: `1px solid ${Math.abs(diferenca) < 0.01 ? C.green : C.red}40`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted }}>Total dividido</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{fmt(totalDividido)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: C.muted }}>{Math.abs(diferenca) < 0.01 ? "✅ Fechado" : diferenca > 0 ? "⚠️ Faltam" : "⚠️ Excesso"}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: Math.abs(diferenca) < 0.01 ? C.green : C.red }}>
                  {Math.abs(diferenca) < 0.01 ? "Tudo certo!" : fmt(Math.abs(diferenca))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={base.row}>
          <button
            style={{ ...base.btn(podeConfirmar ? C.green : C.muted, "#fff"), flex: 1, padding: "13px", fontSize: 15, opacity: podeConfirmar ? 1 : 0.5 }}
            onClick={podeConfirmar ? onConfirmar : undefined}
            disabled={loading || !podeConfirmar}
          >
            {loading ? "Processando..." : "✅ Confirmar Pagamento"}
          </button>
          <button style={base.btnOutline} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── COMANDAS ────────────────────────────────────────────
export default function Comandas() {
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
  const [adicionando, setAdicionando] = useState(false);
  const [ultimoAdicionado, setUltimoAdicionado] = useState(null);
  const atualizandoManual = useRef(false);

  const loadComandas = useCallback(async () => {
    const { data } = await supabase.from("comandas").select("*, comanda_itens(*)").eq("status", "aberta").order("created_at", { ascending: false });
    setComandas(data || []);
  }, []);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    setProdutos(data || []);
  }, []);

  useEffect(() => {
    loadComandas();
    loadProdutos();

    const channel = supabase.channel("comandas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => {
        if (!atualizandoManual.current) loadComandas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comanda_itens" }, () => {
        if (atualizandoManual.current) return;
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

  const abrirComanda = async () => {
    if (!nomeCliente) return;
    await supabase.from("comandas").insert({ nome_cliente: nomeCliente, mesa: mesa || null, status: "aberta", total: 0 });
    setNomeCliente(""); setMesa(""); setModalNova(false);
    loadComandas();
  };

  const selecionarComanda = async (c) => {
    setSelected(c);
    const { data } = await supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", c.id);
    setItens(data || []);
  };

  const adicionarItem = async (produto) => {
    if (!selected || adicionando) return;
    setAdicionando(true);
    atualizandoManual.current = true;

    const { data: prodAtual } = await supabase.from("produtos").select("estoque_atual").eq("id", produto.id).single();
    if (!prodAtual || prodAtual.estoque_atual <= 0) { atualizandoManual.current = false; setAdicionando(false); return; }

    const existente = itens.find(i => i.produto_id === produto.id);
    if (existente) {
      await supabase.from("comanda_itens").update({ quantidade: existente.quantidade + 1, subtotal: (existente.quantidade + 1) * Number(produto.preco) }).eq("id", existente.id);
    } else {
      await supabase.from("comanda_itens").insert({ comanda_id: selected.id, produto_id: produto.id, quantidade: 1, preco_unitario: produto.preco, subtotal: produto.preco });
    }

    await supabase.from("produtos").update({ estoque_atual: prodAtual.estoque_atual - 1 }).eq("id", produto.id);

    const [{ data: itensAtualizados }, { data: produtosAtualizados }] = await Promise.all([
      supabase.from("comanda_itens").select("*, produtos(nome, preco)").eq("comanda_id", selected.id),
      supabase.from("produtos").select("*").eq("ativo", true).order("categoria"),
    ]);

    setItens(itensAtualizados || []);
    setProdutos(produtosAtualizados || []);
    const total = (itensAtualizados || []).reduce((a, i) => a + Number(i.subtotal), 0);
    await supabase.from("comandas").update({ total }).eq("id", selected.id);
    loadComandas();

    // Feedback visual
    setUltimoAdicionado(produto.nome);
    setTimeout(() => setUltimoAdicionado(null), 1500);

    atualizandoManual.current = false;
    setAdicionando(false);
  };

  const removerItem = async (item) => {
    await supabase.from("comanda_itens").delete().eq("id", item.id);
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

      {/* Layout responsivo */}
      <style>{`
        @media (max-width: 768px) {
          .comanda-lista { display: ${selected ? "none" : "block"} !important; }
          .comanda-detalhe { display: ${selected ? "block" : "none"} !important; }
          .comanda-grid { grid-template-columns: 1fr !important; }
          .comanda-table { display: none !important; }
          .comanda-cards { display: flex !important; }
        }
        @media (min-width: 769px) {
          .comanda-cards { display: none !important; }
        }
      `}</style>

      <div className="comanda-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        {/* Lista */}
        <div className="comanda-lista">
          <div style={base.sectionTitle}>Abertas ({comandas.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comandas.map(c => (
              <div key={c.id} onClick={() => selecionarComanda(c)} style={{ ...base.card, cursor: "pointer", borderColor: selected?.id === c.id ? C.accent : C.border, borderWidth: selected?.id === c.id ? 2 : 1 }}>
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
            {comandas.length === 0 && <div style={{ ...base.card, textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>Nenhuma comanda aberta</div>}
          </div>
        </div>

        {/* Detalhe */}
        <div className="comanda-detalhe">
          {selected ? (
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

              {/* Cards mobile */}
              <div className="comanda-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
                {itens.map(i => (
                  <div key={i.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 2 }}>{i.produtos?.nome || "—"}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{i.quantidade}x · {fmt(i.preco_unitario)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: C.accent, fontSize: 15 }}>{fmt(i.subtotal)}</span>
                      <button style={base.btnSm(C.red, "#fff")} onClick={() => removerItem(i)}>✕</button>
                    </div>
                  </div>
                ))}
                {itens.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 13 }}>Nenhum item ainda</div>}
              </div>

              {/* Tabela desktop */}
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
                      <td style={base.td}><button style={base.btnSm(C.red, "#fff")} onClick={() => removerItem(i)}>✕</button></td>
                    </tr>
                  ))}
                  {itens.length === 0 && <tr><td colSpan={5} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum item ainda</td></tr>}
                </tbody>
              </table>

              {itens.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>Total: <span style={{ color: C.accent }}>{fmt(totalComanda)}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...base.card, textAlign: "center", color: C.muted, fontSize: 13, padding: 60 }}>
              Selecione uma comanda ao lado
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

      {/* Modal Adicionar Item */}
      {modalPedido && (
        <div style={base.modal}>
          <div style={{ ...base.modalBox, maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Adicionar Item</div>
              <button style={base.btnSm(C.card2, C.muted)} onClick={() => setModalPedido(false)}>✕ Fechar</button>
            </div>

            {/* Toast de confirmação */}
            {ultimoAdicionado && (
              <div style={{ background: `${C.green}20`, border: `1px solid ${C.green}50`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.green, fontWeight: 600, animation: "fadeIn 0.2s ease" }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                ✅ {ultimoAdicionado} adicionado!
              </div>
            )}
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
                          style={{ background: esgotado ? "#111100" : C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", cursor: esgotado ? "not-allowed" : "pointer", textAlign: "left", opacity: esgotado ? 0.5 : 1, position: "relative", WebkitTapHighlightColor: "transparent", transition: "background 0.2s" }}>
                          {esgotado && <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700, color: "#a855f7", background: "#a855f720", padding: "2px 6px", borderRadius: 4 }}>ESGOTADO</div>}
                          {adicionando && ultimoAdicionado === null && <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700, color: C.accent, background: `${C.accent}20`, padding: "2px 6px", borderRadius: 4 }}>...</div>}
                          <div style={{ fontSize: 13, fontWeight: 600, color: esgotado ? C.muted : C.text, marginBottom: 2 }}>{p.nome}</div>
                          <div style={{ fontSize: 13, color: esgotado ? C.muted : C.accent, fontWeight: 800 }}>{fmt(p.preco)}</div>
                          <div style={{ fontSize: 11, color: esgotado ? "#a855f7" : p.estoque_atual <= p.estoque_minimo ? C.red : C.muted, marginTop: 2 }}>estoque: {p.estoque_atual}</div>
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