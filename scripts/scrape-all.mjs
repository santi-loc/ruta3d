import { spawn } from "node:child_process";

const scrapers = [
  ["3DTisk", "scripts/scrape-3dtisk.mjs"],
  ["3Dimension", "scripts/scrape-3dimension.mjs"],
  ["Creaxis 3D", "scripts/scrape-creaxis.mjs"],
  ["Dino 3D", "scripts/scrape-dino3d.mjs"],
  ["Erexit 3D", "scripts/scrape-erexit3d.mjs"],
  ["Filacolor", "scripts/scrape-filacolor.mjs"],
  ["Laboratorio 3D", "scripts/scrape-laboratorio3d.mjs"],
  ["i3D Tienda", "scripts/scrape-i3dtienda.mjs"],
  ["Gprint 3D", "scripts/scrape-gprint3d.mjs"],
  ["Global Value", "scripts/scrape-globalvalue.mjs"],
  ["Lefasoc", "scripts/scrape-lefasoc.mjs"],
  ["TP3D", "scripts/scrape-tp3d.mjs"],
  ["Proyecto Color", "scripts/scrape-proyectocolor.mjs"],
  ["Kimera 3D", "scripts/scrape-kimera3d.mjs"],
  ["Osiris 3D", "scripts/scrape-osiris3d.mjs"],
  ["Todo 3D", "scripts/scrape-todo3dsf.mjs"],
  ["Trimetra 3D", "scripts/scrape-trimetra3d.mjs"],
  ["WeTech", "scripts/scrape-wetech.mjs"],
  ["Llaveprint", "scripts/scrape-llaveprint.mjs"],
  ["Star Impression 3D", "scripts/scrape-starimpression3d.mjs"],
  ["Tecknicam 3D", "scripts/scrape-tecknicam3d.mjs"],
];

function runScraper([name, script]) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
    });

    child.on("close", (code, signal) => {
      resolve({
        name,
        ok: code === 0,
        reason: signal ? `signal ${signal}` : `exit ${code}`,
      });
    });
  });
}

const results = [];

for (const scraper of scrapers) {
  results.push(await runScraper(scraper));
}

const failed = results.filter((result) => !result.ok);
const succeeded = results.filter((result) => result.ok);

if (failed.length) {
  console.error("\nScrapers con error:");
  for (const result of failed) {
    console.error(`- ${result.name}: ${result.reason}`);
  }
}

console.log(`\nScrapers actualizados: ${succeeded.length}/${results.length}`);

if (!succeeded.length) {
  process.exitCode = 1;
}
