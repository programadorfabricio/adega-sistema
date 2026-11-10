// Códigos de barras: valida EAN-13 e gera códigos internos (prefixo 2 = uso interno da loja, não colide com fábrica).
export function digitoEan13(doze) {
  const s = String(doze).split("").reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (s % 10)) % 10);
}
export const eanValido = (c) => /^\d{13}$/.test(c) && digitoEan13(c.slice(0, 12)) === c[12];
export const ean8Valido = (c) => /^\d{8}$/.test(c) && (() => {
  const s = c.slice(0, 7).split("").reduce((a, d, i) => a + Number(d) * (i % 2 ? 1 : 3), 0);
  return String((10 - (s % 10)) % 10) === c[7];
})();
export function codigoInterno(aleatorio = Math.random) {
  let doze = "2";
  for (let i = 0; i < 11; i++) doze += Math.floor(aleatorio() * 10);
  return doze + digitoEan13(doze);
}
export const formatoBarras = (c) => (eanValido(c) ? "EAN13" : ean8Valido(c) ? "EAN8" : "CODE128");
