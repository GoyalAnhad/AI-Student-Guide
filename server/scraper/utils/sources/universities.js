import cheerio from "cheerio";
import { safeFetch } from "../fetch.js";

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function scrapeUniversities() {
  await delay(2000);

  const html = await safeFetch("https://example.com/universities");
  if (!html) return [];

  const $ = cheerio.load(html);
  const universities = [];

  $(".university-card").each((i, el) => {
    universities.push({
      name: $(el).find("h2").text().trim(),
      location: $(el).find(".location").text().trim(),
    });
  });

  return universities;
}
