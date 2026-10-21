import { supabase, semEstoque } from "./constants";

// ─── BAIXA DE ESTOQUE (com dose fracionada) ───────────────
// Produto com receita (ex.: Copão Red Label = 100 ml de Red Label + 1 Red Bull):
//   a venda desconta os insumos da receita, não o próprio copão.
// Insumo com volume (ex.: garrafa de 1000 ml): desconta em ml.
//   estoque_atual = garrafas, contando a aberta; ml_aberto = o que resta na aberta.
//   Quando a aberta acaba, estoque_atual baixa 1.
// Sem receita: funciona como sempre (desconta a quantidade do próprio produto).
//
// itens: [{ produto_id, quantidade }]   sinal: -1 vende, +1 devolve (cancelamento)

export const temVolume = (p) => Number(p?.volume_ml) > 0;

// ml totais de uma garrafa controlada por volume
export const totalMl = (p) => {
  const vol = Number(p.volume_ml);
  const est = Number(p.estoque_atual) || 0;
  const aberto = Number(p.ml_aberto) || 0;
  if (est <= 0) return 0;
  return aberto > 0 ? (est - 1) * vol + aberto : est * vol;
};

// ml totais -> { estoque_atual, ml_aberto }
export const deMl = (ml, vol) => {
  const total = Math.max(0, Math.round(ml * 100) / 100);
  if (total === 0) return { estoque_atual: 0, ml_aberto: 0 };
  const garrafas = Math.ceil(total / vol - 1e-9);
  const resto = Math.round((total - (garrafas - 1) * vol) * 100) / 100;
  return { estoque_atual: garrafas, ml_aberto: resto >= vol ? 0 : resto };
};

// "5 garrafas · aberta com 400 ml"
export const textoGarrafa = (p) => {
  const aberto = Number(p.ml_aberto) || 0;
  return aberto > 0 ? `aberta: ${aberto.toLocaleString("pt-BR")} ml` : "";
};

export async function carregarReceitas(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("produto_insumos").select("produto_id, insumo_id, quantidade").in("produto_id", ids);
  if (error) return {};                     // tabela ainda não criada: segue sem receitas
  const r = {};
  (data || []).forEach(x => { (r[x.produto_id] ||= []).push(x); });
  return r;
}

export async function movimentarEstoque(itens, sinal = -1, motivo = "") {
  const lista = (itens || []).filter(i => i?.produto_id && Number(i.quantidade) > 0);
  if (!lista.length) return;
  const receitas = await carregarReceitas([...new Set(lista.map(i => i.produto_id))]);

  // Soma o que mexer em cada produto: un = vendido direto, receita = usado como insumo
  const mov = {};
  const somar = (id, campo, q) => { mov[id] ||= { un: 0, receita: 0 }; mov[id][campo] += q; };
  const insumoIds = new Set();
  for (const item of lista) {
    const rec = receitas[item.produto_id];
    if (rec?.length) rec.forEach(x => { insumoIds.add(x.insumo_id); somar(x.insumo_id, "receita", Number(x.quantidade) * Number(item.quantidade)); });
    else somar(item.produto_id, "un", Number(item.quantidade));
  }

  const ids = Object.keys(mov);
  const { data: prods } = await supabase.from("produtos").select("*").in("id", ids);
  for (const p of prods || []) {
    const m = mov[p.id];
    if (!m) continue;
    let novo = null;
    const receita = m.receita;
    if (temVolume(p)) {
      // receita em ml; venda direta da garrafa conta garrafa inteira
      const ml = receita + m.un * Number(p.volume_ml);
      novo = deMl(totalMl(p) + sinal * ml, Number(p.volume_ml));
    } else {
      if (semEstoque(p)) continue;                            // copão sem receita: não controla
      const un = m.un + receita;
      novo = { estoque_atual: Math.max(0, (Number(p.estoque_atual) || 0) + sinal * un) };
    }
    if (novo.estoque_atual === p.estoque_atual && (novo.ml_aberto ?? p.ml_aberto) === p.ml_aberto) continue;
    await supabase.from("produtos").update(novo).eq("id", p.id);
    const diff = Math.abs((novo.estoque_atual ?? 0) - (Number(p.estoque_atual) || 0));
    if (motivo && diff > 0) {
      await supabase.from("estoque_movimentacoes").insert({ produto_id: p.id, tipo: sinal < 0 ? "saida" : "entrada", quantidade: diff, motivo: insumoIds.has(p.id) ? `${motivo} (dose)` : motivo });
    }
  }
}
