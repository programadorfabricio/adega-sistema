"use client";
import { useState } from "react";
import { supabase, C, base, MARCA, ESCALA, SCHEMA } from "./constants";
import LogoMarca from "./LogoMarca";

// A conta da loja (Supabase Auth) é desta adega? O schema vem do app_metadata,
// que só o dono do projeto consegue mudar (o usuário não edita).
export const contaDestaAdega = (session) => session?.user?.app_metadata?.schema === SCHEMA;

// Sai só neste aparelho: os outros caixas da loja continuam logados
export const sairDaContaDaLoja = () => supabase.auth.signOut({ scope: "local" });

// ─── TELA DA CONTA DA LOJA (antes do PIN) ─────────────────
export default function ContaLoja({ aviso = "" }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(aviso);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !senha || entrando) return;
    setEntrando(true); setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error || !data?.session) {
      setErro(error?.status === 400 || error?.code === "invalid_credentials"
        ? "E-mail ou senha incorretos."
        : "Não foi possível entrar. Verifique a internet e tente de novo.");
      setEntrando(false);
      return;
    }
    if (!contaDestaAdega(data.session)) {
      await sairDaContaDaLoja();
      setErro("Essa conta não é desta adega");
      setSenha("");
      setEntrando(false);
      return;
    }
    // Conta certa: a tela do PIN aparece pelo onAuthStateChange do App
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400, zoom: ESCALA }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <LogoMarca size={96} emojiSize={52} marginBottom={8} />
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>{MARCA.nome}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Sistema de Gestão</div>
        </div>

        <form onSubmit={entrar} style={{ ...base.card, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, textAlign: "center" }}>🔐 Entrar com a conta da loja</div>
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: -6 }}>Só uma vez neste aparelho. Depois, cada pessoa entra com o PIN.</div>
          <div>
            <label htmlFor="conta-email" style={base.label}>E-mail</label>
            <input id="conta-email" type="email" autoComplete="username" style={base.input} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="conta-senha" style={base.label}>Senha</label>
            <input id="conta-senha" type="password" autoComplete="current-password" style={base.input} value={senha} onChange={e => setSenha(e.target.value)} />
          </div>
          {erro && <div style={{ ...base.alert(C.red), justifyContent: "center", marginBottom: 0 }}>{erro}</div>}
          <button type="submit" disabled={entrando || !email.trim() || !senha} style={{ ...base.btn(), width: "100%", padding: "13px", fontSize: 15, opacity: entrando || !email.trim() || !senha ? 0.6 : 1 }}>
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
