import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/i);
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
  assert.match(explorer, /Color no informado por la tienda/);
  assert.match(explorer, /Disponibles en/);
  assert.match(explorer, /Natural/);
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
  assert.match(explorer, /setCategory\("Impresoras de Resina"\); handleQueryChange\("", false\); selectAllResinPrinterBrands/);
  assert.match(explorer, /setCategory\("Curadoras"\); handleQueryChange\("", false\)/);
  assert.match(explorer, /setCategory\("Resina"\); handleQueryChange\("", false\); selectAllResinMaterialBrands/);
  assert.match(explorer, /isFdmPrinterSearch \? <details open><summary>Tipo/);
  assert.match(explorer, /isResinPrinterSearch \? <details open><summary>Marca/);
  assert.match(explorer, /isResinMaterialSearch \? <details open><summary>Tipo/);
  assert.match(explorer, /Marcas resina/);
  assert.match(filterUtils, /\["standard", \["standard", "estandar"\]\]/);
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

test("keeps scraped price data internally consistent", async () => {
  const dataFiles = (await readdir(new URL("../data/", import.meta.url))).filter((file) =>
    file.endsWith("-products.json"),
  );

  for (const file of dataFiles) {
    const payload = JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"));

    for (const product of payload.products ?? []) {
      assert.equal(typeof product.price, "number", `${file}:${product.id} has no numeric price`);
      if (product.transferPrice != null) {
        assert.ok(
          product.transferPrice < product.price,
          `${file}:${product.id} transfer price must be lower than list price`,
        );
      }
    }
  }
});
