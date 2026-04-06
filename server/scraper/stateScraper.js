// server/scraper/stateScraper.js
// Loads college data state by state into MongoDB.
// Start with Delhi, then run for each state in order.
// Call triggerStateScrape("delhi") from admin route or run directly.

import University from "../models/University.js";
import { logger } from "../utils/logger.js";

// ── State data registry ────────────────────────
// Add new state files here as you build them.
const STATE_REGISTRY = {
  "delhi":          () => import("../data/states/delhi.js").then((m) => m.delhiColleges),
  // "maharashtra":  () => import("../data/states/maharashtra.js").then((m) => m.maharashtraColleges),
  // "karnataka":    () => import("../data/states/karnataka.js").then((m) => m.karnatakaColleges),
  // "tamil_nadu":   () => import("../data/states/tamilnadu.js").then((m) => m.tamilNaduColleges),
  // "telangana":    () => import("../data/states/telangana.js").then((m) => m.telanganaColleges),
  // "west_bengal":  () => import("../data/states/westbengal.js").then((m) => m.westBengalColleges),
  // "rajasthan":    () => import("../data/states/rajasthan.js").then((m) => m.rajasthanColleges),
  // "gujarat":      () => import("../data/states/gujarat.js").then((m) => m.gujaratColleges),
  // "uttar_pradesh":() => import("../data/states/uttarpradesh.js").then((m) => m.upColleges),
  // "kerala":       () => import("../data/states/kerala.js").then((m) => m.keralaColleges),
};

// Order to scrape states (prioritize by student population)
export const SCRAPE_ORDER = [
  "delhi", "maharashtra", "karnataka", "tamil_nadu", "telangana",
  "west_bengal", "rajasthan", "gujarat", "uttar_pradesh", "kerala",
  "andhra_pradesh", "madhya_pradesh", "punjab", "haryana", "bihar",
  "odisha", "assam", "jharkhand", "uttarakhand", "himachal_pradesh",
];

// ─────────────────────────────────────────────
// Scrape (load) one state into MongoDB
// ─────────────────────────────────────────────
export async function triggerStateScrape(stateName) {
  const loader = STATE_REGISTRY[stateName.toLowerCase()];

  if (!loader) {
    await logger.scraperError(`State "${stateName}" not yet in registry`, { state: stateName });
    return { success: false, message: `State "${stateName}" data not available yet` };
  }

  await logger.scraperStart(`Starting data load for state: ${stateName}`, { state: stateName });

  let colleges;
  try {
    colleges = await loader();
  } catch (err) {
    await logger.scraperError(`Failed to load ${stateName} data: ${err.message}`, { state: stateName });
    return { success: false, message: err.message };
  }

  let saved = 0, updated = 0, skipped = 0;

  for (const college of colleges) {
    try {
      await logger.scraperProg(
        `Processing: ${college.name}`,
        { state: stateName, data: { name: college.name, courses: college.courses?.length || 0 } }
      );

      const result = await University.findOneAndUpdate(
        { name: college.name },
        { $set: { ...college, last_updated: new Date() } },
        { upsert: true, new: true, runValidators: false }
      );

      if (result.isNew) {
        saved++;
        await logger.collegeSaved(
          `✅ Saved: ${college.name} (${college.courses?.length || 0} courses)`,
          { state: stateName, data: { name: college.name, type: college.type, ownership: college.ownership } }
        );
      } else {
        updated++;
        await logger.collegeSaved(
          `🔄 Updated: ${college.name}`,
          { state: stateName, data: { name: college.name } }
        );
      }
    } catch (err) {
      skipped++;
      await logger.scraperError(`Failed to save ${college.name}: ${err.message}`, { state: stateName });
    }
  }

  const summary = `✅ ${stateName} done — ${saved} saved, ${updated} updated, ${skipped} skipped`;
  await logger.scraperDone(summary, { state: stateName, data: { saved, updated, skipped, total: colleges.length } });

  return { success: true, saved, updated, skipped, total: colleges.length, state: stateName };
}

// ─────────────────────────────────────────────
// Run ALL available states in order
// ─────────────────────────────────────────────
export async function scrapeAllStates() {
  await logger.system("🚀 Starting full state-by-state scrape...");
  const results = [];

  for (const state of SCRAPE_ORDER) {
    if (!STATE_REGISTRY[state]) {
      await logger.system(`⏭️  Skipping ${state} — data file not added yet`);
      continue;
    }
    const result = await triggerStateScrape(state);
    results.push(result);

    // Small delay between states to be respectful
    await new Promise((r) => setTimeout(r, 300));
  }

  await logger.system(`🎉 All states scraped. Total: ${results.reduce((s, r) => s + (r.saved || 0), 0)} colleges saved`);
  return results;
}

// ─────────────────────────────────────────────
// Get scraping status (which states are done)
// ─────────────────────────────────────────────
export async function getScraperStatus() {
  const stateCounts = await University.aggregate([
    { $group: { _id: "$location.state", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    states_in_db:    stateCounts,
    states_available: Object.keys(STATE_REGISTRY),
    states_pending:   SCRAPE_ORDER.filter((s) => !STATE_REGISTRY[s]),
    total_colleges:  await University.countDocuments(),
    total_courses:   await University.aggregate([
      { $project: { count: { $size: "$courses" } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]).then((r) => r[0]?.total || 0),
  };
}
