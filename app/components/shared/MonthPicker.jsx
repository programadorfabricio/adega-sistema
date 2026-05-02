"use client";
import { C, base } from "./constants";

export default function MonthPicker({ value, onChange }) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, mes] = value.split("-").map(Number);

  const anterior = () => {
    const d = new Date(ano, mes - 2);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`);
  };

  const proximo = () => {
    const d = new Date(ano, mes);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px" }}>
      <button onClick={anterior} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>‹</button>
      <span style={{ fontWeight: 700, fontSize: 14, color: C.text, minWidth: 110, textAlign: "center" }}>
        {meses[mes - 1]} de {ano}
      </span>
      <button onClick={proximo} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>›</button>
    </div>
  );
}