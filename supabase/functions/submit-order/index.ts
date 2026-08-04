// Supabase Edge Function: submit-order
// Recibe un pedido de la tienda web e inserta una comanda en la tabla `orders`
// de Comandas El Torito. Usa la SERVICE ROLE key (secreta) para saltar el RLS
// cerrado de forma segura, validando el payload en el servidor.
//
// Esta función ES PÚBLICA (la clienta anónima la llama desde la tienda), así que
// NO puede exigir login. La protección contra abuso (un competidor inundando el
// kanban con pedidos falsos) son TRES capas:
//   1) Rate-limit por IP (memoria del proceso): frena ráfagas de un mismo atacante.
//   2) Rate-limit por teléfono (base de datos): frena spam distribuido con el mismo número.
//   3) Validación estricta del payload (ya existía; se refuerza el teléfono).
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

// ---- Capa 1: Rate-limit por IP (ventana deslizante en memoria del proceso) ----
// No es infalible (las Edge Functions pueden correr en varias instancias y la
// memoria se reinicia), pero corta en seco al script que martillea desde una IP.
// La capa 2 (por teléfono, en DB) cubre lo que esta deje pasar.
const IP_WINDOW_MS = 60_000;   // ventana de 1 minuto
const IP_MAX_HITS = 8;         // máx. 8 pedidos por IP por minuto
const ipHits = new Map<string, number[]>();
function ipRateLimited(ip: string, now: number): boolean {
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) { // higiene: no dejar crecer el mapa sin límite
    for (const [k, v] of ipHits) { if (!v.length || now - v[v.length - 1] > IP_WINDOW_MS) ipHits.delete(k); }
  }
  return arr.length > IP_MAX_HITS;
}
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || "").trim() ||
    req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
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

  // ---- Capa 1: por IP (antes de leer el body, para gastar lo mínimo en un ataque) ----
  const ip = clientIp(req);
  if (ipRateLimited(ip, now)) return json({ error: "rate_limited" }, 429);

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

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
