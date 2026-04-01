    import cheerio from "cheerio";
    import { safeFetch } from "../utils/fetch.js";

    function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

    export async function scrapeExams() {
        await delay(2000); 
    const html = await safeFetch("https://example.com/exams");

    if (!html) return [];

    const $ = cheerio.load(html);
    const exams = [];

    $("table tr").each((i, el) => {
        exams.push({
        name: $(el).find(".exam-name").text().trim(),
        date: $(el).find(".exam-date").text().trim(),
        });
    });

    return exams;
    }