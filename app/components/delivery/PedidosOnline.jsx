"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, C, base, fmt, hora, SCHEMA, MARCA, semEstoque } from "../shared/constants";
import { movimentarEstoque } from "../shared/estoque";

// Pedidos que chegam pela página /pedir (status "novo").
// Aceitar baixa o estoque e manda pro fluxo normal ("preparando"); recusar não mexe no estoque.

const FORMA = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };

const abrirWhats = (tel, texto) => {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return null;
  return window.open(`https://wa.me/${d.length <= 11 ? "55" + d : d}?text=${encodeURIComponent(texto)}`, "_blank");
};

function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach(t => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.15);
    });
  } catch { /* navegador sem áudio */ }
}

export default function PedidosOnline({ onMudou }) {
  const [pedidos, setPedidos] = useState([]);
  const [config, setConfig] = useState(null);
  const [ocupado, setOcupado] = useState(null); // id do pedido sendo aceito/recusado
  const [aviso, setAviso] = useState("");
  const qtdAnterior = useRef(null);
  const travas = useRef(new Set()); // evita clique duplo antes do re-render

  const load = useCallback(async () => {
    const { data } = await supabase.from("entregas").select("*").eq("status", "novo").order("created_at", { ascending: true });
    const lista = data || [];
    if (qtdAnterior.current !== null && lista.length > qtdAnterior.current) bip();
    qtdAnterior.current = lista.length;
    setPedidos(lista);
  }, []);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
    setConfig(data || {});
  }, []);

  useEffect(() => {
    load(); loadConfig();
    const channel = supabase.channel("delivery-online-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "entregas" }, load)
      .subscribe();
    const t = setInterval(load, 20000); // garante mesmo se o tempo real cair
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [load, loadConfig]);

  const mostrar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };

  const aceitar = async (p) => {
    if (travas.current.has(p.id)) return;
    travas.current.add(p.id); setOcupado(p.id);
    try {
      const itens = p.itens || [];
      const { data: atuais, error: erroProd } = await supabase.from("produtos").select("*").in("id", itens.map(i => i.produto_id));
      if (erroProd) { mostrar("Sem conexão pra conferir o estoque. Tente de novo."); return; }
      for (const i of itens) {
        const prod = (atuais || []).find(x => x.id === i.produto_id);
        if (prod && !semEstoque(prod) && Number(prod.estoque_atual) < Number(i.quantidade)) {
          mostrar(`Estoque insuficiente de ${prod.nome} (restam ${prod.estoque_atual}). Recuse ou ajuste o estoque.`);
          return;
        }
      }
      // Só quem mudar de "novo" pra "preparando" baixa o estoque (outro caixa pode ter aceitado junto)
      const { data: mudou } = await supabase.from("entregas").update({ status: "preparando" })
        .eq("id", p.id).eq("status", "novo").select();
      if (!mudou?.length) {
        mostrar(`O pedido #${p.numero} já foi aceito ou recusado em outro caixa.`);
      } else {
        try { await movimentarEstoque(itens, -1, `delivery #${p.numero}`); }
        catch { mostrar(`Pedido #${p.numero} aceito, mas o estoque não baixou (sem conexão). Confira no Estoque.`); }
      }
      await load(); onMudou?.();
    } finally {
      travas.current.delete(p.id); setOcupado(null);
    }
  };

  const recusar = async (p) => {
    if (travas.current.has(p.id)) return;
    const motivo = window.prompt(`Recusar o pedido #${p.numero} de ${p.cliente_nome}? Escreva o motivo (o cliente vê):`, "");
    if (motivo === null) return;
    // Abre o WhatsApp ainda no clique: no iPhone/iPad, janela aberta depois de esperar o banco é bloqueada
    const janela = abrirWhats(p.telefone, `Olá, ${p.cliente_nome.split(" ")[0]}! Aqui é da ${MARCA.nome}. Infelizmente não conseguimos atender o seu pedido #${p.numero}${motivo.trim() ? `: ${motivo.trim()}` : "."} Desculpe!`);
    travas.current.add(p.id); setOcupado(p.id);
    try {
      const { data: mudou } = await supabase.from("entregas")
        .update({ status: "recusado", motivo_recusa: motivo.trim() || null })
        .eq("id", p.id).eq("status", "novo").select();
      if (!mudou?.length) {
        janela?.close();
        mostrar(`O pedido #${p.numero} já foi aceito ou recusado em outro caixa.`);
      }
      await load(); onMudou?.();
    } finally {
      travas.current.delete(p.id); setOcupado(null);
    }
  };

  const aberto = config?.pedido_online_aberto !== false;
  const alternarAberto = async () => {
    const novo = !aberto;
    let res = config?.id
      ? await supabase.from("configuracoes").update({ pedido_online_aberto: novo }).eq("id", config.id).select()
      : null;
    // Sem configuração salva ainda (ou a linha sumiu): cria uma
    if (!res || (!res.error && !res.data?.length)) {
      res = await supabase.from("configuracoes").insert({ pedido_online_aberto: novo }).select();
    }
    if (res.error || !res.data?.length) {
      mostrar(`Não foi possível ${novo ? "ligar" : "desligar"} os pedidos online. ${res.error?.message || "Tente de novo."}`);
      return;
    }
    setConfig(res.data[0]);
  };

  const link = typeof window !== "undefined" ? `${window.location.origin}/pedir` : "/pedir";
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(link); mostrar("Link do cardápio copiado"); }
    catch { window.prompt("Copie o link do cardápio:", link); }
  };

  return (
    <div data-bloco="pedidos-online" style={{ ...base.card, marginBottom: 20, borderColor: pedidos.length ? C.accent : C.border }}>
      <div style={{ ...base.row, justifyContent: "space-between", flexWrap: "wrap", marginBottom: pedidos.length ? 14 : 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          🔔 Pedidos online {pedidos.length > 0 && <span style={base.tag(C.accent)}>{pedidos.length} novo{pedidos.length > 1 ? "s" : ""}</span>}
        </div>
        <div style={{ ...base.row, flexWrap: "wrap" }}>
          <button style={base.btnSm(aberto ? C.green : C.red, "#fff")} onClick={alternarAberto}>
            {aberto ? "● Recebendo pedidos: ligado" : "○ Recebendo pedidos: desligado"}
          </button>
          <button style={base.btnSm(C.card2, C.text)} onClick={copiarLink} title={link}>🔗 Copiar link do cardápio</button>
        </div>
      </div>

      {aviso && <div style={{ ...base.alert(C.blue), marginBottom: 10 }}>{aviso}</div>}
      {pedidos.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Nenhum pedido online esperando.</div>}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {pedidos.map(p => (
          <div key={p.id} data-pedido={p.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b>#{p.numero} · {p.cliente_nome}</b>
              <span style={{ fontSize: 12, color: C.muted }}>{hora(p.created_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, margin: "4px 0 8px" }}>
              {p.endereco}{p.bairro ? ` · ${p.bairro}` : ""}{p.referencia ? ` · ${p.referencia}` : ""}
            </div>
            {(p.itens || []).map((i, k) => (
              <div key={k} style={{ fontSize: 13 }}>{i.quantidade}× {i.nome_produto}</div>
            ))}
            {p.observacao && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Obs: {p.observacao}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
              <span>{FORMA[p.forma_pagamento] || p.forma_pagamento}{p.troco_para ? ` · troco p/ ${fmt(p.troco_para)}` : ""}</span>
              <b style={{ color: C.accent }}>{fmt(p.total)}</b>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...base.btnSm(C.green, "#fff"), flex: 1, opacity: ocupado === p.id ? 0.6 : 1 }} disabled={ocupado === p.id} onClick={() => aceitar(p)}>✓ Aceitar</button>
              <button style={{ ...base.btnSm(C.red, "#fff"), opacity: ocupado === p.id ? 0.6 : 1 }} disabled={ocupado === p.id} onClick={() => recusar(p)}>✕ Recusar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
