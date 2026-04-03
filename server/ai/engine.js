  import fs from "fs";
  import path from "path";
  import { fileURLToPath } from "url";
  import { getAIResponses } from "./multiAI.js";
  import { mergeAIResponses } from "./merge.js";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  function loadJson(relativePath) {
    const fullPath = path.join(__dirname, "..", "data", relativePath);
    return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  }

  const careersData = loadJson("careers.json");
  const examsData = loadJson("exams.json");
  const universitiesData = loadJson("universities.json");

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
      const name = String(career.career || "").toLowerCase();
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

    return {
      careers: uniqueCareers,
      exams: examsData.slice(0, 5),
      universities: universitiesData.slice(0, 5),
      roadmap: uniqueCareers.flatMap((c) => c.alt_paths || []),
      aiSignals: aiResponses,
      updatedAt: new Date().toISOString(),
      summary: uniqueCareers.length
        ? `Matched ${uniqueCareers.length} career path(s) based on interests.`
        : "No strong match found yet. Add more interests for a better recommendation.",
    };
  }