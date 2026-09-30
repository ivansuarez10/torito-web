/* Catálogo de la tienda El Torito (rediseño aprobado por Ivan el 30 sep 2026).
   Viene de salida/prototipo/catalogo.js del Estudio UX, con UNA diferencia deliberada:
   este archivo NO descarga nada. La carga la sigue haciendo loadCatalog() de index.html,
   igual que antes: primero app_config.store_catalog (la nube, lo que edita /panel) y
   catalog.json solo de respaldo y para las fotos. Acá solo se ordena lo que llega.
   Escape propio (escHTML): no depende de esc() ni de pesc(), que difieren entre ramas. */
(function () {
  "use strict";

  // Medidas reales de cada foto: [ancho, alto, alto de la miniatura de 400]. Generado con PIL; rehacer si cambian las fotos.
  var MEDIDAS = {"asar-cerdo":[1000,670,268],"asar":[1000,670,268],"bacon":[1000,670,268],"bistec-cerdo":[1000,670,268],"bistec-res":[1000,670,268],"bolita":[1000,670,268],"cabeza-de-lomo":[1000,670,268],"camaron":[1000,670,268],"carne-salada":[1000,670,268],"chicken-finger":[1000,625,250],"chorizo-barbacoa":[1000,625,250],"chorizo-cervecero":[1000,625,250],"chorizo-criollo":[1000,625,250],"chorizo-indio":[1000,670,268],"chorizo-parrillero":[1000,625,250],"chorizo-suelto":[1000,625,250],"chuleta-ahumada":[1000,670,268],"chuleta-cerdo":[900,900,400],"corazon":[1000,670,268],"costilla-cerdo":[1000,670,268],"costilla-res":[1000,670,268],"cubos":[900,900,400],"entrana":[900,900,400],"estofado-cerdo":[1000,670,268],"fajitas-cerdo":[1000,670,268],"fajitas-res":[1000,670,268],"falda":[1000,670,268],"filete":[900,900,400],"higado":[1000,670,268],"hot-dog-de-pollo":[1000,625,250],"lengua":[1000,670,268],"lomo-cerdo":[900,900,400],"lomo-limpio":[1000,670,268],"mano-de-piedra":[1000,670,268],"manteca-de-cerdo":[1000,670,268],"medallones":[1000,625,250],"menudo":[1000,670,268],"milanesa":[1000,670,268],"molida-cerdo":[1000,670,268],"molida":[900,900,400],"mondongo":[900,900,400],"newyork":[1000,670,268],"papas-congeladas":[1000,670,268],"papas-sazonadas":[1000,670,268],"papas-tornillo":[1000,670,268],"patas-cerdo":[1000,670,268],"patas-pollo":[1000,670,268],"pechuga-ala":[1000,670,268],"pechuga":[900,900,400],"pechuguitas":[1000,625,250],"pierna-muslo":[1000,670,268],"pollo-entero":[900,900,400],"pollo-piezas":[1000,670,268],"pulmon":[1000,670,268],"puyaso":[1000,670,268],"ribeye":[1000,670,268],"tajo-negro":[1000,670,268],"tocino":[900,900,400],"vaso":[1000,670,268]};

  function escHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Mismo formato que el resto de la tienda: "L 1,250".
  function money(n) {
    return "L " + Math.round(n).toLocaleString("es-HN");
  }

  // {nombre_pedido} (04, contenido.md §3.8): en "Tu pedido", el aviso de agregado y el texto de
  // WhatsApp. Solo res/cerdo/pollo: si el nombre no trae la categoría, se agrega " de <categoría>".
  // ⚠️ SOLO para pantalla y WhatsApp. A submit-order se le manda SIEMPRE product.name: precios.ts
  // empareja el precio por NOMBRE y con "Bistec de res" la línea entraría en L 0.
  var CON_CATEGORIA = { res: 1, cerdo: 1, pollo: 1 };
  var NOMBRE_PEDIDO_ID = { "pollo-entero": "Pollo entero", "pollo-chicken-finger": null }; // null = sin cambio
  var etiquetas = {};
  function sinTildes(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function nombrePedido(p) {
    if (!p) return "";
    if (p.id in NOMBRE_PEDIDO_ID) return NOMBRE_PEDIDO_ID[p.id] || p.name;
    var et = etiquetas[p.cat];
    if (!CON_CATEGORIA[p.cat] || !et || sinTildes(p.name).indexOf(sinTildes(et)) !== -1) return p.name;
    return p.name + " de " + et.toLowerCase();
  }

  // d = el catálogo ya mezclado por loadCatalog() de index.html ({meta, categories, products},
  // con p.soldout marcado). Devuelve la forma que usan cart.js y tienda.js. No cambia ningún dato.
  function desde(d) {
    d = d || {};
    var products = (d.products || []).filter(function (p) { return p.active !== false; });
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });
    // Solo categorías con al menos un producto activo, en el orden del catálogo.
    var categories = (d.categories || []).filter(function (c) {
      return products.some(function (p) { return p.cat === c.id; });
    });
    (d.categories || []).forEach(function (c) { etiquetas[c.id] = c.label; });
    return { meta: d.meta || {}, categories: categories, products: products, byId: byId };
  }

  window.ToritoCatalogo = {
    desde: desde,
    escHTML: escHTML,
    money: money,
    nombrePedido: nombrePedido,
    // Atributos para <img>. modo "grilla" (por defecto): solo la miniatura de 400 px, sin srcset,
    // porque a 2 columnas un celular DPR 3 pediría la de 1000 y se pierde el ahorro.
    // modo "hoja": srcset 400w + original, el navegador elige según el ancho de la hoja de producto.
    // Una foto que no está en MEDIDAS (producto nuevo cargado desde el panel) usa la original:
    // así nunca queda un producto sin foto por no tener miniatura.
    imgProductoAttrs: function (p, modo, sizes) {
      if (!p || !p.img) return null;
      var base = "img/products/" + p.img, m = MEDIDAS[p.img];
      if (!m) return { src: base + ".webp", width: 1000, height: 670 };
      if (modo !== "hoja") return { src: base + "-400.webp", width: 400, height: m[2] };
      return {
        src: base + "-400.webp",
        srcset: base + "-400.webp 400w, " + base + ".webp " + m[0] + "w",
        sizes: sizes || "(min-width: 1024px) 440px, 100vw",
        width: m[0],
        height: m[1]
      };
    },
    productosDe: function (cat, catId) { return cat.products.filter(function (p) { return p.cat === catId; }); }
  };
})();
