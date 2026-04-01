    import cron from "node-cron";
    import { runScrapers } from "../scraper/index.js";

    cron.schedule("0 */6 * * *", async () => {
    console.log("⏳ Running scheduled scraping...");

    const data = await runScrapers();

    // Save to DB here
    });