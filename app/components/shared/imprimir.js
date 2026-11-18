// Imprime um HTML pronto por um iframe escondido.
// - O iframe tem tamanho de verdade (fora da tela): iframe 0x0 faz a prévia do Chrome falhar em alguns PCs.
// - Espera o conteúdo (e as imagens) carregar antes de chamar print().
// - Só remove o iframe depois que a impressão termina (afterprint), não por tempo:
//   em PC lento a prévia demora e, se o iframe some antes, aparece "A visualização de impressão falhou".
export function imprimirHtml(html) {
  document.querySelectorAll("iframe[data-impressao]").forEach((f) => f.remove());   // sobra de impressão anterior
  const frame = document.createElement("iframe");
  frame.setAttribute("data-impressao", "1");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  let impresso = false;
  const remover = () => { try { frame.remove(); } catch {} };
  const imprimir = () => {
    if (impresso) return;
    impresso = true;
    const w = frame.contentWindow;
    if (!w) return;
    w.addEventListener("afterprint", () => setTimeout(remover, 500));
    setTimeout(remover, 5 * 60 * 1000);                     // garantia: some depois de 5 min
    w.focus();
    w.print();
  };

  frame.onload = () => {
    const d = frame.contentWindow?.document;
    const imgs = d ? Array.from(d.images) : [];
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))))
      .then(() => setTimeout(imprimir, 200));
  };
  frame.srcdoc = html;
  setTimeout(imprimir, 4000);                               // se o onload não vier
}

// Abre o mesmo HTML numa aba nova (plano B: imprimir pela aba com Ctrl+P).
// Tem que ser chamado direto do clique, senão o navegador bloqueia a aba.
export function abrirHtmlEmAba(html) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const aba = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return !!aba;
}
