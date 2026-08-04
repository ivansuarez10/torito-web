# Tienda Web El Torito — contexto de proyecto

Tienda en línea de la Carnicería El Torito. **Está en producción**: https://carniceriaeltorito.com

Actualizado: 1 ago 2026. Todo lo de aquí está verificado, no supuesto — al final se indica cómo.

## Deploy

- Repo: `ivansuarez10/torito-web`. **La carpeta local se llama `TiendaTorito`, no `torito-web`.**
- **Producción = rama `main` → GitHub Pages.** (Verificado por cabeceras: `server: GitHub.com`. El repo tiene `CNAME`.) **No es Netlify** — Netlify solo sirve el preview de `staging`, por eso conviven `CNAME` y `netlify.toml`.
- Cada push a `main` publica solo, en 1-3 minutos.
- ⚠️ `cache-control: max-age=600` → el HTML se cachea **10 minutos**. Para comprobar un cambio recién publicado hay que **agregar `?v=...` a la URL** o recargar fuerte. Sin eso se ve una versión vieja y parece que el cambio falló.

### `main` y `staging`: comprobar SIEMPRE antes de publicar

Divergen y se reconcilian según la temporada. **No asumir ninguno de los dos escenarios**:

```bash
git fetch origin && git log --oneline -1 origin/main origin/staging
```

- **Si están en el mismo commit:** publicar es un push directo (`git push origin staging` y `git push origin staging:main`).
- **Si divergen:** **cherry-pick del commit puntual sobre `main`. NUNCA merge.** Un merge arrastra a producción trabajo de staging que no debe salir todavía.

**Hay otra sesión trabajando en este repo en paralelo.** Durante una sola conversación del 1 ago, `origin/staging` avanzó tres veces. Por eso: `git fetch origin` antes de cada operación, y `git checkout -B main origin/main` para partir del tip más reciente. **Nunca `--force` ni `reset` sobre `main`.**

**Hay DOS clones completos del repo en disco** (`INDCAN/Torito SO/TiendaTorito` y `Capsula - Tienda Torito/02-CODIGO/TiendaTorito`), los dos en `staging`, a veces en commits distintos y con cambios sin commitear. Antes de editar, confirmar en cuál se está trabajando.

### Lo que está en `staging` a propósito y NO va a producción

La **intro de marca de la home** (el toro que se llena y se convierte en el logo del header). Está construida y funcionando en staging. **Ivan decidió el 1 ago dejarla ahí, sin publicar.** No arrastrarla a `main` por accidente — es la razón principal para usar cherry-pick en vez de push directo.

## Trampas que ya han roto producción

**`esc()` vs `pesc()`** — `staging` tiene la función `esc()`; **`main` NO la tiene, usa `pesc()`**. Código escrito y probado contra staging que llame `esc()` revienta en producción. Peor: si el error cae en un `.catch()` silencioso no aparece nada en consola y el fallo es invisible. En features nuevas no depender de ninguna de las dos — definir un escape propio inline.

**Un cherry-pick entre ramas divergentes puede conflictuar** aunque el cambio sea de una línea, porque el contexto difiere. Al resolver: verificar que la única diferencia entre ambos lados sea la que se quiere cambiar, antes de quedarse con uno.

## Marca

Identidad real: toro estilo Osborne, rojo `#9F2629` + negro, "DESDE 1970".

**Tipografía: Poppins para titulares, Helvetica para cuerpo y cifras.** Fue una decisión deliberada de Ivan en el commit `8e87b2c` ("Rediseño: negro sólido + charcoal + Helvetica"), que reemplazó `-apple-system` a propósito. **No señalarlo como inconsistencia ni "corregirlo" hacia SF Pro** — hay 18 declaraciones de Helvetica y cero de SF Pro, y la excepción está registrada en `.impeccable/config.json`.

Resto de la línea gráfica: sombras suaves, mucho espacio en blanco. **El rojo es acento, no fondo**; color con moderación. Íconos de línea, **sin emojis**. Assets en `~/Desktop/Proyectos/Torito/INDCAN/Carniceria/`.

## Funcionalidad en producción

- Catálogo desde `catalog.json` (con sobrescritura opcional desde `app_config` en Supabase). **Los precios cambian: no hardcodear ninguno.**
- Envío calculado por distancia: `max(50, round((50 + 9·km)/5)·5)` lempiras, tope 25 km. Mapa con pin arrastrable y autocompletado Photon acotado a Tegucigalpa.
- Checkout: el pedido sale por **dos vías a la vez** — Edge Function `submit-order` de Supabase (cae en **Comandas Torito**, `~/Desktop/Proyectos/Torito/INDCAN/ComandasTorito/`) y apertura de WhatsApp con el pedido escrito.
- **Pago en línea = Fase 2, no implementado.** No prometerlo ni insinuarlo en la interfaz.

## Contexto de producto

El contexto completo (quién compra, para qué existe la tienda, restricciones) está en `PRODUCT.md`, en esta misma carpeta. **La restricción que más manda:** el cliente típico usa un **Android de gama baja con datos limitados**, así que el peso de la página es una restricción de producto, no una preferencia estética.

## Cuidado

Es un sitio con clientes reales comprando. Verificar antes de tocar `main`, no después — el navegador está disponible para recorrer el flujo completo de compra.

---

**Cómo se verificó (1 ago 2026):** hosting por cabeceras HTTP de la URL en vivo; rutas comprobadas en disco; estado de ramas con `git log origin/main origin/staging`; tipografía contando declaraciones en `index.html`; despliegues confirmados con cache-bust contra el sitio real.
