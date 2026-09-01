// Prueba de la lógica de envío de submit-order.
//   deno test supabase/functions/submit-order/envio.test.ts
//
// No necesita red: la fórmula y las coordenadas son fijas.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { costoEnvio, ORIGEN, pinDeDireccion } from "./envio.ts";

const linkDe = (lat: number, lng: number) =>
  `Col. Ejemplo, casa 1 · 📍 Ubicación: https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

Deno.test("retiro en local nunca cobra envío", () => {
  assertEquals(costoEnvio(linkDe(14.0730, -87.1750), false).costo, 0);
});

Deno.test("sin pin va a convenir, no al mínimo", () => {
  // ESTE es el caso que costó plata: dirección escrita a mano, sin ubicación marcada.
  const r = costoEnvio("Col. Lomas del Guijarro, casa 8", true);
  assertEquals(r.motivo, "sin_pin");
  assertEquals(r.costo, 0);
});

Deno.test("el pin sobre la carnicería NO puede valer como entrega lejana", () => {
  // El navegador podría mandar shipping:50 con el pin del local; el servidor cobra
  // lo que dicen las coordenadas, que ahí es el mínimo y punto.
  const r = costoEnvio(linkDe(ORIGEN.lat, ORIGEN.lng), true);
  assertEquals(r.costo, 50);
});

Deno.test("una colonia lejana cuesta más que el mínimo", () => {
  const r = costoEnvio(linkDe(14.0730, -87.1750), true); // ~4.4 km en línea recta
  assertEquals(r.motivo, "calculado");
  assertEquals(r.costo > 50, true);
});

Deno.test("fuera de zona no se cobra: lo decide el carnicero", () => {
  const r = costoEnvio(linkDe(14.4500, -87.1750), true); // ~38 km
  assertEquals(r.motivo, "fuera_de_zona");
  assertEquals(r.costo, 0);
});

Deno.test("coordenadas imposibles se descartan", () => {
  assertEquals(pinDeDireccion("… https://maps.google.com/?q=999.9,-87.1"), null);
  assertEquals(pinDeDireccion("… https://maps.google.com/?q=0.000000,0.000000"), null);
  assertEquals(pinDeDireccion("sin link"), null);
});

Deno.test("el costo sube con la distancia, siempre", () => {
  const cerca = costoEnvio(linkDe(14.1000, -87.1900), true).costo;
  const lejos = costoEnvio(linkDe(14.0500, -87.2200), true).costo;
  assertEquals(lejos > cerca, true);
});
