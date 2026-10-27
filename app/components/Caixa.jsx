"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base, fmt, hora, dataHora, SCHEMA, MARCA } from "./shared/constants";
import { partesDaVenda } from "./shared/pagamento";

const FORMAS = [
  { id: "dinheiro", label: "Dinheiro", icon: "💵" },
  { id: "pix", label: "PIX", icon: "⚡" },
  { id: "cartao_debito", label: "Cartão Débito", icon: "💳" },
  { id: "cartao_credito", label: "Cartão Crédito", icon: "💳" },
];

const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Soma das vendas do período por forma de pagamento + movimentos da gaveta
function calcular(caixa, vendas, movimentos) {
  const porForma = Object.fromEntries(FORMAS.map(f => [f.id, 0]));
  for (const v of vendas) for (const p of partesDaVenda(v)) porForma[p.forma] = (porForma[p.forma] || 0) + p.valor;
  const totalVendas = vendas.reduce((a, v) => a + Number(v.total), 0);
  const sangrias = movimentos.filter(m => m.tipo === "sangria").reduce((a, m) => a + Number(m.valor), 0);
  const suprimentos = movimentos.filter(m => m.tipo === "suprimento").reduce((a, m) => a + Number(m.valor), 0);
  const esperado = Number(caixa?.troco_inicial || 0) + (porForma.dinheiro || 0) + suprimentos - sangrias;
  return { porForma, totalVendas, qtdVendas: vendas.length, sangrias, suprimentos, esperado };
}

function textoResumo(caixa, r, contado, diferenca) {
  const linhas = [
    `📋 FECHAMENTO DE CAIXA — ${MARCA.nome}`,
    `Aberto: ${dataHora(caixa.aberto_em)} por ${caixa.aberto_por || "—"}`,
    `Fechado: ${dataHora(caixa.fechado_em || new Date())} por ${caixa.fechado_por || "—"}`,
    "",
    `Vendas: ${r.qtdVendas} · Total ${fmt(r.totalVendas)}`,
    ...FORMAS.map(f => `  ${f.label}: ${fmt(r.porForma[f.id] || 0)}`),
    "",
    `Troco inicial: ${fmt(caixa.troco_inicial)}`,
    `Suprimentos: ${fmt(r.suprimentos)}`,
    `Sangrias: ${fmt(r.sangrias)}`,
    `Dinheiro esperado na gaveta: ${fmt(r.esperado)}`,
    `Dinheiro contado: ${fmt(contado)}`,
    `Diferença: ${diferenca === 0 ? "bateu certinho ✅" : `${diferenca > 0 ? "sobrou" : "faltou"} ${fmt(Math.abs(diferenca))}`}`,
  ];
  if (caixa.observacao) linhas.push("", `Obs: ${caixa.observacao}`);
  return linhas.join("\n");
}

// Usado pela Venda Rápida para avisar quando o caixa está fechado
export function useCaixaAberto() {
  const [estado, setEstado] = useState("carregando"); // carregando | aberto | fechado | indisponivel
  useEffect(() => {
    let ativo = true;
    const ver = async () => {
      const { data, error } = await supabase.from("caixas").select("id").eq("status", "aberto").limit(1);
      if (!ativo) return;
      setEstado(error ? "indisponivel" : data?.length ? "aberto" : "fechado");
    };
    ver();
    const ch = supabase.channel("caixa-estado").on("postgres_changes", { event: "*", schema: SCHEMA, table: "caixas" }, ver).subscribe();
    return () => { ativo = false; supabase.removeChannel(ch); };
  }, []);
  return estado;
}

export default function Caixa({ usuario }) {
  const gestao = usuario?.cargo === "admin" || usuario?.cargo === "gerente";
  const [caixa, setCaixa] = useState(null);
  const [vendas, setVendas] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [trocoInicial, setTrocoInicial] = useState("");
  const [movModal, setMovModal] = useState(null); // 'sangria' | 'suprimento'
  const [movForm, setMovForm] = useState({ valor: "", motivo: "" });
  const [fechando, setFechando] = useState(false);
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [resultado, setResultado] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("caixas").select("*").eq("status", "aberto").order("aberto_em", { ascending: false }).limit(1);
    if (error) { setIndisponivel(true); setCarregando(false); return; }
    const atual = data?.[0] || null;
    setCaixa(atual);
    if (atual) {
      const [{ data: vs }, { data: ms }] = await Promise.all([
        supabase.from("vendas").select("*").eq("status", "concluida").gte("created_at", atual.aberto_em),
        supabase.from("caixa_movimentos").select("*").eq("caixa_id", atual.id).order("created_at"),
      ]);
      setVendas(vs || []); setMovimentos(ms || []);
    } else { setVendas([]); setMovimentos([]); }
    const { data: hist } = await supabase.from("caixas").select("*").eq("status", "fechado").order("fechado_em", { ascending: false }).limit(30);
    setHistorico(hist || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("caixa-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "caixas" }, load)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "caixa_movimentos" }, load)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "vendas" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  const mostrarAviso = (m) => { setAviso(m); setTimeout(() => setAviso(""), 2500); };
  const r = calcular(caixa, vendas, movimentos);

  const abrir = async () => {
    setSalvando(true);
    await supabase.from("caixas").insert({ status: "aberto", aberto_por: usuario?.nome || null, troco_inicial: num(trocoInicial) });
    setTrocoInicial(""); setResultado(null); setSalvando(false); load();
    mostrarAviso("Caixa aberto");
  };

  const salvarMov = async () => {
    const valor = num(movForm.valor);
    if (valor <= 0 || !caixa) return;
    setSalvando(true);
    await supabase.from("caixa_movimentos").insert({ caixa_id: caixa.id, tipo: movModal, valor, motivo: movForm.motivo.trim() || null, usuario: usuario?.nome || null });
    setSalvando(false); setMovModal(null); setMovForm({ valor: "", motivo: "" }); load();
    mostrarAviso(movModal === "sangria" ? "Sangria registrada" : "Suprimento registrado");
  };

  const fechar = async () => {
    if (contado === "" || !caixa) return;
    setSalvando(true);
    // Recalcula com os dados mais recentes antes de gravar
    const [{ data: vs }, { data: ms }] = await Promise.all([
      supabase.from("vendas").select("*").eq("status", "concluida").gte("created_at", caixa.aberto_em),
      supabase.from("caixa_movimentos").select("*").eq("caixa_id", caixa.id),
    ]);
    const final = calcular(caixa, vs || [], ms || []);
    const valorContado = num(contado);
    const diferenca = Math.round((valorContado - final.esperado) * 100) / 100;
    const agora = new Date().toISOString();
    const dados = {
      status: "fechado", fechado_em: agora, fechado_por: usuario?.nome || null,
      esperado_dinheiro: final.esperado, contado_dinheiro: valorContado, diferenca,
      total_vendas: final.totalVendas, observacao: obs.trim() || null,
      resumo: { porForma: final.porForma, qtdVendas: final.qtdVendas, sangrias: final.sangrias, suprimentos: final.suprimentos },
    };
    await supabase.from("caixas").update(dados).eq("id", caixa.id);
    setResultado({ caixa: { ...caixa, ...dados }, r: final, contado: valorContado, diferenca });
    setFechando(false); setContado(""); setObs(""); setSalvando(false); load();
  };

  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); mostrarAviso("Resumo copiado: é só colar no WhatsApp"); }
    catch { window.prompt("Copie o resumo:", texto); }
  };

  const rDoHistorico = (cx) => ({
    porForma: cx.resumo?.porForma || {}, qtdVendas: cx.resumo?.qtdVendas || 0,
    totalVendas: Number(cx.total_vendas || 0), sangrias: cx.resumo?.sangrias || 0,
    suprimentos: cx.resumo?.suprimentos || 0, esperado: Number(cx.esperado_dinheiro || 0),
  });

  const corDif = (d) => (Math.abs(Number(d)) < 0.01 ? C.green : Number(d) > 0 ? C.blue : C.red);
  const textoDif = (d) => (Math.abs(Number(d)) < 0.01 ? "Bateu" : `${Number(d) > 0 ? "Sobrou" : "Faltou"} ${fmt(Math.abs(Number(d)))}`);

  if (indisponivel) return (
    <div>
      <div style={base.pageTitle}>💰 Caixa</div>
      <div style={base.alert(C.red)}>O controle de caixa ainda não foi ativado neste sistema. Fale com o suporte da FH Digital.</div>
    </div>
  );
  if (carregando) return <div style={{ color: C.muted }}>Carregando...</div>;

  const abertoHaMuito = caixa && (Date.now() - new Date(caixa.aberto_em).getTime()) > 20 * 3600000;

  return (
    <div>
      <div style={base.pageTitle}>🧾 Caixa</div>
      {aviso && <div style={base.alert(C.green)}>✅ {aviso}</div>}

      {/* Resultado do fechamento que acabou de acontecer */}
      {resultado && (
        <div style={{ ...base.card, marginBottom: 20, border: `1px solid ${corDif(resultado.diferenca)}66` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Caixa fechado</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: corDif(resultado.diferenca), marginBottom: 8 }}>{textoDif(resultado.diferenca)}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
            Esperado na gaveta {fmt(resultado.r.esperado)} · Contado {fmt(resultado.contado)} · Vendas {fmt(resultado.r.totalVendas)}
          </div>
          <div style={base.row}>
            <button style={base.btnSm()} onClick={() => copiar(textoResumo(resultado.caixa, resultado.r, resultado.contado, resultado.diferenca))}>📋 Copiar resumo</button>
            <button style={base.btnSm(C.card2, C.muted)} onClick={() => setResultado(null)}>Fechar</button>
          </div>
        </div>
      )}

      {!caixa ? (
        <div style={{ ...base.card, maxWidth: 460, marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>🔒 Caixa fechado</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Conte o dinheiro que está na gaveta para começar o dia.</div>
          <label style={base.label}>Troco inicial na gaveta (R$)</label>
          <input style={{ ...base.input, marginBottom: 14 }} type="number" inputMode="decimal" placeholder="Ex: 100" value={trocoInicial} onChange={e => setTrocoInicial(e.target.value)} />
          <button style={{ ...base.btn(C.green, "#fff"), width: "100%", padding: 13 }} onClick={abrir} disabled={salvando}>
            {salvando ? "Abrindo..." : "Abrir caixa"}
          </button>
        </div>
      ) : (
        <>
          {abertoHaMuito && <div style={base.alert(C.red)}>⚠️ Este caixa está aberto desde {dataHora(caixa.aberto_em)}. Feche o caixa do dia anterior antes de começar outro.</div>}

          <div style={{ ...base.card, marginBottom: 16 }}>
            <div style={{ ...base.row, justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>🟢 Caixa aberto</div>
                <div style={{ fontSize: 12, color: C.muted }}>desde {dataHora(caixa.aberto_em)}{caixa.aberto_por ? ` · por ${caixa.aberto_por}` : ""} · troco inicial {fmt(caixa.troco_inicial)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={base.btnSm(C.red, "#fff")} onClick={() => { setMovForm({ valor: "", motivo: "" }); setMovModal("sangria"); }}>➖ Sangria</button>
                <button style={base.btnSm(C.blue, "#fff")} onClick={() => { setMovForm({ valor: "", motivo: "" }); setMovModal("suprimento"); }}>➕ Suprimento</button>
                <button style={base.btnSm()} onClick={() => setFechando(true)}>🔒 Fechar caixa</button>
              </div>
            </div>

            <div className="grid-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
              {FORMAS.map(f => (
                <div key={f.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{fmt(r.porForma[f.id] || 0)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 14, color: C.text }}>
              <span>{r.qtdVendas} venda{r.qtdVendas === 1 ? "" : "s"} · total <b style={{ color: C.accent }}>{fmt(r.totalVendas)}</b></span>
              {gestao && <span>Dinheiro que deve ter na gaveta: <b style={{ color: C.accent }}>{fmt(r.esperado)}</b></span>}
            </div>
          </div>

          <div style={{ ...base.card, marginBottom: 24 }}>
            <div style={base.sectionTitle}>Movimentos da gaveta</div>
            {movimentos.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nenhuma sangria ou suprimento.</div>}
            {movimentos.map(m => (
              <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={base.tag(m.tipo === "sangria" ? C.red : C.blue)}>{m.tipo === "sangria" ? "Sangria" : "Suprimento"}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.text }}>{m.motivo || "—"}{m.usuario ? <span style={{ color: C.muted }}> · {m.usuario}</span> : null}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{hora(m.created_at)}</span>
                <b style={{ fontSize: 14, color: m.tipo === "sangria" ? C.red : C.blue }}>{m.tipo === "sangria" ? "−" : "+"}{fmt(m.valor)}</b>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Histórico */}
      {gestao && (
        <div style={base.card}>
          <div style={base.sectionTitle}>Caixas anteriores</div>
          {historico.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nenhum caixa fechado ainda.</div>}
          {historico.map(cx => (
            <button key={cx.id} onClick={() => setDetalhe(cx)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
              <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: C.text }}>
                {dataHora(cx.aberto_em)} → {hora(cx.fechado_em)}
                <span style={{ color: C.muted }}> · {cx.fechado_por || cx.aberto_por || "—"}</span>
              </span>
              <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>{fmt(cx.total_vendas)}</span>
              <span style={base.tag(corDif(cx.diferenca))}>{textoDif(cx.diferenca)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal sangria/suprimento */}
      {movModal && (
        <div style={base.modal} onClick={() => !salvando && setMovModal(null)}>
          <div style={base.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>{movModal === "sangria" ? "➖ Sangria" : "➕ Suprimento"}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              {movModal === "sangria" ? "Dinheiro que saiu da gaveta (ex.: levado pro cofre, pagamento de fornecedor)." : "Dinheiro que entrou na gaveta (ex.: mais troco)."}
            </div>
            <label style={base.label}>Valor (R$)</label>
            <input style={{ ...base.input, marginBottom: 12 }} type="number" inputMode="decimal" autoFocus value={movForm.valor} onChange={e => setMovForm({ ...movForm, valor: e.target.value })} />
            <label style={base.label}>Motivo</label>
            <input style={{ ...base.input, marginBottom: 16 }} placeholder={movModal === "sangria" ? "Ex: cofre, gelo, motoboy" : "Ex: troco"} value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} />
            <div style={base.row}>
              <button style={{ ...base.btn(movModal === "sangria" ? C.red : C.blue, "#fff"), flex: 1 }} onClick={salvarMov} disabled={salvando || num(movForm.valor) <= 0}>Registrar</button>
              <button style={base.btnOutline} onClick={() => setMovModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fechar caixa */}
      {fechando && caixa && (
        <div style={base.modal} onClick={() => !salvando && setFechando(false)}>
          <div style={base.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>🔒 Fechar caixa</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              Conte o dinheiro da gaveta e digite o valor. {gestao ? "" : "O sistema confere com as vendas depois que você confirmar."}
            </div>
            {gestao && (
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: C.text }}>
                Deve ter na gaveta: <b style={{ color: C.accent }}>{fmt(r.esperado)}</b>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>troco {fmt(caixa.troco_inicial)} + vendas em dinheiro {fmt(r.porForma.dinheiro || 0)} + suprimentos {fmt(r.suprimentos)} − sangrias {fmt(r.sangrias)}</div>
              </div>
            )}
            <label style={base.label}>Dinheiro contado na gaveta (R$)</label>
            <input style={{ ...base.input, marginBottom: 12 }} type="number" inputMode="decimal" autoFocus value={contado} onChange={e => setContado(e.target.value)} />
            <label style={base.label}>Observação</label>
            <input style={{ ...base.input, marginBottom: 16 }} placeholder="Opcional" value={obs} onChange={e => setObs(e.target.value)} />
            <div style={base.row}>
              <button style={{ ...base.btn(C.green, "#fff"), flex: 1 }} onClick={fechar} disabled={salvando || contado === ""}>{salvando ? "Fechando..." : "Confirmar fechamento"}</button>
              <button style={base.btnOutline} onClick={() => setFechando(false)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalhe do histórico */}
      {detalhe && (() => {
        const rh = rDoHistorico(detalhe);
        return (
          <div style={base.modal} onClick={() => setDetalhe(null)}>
            <div style={base.modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Caixa de {dataHora(detalhe.aberto_em)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Aberto por {detalhe.aberto_por || "—"} · fechado às {hora(detalhe.fechado_em)} por {detalhe.fechado_por || "—"}</div>
              {FORMAS.map(f => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.text, padding: "4px 0" }}><span>{f.icon} {f.label}</span><span>{fmt(rh.porForma[f.id] || 0)}</span></div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: C.accent, padding: "8px 0", borderTop: `1px solid ${C.border}`, marginTop: 6 }}><span>Total ({rh.qtdVendas} vendas)</span><span>{fmt(rh.totalVendas)}</span></div>
              {[["Troco inicial", detalhe.troco_inicial], ["Suprimentos", rh.suprimentos], ["Sangrias", rh.sangrias], ["Esperado na gaveta", detalhe.esperado_dinheiro], ["Contado", detalhe.contado_dinheiro]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, padding: "3px 0" }}><span>{l}</span><span>{fmt(v)}</span></div>
              ))}
              <div style={{ fontSize: 22, fontWeight: 900, color: corDif(detalhe.diferenca), margin: "12px 0" }}>{textoDif(detalhe.diferenca)}</div>
              {detalhe.observacao && <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>📝 {detalhe.observacao}</div>}
              <div style={base.row}>
                <button style={base.btnSm()} onClick={() => copiar(textoResumo(detalhe, rh, Number(detalhe.contado_dinheiro), Number(detalhe.diferenca)))}>📋 Copiar resumo</button>
                <button style={base.btnSm(C.card2, C.muted)} onClick={() => setDetalhe(null)}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
