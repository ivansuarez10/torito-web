#!/usr/bin/env python3
"""
Escribe dentro de index.html la lista de productos, leyéndola de donde la lee la
tienda: el catálogo del panel (Supabase) y, si no hay, catalog.json del repo.

POR QUÉ EXISTE
El catálogo lo pinta el JavaScript, así que el HTML que descarga Google (y quien
entra con señal mala) no traía NI UN nombre de producto. La solución NO es
escribir la lista a mano en el HTML: eso es duplicar a mano algo que ya existe,
y se desactualiza el día que cambie un corte.

Acá el HTML se GENERA. Una sola fuente, la misma que ve la clienta.

CUÁNDO CORRERLO
Después de cambiar el catálogo — en el panel o en catalog.json — y antes de
publicar. Si no se corre, el HTML queda con la lista anterior; la tienda sigue
bien (el JavaScript siempre lee lo vigente), lo único que envejece es lo que
lee el buscador.

QUÉ HACE EXACTAMENTE
Reemplaza lo que haya entre las marcas CATALOGO-SEO:INICIO y :FIN dentro de
index.html. Ese bloque vive dentro de #catalog, así que el JavaScript lo
sustituye por el catálogo interactivo apenas carga: la clienta nunca ve dos
catálogos, ve el mismo, primero quieto y después vivo.

SIN PRECIOS, A PROPÓSITO
Los precios cambian, y además el panel puede sobrescribirlos desde Supabase sin
tocar este archivo. Un precio viejo en el HTML es peor que ninguno: la clienta
llega esperando otra cosa. Van nombres y descripciones, que casi no cambian.

USO
    python3 build-catalogo.py            # regenera el bloque
    python3 build-catalogo.py --check    # NO escribe; devuelve 1 si está viejo

Correr después de tocar catalog.json, antes de commitear.
"""
import json
import re
import sys
import urllib.request
from html import escape
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
INDEX = RAIZ / "index.html"
CATALOGO = RAIZ / "catalog.json"

# Mismo par URL+clave pública que usa la tienda en el navegador. La clave publishable
# es pública por diseño (está a la vista en el HTML) y acá solo se LEE.
SUPA_URL = "https://dnyzokgmjuvbrcxxdatr.supabase.co"
SUPA_KEY = "sb_publishable_jO4pGdkTBporf_cndos9OA_K_8tVn3A"


def catalogo_vigente() -> tuple:
    """El catálogo que la clienta ve DE VERDAD, con la misma regla que loadCatalog().

    catalog.json del repo NO es la fuente de verdad: si el panel guardó un catálogo en
    Supabase (app_config key='store_catalog'), ESE reemplaza al del repo. Sin esta
    consulta, el HTML listaría productos que Ivan dio de baja desde el panel.
    Sin red se usa catalog.json y se avisa, para que nadie publique creyendo otra cosa.
    """
    local = json.loads(CATALOGO.read_text(encoding="utf-8"))
    url = f"{SUPA_URL}/rest/v1/app_config?select=value&key=eq.store_catalog"
    pedido = urllib.request.Request(url, headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"})
    try:
        with urllib.request.urlopen(pedido, timeout=12) as r:
            filas = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # sin red, o Supabase caído
        print(f"AVISO: no pude leer el catálogo del panel ({e}). Uso catalog.json del repo.", file=sys.stderr)
        return local, "catalog.json (repo)"
    nube = filas[0]["value"] if filas and filas[0].get("value", {}).get("products") else None
    if not nube:
        return local, "catalog.json (repo · el panel no tiene catálogo propio)"
    if not nube.get("categories"):
        nube["categories"] = local.get("categories", [])
    return nube, "panel (Supabase store_catalog)"

INICIO = "<!-- CATALOGO-SEO:INICIO · generado por build-catalogo.py · NO editar a mano -->"
FIN = "<!-- CATALOGO-SEO:FIN -->"


def construir_bloque(datos: dict) -> str:
    activos = [p for p in datos["products"] if p.get("active") is not False]
    partes = [INICIO, '    <div class="preload" id="preloadCat">']
    for cat in datos.get("categories", []):
        productos = [p for p in activos if p.get("cat") == cat["id"]]
        if not productos:
            continue
        nombre = cat.get("label") or cat.get("name") or cat["id"]
        partes.append(f'      <section><h2>{escape(nombre)}</h2><ul>')
        for p in productos:
            n = escape(str(p.get("name", "")).strip())
            d = escape(str(p.get("desc", "")).strip())
            partes.append(f"        <li><b>{n}</b>{' — ' + d if d else ''}</li>")
        partes.append("      </ul></section>")
    partes.append('      <p class="preload-n">Cargando precios y disponibilidad…</p>')
    partes.append("    </div>")
    partes.append("    " + FIN)
    return "\n".join(partes)


def main() -> int:
    datos, fuente = catalogo_vigente()
    html = INDEX.read_text(encoding="utf-8")
    bloque = construir_bloque(datos)

    patron = re.compile(re.escape(INICIO) + r".*?" + re.escape(FIN), re.S)
    if not patron.search(html):
        print("ERROR: no encontré las marcas CATALOGO-SEO en index.html.", file=sys.stderr)
        print("Sin ellas no sé dónde escribir; no toco nada.", file=sys.stderr)
        return 2

    nuevo = patron.sub(lambda _: bloque, html, count=1)
    n = len([p for p in datos["products"] if p.get("active") is not False])
    origen = f" · fuente: {fuente}"

    if "--check" in sys.argv:
        if nuevo == html:
            print(f"al día · {n} productos{origen}")
            return 0
        print("DESACTUALIZADO: catalog.json cambió y el bloque del HTML no.", file=sys.stderr)
        print("Corré: python3 build-catalogo.py", file=sys.stderr)
        return 1

    if nuevo == html:
        print(f"sin cambios · {n} productos{origen}")
        return 0
    INDEX.write_text(nuevo, encoding="utf-8")
    print(f"index.html actualizado · {n} productos en el HTML{origen}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
