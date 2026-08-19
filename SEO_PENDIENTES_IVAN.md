# SEO · lo que falta y solo lo podés hacer vos

Lo del código ya está hecho y publicado (commit `5edea05`): ficha del negocio en
JSON-LD, `robots.txt`, `sitemap.xml`, `canonical`, y el bloque "Qué cortamos" que
mete los nombres de los cortes dentro del HTML.

Quedan dos cosas que exigen entrar con **tu** cuenta de Google y verificar
identidad del negocio. No son técnicas: son de titularidad.

---

## 1 · Perfil de Google Business (lo que más rinde)

Es la ficha que sale en Google Maps y a la derecha en el buscador. Para
"carnicería cerca de mí" en Tegucigalpa **pesa más que todo el sitio**.

Empezá en **google.com/business** → *Administrar ahora*.

Si el local **ya aparece** en Maps (buscá "Carnicería El Torito Mercado San
Pablo"), no crees uno nuevo: tocá la ficha → *¿Es tuyo este negocio?* →
reclamarlo. Dos fichas del mismo local se pelean entre sí y las dos pierden.

### Datos para pegar, tal cual

**Nombre**
```
Carnicería El Torito
```

**Categoría principal**
```
Carnicería
```
Categorías secundarias sugeridas: *Tienda de embutidos*, *Servicio de entrega
a domicilio*.

**Dirección**
```
Mercado San Pablo, Barrio El Manchén, Tegucigalpa, Francisco Morazán, Honduras
```
Al ubicar el pin, usá estas coordenadas exactas (son las que ya usa la tienda
para calcular el envío):
```
14.1091381, -87.1916749
```

**Teléfono**
```
+504 9378-5051
```

**Sitio web**
```
https://carniceriaeltorito.com
```

**Horario**
```
Lunes a viernes   6:00 a 15:00
Sábado y domingo  6:00 a 13:00
```

**Descripción** (cabe en el límite de 750 caracteres)
```
Carnicería El Torito es una carnicería de mercado en Tegucigalpa, en el Mercado
San Pablo del Barrio El Manchén, atendiendo desde 1970. Cortamos res, cerdo y
pollo al peso que pidás: bistec, fajitas, milanesa, costilla, carne molida,
puyaso, rib eye, entraña, chuleta, lomo y más. Hacemos chorizo suelto, indio,
criollo, parrillero, cervecero y barbacoa, y también trabajamos vísceras como
hígado, lengua y mondongo. Podés ver los precios y armar tu pedido en línea en
carniceriaeltorito.com y te lo llevamos a tu casa en Tegucigalpa, de lunes a
viernes. El pedido se confirma por WhatsApp: te decimos disponibilidad y total
antes de cobrarte.
```

**Atributos que conviene marcar**
- Entrega a domicilio: **sí**
- Retiro en tienda: **sí**
- Compras en tienda: **sí**
- Pagos: efectivo y transferencia *(pago en línea todavía no existe — no lo marques)*

**Fotos** — es de lo que más mueve. Subí, en este orden:
1. La fachada del local en el mercado (para que la reconozcan al llegar)
2. El mostrador con carne
3. Dos o tres de los cortes (podés reusar las del sitio, están en `img/`)
4. El logo como foto de perfil (`img/logo.png`)

**Verificación:** Google va a pedir confirmar que el negocio es tuyo, casi
siempre por llamada o mensaje al teléfono, a veces por video. Sin ese paso la
ficha no se publica.

---

## 2 · Google Search Console (para saber si sirvió)

Sin esto estamos adivinando: es lo único que dice con qué palabras te
encuentran y qué indexó Google.

1. Entrá a **search.google.com/search-console** con tu cuenta.
2. *Agregar propiedad* → **Prefijo de URL** → `https://carniceriaeltorito.com`
3. Verificación: elegí **Etiqueta HTML**. Te va a dar una línea así:
   `<meta name="google-site-verification" content="..." />`
   **Pasámela y yo la pongo en el sitio** — va en el `<head>`, al lado de las
   otras. Después tocás *Verificar*.
4. Ya verificado: menú *Sitemaps* → escribí `sitemap.xml` → *Enviar*.
5. En *Inspección de URLs*, pegá `https://carniceriaeltorito.com/` y tocá
   **Solicitar indexación**. Eso le pide a Google que pase ahora en vez de
   esperar.

**Qué esperar:** los primeros datos tardan entre unos días y dos semanas. No
mires todos los días; a los 15 días revisamos juntos qué búsquedas aparecen y
con eso decidimos si vale la pena hacer páginas por categoría.

---

## 3 · Lo que quedó afuera a propósito

**Precios en el HTML.** Los precios cambian y quedarían viejos. Mostrarle a
Google un precio que ya no es el real es peor que no mostrar ninguno: la clienta
llega esperando otra cosa.

**Páginas por categoría** (una URL para res, otra para cerdo…). Es lo que
seguiría si Search Console muestra que la gente busca cortes específicos. Antes
de eso sería trabajo a ciegas.
