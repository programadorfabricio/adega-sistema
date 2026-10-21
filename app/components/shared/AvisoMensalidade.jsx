"use client";
import { useState, useEffect } from "react";
import { supabase, C, base, fmt } from "./constants";

// Lê a tabela "assinatura" (1 linha por adega, editada só pela FH Digital no Supabase).
// Sem a tabela ou sem a linha, não mostra nada (ex.: demonstração).

const hojeLocal = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dataLocal = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const dataBR = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const DIA = 86400000;

export function useAssinatura() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const { data, error } = await supabase.from("assinatura").select("*").limit(1);
      if (!ativo || error || !data?.[0]?.vencimento) return;
      const a = data[0];
      const venc = dataLocal(a.vencimento);
      const dias = Math.round((venc - hojeLocal()) / DIA);       // >0 faltam, <0 atrasado
      const tolerancia = Number(a.dias_tolerancia ?? 5);
      const bloqueio = new Date(venc.getTime() + tolerancia * DIA);
      const diasParaBloqueio = Math.round((bloqueio - hojeLocal()) / DIA);
      let estado = "ok";
      if (dias <= Number(a.dias_aviso ?? 5)) estado = "aviso";
      if (dias < 0) estado = "atrasado";
      if (a.bloquear !== false && diasParaBloqueio <= 0) estado = "bloqueado";
      setInfo({ ...a, venc, dias, diasParaBloqueio, bloqueio, estado });
    };
    carregar();
    const t = setInterval(carregar, 30 * 60000);
    return () => { ativo = false; clearInterval(t); };
  }, []);
  return info;
}

function BotoesPagamento({ info }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(info.pix); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { window.prompt("Copie a chave Pix:", info.pix); }
  };
  const msg = `Olá! Segue o comprovante da mensalidade do sistema (vencimento ${dataBR(info.venc)}).`;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {info.pix && <button style={base.btnSm(C.accent, "#000")} onClick={copiar}>{copiado ? "✅ Chave copiada" : "📋 Copiar chave Pix"}</button>}
      {info.whatsapp && (
        <a href={`https://wa.me/${String(info.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
          style={{ ...base.btnSm(C.green, "#fff"), textDecoration: "none" }}>💬 Enviar comprovante</a>
      )}
    </div>
  );
}

// Faixa no topo das telas (aviso antes do vencimento e atraso dentro da tolerância)
export function FaixaMensalidade({ info }) {
  const chave = info ? `aviso-mensalidade-${info.vencimento}-${new Date().toDateString()}` : "";
  const [fechado, setFechado] = useState(() => {
    try { return !!(chave && sessionStorage.getItem(chave)); } catch { return false; }
  });
  if (!info || (info.estado !== "aviso" && info.estado !== "atrasado")) return null;
  const atrasado = info.estado === "atrasado";
  if (!atrasado && fechado) return null;

  const cor = atrasado ? C.red : C.accent;
  const titulo = atrasado
    ? `Mensalidade vencida há ${-info.dias} dia${info.dias === -1 ? "" : "s"}`
    : info.dias === 0 ? "Sua mensalidade vence hoje" : `Sua mensalidade vence em ${info.dias} dia${info.dias === 1 ? "" : "s"} (${dataBR(info.venc)})`;
  const texto = atrasado
    ? (info.bloquear !== false
        ? `Pague até ${dataBR(new Date(info.bloqueio.getTime() - DIA))} para o sistema não ser suspenso.`
        : "Regularize para continuar usando o sistema normalmente.")
    : `Valor: ${fmt(info.valor)}. Pague pelo Pix e envie o comprovante.`;

  return (
    <div style={{ background: `${cor}18`, border: `1px solid ${cor}55`, borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ fontSize: 22 }}>{atrasado ? "⚠️" : "🔔"}</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, color: cor, fontSize: 14 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{texto}</div>
      </div>
      <BotoesPagamento info={info} />
      {!atrasado && (
        <button aria-label="Fechar aviso" onClick={() => { try { sessionStorage.setItem(chave, "1"); } catch {} setFechado(true); }}
          style={{ background: "transparent", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}

// Tela inteira por cima do sistema quando passa da tolerância
export function BloqueioMensalidade({ info }) {
  if (!info || info.estado !== "bloqueado") return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ ...base.card, maxWidth: 440, width: "100%", textAlign: "center", border: `1px solid ${C.red}66` }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 8 }}>Sistema suspenso</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>
          A mensalidade venceu em {dataBR(info.venc)} e ainda não identificamos o pagamento.
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 18 }}>
          Pague {fmt(info.valor)} pelo Pix e envie o comprovante. O acesso volta assim que confirmarmos.
        </div>
        {info.pix && <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, marginBottom: 14, wordBreak: "break-all" }}>Pix: <b>{info.pix}</b></div>}
        <div style={{ display: "flex", justifyContent: "center" }}><BotoesPagamento info={info} /></div>
      </div>
    </div>
  );
}
