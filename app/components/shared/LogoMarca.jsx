"use client";
import { useState } from "react";
import { MARCA } from "./constants";

// Logo da adega; se não existir o arquivo, mostra o emoji da marca
export default function LogoMarca({ size = 44, emojiSize = 24, marginBottom = 0, inline = false }) {
  const [erro, setErro] = useState(false);
  if (MARCA.logo && !erro) {
    return <img src={MARCA.logo} alt={MARCA.nome} onError={() => setErro(true)}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: "50%", marginBottom }} />;
  }
  const Tag = inline ? "span" : "div";
  return <Tag style={{ fontSize: emojiSize, marginBottom }}>{MARCA.emoji}</Tag>;
}
