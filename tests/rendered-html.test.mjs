import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const allowedProductHostsByStore = new Map([
  ["Erexit 3D", new Set(["erexit3d.com", "acdn-us.mitiendanube.com"])],
  ["Kimera 3D", new Set(["kimera3d.com.ar", "acdn-us.mitiendanube.com"])],
  ["Laboratorio 3D", new Set(["laboratorio3d.com.ar", "acdn-us.mitiendanube.com"])],
  ["Proyecto Color", new Set(["proyectocolor.com.ar"])],
  ["TP3D", new Set(["tp3d.com.ar"])],
]);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function fetchWorker(request) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Ruta 3D app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);

  const html = await response.text();
  assert.match(html, /Ruta 3D/);
  assert.match(html, /Comparador argentino de impresión 3D/);
  assert.match(html, /Buscar/);
  assert.match(html, /Menor precio/);
  assert.match(html, /Precios y stock de referencia/);
  assert.match(html, /TP3D/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /SearchAction/);
  assert.match(html, /Catálogo de impresión 3D en Argentina/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/i);
});

test("publishes SEO discovery routes", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /^text\/plain\b/i);
  const robotsText = await robots.text();
  assert.match(robotsText, /Allow: \//);
  assert.match(robotsText, /Sitemap: https:\/\/ruta3d\.vercel\.app\/sitemap\.xml/);

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /^application\/xml\b/i);
  const sitemapText = await sitemap.text();
  assert.match(sitemapText, /<loc>https:\/\/ruta3d\.vercel\.app\/<\/loc>/);
  assert.match(sitemapText, /<loc>https:\/\/ruta3d\.vercel\.app\/que-impresora-compro<\/loc>/);
});

test("applies security headers to rejected methods", async () => {
  const response = await fetchWorker(new Request("http://localhost/", { method: "POST" }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
});

test("sanitizes user-controlled search params before rendering", async () => {
  const response = await render("/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3Ejavascript%3Aalert(1)");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/i);
  assert.doesNotMatch(html, /javascript:alert\(1\)/i);
});

test("does not expose obvious secrets in rendered html", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.doesNotMatch(html, /(?:api[_-]?key|secret|private[_-]?key|access[_-]?token)\s*[:=]/i);
  assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(html, /AKIA[0-9A-Z]{16}/);
});

test("rejects unsafe image optimization requests before paid transforms", async () => {
  const response = await fetchWorker(
    new Request("http://localhost/_vinext/image?url=https%3A%2F%2Fevil.example%2Fprobe.png&w=640&q=75"),
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("keeps catalog data out of the client page module", async () => {
  const [page, explorer, catalog] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /"use client"/);
  assert.doesNotMatch(page, /@\/data\/.*products\.json/);
  assert.match(page, /<ProductExplorer/);
  assert.match(explorer, /"use client"/);
  assert.doesNotMatch(explorer, /^import \{[^}]+\} from "@\/lib\/catalog";/m);
  assert.match(catalog, /@\/data\/.*products\.json/);
  assert.match(catalog, /searchText/);
  assert.match(catalog, /bestPrice/);
});

test("keeps product taxonomy and progressive rendering wired", async () => {
  const [catalog, explorer, filters, filterUtils] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/product-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-product-filters.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/filter-utils.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /"Herramientas"/);
  assert.match(catalog, /product\.isFdmPrinter/);
  assert.match(catalog, /product\.isResinPrinter/);
  assert.match(catalog, /product\.isResinCuring/);
  assert.match(catalog, /product\.isResinMaterial/);
  assert.match(filters, /pageSize = 48/);
  assert.match(filters, /useProductFilters/);
  assert.match(filters, /!product\.isFilament \|\| selectedFilamentBrandSet\.has/);
  assert.match(filters, /colorFilterIsActive/);
  assert.match(catalog, /filamentColors/);
  assert.match(catalog, /colorConfidence/);
  assert.match(filters, /product\.filamentColors\.length === 0/);
  assert.match(filterUtils, /filamentColorSearchTerms/);
  assert.match(filterUtils, /product\.filamentColors\.includes\(searchedColor\)/);
  assert.match(explorer, /Color no informado por la tienda/);
  assert.match(explorer, /Disponibles en/);
  assert.match(explorer, /Natural/);
  assert.match(explorer, /Violeta/);
  assert.match(explorer, /Rosa/);
  assert.match(explorer, /Dorado/);
  assert.match(explorer, /product-search-card/);
  assert.match(explorer, /Guardados/);
  assert.match(explorer, /filtrar-3d-saved-products/);
  assert.match(explorer, /productos más/);
  assert.match(explorer, /visibleProducts\.length \|\| showsFilterSidebar/);
  assert.match(explorer, /Lápiz 3D/);
  assert.match(explorer, /Técnicos/);
  assert.match(explorer, /ABS/);
  assert.match(explorer, /NYLON/);
  assert.match(explorer, /PC/);
  assert.match(explorer, /PVC/);
  assert.match(explorer, /PA6-GF/);
  assert.match(explorer, /PPA-CF/);
  assert.match(catalog, /"PLA Silk"/);
  assert.match(catalog, /"PEBA"/);
  assert.match(catalog, /"PVC"/);
  assert.match(catalog, /material !== unknownMaterial/);
  assert.match(catalog, /isBambuLaserModule/);
  assert.match(catalog, /detectSparePart\(product\)\) return "Repuestos"/);
  assert.match(catalog, /buffer de filamento/);
  assert.match(explorer, /menu-section-trigger/);
  assert.match(explorer, /showAllResinPrinters/);
  assert.match(explorer, /showAllCuringMachines/);
  assert.match(explorer, /showAllResinMaterials/);
  assert.match(explorer, /isFdmPrinterSearch \? <details open><summary>Tipo/);
  assert.match(explorer, /isResinPrinterSearch \? <details><summary>Marca/);
  assert.match(explorer, /isResinMaterialSearch \? <details open><summary>Material/);
  assert.match(explorer, /Materiales de resina/);
  assert.match(explorer, /Marcas de resina/);
  assert.match(explorer, /Marcas resina/);
  assert.doesNotMatch(explorer, /"Ender"/);
  assert.doesNotMatch(explorer, /sistema multicolor/);
  assert.match(explorer, /disabled=\{isDisabled\}/);
  assert.match(explorer, /toggleFilamentBrand/);
  assert.match(explorer, /toggleFilamentColor/);
  assert.doesNotMatch(explorer, /mega-filter-actions/);
  assert.doesNotMatch(filters, /multicolorSystemRank/);
  assert.match(filterUtils, /\["standard", \["standard", "estandar"\]\]/);
  assert.match(filters, /"Dura"/);
  assert.doesNotMatch(filters, /"Tough"/);
  assert.doesNotMatch(filters, /"Flexible"/);
  assert.match(explorer, /priceRangeLabel/);
  assert.match(explorer, /printerFrameOptions/);
  assert.match(catalog, /excludedFilamentBrands/);
  assert.match(catalog, /"algolaser",[\s\S]*"anycubic",[\s\S]*"biqu"/);
  assert.match(catalog, /"global",[\s\S]*"prusa"/);
  assert.match(catalog, /text\.includes\("filamento mix pla small"\)\) return "GST3D"/);
  assert.match(catalog, /text\.includes\("elemental"\)\) return "Elemental"/);
  assert.match(catalog, /brand === unknownBrand\.toLowerCase\(\)\) return false/);
  assert.match(catalog, /creality\\s\+cr-silk\\s\+1\\\.0kg/i);
});

test("renders all available colors from catalog variants", async () => {
  const response = await render("/?q=filamento");
  const html = await response.text();

  assert.match(html, /Disponible en/);
  assert.match(html, /Color no informado por la tienda/);
});

test("matches filament color searches against available variants", async () => {
  const response = await render("/?q=bambu%20pla%20rojo");
  const html = await response.text();

  assert.match(html, /Filamento Bambu Lab PLA Lite - CON CARRETE/i);
  assert.match(html, /Disponible en/i);
});

test("keeps curing machines discoverable from resin searches", async () => {
  const response = await render("/?q=Elegoo%20curado");
  const html = await response.text();

  assert.match(html, /MAQUINA DE LAVADO Y CURADO ELEGOO MERCUY 3,0 PLUS|Máquina de lavado y curado Elegoo/i);
});

test("matches standard resin products also named estandar", async () => {
  const response = await render("/?q=standard");
  const html = await response.text();

  assert.match(html, /Resina Est[aá]ndar 1kg Anycubic/i);
});

function assertSafeCatalogUrl(value, context, allowedHosts) {
  assert.equal(typeof value, "string", `${context} must be a string URL`);
  assert.ok(value.length <= 2048, `${context} URL is unexpectedly long`);

  let parsed;
  assert.doesNotThrow(() => {
    parsed = new URL(value);
  }, `${context} must be an absolute URL`);

  assert.equal(parsed.protocol, "https:", `${context} must use https`);
  assert.ok(allowedHosts.has(parsed.hostname), `${context} uses unexpected host ${parsed.hostname}`);
  assert.doesNotMatch(parsed.href, /[\u0000-\u001f\u007f]/, `${context} contains control characters`);
}

test("keeps scraped catalog data safe to render", async () => {
  const dataFiles = (await readdir(new URL("../data/", import.meta.url))).filter((file) =>
    file.endsWith("-products.json"),
  );

  for (const file of dataFiles) {
    const payload = JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"));

    for (const product of payload.products ?? []) {
      const context = `${file}:${product.id}`;
      const allowedHosts = allowedProductHostsByStore.get(product.store);

      assert.ok(allowedHosts, `${context} has unknown store ${product.store}`);
      assert.equal(typeof product.id, "string", `${context} has no string id`);
      assert.match(product.id, /^[a-z0-9-]+$/i, `${context} id should be stable and simple`);
      assert.equal(typeof product.name, "string", `${context} has no product name`);
      assert.ok(product.name.trim().length > 0, `${context} has an empty product name`);
      assert.ok(product.name.length <= 240, `${context} product name is unexpectedly long`);
      assert.equal(typeof product.store, "string", `${context} has no store`);
      assert.equal(typeof product.category, "string", `${context} has no category`);
      assert.ok(product.category.length <= 80, `${context} category is unexpectedly long`);
      assert.equal(typeof product.price, "number", `${file}:${product.id} has no numeric price`);
      assert.ok(Number.isFinite(product.price), `${context} price must be finite`);
      assert.ok(product.price > 0 && product.price < 100_000_000, `${context} price is outside expected bounds`);
      if (product.transferPrice != null) {
        assert.equal(typeof product.transferPrice, "number", `${context} transfer price must be numeric`);
        assert.ok(
          product.transferPrice < product.price,
          `${file}:${product.id} transfer price must be lower than list price`,
        );
      }
      if (product.previousPrice != null) {
        assert.equal(typeof product.previousPrice, "number", `${context} previous price must be numeric`);
        assert.ok(product.previousPrice >= product.price, `${context} previous price should not be lower than price`);
      }

      assertSafeCatalogUrl(product.url, `${context} product URL`, allowedHosts);
      if (product.image != null) {
        assertSafeCatalogUrl(product.image, `${context} image URL`, allowedHosts);
      }

      for (const tag of product.tags ?? []) {
        assert.equal(typeof tag, "string", `${context} tag must be a string`);
        assert.ok(tag.length <= 80, `${context} tag is unexpectedly long`);
      }
    }
  }
});

test("publishes catalog refresh status for stale scrape fallbacks", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/catalog-refresh.json", import.meta.url), "utf8"));

  assert.match(manifest.status, /^(ok|partial)$/);
  assert.equal(typeof manifest.updatedStores, "number");
  assert.equal(typeof manifest.staleStores, "number");
  assert.ok(Array.isArray(manifest.stores));

  const response = await render("/");
  const html = await response.text();
  assert.match(html, /Datos actualizados entre|Última actualización parcial/);
});
