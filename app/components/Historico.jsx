"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, today, dataHora, SCHEMA } from "./shared/constants";
import { partesDaVenda, rotuloPagamento, BotoesPagamento } from "./shared/pagamento";
import { useRecarregar } from "./shared/recarregar.mjs";
import { movimentarEstoque } from "./shared/estoque";

const r2 = (n) => Math.round(Number(n) * 100) / 100;

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
  const [trocandoPag, setTrocandoPag] = useState(null); // id da venda com o "alterar pagamento" aberto
  const [msgPag, setMsgPag] = useState("");
  // Trocar item de uma venda já feita (ex.: cliente levou a Coca errada)
  const [trocando, setTrocando] = useState(null);      // { item, busca, novo, qtd }
  const [produtosTroca, setProdutosTroca] = useState([]);
  const [salvandoTroca, setSalvandoTroca] = useState(false);

  const abrirTroca = async (item) => {
    setMsgPag("");
    setTrocando({ item, busca: "", novo: null, qtd: Number(item.quantidade) });
    if (!produtosTroca.length) {
      const { data } = await supabase.from("produtos").select("id, nome, preco, codigo_barras, categoria").eq("ativo", true).order("nome");
      setProdutosTroca(data || []);
    }
  };

  const salvarTroca = async (v) => {
    const { item, novo, qtd } = trocando;
    const q = Math.max(1, Math.round(Number(qtd) || 1));
    const prod = novo || { id: item.produto_id, nome: item.nome_produto, preco: item.preco_unitario };
    const preco = Number(prod.preco);
    setSalvandoTroca(true);
    const { error } = await supabase.from("venda_itens").update({
      produto_id: prod.id, nome_produto: prod.nome, quantidade: q, preco_unitario: preco, subtotal: r2(q * preco),
    }).eq("id", item.id);
    if (error) { setSalvandoTroca(false); setMsgPag("Não foi possível trocar: " + error.message); return; }

    // estoque: devolve o que estava lançado e baixa o que saiu de verdade
    const motivo = v.numero ? `troca na venda #${v.numero}` : "troca em venda";
    await movimentarEstoque([{ produto_id: item.produto_id, quantidade: Number(item.quantidade) }], +1, motivo);
    await movimentarEstoque([{ produto_id: prod.id, quantidade: q }], -1, motivo);

    // novo total da venda
    const { data: todos } = await supabase.from("venda_itens").select("*").eq("venda_id", v.id);
    const soma = (todos || []).reduce((a, i) => a + Number(i.subtotal), 0);
    const novoTotal = r2(Math.max(0, soma - (Number(v.desconto) || 0)));
    const diff = r2(novoTotal - Number(v.total));
    let pagamentos = v.pagamentos;
    if (diff !== 0 && Array.isArray(pagamentos) && pagamentos.length) {
      // diferença entra na primeira forma da venda
      pagamentos = pagamentos.map((p, i) => i === 0 ? { ...p, valor: r2(Math.max(0, Number(p.valor) + diff)) } : p);
    }
    await supabase.from("vendas").update({ total: novoTotal, pagamentos }).eq("id", v.id);
    if (diff !== 0) {
      await supabase.from("financeiro").insert({ tipo: diff > 0 ? "entrada" : "saida", descricao: `Ajuste: ${motivo} (${item.nome_produto} → ${prod.nome})`, valor: Math.abs(diff), categoria: "venda" });
    }
    const { data: cx } = await supabase.from("caixas").select("id").eq("status", "fechado")
      .lte("aberto_em", v.created_at).gte("fechado_em", v.created_at).limit(1);

    setItens(todos || []);
    setVendas(vs => vs.map(x => x.id === v.id ? { ...x, total: novoTotal, pagamentos } : x));
    setSelected(sel => sel?.id === v.id ? { ...sel, total: novoTotal, pagamentos } : sel);
    setTrocando(null);
    setSalvandoTroca(false);
    const txtDiff = diff === 0 ? "O valor da venda não mudou."
      : diff > 0 ? `A venda ficou ${fmt(diff)} mais cara (o cliente deve essa diferença).`
      : `A venda ficou ${fmt(-diff)} mais barata (devolver essa diferença ao cliente).`;
    setMsgPag(`✅ Item trocado e estoque acertado. ${txtDiff}${cx?.length ? " Atenção: o caixa desse dia já foi fechado, então o fechamento impresso não muda." : ""}`);
  };

  // Corrige a forma de pagamento de uma venda já feita (ex.: lançou dinheiro e era cartão)
  const alterarPagamento = async (v, forma) => {
    const { error } = await supabase.from("vendas").update({ forma_pagamento: forma, pagamentos: null }).eq("id", v.id);
    if (error) { setMsgPag("Não foi possível alterar: " + error.message); return; }
    const { data: cx } = await supabase.from("caixas").select("id").eq("status", "fechado")
      .lte("aberto_em", v.created_at).gte("fechado_em", v.created_at).limit(1);
    setVendas(vs => vs.map(x => x.id === v.id ? { ...x, forma_pagamento: forma, pagamentos: null } : x));
    setTrocandoPag(null);
    setMsgPag(cx?.length
      ? "✅ Pagamento alterado. Atenção: o caixa desse dia já foi fechado, então o fechamento impresso não muda."
      : "✅ Pagamento alterado. O caixa aberto já mostra a forma certa.");
  };

  const loadVendas = useCallback(async () => {
    const { data } = await supabase.from("vendas").select("*").eq("status", "concluida").order("created_at", { ascending: false }).limit(50);
    setVendas(data || []);
  }, []);

  const loadComandasFechadas = useCallback(async () => {
    const { data } = await supabase.from("comandas").select("*, comanda_itens(*, produtos(nome))").eq("status", "fechada").order("created_at", { ascending: false }).limit(50);
    setComandasFechadas(data || []);
  }, []);
  useRecarregar(loadVendas);
  useRecarregar(loadComandasFechadas);

  useEffect(() => {
    loadVendas();
    loadComandasFechadas();
    const channel = supabase.channel("historico-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "vendas" }, loadVendas)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "comandas" }, loadComandasFechadas)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadVendas, loadComandasFechadas]);

  const verDetalhes = async (v) => {
    setTrocando(null);
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
    .filter(v => filtroPagamento === "todos" || partesDaVenda(v).some(p => p.forma === filtroPagamento))
    .filter(v => !busca || fmt(v.total).includes(busca) || Number(v.total).toFixed(2).replace(".", ",").includes(busca) || v.forma_pagamento?.includes(busca.toLowerCase()))
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
                      <td style={base.td}><span style={base.tag(C.accent)}>{rotuloPagamento(v)}</span></td>
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
                              <div key={i.id} style={{ marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
                                  <span style={{ color: C.text, flex: 1 }}>{i.nome_produto} × {i.quantidade}</span>
                                  <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(i.subtotal)}</span>
                                  {trocando?.item.id !== i.id && (
                                    <button style={base.btnSm(C.card, C.text)} onClick={() => abrirTroca(i)}>🔄 Trocar</button>
                                  )}
                                </div>
                                {trocando?.item.id === i.id && (
                                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginTop: 6 }}>
                                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                                      Qual produto saiu de verdade? {trocando.novo ? <b style={{ color: C.text }}>→ {trocando.novo.nome} ({fmt(trocando.novo.preco)})</b> : "(deixe em branco pra só mudar a quantidade)"}
                                    </div>
                                    <input autoFocus style={{ ...base.input, marginBottom: 6 }} placeholder="Buscar produto ou bipar o código..."
                                      value={trocando.busca} onChange={e => setTrocando(t => ({ ...t, busca: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key !== "Enter") return;
                                        const cod = produtosTroca.find(p => p.codigo_barras && p.codigo_barras === trocando.busca.trim());
                                        if (cod) setTrocando(t => ({ ...t, novo: cod, busca: "" }));
                                      }} />
                                    {trocando.busca.trim().length >= 2 && (
                                      <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 6 }}>
                                        {produtosTroca.filter(p => p.nome.toLowerCase().includes(trocando.busca.trim().toLowerCase()) || p.codigo_barras === trocando.busca.trim()).slice(0, 12).map(p => (
                                          <button key={p.id} style={{ ...base.btnSm(C.card2, C.text), display: "flex", justifyContent: "space-between", width: "100%", marginBottom: 4 }}
                                            onClick={() => setTrocando(t => ({ ...t, novo: p, busca: "" }))}>
                                            <span>{p.nome}</span><span style={{ color: C.accent }}>{fmt(p.preco)}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 12, color: C.muted }}>Quantidade</span>
                                      <input type="number" min="1" style={{ ...base.input, width: 70 }} value={trocando.qtd} onChange={e => setTrocando(t => ({ ...t, qtd: e.target.value }))} />
                                      <button disabled={salvandoTroca || (!trocando.novo && Number(trocando.qtd) === Number(i.quantidade))} style={base.btnSm(C.accent, "#000")} onClick={() => salvarTroca(v)}>
                                        {salvandoTroca ? "Salvando..." : "Salvar troca"}
                                      </button>
                                      <button style={base.btnSm(C.card2, C.muted)} onClick={() => setTrocando(null)}>Cancelar</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                              <span style={{ color: C.text }}>Total{Number(v.desconto) > 0 ? ` (desconto ${fmt(v.desconto)})` : ""}</span>
                              <span style={{ color: C.accent }}>{fmt(v.total)}</span>
                            </div>
                            <div style={{ marginTop: 12 }}>
                              {msgPag && selected?.id === v.id && <div style={{ ...base.alert(msgPag.startsWith("✅") ? C.green : C.red), marginBottom: 8, fontSize: 12 }}>{msgPag}</div>}
                              {trocandoPag === v.id ? (
                                <div>
                                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                                    Qual foi a forma de pagamento certa?{partesDaVenda(v).length > 1 ? " (a venda inteira vai pra forma escolhida)" : ""}
                                  </div>
                                  <BotoesPagamento value={partesDaVenda(v).length > 1 ? "" : v.forma_pagamento} onChange={f => alterarPagamento(v, f)} />
                                  <button style={{ ...base.btnSm(C.card, C.muted), marginTop: 8 }} onClick={() => setTrocandoPag(null)}>Cancelar</button>
                                </div>
                              ) : (
                                <button style={base.btnSm(C.card, C.text)} onClick={() => { setMsgPag(""); setTrocandoPag(v.id); }}>✏️ Alterar forma de pagamento</button>
                              )}
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