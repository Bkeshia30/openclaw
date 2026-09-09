// Renders a 1000x1500 Pinterest pin PNG from a title, in the brand style. No external assets.
// Usage: node render_pin.mjs --title "Order more death certificates than you think you need" --out pin.png [--kicker "The Executor's Desk"]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true"; }
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const title = args.title || "The first 72 hours after a parent dies";
const kicker = args.kicker || "The Executor's Desk";
const footer = args.footer || "Free 72-hour checklist · theexecutorsdesk.com/72";
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1000px;height:1500px;background:#faf8f3;font-family:"Bitstream Charter","Charter",Georgia,serif;color:#1d1d1b;display:flex;flex-direction:column;justify-content:space-between;padding:90px 84px;box-sizing:border-box}
.k{font-family:"Liberation Sans",Arial,sans-serif;font-size:26px;letter-spacing:.18em;text-transform:uppercase;color:#2f4f4f}
h1{font-family:"Liberation Sans",Arial,sans-serif;font-weight:700;font-size:84px;line-height:1.08;letter-spacing:-.01em;margin:40px 0 0 0}
.rule{height:6px;width:140px;background:#2f4f4f;margin:48px 0 0 0}
.f{font-size:30px;color:#5c5a55;border-top:2px solid #c9c5bb;padding-top:28px}
</style></head><body><div><div class="k">${esc(kicker)}</div><h1>${esc(title)}</h1><div class="rule"></div></div><div class="f">${esc(footer)}</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: args.out || "pin.png" });
await browser.close();
console.log("wrote", args.out || "pin.png");
