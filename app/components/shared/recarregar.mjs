// Recarrega os dados de uma tela sozinho: a cada X segundos (só com a aba visível)
// e quando a pessoa volta pra aba/janela. Complementa o tempo real do Supabase,
// que pode cair com internet ruim.
import { useEffect, useRef } from "react";

const INTERVALO_MINIMO_MS = 2000; // foco + visibilidade disparam juntos: roda uma vez só

export function escutarRecarga(fn, { segundos = 30, doc = globalThis.document, win = globalThis.window } = {}) {
  let ultima = 0;
  const visivel = () => !doc || doc.visibilityState !== "hidden";
  const rodar = (forcar) => {
    if (!visivel()) return;
    const agora = Date.now();
    if (!forcar && agora - ultima < INTERVALO_MINIMO_MS) return;
    ultima = agora;
    fn();
  };
  const t = setInterval(() => rodar(true), segundos * 1000);
  const aoVoltar = () => rodar(false);
  doc?.addEventListener("visibilitychange", aoVoltar);
  win?.addEventListener("focus", aoVoltar);
  return () => {
    clearInterval(t);
    doc?.removeEventListener("visibilitychange", aoVoltar);
    win?.removeEventListener("focus", aoVoltar);
  };
}

// Uso nas telas: useRecarregar(load) — sempre chama a versão mais nova de `load`
export function useRecarregar(fn, segundos = 30) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => escutarRecarga(() => ref.current?.(), { segundos }), [segundos]);
}
