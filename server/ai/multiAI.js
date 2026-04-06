// server/ai/multiAI.js
// Universal multi-AI router for Indian academic guidance.
// - OpenAI: structured JSON output
// - Gemini: JSON mode + system prompt
// - Claude: system prompt + JSON parsing
// - Fallback: pattern matching only

import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPT = `You are an expert Indian academic counsellor with comprehensive knowledge of ALL Indian universities, degrees, and academic programs.

Given a student's query, interests, subjects, marks and stream — return ONLY valid JSON (no markdown, no explanation) with this shape:

{
  "degrees": [
    {
      "name": "exact full degree name",
      "duration": "3 years",
      "stream_required": "Science (PCM) | Science (PCB) | Arts | Commerce | Any",
      "min_marks_typical": 55,
      "why_relevant": "one line reason specific to the query",
      "career_paths": ["Career 1", "Career 2"]
    }
  ],
  "careers": [
    { "title": "Job Title", "confidence": 85, "reason": "why" }
  ],
  "exams_needed": ["CUET", "NEET", "JEE Main", "CLAT"],
  "skills": ["Skill 1", "Skill 2"],
  "stream_recommendation": "Science | Commerce | Arts | Any",
  "reasoning": "one line summary",
  "universities": [
    {
      "name": "exact official university name",
      "shortName": "short name",
      "city": "city name",
      "state": "state name",
      "type": "IIT | NIT | IIIT | Central | State | Deemed | Private | Law | Medical | Design | Other",
      "ownership": "Public | Private",
      "relevant_courses": ["exact course name from this university"],
      "exams_accepted": ["exam names"],
      "min_marks_typical": 55,
      "website": "https://official-url.ac.in",
      "why_relevant": "specific reason this university suits the query"
    }
  ]
}

CRITICAL RULES:
1. Suggest DEGREES first — be specific.
2. Include 4-6 degrees from basic/accessible to advanced/research.
3. min_marks_typical must be realistic.
4. Suggest 6-10 universities that genuinely have the relevant department.
5. Include universities from different Indian states for geographic diversity.
6. If query is niche, still suggest the specific departments that exist.
7. Return ONLY valid JSON — no extra text.
8. For writing/literature queries, prioritize English, Journalism, Mass Communication, Creative Writing, Publishing, Editing, and Content careers; do NOT suggest law unless the user explicitly mentions legal studies.`;

/** Build the user prompt from the student data. */
function buildPrompt(studentData) {
  const { query = "", interests = [], marks = {}, stream, grade, subjects = [] } = studentData;
  const pct = Number(marks?.percentage || 0);
  const mainQuery = String(query || interests.join(", ") || "").trim();

  return `Student wants to study: "${mainQuery || "not specified"}"
Additional interests: ${interests.filter((i) => i && i !== query).join(", ") || "none"}
Current subjects: ${subjects.length ? subjects.join(", ") : "not specified"}
Grade/Level: ${grade || "12th"} | Stream: ${stream || "not decided"}
Marks: ${pct ? `${pct}% in 12th` : "not specified"}

Find the best DEGREES and UNIVERSITIES in India for "${mainQuery || "the student's interests"}".
${pct ? `Student has ${pct}% — include a mix of safe, mid, and aspirational options.` : "Include a range from competitive to accessible options."}
Be specific to the query.`;
}

function resolveGeminiModel() {
  const raw = String(process.env.GEMINI_MODEL || "").trim();
  const fallback = "gemini-2.0flash";
  if (!raw) return fallback;

  const deprecated = new Set([
    "gemini-2.0-flash",
    "gemini-2.0-flash-latest",
    "gemini-2.0-pro",
    "gemini-2.0-pro-latest",
    "gemini-pro",
    "gemini-pro-vision",
  ]);

  if (deprecated.has(raw.toLowerCase())) return fallback;
  return raw;
}

function isGeminiModelError(err) {
  const msg = String(err?.message || "");
  return err?.status === 404 || /not found|unsupported for generatecontent|invalid model/i.test(msg);
}

function extractResponseText(result) {
  try {
    const direct = result?.response?.text?.();
    if (direct) return direct;
  } catch (_) {}
  return "";
}

/** Clean code fences and try to recover JSON from messy model output. */
function extractJson(text = "") {
  const cleaned = String(text)
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to pull the first JSON object/array out of the text.
    const firstObj = cleaned.indexOf("{");
    const lastObj = cleaned.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      const slice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }

    const firstArr = cleaned.indexOf("[");
    const lastArr = cleaned.lastIndexOf("]");
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      const slice = cleaned.slice(firstArr, lastArr + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }

    return null;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampText(value, maxLen = 240) {
  const s = String(value ?? "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + "…";
}

function normalizeDegree(d = {}) {
  return {
    name: clampText(d.name, 120) || "Unknown degree",
    duration: clampText(d.duration, 20) || "3 years",
    stream_required: clampText(d.stream_required, 40) || "Any",
    min_marks_typical: Number.isFinite(Number(d.min_marks_typical)) ? Number(d.min_marks_typical) : 50,
    why_relevant: clampText(d.why_relevant, 220) || "",
    career_paths: asArray(d.career_paths).map((x) => clampText(x, 60)).filter(Boolean).slice(0, 5),
  };
}

function normalizeCareer(c = {}) {
  return {
    title: clampText(c.title, 80) || "Career",
    confidence: Number.isFinite(Number(c.confidence)) ? Math.max(0, Math.min(100, Number(c.confidence))) : 60,
    reason: clampText(c.reason, 220) || "",
  };
}

function normalizeUniversity(u = {}) {
  return {
    name: clampText(u.name, 140) || "Unknown university",
    shortName: clampText(u.shortName, 60) || "",
    city: clampText(u.city, 60) || "",
    state: clampText(u.state, 60) || "",
    type: clampText(u.type, 20) || "Other",
    ownership: /private/i.test(String(u.ownership)) ? "Private" : "Public",
    relevant_courses: asArray(u.relevant_courses).map((x) => clampText(x, 100)).filter(Boolean).slice(0, 5),
    exams_accepted: asArray(u.exams_accepted).map((x) => clampText(x, 40)).filter(Boolean).slice(0, 5),
    min_marks_typical: Number.isFinite(Number(u.min_marks_typical)) ? Number(u.min_marks_typical) : 55,
    website: clampText(u.website, 180) || "",
    why_relevant: clampText(u.why_relevant, 220) || "",
  };
}

function normalizeAIResult(data = {}, studentData = {}) {
  const query = String(studentData?.query || studentData?.interests?.join(", ") || "").trim();

  const degrees = asArray(data.degrees).map(normalizeDegree).slice(0, 6);
  const careers = asArray(data.careers).map(normalizeCareer).slice(0, 6);
  const universities = asArray(data.universities).map(normalizeUniversity).slice(0, 10);
  const examsNeeded = asArray(data.exams_needed).map((x) => clampText(x, 40)).filter(Boolean).slice(0, 8);
  const skills = asArray(data.skills).map((x) => clampText(x, 50)).filter(Boolean).slice(0, 8);

  return {
    degrees: degrees.length ? degrees : [],
    careers: careers.length ? careers : [{ title: query || "General career", confidence: 50, reason: "Fallback result" }],
    exams_needed: examsNeeded,
    skills: skills.length ? skills : ["Research", "Communication", "Critical Thinking"],
    stream_recommendation: clampText(data.stream_recommendation, 30) || "Any",
    reasoning: clampText(data.reasoning, 240) || "",
    universities,
  };
}

function buildFallbackPayload({
  degrees,
  careers,
  exams,
  stream,
  reasoning,
}) {
  return {
    degrees,
    careers: careers.map((c) => ({ ...c, reason: c.reason || "Matched from your query" })),
    exams_needed: exams,
    skills: ["Research", "Communication", "Critical Thinking", "Subject Knowledge", "Writing"],
    stream_recommendation: stream,
    reasoning,
    universities: [],
  };
}

/** OpenAI */
async function queryGPT(prompt, sessionId, studentData) {
  if (!process.env.OPENAI_API_KEY) return { source: "gpt", skipped: true };

  const t = Date.now();
  await logger.aiRequest("Sending request to GPT-4o-mini...", {
    source: "gpt",
    session_id: sessionId,
  });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const text = res?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(text);

    if (!parsed) throw new Error("OpenAI returned invalid JSON");

    const data = normalizeAIResult(parsed, studentData);

    await logger.aiResponse(
      `✅ GPT response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      {
        source: "gpt",
        session_id: sessionId,
        duration_ms: Date.now() - t,
        data: {
          degrees: data.degrees?.map((d) => d.name),
          top_uni: data.universities?.[0]?.name,
        },
      }
    );

    return { source: "gpt", data };
  } catch (err) {
    await logger.aiError(`GPT error: ${err.message}`, {
      source: "gpt",
      session_id: sessionId,
    });
    return { source: "gpt", error: err.message };
  }
}

/** Gemini */
async function queryGemini(prompt, sessionId, studentData) {
  if (!process.env.GEMINI_API_KEY) return { source: "gemini", skipped: true };

  const t = Date.now();
  const modelName = resolveGeminiModel();

  await logger.aiRequest(`Sending request to Gemini... (${modelName})`, {
    source: "gemini",
    session_id: sessionId,
    model: modelName,
  });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const run = async (name) => {
      const model = genAI.getGenerativeModel({
        model: name,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent(prompt);
      const text = extractResponseText(result).trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = extractJson(text);
      if (!parsed) throw new Error("Gemini returned invalid JSON");
      return parsed;
    };

    let parsed;
    try {
      parsed = await run(modelName);
    } catch (err) {
      if (isGeminiModelError(err) && modelName !== "gemini-2.0-flash") {
        await logger.system(`Gemini model ${modelName} unavailable; retrying with gemini-2.0-flash`);
        parsed = await run("gemini-2.0-flash");
      } else {
        throw err;
      }
    }

    const data = normalizeAIResult(parsed, studentData);

    await logger.aiResponse(
      `✅ Gemini response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      {
        source: "gemini",
        session_id: sessionId,
        duration_ms: Date.now() - t,
        data: {
          degrees: data.degrees?.map((d) => d.name),
          top_uni: data.universities?.[0]?.name,
          model: modelName,
        },
      }
    );

    return { source: "gemini", data };
  } catch (err) {
    await logger.aiError(`Gemini error: ${err.message}`, {
      source: "gemini",
      session_id: sessionId,
      model: modelName,
    });
    return { source: "gemini", error: err.message };
  }
}

/** Claude */
async function queryClaude(prompt, sessionId, studentData) {
  if (!process.env.CLAUDE_API_KEY) return { source: "claude", skipped: true };

  const modelName = String(process.env.CLAUDE_MODEL || "").trim();
  if (!modelName) return { source: "claude", skipped: true };

  const t = Date.now();
  await logger.aiRequest("Sending request to Claude...", {
    source: "claude",
    session_id: sessionId,
  });

  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const msg = await client.messages.create({
      model: modelName,
      max_tokens: 3000,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg?.content?.[0]?.text || "";
    const parsed = extractJson(text);

    if (!parsed) throw new Error("Claude returned invalid JSON");

    const data = normalizeAIResult(parsed, studentData);

    await logger.aiResponse(
      `✅ Claude response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      {
        source: "claude",
        session_id: sessionId,
        duration_ms: Date.now() - t,
        data: {
          degrees: data.degrees?.map((d) => d.name),
          top_uni: data.universities?.[0]?.name,
        },
      }
    );

    return { source: "claude", data };
  } catch (err) {
    await logger.aiError(`Claude error: ${err.message}`, {
      source: "claude",
      session_id: sessionId,
    });
    return { source: "claude", error: err.message };
  }
}

/**
 * UNIVERSAL FALLBACK
 * Used only when all AI APIs are missing or failing.
 * This keeps results relevant and avoids random matches like "lawyer" for "writing".
 */
function universalFallback(studentData) {
  const query = String(studentData?.query || "").trim();
  const interests = asArray(studentData?.interests).map(String);
  const stream = String(studentData?.stream || "Any").trim();

  const q = `${query} ${interests.join(" ")}`.toLowerCase();

  const patterns = [
    {
      test: /writing|literature|english|poetry|creative writing|journalism|mass communication|content writing|editor|copywriting/,
      degrees: [
        {
          name: "B.A. (Hons.) English",
          duration: "3 years",
          stream_required: "Arts",
          min_marks_typical: 50,
          why_relevant: "Strong base for writing, literature, editing, publishing, and content careers.",
          career_paths: ["Writer", "Editor", "Content Strategist", "Copywriter"],
        },
        {
          name: "B.A. Journalism and Mass Communication",
          duration: "3 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Best for news writing, media, reporting, and digital content.",
          career_paths: ["Journalist", "News Reporter", "Editor", "Media Professional"],
        },
        {
          name: "B.A. English Literature",
          duration: "3 years",
          stream_required: "Arts",
          min_marks_typical: 50,
          why_relevant: "Directly matches literature-focused interests and critical reading.",
          career_paths: ["Writer", "Teacher", "Researcher", "Editorial Assistant"],
        },
        {
          name: "M.A. English",
          duration: "2 years",
          stream_required: "Graduation in any relevant humanities subject",
          min_marks_typical: 55,
          why_relevant: "Advanced route for literary study, teaching, and research.",
          career_paths: ["Professor", "Editor", "Researcher", "Author"],
        },
        {
          name: "Diploma in Creative Writing",
          duration: "6 months - 1 year",
          stream_required: "Any",
          min_marks_typical: 40,
          why_relevant: "Useful for practical writing, storytelling, and publishing skills.",
          career_paths: ["Content Writer", "Script Writer", "Freelance Writer"],
        },
      ],
      careers: [
        { title: "Writer", confidence: 94, reason: `Strong match for "${query}"` },
        { title: "Journalist", confidence: 88, reason: `Strong match for "${query}"` },
        { title: "Editor", confidence: 86, reason: `Strong match for "${query}"` },
        { title: "Content Strategist", confidence: 84, reason: `Strong match for "${query}"` },
      ],
      exams: ["CUET", "University entrance exams", "English proficiency tests where applicable"],
      stream: "Arts",
      reasoning: `Your query is best matched with writing, English, literature, and media programs.`,
    },
    {
      test: /law|legal|advocate|litigation|court|judicial/,
      degrees: [
        {
          name: "B.A. LL.B.",
          duration: "5 years",
          stream_required: "Any",
          min_marks_typical: 55,
          why_relevant: "Core integrated law degree for legal practice.",
          career_paths: ["Lawyer", "Advocate", "Legal Advisor", "Policy Analyst"],
        },
        {
          name: "LL.B.",
          duration: "3 years",
          stream_required: "Graduation in any stream",
          min_marks_typical: 55,
          why_relevant: "Professional law degree after graduation.",
          career_paths: ["Lawyer", "Legal Consultant", "Corporate Counsel"],
        },
      ],
      careers: [{ title: "Lawyer", confidence: 92, reason: `Direct legal query match: "${query}"` }],
      exams: ["CLAT", "AILET", "LSAT India", "University entrance exams"],
      stream: "Arts",
      reasoning: `Your query is legal-focused, so law degrees are the best fit.`,
    },
    {
      test: /geopol|international relation|foreign policy|diplomac|strategic studi|security stud|global affair/,
      degrees: [
        {
          name: "B.A. (Hons.) Political Science",
          duration: "3 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Foundation for geopolitics, public policy, and international relations.",
          career_paths: ["Policy Analyst", "Diplomat", "Research Assistant", "Journalist"],
        },
        {
          name: "B.A. Geography",
          duration: "3 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Useful for geopolitical analysis, GIS, and regional studies.",
          career_paths: ["Geopolitical Analyst", "GIS Analyst", "Researcher"],
        },
        {
          name: "M.A. International Relations / International Studies",
          duration: "2 years",
          stream_required: "Graduation in any relevant subject",
          min_marks_typical: 55,
          why_relevant: "Specialized study for geopolitics and foreign policy roles.",
          career_paths: ["Foreign Policy Analyst", "Diplomat", "Think Tank Researcher"],
        },
      ],
      careers: [
        { title: "Geopolitics Analyst", confidence: 93, reason: `Strong match for "${query}"` },
        { title: "Diplomat", confidence: 87, reason: `Strong match for "${query}"` },
        { title: "Policy Researcher", confidence: 82, reason: `Strong match for "${query}"` },
      ],
      exams: ["CUET", "JNUEE", "UPSC CSE"],
      stream: "Arts",
      reasoning: `Your query fits political science, IR, and strategic studies.`,
    },
    {
      test: /architect|urban plan|interior design|landscape|built environment/,
      degrees: [
        {
          name: "B.Arch",
          duration: "5 years",
          stream_required: "Science (Maths required)",
          min_marks_typical: 60,
          why_relevant: "Core professional degree for architecture.",
          career_paths: ["Architect", "Urban Planner", "Interior Designer", "Landscape Architect"],
        },
        {
          name: "B.Des Interior Design",
          duration: "4 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Design-focused degree for interiors and spatial planning.",
          career_paths: ["Interior Designer", "Space Planner", "Set Designer"],
        },
        {
          name: "B.Planning",
          duration: "4 years",
          stream_required: "Any relevant stream",
          min_marks_typical: 50,
          why_relevant: "Useful for city planning and urban development.",
          career_paths: ["Town Planner", "Urban Policy Analyst", "Smart City Planner"],
        },
      ],
      careers: [
        { title: "Architect", confidence: 92, reason: `Strong match for "${query}"` },
        { title: "Urban Planner", confidence: 84, reason: `Strong match for "${query}"` },
      ],
      exams: ["NATA", "JEE Main Paper 2", "Design entrance exams"],
      stream: "Science",
      reasoning: `Your query fits architecture and planning paths.`,
    },
    {
      test: /psycholog|mental health|counsell|behaviour|therapy|cognitive/,
      degrees: [
        {
          name: "B.A. / B.Sc Psychology",
          duration: "3 years",
          stream_required: "Arts or Science",
          min_marks_typical: 50,
          why_relevant: "Foundation degree for psychology and counselling.",
          career_paths: ["Psychologist", "Counsellor", "HR Specialist", "UX Researcher"],
        },
        {
          name: "M.A. / M.Sc Clinical Psychology",
          duration: "2 years",
          stream_required: "Relevant graduation",
          min_marks_typical: 55,
          why_relevant: "Advanced mental health and clinical practice track.",
          career_paths: ["Clinical Psychologist", "Therapist", "School Counsellor"],
        },
      ],
      careers: [{ title: "Psychologist / Counsellor", confidence: 90, reason: `Strong match for "${query}"` }],
      exams: ["CUET", "University entrance exams", "NIMHANS / TISS tests where applicable"],
      stream: "Arts",
      reasoning: `Your query aligns with psychology and counselling.`,
    },
    {
      test: /environment|ecology|wildlif|conservation|forest|biodiversit|climate|marine|oceanograph|botan|zoolog/,
      degrees: [
        {
          name: "B.Sc Environmental Science",
          duration: "3 years",
          stream_required: "Science",
          min_marks_typical: 50,
          why_relevant: "Direct route into ecology, sustainability, and environment careers.",
          career_paths: ["Environmental Scientist", "Climate Researcher", "Conservation Officer"],
        },
        {
          name: "B.Sc Zoology",
          duration: "3 years",
          stream_required: "Science",
          min_marks_typical: 50,
          why_relevant: "Useful for wildlife and biological sciences.",
          career_paths: ["Zoologist", "Wildlife Biologist", "Conservation Officer"],
        },
        {
          name: "B.Sc Botany",
          duration: "3 years",
          stream_required: "Science",
          min_marks_typical: 50,
          why_relevant: "Useful for plant biology, ecology, and forest-related roles.",
          career_paths: ["Botanist", "Ecologist", "Forest Officer"],
        },
        {
          name: "M.Sc Marine Biology / Oceanography",
          duration: "2 years",
          stream_required: "Relevant graduation",
          min_marks_typical: 55,
          why_relevant: "Advanced specialization for marine and ocean careers.",
          career_paths: ["Marine Biologist", "Oceanographer", "Marine Conservationist"],
        },
      ],
      careers: [
        { title: "Environmental Scientist", confidence: 88, reason: `Strong match for "${query}"` },
        { title: "Wildlife Biologist", confidence: 83, reason: `Strong match for "${query}"` },
      ],
      exams: ["CUET", "JAM", "University entrance exams"],
      stream: "Science",
      reasoning: `Your query fits environmental and life sciences.`,
    },
    {
      test: /film|cinema|direction|screenplay|animation|vfx|visual effect|ott|web series/,
      degrees: [
        {
          name: "B.A. Film Studies",
          duration: "3 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Best for cinema theory, criticism, and production understanding.",
          career_paths: ["Film Critic", "Producer", "Director", "Journalist"],
        },
        {
          name: "B.Sc Animation & VFX",
          duration: "3-4 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Useful for animation, motion graphics, and visual effects.",
          career_paths: ["Animator", "VFX Artist", "Motion Graphics Designer"],
        },
        {
          name: "Diploma in Direction & Screenplay",
          duration: "1-3 years",
          stream_required: "Any",
          min_marks_typical: 50,
          why_relevant: "Practical training for film direction and screenplay writing.",
          career_paths: ["Film Director", "Screenwriter", "Content Creator"],
        },
      ],
      careers: [
        { title: "Film Director", confidence: 88, reason: `Strong match for "${query}"` },
        { title: "Animator / VFX Artist", confidence: 82, reason: `Strong match for "${query}"` },
      ],
      exams: ["FTII Entrance", "SRFTI Entrance", "IIMC Entrance"],
      stream: "Arts",
      reasoning: `Your query fits film, animation, and media production.`,
    },
    {
      test: /social work|ngo|development|community|human right|welfare|rural development|poverty/,
      degrees: [
        {
          name: "B.S.W. / B.A. Social Work",
          duration: "3 years",
          stream_required: "Any",
          min_marks_typical: 45,
          why_relevant: "Foundation for NGO and development work.",
          career_paths: ["Social Worker", "NGO Professional", "Community Development Officer"],
        },
        {
          name: "M.S.W. / M.A. Social Work",
          duration: "2 years",
          stream_required: "Graduation in any relevant subject",
          min_marks_typical: 50,
          why_relevant: "Professional qualification in social work and development.",
          career_paths: ["Senior Social Worker", "NGO Manager", "Policy Associate"],
        },
      ],
      careers: [{ title: "Social Worker", confidence: 89, reason: `Strong match for "${query}"` }],
      exams: ["TISS NET", "CUET", "University entrance exams"],
      stream: "Arts",
      reasoning: `Your query fits social work and development studies.`,
    },
    {
      test: /archaeolog|ancient histor|museum|heritage|excavat|indolog|numismatic/,
      degrees: [
        {
          name: "B.A. (Hons.) Archaeology",
          duration: "3 years",
          stream_required: "Arts",
          min_marks_typical: 50,
          why_relevant: "Direct route into archaeology and heritage studies.",
          career_paths: ["Archaeologist", "Museum Curator", "Heritage Officer"],
        },
        {
          name: "B.A. Ancient History",
          duration: "3 years",
          stream_required: "Arts",
          min_marks_typical: 50,
          why_relevant: "Supports archaeology, history, and heritage careers.",
          career_paths: ["Historian", "Researcher", "Curator"],
        },
        {
          name: "M.A. Archaeology",
          duration: "2 years",
          stream_required: "Relevant graduation",
          min_marks_typical: 55,
          why_relevant: "Advanced archaeology and excavation training.",
          career_paths: ["Archaeological Researcher", "Museum Director", "Heritage Consultant"],
        },
      ],
      careers: [{ title: "Archaeologist", confidence: 90, reason: `Strong match for "${query}"` }],
      exams: ["CUET", "University entrance exams"],
      stream: "Arts",
      reasoning: `Your query fits archaeology and heritage studies.`,
    },
  ];

  for (const pat of patterns) {
    if (pat.test.test(q)) {
      return {
        source: "fallback",
        data: normalizeAIResult(
          buildFallbackPayload({
            degrees: pat.degrees,
            careers: pat.careers,
            exams: pat.exams,
            stream: pat.stream,
            reasoning: pat.reasoning,
          }),
          studentData
        ),
      };
    }
  }

  // Generic fallback — still useful and safe.
  const prettyQuery = query
    ? query.charAt(0).toUpperCase() + query.slice(1)
    : "General Studies";

  return {
    source: "fallback",
    data: normalizeAIResult(
      {
        degrees: [
          {
            name: `B.A. (Hons.) ${prettyQuery}`,
            duration: "3 years",
            stream_required: stream || "Any",
            min_marks_typical: 50,
            why_relevant: "Broad degree aligned to your stated interest.",
            career_paths: [`${prettyQuery} Professional`, "Researcher", "Consultant"],
          },
          {
            name: `B.Sc. ${prettyQuery}`,
            duration: "3 years",
            stream_required: "Science",
            min_marks_typical: 50,
            why_relevant: "Broad science degree aligned to your stated interest.",
            career_paths: [`${prettyQuery} Professional`, "Researcher", "Analyst"],
          },
        ],
        careers: [
          { title: `${prettyQuery} Professional`, confidence: 60, reason: "Generic fallback result" },
        ],
        exams_needed: ["CUET"],
        skills: ["Research", "Communication", "Problem Solving"],
        stream_recommendation: stream || "Any",
        reasoning: "Please add a valid AI API key for better precision.",
        universities: [],
      },
      studentData
    ),
  };
}

/**
 * MAIN EXPORT
 * Returns an array of provider responses.
 * If all providers fail/missing, returns a universal fallback response.
 */
export async function getAIResponses(studentData) {
  const prompt = buildPrompt(studentData);
  const sessionId = studentData.session_id || "unknown";

  await logger.userQuery(
    `🔍 User query: "${studentData.query || studentData.interests?.join(", ")}" | Marks: ${
      studentData.marks?.percentage || "N/A"
    }%`,
    {
      session_id: sessionId,
      query: studentData.query,
      marks: studentData.marks?.percentage,
      stream: studentData.stream,
    }
  );

  const [gptRes, geminiRes, claudeRes] = await Promise.allSettled([
    queryGPT(prompt, sessionId, studentData),
    queryGemini(prompt, sessionId, studentData),
    queryClaude(prompt, sessionId, studentData),
  ]);

  const responses = [gptRes, geminiRes, claudeRes]
    .filter((r) => r.status === "fulfilled" && r.value && !r.value.error && !r.value.skipped)
    .map((r) => r.value);

  if (!responses.length) {
    await logger.system("⚠️ No AI APIs configured — using universal fallback");
    return [universalFallback(studentData)];
  }

  return responses;
}