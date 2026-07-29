# Filtrar 3D

Comparador argentino de precios para productos de impresion 3D.

El MVP muestra tiendas candidatas, filtros por categoria/tienda, orden por precio,
stock y links de oferta. Erexit 3D ya tiene un primer scraper real conectado.

## Comandos

```bash
pnpm run dev
pnpm run build
pnpm run scrape:erexit3d
```

## Scraper Erexit 3D

El scraper esta en `scripts/scrape-erexit3d.mjs`.

Extrae desde `https://erexit3d.com/productos/` y paginas sucesivas:

- nombre
- categoria inferida
- precio
- precio con transferencia
- stock acumulado por variantes
- marca
- tags
- imagen
- link canonico
- variantes

Salida principal:

```bash
data/erexit3d-products.json
```

Para probar solo la primera pagina:

```bash
pnpm run scrape:erexit3d:sample
```

## Proximos conectores

Las fuentes iniciales estan en `store-sources.json`.

Pendientes:

- TP3D
- Laboratorio 3D
- Proyecto Color
- Kimera 3D
