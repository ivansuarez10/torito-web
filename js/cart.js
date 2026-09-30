/* Carrito de la tienda El Torito (v3). Vanilla, sin dependencias.
   Viene de salida/prototipo/cart.js del Estudio UX (rediseño aprobado el 30 sep 2026).
   Reglas de cantidad IGUALES a las de siempre:
   - libra:   mín 0.5, paso 0.5, por defecto 1
   - paquete: mín 1,   paso 1,   por defecto 1
   - Hasta maxNormal (meta.stock.max_libra / max_paquete, o p.max) se compra normal;
     por encima la línea queda "big" (se confirma disponibilidad). Nunca pasa de hardCap.
   - quote:true  -> sin precio ("A cotizar"), no suma al subtotal.
   - validate:true -> precio estimado, se confirma el peso.
   LO NUEVO: si el producto tiene cortes, el corte es obligatorio y CADA CORTE ES UNA LÍNEA
   (res-costilla|En Cubos y res-costilla|En tiras pueden ir juntas).

   MIGRACIÓN v2 -> v3 (una sola vez, en init): el carrito viejo era torito_cart_v2 = {id: qty}
   más torito_cuts_v2 = {id: corte}. Cada id pasa a ser una línea {id, cut, qty}. Si el
   producto tiene cortes pero no había corte guardado (o ese corte ya no se ofrece), la línea
   NO se tira: queda "sin corte" (needCut) y "Tu pedido" pide elegirlo antes de seguir.
   Las claves v2 no se borran: si algo saliera mal, lo que la clienta tenía sigue ahí. */
(function () {
  "use strict";

  var KEY = "torito_cart_v3";
  var UNIT = {
    libra: { step: 0.5, min: 0.5, def: 1, uno: "libra", varios: "libras", corto: "lb" },
    paquete: { step: 1, min: 1, def: 1, uno: "paquete", varios: "paquetes", corto: "paq" }
  };

  var cat = null;          // catálogo normalizado (ToritoCatalogo.desde)
  var items = [];          // [{id, cut, qty}]
  var bus = document.createElement("span"); // EventTarget compatible con Android viejos

  function unit(p) { return UNIT[p.unit] || UNIT.paquete; }
  function stock() { return (cat && cat.meta && cat.meta.stock) || {}; }
  function maxNormal(p) {
    if (p.max != null && p.max !== "") return Number(p.max);
    var s = stock();
    return p.unit === "paquete" ? (s.max_paquete || 12) : (s.max_libra || 20);
  }
  function hardCap(p) { return Math.max(stock().hard_cap || 80, maxNormal(p)); }
  function hasCuts(p) { return !!(p.cuts && p.cuts.length); }
  function rules(p) {
    var u = unit(p);
    return { step: u.step, min: u.min, def: u.def, maxNormal: maxNormal(p), hardCap: hardCap(p) };
  }
  // Redondea al paso de la unidad y lo encierra entre mín y tope.
  function clamp(p, q) {
    var u = unit(p);
    q = Math.round(Number(q) / u.step) * u.step;
    q = Math.round(q * 100) / 100;
    if (!isFinite(q)) q = u.def;
    return Math.min(hardCap(p), Math.max(u.min, q));
  }
  function keyOf(id, cut) { return cut ? id + "|" + cut : id; }
  function find(key) {
    for (var i = 0; i < items.length; i++) if (keyOf(items[i].id, items[i].cut) === key) return i;
    return -1;
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 3, items: items })); } catch (e) {}
  }
  // Solo si todavía no existe el carrito v3: así la migración corre UNA vez y nunca pisa
  // lo que la clienta armó después.
  function migrarV2() {
    var ya = null;
    try { ya = localStorage.getItem(KEY); } catch (e) { return; }
    if (ya != null) return;
    var viejo = readJSON("torito_cart_v2"), cortes = readJSON("torito_cuts_v2") || {};
    if (!viejo || typeof viejo !== "object") return;
    var lista = [];
    Object.keys(viejo).forEach(function (id) {
      var q = Number(viejo[id]);
      if (!(q > 0)) return;
      lista.push({ id: id, cut: cortes[id] || null, qty: q });
    });
    try { localStorage.setItem(KEY, JSON.stringify({ v: 3, items: lista, migrado: "v2" })); } catch (e) {}
  }
  function load() {
    var raw = readJSON(KEY);
    var list = (raw && raw.items) || [];
    var out = [];
    list.forEach(function (it) {
      var p = cat.byId[it.id];
      if (!p) return;                      // ya no existe o se desactivó
      var cut = it.cut || null;
      if (hasCuts(p)) { if (cut && p.cuts.indexOf(cut) === -1) cut = null; }   // corte que ya no se ofrece: se pide de nuevo
      else cut = null;
      var q = clamp(p, it.qty);
      var i = -1;
      for (var k = 0; k < out.length; k++) if (keyOf(out[k].id, out[k].cut) === keyOf(it.id, cut)) i = k;
      if (i === -1) out.push({ id: it.id, cut: cut, qty: q });
      else out[i].qty = clamp(p, out[i].qty + q);
    });
    items = out;
  }
  function emit(tipo, detalle) {
    save();
    var ev;
    try { ev = new CustomEvent("change", { detail: { tipo: tipo, detalle: detalle } }); }
    catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("change", false, false, { tipo: tipo, detalle: detalle }); }
    bus.dispatchEvent(ev);
  }

  function lineOf(it) {
    var p = cat.byId[it.id];
    var cotizar = !!p.quote || p.price == null;
    return {
      key: keyOf(it.id, it.cut),
      id: it.id,
      product: p,
      cut: it.cut,
      qty: it.qty,
      unitLabel: it.qty === 1 ? unit(p).uno : unit(p).varios,
      unitShort: unit(p).corto,
      price: cotizar ? null : p.price,
      total: cotizar ? null : p.price * it.qty,
      quote: cotizar,
      validate: !!p.validate,
      soldout: !!p.soldout,
      needCut: hasCuts(p) && !it.cut,
      big: it.qty > maxNormal(p) + 1e-9,
      canDec: it.qty > unit(p).min + 1e-9,
      canInc: it.qty < hardCap(p) - 1e-9
    };
  }

  function ready() { if (!cat) throw new Error("ToritoCart.init(catalogo) antes de usarlo"); }

  var api = {
    KEY: KEY,
    listo: function () { return !!cat; },
    init: function (catalogo) {
      cat = catalogo;
      migrarV2();
      load();
      save();
      // Otra pestaña cambió el carrito.
      window.addEventListener("storage", function (e) { if (e.key === KEY) { load(); emit("sync"); } });
      emit("init");
      return api;
    },
    rules: function (idOrProduct) {
      ready();
      var p = typeof idOrProduct === "string" ? cat.byId[idOrProduct] : idOrProduct;
      return p ? rules(p) : null;
    },
    // Valor válido más cercano para un selector de cantidad (el mismo que aplicará add/setQty).
    clampQty: function (id, q) { ready(); var p = cat.byId[id]; return p ? clamp(p, q) : null; },
    // Devuelve {ok:true, line} o {ok:false, error:"no-existe"|"agotado"|"falta-corte"|"corte-invalido"|"tope"}.
    // opts.sinCorte: para "Repetir mi pedido" con un pedido viejo sin corte (o con uno que ya
    // no existe): en vez de rechazarlo, deja la línea sin corte para que lo elija en "Tu pedido".
    add: function (id, qty, opts) {
      ready();
      var p = cat.byId[id];
      if (!p) return { ok: false, error: "no-existe" };
      if (p.soldout) return { ok: false, error: "agotado" }; // agotado no se agrega
      var cut = (opts && opts.cut) || null;
      if (hasCuts(p)) {
        if (cut && p.cuts.indexOf(cut) === -1) {
          if (!(opts && opts.sinCorte)) return { ok: false, error: "corte-invalido", cuts: p.cuts.slice() };
          cut = null;
        }
        if (!cut && !(opts && opts.sinCorte)) return { ok: false, error: "falta-corte", cuts: p.cuts.slice() };
      } else cut = null;
      var q = clamp(p, qty == null ? unit(p).def : qty);
      var i = find(keyOf(id, cut));
      if (i === -1) { items.push({ id: id, cut: cut, qty: q }); i = items.length - 1; }
      else {
        if (items[i].qty >= hardCap(p) - 1e-9) return { ok: false, error: "tope", line: lineOf(items[i]) };
        items[i].qty = clamp(p, items[i].qty + q);
      }
      var line = lineOf(items[i]);
      emit("add", line);
      return { ok: true, line: line };
    },
    // qty <= 0 quita la línea.
    setQty: function (key, qty) {
      ready();
      var i = find(key);
      if (i === -1) return null;
      if (Number(qty) <= 0) { api.remove(key); return null; }
      items[i].qty = clamp(cat.byId[items[i].id], qty);
      var line = lineOf(items[i]);
      emit("qty", line);
      return line;
    },
    inc: function (key) {
      var i = find(key); if (i === -1) return null;
      var p = cat.byId[items[i].id];
      return api.setQty(key, items[i].qty + unit(p).step);
    },
    // En el mínimo no baja más ni quita; para quitar, remove().
    dec: function (key) {
      var i = find(key); if (i === -1) return null;
      var p = cat.byId[items[i].id];
      return api.setQty(key, Math.max(unit(p).min, items[i].qty - unit(p).step));
    },
    remove: function (key) {
      ready();
      var i = find(key);
      if (i === -1) return false;
      var quitado = items.splice(i, 1)[0];
      emit("remove", { key: key, id: quitado.id });
      return true;
    },
    clear: function () { ready(); items = []; emit("clear"); },
    lines: function () { ready(); return items.map(lineOf); },
    get: function (key) { ready(); var i = find(key); return i === -1 ? null : lineOf(items[i]); },
    qtyOf: function (id) {
      ready();
      return items.reduce(function (s, it) { return it.id === id ? s + it.qty : s; }, 0);
    },
    // Número de líneas (cuenta productos, no libras).
    count: function () { return cat ? items.length : 0; },
    // Suma de lo que tiene precio. Las líneas "A cotizar" no suman (ver flags().quote).
    subtotal: function () {
      ready();
      return items.reduce(function (s, it) { var l = lineOf(it); return l.total == null ? s : s + l.total; }, 0);
    },
    flags: function () {
      ready();
      var ls = items.map(lineOf);
      return {
        quote: ls.some(function (l) { return l.quote; }),
        validate: ls.some(function (l) { return l.validate; }),
        big: ls.some(function (l) { return l.big; }),
        soldout: ls.some(function (l) { return l.soldout; }),
        needCut: ls.some(function (l) { return l.needCut; })
      };
    },
    on: function (fn) { var h = function (e) { fn(e.detail); }; bus.addEventListener("change", h); return function () { bus.removeEventListener("change", h); }; }
  };

  window.ToritoCart = api;
})();
