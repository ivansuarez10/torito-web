// Supabase Edge Function: submit-order
// Recibe un pedido de la tienda web e inserta una comanda en la tabla `orders`
// de Comandas El Torito. Usa la SERVICE ROLE key (secreta) para saltar el RLS
// cerrado de forma segura, validando el payload en el servidor.
//
// Deploy:
//   supabase functions deploy submit-order --no-verify-jwt
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  const now = Date.now();
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

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supa.from("orders").insert(row);
  if (error) {
    console.error("insert error:", error.message);
    return json({ error: "db_error", detail: error.message }, 500);
  }

  return json({ ok: true, folio });
});
