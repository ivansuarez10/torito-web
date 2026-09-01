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

/** Saca lat,lng del link de Maps que la tienda incrusta en la dirección.
 *  Devuelve null si no hay link o si los números no son coordenadas creíbles. */
export function pinDeDireccion(addr: unknown): { lat: number; lng: number } | null {
  const m = String(addr ?? "").match(/maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
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

export type Envio = { costo: number; motivo: "retiro" | "sin_pin" | "fuera_de_zona" | "calculado"; km: number };

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
