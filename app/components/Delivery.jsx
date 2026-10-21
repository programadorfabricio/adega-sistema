"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, hora, SCHEMA, MARCA, semEstoque } from "./shared/constants";

const STATUS = {
  preparando: { label: "Preparando", icon: "🟡", cor: "#f5c000" },
  saiu: { label: "Saiu pra entrega", icon: "🛵", cor: "#3b82f6" },
  entregue: { label: "Entregue", icon: "✅", cor: "#22c55e" },
};

const PAGAMENTOS = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
};

const FORM_VAZIO = { telefone: "", cliente_nome: "", endereco: "", bairro: "", referencia: "", taxa: "", forma_pagamento: "dinheiro", troco_para: "", observacao: "" };

// Telefone em formato wa.me (55 + DDD + número)
const telWhats = (tel) => {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
};

const abrirWhats = (tel, texto) => {
  const n = telWhats(tel);
  if (!n) return;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(texto)}`, "_blank");
};

const textoMotoboy = (e) => {
  const linhas = [
    `🛵 PEDIDO #${e.numero} — ${MARCA.nome}`,
    `Cliente: ${e.cliente_nome}${e.telefone ? ` (${e.telefone})` : ""}`,
    `Endereço: ${e.endereco || "—"}${e.bairro ? ` — ${e.bairro}` : ""}`,
    e.referencia ? `Referência: ${e.referencia}` : null,
    "",
    ...(e.itens || []).map(i => `${i.quantidade}x ${i.nome_produto}`),
    "",
    `Total a receber: ${fmt(e.total)}`,
    `Pagamento: ${PAGAMENTOS[e.forma_pagamento] || e.forma_pagamento}`,
    e.forma_pagamento === "dinheiro" && e.troco_para ? `Troco pra ${fmt(e.troco_para)} → levar ${fmt(Number(e.troco_para) - Number(e.total))}` : null,
    e.observacao ? `Obs: ${e.observacao}` : null,
  ];
  return linhas.filter(l => l !== null).join("\n");
};

const minutosDesde = (d) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));

export default function Delivery() {
  const [entregas, setEntregas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [erroTabela, setErroTabela] = useState(false);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmar, setConfirmar] = useState(null); // entrega sendo finalizada
  const [pagamentoFinal, setPagamentoFinal] = useState("dinheiro");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const { data, error } = await supabase.from("entregas").select("*")
      .or(`status.in.(preparando,saiu),and(status.eq.entregue,entregue_em.gte.${inicioHoje.toISOString()})`)
      .order("created_at", { ascending: true });
    if (error) { setErroTabela(true); return; }
    setErroTabela(false);
    setEntregas(data || []);
  }, []);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria").order("nome");
    setProdutos(data || []);
  }, []);

  const loadBairros = useCallback(async () => {
    const { data } = await supabase.from("bairros").select("*").order("nome");
    setBairros(data || []);
  }, []);

  useEffect(() => {
    load(); loadProdutos(); loadBairros();
    const channel = supabase.channel("delivery-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "entregas" }, load)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "produtos" }, loadProdutos)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "bairros" }, loadBairros)
      .subscribe();
    const relogio = setInterval(() => setTick(t => t + 1), 60000);
    return () => { supabase.removeChannel(channel); clearInterval(relogio); };
  }, [load, loadProdutos, loadBairros]);

  const mostrarAviso = (msg) => { setAviso(msg); setTimeout(() => setAviso(""), 2500); };

  // ─── Novo pedido ─────────────────────────────────────────
  const subtotal = carrinho.reduce((a, i) => a + i.subtotal, 0);
  const taxa = Number(form.taxa || 0);
  const total = subtotal + taxa;

  const abrirNovo = () => { setForm(FORM_VAZIO); setCarrinho([]); setBusca(""); setErro(""); setNovo(true); };

  // Cliente que já pediu antes: preenche nome e endereço pelo telefone
  const buscarCliente = async () => {
    const tel = form.telefone.trim();
    if (tel.replace(/\D/g, "").length < 8) return;
    const { data } = await supabase.from("entregas").select("cliente_nome, endereco, bairro, referencia, taxa")
      .eq("telefone", tel).order("created_at", { ascending: false }).limit(1);
    const ultimo = data?.[0];
    if (!ultimo) return;
    setForm(f => ({
      ...f,
      cliente_nome: f.cliente_nome || ultimo.cliente_nome || "",
      endereco: f.endereco || ultimo.endereco || "",
      bairro: f.bairro || ultimo.bairro || "",
      referencia: f.referencia || ultimo.referencia || "",
      taxa: f.taxa !== "" ? f.taxa : String(ultimo.taxa ?? ""),
    }));
    mostrarAviso("Cliente encontrado: dados do último pedido preenchidos");
  };

  const escolherBairro = (nome) => {
    const b = bairros.find(x => x.nome === nome);
    setForm(f => ({ ...f, bairro: nome, taxa: b ? String(b.taxa) : f.taxa }));
  };

  const add = (p) => {
    const noCarrinho = carrinho.find(i => i.produto_id === p.id);
    if (!semEstoque(p)) {
      if (p.estoque_atual <= 0) return;
      if (noCarrinho && noCarrinho.quantidade >= p.estoque_atual) return;
    }
    setCarrinho(c => {
      const ex = c.find(i => i.produto_id === p.id);
      if (ex) return c.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.preco_unitario } : i);
      return [...c, { produto_id: p.id, nome_produto: p.nome, quantidade: 1, preco_unitario: Number(p.preco), subtotal: Number(p.preco) }];
    });
  };

  const changeQtd = (id, qtd) => {
    if (qtd < 1) return setCarrinho(c => c.filter(i => i.produto_id !== id));
    const prod = produtos.find(p => p.id === id);
    if (prod && !semEstoque(prod) && qtd > prod.estoque_atual) return;
    setCarrinho(c => c.map(i => i.produto_id === id ? { ...i, quantidade: qtd, subtotal: qtd * i.preco_unitario } : i));
  };

  const salvarPedido = async () => {
    setErro("");
    if (!form.cliente_nome.trim()) return setErro("Coloque o nome do cliente.");
    if (!form.endereco.trim()) return setErro("Coloque o endereço de entrega.");
    if (!carrinho.length) return setErro("Adicione pelo menos um produto.");
    if (form.forma_pagamento === "dinheiro" && form.troco_para && Number(form.troco_para) < total) return setErro("O valor do troco é menor que o total do pedido.");
    setSalvando(true);

    // Confere o estoque na hora de salvar (outro caixa pode ter vendido)
    const ids = carrinho.map(i => i.produto_id);
    const { data: atuais } = await supabase.from("produtos").select("*").in("id", ids);
    for (const item of carrinho) {
      const p = (atuais || []).find(x => x.id === item.produto_id);
      if (p && !semEstoque(p) && p.estoque_atual < item.quantidade) {
        setSalvando(false);
        return setErro(`Estoque insuficiente de ${p.nome} (restam ${p.estoque_atual}).`);
      }
    }

    const { data: entrega, error } = await supabase.from("entregas").insert({
      cliente_nome: form.cliente_nome.trim(),
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim(),
      bairro: form.bairro || null,
      referencia: form.referencia.trim() || null,
      itens: carrinho,
      subtotal, taxa, total,
      forma_pagamento: form.forma_pagamento,
      troco_para: form.forma_pagamento === "dinheiro" && form.troco_para ? Number(form.troco_para) : null,
      observacao: form.observacao.trim() || null,
      status: "preparando",
    }).select().single();

    if (error || !entrega) { setSalvando(false); return setErro("Não foi possível salvar o pedido. Tente de novo."); }

    // Reserva o estoque: sai agora; volta se o pedido for cancelado
    for (const item of carrinho) {
      const p = (atuais || []).find(x => x.id === item.produto_id);
      if (p && !semEstoque(p)) {
        await supabase.from("produtos").update({ estoque_atual: Math.max(0, p.estoque_atual - item.quantidade) }).eq("id", p.id);
        await supabase.from("estoque_movimentacoes").insert({ produto_id: p.id, tipo: "saida", quantidade: item.quantidade, motivo: `delivery #${entrega.numero}` });
      }
    }

    setSalvando(false); setNovo(false); load(); loadProdutos();
    mostrarAviso(`Pedido #${entrega.numero} criado`);
  };

  // ─── Andamento ───────────────────────────────────────────
  const marcarSaiu = async (e) => {
    await supabase.from("entregas").update({ status: "saiu", saiu_em: new Date().toISOString() }).eq("id", e.id);
    load();
  };

  const abrirFinalizar = (e) => { setConfirmar(e); setPagamentoFinal(e.forma_pagamento || "dinheiro"); };

  const finalizar = async () => {
    const e = confirmar;
    if (!e) return;
    setSalvando(true);
    const { data: venda } = await supabase.from("vendas").insert({ total: e.total, forma_pagamento: pagamentoFinal, status: "concluida" }).select().single();
    if (venda) {
      await supabase.from("venda_itens").insert((e.itens || []).map(i => ({
        venda_id: venda.id, produto_id: i.produto_id, nome_produto: i.nome_produto,
        quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
      })));
      await supabase.from("financeiro").insert({
        tipo: "entrada",
        descricao: `Delivery #${e.numero} - ${e.cliente_nome}${Number(e.taxa) > 0 ? ` (taxa ${fmt(e.taxa)})` : ""}`,
        valor: e.total, categoria: "venda",
      });
    }
    await supabase.from("entregas").update({
      status: "entregue", entregue_em: new Date().toISOString(),
      forma_pagamento: pagamentoFinal, venda_id: venda?.id || null,
    }).eq("id", e.id);
    setSalvando(false); setConfirmar(null); load();
    mostrarAviso(`Pedido #${e.numero} entregue e lançado no caixa`);
  };

  const cancelar = async (e) => {
    if (!window.confirm(`Cancelar o pedido #${e.numero} de ${e.cliente_nome}? O estoque volta.`)) return;
    for (const item of e.itens || []) {
      const { data: p } = await supabase.from("produtos").select("*").eq("id", item.produto_id).single();
      if (p && !semEstoque(p)) {
        await supabase.from("produtos").update({ estoque_atual: p.estoque_atual + item.quantidade }).eq("id", p.id);
        await supabase.from("estoque_movimentacoes").insert({ produto_id: p.id, tipo: "entrada", quantidade: item.quantidade, motivo: `delivery #${e.numero} cancelado` });
      }
    }
    await supabase.from("entregas").update({ status: "cancelado" }).eq("id", e.id);
    load(); loadProdutos();
  };

  const copiarMotoboy = async (e) => {
    const texto = textoMotoboy(e);
    try { await navigator.clipboard.writeText(texto); mostrarAviso("Pedido copiado: é só colar no WhatsApp do motoboy"); }
    catch { window.prompt("Copie o pedido:", texto); }
  };

  const avisarCliente = (e) => {
    const msg = e.status === "preparando"
      ? `Olá, ${e.cliente_nome.split(" ")[0]}! Recebemos seu pedido na ${MARCA.nome} 🍻 Total: ${fmt(e.total)}. Já estamos separando!`
      : `Olá, ${e.cliente_nome.split(" ")[0]}! Seu pedido da ${MARCA.nome} saiu pra entrega 🛵 Total: ${fmt(e.total)}.`;
    abrirWhats(e.telefone, msg);
  };

  // ─── Tela ────────────────────────────────────────────────
  if (erroTabela) return (
    <div>
      <div style={base.pageTitle}>🛵 Delivery</div>
      <div style={base.alert(C.red)}>O delivery ainda não foi ativado neste sistema. Fale com o suporte da FH Digital.</div>
    </div>
  );

  const entreguesHoje = entregas.filter(e => e.status === "entregue");
  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ ...base.pageTitle, marginBottom: 0 }}>🛵 Delivery</div>
        <button style={base.btn()} onClick={abrirNovo}>+ Novo pedido</button>
      </div>

      {aviso && <div style={base.alert(C.green)}>✅ {aviso}</div>}

      <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Entregues hoje", val: entreguesHoje.length },
          { label: "Vendido no delivery hoje", val: fmt(entreguesHoje.reduce((a, e) => a + Number(e.total), 0)) },
          { label: "Taxas de entrega hoje", val: fmt(entreguesHoje.reduce((a, e) => a + Number(e.taxa), 0)) },
        ].map(s => (
          <div key={s.label} style={base.card}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "start" }}>
        {Object.entries(STATUS).map(([st, info]) => {
          const lista = entregas.filter(e => e.status === st);
          return (
            <div key={st} style={{ ...base.card, padding: 14 }}>
              <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, color: info.cor, fontSize: 14 }}>{info.icon} {info.label}</div>
                <span style={base.tag(info.cor)}>{lista.length}</span>
              </div>
              {lista.length === 0 && <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>Nenhum pedido</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(st === "entregue" ? [...lista].reverse() : lista).map(e => {
                  const min = minutosDesde(e.created_at);
                  const atrasado = st !== "entregue" && min >= 45;
                  return (
                    <div key={e.id} style={{ background: C.card2, border: `1px solid ${atrasado ? C.red : C.border}`, borderRadius: 12, padding: 12 }}>
                      <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>#{e.numero} · {e.cliente_nome}</div>
                        <div style={{ fontWeight: 900, color: C.accent, fontSize: 14 }}>{fmt(e.total)}</div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>📍 {e.endereco}{e.bairro ? ` — ${e.bairro}` : ""}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                        {(e.itens || []).map(i => `${i.quantidade}x ${i.nome_produto}`).join(" · ")}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={base.tag(C.blue)}>{PAGAMENTOS[e.forma_pagamento] || e.forma_pagamento}</span>
                        {e.forma_pagamento === "dinheiro" && e.troco_para && <span style={base.tag(C.green)}>troco p/ {fmt(e.troco_para)}</span>}
                        <span style={base.tag(atrasado ? C.red : C.muted)}>{st === "entregue" ? `entregue ${hora(e.entregue_em)}` : `${min} min`}</span>
                      </div>
                      {e.observacao && <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>📝 {e.observacao}</div>}
                      {st !== "entregue" && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {st === "preparando" && <button style={base.btnSm(C.blue, "#fff")} onClick={() => marcarSaiu(e)}>🛵 Saiu</button>}
                          <button style={base.btnSm(C.green, "#fff")} onClick={() => abrirFinalizar(e)}>✅ Entregue</button>
                          <button style={base.btnSm(C.card, C.text)} onClick={() => copiarMotoboy(e)}>📋 Motoboy</button>
                          {e.telefone && <button style={base.btnSm(C.card, C.text)} onClick={() => avisarCliente(e)}>💬 Avisar</button>}
                          <button style={base.btnSm(C.card, C.red)} onClick={() => cancelar(e)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: novo pedido */}
      {novo && (
        <div style={base.modal} onClick={() => !salvando && setNovo(false)}>
          <div style={{ ...base.modalBox, maxWidth: 860 }} onClick={e => e.stopPropagation()}>
            <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>🛵 Novo pedido de entrega</div>
              <button onClick={() => setNovo(false)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Cliente e entrega */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={base.sectionTitle}>Cliente</div>
                <div>
                  <label style={base.label}>WhatsApp do cliente</label>
                  <input style={base.input} inputMode="tel" placeholder="(11) 99999-9999" value={form.telefone}
                    onChange={e => setForm({ ...form, telefone: e.target.value })} onBlur={buscarCliente} />
                </div>
                <div>
                  <label style={base.label}>Nome *</label>
                  <input style={base.input} value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} />
                </div>
                <div>
                  <label style={base.label}>Endereço *</label>
                  <input style={base.input} placeholder="Rua e número" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
                  <div>
                    <label style={base.label}>Bairro</label>
                    {bairros.length > 0 ? (
                      <select style={base.select} value={form.bairro} onChange={e => escolherBairro(e.target.value)}>
                        <option value="">Selecione</option>
                        {bairros.map(b => <option key={b.id} value={b.nome}>{b.nome} — {fmt(b.taxa)}</option>)}
                      </select>
                    ) : (
                      <input style={base.input} value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label style={base.label}>Taxa (R$)</label>
                    <input style={base.input} type="number" inputMode="decimal" value={form.taxa} onChange={e => setForm({ ...form, taxa: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label style={base.label}>Referência</label>
                  <input style={base.input} placeholder="Ex: casa do portão azul" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} />
                </div>
                <div>
                  <label style={base.label}>Pagamento na entrega</label>
                  <select style={base.select} value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
                    {Object.entries(PAGAMENTOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {form.forma_pagamento === "dinheiro" && (
                  <div>
                    <label style={base.label}>Troco pra quanto? (R$)</label>
                    <input style={base.input} type="number" inputMode="decimal" placeholder="Deixe vazio se não precisar" value={form.troco_para} onChange={e => setForm({ ...form, troco_para: e.target.value })} />
                    {form.troco_para && Number(form.troco_para) >= total && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>Motoboy leva {fmt(Number(form.troco_para) - total)} de troco</div>}
                  </div>
                )}
                <div>
                  <label style={base.label}>Observação</label>
                  <input style={base.input} placeholder="Ex: bem gelada" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
                </div>
              </div>

              {/* Produtos */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={base.sectionTitle}>Produtos</div>
                <input style={base.input} placeholder="🔍 Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtrados.slice(0, 60).map(p => {
                    const livre = semEstoque(p);
                    const noCarrinho = carrinho.find(i => i.produto_id === p.id)?.quantidade || 0;
                    const esgotado = !livre && p.estoque_atual - noCarrinho <= 0;
                    return (
                      <button key={p.id} onClick={() => add(p)} disabled={esgotado}
                        style={{ display: "flex", justifyContent: "space-between", gap: 8, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", cursor: esgotado ? "not-allowed" : "pointer", opacity: esgotado ? 0.45 : 1, textAlign: "left" }}>
                        <span style={{ fontSize: 13, color: C.text }}>{p.nome}{esgotado ? " · esgotado" : ""}</span>
                        <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>{fmt(p.preco)}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  {carrinho.length === 0 && <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "10px 0" }}>Nenhum produto no pedido</div>}
                  {carrinho.map(i => (
                    <div key={i.produto_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, color: C.text }}>{i.nome_produto}</div>
                      <button onClick={() => changeQtd(i.produto_id, i.quantidade - 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: "center", color: C.text }}>{i.quantidade}</span>
                      <button onClick={() => changeQtd(i.produto_id, i.quantidade + 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>+</button>
                      <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, minWidth: 64, textAlign: "right" }}>{fmt(i.subtotal)}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 13, color: C.muted, display: "flex", justifyContent: "space-between" }}><span>Produtos</span><span>{fmt(subtotal)}</span></div>
                  <div style={{ fontSize: 13, color: C.muted, display: "flex", justifyContent: "space-between" }}><span>Taxa de entrega</span><span>{fmt(taxa)}</span></div>
                  <div style={{ fontSize: 20, fontWeight: 900, display: "flex", justifyContent: "space-between", marginTop: 6, color: C.text }}><span>Total</span><span style={{ color: C.accent }}>{fmt(total)}</span></div>
                </div>
              </div>
            </div>

            {erro && <div style={{ ...base.alert(C.red), marginTop: 14, marginBottom: 0 }}>{erro}</div>}
            <button style={{ ...base.btn(C.green, "#fff"), width: "100%", padding: 13, fontSize: 15, marginTop: 16 }} onClick={salvarPedido} disabled={salvando}>
              {salvando ? "Salvando..." : `Criar pedido · ${fmt(total)}`}
            </button>
          </div>
        </div>
      )}

      {/* Modal: confirmar entrega */}
      {confirmar && (
        <div style={base.modal} onClick={() => !salvando && setConfirmar(null)}>
          <div style={base.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>✅ Pedido #{confirmar.numero} entregue</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{confirmar.cliente_nome} · {fmt(confirmar.total)}</div>
            <label style={base.label}>Como o cliente pagou?</label>
            <select style={{ ...base.select, marginBottom: 16 }} value={pagamentoFinal} onChange={e => setPagamentoFinal(e.target.value)}>
              {Object.entries(PAGAMENTOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>O valor entra no caixa e nos relatórios como uma venda.</div>
            <div style={base.row}>
              <button style={{ ...base.btn(C.green, "#fff"), flex: 1 }} onClick={finalizar} disabled={salvando}>{salvando ? "Lançando..." : "Confirmar"}</button>
              <button style={base.btnOutline} onClick={() => setConfirmar(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
