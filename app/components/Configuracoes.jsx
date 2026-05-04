"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, C, base } from "./shared/constants";

export default function Configuracoes() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome: "", cargo: "atendente", pin: "" });
  const [showForm, setShowForm] = useState(false);
  const [editUsuario, setEditUsuario] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});
  const [config, setConfig] = useState({ nome_estabelecimento: "Adega", telefone: "", endereco: "" });
  const [savedConfig, setSavedConfig] = useState(false);

  const [configId, setConfigId] = useState(null);

  const loadUsuarios = useCallback(async () => {
    const { data } = await supabase.from("usuarios").select("*").order("created_at");
    setUsuarios(data || []);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const { data } = await supabase.from("configuracoes").select("*").limit(1).single();
      if (data) {
        setConfig({ nome_estabelecimento: data.nome_estabelecimento || "Adega", telefone: data.telefone || "", endereco: data.endereco || "" });
        setConfigId(data.id);
      }
    } catch (e) {}
  }, []);

  const [categorias, setCategorias] = useState([]);
  const [novaCategoria, setNovaCategoria] = useState("");

  const loadCategorias = useCallback(async () => {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    setCategorias(data || []);
  }, []);

  useEffect(() => { loadUsuarios(); loadConfig(); loadCategorias(); }, [loadUsuarios, loadConfig, loadCategorias]);

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    await supabase.from("categorias").insert({ nome: novaCategoria.trim().toLowerCase() });
    setNovaCategoria("");
    loadCategorias();
  };

  const removerCategoria = async (id) => {
    await supabase.from("categorias").delete().eq("id", id);
    loadCategorias();
  };

  const salvarUsuario = async () => {
    if (!form.nome) return;
    await supabase.from("usuarios").insert(form);
    setForm({ nome: "", cargo: "atendente", pin: "" });
    setShowForm(false); loadUsuarios();
  };

  const removerUsuario = async (id) => {
    await supabase.from("usuarios").delete().eq("id", id);
    loadUsuarios();
  };

  const salvarEdicaoUsuario = async () => {
    if (!editUsuario) return;
    await supabase.from("usuarios").update(editUserForm).eq("id", editUsuario.id);
    setEditUsuario(null); loadUsuarios();
  };

  const salvarConfig = async () => {
    if (configId) {
      await supabase.from("configuracoes").update({ ...config, updated_at: new Date().toISOString() }).eq("id", configId);
    } else {
      const { data } = await supabase.from("configuracoes").insert(config).select().single();
      if (data) setConfigId(data.id);
    }
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
  };

  const cargoCor = { admin: C.accent, gerente: C.blue, atendente: C.green };

  return (
    <div>
      <div style={base.pageTitle}>⚙️ Configurações</div>

      {/* Config estabelecimento */}
      <div style={{ ...base.card, marginBottom: 20 }}>
        <div style={base.sectionTitle}>🏪 Estabelecimento</div>
        <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={base.label}>Nome</label>
            <input style={base.input} value={config.nome_estabelecimento} onChange={e => setConfig({ ...config, nome_estabelecimento: e.target.value })} />
          </div>
          <div>
            <label style={base.label}>Telefone/WhatsApp</label>
            <input style={base.input} value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} placeholder="(19) 99999-9999" />
          </div>
          <div>
            <label style={base.label}>Endereço</label>
            <input style={base.input} value={config.endereco} onChange={e => setConfig({ ...config, endereco: e.target.value })} placeholder="Rua, número, bairro..." />
          </div>
        </div>
        <div style={base.row}>
          <button style={base.btn()} onClick={salvarConfig}>Salvar</button>
          {savedConfig && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✅ Salvo!</span>}
        </div>
      </div>

      {/* Usuários */}
      <div style={base.card}>
        <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={base.sectionTitle}>👥 Usuários</div>
          <button style={base.btn()} onClick={() => setShowForm(!showForm)}>+ Novo Usuário</button>
        </div>

        {showForm && (
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={base.label}>Nome *</label>
                <input style={base.input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus />
              </div>
              <div>
                <label style={base.label}>Cargo</label>
                <select style={base.select} value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                  <option value="admin">👑 Admin</option>
                  <option value="gerente">🔑 Gerente</option>
                  <option value="atendente">👤 Atendente</option>
                </select>
              </div>
              <div>
                <label style={base.label}>PIN</label>
                <input style={base.input} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="Ex: 1234" maxLength={6} />
              </div>
            </div>
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={salvarUsuario}>Salvar</button>
              <button style={base.btnOutline} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <style>{`
          @media (max-width: 768px) { .config-table { display: none !important; } .config-cards { display: flex !important; } }
          @media (min-width: 769px) { .config-cards { display: none !important; } }
        `}</style>

        {/* Cards mobile */}
        <div className="config-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
          {usuarios.map(u => (
            <div key={u.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{u.nome}</div>
                  <span style={base.tag(cargoCor[u.cargo] || C.muted)}>{u.cargo}</span>
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>{u.pin ? "••••" : "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={base.btnSm(C.blue, "#fff")} onClick={() => { setEditUsuario(u); setEditUserForm({ nome: u.nome, cargo: u.cargo, pin: u.pin || "" }); }}>✏️ Editar</button>
                <button style={base.btnSm(C.red, "#fff")} onClick={() => removerUsuario(u.id)}>Remover</button>
              </div>
            </div>
          ))}
          {usuarios.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 32, fontSize: 13 }}>Nenhum usuário cadastrado</div>}
        </div>

        {/* Tabela desktop */}
        <table className="config-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Nome</th>
              <th style={base.th}>Cargo</th>
              <th style={base.th}>PIN</th>
              <th style={base.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td style={base.td}>{u.nome}</td>
                <td style={base.td}><span style={base.tag(cargoCor[u.cargo] || C.muted)}>{u.cargo}</span></td>
                <td style={base.td}>{u.pin ? "••••" : "—"}</td>
                <td style={base.td}>
                  <div style={base.row}>
                    <button style={base.btnSm(C.blue, "#fff")} onClick={() => { setEditUsuario(u); setEditUserForm({ nome: u.nome, cargo: u.cargo, pin: u.pin || "" }); }}>✏️ Editar</button>
                    <button style={base.btnSm(C.red, "#fff")} onClick={() => removerUsuario(u.id)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={4} style={{ ...base.td, color: C.muted, textAlign: "center" }}>Nenhum usuário cadastrado</td></tr>}
          </tbody>
        </table>

        {editUsuario && (
          <div style={base.modal}>
            <div style={base.modalBox}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 20 }}>✏️ Editar Usuário</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={base.label}>Nome</label>
                  <input style={base.input} value={editUserForm.nome} onChange={e => setEditUserForm({ ...editUserForm, nome: e.target.value })} />
                </div>
                <div>
                  <label style={base.label}>Cargo</label>
                  <select style={base.select} value={editUserForm.cargo} onChange={e => setEditUserForm({ ...editUserForm, cargo: e.target.value })}>
                    <option value="admin">👑 Admin</option>
                    <option value="gerente">🔑 Gerente</option>
                    <option value="atendente">👤 Atendente</option>
                  </select>
                </div>
                <div>
                  <label style={base.label}>Novo PIN</label>
                  <input style={base.input} value={editUserForm.pin} onChange={e => setEditUserForm({ ...editUserForm, pin: e.target.value })} placeholder="Digite o novo PIN" maxLength={6} />
                </div>
              </div>
              <div style={base.row}>
                <button style={base.btn(C.green, "#fff")} onClick={salvarEdicaoUsuario}>Salvar</button>
                <button style={base.btnOutline} onClick={() => setEditUsuario(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Categorias */}
      <div style={{ ...base.card, marginTop: 20 }}>
        <div style={{ ...base.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={base.sectionTitle}>🏷️ Categorias de Produto</div>
        </div>
        <div style={{ ...base.row, marginBottom: 16 }}>
          <input style={{ ...base.input, flex: 1 }} value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Ex: drinks, tabacaria, gelo..." onKeyDown={e => e.key === "Enter" && adicionarCategoria()} />
          <button style={base.btn()} onClick={adicionarCategoria}>+ Adicionar</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categorias.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px" }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{c.nome}</span>
              <button onClick={() => removerCategoria(c.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
          ))}
          {categorias.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma categoria cadastrada</div>}
        </div>
      </div>
    </div>
  );
}