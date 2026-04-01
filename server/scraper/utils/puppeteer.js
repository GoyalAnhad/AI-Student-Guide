import puppeteer from "puppeteer";

export async function scrapeDynamicSite() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
);
  await page.goto("https://example.com");
  
await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".card")).map(el => ({
      name: el.innerText,
    }));
  });

  await browser.close();
  return data;
}