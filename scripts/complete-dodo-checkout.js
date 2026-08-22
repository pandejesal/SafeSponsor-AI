import { chromium } from "playwright";
const url = process.argv[2];
if (!url) { console.error("usage: node complete-dodo-checkout.js <checkoutUrl>"); process.exit(1); }
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log("[CHECKOUT] Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  console.log("[CHECKOUT] Loaded, title:", await page.title());
  // Take screenshot for debugging
  await page.screenshot({ path: "dodo-checkout.png", fullPage: true });
  console.log("[CHECKOUT] Screenshot saved dodo-checkout.png");
  // Try to find card fields
  const cardSelectors = [
    'input[placeholder*="Card"]', 'input[name*="card"]', 'input[autocomplete*="cc-number"]',
    'iframe'
  ];
  for (const sel of cardSelectors) {
    const count = await page.locator(sel).count();
    console.log(`[CHECKOUT] selector ${sel}: ${count}`);
  }
  console.log("[CHECKOUT] Page content snippet:", (await page.content()).slice(0, 2000));
  await browser.close();
})();
