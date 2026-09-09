// Renders the product HTML files to Letter-size PDFs with the bundled Chromium.
// Usage: NODE_PATH=/opt/node22/lib/node_modules node build_pdfs.mjs
// (On a normal machine: npm i -D playwright && node build_pdfs.mjs)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "src");
const dist = path.join(here, "pdf");
fs.mkdirSync(dist, { recursive: true });

const files = [
  ["workbook.html", "The-First-90-Days-Executors-Working-Notebook.pdf"],
  ["lead-magnet-72-hours.html", "The-First-72-Hours-Checklist.pdf"],
  ["scripts-and-letters-pack.html", "Executor-Scripts-and-Letters-Pack.pdf"],
];

const exe = process.env.CHROMIUM_PATH || undefined; // set to /opt/pw-browsers/chromium/... if needed
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
for (const [inName, outName] of files) {
  const inPath = path.join(src, inName);
  if (!fs.existsSync(inPath)) { console.log("skip (missing):", inName); continue; }
  await page.goto(pathToFileURL(inPath).href, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.join(dist, outName),
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    scale: Number(process.env.PDF_SCALE || 0.92),
  });
  console.log("wrote", outName);
}
await browser.close();
