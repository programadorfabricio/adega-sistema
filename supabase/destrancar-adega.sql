-- ============================================================
-- DESTRANCAR ADEGA: desfaz o supabase/trava.sql e volta ao acesso liberado
-- de antes (app sem login da loja, PIN conferido no próprio app).
--
-- Como usar (Supabase → SQL Editor):
--   1. Troque 'NOME_DA_ADEGA' abaixo pelo schema da adega.
--   2. Rode o script inteiro. Pode rodar de novo sem erro.
--   Precisa do supabase/trava.sql rodado antes ao menos uma vez (cria public.destrancar).
--   As funções novas (conferir_pin, pin_tentativas) ficam: não atrapalham.
-- ============================================================

do $$
declare
  alvo text := 'NOME_DA_ADEGA';   -- <<< SCHEMA DA ADEGA
begin
  perform public.destrancar(alvo);
end $$;

notify pgrst, 'reload schema';
