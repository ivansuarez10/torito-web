-- Actualizar el CARRUSEL de la portada a los 2 banners nuevos (ASCII puro, acentos seguros).
-- Afecta staging y (a futuro) produccion; produccion no muestra carrusel aun, asi que no cambia nada alla.
update app_config
set value = jsonb_set(value, '{meta,carousel}', '[{"img": "img/banners/barbacoa.jpg", "title": "Chorizo *Barbacoa*", "cta_text": "Ped\u00ed el tuyo \u2192", "cta_link": "#catalogo", "align": "izq", "on": true}, {"img": "img/banners/ahumado.jpg", "title": "Chorizo *Ahumado*", "cta_text": "Arm\u00e1 tu pedido \u2192", "cta_link": "#catalogo", "align": "izq", "on": true}]'::jsonb),
    updated_at = now()
where key = 'store_catalog';
