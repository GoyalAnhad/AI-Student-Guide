// server/ai/validator.js
// Validates merged AI data against the DB.
// Supports filters: ownership (Public/Private), state, type.

import Career    from "../models/Career.js";
import University from "../models/University.js";
import Exam      from "../models/Exam.js";
import { verifyAIUniversities } from "../scraper/universitySearch.js";

// ─────────────────────────────────────────────
// MAIN ENTRY
// ─────────────────────────────────────────────
export async function validateAndEnrich(mergedData, studentData) {
  const {
    careers: aiCareers = [],
    exams:   aiExams   = [],
    skills:  aiSkills  = [],
    stream_recommendation,
    aiSuggestedUniversities = [],
    meta,
  } = mergedData;

  const { interests = [], marks = {}, filters = {} } = studentData;
  // filters: { ownership: "Public"|"Private"|"All", state: "...", type: "..." }

  // 1. Match careers from DB
  const dbCareers = await matchCareersFromDB(interests, stream_recommendation);

  // 2. Merge AI + DB careers
  const finalCareers = mergeCareers(aiCareers, dbCareers);

  // 3. Match exams from DB
  const careerTitles = finalCareers.map((c) => c.title);
  const validatedExams = await matchExamsFromDB(careerTitles, aiExams, stream_recommendation);

  // 4. DB-matched colleges (filtered)
  const dbColleges = await matchCollegesFromDB({
    interests,
    stream: stream_recommendation,
    exams:  validatedExams.map((e) => e.name),
    marks,
    filters,
  });

  // 5. Verify AI-suggested universities (scrape attempt)
  let verifiedAIUnis = [];
  if (aiSuggestedUniversities.length > 0) {
    console.log(`🔍 Verifying ${aiSuggestedUniversities.length} AI-suggested universities...`);
    verifiedAIUnis = await verifyAIUniversities(aiSuggestedUniversities);

    // Apply ownership filter to AI unis too
    if (filters.ownership && filters.ownership !== "All") {
      verifiedAIUnis = verifiedAIUnis.filter((u) =>
        !u.ownership || u.ownership === "Unknown" || u.ownership === filters.ownership ||
        (filters.ownership === "Public"  && u.ownership !== "Private") ||
        (filters.ownership === "Private" && u.ownership !== "Public")
      );
    }
  }

  // 6. Combine: DB colleges first (verified), then AI unis not already in DB list
  const dbNames = new Set(dbColleges.map((c) => c.name.toLowerCase()));
  const newAIUnis = verifiedAIUnis.filter((u) => !dbNames.has(u.name.toLowerCase()));

  const allColleges = [
    ...dbColleges,
    ...newAIUnis,
  ];

  // 7. Roadmap from top DB career
  const roadmap = dbCareers[0]?.roadmap || [];

  return {
    careers: finalCareers,
    exams:   validatedExams,
    colleges: allColleges,
    roadmap,
    skills:  aiSkills,
    stream_recommendation,
    meta,
  };
}

// ─────────────────────────────────────────────
// Match careers by keyword
// ─────────────────────────────────────────────
async function matchCareersFromDB(interests, stream) {
  const kw = interests.map((i) => i.toLowerCase().trim());
  const query = {
    $or: [
      { interests_matched: { $in: kw } },
      { keywords: { $in: kw } },
    ],
  };
  if (stream && stream !== "Any") query.$or.push({ stream });

  let careers = await Career.find(query).limit(5);
  if (!careers.length) {
    careers = await Career.find(
      stream ? { stream: { $in: [stream, "Any"] } } : {}
    ).limit(3);
  }
  return careers;
}

function mergeCareers(aiCareers, dbCareers) {
  const result = [];

  for (const db of dbCareers) {
    const aiMatch = aiCareers.find(
      (c) => c.title.toLowerCase().includes(db.title.toLowerCase()) ||
             db.title.toLowerCase().includes(c.title.toLowerCase())
    );
    result.push({
      title:        db.title,
      confidence:   aiMatch ? Math.min(100, aiMatch.confidence + 10) : 72,
      reason:       aiMatch?.reason || `Matched from your interests`,
      aiAgreement:  aiMatch?.aiAgreement || "📊 DB match",
      avg_salary:   db.avg_salary_lpa,
      growth:       db.growth_outlook,
      topCompanies: db.top_companies?.slice(0, 3) || [],
      isValidated:  true,
    });
  }

  for (const ai of aiCareers) {
    const already = result.some((r) => r.title.toLowerCase().includes(ai.title.toLowerCase()));
    if (!already && result.length < 5) {
      result.push({
        title:       ai.title,
        confidence:  Math.max(0, ai.confidence - 15),
        reason:      ai.reason,
        aiAgreement: ai.aiAgreement,
        isValidated: false,
        note:        "⚠️ AI suggestion — details may need verification",
      });
    }
  }
  return result.slice(0, 5);
}

// ─────────────────────────────────────────────
// Match exams from DB
// ─────────────────────────────────────────────
async function matchExamsFromDB(careerTitles, aiExams, stream) {
  const query = {
    $or: [
      { careers_accessible: { $in: careerTitles } },
      { name: { $in: aiExams } },
    ],
  };
  if (stream && stream !== "Any") {
    query.$or.push({ stream });
    query.$or.push({ stream: "Any" });
  }
  const exams = await Exam.find(query).limit(8);
  return exams.map((e) => ({
    name:            e.name,
    full_name:       e.full_name,
    type:            e.type,
    level:           e.level,
    conducting_body: e.conducting_body,
    exam_month:      e.schedule?.exam_month,
    website:         e.website,
    isValidated:     true,
  }));
}

// ─────────────────────────────────────────────
// Match DB colleges with filter support
// ─────────────────────────────────────────────
export async function matchCollegesFromDB({ interests, stream, exams = [], marks = {}, filters = {} }) {
  const interestTags = interests.map((i) => i.toLowerCase());

  // Build base filter
  const baseFilter = {};
  if (filters.ownership && filters.ownership !== "All") {
    baseFilter.ownership = filters.ownership;
  }
  if (filters.state) {
    baseFilter["location.state"] = { $regex: filters.state, $options: "i" };
  }
  if (filters.type) {
    baseFilter.type = filters.type;
  }

  const seenIds  = new Set();
  const colleges = [];

  // Query 1: interest tags + base filter
  await addResults(colleges, seenIds, {
    ...baseFilter,
    $or: [
      { tags: { $in: interestTags } },
      { "courses.tags": { $in: interestTags } },
    ],
  });

  // Query 2: exams accepted + base filter
  if (exams.length && colleges.length < 10) {
    await addResults(colleges, seenIds, {
      ...baseFilter,
      exams_accepted: { $in: exams },
    });
  }

  // Query 3: stream match + base filter
  if (colleges.length < 8) {
    await addResults(colleges, seenIds, {
      ...baseFilter,
      "courses.stream": { $in: [stream || "Science", "Any"] },
    });
  }

  // Query 4: just base filter (if we still have < 5)
  if (colleges.length < 5) {
    await addResults(colleges, seenIds, baseFilter);
  }

  return colleges.slice(0, 12).map((u) => ({
    name:              u.name,
    shortName:         u.shortName,
    location:          `${u.location?.city || ""}, ${u.location?.state || ""}`.replace(/^, |, $/, ""),
    type:              u.type,
    ownership:         u.ownership,
    nirf_ranking:      u.nirf_ranking,
    exams_accepted:    u.exams_accepted,
    avg_placement_lpa: u.avg_placement_lpa,
    website:           u.website,
    relevantCourses:   filterRelevantCourses(u.courses, interestTags, stream).slice(0, 4),
    top_recruiters:    u.top_recruiters?.slice(0, 3) || [],
    is_verified:       true,
    data_source:       "database",
  }));
}

async function addResults(results, seenIds, query) {
  const unis = await University.find(query).sort({ nirf_ranking: 1 }).limit(15);
  for (const u of unis) {
    const id = u._id.toString();
    if (!seenIds.has(id)) {
      seenIds.add(id);
      results.push(u);
    }
  }
}

function filterRelevantCourses(courses = [], interestTags, stream) {
  if (!courses.length) return [];
  const matched = courses.filter((c) =>
    c.tags?.some((t) => interestTags.some((i) => t.toLowerCase().includes(i) || i.includes(t.toLowerCase())))
  );
  if (matched.length) return matched;
  const streamMatch = courses.filter((c) => c.stream === stream || c.stream === "Any");
  return streamMatch.length ? streamMatch : courses;
}
