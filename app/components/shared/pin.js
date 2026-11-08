import { supabase, LOGIN_LOJA, hora } from "./constants";

// Confere o PIN de um usuário.
//   - com LOGIN_LOJA: no banco (<adega>.conferir_pin) — o PIN nunca sai do banco e
//     5 erros em 5 min bloqueiam o usuário por 5 min;
//   - sem LOGIN_LOJA (adega ainda não migrada): como antes, compara no navegador,
//     buscando o pin só deste usuário e só agora.
// Devolve { ok, usuario?, restantes?, bloqueado_ate?, falhou? }
export async function conferirPin(usuarioId, pin) {
  if (LOGIN_LOJA) {
    const { data, error } = await supabase.rpc("conferir_pin", { p_usuario: usuarioId, p_pin: pin });
    if (error || !data || typeof data !== "object") return { ok: false, falhou: true };
    return data;
  }
  const { data, error } = await supabase.from("usuarios").select("id, nome, cargo, pin").eq("id", usuarioId).single();
  if (error || !data) return { ok: false, falhou: !!error && error.code !== "PGRST116" };
  if (data.pin !== pin) return { ok: false };
  return { ok: true, usuario: { id: data.id, nome: data.nome, cargo: data.cargo } };
}

// Texto do erro pra mostrar na tela
export function mensagemPin(r) {
  if (r?.bloqueado_ate) return `Bloqueado até ${hora(r.bloqueado_ate)}. Muitas tentativas erradas.`;
  if (r?.falhou) return "Não foi possível conferir o PIN. Verifique a internet e tente de novo.";
  if (typeof r?.restantes === "number") return `PIN incorreto (restam ${r.restantes})`;
  return "PIN incorreto. Tente novamente.";
}
