import { createClient } from "@supabase/supabase-js";

// Consulta simples diária (Vercel Cron) para o Supabase não pausar o projeto por inatividade.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public" } }
  );
  const { error } = await supabase.from("usuarios").select("id").limit(1);
  return Response.json(
    { ok: !error, erro: error?.message ?? null, at: new Date().toISOString() },
    { status: error ? 500 : 200 }
  );
}
