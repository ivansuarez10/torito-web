-- ANEXAR los 4 productos nuevos a la nube store_catalog (correr UNA sola vez).
-- Preserva todo lo demás (precios, descripciones, banner, carrusel).
update app_config
set value = jsonb_set(
      value,
      '{products}',
      (value->'products') || '[{"id": "cerdo-tajo-de-cerdo", "cat": "cerdo", "name": "Tajo de cerdo", "unit": "libra", "price": 80, "active": false, "desc": "Corte de cerdo para guiso."}, {"id": "pollo-mollejas", "cat": "pollo", "name": "Mollejas", "unit": "libra", "price": 40, "active": false, "desc": "Mollejas de pollo frescas."}, {"id": "pollo-trocitos-en-caja", "cat": "pollo", "name": "Trocitos de pollo en caja", "unit": "libra", "price": 98, "active": false, "desc": "Trocitos de pollo, práctico."}, {"id": "extras-camaron-5lb", "cat": "extras", "name": "Camarón 5 lb", "unit": "paquete", "price": 625, "active": true, "desc": "Camarón, presentación de 5 libras."}]'::jsonb
    ),
    updated_at = now()
where key = 'store_catalog';