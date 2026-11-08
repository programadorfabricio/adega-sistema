import { createClient } from "@supabase/supabase-js";

// Consulta simples diária (Vercel Cron) para o Supabase não pausar o projeto por inatividade.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // public.ping() (supabase/trava.sql): funciona com a adega trancada e não lê tabela de cliente
  const { error: erroPing } = await createClient(url, key).rpc("ping");
  if (!erroPing) return resposta(null);

  // trava.sql ainda não rodou neste projeto (sem ping): consulta antiga, adega ainda aberta
  const adega = createClient(url, key, { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public" } });
  const { error: erroTabela } = await adega.from("usuarios").select("id").limit(1);
  return resposta(erroTabela ? `ping: ${erroPing.message} | usuarios: ${erroTabela.message}` : null);
}

function resposta(erro) {
  return Response.json({ ok: !erro, erro, at: new Date().toISOString() }, { status: erro ? 500 : 200 });
}
