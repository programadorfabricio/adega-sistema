import { supabase } from "./constants";
import { carregarReceitas, temVolume } from "./estoque";

// ─── CUSTO E LUCRO ───────────────────────────────────────
// preco_custo é por unidade de estoque (lata, garrafa, fardo).
// Garrafa/fardo fracionado (volume_ml): custo por ml ou por lata = preco_custo / volume_ml.
// Produto com receita (copão): soma o custo dos insumos. Se faltar o custo de algum, fica sem custo.

const temCusto = (p) => p && p.preco_custo !== null && p.preco_custo !== undefined && p.preco_custo !== "" && !isNaN(Number(p.preco_custo));

// Custo de 1 unidade usada como insumo (1 ml da garrafa, 1 lata do fardo, 1 un)
const custoPorUso = (ins) => {
  if (!temCusto(ins)) return null;
  return temVolume(ins) ? Number(ins.preco_custo) / Number(ins.volume_ml) : Number(ins.preco_custo);
};

// receita: [{ insumo_id, quantidade }] · produtosPorId: { id: produto }
export function custoDoProduto(p, receita, produtosPorId) {
  if (receita?.length) {
    let total = 0;
    for (const r of receita) {
      const c = custoPorUso(produtosPorId[r.insumo_id]);
      if (c === null) return null;
      total += c * Number(r.quantidade);
    }
    return Math.round(total * 10000) / 10000;
  }
  return temCusto(p) ? Number(p.preco_custo) : null;
}

export const margem = (preco, custo) => (custo === null || !Number(preco)) ? null : (Number(preco) - custo) / Number(preco);

// Grava os itens da venda com o custo do momento. Sem a coluna (SQL não rodado), grava como antes.
export async function inserirItensVenda(vendaId, itens) {
  const linhas = (itens || []).map(i => ({
    venda_id: vendaId, produto_id: i.produto_id, nome_produto: i.nome_produto || "",
    quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
  }));
  if (!linhas.length) return;
  let comCusto = linhas;
  try {
    const ids = [...new Set(linhas.map(l => l.produto_id).filter(Boolean))];
    const receitas = await carregarReceitas(ids);
    const insumoIds = Object.values(receitas).flat().map(r => r.insumo_id);
    const { data: prods } = await supabase.from("produtos").select("*").in("id", [...new Set([...ids, ...insumoIds])]);
    const porId = Object.fromEntries((prods || []).map(p => [p.id, p]));
    if ((prods || []).some(p => "preco_custo" in p)) {
      comCusto = linhas.map(l => ({ ...l, custo_unitario: porId[l.produto_id] ? custoDoProduto(porId[l.produto_id], receitas[l.produto_id], porId) : null }));
    }
  } catch { comCusto = linhas; }
  const { error } = await supabase.from("venda_itens").insert(comCusto);
  if (error && comCusto !== linhas) await supabase.from("venda_itens").insert(linhas);
}
