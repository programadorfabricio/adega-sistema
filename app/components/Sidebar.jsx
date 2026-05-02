"use client";
import { C, base, PAGES } from "./shared/constants";

export default function Sidebar({ page, setPage, open, setOpen, usuario, onLogout }) {
  const pages = PAGES.filter(p => p.cargos.includes(usuario?.cargo));
  const groups = [...new Set(pages.map(p => p.group))];
  const navigate = (id) => { setPage(id); setOpen(false); };
  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  return (
    <>
      <style>{`
        .sidebar { width: 260px; position: relative; left: 0; }
        .topbar { display: none; }
        .overlay { display: none; }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; height: 100vh;
            transform: translateX(${open ? "0" : "-100%"});
            transition: transform 0.28s ease;
            z-index: 50; width: 260px !important;
          }
          .overlay { display: ${open ? "block" : "none"}; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 40; }
          .topbar { display: flex !important; }
          .main-content { padding: 12px !important; padding-top: 68px !important; }
          .grid-2col, .grid-3col, .grid-4col, .grid-5col { grid-template-columns: 1fr !important; }
          .grid-auto { grid-template-columns: 1fr 1fr !important; }
          table { display: block !important; overflow-x: auto !important; }
        }
      `}</style>

      <div className="overlay" onClick={() => setOpen(false)} />

      <div className="sidebar" style={{
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0, minHeight: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 2 }}>🍺</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.accent }}>Império Bebidas</div>
            <div style={{ fontSize: 11, color: C.muted }}>Sistema de Gestão</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Usuário logado */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cargoCor[usuario?.cargo] || C.muted}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {usuario?.cargo === "admin" ? "👑" : usuario?.cargo === "gerente" ? "🔑" : "👤"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario?.nome}</div>
            <span style={base.tag(cargoCor[usuario?.cargo] || C.muted)}>{usuario?.cargo}</span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.15em", padding: "16px 24px 6px", textTransform: "uppercase" }}>{group}</div>
              {pages.filter(p => p.group === group).map(p => {
                const active = page === p.id;
                return (
                  <button key={p.id} onClick={() => navigate(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", padding: "12px 24px",
                    background: active ? C.accentBg : "transparent",
                    borderLeft: `3px solid ${active ? C.accent : "transparent"}`,
                    border: "none", borderLeftWidth: 3, borderLeftStyle: "solid",
                    borderLeftColor: active ? C.accent : "transparent",
                    color: active ? C.accent : C.muted,
                    fontSize: 14, fontWeight: active ? 700 : 400,
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 17 }}>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Logout */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={onLogout} style={{ ...base.btnOutline, width: "100%", fontSize: 13, color: C.red, borderColor: `${C.red}40` }}>
            🚪 Sair
          </button>
        </div>
      </div>
    </>
  );
}