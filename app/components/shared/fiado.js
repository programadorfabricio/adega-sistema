// Fiado = comanda com fiado=true e status "aberta" (aparece na aba Fiado das Comandas).
import { supabase } from "./constants";

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;

export async function listarFiados() {
  const { data } = await supabase.from("comandas").select("id, nome_cliente, telefone, total, valor_pago")
    .eq("status", "aberta").eq("fiado", true).order("nome_cliente");
  return data || [];
}

async function recalcularTotal(comandaId) {
  const { data } = await supabase.from("comanda_itens").select("subtotal").eq("comanda_id", comandaId);
  const total = r2((data || []).reduce((a, i) => a + Number(i.subtotal || 0), 0));
  await supabase.from("comandas").update({ total }).eq("id", comandaId);
  return total;
}

// Fiado existente (destino.id) ou novo ({ nome, telefone }). Devolve o id do fiado.
export async function garantirFiado(destino, atendente) {
  if (destino.id) return destino.id;
  const { data, error } = await supabase.from("comandas").insert({
    nome_cliente: destino.nome.trim(), telefone: destino.telefone?.trim() || null, fiado: true, mesa: null,
    status: "aberta", total: 0, atendente_nome: atendente || "—",
  }).select("id").single();
  if (error) throw new Error("O fiado ainda não foi ativado neste sistema. Fale com o suporte.");
  return data.id;
}

// Itens da Venda Rápida (carrinho) entram no fiado. O estoque quem baixa é quem chama.
export async function lancarItensNoFiado(fiadoId, itens) {
  const linhas = itens.map(i => ({ comanda_id: fiadoId, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: r2(i.subtotal) }));
  const { error } = await supabase.from("comanda_itens").insert(linhas);
  if (error) throw new Error("Não foi possível lançar no fiado: " + error.message);
  return recalcularTotal(fiadoId);
}

// Comanda aberta inteira vai pra dentro de um fiado que já existe (o estoque já tinha baixado).
export async function juntarComandaNoFiado(comandaId, fiadoId) {
  const { error } = await supabase.from("comanda_itens").update({ comanda_id: fiadoId }).eq("comanda_id", comandaId);
  if (error) throw new Error("Não foi possível transferir os itens: " + error.message);
  await recalcularTotal(fiadoId);
  await supabase.from("comandas").delete().eq("id", comandaId);
}
