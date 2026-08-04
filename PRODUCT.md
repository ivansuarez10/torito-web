# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primario: hogares de Tegucigalpa.** Familias comprando carne para la semana o el fin de semana. Compra pequeña, recurrente, decisión rápida. El diseño se prioriza para ellos.

**Secundario: negocios** — restaurantes, comedores, pulperías. Compran por volumen y cortes específicos. Existen y compran, pero no mandan en las decisiones de diseño.

## Product Purpose

Tienda en línea de la Carnicería El Torito (Mercado San Pablo, El Manchén, Tegucigalpa). Existe para cuatro cosas confirmadas por el dueño, todas simultáneas:

1. **Que el cliente vea precios y cortes sin tener que preguntar.** Antes había que escribir por WhatsApp para saber qué hay y cuánto cuesta.
2. **Alcanzar a gente que no conoce la carnicería.** No es solo comodidad para el cliente de siempre: es llegar a quien nunca ha ido al Mercado San Pablo.
3. **Que el pedido llegue estructurado a la carnicería**, no como texto suelto que alguien tiene que interpretar.
4. **Que el envío se calcule solo**, sin negociarlo por chat.

Éxito = un pedido completado sin que nadie tenga que escribir una pregunta.

## Positioning

Carnicería real con local físico y 63 productos cortados al peso, no un catálogo genérico. "DESDE 1970" es un hecho verificable, no un eslogan. El tagline de categoría del propio catálogo lo dice: *"Cortada al peso que pidás"* — el corte a medida es el mecanismo, y un intermediario o un supermercado no puede copiarlo con verdad.

## Operating Context

- Cliente compra desde el celular, casi siempre.
- El pedido sale por **dos vías a la vez**: `POST` a la Edge Function `submit-order` de Supabase (cae en Comandas Torito, la app que usa el personal) y apertura de WhatsApp con el pedido ya escrito.
- El envío se calcula por distancia real desde el local: `max(50, round((50 + 9·km)/5)·5)` lempiras, con tope de 25 km = fuera de zona.
- Dirección por GPS propio o por mapa con pin arrastrable; autocompletado con Photon acotado al área metropolitana de Tegucigalpa.
- Del otro lado hay personal de carnicería atendiendo, no un centro de distribución.

## Capabilities and Constraints

**Funciona hoy:** catálogo de 63 productos en 6 categorías con precios en lempiras (L), carrito, cálculo de envío, selección de dirección por mapa, salida a WhatsApp y a Comandas, repetir pedido anterior.

**Restricción dura — dispositivo:** el cliente típico usa **Android de gama baja con datos limitados**. El peso de la página y el tiempo de carga con mala señal son restricciones de producto, no preferencias. Cualquier mejora visual que cueste segundos de carga está descartada por definición, no por criterio estético.

**No implementado:** pago en línea (Fase 2). No prometerlo ni insinuarlo en la interfaz.

**Catálogo:** `catalog.json` en el repo, con sobrescritura opcional desde `app_config` en Supabase. Los precios cambian — no hardcodear ninguno en el diseño.

## Brand Commitments

- Nombre: **Carnicería El Torito**. Fundada en 1970 ("DESDE 1970" es dato real).
- Identidad: toro estilo Osborne, rojo `#9F2629` + negro. Assets en `~/Desktop/INDCAN/Carniceria/`.
- Línea gráfica digital acordada: estética clara tipo Apple, SF Pro, sombras suaves. **El rojo es acento, nunca fondo.** Íconos de línea, sin emojis.
- WhatsApp del negocio: 504 9378 5051.

## Evidence on Hand

- Catálogo real con 63 productos, precios y descripciones (`catalog.json`).
- Local físico verificable: Mercado San Pablo, El Manchén (14.1091381, -87.1916749).
- Fotos de producto en `img/`.
- **No hay** testimonios, reseñas, cifras de ventas ni conteo de clientes. No inventarlos ni insinuar volumen que no está probado.

## Product Principles

1. **Cero preguntas para comprar.** Si el cliente tiene que escribir para saber algo, la tienda falló en su propósito.
2. **El peso de la página es una restricción de producto.** Se diseña dentro del presupuesto de carga del Android de gama baja, no se pide excepción.
3. **El pedido termina en manos de una persona.** Todo lo que se muestre debe ser algo que el personal de la carnicería pueda cumplir de verdad.
4. **No prometer lo que no existe.** Sin pago en línea, sin inventario en vivo, sin tiempos de entrega garantizados hasta que existan.
5. **La carnicería es real y vieja.** La credibilidad viene de eso, no de parecer una startup.

## Accessibility & Inclusion

Sin estándar formal establecido. Necesidad derivada del escenario real de uso: legibilidad y áreas táctiles cómodas en pantallas pequeñas de gama baja, y funcionamiento con conexión intermitente. Pendiente de decidir si se adopta WCAG AA como meta formal.
