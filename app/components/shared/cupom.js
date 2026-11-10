// Comprovante da venda (não fiscal) para impressora térmica de 58/80 mm.
// Imprime por um iframe escondido: funciona no app instalado e não é barrado como pop-up.
import { supabase, MARCA } from "./constants";
import { NOME_FORMA } from "./pagamento";

const brl = (v) => "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let lojaCache = null;
async function dadosLoja() {
  if (lojaCache) return lojaCache;
  const { data } = await supabase.from("configuracoes").select("nome_estabelecimento, telefone, endereco").limit(1);
  lojaCache = data?.[0] || {};
  return lojaCache;
}

export function htmlCupom({ loja = {}, numero, itens, subtotal, desconto = 0, total, pagamentos = [], data = new Date() }) {
  const nome = loja.nome_estabelecimento || MARCA.nome;
  const quando = data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante</title><style>
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; padding: 4mm 3mm; color: #000; }
    .c { text-align: center; } .b { font-weight: bold; }
    .l { border-top: 1px dashed #000; margin: 5px 0; }
    .r { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
    .t { font-size: 15px; font-weight: bold; }
    .s { font-size: 10px; }
  </style></head><body>
    <div class="c b" style="font-size:15px">${esc(nome)}</div>
    ${loja.endereco ? `<div class="c s">${esc(loja.endereco)}</div>` : ""}
    ${loja.telefone ? `<div class="c s">${esc(loja.telefone)}</div>` : ""}
    <div class="l"></div>
    <div class="r"><span>${numero ? `Venda nº ${esc(numero)}` : "Venda"}</span><span>${quando}</span></div>
    <div class="l"></div>
    ${itens.map((i) => `
      <div>${esc(i.nome_produto)}</div>
      <div class="r"><span>${i.quantidade} x ${brl(i.preco_unitario)}</span><span class="b">${brl(i.subtotal)}</span></div>`).join("")}
    <div class="l"></div>
    ${desconto > 0 ? `<div class="r"><span>Subtotal</span><span>${brl(subtotal)}</span></div><div class="r"><span>Desconto</span><span>- ${brl(desconto)}</span></div>` : ""}
    <div class="r t"><span>TOTAL</span><span>${brl(total)}</span></div>
    ${pagamentos.map((p) => `<div class="r"><span>${esc(NOME_FORMA[p.forma] || p.forma)}</span><span>${brl(p.valor)}</span></div>`).join("")}
    <div class="l"></div>
    <div class="c s">Obrigado pela preferência!</div>
    <div class="c s">Não é documento fiscal</div>
  </body></html>`;
}

export async function imprimirCupom(venda) {
  const loja = await dadosLoja().catch(() => ({}));
  const html = htmlCupom({ ...venda, loja });
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}
