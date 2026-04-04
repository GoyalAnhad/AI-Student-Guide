// server/ai/multiAI.js
// Queries GPT-4, Gemini, and Claude in parallel.
// Returns career recommendations AND university suggestions (AI knowledge, unverified).

import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Shared system prompt ────────────────────
const SYSTEM_PROMPT = `You are an expert Indian career guidance counsellor with deep knowledge of all Indian universities, degrees, and entrance exams.

Given a student's interests, marks, and stream, return ONLY a valid JSON object (no markdown, no extra text) with this exact shape:

{
  "careers": [
    { "title": "...", "confidence": 0-100, "reason": "..." }
  ],
  "degrees": ["full degree name like B.Tech CS, MA International Relations, etc."],
  "exams": ["real Indian exam names"],
  "skills": ["skill to develop"],
  "stream_recommendation": "Science | Commerce | Arts",
  "reasoning": "one-line summary",
  "universities": [
    {
      "name": "exact official university name",
      "shortName": "abbrev",
      "city": "city",
      "state": "state",
      "type": "IIT | NIT | Central | State | Deemed | Private | Law | Medical | Design | Other",
      "ownership": "Public | Private | Deemed",
      "relevant_courses": ["course name relevant to query"],
      "exams_accepted": ["exam name"],
      "website": "https://...",
      "why_relevant": "one-line reason"
    }
  ]
}

Rules:
- 3-5 career suggestions with confidence 0-100
- 5-10 REAL Indian universities (not fictional) that genuinely offer relevant courses
- Include both well-known and lesser-known regional universities if relevant
- Include universities from different states to give geographic diversity
- Use REAL exam names, REAL university names, REAL course names
- Return ONLY valid JSON`;

// ─── Build prompt from student data ─────────
function buildPrompt(studentData) {
  const { interests = [], marks = {}, stream = "Not specified", grade = "12th", query = "" } = studentData;
  const specificQuery = query || interests.join(", ");
  return `Student Profile:
- Specific interest/query: "${specificQuery}"
- Interests: ${interests.join(", ")}
- Grade: ${grade}
- Stream: ${stream}
- Marks: ${JSON.stringify(marks)}

Please suggest the best career paths AND list real Indian universities that offer relevant courses for "${specificQuery}".
Include universities from different regions/states of India.`;
}

// ─── GPT-4 ───────────────────────────────────
async function queryGPT(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { source: "gpt", skipped: true };
  try {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      temperature: 0.4, max_tokens: 2000,
    });
    const text = res.choices[0].message.content.trim();
    return { source: "gpt", data: JSON.parse(text) };
  } catch (err) {
    console.error("GPT error:", err.message);
    return { source: "gpt", error: err.message };
  }
}

// ─── Gemini ───────────────────────────────────
async function queryGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { source: "gemini", skipped: true };
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nStudent profile:\n${prompt}`);
    const text = result.response.text().trim().replace(/```json/g, "").replace(/```/g, "").trim();
    return { source: "gemini", data: JSON.parse(text) };
  } catch (err) {
    console.error("Gemini error:", err.message);
    return { source: "gemini", error: err.message };
  }
}

// ─── Claude ───────────────────────────────────
async function queryClaude(prompt) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return { source: "claude", skipped: true };
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].text.trim().replace(/```json/g, "").replace(/```/g, "").trim();
    return { source: "claude", data: JSON.parse(text) };
  } catch (err) {
    console.error("Claude error:", err.message);
    return { source: "claude", error: err.message };
  }
}

// ─── Fallback (no API keys) ──────────────────
function generateFallback(studentData) {
  const { interests = [], stream = "Science", query = "" } = studentData;
  const joined = (query + " " + interests.join(" ")).toLowerCase();

  const careerMap = [
    { kw: ["code","coding","program","software","cs","computer"],  career: "Software Engineer",       confidence: 85 },
    { kw: ["data","ml","ai","machine learning","statistics"],       career: "Data Scientist",           confidence: 80 },
    { kw: ["security","hack","cyber","network","ethical"],          career: "Cybersecurity Analyst",    confidence: 82 },
    { kw: ["robot","robotics","automat","mechatron","drone"],       career: "Robotics Engineer",        confidence: 80 },
    { kw: ["doctor","medicine","bio","health","neet","mbbs"],       career: "Doctor (MBBS)",            confidence: 85 },
    { kw: ["finance","money","bank","account","tax","ca","commerce"],career: "Chartered Accountant (CA)", confidence: 80 },
    { kw: ["law","legal","justice","debate","court","clat"],        career: "Lawyer / Advocate",        confidence: 80 },
    { kw: ["upsc","ias","government","civil services","admin"],     career: "Civil Services (IAS/IFS)", confidence: 80 },
    { kw: ["design","art","creative","ux","ui","graphic","nid"],    career: "UX/UI Designer",           confidence: 78 },
    { kw: ["invest","market","stock","trading","mba","iim"],        career: "Investment Banker",        confidence: 82 },
    { kw: ["geopolit","international","foreign","diplomacy","ir","strategic","security studies"], career: "Geopolitics Analyst", confidence: 82 },
    { kw: ["journal","media","news","report","write","content"],    career: "Journalist / Media Professional", confidence: 78 },
    { kw: ["social work","ngo","develop","community","tiss","welfare"], career: "Social Worker / Development Professional", confidence: 78 },
  ];

  const matched = careerMap
    .filter(({ kw }) => kw.some((k) => joined.includes(k)))
    .map(({ career, confidence }) => ({ title: career, confidence, reason: `Matched based on your interests` }));

  if (!matched.length) matched.push({ title: "Software Engineer", confidence: 70, reason: "In-demand high-growth career" });

  return {
    source: "fallback",
    data: {
      careers: matched.slice(0, 5),
      degrees: stream === "Arts" ? ["BA Political Science","MA International Relations","BA Sociology"] :
               stream === "Commerce" ? ["B.Com","MBA Finance","CA"] :
               ["B.Tech CS","M.Tech AI","B.Sc Data Science"],
      exams: stream === "Arts" ? ["CUET","JNUEE","UPSC CSE"] :
             stream === "Commerce" ? ["CUET","CAT","CA Foundation"] :
             ["JEE Main","JEE Advanced","GATE"],
      skills: ["Critical Thinking","Communication","Problem Solving","Research"],
      stream_recommendation: stream || "Science",
      reasoning: "Keyword-based fallback analysis",
      universities: [],  // No fallback universities — AI must provide
    },
  };
}

// ─── MAIN EXPORT ─────────────────────────────
export async function getAIResponses(studentData) {
  const prompt = buildPrompt(studentData);
  const [gptRes, geminiRes, claudeRes] = await Promise.allSettled([
    queryGPT(prompt), queryGemini(prompt), queryClaude(prompt),
  ]);

  const responses = [gptRes, geminiRes, claudeRes]
    .filter((r) => r.status === "fulfilled" && r.value && !r.value.error && !r.value.skipped)
    .map((r) => r.value);

  if (responses.length === 0) {
    console.warn("⚠️  No AI APIs — using fallback");
    return [generateFallback(studentData)];
  }
  return responses;
}
