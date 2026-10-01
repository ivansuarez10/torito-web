// ---- Envío: el navegador tampoco manda la verdad ----
// Vive aparte de index.ts para poder probarlo sin levantar el servidor. La prueba
// está en envio.test.ts.
//
// El monto del envío llega calculado por la pantalla, y ese número se puede editar
// antes de enviarlo. Peor todavía: en sep 2026 un cliente de una colonia lejana pagó
// L 50 SIN manipular nada — el mapa abría con el pin sobre la carnicería y calculaba
// desde ahí. Eso se arregló en la tienda, pero un pedido puede venir de una pestaña
// vieja en caché, o directamente de un POST hecho a mano.
//
// Acá se recalcula con las MISMAS coordenadas que la clienta marcó, que sí viajan:
// la tienda pega el pin como link de Maps dentro de `addr` para que el repartidor lo
// abra de un toque. Ese link es la prueba de dónde dijo que vivía.
//
// Si NO hay pin, el envío va en 0 = "a convenir", que es lo que el carnicero ya cobra
// a mano. Cero nunca es un cobro equivocado: es una decisión pendiente.

export const ORIGEN = { lat: 14.1091381, lng: -87.1916749 }; // Mercado San Pablo, El Manchén
export const BASE = 50;          // mínimo publicado
export const POR_KM = 9;
export const FACTOR_CALLE = 1.3; // la calle no va en línea recta
export const KM_MAX = 25;        // más lejos que esto es fuera de zona

/** La marca que la tienda pega JUSTO ANTES del pin del GPS. Importa porque `addr` se
 *  arma así:  <lo que la clienta escribió> · 📍 Ubicación: <link del GPS>
 *  O sea que el texto libre viaja PRIMERO. */
export const MARCA_PIN = "📍 Ubicación:";

/** Saca lat,lng del link de Maps que la tienda incrusta en la dirección.
 *  Devuelve null si no hay link o si los números no son coordenadas creíbles.
 *
 *  ⚠️ SOLO se lee lo que viene DESPUÉS DE LA ÚLTIMA marca, y pegado a ella. Antes esto
 *  buscaba el primer `maps.google.com/?q=` de todo el texto, y como lo que la clienta
 *  escribe en "¿Cómo es tu casa?" va al principio, bastaba con teclear ahí un link de
 *  Maps con las coordenadas de la carnicería para que el servidor cobrara el mínimo
 *  aunque el GPS dijera otra cosa. Era el cobro de L 50 de septiembre otra vez, por la
 *  puerta de atrás. La ÚLTIMA marca es la que pone la tienda; una tecleada a mano queda
 *  siempre antes. Y el ancla `^\s*` impide colar algo entre la marca y el link. */
export function pinDeDireccion(addr: unknown): { lat: number; lng: number } | null {
  const s = String(addr ?? "");
  const i = s.lastIndexOf(MARCA_PIN);
  if (i < 0) return null; // sin marca no hay pin de confianza → "a convenir"
  const cola = s.slice(i + MARCA_PIN.length);
  const m = cola.match(/^\s*(?:https?:\/\/)?maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null; // isla nula: nadie vive ahí
  return { lat, lng };
}

/** Distancia en línea recta, en km. Misma fórmula que usa la tienda. */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const la1 = a.lat * rad, la2 = b.lat * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export type Envio = { costo: number; motivo: "retiro" | "sin_pin" | "fuera_de_zona" | "calculado"; km: number; source?: "ruta" | "estimado" };

/** El costo que vale: el que sale de las coordenadas, no el que mandó la pantalla.
 *  El tope de 25 km se mide en línea recta y el costo sobre la distancia por calle,
 *  igual que en la tienda: si se separan, servidor y pantalla dirían cosas distintas. */
export function costoEnvio(addr: unknown, delivery: boolean): Envio {
  if (!delivery) return { costo: 0, motivo: "retiro", km: 0 };
  const pin = pinDeDireccion(addr);
  if (!pin) return { costo: 0, motivo: "sin_pin", km: 0 };
  const recto = distanciaKm(ORIGEN, pin);
  if (recto > KM_MAX) return { costo: 0, motivo: "fuera_de_zona", km: recto };
  const calle = recto * FACTOR_CALLE;
  return { costo: Math.max(BASE, Math.round((BASE + POR_KM * calle) / 5) * 5), motivo: "calculado", km: calle };
}

/** Distancia REAL por carretera (km) según OSRM. Devuelve null si falla o tarda:
 *  quien llama cae al estimado. En Tegucigalpa el factor fijo se queda corto (cerros/quebradas),
 *  por eso se mide la ruta de verdad. */
export async function rutaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  timeoutMs = 6000,
): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const m = j?.routes?.[0]?.distance;
    if (typeof m !== "number" || !isFinite(m) || m <= 0) return null;
    return m / 1000;
  } catch {
    return null;
  }
}

/** Igual que costoEnvio pero cobra sobre la distancia REAL por ruta (OSRM). Si la ruta no se
 *  puede medir, cae al estimado (línea recta × factor) y marca source:"estimado". El tope de
 *  zona sigue midiéndose en línea recta (lo decide costoEnvio). getRuta es inyectable para probar. */
export async function costoEnvioReal(
  addr: unknown,
  delivery: boolean,
  getRuta: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Promise<number | null> = rutaKm,
): Promise<Envio> {
  const base = costoEnvio(addr, delivery);
  if (base.motivo !== "calculado") return base;            // retiro / sin_pin / fuera_de_zona: sin cambio
  const pin = pinDeDireccion(addr)!;                        // 'calculado' garantiza que hay pin válido
  const rk = await getRuta(ORIGEN, pin);
  if (rk == null) return { ...base, source: "estimado" };  // OSRM no respondió → estimado ×factor
  return { costo: Math.max(BASE, Math.round((BASE + POR_KM * rk) / 5) * 5), motivo: "calculado", km: rk, source: "ruta" };
}
