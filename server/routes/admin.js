import express from "express";
import Exam from "../models/Exam.js";
import University from "../models/University.js";
import { runScrapers, saveData } from "../scraper/index.js";

const router = express.Router();

router.get("/data", async (req, res) => {
  try {
    const exams = await Exam.find().sort({ name: 1 });
    const universities = await University.find().sort({ name: 1 });
    res.json({ exams, universities });
  } catch (error) {
    console.error("Admin data error:", error);
    res.status(500).json({ message: "Failed to load data" });
  }
});

router.post("/scrape", async (req, res) => {
  try {
    const data = await runScrapers();
    await saveData(data);
    res.json({ message: "Scraping completed", counts: { exams: data.exams.length, universities: data.universities.length } });
  } catch (error) {
    console.error("Scrape error:", error);
    res.status(500).json({ message: "Scraping failed" });
  }
});

export default router;
