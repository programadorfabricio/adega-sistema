// Lê o cardápio público: { loja: {nome, telefone, aberto}, bairros: [{nome, taxa}], produtos: [...] }.
// Normal: <adega>.cardapio_online() (supabase/pedido-online.sql), que funciona com a adega trancada.
// Se a função ainda não existe nessa adega (app novo publicado antes de rodar o pedido-online.sql de novo),
// cai nos selects antigos (adega ainda aberta) e monta o mesmo formato, sem custo nem dados internos.

const COLUNAS_PRODUTO = "id, nome, categoria, preco, controla_estoque, estoque_atual";

// PGRST202 = o PostgREST não achou a função; 42883 = o Postgres não achou (cache desatualizado)
export const semFuncao = (e) => !!e && (e.code === "PGRST202" || e.code === "42883");

export async function lerCardapio(supabase) {
  const { data, error } = await supabase.rpc("cardapio_online");
  if (!error) return data ? { data, error: null } : { data: null, error: { message: "cardápio vazio" } };
  if (!semFuncao(error)) return { data: null, error };

  const [pr, ba, cf] = await Promise.all([
    supabase.from("produtos").select(COLUNAS_PRODUTO).eq("ativo", true).order("categoria").order("nome"),
    supabase.from("bairros").select("nome, taxa").order("nome"),
    supabase.from("configuracoes").select("*").limit(1).maybeSingle(),
  ]);
  const erro = pr.error || ba.error || cf.error;
  if (erro) return { data: null, error: erro };
  const c = cf.data || {};
  return {
    data: {
      loja: { nome: c.nome_estabelecimento ?? null, telefone: c.telefone ?? null, aberto: c.pedido_online_aberto !== false },
      bairros: (ba.data || []).map(b => ({ nome: b.nome, taxa: b.taxa })),
      produtos: (pr.data || []).map(p => ({
        id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco,
        controla_estoque: p.controla_estoque, estoque_atual: p.estoque_atual,
      })),
    },
    error: null,
  };
}
