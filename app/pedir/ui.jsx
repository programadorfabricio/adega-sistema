"use client";
import { C } from "../components/shared/constants";

export const FORMAS = [
  { value: "dinheiro", label: "💵 Dinheiro" },
  { value: "pix", label: "⚡ Pix na entrega" },
  { value: "cartao", label: "💳 Cartão na entrega" },
];

export function NaoEncontrada() {
  return <div style={{ minHeight: "100vh", background: C.bg, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>Página não encontrada</div>;
}
