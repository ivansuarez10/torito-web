// Prueba de la lógica de envío de submit-order.
//   deno test supabase/functions/submit-order/envio.test.ts
//
// No necesita red: la fórmula y las coordenadas son fijas.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { costoEnvio, costoEnvioReal, ORIGEN, pinDeDireccion } from "./envio.ts";

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

// ---- Ruta real (OSRM). Se inyecta el medidor para probar sin red. ----
Deno.test("costoEnvioReal cobra sobre la RUTA cuando OSRM responde", async () => {
  const r = await costoEnvioReal(linkDe(14.0730, -87.1750), true, async () => 9.0); // ruta 9 km
  assertEquals(r.motivo, "calculado");
  assertEquals(r.source, "ruta");
  assertEquals(r.km, 9.0);
  assertEquals(r.costo, Math.max(50, Math.round((50 + 9 * 9.0) / 5) * 5)); // 130
});

Deno.test("costoEnvioReal cae al estimado si OSRM no responde", async () => {
  const conRuta = costoEnvio(linkDe(14.0730, -87.1750), true);           // estimado ×factor
  const r = await costoEnvioReal(linkDe(14.0730, -87.1750), true, async () => null);
  assertEquals(r.source, "estimado");
  assertEquals(r.costo, conRuta.costo); // mismo costo que el estimado
});

Deno.test("costoEnvioReal no llama a la ruta en retiro / sin pin / fuera de zona", async () => {
  let llamado = false;
  const espia = async () => { llamado = true; return 5; };
  assertEquals((await costoEnvioReal(linkDe(14.07, -87.17), false, espia)).motivo, "retiro");
  assertEquals((await costoEnvioReal("sin link", true, espia)).motivo, "sin_pin");
  assertEquals((await costoEnvioReal(linkDe(14.45, -87.17), true, espia)).motivo, "fuera_de_zona");
  assertEquals(llamado, false); // esos casos no gastan una llamada a OSRM
});
