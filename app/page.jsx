"use client";
import { useState, useEffect } from "react";
import { supabase, C, base, PAGES } from "./components/shared/constants";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import VendaRapida from "./components/VendaRapida";
import Estoque from "./components/Estoque";
import Financeiro from "./components/Financeiro";
import Historico from "./components/Historico";
import Relatorios from "./components/Relatorios";
import Configuracoes from "./components/Configuracoes";
import Comandas from "./components/Comandas";

// ─── TELA DE LOGIN ───────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("usuarios").select("*").eq("ativo", true).order("nome")
      .then(({ data }) => { setUsuarios(data || []); setLoading(false); });
  }, []);

  const digitarPin = (num) => {
    if (pin.length >= 4) return;
    const novo = pin + num;
    setPin(novo);
    setErro("");
    if (novo.length === 4) verificarPin(novo);
  };

  const verificarPin = (p) => {
    if (!selecionado) return;
    if (selecionado.pin === p) {
      onLogin(selecionado);
    } else {
      setErro("PIN incorreto. Tente novamente.");
      setTimeout(() => setPin(""), 600);
    }
  };

  const voltar = () => { setSelecionado(null); setPin(""); setErro(""); };
  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ color: C.muted }}>Carregando...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🍺</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>Império Bebidas</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Sistema de Gestão</div>
        </div>

        {!selecionado ? (
          <div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 20 }}>Quem está acessando?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {usuarios.map(u => (
                <button key={u.id} onClick={() => setSelecionado(u)} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${cargoCor[u.cargo] || C.muted}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {u.cargo === "admin" ? "👑" : u.cargo === "gerente" ? "🔑" : "👤"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{u.nome}</div>
                    <span style={base.tag(cargoCor[u.cargo] || C.muted)}>{u.cargo}</span>
                  </div>
                  <div style={{ marginLeft: "auto", color: C.muted, fontSize: 18 }}>›</div>
                </button>
              ))}
              {usuarios.length === 0 && (
                <div style={{ ...base.card, textAlign: "center", color: C.muted, padding: 32 }}>
                  Nenhum usuário cadastrado.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <button onClick={voltar} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
              ← Trocar usuário
            </button>
            <div style={{ ...base.card, textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{selecionado.cargo === "admin" ? "👑" : selecionado.cargo === "gerente" ? "🔑" : "👤"}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{selecionado.nome}</div>
              <div style={{ marginTop: 4 }}><span style={base.tag(cargoCor[selecionado.cargo] || C.muted)}>{selecionado.cargo}</span></div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 16 }}>Digite seu PIN</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 28 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: i < pin.length ? C.accent : "transparent", border: `2px solid ${i < pin.length ? C.accent : C.border}`, transition: "all 0.15s" }} />
              ))}
            </div>
            {erro && <div style={{ ...base.alert(C.red), justifyContent: "center", marginBottom: 16 }}>{erro}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => digitarPin(String(n))} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", fontSize: 22, fontWeight: 700, color: C.text, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>
                  {n}
                </button>
              ))}
              <div />
              <button onClick={() => digitarPin("0")} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", fontSize: 22, fontWeight: 700, color: C.text, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>0</button>
              <button onClick={() => setPin(p => p.slice(0,-1))} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", fontSize: 18, color: C.muted, cursor: "pointer" }}>⌫</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogin = (user) => {
    setUsuario(user);
    const primeira = PAGES.find(p => p.cargos.includes(user.cargo));
    setPage(primeira?.id || "dashboard");
  };

  const handleLogout = () => { setUsuario(null); setPage("dashboard"); };
  const pageLabel = PAGES.find(p => p.id === page);

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard setPage={setPage} />;
      case "comandas": return <Comandas usuario={usuario} />;
      case "venda": return <VendaRapida />;
      case "estoque": return <Estoque />;
      case "financeiro": return <Financeiro />;
      case "historico": return <Historico />;
      case "relatorios": return <Relatorios />;
      case "configuracoes": return <Configuracoes />;
      default: return <Dashboard setPage={setPage} />;
    }
  };

  if (!usuario) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ display: "flex", background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @media (max-width: 768px) {
          .grid-2col, .grid-3col, .grid-4col, .grid-5col { grid-template-columns: 1fr !important; }
          .grid-auto { grid-template-columns: 1fr 1fr !important; }
          table { display: block !important; overflow-x: auto !important; white-space: nowrap !important; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <Sidebar page={page} setPage={setPage} open={sidebarOpen} setOpen={setSidebarOpen} usuario={usuario} onLogout={handleLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar mobile */}
        <div className="topbar" style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 56,
          background: C.card, borderBottom: `1px solid ${C.border}`,
          alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", zIndex: 30, display: "none",
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 24, cursor: "pointer" }}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{pageLabel?.icon}</span>
            <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{pageLabel?.label}</span>
          </div>
          <span style={{ fontSize: 20 }}>🍺</span>
        </div>

        <div className="main-content" style={{ flex: 1, padding: 28, overflowY: "auto" }}>
          <style>{`
            @keyframes fadeSlide {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .page-anim { animation: fadeSlide 0.22s ease; }
          `}</style>
          <div key={page} className="page-anim">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}