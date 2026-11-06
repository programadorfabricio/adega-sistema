"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase, C, base, fmt, hora, MARCA, ESCALA, PEDIDO_ONLINE } from "../../components/shared/constants";
import LogoMarca from "../../components/shared/LogoMarca";
import { NaoEncontrada } from "../ui";

const ETAPAS = [
  { id: "recebido", label: "Recebido", desc: "A adega recebeu seu pedido" },
  { id: "aceito", label: "Aceito", desc: "Estão separando seus produtos" },
  { id: "saiu", label: "Saiu para entrega", desc: "O motoboy está a caminho" },
  { id: "entregue", label: "Entregue", desc: "Bom proveito!" },
];

// status do banco → quantas etapas já foram cumpridas
const PASSO = { novo: 1, preparando: 2, saiu: 3, entregue: 4 };

export default function AcompanharPage() {
  if (!PEDIDO_ONLINE) return <NaoEncontrada />;
  return <Suspense fallback={null}><Acompanhar /></Suspense>;
}

function Acompanhar() {
  const id = useSearchParams().get("id") || "";
  const idValido = /^[0-9a-f-]{36}$/i.test(id);
  const [pedido, setPedido] = useState(undefined); // undefined = carregando, null = não achou
  const [config, setConfig] = useState({});

  useEffect(() => {
    supabase.from("configuracoes").select("*").limit(1).maybeSingle().then(({ data }) => setConfig(data || {}));
  }, []);

  useEffect(() => {
    if (!idValido) return;
    let ativo = true;
    const buscar = async () => {
      const { data } = await supabase.rpc("status_pedido_online", { p_id: id });
      if (ativo) setPedido(data || null);
    };
    buscar();
    const t = setInterval(buscar, 15000);
    return () => { ativo = false; clearInterval(t); };
  }, [id, idValido]);

  const nomeLoja = config.nome_estabelecimento || MARCA.nome;
  const whats = (config.telefone || "").replace(/\D/g, "");
  const linkWhats = whats ? `https://wa.me/${whats.length <= 11 ? "55" + whats : whats}?text=${encodeURIComponent(`Olá! Sobre o meu pedido #${pedido?.numero ?? ""}`)}` : "";

  const pagina = { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Outfit', sans-serif" };
  const miolo = { maxWidth: 480, margin: "0 auto", padding: "24px 16px", zoom: ESCALA !== 1 ? ESCALA : undefined };

  if (!idValido) return <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Pedido não encontrado. <a href="/pedir" style={{ color: C.accent, marginLeft: 6 }}>Fazer um pedido</a></div>;
  if (pedido === undefined) return <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Carregando…</div>;

  return (
    <div style={pagina}>
      <div style={miolo}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <LogoMarca size={44} emojiSize={26} />
          <div style={{ fontSize: 18, fontWeight: 800 }}>{nomeLoja}</div>
        </div>

        {pedido === null ? (
          <div style={base.card}>Pedido não encontrado. <a href="/pedir" style={{ color: C.accent }}>Fazer um pedido</a></div>
        ) : (
          <>
            <div style={{ ...base.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.muted }}>Pedido #{pedido.numero} · {hora(pedido.created_at)}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmt(pedido.total)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Pagamento na entrega</div>
            </div>

            {pedido.status === "recusado" || pedido.status === "cancelado" ? (
              <div data-status="recusado" style={base.alert(C.red)}>
                <div>
                  <b>Pedido não aceito.</b>
                  {pedido.motivo_recusa && <div style={{ marginTop: 4 }}>Motivo: {pedido.motivo_recusa}</div>}
                </div>
              </div>
            ) : (
              <div style={base.card} data-status={pedido.status}>
                {ETAPAS.map((e, i) => {
                  const feito = i < (PASSO[pedido.status] || 1);
                  const atual = i === (PASSO[pedido.status] || 1) - 1;
                  return (
                    <div key={e.id} style={{ display: "flex", gap: 12, paddingBottom: i < ETAPAS.length - 1 ? 16 : 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: feito ? C.accent : C.card2, color: feito ? "#000" : C.muted, border: `1px solid ${feito ? C.accent : C.border}` }}>{feito ? "✓" : i + 1}</div>
                      <div>
                        <div style={{ fontWeight: atual ? 800 : 600, color: feito ? C.text : C.muted }}>{e.label}</div>
                        {atual && <div style={{ fontSize: 13, color: C.muted }}>{e.desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: "14px 0" }}>Esta tela atualiza sozinha.</div>
            <div style={{ display: "grid", gap: 10 }}>
              {linkWhats && <a href={linkWhats} target="_blank" rel="noreferrer" style={{ ...base.btn(C.green, "#fff"), textAlign: "center", textDecoration: "none" }}>💬 Falar com a adega no WhatsApp</a>}
              <a href="/pedir" style={{ ...base.btnOutline, textAlign: "center", textDecoration: "none" }}>Fazer outro pedido</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
