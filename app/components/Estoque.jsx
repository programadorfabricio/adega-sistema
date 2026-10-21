"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, C, base, fmt, SCHEMA, semEstoque, resumoNomes } from "./shared/constants";
import { temVolume, textoGarrafa, unidadeFracao } from "./shared/estoque";

// ─── LEITOR DE CÓDIGO DE BARRAS ──────────────────────────
function BarcodeScanner({ onFound, onClose }) {
  const [codigoManual, setCodigoManual] = useState("");
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const buscarPorCodigo = async (codigo) => {
    if (!codigo) return;
    const { data } = await supabase.from("produtos").select("*").eq("codigo_barras", codigo).eq("ativo", true).single();
    if (data) {
      setResultado(data);
      setErro("");
    } else {
      setResultado(null);
      setErro(`Produto não encontrado para o código: ${codigo}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") buscarPorCodigo(codigoManual);
  };

  return (
    <div style={base.modal}>
      <div style={{ ...base.modalBox, maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>📷 Leitor de Código de Barras</div>
          <button style={base.btnSm(C.card2, C.muted)} onClick={onClose}>✕</button>
        </div>

        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            Aponte o leitor de código de barras ou digite o código abaixo
          </div>
          <div style={base.row}>
            <input
              ref={inputRef}
              style={{ ...base.input, flex: 1 }}
              value={codigoManual}
              onChange={e => setCodigoManual(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Código de barras..."
            />
            <button style={base.btn()} onClick={() => buscarPorCodigo(codigoManual)}>Buscar</button>
          </div>
        </div>

        {erro && <div style={base.alert(C.red)}>{erro}</div>}

        {resultado && (
          <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.green, marginBottom: 8, fontWeight: 700 }}>✅ Produto encontrado!</div>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{resultado.nome}</div>
            <div style={{ fontSize: 13, color: C.muted }}>Estoque atual: <strong style={{ color: C.accent }}>{resultado.estoque_atual} {resultado.unidade}</strong></div>
            <div style={{ fontSize: 13, color: C.muted }}>Preço: <strong style={{ color: C.accent }}>{fmt(resultado.preco)}</strong></div>
            <div style={base.row}>
              <button style={{ ...base.btn(C.green, "#fff"), marginTop: 12 }} onClick={() => { onFound(resultado); onClose(); }}>
                + Dar Entrada no Estoque
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
          Leitor USB funciona automaticamente ao bipar o produto
        </div>
      </div>
    </div>
  );
}

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({ nome: "", categoria: "", preco: "", estoque_atual: "", estoque_minimo: "5", unidade: "un", codigo_barras: "", controla_estoque: true });
  const [showForm, setShowForm] = useState(false);
  const [entradaModal, setEntradaModal] = useState(null);
  const [qtdEntrada, setQtdEntrada] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [receita, setReceita] = useState([]);          // [{ insumo_id, quantidade }]
  const [temReceitas, setTemReceitas] = useState(true); // false se a tabela ainda não existe
  const [erroForm, setErroForm] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const load = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria");
    setProdutos(data || []);
  }, []);

  const loadCategorias = useCallback(async () => {
    const { data } = await supabase.from("categorias").select("*").order("nome");

    const unicas = data
      ? data.filter((c, i, arr) => arr.findIndex(x => x.nome === c.nome) === i)
      : [];

    setCategorias(unicas);
    if (unicas.length > 0) setForm(f => ({ ...f, categoria: f.categoria || unicas[0].nome }));
  }, []);

  useEffect(() => {
    load();
    loadCategorias();
    const channel = supabase.channel("estoque-rt")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "produtos" }, load)
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: "categorias" }, loadCategorias)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, loadCategorias]);

  const controlados = produtos.filter(p => !semEstoque(p));
  const esgotados = controlados.filter(p => p.estoque_atual === 0);
  const baixos = controlados.filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);

  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const termo = semAcento(busca.trim());
  const lista = produtos.filter(p => {
    if (termo && !semAcento(p.nome).includes(termo) && !String(p.codigo_barras || "").includes(busca.trim())) return false;
    if (filtroCat !== "todas" && p.categoria !== filtroCat) return false;
    if (filtroStatus === "esgotado") return !semEstoque(p) && p.estoque_atual === 0;
    if (filtroStatus === "baixo") return !semEstoque(p) && p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo;
    if (filtroStatus === "ok") return semEstoque(p) || p.estoque_atual > p.estoque_minimo;
    return true;
  });

  const salvar = async () => {
    if (!form.nome || !form.preco) return;
    const { data: existente } = await supabase.from("produtos").select("id").eq("nome", form.nome).eq("ativo", true).single();
    if (existente) { setErroForm(`Já existe um produto com o nome "${form.nome}".`); return; }
    setErroForm("");
    await supabase.from("produtos").insert({ ...form, preco: Number(form.preco), estoque_atual: Number(form.estoque_atual || 0), estoque_minimo: Number(form.estoque_minimo || 0) });
    setForm({ nome: "", categoria: categorias[0]?.nome || "", preco: "", estoque_atual: "", estoque_minimo: "5", unidade: "un", codigo_barras: "", controla_estoque: true });
    setShowForm(false); load();
  };

  const entradaEstoque = async () => {
    if (!qtdEntrada || !entradaModal) return;
    await supabase.from("produtos").update({ estoque_atual: entradaModal.estoque_atual + Number(qtdEntrada) }).eq("id", entradaModal.id);
    await supabase.from("estoque_movimentacoes").insert({ produto_id: entradaModal.id, tipo: "entrada", quantidade: Number(qtdEntrada), motivo: "reposição manual" });
    setEntradaModal(null); setQtdEntrada(""); load();
  };

  const abrirEdicao = async (p) => {
    setEditModal(p);
    setEditForm({ nome: p.nome, categoria: p.categoria, preco: p.preco, estoque_minimo: p.estoque_minimo, unidade: p.unidade, controla_estoque: p.controla_estoque !== false, ...("volume_ml" in p ? { volume_ml: p.volume_ml ?? "" } : {}), ...("fracao_unidade" in p ? { fracao_unidade: unidadeFracao(p) } : {}) });
    setReceita([]);
    const { data, error } = await supabase.from("produto_insumos").select("insumo_id, quantidade").eq("produto_id", p.id);
    setTemReceitas(!error);
    setReceita((data || []).map(r => ({ insumo_id: r.insumo_id, quantidade: r.quantidade })));
  };

  const salvarEdicao = async () => {
    if (!editModal) return;
    const dados = { ...editForm, preco: Number(editForm.preco), estoque_minimo: Number(editForm.estoque_minimo) };
    if ("volume_ml" in dados) dados.volume_ml = Number(dados.volume_ml) > 0 ? Number(dados.volume_ml) : null;
    await supabase.from("produtos").update(dados).eq("id", editModal.id);
    if (temReceitas) {
      await supabase.from("produto_insumos").delete().eq("produto_id", editModal.id);
      const linhas = receita.filter(r => r.insumo_id && Number(r.quantidade) > 0 && r.insumo_id !== editModal.id)
        .map(r => ({ produto_id: editModal.id, insumo_id: r.insumo_id, quantidade: Number(r.quantidade) }));
      if (linhas.length) await supabase.from("produto_insumos").insert(linhas);
    }
    setEditModal(null); load();
  };

  const desativar = async (id) => {
    await supabase.from("produtos").update({ ativo: false }).eq("id", id);
    load();
  };

  // Estilo das <option> para forçar cores corretas em todos os navegadores
  const optionStyle = { background: "#1a1800", color: "#f5f0e0" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={base.pageTitle}>Estoque</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={base.btn(C.blue, "#fff")} onClick={() => setShowScanner(true)}>📷 Bipar Produto</button>
          <button style={base.btn()} onClick={() => setShowForm(!showForm)}>+ Novo Produto</button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onFound={(produto) => setEntradaModal(produto)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {esgotados.length > 0 && <div style={base.alert("#a855f7")}>🚫 <strong>{esgotados.length} esgotado(s):</strong> {resumoNomes(esgotados)}</div>}
      {baixos.length > 0 && <div style={base.alert(C.red)}>⚠️ <strong>{baixos.length} estoque baixo:</strong> {resumoNomes(baixos)}</div>}

      {showForm && (
        <div style={{ ...base.card, marginBottom: 16 }}>
          <div style={base.sectionTitle}>Novo Produto</div>
          <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Nome *", key: "nome", type: "text", placeholder: "Ex: Heineken 600ml" },
              { label: "Preço (R$) *", key: "preco", type: "number", placeholder: "0,00" },
              { label: "Estoque Atual", key: "estoque_atual", type: "number", placeholder: "0" },
              { label: "Estoque Mínimo", key: "estoque_minimo", type: "number", placeholder: "5" },
              { label: "Unidade", key: "unidade", type: "text", placeholder: "un, kg, l..." },
              { label: "Código de Barras", key: "codigo_barras", type: "text", placeholder: "Bipe ou digite..." },
            ].map(f => (
              <div key={f.key}>
                <label style={base.label}>{f.label}</label>
                <input style={base.input} type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontSize: 13, cursor: "pointer", paddingBottom: 10 }}>
                <input type="checkbox" checked={form.controla_estoque !== false} onChange={e => setForm({ ...form, controla_estoque: e.target.checked })} />
                Controlar estoque <span style={{ color: C.muted, fontSize: 11 }}>(desmarque pra copão, drinks e combos)</span>
              </label>
            </div>
            <div>
              <label style={base.label}>Categoria</label>
              <select style={base.select} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map(c => (
                  <option key={c.id} value={c.nome} style={optionStyle}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={base.row}>
            <button style={base.btn(C.green, "#fff")} onClick={salvar}>Salvar</button>
            <button style={base.btnOutline} onClick={() => { setShowForm(false); setErroForm(""); }}>Cancelar</button>
          </div>
          {erroForm && <div style={{ ...base.alert(C.red), marginTop: 12, marginBottom: 0 }}>⚠️ {erroForm}</div>}
        </div>
      )}

      {/* Modal Entrada */}
      {entradaModal && (
        <div style={base.modal}>
          <div style={base.modalBox}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>Entrada de Estoque</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{entradaModal.nome} · Atual: {entradaModal.estoque_atual}</div>
            <label style={base.label}>Quantidade a adicionar</label>
            <input style={{ ...base.input, marginBottom: 16 }} type="number" value={qtdEntrada} onChange={e => setQtdEntrada(e.target.value)} placeholder="Ex: 24" autoFocus />
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={entradaEstoque}>Confirmar</button>
              <button style={base.btnOutline} onClick={() => { setEntradaModal(null); setQtdEntrada(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editModal && (
        <div style={base.modal}>
          <div style={base.modalBox}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 20 }}>✏️ Editar Produto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={base.label}>Nome</label>
                <input style={base.input} value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div>
                <label style={base.label}>Preço (R$)</label>
                <input style={base.input} type="number" value={editForm.preco} onChange={e => setEditForm({ ...editForm, preco: e.target.value })} />
              </div>
              <div>
                <label style={base.label}>Estoque Mínimo</label>
                <input style={base.input} type="number" value={editForm.estoque_minimo} onChange={e => setEditForm({ ...editForm, estoque_minimo: e.target.value })} />
              </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontSize: 13, cursor: "pointer", paddingBottom: 10 }}>
                  <input type="checkbox" checked={editForm.controla_estoque !== false} onChange={e => setEditForm({ ...editForm, controla_estoque: e.target.checked })} />
                  Controlar estoque <span style={{ color: C.muted, fontSize: 11 }}>(desmarque pra copão, drinks e combos)</span>
                </label>
              </div>
              <div>
                <label style={base.label}>Categoria</label>
                <select style={base.select} value={editForm.categoria} onChange={e => setEditForm({ ...editForm, categoria: e.target.value })}>
                  {categorias.map(c => (
                    <option key={c.id} value={c.nome} style={optionStyle}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={base.label}>Unidade</label>
                <input style={base.input} value={editForm.unidade} onChange={e => setEditForm({ ...editForm, unidade: e.target.value })} />
              </div>
              {"volume_ml" in editForm && editForm.controla_estoque !== false && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={base.label}>Vende fracionado? <span style={{ color: C.muted }}>· garrafa usada em dose (ex.: 1000 ml) ou fardo vendido em latas (ex.: 12 un)</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...base.input, flex: 2 }} type="number" placeholder={editForm.fracao_unidade === "un" ? "ex.: 12" : "ex.: 1000"} value={editForm.volume_ml} onChange={e => setEditForm({ ...editForm, volume_ml: e.target.value })} />
                    {"fracao_unidade" in editForm && (
                      <select style={{ ...base.select, flex: 1 }} value={editForm.fracao_unidade} onChange={e => setEditForm({ ...editForm, fracao_unidade: e.target.value })}>
                        <option value="ml" style={optionStyle}>ml (dose)</option>
                        <option value="un" style={optionStyle}>un (latas)</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
            {temReceitas && editForm.controla_estoque === false && (
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>🧪 O que este produto usa (baixa no estoque)</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Ex.: Copão Red Label usa 150 ml de Red Label; Heineken lata usa 1 un do fardo. A cada venda o sistema desconta da garrafa ou do fardo aberto e, quando acaba, baixa 1 do estoque.</div>
                {receita.map((r, idx) => {
                  const ins = produtos.find(p => p.id === r.insumo_id);
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <select style={{ ...base.select, flex: 2 }} value={r.insumo_id || ""} onChange={e => setReceita(rs => rs.map((x, i) => i === idx ? { ...x, insumo_id: e.target.value } : x))}>
                        <option value="" style={optionStyle}>Escolha o produto…</option>
                        {produtos.filter(p => !semEstoque(p) && p.id !== editModal.id).map(p => <option key={p.id} value={p.id} style={optionStyle}>{p.nome}{temVolume(p) ? ` (${p.volume_ml} ${unidadeFracao(p)})` : ""}</option>)}
                      </select>
                      <input style={{ ...base.input, flex: 1, minWidth: 70 }} type="number" placeholder={ins && temVolume(ins) ? unidadeFracao(ins) : "qtd"} value={r.quantidade} onChange={e => setReceita(rs => rs.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))} />
                      <span style={{ fontSize: 12, color: C.muted, width: 22 }}>{ins && temVolume(ins) ? unidadeFracao(ins) : "un"}</span>
                      <button style={base.btnSm(C.red, "#fff")} onClick={() => setReceita(rs => rs.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  );
                })}
                {receita.some(r => { const ins = produtos.find(p => p.id === r.insumo_id); return ins && !temVolume(ins) && Number(r.quantidade) % 1 !== 0; }) &&
                  <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>Pra produto sem volume em ml, use quantidade inteira (ex.: 1 lata). Pra dose, coloque o volume da garrafa no cadastro dela.</div>}
                <button style={base.btnSm(C.card, C.accent)} onClick={() => setReceita(rs => [...rs, { insumo_id: "", quantidade: "" }])}>+ Adicionar item</button>
              </div>
            )}
            <div style={base.row}>
              <button style={base.btn(C.green, "#fff")} onClick={salvarEdicao}>Salvar</button>
              <button style={base.btnOutline} onClick={() => setEditModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela desktop / Cards mobile */}
      <div style={base.card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input style={{ ...base.input, flex: 2, minWidth: 200 }} placeholder="🔍 Buscar produto pelo nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
          <select style={{ ...base.select, flex: 1, minWidth: 150 }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
            <option value="todas" style={optionStyle}>Todas as categorias</option>
            {[...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort().map(c => <option key={c} value={c} style={optionStyle}>{c}</option>)}
          </select>
          <select style={{ ...base.select, flex: 1, minWidth: 150 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos" style={optionStyle}>Todos os status</option>
            <option value="esgotado" style={optionStyle}>🚫 Esgotados</option>
            <option value="baixo" style={optionStyle}>⚠️ Estoque baixo</option>
            <option value="ok" style={optionStyle}>✅ OK</option>
          </select>
        </div>
        {(busca || filtroCat !== "todas" || filtroStatus !== "todos") && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            {lista.length} de {produtos.length} produtos ·{" "}
            <button onClick={() => { setBusca(""); setFiltroCat("todas"); setFiltroStatus("todos"); }} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0 }}>limpar filtros</button>
          </div>
        )}
        <style>{`
          @media (max-width: 768px) { .estoque-table { display: none !important; } .estoque-cards { display: flex !important; } }
          @media (min-width: 769px) { .estoque-cards { display: none !important; } }
        `}</style>

        {/* Cards mobile */}
        <div className="estoque-cards" style={{ flexDirection: "column", gap: 10, display: "none" }}>
          {lista.map(p => {
            const livre = semEstoque(p);
            const esgotado = !livre && p.estoque_atual === 0;
            const baixo = !livre && !esgotado && p.estoque_atual <= p.estoque_minimo;
            const statusCor = livre ? C.blue : esgotado ? "#a855f7" : baixo ? C.red : C.green;
            const statusLabel = livre ? "🍹 Sem controle" : esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
            return (
              <div key={p.id} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>{p.nome}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={base.tag(C.accent)}>{p.categoria}</span>
                      <span style={base.tag(statusCor)}>{statusLabel}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>{fmt(p.preco)}</div>
                    <div style={{ color: esgotado ? "#a855f7" : C.text, fontWeight: 700, fontSize: 13 }}>{livre ? "—" : `${p.estoque_atual} ${p.unidade}`}</div>
                    {textoGarrafa(p) && <div style={{ color: C.muted, fontSize: 11 }}>{textoGarrafa(p)}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={base.btnSm(C.blue, "#fff")} onClick={() => abrirEdicao(p)}>✏️ Editar</button>
                  <button style={base.btnSm()} onClick={() => setEntradaModal(p)}>+ Entrada</button>
                  <button style={base.btnSm(C.red, "#fff")} onClick={() => desativar(p.id)}>Remover</button>
                </div>
              </div>
            );
          })}
          {lista.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 32, fontSize: 13 }}>{produtos.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</div>}
        </div>

        {/* Tabela desktop */}
        <table className="estoque-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={base.th}>Produto</th>
              <th style={base.th}>Categoria</th>
              <th style={base.th}>Preço</th>
              <th style={base.th}>Estoque</th>
              <th style={base.th}>Mínimo</th>
              <th style={base.th}>Status</th>
              <th style={base.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(p => {
              const livre = semEstoque(p);
              const esgotado = !livre && p.estoque_atual === 0;
              const baixo = !livre && !esgotado && p.estoque_atual <= p.estoque_minimo;
              const statusCor = livre ? C.blue : esgotado ? "#a855f7" : baixo ? C.red : C.green;
              const statusLabel = livre ? "🍹 Sem controle" : esgotado ? "🚫 Esgotado" : baixo ? "⚠️ Baixo" : "✅ OK";
              return (
                <tr key={p.id}>
                  <td style={base.td}>{p.nome}</td>
                  <td style={base.td}><span style={base.tag(C.accent)}>{p.categoria}</span></td>
                  <td style={{ ...base.td, color: C.accent, fontWeight: 700 }}>{fmt(p.preco)}</td>
                  <td style={{ ...base.td, fontWeight: 700, color: esgotado ? "#a855f7" : C.text }}>{livre ? "—" : `${p.estoque_atual} ${p.unidade}`}{textoGarrafa(p) && <div style={{ color: C.muted, fontSize: 11, fontWeight: 400 }}>{textoGarrafa(p)}</div>}</td>
                  <td style={base.td}>{p.estoque_minimo}</td>
                  <td style={base.td}><span style={base.tag(statusCor)}>{statusLabel}</span></td>
                  <td style={base.td}>
                    <div style={base.row}>
                      <button style={base.btnSm(C.blue, "#fff")} onClick={() => abrirEdicao(p)}>✏️ Editar</button>
                      <button style={base.btnSm()} onClick={() => setEntradaModal(p)}>+ Entrada</button>
                      <button style={base.btnSm(C.red, "#fff")} onClick={() => desativar(p.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={7} style={{ ...base.td, color: C.muted, textAlign: "center" }}>{produtos.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}