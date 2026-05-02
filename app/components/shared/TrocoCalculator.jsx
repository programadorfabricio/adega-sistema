"use client";
import { useState } from "react";
import { C, base, fmt } from "./constants";

export default function TrocoCalculator({ total }) {
  const [valorRecebido, setValorRecebido] = useState("");
  const troco = valorRecebido ? Number(valorRecebido) - total : 0;
  const notasRapidas = [10, 20, 50, 100, 200].filter(n => n >= total || n >= total / 2);

  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        💵 Calcular Troco
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {notasRapidas.map(n => (
          <button key={n} onClick={() => setValorRecebido(String(n))} style={{
            padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12,
            border: `1px solid ${Number(valorRecebido) === n ? C.green : C.border}`,
            background: Number(valorRecebido) === n ? `${C.green}20` : "transparent",
            color: Number(valorRecebido) === n ? C.green : C.muted,
          }}>R$ {n}</button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={base.label}>Valor recebido (R$)</label>
        <input
          style={base.input}
          type="number"
          value={valorRecebido}
          onChange={e => setValorRecebido(e.target.value)}
          placeholder="Ex: 100"
        />
      </div>

      {valorRecebido && (
        <div style={{
          background: troco >= 0 ? `${C.green}15` : `${C.red}15`,
          border: `1px solid ${troco >= 0 ? C.green : C.red}40`,
          borderRadius: 10, padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div style={{ fontSize: 13, color: troco >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {troco >= 0 ? "💚 Troco" : "⚠️ Valor insuficiente"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: troco >= 0 ? C.green : C.red }}>
            {troco >= 0 ? fmt(troco) : `Faltam ${fmt(Math.abs(troco))}`}
          </div>
        </div>
      )}
    </div>
  );
}