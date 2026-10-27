"use client";
import { supabase, C, base, fmt } from "./constants";

// ─── PAGAMENTO: desconto + mais de uma forma ─────────────
// vendas.desconto   → quanto foi descontado (R$)
// vendas.pagamentos → [{ forma, valor }] quando paga em mais de uma forma
// vendas.forma_pagamento continua com a forma principal (ou "misto")

export const FORMAS_PAG = [
  { value: "pix", label: "PIX", cor: C.blue },
  { value: "dinheiro", label: "Dinheiro", cor: C.green },
  { value: "cartao_debito", label: "Débito", cor: "#a855f7" },
  { value: "cartao_credito", label: "Crédito", cor: "#f97316" },
];
export const NOME_FORMA = { pix: "PIX", dinheiro: "Dinheiro", cartao_debito: "Débito", cartao_credito: "Crédito", misto: "Misto" };

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
export const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Quanto entrou em cada forma numa venda (vendas antigas só têm forma_pagamento)
export function partesDaVenda(v) {
  if (Array.isArray(v?.pagamentos) && v.pagamentos.length) return v.pagamentos.map(p => ({ forma: p.forma, valor: Number(p.valor) }));
  return [{ forma: v?.forma_pagamento, valor: Number(v?.total || 0) }];
}

export function rotuloPagamento(v) {
  const partes = partesDaVenda(v);
  if (partes.length > 1) return partes.map(p => `${NOME_FORMA[p.forma] || p.forma} ${fmt(p.valor)}`).join(" + ");
  return NOME_FORMA[partes[0].forma] || partes[0].forma || "—";
}

// Junta formas repetidas e tira linhas zeradas
export function juntarPagamentos(lista) {
  const soma = {};
  for (const p of lista) { const v = r2(num(p.valor)); if (v > 0) soma[p.forma] = r2((soma[p.forma] || 0) + v); }
  return Object.entries(soma).map(([forma, valor]) => ({ forma, valor }));
}

// Desconto em R$ a partir do que foi digitado (R$ ou %)
export function calcDesconto(subtotal, tipo, valor) {
  const v = num(valor);
  if (v <= 0) return 0;
  const d = tipo === "%" ? subtotal * Math.min(v, 100) / 100 : v;
  return r2(Math.min(d, subtotal));
}

// Grava a venda. Se a adega ainda não rodou o desconto-pagamento.sql,
// grava do jeito antigo (forma principal) pra venda nunca se perder.
export async function inserirVenda({ total, desconto = 0, pagamentos }) {
  const partes = juntarPagamentos(pagamentos);
  const principal = partes.slice().sort((a, b) => b.valor - a.valor)[0]?.forma || "pix";
  const forma = partes.length > 1 ? "misto" : principal;
  const completo = { total: r2(total), forma_pagamento: forma, status: "concluida", desconto: r2(desconto), pagamentos: partes.length > 1 ? partes : null };
  let { data, error } = await supabase.from("vendas").insert(completo).select().single();
  if (error) {
    ({ data } = await supabase.from("vendas").insert({ total: r2(total), forma_pagamento: principal, status: "concluida" }).select().single());
  }
  return { venda: data, forma: data?.forma_pagamento || forma };
}

// ─── CAMPO DE DESCONTO ───────────────────────────────────
export function CampoDesconto({ tipo, setTipo, valor, setValor }) {
  return (
    <div>
      <label style={base.label}>Desconto</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...base.input, flex: 1 }} type="number" inputMode="decimal" min="0" placeholder="0" value={valor} onChange={e => setValor(e.target.value)} />
        {["R$", "%"].map(t => (
          <button key={t} type="button" onClick={() => setTipo(t)} style={{
            padding: "0 14px", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 13,
            border: `2px solid ${tipo === t ? C.accent : C.border}`,
            background: tipo === t ? C.accentBg : C.card2, color: tipo === t ? C.accent : C.muted,
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

// ─── DUAS (OU MAIS) FORMAS ───────────────────────────────
// linhas: [{ forma, valor }] — a última linha completa sozinha o que falta
export function PagamentoDividido({ total, linhas, setLinhas }) {
  const atualizar = (i, campo, val) => setLinhas(ls => {
    const novas = ls.map((l, idx) => idx === i ? { ...l, [campo]: val } : l);
    if (campo === "valor" && novas.length > 1 && i < novas.length - 1) {
      const outras = novas.slice(0, -1).reduce((a, l) => a + num(l.valor), 0);
      novas[novas.length - 1] = { ...novas[novas.length - 1], valor: String(r2(Math.max(0, total - outras))) };
    }
    return novas;
  });
  const somado = linhas.reduce((a, l) => a + num(l.valor), 0);
  const falta = r2(total - somado);

  return (
    <div>
      {linhas.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <select style={base.select} value={l.forma} onChange={e => atualizar(i, "forma", e.target.value)}>
            {FORMAS_PAG.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <input style={base.input} type="number" inputMode="decimal" placeholder="R$" value={l.valor} onChange={e => atualizar(i, "valor", e.target.value)} />
          {linhas.length > 2
            ? <button type="button" onClick={() => setLinhas(ls => ls.filter((_, idx) => idx !== i))} style={{ ...base.btnSm(C.card2, C.muted), border: `1px solid ${C.border}` }}>✕</button>
            : <span />}
        </div>
      ))}
      {linhas.length < 4 && (
        <button type="button" onClick={() => setLinhas(ls => [...ls, { forma: "pix", valor: String(Math.max(0, falta)) }])}
          style={{ background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "2px 0 8px" }}>
          + outra forma
        </button>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(falta) < 0.01 ? C.green : C.red }}>
        {Math.abs(falta) < 0.01 ? "✅ Valores batem com o total" : falta > 0 ? `⚠️ Faltam ${fmt(falta)}` : `⚠️ Passou ${fmt(-falta)} do total`}
      </div>
    </div>
  );
}

export const linhasIniciais = (total) => {
  const metade = r2(total / 2);
  return [{ forma: "dinheiro", valor: String(metade) }, { forma: "pix", valor: String(r2(total - metade)) }];
};
// Quando o total muda (item ou desconto), a última linha absorve a diferença
export const reajustarLinhas = (total, ls) => {
  if (ls.length < 2) return ls;
  const outras = ls.slice(0, -1).reduce((a, l) => a + num(l.valor), 0);
  const ultima = String(r2(Math.max(0, total - outras)));
  return ls[ls.length - 1].valor === ultima ? ls : [...ls.slice(0, -1), { ...ls[ls.length - 1], valor: ultima }];
};
export const linhasBatem = (total, linhas) => Math.abs(total - linhas.reduce((a, l) => a + num(l.valor), 0)) < 0.01;
