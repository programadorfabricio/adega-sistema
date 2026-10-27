"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, C, base, fmt, SCHEMA, semEstoque } from "./shared/constants";
import { movimentarEstoque } from "./shared/estoque";
import TrocoCalculator from "./shared/TrocoCalculator";
import { useCaixaAberto } from "./Caixa";
import { FORMAS_PAG, CampoDesconto, PagamentoDividido, calcDesconto, inserirVenda, linhasIniciais, linhasBatem, reajustarLinhas, num } from "./shared/pagamento";

// ─── HOOK LEITOR AUTOMÁTICO ───────────────────────────────
function useBarcodeListener(onScan) {
  const buffer = useRef("");
  const timer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      // Ignora se foco está em input de texto normal
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Enter") {
        if (buffer.current.length >= 3) onScan(buffer.current);
        buffer.current = "";
        clearTimeout(timer.current);
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        clearTimeout(timer.current);
        // Se demorar mais de 100ms entre teclas, limpa o buffer (digitação humana)
        timer.current = setTimeout(() => { buffer.current = ""; }, 100);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan]);
}

export default function VendaRapida({ setPage }) {
  const caixaEstado = useCaixaAberto();
  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState("");
  const [pagamento, setPagamento] = useState("pix");
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [descTipo, setDescTipo] = useState("R$");
  const [descValor, setDescValor] = useState("");
  const [dividir, setDividir] = useState(false);
  const [linhas, setLinhas] = useState([]);

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    const unicos = (data || []).filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
    setProdutos(unicos);
  }, []);

  useEffect(() => {
    loadProdutos();
    const channel = supabase.channel("venda-rapida-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "produtos" }, loadProdutos)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadProdutos]);

  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const subtotal = carrinho.reduce((a, i) => a + i.subtotal, 0);
  const desconto = calcDesconto(subtotal, descTipo, descValor);
  const total = Math.round((subtotal - desconto) * 100) / 100;
  const pagamentoOk = !dividir || linhasBatem(total, linhas);
  const dinheiroDividido = dividir ? linhas.filter(l => l.forma === "dinheiro").reduce((a, l) => a + num(l.valor), 0) : 0;
  useEffect(() => { if (dividir) setLinhas(ls => reajustarLinhas(total, ls)); }, [total, dividir]);
  const ligarDivisao = (on) => { setDividir(on); if (on) setLinhas(linhasIniciais(total)); };

  const [ultimoAdicionado, setUltimoAdicionado] = useState(null);

  const add = (p) => {
    const noCarrinho = carrinho.find(i => i.produto_id === p.id);
    if (!semEstoque(p)) {
      if (p.estoque_atual <= 0) return;
      if (noCarrinho && noCarrinho.quantidade >= p.estoque_atual) return;
    }
    setCarrinho(c => {
      const ex = c.find(i => i.produto_id === p.id);
      if (ex) return c.map(i => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.preco_unitario } : i);
      return [...c, { produto_id: p.id, nome_produto: p.nome, quantidade: 1, preco_unitario: p.preco, subtotal: p.preco }];
    });
    setUltimoAdicionado(p.nome);
    setTimeout(() => setUltimoAdicionado(null), 1500);
  };

  // Scan automático por código de barras
  const handleScan = useCallback(async (codigo) => {
    const { data } = await supabase.from("produtos").select("*").eq("codigo_barras", codigo).eq("ativo", true).single();
    if (data) {
      add(data);
    } else {
      setScanFeedback({ tipo: "erro", msg: `Código não encontrado: ${codigo}` });
      setTimeout(() => setScanFeedback(null), 2000);
    }
  }, [produtos]);

  useBarcodeListener(handleScan);

  const changeQtd = (id, qtd) => {
    if (qtd < 1) return setCarrinho(c => c.filter(i => i.produto_id !== id));
    const prod = produtos.find(p => p.id === id);
    if (prod && !semEstoque(prod) && qtd > prod.estoque_atual) return;
    setCarrinho(c => c.map(i => i.produto_id === id ? { ...i, quantidade: qtd, subtotal: qtd * i.preco_unitario } : i));
  };

  const finalizar = async () => {
    if (!carrinho.length || !pagamentoOk) return;
    setLoading(true);
    const pagamentos = dividir ? linhas : [{ forma: pagamento, valor: total }];
    const { venda } = await inserirVenda({ total, desconto, pagamentos });
    if (venda) {
      await supabase.from("venda_itens").insert(carrinho.map(i => ({ ...i, venda_id: venda.id })));
      await supabase.from("financeiro").insert({ tipo: "entrada", descricao: desconto > 0 ? `Venda Rápida (desconto ${fmt(desconto)})` : "Venda Rápida", valor: total, categoria: "venda" });
      await movimentarEstoque(carrinho, -1);
    }
    setCarrinho([]); setDescValor(""); setDividir(false); setSucesso(true); setLoading(false);
    setTimeout(() => setSucesso(false), 3000);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={base.pageTitle}>⚡ Venda Rápida</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.green}40`, borderRadius: 8, padding: "6px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Leitor ativo</span>
        </div>
      </div>

      {caixaEstado === "fechado" && (
        <div style={{ ...base.alert(C.accent), justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>🔒 O caixa está fechado. Abra o caixa pra conferir o dinheiro no fim do dia.</span>
          {setPage && <button style={base.btnSm()} onClick={() => setPage("caixa")}>Abrir caixa</button>}
        </div>
      )}
      {sucesso && <div style={{ ...base.alert(C.green), marginBottom: 16 }}>✅ Venda registrada!</div>}
      {scanFeedback && (
        <div style={{ ...base.alert(scanFeedback.tipo === "erro" ? C.red : C.green), marginBottom: 16 }}>
          {scanFeedback.tipo === "erro" ? "❌" : "✅"} {scanFeedback.msg}
        </div>
      )}

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Produtos */}
        <div>
          <div style={{ ...base.card, marginBottom: 12 }}>
            <input style={base.input} placeholder="🔍 Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {ultimoAdicionado && (
            <div style={{ background: `${C.green}20`, border: `1px solid ${C.green}50`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.green, fontWeight: 600 }}>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              ✅ {ultimoAdicionado} adicionado ao carrinho!
            </div>
          )}
          <div style={{ ...base.card, maxHeight: 520, overflowY: "auto" }}>
            {[...new Set(filtrados.map(p => p.categoria))].map(cat => {
              const itens = filtrados.filter(p => p.categoria === cat);
              if (!itens.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={base.sectionTitle}>📦 {cat}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                    {itens.map(p => {
                      const noCarrinho = carrinho.find(i => i.produto_id === p.id);
                      const qtdCarrinho = noCarrinho ? noCarrinho.quantidade : 0;
                      const disponivelReal = p.estoque_atual - qtdCarrinho;
                      const livre = semEstoque(p);
                      const esgotado = !livre && disponivelReal <= 0;
                      return (
                        <button key={p.id} onClick={() => add(p)} disabled={esgotado}
                          style={{ background: esgotado ? "#111100" : C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", cursor: esgotado ? "not-allowed" : "pointer", textAlign: "left", opacity: esgotado ? 0.5 : 1, position: "relative" }}>
                          {esgotado && <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontWeight: 700, color: "#a855f7", background: "#a855f720", padding: "2px 6px", borderRadius: 4 }}>ESGOTADO</div>}
                          <div style={{ fontSize: 13, fontWeight: 600, color: esgotado ? C.muted : C.text, marginBottom: 2 }}>{p.nome}</div>
                          <div style={{ fontSize: 13, color: esgotado ? C.muted : C.accent, fontWeight: 800 }}>{fmt(p.preco)}</div>
                          {!livre && <div style={{ fontSize: 11, color: esgotado ? "#a855f7" : disponivelReal <= p.estoque_minimo ? C.red : C.muted, marginTop: 2 }}>disponível: {Math.max(0, disponivelReal)}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carrinho */}
        <div style={base.card}>
          <div style={base.sectionTitle}>🛒 Carrinho</div>
          {carrinho.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>Selecione produtos ao lado</div>}
          <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
            {carrinho.map(i => (
              <div key={i.produto_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, fontSize: 13, color: C.text }}>{i.nome_produto}</div>
                <div style={base.row}>
                  <button onClick={() => changeQtd(i.produto_id, i.quantidade - 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center", color: C.text }}>{i.quantidade}</span>
                  <button onClick={() => changeQtd(i.produto_id, i.quantidade + 1)} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>+</button>
                </div>
                <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, minWidth: 70, textAlign: "right" }}>{fmt(i.subtotal)}</div>
              </div>
            ))}
          </div>
          {carrinho.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <CampoDesconto tipo={descTipo} setTipo={setDescTipo} valor={descValor} setValor={setDescValor} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={base.label}>Pagamento</label>
                  <button type="button" onClick={() => ligarDivisao(!dividir)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 6 }}>
                    {dividir ? "← uma forma só" : "Pagar em 2 formas"}
                  </button>
                </div>
                {dividir
                  ? <PagamentoDividido total={total} linhas={linhas} setLinhas={setLinhas} />
                  : (
                    <select style={base.select} value={pagamento} onChange={e => setPagamento(e.target.value)}>
                      {FORMAS_PAG.map(f => <option key={f.value} value={f.value}>{f.value.startsWith("cartao") ? `Cartão ${f.label}` : f.label}</option>)}
                    </select>
                  )}
              </div>
              {!dividir && pagamento === "dinheiro" && <div style={{ marginBottom: 12 }}><TrocoCalculator total={total} /></div>}
              {dividir && dinheiroDividido > 0 && <div style={{ marginBottom: 12 }}><TrocoCalculator total={dinheiroDividido} /></div>}
              {desconto > 0 && (
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: C.red }}><span>Desconto</span><span>− {fmt(desconto)}</span></div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, marginBottom: 14, color: C.text }}>
                <span>Total</span><span style={{ color: C.accent }}>{fmt(total)}</span>
              </div>
              <button style={{ ...base.btn(pagamentoOk ? C.green : C.muted, "#fff"), width: "100%", padding: "13px", fontSize: 15, opacity: pagamentoOk ? 1 : 0.5 }} onClick={finalizar} disabled={loading || !pagamentoOk}>
                {loading ? "Registrando..." : "✅ Finalizar Venda"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}