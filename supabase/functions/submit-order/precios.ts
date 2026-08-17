// ---- Precios: el navegador no manda la verdad ----
// Vive aparte de index.ts para poder probarlo sin levantar el servidor
// (importar index.ts dispararía Deno.serve). La prueba está en precios.test.ts.
//
// El pedido llega con el precio que dice la pantalla, y ese número se puede editar
// antes de enviarlo (consola del navegador, o un POST hecho a mano). Se recalcula
// SIEMPRE contra `app_config.store_catalog`, que en la base solo puede escribir el
// admin — la política de RLS exige `email = admin@eltorito.hn` para esa clave.
//
// Se empareja por NOMBRE y no por id porque el pedido no manda el id. Los nombres
// son únicos en el catálogo (comprobado el 17 ago 2026: 59/59 en la nube y 63/63
// en el repo, sin uno repetido), así que alcanzan como llave.

/** Sin acentos, sin mayúsculas, sin espacios de más: que una tilde no deje un
 *  producto sin precio. */
export function normNombre(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

/** nombre normalizado → precio. Mapa vacío = no se confía en nada y todo entra
 *  en 0, que es el lado seguro: lo cotiza el carnicero. */
export async function preciosDeConfianza(supa: any): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  try {
    const { data, error } = await supa
      .from("app_config").select("value").eq("key", "store_catalog").limit(1);
    const productos = data?.[0]?.value?.products;
    if (error || !Array.isArray(productos)) return mapa;
    for (const p of productos) {
      const n = normNombre(p?.name);
      if (n && typeof p?.price === "number") mapa.set(n, p.price);
    }
  } catch (_) { /* mapa vacío */ }
  return mapa;
}

/** El precio de una línea. Nunca mira lo que mandó el cliente. */
export function precioDeLinea(
  precios: Map<string, number>,
  nombre: string,
  qty: number,
): { price: number; total: number } {
  const price = precios.get(normNombre(nombre)) ?? 0;
  return { price, total: Math.round(price * qty * 100) / 100 };
}
