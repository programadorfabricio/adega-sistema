"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, C, base, fmt, MARCA, ESCALA, PEDIDO_ONLINE, semEstoque } from "../components/shared/constants";
import LogoMarca from "../components/shared/LogoMarca";
import { adicionar, alterarQtd, totais, lerCliente, salvarCliente } from "./carrinho.mjs";
import { FORMAS, NaoEncontrada } from "./ui";
import { useRecarregar } from "../components/shared/recarregar.mjs";

// cardapio_online já manda só os ativos com preço e estoque; o filtro fica de garantia
const disponivel = (p) => Number(p.preco) > 0 && (semEstoque(p) || Number(p.estoque_atual) > 0);

export default function PedirPage() {
  if (!PEDIDO_ONLINE) return <NaoEncontrada />;
  return <Cardapio />;
}

function Cardapio() {
  const router = useRouter();
  const [produtos, setProdutos] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [loja, setLoja] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState([]);
  const [etapa, setEtapa] = useState("cardapio"); // cardapio | finalizar
  const [form, setForm] = useState({ nome: "", telefone: "", endereco: "", bairro: "", referencia: "", forma_pagamento: "dinheiro", troco_para: "", observacao: "" });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Lê cardápio, bairros e se a loja está aberta. Roda ao abrir, a cada 30 s e ao voltar pra aba,
  // pra quem está com a página aberta ver "Fechado" e produto esgotado sumir sem recarregar.
  // Tudo vem de <adega>.cardapio_online() (supabase/pedido-online.sql): funciona com a adega trancada
  // (o cliente final não tem login) e não expõe custo nem dados internos.
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("cardapio_online");
    if (error || !data) { setCarregando(false); return; } // sinal fraco: mantém o que já tem
    setProdutos((data.produtos || []).filter(disponivel));
    setBairros(data.bairros || []);
    setLoja(data.loja || {});
    setCarregando(false);
  }, []);
  useRecarregar(carregar);

  useEffect(() => {
    carregar();
    setForm(f => ({ ...f, ...lerCliente() }));
  }, [carregar]);

  const aberto = loja?.aberto !== false;
  const nomeLoja = loja?.nome || MARCA.nome;
  const taxa = Number(bairros.find(b => b.nome === form.bairro)?.taxa || 0);
  const t = totais(carrinho, taxa);
  const qtdItens = carrinho.reduce((s, i) => s + i.quantidade, 0);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? produtos.filter(p => p.nome.toLowerCase().includes(q)) : produtos;
    const g = {};
    lista.forEach(p => { (g[p.categoria || "outros"] ||= []).push(p); });
    return Object.entries(g);
  }, [produtos, busca]);

  const qtdNoCarrinho = (id) => carrinho.find(i => i.produto_id === id)?.quantidade || 0;
  const limite = (p) => (semEstoque(p) ? 99 : Math.min(99, Number(p.estoque_atual) || 0));
  const mais = (p) => { if (qtdNoCarrinho(p.id) < limite(p)) setCarrinho(c => adicionar(c, p)); };
  const menos = (p) => setCarrinho(c => alterarQtd(c, p.id, qtdNoCarrinho(p.id) - 1));

  const enviar = async () => {
    if (enviando) return;
    setErro("");
    if (!form.nome.trim()) return setErro("Coloque seu nome.");
    if (form.telefone.replace(/\D/g, "").length < 10) return setErro("Coloque seu WhatsApp com DDD.");
    if (!form.endereco.trim()) return setErro("Coloque o endereço de entrega.");
    if (bairros.length && !form.bairro) return setErro("Escolha o bairro.");
    setEnviando(true);
    const { nome, telefone, endereco, bairro, referencia } = form;
    salvarCliente({ nome, telefone, endereco, bairro, referencia });
    const { data, error } = await supabase.rpc("pedido_online", {
      p_cliente: { ...form, troco_para: form.forma_pagamento === "dinheiro" ? form.troco_para : "" },
      p_itens: t.itens,
    });
    if (error || !data?.id) {
      setEnviando(false);
      return setErro(error?.message || "Não foi possível enviar. Tente de novo.");
    }
    router.push(`/pedir/acompanhar?id=${data.id}`);
  };

  const pagina = { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Outfit', sans-serif", paddingBottom: 110 };
  const miolo = { maxWidth: 560, margin: "0 auto", padding: "0 16px", zoom: ESCALA !== 1 ? ESCALA : undefined };

  if (carregando) return <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Carregando cardápio…</div>;

  return (
    <div style={pagina}>
      <div style={miolo}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0 16px" }}>
          <LogoMarca size={52} emojiSize={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{nomeLoja}</div>
            <div style={{ fontSize: 13, color: C.muted }}>Peça pelo celular e receba em casa</div>
          </div>
        </header>

        {!aberto && <div style={base.alert(C.red)}>🔒 Fechado no momento. Tente mais tarde.</div>}

        {etapa === "cardapio" && (
          <>
            <input style={{ ...campo, marginBottom: 16 }} placeholder="🔍 Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
            {grupos.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>Nenhum produto encontrado.</div>}
            {grupos.map(([cat, lista]) => (
              <section key={cat} style={{ marginBottom: 20 }}>
                <div style={{ ...base.sectionTitle, marginBottom: 8 }}>{cat}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {lista.map(p => {
                    const q = qtdNoCarrinho(p.id);
                    return (
                      <div key={p.id} data-produto={p.nome} style={{ ...base.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderColor: q ? C.accent : C.border }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nome}</div>
                          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, marginTop: 2 }}>{fmt(p.preco)}</div>
                        </div>
                        {q === 0 ? (
                          <button style={base.btnSm()} disabled={!aberto} onClick={() => mais(p)} aria-label={`Adicionar ${p.nome}`}>+ Adicionar</button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button style={botaoQtd} onClick={() => menos(p)} aria-label={`Menos ${p.nome}`}>−</button>
                            <b style={{ minWidth: 18, textAlign: "center" }}>{q}</b>
                            <button style={{ ...botaoQtd, opacity: q >= limite(p) ? 0.4 : 1 }} onClick={() => mais(p)} aria-label={`Mais ${p.nome}`}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}

        {etapa === "finalizar" && (
          <div style={{ display: "grid", gap: 14 }}>
            <button style={{ ...base.btnOutline, justifySelf: "start" }} onClick={() => setEtapa("cardapio")}>← Voltar ao cardápio</button>

            <div style={base.card}>
              <div style={base.sectionTitle}>Seu pedido</div>
              {carrinho.map(i => (
                <div key={i.produto_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, padding: "4px 0" }}>
                  <span>{i.quantidade}× {i.nome}</span><span>{fmt(i.preco * i.quantidade)}</span>
                </div>
              ))}
            </div>

            <div style={{ ...base.card, display: "grid", gap: 12 }}>
              <div style={base.sectionTitle}>Entrega</div>
              <Campo label="Seu nome"><input style={campo} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoComplete="name" /></Campo>
              <Campo label="WhatsApp (com DDD)"><input style={campo} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="(19) 99999-0000" /></Campo>
              <Campo label="Endereço (rua e número)"><input style={campo} value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} autoComplete="street-address" /></Campo>
              {bairros.length > 0 && (
                <Campo label="Bairro">
                  <select style={campoSelect} value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })}>
                    <option value="">Escolha o bairro</option>
                    {bairros.map(b => <option key={b.nome} value={b.nome}>{b.nome} — entrega {fmt(b.taxa)}</option>)}
                  </select>
                </Campo>
              )}
              <Campo label="Ponto de referência (opcional)"><input style={campo} value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} /></Campo>
            </div>

            <div style={{ ...base.card, display: "grid", gap: 12 }}>
              <div style={base.sectionTitle}>Pagamento na entrega</div>
              <div style={{ display: "grid", gap: 8 }}>
                {FORMAS.map(f => (
                  <label key={f.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${form.forma_pagamento === f.value ? C.accent : C.border}`, background: form.forma_pagamento === f.value ? C.accentBg : "transparent", cursor: "pointer" }}>
                    <input type="radio" name="forma" checked={form.forma_pagamento === f.value} onChange={() => setForm({ ...form, forma_pagamento: f.value })} />
                    {f.label}
                  </label>
                ))}
              </div>
              {form.forma_pagamento === "dinheiro" && (
                <Campo label="Troco para quanto? (opcional)"><input style={campo} value={form.troco_para} onChange={e => setForm({ ...form, troco_para: e.target.value })} inputMode="decimal" placeholder="Ex: 100" /></Campo>
              )}
              <Campo label="Observação (opcional)"><input style={campo} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: bem gelada" /></Campo>
            </div>

            <div style={base.card}>
              <Linha l="Produtos" v={fmt(t.subtotal)} />
              <Linha l="Entrega" v={form.bairro ? fmt(taxa) : "—"} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, marginTop: 6 }}><span>Total</span><span style={{ color: C.accent }}>{fmt(t.total)}</span></div>
            </div>

            {erro && <div style={base.alert(C.red)}>{erro}</div>}
          </div>
        )}
      </div>

      {carrinho.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.border}`, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, zoom: ESCALA !== 1 ? ESCALA : undefined }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{qtdItens} {qtdItens === 1 ? "item" : "itens"}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(etapa === "finalizar" ? t.total : t.subtotal)}</div>
            </div>
            {etapa === "cardapio" ? (
              <button style={{ ...base.btn(), padding: "12px 22px", fontSize: 15 }} disabled={!aberto} onClick={() => { setErro(""); setEtapa("finalizar"); window.scrollTo(0, 0); }}>Continuar →</button>
            ) : (
              <button style={{ ...base.btn(), padding: "12px 22px", fontSize: 15, opacity: enviando || !aberto ? 0.6 : 1 }} disabled={enviando || !aberto} onClick={enviar}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 16px: no iPhone, campo menor que isso dá zoom ao tocar
const campo = { ...base.input, fontSize: 16 };
const campoSelect = { ...base.select, fontSize: 16 };

const botaoQtd = { width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 18, fontWeight: 700, cursor: "pointer" };

function Campo({ label, children }) {
  return <label style={{ display: "block" }}><span style={base.label}>{label}</span>{children}</label>;
}

function Linha({ l, v }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.muted, padding: "2px 0" }}><span>{l}</span><span>{v}</span></div>;
}
