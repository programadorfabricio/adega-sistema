import { createClient } from "@supabase/supabase-js";

// Consulta simples diária (Vercel Cron) para o Supabase não pausar o projeto por inatividade.
export const dynamic = "force-dynamic";

export async function GET() {
  // public.ping() (supabase/trava.sql): funciona com a adega trancada e não lê tabela de cliente
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error } = await supabase.rpc("ping");
  return Response.json(
    { ok: !error, erro: error?.message ?? null, at: new Date().toISOString() },
    { status: error ? 500 : 200 }
  );
}
