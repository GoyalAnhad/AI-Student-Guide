    import axios from "axios";
    import cheerio from "cheerio";

    // Example: scrape universities
    export async function scrapeUniversities(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const universities = [];

    $(".university").each((i, el) => {
        universities.push({
        name: $(el).find("h2").text(),
        courses: [],
        });
    });

    return universities;
    }
