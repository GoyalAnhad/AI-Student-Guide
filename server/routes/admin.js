    import express from "express";
    import Exam from "../models/Exam.js";
    import University from "../models/University.js";
    import { runScrapers } from "../scraper/index.js";
    import { saveData } from "../scraper/save.js";

    const router = express.Router();

    // GET DATA
    router.get("/data", async (req, res) => {
    const exams = await Exam.find();
    const universities = await University.find();

    res.json({ exams, universities });
    });

    // RUN SCRAPER MANUALLY
    router.post("/scrape", async (req, res) => {
    const data = await runScrapers();
    await saveData(data);

    res.send("Scraping completed");
    });

    export default router;