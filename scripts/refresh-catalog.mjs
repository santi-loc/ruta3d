import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const scrapers = [
  {
    name: "Erexit 3D",
    script: "scripts/scrape-erexit3d.mjs",
    output: "data/erexit3d-products.json",
  },
  {
    name: "Laboratorio 3D",
    script: "scripts/scrape-laboratorio3d.mjs",
    output: "data/laboratorio3d-products.json",
  },
  {
    name: "i3D Tienda",
    script: "scripts/scrape-i3dtienda.mjs",
    output: "data/i3dtienda-products.json",
  },
  {
    name: "Lefasoc",
    script: "scripts/scrape-lefasoc.mjs",
    output: "data/lefasoc-products.json",
  },
  {
    name: "TP3D",
    script: "scripts/scrape-tp3d.mjs",
    output: "data/tp3d-products.json",
  },
  {
    name: "Proyecto Color",
    script: "scripts/scrape-proyectocolor.mjs",
    output: "data/proyectocolor-products.json",
  },
  {
    name: "Kimera 3D",
    script: "scripts/scrape-kimera3d.mjs",
    output: "data/kimera3d-products.json",
  },
  {
    name: "Osiris 3D",
    script: "scripts/scrape-osiris3d.mjs",
    output: "data/osiris3d-products.json",
  },
  {
    name: "Todo 3D",
    script: "scripts/scrape-todo3dsf.mjs",
    output: "data/todo3dsf-products.json",
  },
  {
    name: "Trimetra 3D",
    script: "scripts/scrape-trimetra3d.mjs",
    output: "data/trimetra3d-products.json",
  },
];

const manifestPath = "data/catalog-refresh.json";

function runScraper(scraper, outputPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scraper.script, `--output=${outputPath}`], {
      stdio: "inherit",
    });

    child.on("close", (code, signal) => {
      resolve({
        ok: code === 0,
        reason: signal ? `signal ${signal}` : `exit ${code}`,
      });
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        reason: error.message,
      });
    });
  });
}

async function readCatalog(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function validateCatalog(filePath, storeName) {
  const catalog = await readCatalog(filePath);
  const scrapedAt = new Date(catalog.scrapedAt);

  if (!catalog || catalog.store?.name !== storeName) {
    throw new Error(`catalog store mismatch for ${storeName}`);
  }

  if (!Number.isFinite(scrapedAt.getTime())) {
    throw new Error(`catalog has invalid scrapedAt for ${storeName}`);
  }

  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error(`catalog has no products for ${storeName}`);
  }

  return {
    count: catalog.products.length,
    scrapedAt: scrapedAt.toISOString(),
  };
}

async function previousStoreState(scraper) {
  try {
    const previous = await validateCatalog(scraper.output, scraper.name);
    return {
      count: previous.count,
      scrapedAt: previous.scrapedAt,
    };
  } catch {
    return {
      count: 0,
      scrapedAt: null,
    };
  }
}

async function readPreviousFullRefresh() {
  try {
    const manifest = await readCatalog(manifestPath);
    return manifest.lastSuccessfulFullRefreshAt ?? null;
  } catch {
    return null;
  }
}

const temporaryDirectory = await mkdir(path.join(os.tmpdir(), `ruta3d-refresh-${process.pid}`), { recursive: true })
  .then(() => path.join(os.tmpdir(), `ruta3d-refresh-${process.pid}`));
const startedAt = new Date().toISOString();
const results = [];

try {
  for (const scraper of scrapers) {
    const temporaryOutput = path.join(temporaryDirectory, path.basename(scraper.output));
    const previous = await previousStoreState(scraper);
    const run = await runScraper(scraper, temporaryOutput);

    if (!run.ok) {
      results.push({
        store: scraper.name,
        status: "stale",
        reason: run.reason,
        count: previous.count,
        scrapedAt: previous.scrapedAt,
      });
      continue;
    }

    try {
      const next = await validateCatalog(temporaryOutput, scraper.name);
      await copyFile(temporaryOutput, scraper.output);
      results.push({
        store: scraper.name,
        status: "updated",
        count: next.count,
        scrapedAt: next.scrapedAt,
      });
    } catch (error) {
      results.push({
        store: scraper.name,
        status: "stale",
        reason: error instanceof Error ? error.message : "invalid scraper output",
        count: previous.count,
        scrapedAt: previous.scrapedAt,
      });
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const refreshedAt = new Date().toISOString();
const staleStores = results.filter((result) => result.status === "stale");
const updatedStores = results.filter((result) => result.status === "updated");
const scrapedDates = results
  .map((result) => result.scrapedAt ? new Date(result.scrapedAt) : null)
  .filter((date) => date && Number.isFinite(date.getTime()));
const manifest = {
  startedAt,
  refreshedAt,
  status: staleStores.length ? "partial" : "ok",
  lastSuccessfulFullRefreshAt: staleStores.length ? await readPreviousFullRefresh() : refreshedAt,
  updatedStores: updatedStores.length,
  staleStores: staleStores.length,
  oldestScrapedAt: scrapedDates.length ? new Date(Math.min(...scrapedDates.map((date) => date.getTime()))).toISOString() : null,
  newestScrapedAt: scrapedDates.length ? new Date(Math.max(...scrapedDates.map((date) => date.getTime()))).toISOString() : null,
  stores: results,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\nCatálogos actualizados: ${updatedStores.length}/${results.length}`);

if (staleStores.length) {
  console.warn("Catálogos preservados desde el último scrape bueno:");
  for (const result of staleStores) {
    console.warn(`- ${result.store}: ${result.reason}; datos previos de ${result.scrapedAt ?? "fecha no informada"}`);
  }
}

if (!updatedStores.length && staleStores.some((result) => !result.scrapedAt)) {
  console.error("No hay catálogos nuevos ni previos suficientes para publicar.");
  process.exitCode = 1;
}
