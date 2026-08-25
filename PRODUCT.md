# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ruta 3D serves two primary Argentine audiences:

- Makers and hobbyists who need to compare 3D printing products, prices, stock, and stores quickly before buying.
- Workshops, studios, and small businesses that buy 3D printing materials, parts, accessories, or machines on a recurring basis and need efficient price discovery.

## Product Purpose

Ruta 3D is an Argentine price comparison tool for 3D printing products. It helps users search for printers, filament, resin, accessories, parts, and related products across connected Argentine stores, then compare price, stock, category, store, product image, and offer links in one place.

Success means users can find relevant real listings faster than visiting each store separately, with enough trustworthy information to decide where to buy.

## Positioning

The current differentiator is a single search and filtering interface powered by real scraped data from Argentine 3D printing stores. Future work should preserve the product's value as a practical comparison layer over connected local stores, rather than a generic catalog or editorial marketplace.

## Operating Context

Users evaluate products by price in Argentine pesos, store, stock state, category, brand, material, product image, and link to the original store. Transfer price is important when available and should be prioritized as a first-class buying signal.

The MVP currently connects scrapers for TP3D, Laboratorio 3D, Erexit 3D, Proyecto Color, Kimera 3D, Osiris 3D, Todo 3D, and Trimetra 3D. Scraped outputs live in `data/*-products.json`, with scraper scripts in `scripts/`.

## Capabilities and Constraints

Confirmed capabilities:

- Search across connected stores.
- Filter by category, store, filament brand, filament material, and stock availability.
- Sort by best available price, prioritizing transfer price when available.
- Show real product names, prices, transfer prices when available, stock labels, images, and canonical offer links.
- Use connected scraper data as the product source of truth.

Durable constraints:

- Do not invent offers, testimonials, discounts, claims, store relationships, stock, benchmarks, or social proof.
- Only show or claim store data that is connected and backed by real product data.
- Prioritize Argentine pesos and transfer prices where the data exists.
- Preserve accessibility as a product requirement.
- Preserve deployability through the current Sites/Cloudflare-oriented setup.

## Brand Commitments

The product name is Ruta 3D. The current voice is practical, direct, and Argentine Spanish. Future copy should stay useful and buying-oriented rather than hype-driven.

## Evidence on Hand

- `README.md` describes the product as an Argentine price comparator for 3D printing products.
- `store-sources.json` lists the connected and prioritized store sources.
- `data/erexit3d-products.json`, `data/laboratorio3d-products.json`, `data/tp3d-products.json`, `data/proyectocolor-products.json`, and `data/kimera3d-products.json` contain scraped product data.
- `scripts/scrape-*.mjs` contain scraper implementations for connected stores.
- `.openai/hosting.json` records the Sites project configuration.

No testimonials, customer logos, press quotes, or benchmark evidence have been provided. Future work must not fabricate them.

## Product Principles

- Make comparison faster than visiting individual stores.
- Treat scraped store data as factual evidence, not decorative content.
- Keep prices, stock, and transfer-price signals easy to scan.
- Serve both individual makers and buying-heavy workshops without splitting the product into separate experiences prematurely.
- Prefer plain, verifiable claims over promotional language.

## Accessibility & Inclusion

Accessibility is a confirmed product requirement. Future UI work should preserve keyboard usability, readable contrast, clear labels, responsive layouts, and robust behavior for real product names, prices, and filters.
