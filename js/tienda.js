/* Tienda El Torito · catálogo, hoja de producto y "Tu pedido" (rediseño aprobado por Ivan
   el 30 sep 2026, APROBACIONES.md cambios 2 a 7). Viene de salida/prototipo/app.js del
   Estudio UX, conectado a la tienda real:
   - El catálogo lo carga index.html (loadCatalog: la nube primero) y lo deja en
     window.ToritoDatos (una promesa). Acá no se descarga nada.
   - "Seguir con mi pedido" abre el checkout de siempre (window.ToritoCheckout, en index.html).
   - La cuenta, el checkout, submit-order y WhatsApp siguen viviendo en index.html.
   Ganchos para el motion del 08 (js/motion.min.js): data-motion en card, card-foot, toast,
   orderbar-count, bag-count; evento document "torito:ui" (falta-corte, toast, sheet-open…);
   adaptador window.ToritoMotion.leave(el, kind, done). Sin motion.js todo funciona igual. */
(function () {
  "use strict";

  var C = window.ToritoCatalogo, K = window.ToritoCart;
  if (!C || !K) return;
  var esc = C.escHTML, money = C.money;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function ico(id, cls) { return '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function reducido() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }

  // Línea del tipo de precio por libra (04 §3.6): lo que se corta vs. lo que solo se pesa (papas, camarón…).
  var SE_CORTA = { res: 1, cerdo: 1, pollo: 1, visceras: 1 };
  var TOAST_MS = 2500;       // 04 §4.3 (la mecha del 08 dura lo mismo)
  // Línea bajo la cabecera + la barra de categorías (se mide: cambia con el notch y el ancho).
  function barLine() {
    var t = $(".topbar"), n = $("#catnav");
    return Math.round((t ? t.getBoundingClientRect().height : 64) + (n ? n.getBoundingClientRect().height : 60));
  }
  function medirCabecera() {
    var t = $(".topbar");
    if (t) document.documentElement.style.setProperty("--bar-h", Math.round(t.getBoundingClientRect().height) + "px");
  }

  var cat = null, listo = false;
  var CK = function () { return window.ToritoCheckout || null; };
  function track(accion, p, qty) { var c = CK(); if (c && c.track) try { c.track(accion, p, qty); } catch (e) {} }

  // ---------- Motion (08) ----------
  function ui(tipo, extra) {
    var d = extra || {}; d.tipo = tipo;
    try { document.dispatchEvent(new CustomEvent("torito:ui", { detail: d })); } catch (e) {}
  }
  function motionLeave(el, kind, done) {
    var M = window.ToritoMotion, hecho = false;
    function fin() { if (!hecho) { hecho = true; done(); } }
    if (M && M.sel) M.sel.scrim = "#pscrim"; // el velo de esta hoja (el .scrim de la cuenta es otro)
    if (M && M.leave) { try { M.leave(el, kind, fin); setTimeout(fin, 600); return; } catch (e) {} }
    fin();
  }

  // ---------- Formatos (04 §3.6) ----------
  function isQuote(p) { return !!p.quote || p.price == null; }
  function unitWord(p) { return p.unit === "paquete" ? "paquete" : "libra"; }
  function qtyText(p, q) {
    if (p.unit === "paquete") return q + (q === 1 ? " paquete" : " paquetes");
    var w = Math.floor(q), h = q % 1 ? "½" : "";
    return (w ? w : "") + h + (q <= 1 ? " libra" : " libras");
  }
  function hasCuts(p) { return !!(p.cuts && p.cuts.length); }
  var nomP = function (p) { return C.nombrePedido(p); }; // {nombre_pedido}: solo pantalla y WhatsApp
  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  // ---------- Fotos ----------
  function imgTag(a) {
    return '<img src="' + esc(a.src) + '"' + (a.srcset ? ' srcset="' + esc(a.srcset) + '" sizes="' + esc(a.sizes) + '"' : "") +
      ' width="' + a.width + '" height="' + a.height + '" alt="" decoding="async">';
  }
  function photo(p, big) {
    var cls = "ph" + (big ? " shot" : "");
    var a = C.imgProductoAttrs(p, big ? "hoja" : "grilla");
    if (!a) return '<div class="' + cls + ' none"><i class="bullmark"></i></div>';
    if (big) return '<div class="' + cls + '">' + imgTag(a) + '</div>';
    // Grilla: el <img> no entra al DOM hasta que la foto está cerca (ioImg). Con loading="lazy" solo,
    // Chrome pide todas las que estén a 1250-2500 px y el primer pantallazo cargaba 8-14 fotos.
    return '<div class="' + cls + '" data-img="' + esc(JSON.stringify(a)) + '"></div>';
  }
  var ioImg = null;
  function insertImg(ph) {
    var a = JSON.parse(ph.getAttribute("data-img"));
    ph.removeAttribute("data-img");
    ph.insertAdjacentHTML("afterbegin", imgTag(a));
  }
  function watchImgs(root) {
    var list = $$(".ph[data-img]", root);
    if (!("IntersectionObserver" in window)) { list.forEach(insertImg); return; }
    if (!ioImg) ioImg = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { ioImg.unobserve(e.target); insertImg(e.target); } });
    }, { rootMargin: "300px 0px" });
    list.forEach(function (ph) { ioImg.observe(ph); });
  }
  // Foto que no carga: queda el fondo gris con el toro en línea, sin texto (04 §4.2).
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "IMG" || el.classList.contains("fail")) return;
    var ph = el.closest(".ph");
    if (ph && (ph.closest("#secciones") || ph.closest("#psheet"))) { el.classList.add("fail"); ph.classList.add("none"); ph.insertAdjacentHTML("beforeend", '<i class="bullmark"></i>'); }
  }, true);

  // ---------- Tarjeta (04 §3.5) ----------
  function chip(p) {
    if (p.soldout) return '<span class="chip out">Agotado</span>';
    if (isQuote(p)) return '<span class="chip">A cotizar</span>';
    if (p.validate) return '<span class="chip">Se confirma el peso</span>';
    if (hasCuts(p)) return '<span class="chip">Elegí el corte</span>';
    if (p.unit === "paquete") return '<span class="chip">Paquete</span>';
    return "";
  }
  function priceBlock(p) {
    if (isQuote(p)) return '<p class="price q"><b>Precio al confirmar</b></p>';
    return '<p class="price">' + (p.validate ? '<span class="ax">aprox.</span>' : "") + '<b class="num">' + money(p.price) + '</b><span>/ ' + unitWord(p) + '</span></p>';
  }
  function footState(p) { return p.soldout ? "soldout" : (!hasCuts(p) && K.get(p.id) ? "stepper" : "add"); }
  function footBlock(p) {
    if (p.soldout) return '<p class="soldout">Agotado por hoy</p>';
    var l = !hasCuts(p) && K.get(p.id);
    if (l) {
      return '<div class="stepper"><button type="button" data-act="card-dec" aria-label="Menos"' + (l.canDec ? "" : " disabled") + '>' + ico("minus", "s") + '</button>' +
        '<output class="num" aria-live="polite">' + qtyText(p, l.qty) + '</output>' +
        '<button type="button" data-act="card-inc" aria-label="Más"' + (l.canInc ? "" : " disabled") + '>' + ico("plus", "s") + '</button></div>';
    }
    return '<button type="button" class="add" data-act="card-add" aria-label="Agregar ' + esc(p.name) + '">' + ico("plus", "s") + 'Agregar</button>';
  }
  function card(p) {
    return '<article class="card" data-motion="card" data-pid="' + esc(p.id) + '">' +
      '<a class="open" href="#cat-' + esc(p.cat) + '" data-act="open" aria-label="' + esc(p.name) + ', ver detalle">' + photo(p) +
      '<div class="bd"><h3 class="nm">' + esc(p.name) + '</h3>' + (p.desc ? '<p class="ds">' + esc(p.desc) + '</p>' : "") + chip(p) + '</div></a>' +
      priceBlock(p) + '<div class="foot" data-motion="card-foot" data-state="' + footState(p) + '">' + footBlock(p) + '</div></article>';
  }
  function refreshCard(id) {
    var p = cat.byId[id]; if (!p) return;
    var st = footState(p), html = footBlock(p);
    // La misma tarjeta puede estar en su categoría y en los resultados de búsqueda.
    $$('.card[data-pid="' + id + '"] .foot').forEach(function (el) {
      el.innerHTML = html;
      if (el.getAttribute("data-state") !== st) { el.setAttribute("data-state", st); ui("card", { el: el.parentNode, id: id, state: st }); }
    });
  }

  // ---------- Secciones: se pintan al acercarse ----------
  function productsOf(c) { return C.productosDe(cat, c.id); }
  function renderShell() {
    $("#secciones").innerHTML = '<div id="busqueda" hidden></div>' + cat.categories.map(function (c) {
      var list = productsOf(c);
      var lb = list.filter(function (p) { return p.unit === "libra" && !isQuote(p); }).map(function (p) { return p.price; });
      var desde = lb.length ? ' · desde <b class="num">' + money(Math.min.apply(null, lb)) + '</b> / libra' : "";
      return '<section class="sec" id="cat-' + esc(c.id) + '" aria-labelledby="h-' + esc(c.id) + '"><h2 class="display" id="h-' + esc(c.id) + '">' + esc(c.label) +
        '</h2><p class="tag">' + esc(c.tagline || "") + desde + '</p><div class="grid" data-pend style="--rows:' + Math.ceil(list.length / 2) + '"></div></section>';
    }).join("");
  }
  function paintSection(sec) {
    var grid = $(".grid", sec);
    if (!grid || !grid.hasAttribute("data-pend")) return;
    var c = cat.categories.filter(function (x) { return "cat-" + x.id === sec.id; })[0];
    if (!c) return;
    grid.innerHTML = productsOf(c).map(card).join("");
    grid.removeAttribute("data-pend");
    watchImgs(grid);
    grid.style.removeProperty("--rows");
    // Con la primera sección pintada se mide el alto real de una fila para reservar el de las demás.
    if (!document.documentElement.style.getPropertyValue("--row-h")) {
      var first = grid.firstElementChild;
      if (first) document.documentElement.style.setProperty("--row-h", (first.offsetHeight + 12) + "px");
    }
  }
  function paintAll() { $$("#secciones .sec").forEach(paintSection); }
  var ioSec = null;
  function watchSections() {
    if (!("IntersectionObserver" in window)) { paintAll(); return; }
    ioSec = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { paintSection(e.target); ioSec.unobserve(e.target); } });
    }, { rootMargin: "600px 0px 600px 0px" });
    $$("#secciones .sec").forEach(function (s) { ioSec.observe(s); });
  }
  // Pinta la sección de destino y las de arriba, así el alto de lo anterior ya es el real y el salto no se corre.
  function paintUpTo(sec) {
    var all = $$("#secciones > .sec");
    for (var i = 0; i < all.length; i++) { paintSection(all[i]); if (all[i] === sec) break; }
  }

  // ---------- Pastillas de categoría ----------
  function renderPills() {
    $("#pills").insertAdjacentHTML("beforeend", cat.categories.map(function (c, i) {
      return '<a class="pill" href="#cat-' + esc(c.id) + '"' + (i === 0 ? ' aria-current="true"' : "") + '>' + esc(c.label) + '</a>';
    }).join(""));
  }
  // Saltar a una categoría (pastillas y banners de la agencia): se pinta antes de que el navegador haga el salto.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#cat-"]:not([data-act])');
    if (!a || !cat) return;
    var sec = document.getElementById(a.getAttribute("href").slice(1));
    if (sec) { paintUpTo(sec); if (searching) closeSearch(); }
  });
  var ioP = null;
  function watchPills() {
    if (!("IntersectionObserver" in window)) return;
    if (ioP) ioP.disconnect();
    ioP = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$("#pills .pill").forEach(function (p) {
          var on = p.getAttribute("href") === "#" + e.target.id;
          p.setAttribute("aria-current", on ? "true" : "false");
          // La pastilla activa se mantiene a la vista en la fila que se desliza.
          if (on) {
            var row = $("#pills"), l = p.offsetLeft - row.offsetLeft;
            if (l < row.scrollLeft || l + p.offsetWidth > row.scrollLeft + row.clientWidth) {
              try { row.scrollTo({ left: l - 60, behavior: reducido() ? "auto" : "smooth" }); } catch (x) { row.scrollLeft = l - 60; }
            }
          }
        });
      });
    }, { rootMargin: "-" + barLine() + "px 0px -" + Math.max(0, window.innerHeight - barLine() - 1) + "px 0px" });
    $$("#secciones > .sec").forEach(function (el) { ioP.observe(el); });
  }

  // ---------- Buscador (04 §3.4, §4.5) ----------
  var searching = false;
  function openSearch() {
    searching = true;
    $("#catnav").classList.add("searching");
    $("#sInput").focus();
  }
  function closeSearch() {
    searching = false;
    $("#sInput").value = "";
    var d = $("#dInput"); if (d) d.value = "";
    $("#catnav").classList.remove("searching");
    applySearch();
  }
  // Busca sin tildes en nombre, descripción y categoría. Los resultados van en una sola grilla
  // (#busqueda) con su conteo, y las secciones se ocultan mientras hay texto.
  function applySearch() {
    var raw = searchValue(), q = norm(raw), box = $("#busqueda"), secs = $("#secciones");
    if (!box || !cat) return;
    if (!q) { secs.classList.remove("buscando"); box.hidden = true; box.innerHTML = ""; return; }
    var label = {}; cat.categories.forEach(function (c) { label[c.id] = c.label; });
    var res = cat.products.filter(function (p) { return norm(p.name + " " + (p.desc || "") + " " + label[p.cat]).indexOf(q) !== -1; });
    box.innerHTML = res.length
      ? '<section class="sec" id="resultados" aria-labelledby="resCount"><p class="tag" id="resCount" role="status">' + plural(res.length, "producto", "productos") + ' con «' + esc(raw) + '»</p><div class="grid">' + res.map(card).join("") + '</div></section>'
      : '<div class="blank" role="status">' + ico("search") + '<p>No encontramos «' + esc(raw) + '». Probá con otra palabra, como res, pollo o chorizo.</p></div>';
    box.hidden = false;
    secs.classList.add("buscando");
    watchImgs(box);
  }
  var searchT = null, lastInput = null;
  // Celular: #sInput (en la barra de categorías). Escritorio: #dInput (en la cabecera). Manda el último que se usó.
  function searchValue() { return ((lastInput && lastInput.value) || "").trim(); }
  function onSearchInput(e) {
    lastInput = e.target;
    searching = true;
    clearTimeout(searchT);
    searchT = setTimeout(function () {
      applySearch();
      // Los resultados arrancan justo debajo de la barra del buscador.
      var top = $("#secciones").getBoundingClientRect().top + window.pageYOffset - barLine();
      if (window.pageYOffset > top + 1 || window.pageYOffset < top - 1) window.scrollTo(0, Math.max(0, top));
    }, 120);
  }

  // ---------- Barra "Ver mi pedido" y el carrito de la cabecera (04 §3.7) ----------
  function approx() { var f = K.flags(); return f.validate || f.quote; }
  function checkoutAbierto() { var s = document.getElementById("sheet"); return !!(s && s.classList.contains("open")); }
  var lastCount = 0;
  function renderBar() {
    var n = K.count(), bar = $("#orderbar"), bc = $("#cartCount"), prev = lastCount;
    lastCount = n;
    if (bc) bc.textContent = n;
    if (!bar) return;
    bar.hidden = !n || sheetOpen || checkoutAbierto();
    if (!n || !listo) return;
    var t = K.subtotal(), ax = approx();
    bar.setAttribute("aria-label", "Ver mi pedido: " + plural(n, "producto", "productos") + ", " + (ax ? "aprox. " : "") + money(t));
    bar.innerHTML = '<span class="count num" data-motion="orderbar-count" aria-hidden="true">' + n + '</span><span class="t" aria-hidden="true">Ver mi pedido</span><span class="v num" aria-hidden="true">' + (ax ? "<small>aprox.</small>" : "") + money(t) + '</span>' + ico("right", "s");
    if (n !== prev) ui("bar", { el: bar, count: n, prev: prev });
  }

  // ---------- Aviso "Agregaste…" con Deshacer (04 §4.3) ----------
  var toastT = null, undoFn = null, toastGen = 0;
  function toast(html, undo) {
    var el = $("#toast");
    undoFn = undo || null;
    toastGen++;
    el.innerHTML = ico("check") + '<p>' + html + '</p>' + (undo ? '<button type="button" data-act="undo">Deshacer</button>' : "");
    el.hidden = false;
    ui("toast", { el: el });
    armToast();
  }
  function armToast() {
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      var el = $("#toast");
      // Si el foco está en "Deshacer" o el dedo/cursor encima, se espera.
      if (el.contains(document.activeElement) || el.matches(":hover")) { armToast(); return; }
      undoFn = null;
      var g = toastGen;
      // Si llega otro aviso mientras este sale, el 08 cancela la salida: no se oculta el nuevo.
      motionLeave(el, "toast", function () { if (g !== toastGen) return; el.hidden = true; ui("toast-hide", { el: el }); });
    }, TOAST_MS);
  }
  function added(line, prevQty, qtyAdded) {
    var p = line.product;
    track("add", p, qtyAdded);
    toast("Agregaste " + esc(qtyText(p, qtyAdded)) + " de " + esc(nomP(p)) + (line.cut ? ", " + esc(line.cut.toLowerCase()) : "") + ".", function () {
      if (prevQty > 0) K.setQty(line.key, prevQty); else K.remove(line.key);
      toast("Listo, lo quitamos.");
    });
  }
  function addFromCard(id) {
    var p = cat.byId[id];
    if (hasCuts(p)) { openProduct(id); return; }
    var prev = K.qtyOf(id), r = K.add(id);
    if (r.ok) added(r.line, prev, r.line.qty - prev);
  }

  // ---------- Hojas: producto y "Tu pedido" ----------
  var sheetOpen = false, lastFocus = null, afterClose = null, sheetGen = 0;
  function openSheet(html, focusSel, kind) {
    var sheet = $("#psheet"), wasOpen = sheetOpen;
    sheetGen++;
    sheet.className = "psheet " + (kind || "order");
    if (!wasOpen) lastFocus = document.activeElement;
    sheet.innerHTML = html;
    sheet.hidden = $("#pscrim").hidden = false;
    sheetOpen = true;
    document.documentElement.classList.add("lock");
    $("#toast").hidden = true;
    renderBar();
    // En Android, "atrás" cierra la hoja en vez de salir de la tienda.
    if (!wasOpen) try { history.pushState({ hoja: 1 }, ""); } catch (e) {}
    if (!wasOpen) ui("sheet-open", { el: sheet });
    var f = focusSel && $(focusSel, sheet);
    (f || $("#sheetTitleP", sheet) || sheet).focus({ preventScroll: true });
    sheet.scrollTop = 0;
  }
  function closeSheet(then) {
    if (!sheetOpen) { if (then) then(); return; }
    afterClose = then || null;
    if (history.state && history.state.hoja) history.back(); else hideSheet();
  }
  function hideSheet() {
    sheetOpen = false;
    var g = sheetGen;
    // Si se reabre una hoja mientras la anterior sale, no se oculta la nueva.
    motionLeave($("#psheet"), "sheet", function () { if (g === sheetGen) hideSheetNow(); });
  }
  function hideSheetNow() {
    $("#psheet").hidden = $("#pscrim").hidden = true;
    $("#psheet").innerHTML = "";
    sheetOpen = false;
    document.documentElement.classList.remove("lock");
    renderBar();
    ui("sheet-close", { el: $("#psheet") });
    var fn = afterClose; afterClose = null;
    if (fn) fn();
    // Después de Agregar/Actualizar/Quitar, el foco vuelve a la tarjeta de origen (QA I-10).
    // Si lo que siguió fue el checkout, el foco ya es de él.
    var a = document.activeElement;
    if (!checkoutAbierto() && (!a || a === document.body || $("#psheet").contains(a))) restoreFocus(!!fn);
    sheetOrigin = null;
  }
  var sheetOrigin = null; // id del producto cuya hoja está abierta
  function visible(el) { return el && document.contains(el) && el.offsetParent !== null; }
  function restoreFocus(trasAccion) {
    if (sheetOrigin) {
      var c = $$('.card[data-pid="' + sheetOrigin + '"]').filter(visible)[0];
      if (c) {
        var t = [trasAccion ? null : lastFocus, $('[data-act="card-inc"]', c), $('[data-act="card-dec"]', c), $('[data-act="card-add"]', c), $(".open", c)]
          .filter(function (x) { return x && visible(x) && !x.disabled && c.contains(x); })[0];
        if (t) { t.focus({ preventScroll: true }); return; }
      }
    }
    var dest = visible(lastFocus) ? lastFocus : ($("#orderbar").hidden ? $("#openCart") : $("#orderbar"));
    if (dest) dest.focus({ preventScroll: true });
  }
  window.addEventListener("popstate", function () { if (sheetOpen) hideSheet(); });

  // Hoja de producto (04 §3.6). fixKey: línea "sin corte" (carrito viejo o pedido repetido) que se completa aquí.
  var ps = null; // estado de la hoja: {p, qty, cut, error, fix}
  function openProduct(id, fixKey) {
    var p = cat.byId[id];
    var fx = fixKey ? K.get(fixKey) : null;
    var l = hasCuts(p) ? null : K.get(id);
    ps = { p: p, qty: fx ? fx.qty : (l ? l.qty : K.rules(id).def), cut: null, error: false, fix: fx ? fixKey : null };
    openSheet(productHTML(), ".close", "prod");
    sheetOrigin = id;
  }
  function currentLine() {
    if (ps.fix) return null; // completar un corte siempre suma una línea (o a la de ese corte)
    return hasCuts(ps.p) ? (ps.cut ? K.get(ps.p.id + "|" + ps.cut) : null) : K.get(ps.p.id);
  }
  function productHTML() {
    var p = ps.p, r = K.rules(p.id), qty = ps.qty, l = currentLine();
    var cuts = hasCuts(p) ? '<div class="blk' + (ps.error ? " err" : "") + '" id="blkCut"><h4 id="hCut">¿Cómo lo cortamos?</h4><div class="cuts" role="group" aria-labelledby="hCut">' +
      p.cuts.map(function (c) { return '<button type="button" class="cut" data-act="cut" data-cut="' + esc(c) + '" aria-pressed="' + (ps.cut === c) + '">' + esc(c) + '</button>'; }).join("") + '</div>' +
      (ps.error ? '<p class="errmsg" id="errCut" role="alert">' + ico("alert", "s") + 'Elegí cómo lo querés cortado.</p>' : "") + '</div>' : "";
    var quick = p.unit === "libra" ? '<div class="quick">' + [0.5, 1, 2, 3].map(function (q) {
      return '<button type="button" data-act="quick" data-q="' + q + '" aria-pressed="' + (q === qty) + '">' + qtyText(p, q) + '</button>'; }).join("") + '</div>' : "";
    var line = isQuote(p) ? ["chat", "El precio cambia según la pieza. Te lo confirmamos por WhatsApp antes de que pagués."]
      : p.unit === "paquete" ? ["pkg", "Se vende por paquete cerrado."]
      : p.validate ? ["scale", "Se pesa al prepararlo. El precio es aproximado: te confirmamos el total por WhatsApp antes de que pagués."]
      : SE_CORTA[p.cat] ? ["scale", "Lo cortamos al peso que pedís. El precio es exacto."]
      : ["scale", "Te pesamos la cantidad que pedís. El precio es exacto."];
    var warn = "";
    if (qty >= r.hardCap) warn = '<p class="note warn">' + ico("alert") + '<span>Para más de ' + r.hardCap + ' ' + unitWord(p) + 's, escribinos por WhatsApp y lo coordinamos.</span></p>';
    else if (qty > r.maxNormal) warn = '<p class="note warn">' + ico("alert") + '<span>Más de ' + r.maxNormal + ' ' + unitWord(p) + 's va sujeto a disponibilidad. Te confirmamos por WhatsApp si lo tenemos.</span></p>';
    var total = isQuote(p) ? "" : money(p.price * qty);
    var verb = l ? "Actualizar" : "Agregar";
    var btn = isQuote(p) ? (l ? "Actualizar" : "Agregar al pedido") : verb + " · " + (p.validate ? "aprox. " : "") + '<span class="num">' + total + '</span>';
    return '<div class="grab"></div><div class="over"><button type="button" class="close" data-act="close" aria-label="Cerrar">' + ico("x") + '</button></div>' + photo(p, true) +
      '<h3 id="sheetTitleP" class="display" tabindex="-1">' + esc(p.name) + '</h3>' +
      '<p class="unitp">' + (isQuote(p) ? "<b>Precio al confirmar</b>" : (p.validate ? "aprox. " : "") + '<b class="num">' + money(p.price) + '</b> / ' + unitWord(p)) + '</p>' +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : "") +
      (p.soldout ? '<p class="soldout">Agotado por hoy</p>' : cuts +
      '<div class="blk"><h4 id="hQty">¿Cuánto querés?</h4>' + quick +
      '<div class="qty" role="group" aria-labelledby="hQty"><button type="button" data-act="sdec" aria-label="Menos"' + (qty <= r.min ? " disabled" : "") + '>' + ico("minus") + '</button>' +
      '<output class="num" aria-live="polite">' + qtyText(p, qty) + '</output>' +
      '<button type="button" data-act="sinc" aria-label="Más"' + (qty >= r.hardCap ? " disabled" : "") + '>' + ico("plus") + '</button></div></div>' +
      warn +
      '<p class="note">' + ico(line[0]) + '<span>' + line[1] + '</span></p>' +
      '<button type="button" class="cta" data-act="sadd">' + btn + '</button>' +
      (l ? '<div class="sec-link"><button type="button" class="link" data-act="srm">Quitar del pedido</button></div>' : ""));
  }
  function rerenderProduct(focusAct) {
    var sheet = $("#psheet"), st = sheet.scrollTop;
    sheet.innerHTML = productHTML();
    sheet.scrollTop = st;
    var f = focusAct && $('[data-act="' + focusAct.act + '"]' + (focusAct.extra || ""), sheet);
    if (f && !f.disabled) f.focus({ preventScroll: true });
  }
  function setSheetQty(q, focus) { ps.qty = K.clampQty(ps.p.id, q); rerenderProduct(focus); }
  function sheetAdd() {
    var p = ps.p;
    if (hasCuts(p) && !ps.cut) {
      // APROBACIONES cambio 3 · aviso "A · Sacudida": solo se sacude la fila de cortes (motion del 08),
      // borde fino en los chips, texto "Elegí cómo lo querés cortado." y foco en el primer corte.
      ps.error = true; rerenderProduct();
      var first = $("#blkCut .cut");
      if (first) {
        first.focus({ preventScroll: true });
        // Con "Reducir movimiento" el desplazamiento es instantáneo (INFO del QA sobre app.js:451).
        try { $("#blkCut").scrollIntoView({ block: "center", behavior: reducido() ? "auto" : "smooth" }); } catch (e) {}
      }
      ui("falta-corte", { el: $("#blkCut") });
      return;
    }
    var l = currentLine();
    if (l) {
      var prev = l.qty, nl = K.setQty(l.key, ps.qty);
      if (ps.qty > prev) track("add", p, ps.qty - prev);
      closeSheet(function () {
        toast("Agregaste " + esc(qtyText(p, nl.qty)) + " de " + esc(nomP(p)) + (nl.cut ? ", " + esc(nl.cut.toLowerCase()) : "") + ".", function () { K.setQty(nl.key, prev); toast("Listo, lo quitamos."); });
      });
      return;
    }
    var fix = ps.fix, prevQ = ps.cut ? (K.get(p.id + "|" + ps.cut) || { qty: 0 }).qty : 0;
    var r = K.add(p.id, ps.qty, { cut: ps.cut });
    if (!r.ok) return;
    if (fix) { K.remove(fix); closeSheet(function () { openOrder(); }); track("add", p, ps.qty); return; }
    closeSheet(function () { added(r.line, prevQ, r.line.qty - prevQ); });
  }

  // "Tu pedido" (04 §3.8)
  function openOrder() {
    if (!listo) return;
    sheetOrigin = null;
    if (sheetOpen) { $("#psheet").className = "psheet order"; $("#psheet").innerHTML = orderHTML(); var t = $("#sheetTitleP"); if (t) t.focus({ preventScroll: true }); return; }
    openSheet(orderHTML(), ".close");
  }
  function orderHTML() {
    var head = '<div class="grab"></div><div class="sheet-top"><h3 id="sheetTitleP" class="display" tabindex="-1">Tu pedido</h3><button type="button" class="close" data-act="close" aria-label="Cerrar">' + ico("x") + '</button></div>';
    var ls = K.lines();
    if (!ls.length) {
      var c = CK(), n = c && c.ultimo ? c.ultimo() : 0;
      return head + '<div class="empty"><i class="bullmark"></i><b>Tu pedido está vacío.</b><p>Elegí tus cortes y aparecen aquí.</p>' +
        '<button type="button" class="cta" data-act="goto-cortes">Ver los cortes</button>' +
        (n ? '<div class="sec-link"><button type="button" class="link" data-act="repetir">Repetir mi último pedido (' + n + ')</button></div>' : "") + '</div>';
    }
    var lines = ls.map(function (l) {
      var p = l.product;
      var a = C.imgProductoAttrs(p);
      var th = a ? '<img src="' + esc(a.src) + '" alt="" width="56" height="56">' : "";
      var meta = qtyText(p, l.qty) + (l.cut ? " · " + esc(l.cut) : "");
      var pr = l.quote ? "A cotizar" : money(l.total);
      var ctl;
      if (l.soldout) ctl = '<p class="out">' + esc(nomP(p)) + ' se acabó por hoy. Quitalo para seguir con tu pedido.<button type="button" class="rm" data-act="rm" data-key="' + esc(l.key) + '">Quitar</button></p>';
      else if (l.needCut) ctl = '<p class="out">Falta elegir cómo lo cortamos.<button type="button" class="rm" data-act="fixcut" data-key="' + esc(l.key) + '">Elegir corte</button></p>';
      else ctl = '<div class="ctl"><div class="stepper"><button type="button" data-act="dec" data-key="' + esc(l.key) + '" aria-label="Menos"' + (l.canDec ? "" : " disabled") + '>' + ico("minus", "s") + '</button>' +
          '<output class="num" aria-live="polite">' + qtyText(p, l.qty) + '</output>' +
          '<button type="button" data-act="inc" data-key="' + esc(l.key) + '" aria-label="Más"' + (l.canInc ? "" : " disabled") + '>' + ico("plus", "s") + '</button></div>' +
          '<button type="button" class="rm" data-act="rm" data-key="' + esc(l.key) + '" aria-label="Quitar ' + esc(nomP(p)) + '">Quitar</button></div>';
      return '<li class="line' + (l.soldout ? " soldout-line" : "") + '"><span class="th">' + th + '</span><div><b>' + esc(nomP(p)) + '</b><small>' + meta + '</small>' +
        (l.big ? '<small class="warn">Sujeto a disponibilidad</small>' : "") +
        '</div><div class="r"><b class="num">' + pr + '</b>' + (l.validate ? '<small>aprox. · se confirma el peso</small>' : "") + '</div>' + ctl + '</li>';
    }).join("");
    var ax = approx(), f = K.flags(), blocked = f.soldout || f.needCut;
    return head + '<ul class="lines">' + lines + '</ul>' +
      '<div class="sum"><div class="tot"><span>Productos</span><b class="num">' + (ax ? "<small>aprox.</small>" : "") + money(K.subtotal()) + '</b></div>' +
      '<div class="muted">' + ico("gps", "s") + '<span>Envío: se calcula con tu ubicación en el siguiente paso.</span></div>' +
      '<div class="muted">' + ico("store", "s") + '<span>Si retirás en el local: sin costo de envío.</span></div></div>' +
      '<button type="button" class="cta" data-act="seguir"' + (blocked ? " disabled" : "") + '>Seguir con mi pedido</button>' +
      '<div class="sec-link"><button type="button" class="link" data-act="close">Seguir comprando</button></div>' +
      '<p class="note">' + ico("cash") + '<span>En la página no se paga nada. Te confirmamos el total por WhatsApp y ahí acordamos el pago.</span></p>';
  }
  function rerenderOrder(focusKey, act) {
    var sheet = $("#psheet"), st = sheet.scrollTop;
    sheet.innerHTML = orderHTML();
    sheet.scrollTop = st;
    var f = focusKey && $('[data-act="' + act + '"][data-key="' + focusKey + '"]', sheet);
    if (f && !f.disabled) f.focus({ preventScroll: true });
    else if (act === "rm") ($(".line .rm", sheet) || $("#sheetTitleP", sheet)).focus({ preventScroll: true });
  }
  function irAlCatalogo() {
    var t = document.getElementById("catalogo");
    if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.pageYOffset - ($(".topbar") ? $(".topbar").offsetHeight : 0)));
  }

  // ---------- Acciones (un solo manejador) ----------
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-act]");
    if (!b || b.disabled || !listo) return;
    if (!b.closest("#secciones, #psheet, #toast")) return;
    var act = b.getAttribute("data-act"), cardEl = b.closest(".card"), id = cardEl && cardEl.getAttribute("data-pid"), key = b.getAttribute("data-key");
    switch (act) {
      case "open": e.preventDefault(); openProduct(id); break;
      case "card-add": addFromCard(id); break;
      case "card-inc": var li = K.get(id), pq = li ? li.qty : 0, ni = K.inc(id); if (ni && ni.qty > pq) track("add", ni.product, ni.qty - pq); focusCard(id, "card-inc"); break;
      case "card-dec": K.dec(id); focusCard(id, "card-dec"); break;
      case "undo": if (undoFn) undoFn(); break;
      case "close": closeSheet(); break;
      case "cut": ps.cut = b.getAttribute("data-cut"); ps.error = false;
        var l = currentLine(); if (l) ps.qty = l.qty;
        rerenderProduct({ act: "cut", extra: '[data-cut="' + ps.cut.replace(/"/g, '\\"') + '"]' }); break;
      case "quick": setSheetQty(Number(b.getAttribute("data-q")), { act: "quick", extra: '[data-q="' + b.getAttribute("data-q") + '"]' }); break;
      case "sinc": setSheetQty(ps.qty + K.rules(ps.p.id).step, { act: "sinc" }); break;
      case "sdec": setSheetQty(ps.qty - K.rules(ps.p.id).step, { act: "sdec" }); break;
      case "sadd": sheetAdd(); break;
      case "srm": var cl = currentLine(); if (cl) K.remove(cl.key); closeSheet(function () { toast("Listo, lo quitamos."); }); break;
      case "inc": K.inc(key); rerenderOrder(key, "inc"); break;
      case "dec": K.dec(key); rerenderOrder(key, "dec"); break;
      case "rm": K.remove(key); rerenderOrder(null, "rm"); break;
      case "fixcut": var fl = K.get(key); if (fl) { sheetOrigin = fl.id; ps = null; var pp = cat.byId[fl.id]; ps = { p: pp, qty: fl.qty, cut: null, error: false, fix: key }; $("#psheet").className = "psheet prod"; $("#psheet").innerHTML = productHTML(); $("#psheet").scrollTop = 0; var cx = $(".close", $("#psheet")); if (cx) cx.focus({ preventScroll: true }); } break;
      case "seguir": closeSheet(function () { var c = CK(); if (c && c.abrir) c.abrir(); }); break;
      case "repetir": closeSheet(function () { var c = CK(); if (c && c.repetir) c.repetir(); }); break;
      case "goto-cortes": closeSheet(irAlCatalogo); break;
    }
  });
  function focusCard(id, act) {
    var cards = $$('.card[data-pid="' + id + '"]').filter(function (c) { return c.offsetParent !== null; });
    var c = cards[0]; if (!c) return;
    var f = $('[data-act="' + act + '"]', c);
    if (f && !f.disabled) f.focus({ preventScroll: true });
    else { var o = $(".foot output", c); if (o) { o.setAttribute("tabindex", "-1"); o.focus({ preventScroll: true }); } }
  }
  // El aviso se pausa con el dedo, el cursor o el foco encima (y la mecha del 08 también): al soltar, se re-arma.
  $("#toast").addEventListener("mouseleave", function () { if (!this.hidden) armToast(); });
  $("#toast").addEventListener("focusout", function (e) { if (!this.hidden && !this.contains(e.relatedTarget)) armToast(); });
  $("#openCart").addEventListener("click", function (e) { e.preventDefault(); openOrder(); });
  $("#orderbar").addEventListener("click", function (e) { e.preventDefault(); openOrder(); });
  $("#pscrim").addEventListener("click", function () { closeSheet(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (sheetOpen) closeSheet(); else if (searching) closeSearch(); }
    // Foco atrapado dentro de la hoja abierta.
    if (e.key === "Tab" && sheetOpen) {
      var f = $$('#psheet button:not([disabled]), #psheet a[href], #psheet [tabindex="-1"]').filter(function (x) { return x.offsetParent !== null && x.tabIndex >= 0; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $$(".js-sopen").forEach(function (b) { b.addEventListener("click", openSearch); });
  $("#sClose").addEventListener("click", closeSearch);
  $("#sInput").addEventListener("input", onSearchInput);
  if ($("#dInput")) $("#dInput").addEventListener("input", onSearchInput);

  // Cambios del pedido -> tarjetas, barra y (si está abierta) la hoja de pedido.
  K.on(function (d) {
    renderBar();
    if (d.tipo === "init" || d.tipo === "sync" || d.tipo === "clear") $$("#secciones .card").forEach(function (c) { refreshCard(c.getAttribute("data-pid")); });
    else if (d.detalle && d.detalle.id) refreshCard(d.detalle.id);
    if (d.tipo === "sync" && sheetOpen && $(".lines", $("#psheet"))) rerenderOrder();
  });

  // ---------- Carga (04 §4.2) ----------
  // Mientras tanto se ve el catálogo en texto (CATALOGO-SEO, lo escribe build-catalogo.py).
  var slowT = setTimeout(function () { var p = $("#secciones .preload-n"); if (p) p.textContent = "La señal está lenta. Ya casi."; }, 4000);
  function blank(icon, html) {
    $("#secciones").innerHTML = '<div class="blank" role="status">' + ico(icon) + html +
      '<button type="button" class="cta" id="retry">' + ico("refresh", "s") + 'Probar de nuevo</button></div>';
    $("#retry").addEventListener("click", function () { location.reload(); });
  }
  function fallo() {
    clearTimeout(slowT);
    if (navigator.onLine === false) blank("wifi-off", "<b>No hay señal.</b><p>Cuando vuelva, tocá <b>Probar de nuevo</b>.</p>");
    else blank("alert", "<b>No pudimos cargar los precios.</b>");
  }
  function start() {
    medirCabecera();
    var datos = window.ToritoDatos;
    if (!datos || !datos.then) { fallo(); return; }
    datos.then(function (d) {
      if (!d || !d.products) throw new Error("catálogo vacío");
      clearTimeout(slowT);
      cat = C.desde(d);
      K.init(cat);
      listo = true;
      renderPills();
      renderShell();
      watchSections();
      watchPills();
      renderBar();
      window.addEventListener("resize", function () { medirCabecera(); watchPills(); });
      // Enlace directo a una categoría (#cat-res): se pinta y se salta.
      var h = location.hash && document.getElementById(location.hash.slice(1));
      if (h && h.classList.contains("sec")) { paintUpTo(h); h.scrollIntoView(); }
      try { document.dispatchEvent(new CustomEvent("torito:listo")); } catch (e) {}
    }).catch(fallo);
  }

  // Lo que usa index.html (cuenta, checkout, "Repetir mi pedido").
  window.ToritoTienda = {
    listo: function () { return listo; },
    abrirPedido: function () { openOrder(); },
    aviso: function (txt) { toast(esc(txt)); },
    barra: function () { renderBar(); },
    nombrePedido: nomP
  };
  start();
})();
