import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("server-renders the Filtrar 3D app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Filtrar 3D/);
  assert.match(html, /Comparador argentino de impresión 3D/);
  assert.match(html, /Buscar/);
  assert.match(html, /Resultados/);
  assert.match(html, /ofertas reales/);
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
  assert.match(catalog, /@\/data\/.*products\.json/);
  assert.match(catalog, /searchText/);
  assert.match(catalog, /bestPrice/);
});

test("keeps product taxonomy and progressive rendering wired", async () => {
  const [catalog, explorer, filters] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/product-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-product-filters.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /"Herramientas"/);
  assert.match(catalog, /product\.isFdmPrinter/);
  assert.match(catalog, /product\.isResinPrinter/);
  assert.match(catalog, /product\.isResinMaterial/);
  assert.match(filters, /pageSize = 48/);
  assert.match(filters, /useProductFilters/);
  assert.match(explorer, /<ProductCard/);
  assert.match(explorer, /Mostrar más/);
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
