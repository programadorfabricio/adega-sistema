import assert from "node:assert/strict";
import { digitoEan13, eanValido, codigoInterno, formatoBarras } from "../app/components/shared/codigos.mjs";
assert.equal(digitoEan13("789114910330"), "0");            // BARRIGUDINHA SKOL 7891149103300
assert.ok(eanValido("7891149103300"));
assert.ok(!eanValido("7891149103301"));
for (let i = 0; i < 200; i++) { const c = codigoInterno(); assert.ok(eanValido(c) && c[0] === "2", c); }
assert.equal(formatoBarras("78905498"), "EAN8");            // HEINEKEN 600ML
assert.equal(formatoBarras("ABC-1"), "CODE128");
console.log("OK: códigos de barras");
