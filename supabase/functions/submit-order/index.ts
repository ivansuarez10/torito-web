// Supabase Edge Function: submit-order
// Recibe un pedido de la tienda web e inserta una comanda en la tabla `orders`
// de Comandas El Torito. Usa la SERVICE ROLE key (secreta) para saltar el RLS
// cerrado de forma segura, validando el payload en el servidor.
//
// Esta función ES PÚBLICA (la clienta anónima la llama desde la tienda), así que
// NO puede exigir login. La protección contra abuso (un competidor inundando el
// kanban con pedidos falsos) son TRES capas:
//   1) Rate-limit por IP (base de datos): frena ráfagas de un mismo atacante.
//   2) Rate-limit por teléfono (base de datos): frena spam distribuido con el mismo número.
//   3) Validación estricta del payload (ya existía; se refuerza el teléfono).
//
// ⚠️ REQUISITO: la capa 1 necesita `public.rl_hit()` y `public.rate_limits` en la
// base. Están en `supabase/SETUP_rate_limit.sql` (correr una vez en el SQL Editor).
// Si no existen, la capa 1 se desactiva sola y deja pasar — nunca bloquea a una
// clienta legítima por un problema del servidor.
//
// Deploy:
//   supabase functions deploy submit-order --no-verify-jwt
//   (o pegar este archivo en el Dashboard de Supabase, Verify JWT = OFF)
// Secretos necesarios (ya vienen por defecto en el proyecto):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// La tienda llama a: {SUPABASE_URL}/functions/v1/submit-order  (POST)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---- Capa 1: Rate-limit por IP (ventana fija, EN LA BASE) ----
// Antes este contador vivía en memoria del proceso y MEDIDO NO SERVÍA: 25
// llamadas seguidas desde la misma IP, cero 429. Con poco tráfico las Edge
// Functions levantan proceso nuevo casi por llamada, así que la memoria se
// borra antes de acumular. Ahora el conteo lo guarda Postgres (`rl_hit`), que
// sobrevive reinicios y es el mismo patrón del freno por teléfono, que sí anda.
// LOS NÚMEROS SON GENEROSOS A PROPÓSITO, y esta es la razón: la tienda dispara
// `submit-order` con `keepalive` y NO mira la respuesta — al cliente le dice "tu
// pedido ya nos llegó" pase lo que pase. O sea que un 429 a una clienta real es
// un pedido perdido EN SILENCIO. Además, en Honduras los datos móviles van por
// CGNAT: muchas clientas distintas pueden salir por LA MISMA IP pública, así que
// el límite no se puede pensar como "una persona". Un ataque hace cientos de
// llamadas por minuto; una ráfaga legítima no llega ni cerca de estos topes.
// Dos ventanas: la corta corta el martilleo, la larga corta el goteo sostenido.
const IP_RULES = [
  { secs: 60, max: 20, tag: "m" },     // 20 por minuto
  { secs: 3600, max: 120, tag: "h" },  // 120 por hora
];
async function ipRateLimited(supa: any, ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false; // sin IP no se castiga a nadie
  for (const rule of IP_RULES) {
    const { data, error } = await supa.rpc("rl_hit", {
      p_key: "ip:" + rule.tag + ":" + ip,
      p_window_secs: rule.secs,
      p_max: rule.max,
    });
    if (error) { // falta la función, o la base no responde
      console.error("rl_hit error:", error.message);
      return false; // ante duda, no bloquear a una clienta legítima
    }
    if (data === true) return true;
  }
  return false;
}

// De dónde sale la IP. IMPORTA EL ORDEN, no es cosmético:
//   - `cf-connecting-ip` lo escribe Cloudflare, que está delante de Supabase, y
//     PISA lo que mande el cliente. Es el dato confiable.
//   - En `x-forwarded-for` se toma la ÚLTIMA entrada, no la primera. La cadena
//     se lee "cliente, proxy1, proxy2…", así que cualquiera puede mandar
//     `X-Forwarded-For: 1.2.3.4` y el proxy solo le AGREGA la IP real detrás.
//     Quedarse con la primera es dejar que el atacante elija su propia clave de
//     rate-limit — o sea, no tener rate-limit. La última la pone el proxy.
function clientIp(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const hops = (req.headers.get("x-forwarded-for") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length) return hops[hops.length - 1];
  return (req.headers.get("x-real-ip") || "").trim() || "unknown";
}

// ---- Capa 2: Rate-limit por teléfono (persistente, vía la tabla orders) ----
const PHONE_WINDOW_MS = 20 * 60_000; // 20 minutos
const PHONE_MAX_ORDERS = 6;          // máx. 6 pedidos por número en 20 min
async function phoneRateLimited(supa: any, phone: string, now: number): Promise<boolean> {
  const since = now - PHONE_WINDOW_MS;
  const { data, error } = await supa
    .from("orders")
    .select("id")
    .eq("phone", phone)
    .gte("created_at", since)
    .limit(PHONE_MAX_ORDERS + 1);
  if (error) return false; // ante duda, no bloquear a una clienta legítima
  return Array.isArray(data) && data.length >= PHONE_MAX_ORDERS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const now = Date.now();

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Capa 1: por IP (antes de leer el body, para gastar lo mínimo en un ataque) ----
  const ip = clientIp(req);
  if (await ipRateLimited(supa, ip)) {
    console.warn("rate_limited por IP"); // sin la IP: no hace falta guardarla en el log
    return json({ error: "rate_limited" }, 429);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // ---- Validación ----
  const name = String(payload?.client_name ?? "").trim().slice(0, 120);
  const phone = String(payload?.phone ?? "").trim().slice(0, 40);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!name || !phone) return json({ error: "missing_client" }, 400);
  // El teléfono debe parecer un teléfono (8–15 dígitos). Frena payloads basura.
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 8 || phoneDigits.length > 15) return json({ error: "bad_phone" }, 400);
  if (items.length === 0 || items.length > 100) return json({ error: "bad_items" }, 400);

  // Normaliza los items (whitelist de campos, nada de columnas arbitrarias).
  // Se mapea al shape que Comandas espera: corte elegido, weigh (=se pesa),
  // available:true por defecto (el carnicero lo ajusta; sin esto el mensaje
  // al cliente filtra por disponibles y saldría vacío).
  const cleanItems = items.slice(0, 100).map((it: any) => ({
    name: String(it?.name ?? "").slice(0, 80),
    cat: String(it?.cat ?? "").slice(0, 24),
    qty: Number(it?.qty) || 0,
    unit: String(it?.unit ?? "").slice(0, 10),
    price: Number(it?.price) || 0,
    total: Number(it?.total) || 0,
    corte: it?.corte ? String(it.corte).slice(0, 60) : null,
    weigh: !!it?.validate,
    available: true,
  }));

  // ---- Capa 2: por teléfono (consulta la DB con la service role) ----
  if (await phoneRateLimited(supa, phone, now)) return json({ error: "rate_limited" }, 429);

  // Usa el folio que ya mostró la tienda al cliente (así coincide con WhatsApp);
  // si no viene o no es válido, genera uno. Prefijo "W" para NO chocar con la
  // secuencia local de Comandas (o0001…).
  const folio = /^W\d{5,10}$/.test(String(payload?.folio ?? ""))
    ? String(payload.folio)
    : "W" + String(now).slice(-7);
  const id = "web_" + folio;

  const row = {
    id,
    folio,
    client_name: name,
    phone,
    zone: String(payload?.zone ?? "").slice(0, 80),
    addr: String(payload?.addr ?? "").slice(0, 200),
    delivery: !!payload?.delivery,
    shipping: Number(payload?.shipping) || 0,
    note: String(payload?.note ?? "").slice(0, 400),
    status: "cotizar", // entra a la columna "Por cotizar" para validar peso
    paid: false,
    created_at: now,
    items: cleanItems,
    hist: [{ at: now, ev: "Pedido creado desde la tienda web" }],
  };

  const { error } = await supa.from("orders").insert(row);
  if (error) {
    console.error("insert error:", error.message);
    return json({ error: "db_error", detail: error.message }, 500);
  }

  return json({ ok: true, folio });
});
