import careersData from "../data/careers.json" with { type: "json" };
import examsData from "../data/exams.json" with { type: "json" };
import universitiesData from "../data/universities.json" with { type: "json" };
import { getAIResponses } from "./multiAI.js";
import { mergeAIResponses } from "./merge.js";

function normalizeInterests(interests) {
  if (Array.isArray(interests)) return interests.map((x) => String(x).toLowerCase());
  if (typeof interests === "string") {
    return interests
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function matchLocalCareers(interests) {
  const terms = normalizeInterests(interests);

  return careersData.filter((career) => {
    const name = career.career.toLowerCase();
    return terms.some((term) => {
      if (name.includes(term)) return true;
      if (term.includes("robot") && name.includes("robot")) return true;
      if ((term.includes("security") || term.includes("cyber")) && name.includes("security")) return true;
      return false;
    });
  });
}

export async function processStudent(data = {}) {
  const interests = data.interests;
  const localCareers = matchLocalCareers(interests);

  const aiResponses = await getAIResponses(JSON.stringify({ interests }));
  const aiCareerNames = mergeAIResponses(aiResponses);

  const aiMatchedCareers = careersData.filter((career) =>
    aiCareerNames.includes(career.career)
  );

  const combined = [...localCareers, ...aiMatchedCareers];
  const uniqueCareers = Array.from(
    new Map(combined.map((item) => [item.career, item])).values()
  );

  const careerNames = uniqueCareers.map((c) => c.career);
  const matchingExams = examsData.slice(0, 5);
  const matchingUniversities = universitiesData.slice(0, 5);

  return {
    careers: uniqueCareers,
    exams: matchingExams,
    universities: matchingUniversities,
    roadmap: uniqueCareers.flatMap((c) => c.alt_paths || []),
    aiSignals: aiResponses,
    updatedAt: new Date().toISOString(),
    summary: careerNames.length
      ? `Matched ${careerNames.length} career path(s) based on interests.`
      : "No strong match found yet. Add more interests for a better recommendation.",
  };
}
