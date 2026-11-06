// Carrinho da página de pedido online (funções puras, testadas em scripts/carrinho.test.mjs)
const MAX_QTD = 99;
const CHAVE = "pedido-cliente-v1";

export function adicionar(carrinho, produto) {
  const existe = carrinho.find(i => i.produto_id === produto.id);
  if (existe) return alterarQtd(carrinho, produto.id, existe.quantidade + 1);
  return [...carrinho, { produto_id: produto.id, nome: produto.nome, preco: Number(produto.preco), quantidade: 1 }];
}

export function alterarQtd(carrinho, produtoId, qtd) {
  const q = Math.min(MAX_QTD, Math.floor(Number(qtd) || 0));
  if (q <= 0) return carrinho.filter(i => i.produto_id !== produtoId);
  return carrinho.map(i => (i.produto_id === produtoId ? { ...i, quantidade: q } : i));
}

export function totais(carrinho, taxa = 0) {
  const subtotal = Math.round(carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
  return {
    subtotal,
    total: Math.round((subtotal + Number(taxa || 0)) * 100) / 100,
    itens: carrinho.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
  };
}

// Dados do cliente pro próximo pedido. Em aba anônima/bloqueada, só não lembra.
export function lerCliente() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch { return {}; }
}

export function salvarCliente(dados) {
  try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch { /* sem armazenamento */ }
}
