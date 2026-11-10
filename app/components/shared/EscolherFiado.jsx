"use client";
import { useEffect, useState } from "react";
import { C, base, fmt } from "./constants";
import { listarFiados } from "./fiado";

// Escolhe um fiado que já existe ou cria um novo (nome + WhatsApp).
// onConfirmar({ id }) ou onConfirmar({ nome, telefone })
export default function EscolherFiado({ titulo, descricao, nomeSugerido = "", telefoneSugerido = "", textoNovo = "Fiado novo", erro, carregando, onConfirmar, onCancelar, excluirId }) {
  const [fiados, setFiados] = useState(null);
  const [escolha, setEscolha] = useState("novo");
  const [nome, setNome] = useState(nomeSugerido);
  const [tel, setTel] = useState(telefoneSugerido);
  const [busca, setBusca] = useState("");

  useEffect(() => { listarFiados().then(l => setFiados(l.filter(f => f.id !== excluirId))); }, [excluirId]);
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = (fiados || []).filter(f => semAcento(f.nome_cliente).includes(semAcento(busca)));
  const ok = escolha !== "novo" || nome.trim().length > 0;

  return (
    <div style={base.modal}>
      <div style={{ ...base.modalBox, maxWidth: 440 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>📒 {titulo}</div>
        {descricao && <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{descricao}</div>}

        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: escolha === "novo" ? C.accentBg : C.card2, border: `1px solid ${escolha === "novo" ? C.accent : C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <input type="radio" checked={escolha === "novo"} onChange={() => setEscolha("novo")} />
          <span style={{ fontWeight: 700, color: C.text }}>{textoNovo}</span>
        </label>
        {escolha === "novo" && (
          <div style={{ padding: "4px 4px 12px" }}>
            <label style={base.label}>Nome do cliente</label>
            <input style={{ ...base.input, marginBottom: 8 }} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: João da oficina" />
            <label style={base.label}>WhatsApp (opcional)</label>
            <input style={base.input} value={tel} onChange={e => setTel(e.target.value)} placeholder="(19) 99999-9999" inputMode="tel" />
          </div>
        )}

        {fiados === null && <div style={{ fontSize: 13, color: C.muted, margin: "8px 0" }}>Carregando fiados…</div>}
        {fiados?.length > 0 && <>
          <div style={{ fontSize: 12, color: C.muted, margin: "8px 0 6px" }}>Ou junte no fiado de quem já deve:</div>
          {fiados.length > 6 && <input style={{ ...base.input, marginBottom: 8 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Procurar cliente…" />}
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {lista.map(f => (
              <label key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: escolha === f.id ? C.accentBg : C.card2, border: `1px solid ${escolha === f.id ? C.accent : C.border}`, borderRadius: 10, padding: "8px 12px" }}>
                <input type="radio" checked={escolha === f.id} onChange={() => setEscolha(f.id)} />
                <span style={{ flex: 1, color: C.text }}>{f.nome_cliente}</span>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>deve {fmt(Math.max(0, Number(f.total || 0) - Number(f.valor_pago || 0)))}</span>
              </label>
            ))}
          </div>
        </>}

        {erro && <div style={{ ...base.alert(C.red), marginBottom: 12 }}>{erro}</div>}
        <div style={base.row}>
          <button style={{ ...base.btn(), opacity: ok && !carregando ? 1 : 0.5 }} disabled={!ok || carregando}
            onClick={() => onConfirmar(escolha === "novo" ? { nome, telefone: tel } : { id: escolha })}>
            {carregando ? "Lançando…" : "📒 Lançar no fiado"}
          </button>
          <button style={base.btnOutline} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
