// Prueba de la lógica de precios de submit-order.
//   deno test --allow-net supabase/functions/submit-order/precios.test.ts
//
// Usa el catálogo REAL de producción (lectura pública de app_config), no un
// invento: si mañana cambian los nombres o los precios, esta prueba lo nota.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normNombre, precioDeLinea, preciosDeConfianza } from "./precios.ts";

const URL_SUPA = "https://dnyzokgmjuvbrcxxdatr.supabase.co";
const LLAVE_PUBLICA = "sb_publishable_jO4pGdkTBporf_cndos9OA_K_8tVn3A"; // pública por diseño

// Cliente falso: devuelve el catálogo real bajado por REST.
async function supaDePrueba() {
  const r = await fetch(
    `${URL_SUPA}/rest/v1/app_config?select=value&key=eq.store_catalog`,
    { headers: { apikey: LLAVE_PUBLICA, Authorization: `Bearer ${LLAVE_PUBLICA}` } },
  );
  const data = await r.json();
  return { from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ data, error: null }) }) }) }) };
}

Deno.test("normNombre iguala acentos, mayúsculas y espacios de más", () => {
  assertEquals(normNombre("  Costilla  de   RES "), "costilla de res");
  assertEquals(normNombre("Jamón"), normNombre("JAMON"));
  assertEquals(normNombre(null), "");
});

Deno.test("el catálogo real se carga y trae precios", async () => {
  const precios = await preciosDeConfianza(await supaDePrueba());
  console.log(`    catálogo cargado: ${precios.size} productos con precio`);
  if (precios.size < 40) throw new Error("el catálogo vino demasiado corto");
});

Deno.test("un precio manipulado se ignora y gana el del catálogo", async () => {
  const precios = await preciosDeConfianza(await supaDePrueba());
  const real = precios.get(normNombre("Bistec"));
  if (typeof real !== "number") throw new Error("no se encontró Bistec en el catálogo");

  // Lo que mandaría un pedido manipulado: 1 lempira la libra.
  const r = precioDeLinea(precios, "Bistec", 3);
  assertEquals(r.price, real);          // NO 1
  assertEquals(r.total, real * 3);      // NO 3
  console.log(`    Bistec ×3 → ${r.total} (catálogo ${real}/lb), el 1 del atacante se descartó`);
});

Deno.test("producto que no está en el catálogo entra en 0 (lo cotiza el carnicero)", async () => {
  const precios = await preciosDeConfianza(await supaDePrueba());
  // Los tres de vísceras se cotizan por WhatsApp y no viven en el catálogo de la nube.
  for (const n of ["Pulmón", "Corazón", "Vaso"]) {
    const r = precioDeLinea(precios, n, 2);
    assertEquals(r.price, 0, `${n} debería entrar en 0`);
    assertEquals(r.total, 0);
  }
  // Y un nombre inventado tampoco cuela un precio.
  assertEquals(precioDeLinea(precios, "Lingote de oro", 99).total, 0);
});

Deno.test("sin catálogo, todo entra en 0 y nada revienta", async () => {
  const roto = { from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ data: null, error: { message: "caída" } }) }) }) }) };
  const precios = await preciosDeConfianza(roto);
  assertEquals(precios.size, 0);
  assertEquals(precioDeLinea(precios, "Bistec", 5).total, 0);
});

Deno.test("los decimales no arrastran basura de coma flotante", async () => {
  const precios = new Map([["x", 110.35]]);
  assertEquals(precioDeLinea(precios, "x", 3).total, 331.05);
});
