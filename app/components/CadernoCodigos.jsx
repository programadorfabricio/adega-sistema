"use client";
// Caderno de códigos: folha impressa com o código de barras dos produtos que não dá pra bipar
// (barrigudinha sem rótulo, doce a granel, dose...). O caixa bipa a folha em vez do produto.
import { useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { supabase, C, base, fmt } from "./shared/constants";
import { codigoInterno, formatoBarras } from "./shared/codigos.mjs";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function svgBarras(codigo) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, codigo, { format: formatoBarras(codigo), width: 2, height: 56, fontSize: 14, margin: 4, displayValue: true });
  return svg.outerHTML;
}

function imprimirFolha(itens) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Caderno de códigos</title><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    .grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
    .cel { border: 1px dashed #999; border-radius: 3mm; padding: 3mm; text-align: center; break-inside: avoid; }
    .n { font-weight: bold; font-size: 12pt; margin-bottom: 1mm; }
    .p { font-size: 11pt; margin-bottom: 1mm; }
    svg { max-width: 100%; height: auto; }
  </style></head><body><div class="grade">
    ${itens.map((p) => `<div class="cel"><div class="n">${esc(p.nome)}</div><div class="p">${esc(fmt(p.preco))}</div>${svgBarras(p.codigo_barras)}</div>`).join("")}
  </div></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1500); }, 300);
}

export default function CadernoCodigos({ produtos, onFechar, onAtualizou }) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState(() => new Set());
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const lista = useMemo(() => {
    const t = semAcento(busca.trim());
    return produtos.filter((p) => !t || semAcento(p.nome).includes(t) || semAcento(p.categoria).includes(t)).slice(0, 300);
  }, [produtos, busca]);
  const alternar = (id) => setMarcados((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const escolhidos = produtos.filter((p) => marcados.has(p.id));
  const semCodigo = escolhidos.filter((p) => !String(p.codigo_barras || "").trim()).length;

  const gerar = async () => {
    setGerando(true); setErro("");
    try {
      const prontos = [];
      for (const p of escolhidos) {
        let codigo = String(p.codigo_barras || "").trim();
        if (!codigo) {
          for (let tentativa = 0; tentativa < 5 && !codigo; tentativa++) {
            const novo = codigoInterno();
            const { data: usado } = await supabase.from("produtos").select("id").eq("codigo_barras", novo).limit(1);
            if (!usado?.length) codigo = novo;
          }
          const { error } = await supabase.from("produtos").update({ codigo_barras: codigo }).eq("id", p.id);
          if (error) throw new Error(`Não salvou o código de "${p.nome}": ${error.message}`);
        }
        prontos.push({ ...p, codigo_barras: codigo });
      }
      if (semCodigo) onAtualizou?.();
      imprimirFolha(prontos);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div style={base.modal}>
      <div style={{ ...base.modalBox, maxWidth: 560 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>🏷️ Caderno de códigos</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          Marque os produtos que não dá pra bipar (barrigudinha, doce a granel...). Sai uma folha A4 com o código de cada um pra deixar no balcão.
          Quem não tem código ganha um código interno da loja.
        </div>
        <input style={{ ...base.input, marginBottom: 10 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Procurar produto ou categoria (ex.: barrigudinha)" autoFocus />
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {lista.map((p) => (
            <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: marcados.has(p.id) ? C.accentBg : C.card2, border: `1px solid ${marcados.has(p.id) ? C.accent : C.border}`, borderRadius: 8, padding: "7px 10px" }}>
              <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
              <span style={{ flex: 1, color: C.text, fontSize: 13 }}>{p.nome}</span>
              <span style={{ fontSize: 11, color: p.codigo_barras ? C.muted : C.accent }}>{p.codigo_barras ? "tem código" : "sem código"}</span>
            </label>
          ))}
          {lista.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 12 }}>Nenhum produto encontrado.</div>}
        </div>
        {erro && <div style={{ ...base.alert(C.red), marginBottom: 10 }}>{erro}</div>}
        <div style={base.row}>
          <button style={{ ...base.btn(), opacity: escolhidos.length && !gerando ? 1 : 0.5 }} disabled={!escolhidos.length || gerando} onClick={gerar}>
            {gerando ? "Preparando…" : `🖨️ Imprimir ${escolhidos.length || ""} código(s)${semCodigo ? ` · cria ${semCodigo} novo(s)` : ""}`}
          </button>
          <button style={base.btnOutline} onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
