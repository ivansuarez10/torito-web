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

### Hay DOS clones del repo en disco, y uno NO es para trabajar

- **`INDCAN/Torito SO/TiendaTorito` — este es el clon de trabajo.** Editar acá.
- **`Capsula - Tienda Torito/02-CODIGO/TiendaTorito` — es una copia de entrega.** La Cápsula es un paquete autosuficiente (generado el 31 jul 2026) que incluye los `.git` a propósito, para conservar historial y ramas. **No es un segundo puesto de trabajo: es un respaldo con fecha.**

**Por qué importa:** al 4 ago la copia de la Cápsula estaba 14 commits atrás, con un `submit-order` sin commitear y con un `CLAUDE.md` propio que afirmaba lo contrario de este ("Netlify publica producción desde `main`", que es falso). Un archivo suelto y duplicado no es documentación: es dos versiones de la verdad.

**Regla:** no editar dentro de la Cápsula. Para ponerla al día antes de entregarla:

```bash
git -C "…/Capsula - Tienda Torito/02-CODIGO/TiendaTorito" fetch origin && git -C "…/Capsula - Tienda Torito/02-CODIGO/TiendaTorito" reset --hard origin/staging
```

Antes de resetear, comprobar que no haya trabajo propio ahí (`git status`), porque el reset lo borra.

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

## Al cambiar el catálogo, correr `build-catalogo.py`

El catálogo lo pinta el JavaScript, así que el HTML que descarga un buscador no traía ni un nombre de producto. Dentro de `#catalog` hay ahora un bloque **generado** con la lista en texto, entre las marcas `CATALOGO-SEO:INICIO/FIN`. El JS lo reemplaza por el catálogo real al cargar; en una conexión lenta, es lo que la clienta lee mientras espera.

```bash
python3 build-catalogo.py          # regenera el bloque
python3 build-catalogo.py --check  # falla si quedó viejo
```

- **No editar ese bloque a mano**: se pisa en la siguiente corrida.
- El script **lee el catálogo del panel** (`app_config` key `store_catalog`) porque **ese reemplaza a `catalog.json` en producción**; solo cae al archivo del repo si no hay nube. Sin eso, el HTML lista productos que ya se dieron de baja desde el panel.
- Si no se corre, **la tienda sigue bien** (el JS siempre lee lo vigente); lo único que envejece es lo que lee el buscador.
- Va **sin precios a propósito**: cambian, y un precio viejo en el HTML es peor que ninguno.

## Contexto de producto

El contexto completo (quién compra, para qué existe la tienda, restricciones) está en `PRODUCT.md`, en esta misma carpeta. **La restricción que más manda:** el cliente típico usa un **Android de gama baja con datos limitados**, así que el peso de la página es una restricción de producto, no una preferencia estética.

## Cuidado

Es un sitio con clientes reales comprando. Verificar antes de tocar `main`, no después — el navegador está disponible para recorrer el flujo completo de compra.

---

**Cómo se verificó (1 ago 2026):** hosting por cabeceras HTTP de la URL en vivo; rutas comprobadas en disco; estado de ramas con `git log origin/main origin/staging`; tipografía contando declaraciones en `index.html`; despliegues confirmados con cache-bust contra el sitio real.
