// node --test scripts/recarregar.test.mjs
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { escutarRecarga } from "../app/components/shared/recarregar.mjs";

function ambiente() {
  const doc = new EventTarget(); doc.visibilityState = "visible";
  const win = new EventTarget();
  return { doc, win };
}

test("recarrega a cada 30 s com a aba visível", () => {
  mock.timers.enable({ apis: ["setInterval", "Date"] });
  const { doc, win } = ambiente(); const fn = mock.fn();
  const parar = escutarRecarga(fn, { segundos: 30, doc, win });
  mock.timers.tick(30000); mock.timers.tick(30000);
  assert.equal(fn.mock.callCount(), 2);
  parar(); mock.timers.reset();
});

test("não recarrega com a aba escondida", () => {
  mock.timers.enable({ apis: ["setInterval", "Date"] });
  const { doc, win } = ambiente(); const fn = mock.fn();
  doc.visibilityState = "hidden";
  const parar = escutarRecarga(fn, { segundos: 30, doc, win });
  mock.timers.tick(90000);
  assert.equal(fn.mock.callCount(), 0);
  parar(); mock.timers.reset();
});

test("recarrega ao voltar pra aba, sem repetir em menos de 2 s", () => {
  mock.timers.enable({ apis: ["setInterval", "Date"], now: 100000 });
  const { doc, win } = ambiente(); const fn = mock.fn();
  const parar = escutarRecarga(fn, { segundos: 30, doc, win });
  doc.dispatchEvent(new Event("visibilitychange"));
  win.dispatchEvent(new Event("focus")); // logo em seguida: ignorado
  assert.equal(fn.mock.callCount(), 1);
  mock.timers.tick(3000);
  win.dispatchEvent(new Event("focus"));
  assert.equal(fn.mock.callCount(), 2);
  parar(); mock.timers.reset();
});

test("parar() desliga tudo", () => {
  mock.timers.enable({ apis: ["setInterval", "Date"] });
  const { doc, win } = ambiente(); const fn = mock.fn();
  const parar = escutarRecarga(fn, { segundos: 30, doc, win });
  parar();
  mock.timers.tick(60000); win.dispatchEvent(new Event("focus"));
  assert.equal(fn.mock.callCount(), 0);
  mock.timers.reset();
});
