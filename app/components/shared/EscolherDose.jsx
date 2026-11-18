"use client";
import { C, base, fmt } from "./constants";

// "Dose R$ 4,00" é um atalho de preço: ao vender, pergunta QUAL pinga foi servida
// e lança a dose daquela pinga (que tem receita: tira os ml da garrafa certa).
export const ehSeletorDose = (p) => /^dose\s+r\$/i.test(String(p?.nome || "").trim());

export function opcoesDose(seletor, produtos) {
  return (produtos || [])
    .filter(x => x.ativo !== false && x.id !== seletor.id && !ehSeletorDose(x)
      && x.categoria === seletor.categoria && Math.abs(Number(x.preco) - Number(seletor.preco)) < 0.005)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export default function EscolherDose({ seletor, opcoes, onEscolher, onCancelar }) {
  return (
    <div style={base.modal} onClick={onCancelar}>
      <div style={{ ...base.modalBox, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 4 }}>🥃 {seletor.nome}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Qual foi servida?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
          {opcoes.map(o => (
            <button key={o.id} type="button" onClick={() => onEscolher(o)}
              style={{ padding: "14px 8px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.border}`, background: C.card2, color: C.text, textAlign: "center" }}>
              {o.nome.replace(/^dose\s+/i, "")}
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{fmt(o.preco)}</div>
            </button>
          ))}
        </div>
        <button style={base.btnOutline} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
