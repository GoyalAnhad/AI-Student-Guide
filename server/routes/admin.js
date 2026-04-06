// server/routes/admin.js
import express from "express";
import AdminLog from "../models/AdminLog.js";
import University from "../models/University.js";
import Career from "../models/Career.js";
import Exam from "../models/Exam.js";
import { triggerStateScrape, scrapeAllStates, getScraperStatus, SCRAPE_ORDER } from "../scraper/stateScraper.js";

const router = express.Router();

// ── GET /api/admin/logs — recent backend logs ──
router.get("/logs", async (req, res) => {
  try {
    const { limit = 100, type, session_id } = req.query;
    const filter = {};
    if (type)       filter.type       = type;
    if (session_id) filter.session_id = session_id;

    const logs = await AdminLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/stats — DB overview ─────────
router.get("/stats", async (req, res) => {
  try {
    const [unis, careers, exams, logs, scraperStatus] = await Promise.all([
      University.countDocuments(),
      Career.countDocuments(),
      Exam.countDocuments(),
      AdminLog.countDocuments(),
      getScraperStatus(),
    ]);

    const stateBreakdown = await University.aggregate([
      { $group: { _id: "$location.state", count: { $sum: 1 }, types: { $addToSet: "$type" } } },
      { $sort: { count: -1 } },
    ]);

    const courseCount = await University.aggregate([
      { $project: { count: { $size: "$courses" } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);

    res.json({
      success: true,
      stats: {
        universities:  unis,
        careers:       careers,
        exams:         exams,
        total_courses: courseCount[0]?.total || 0,
        total_logs:    logs,
        state_breakdown: stateBreakdown,
        scraper: scraperStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/scrape/state — trigger one state ──
router.post("/scrape/state", async (req, res) => {
  const { state } = req.body;
  if (!state) return res.status(400).json({ success: false, error: "state is required" });

  // Run in background, respond immediately
  res.json({ success: true, message: `Scraping ${state} started. Watch logs for progress.` });
  triggerStateScrape(state).catch(console.error);
});

// ── POST /api/admin/scrape/all — scrape all states ──
router.post("/scrape/all", async (req, res) => {
  res.json({ success: true, message: "Full state scrape started. Watch logs for progress." });
  scrapeAllStates().catch(console.error);
});

// ── GET /api/admin/scrape/status ────────────────
router.get("/scrape/status", async (req, res) => {
  try {
    const status = await getScraperStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/scrape/states — available states ──
router.get("/scrape/states", (req, res) => {
  res.json({ success: true, states: SCRAPE_ORDER });
});

// ── DELETE /api/admin/logs — clear old logs ─────
router.delete("/logs", async (req, res) => {
  try {
    const { older_than_days = 7 } = req.query;
    const cutoff = new Date(Date.now() - older_than_days * 24 * 60 * 60 * 1000);
    const result = await AdminLog.deleteMany({ timestamp: { $lt: cutoff } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
