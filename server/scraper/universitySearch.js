// server/scraper/universitySearch.js
// Attempts to verify AI-suggested universities by fetching their official websites.
// If fetching fails, marks the university as "unverified but AI-confirmed".

import axios from "axios";
import * as cheerio from "cheerio";
import University from "../models/University.js";

const TIMEOUT_MS = 8000;
const USER_AGENT = "Mozilla/5.0 (Educational Research Bot — career-guidance platform)";

// ─────────────────────────────────────────────
// Try to fetch basic info from a university website
// Returns { success, courses_found, description, status }
// ─────────────────────────────────────────────
async function tryFetchUniversityPage(url) {
  if (!url) return { success: false, status: "no_url" };

  try {
    const { data } = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": USER_AGENT },
      maxRedirects: 5,
    });

    const $ = cheerio.load(data);

    // Try to extract course/program names from page
    const courses_found = [];
    const programSelectors = [
      "a[href*='programme']", "a[href*='course']", "a[href*='department']",
      ".course-name", ".programme-name", ".dept-name", "li.course",
    ];

    for (const sel of programSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 5 && text.length < 100) {
          courses_found.push(text);
        }
      });
      if (courses_found.length > 3) break;
    }

    // Get page title and description
    const title = $("title").first().text().trim();
    const metaDesc = $("meta[name='description']").attr("content") || "";

    return {
      success: true,
      status: "success",
      page_title: title,
      description: metaDesc.slice(0, 200),
      courses_found: [...new Set(courses_found)].slice(0, 5),
    };
  } catch (err) {
    const status = err.code === "ECONNREFUSED" ? "blocked" :
                   err.code === "ETIMEDOUT"    ? "timeout" :
                   err.response?.status === 403 ? "blocked" :
                   err.response?.status === 404 ? "not_found" : "failed";

    return { success: false, status, error: err.message };
  }
}

// ─────────────────────────────────────────────
// Guess a university's website from its name
// ─────────────────────────────────────────────
function guessWebsite(uniName) {
  // Known mappings for common universities
  const known = {
    "iit delhi":   "https://home.iitd.ac.in",
    "iit bombay":  "https://www.iitb.ac.in",
    "iit madras":  "https://www.iitm.ac.in",
    "iit kanpur":  "https://www.iitk.ac.in",
    "iit roorkee": "https://www.iitr.ac.in",
    "iit kharagpur": "https://www.iitkgp.ac.in",
    "iit guwahati": "https://www.iitg.ac.in",
    "nit trichy":  "https://www.nitt.edu",
    "bits pilani": "https://www.bits-pilani.ac.in",
    "vit":         "https://vit.ac.in",
    "jnu":         "https://www.jnu.ac.in",
    "du":          "https://www.du.ac.in",
    "delhi university": "https://www.du.ac.in",
    "aiims":       "https://www.aiims.edu",
    "iisc":        "https://www.iisc.ac.in",
    "nlsiu":       "https://nls.ac.in",
    "tiss":        "https://www.tiss.edu",
    "nid":         "https://www.nid.edu",
    "iim ahmedabad": "https://www.iima.ac.in",
    "bhu":         "https://www.bhu.ac.in",
    "ashoka":      "https://www.ashoka.edu.in",
    "manipal":     "https://manipal.edu",
    "iimc":        "https://www.iimc.nic.in",
    "ftii":        "https://www.ftii.ac.in",
  };

  const lower = uniName.toLowerCase();
  for (const [key, url] of Object.entries(known)) {
    if (lower.includes(key)) return url;
  }

  // Auto-generate guess: convert to .edu.in or .ac.in
  const words = uniName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w) => !["of","the","and","for","in","at","a"].includes(w))
    .slice(0, 3);

  return `https://www.${words.join("")}.ac.in`;
}

// ─────────────────────────────────────────────
// Main: Verify a list of AI-suggested universities.
// Returns them classified as verified / unverified.
// ─────────────────────────────────────────────
export async function verifyAIUniversities(aiUniversities) {
  const results = [];

  // Run verifications in small batches to avoid hammering servers
  const batchSize = 3;
  for (let i = 0; i < aiUniversities.length; i += batchSize) {
    const batch = aiUniversities.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((u) => verifyOne(u))
    );
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
    // Small delay between batches
    if (i + batchSize < aiUniversities.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

async function verifyOne(aiUni) {
  // 1. Check if already in our MongoDB
  const dbMatch = await University.findOne({
    $or: [
      { name: { $regex: aiUni.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { shortName: { $regex: aiUni.shortName || "___NOMATCH___", $options: "i" } },
    ],
  });

  if (dbMatch) {
    return {
      ...aiUni,
      is_verified: true,
      data_source: "database",
      db_id: dbMatch._id,
      nirf_ranking: dbMatch.nirf_ranking,
      avg_placement_lpa: dbMatch.avg_placement_lpa,
      verification_note: "✅ Verified in our database",
    };
  }

  // 2. Try to scrape the university website
  const url = aiUni.website || guessWebsite(aiUni.name);
  const scrapeResult = await tryFetchUniversityPage(url);

  const verified = {
    ...aiUni,
    website: url,
    is_verified: false,
    data_source: "ai_suggested",
    scrape_status: scrapeResult.status,
  };

  if (scrapeResult.success) {
    verified.is_verified = true;
    verified.data_source = "ai_suggested+web_verified";
    verified.page_title = scrapeResult.page_title;
    verified.verification_note = "✅ Website accessible — details from AI";
    if (scrapeResult.courses_found?.length) {
      verified.scraped_programs = scrapeResult.courses_found;
    }
  } else {
    verified.is_verified = false;
    const statusMsg = {
      blocked:   "⚠️ Website blocked our access",
      timeout:   "⚠️ Website timed out",
      not_found: "⚠️ Website not found",
      no_url:    "⚠️ No website URL available",
      failed:    "⚠️ Could not reach website",
    }[scrapeResult.status] || "⚠️ Could not verify";

    verified.verification_note = `${statusMsg} — info from AI knowledge only`;
    verified.scrape_error = scrapeResult.error;
  }

  // 3. Optionally save new AI-suggested university to DB for caching
  try {
    await University.updateOne(
      { name: aiUni.name },
      {
        $setOnInsert: {
          name:        aiUni.name,
          shortName:   aiUni.shortName,
          location:    { city: aiUni.city, state: aiUni.state },
          type:        aiUni.type || "Other",
          ownership:   aiUni.ownership || "Unknown",
          website:     url,
          is_verified: verified.is_verified,
          data_source: "ai_suggested",
          scrape_status: scrapeResult.status,
          tags:        aiUni.relevant_courses || [],
          courses:     (aiUni.relevant_courses || []).map((c) => ({
            name: c, stream: "Any", source: "ai_suggested",
          })),
          last_updated: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (_) { /* ignore — caching is best-effort */ }

  return verified;
}
