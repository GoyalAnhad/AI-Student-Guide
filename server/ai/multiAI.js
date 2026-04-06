// server/ai/multiAI.js
// Universal — works for ANY degree/field. No hardcoded keyword maps.
// AI does all the reasoning. Fallback uses pattern matching on query.

import { OpenAI }              from "openai";
import { GoogleGenerativeAI }  from "@google/generative-ai";
import Anthropic               from "@anthropic-ai/sdk";
import { logger }              from "../utils/logger.js";

const SYSTEM_PROMPT = `You are an expert Indian academic counsellor with comprehensive knowledge of ALL Indian universities, degrees, and academic programs.

Given a student's query, interests, subjects, marks and stream — return ONLY valid JSON (no markdown, no explanation) with this shape:

{
  "degrees": [
    {
      "name": "exact full degree name e.g. B.Sc Geology, M.A. Geopolitics, B.Arch Architecture",
      "duration": "3 years",
      "stream_required": "Science (PCM) | Arts | Commerce | Any",
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
1. Suggest DEGREES first — be specific (B.Sc Geology NOT just "Science degree")
2. Include 4-6 degrees from basic/accessible to advanced/research
3. min_marks_typical must be REALISTIC: IIT=90+, NIT=75+, Central Uni=55+, State Uni=50+, Private=60+
4. Suggest 6-10 universities that GENUINELY have the relevant department
5. Include universities from different Indian states for geographic diversity
6. If query is niche (geopolitics, marine biology, archaeology etc), still suggest the specific departments that exist
7. Return ONLY valid JSON — no extra text`;

function buildPrompt(studentData) {
  const { query = "", interests = [], marks = {}, stream, grade, subjects = [] } = studentData;
  const pct = marks.percentage || 0;
  const mainQuery = query || interests.join(", ");

  return `Student wants to study: "${mainQuery}"
Additional interests: ${interests.filter((i) => i !== query).join(", ") || "none"}
Current subjects: ${subjects.length ? subjects.join(", ") : "not specified"}
Grade/Level: ${grade || "12th"} | Stream: ${stream || "not decided"}
Marks: ${pct ? pct + "% in 12th" : "not specified"}

Find the best DEGREES and UNIVERSITIES in India for "${mainQuery}".
${pct ? `Student has ${pct}% — focus on realistic colleges. Include some aspirational (harder to get) and some safe (easier to get) options.` : "Include a range from highly competitive to accessible."}
Be specific to the query — if it's geology, suggest geology departments; if it's geopolitics, suggest IR departments; if it's architecture, suggest architecture schools.`;
}

// ── GPT ──────────────────────────────────────
async function queryGPT(prompt, sessionId) {
  if (!process.env.OPENAI_API_KEY) return { source: "gpt", skipped: true };
  const t = Date.now();
  await logger.aiRequest("Sending request to GPT-4o-mini...", { source: "gpt", session_id: sessionId });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      temperature: 0.3, max_tokens: 3000,
    });
    const text = res.choices[0].message.content.trim();
    const data = JSON.parse(text);
    await logger.aiResponse(
      `✅ GPT response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      { source: "gpt", session_id: sessionId, duration_ms: Date.now() - t, data: { degrees: data.degrees?.map((d) => d.name), top_uni: data.universities?.[0]?.name } }
    );
    return { source: "gpt", data };
  } catch (err) {
    await logger.aiError(`GPT error: ${err.message}`, { source: "gpt", session_id: sessionId });
    return { source: "gpt", error: err.message };
  }
}

// ── Gemini ────────────────────────────────────
async function queryGemini(prompt, sessionId) {
  if (!process.env.GEMINI_API_KEY) return { source: "gemini", skipped: true };
  const t = Date.now();
  await logger.aiRequest("Sending request to Gemini...", { source: "gemini", session_id: sessionId });
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${prompt}`);
    const text = result.response.text().trim().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    await logger.aiResponse(
      `✅ Gemini response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      { source: "gemini", session_id: sessionId, duration_ms: Date.now() - t, data: { degrees: data.degrees?.map((d) => d.name), top_uni: data.universities?.[0]?.name } }
    );
    return { source: "gemini", data };
  } catch (err) {
    await logger.aiError(`Gemini error: ${err.message}`, { source: "gemini", session_id: sessionId });
    return { source: "gemini", error: err.message };
  }
}

// ── Claude ────────────────────────────────────
async function queryClaude(prompt, sessionId) {
  if (!process.env.CLAUDE_API_KEY) return { source: "claude", skipped: true };
  const t = Date.now();
  await logger.aiRequest("Sending request to Claude...", { source: "claude", session_id: sessionId });
  try {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].text.trim().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    await logger.aiResponse(
      `✅ Claude response: ${data.degrees?.length || 0} degrees, ${data.universities?.length || 0} unis`,
      { source: "claude", session_id: sessionId, duration_ms: Date.now() - t, data: { degrees: data.degrees?.map((d) => d.name), top_uni: data.universities?.[0]?.name } }
    );
    return { source: "claude", data };
  } catch (err) {
    await logger.aiError(`Claude error: ${err.message}`, { source: "claude", session_id: sessionId });
    return { source: "claude", error: err.message };
  }
}

// ─────────────────────────────────────────────
// UNIVERSAL FALLBACK
// When no API keys are set — does basic pattern matching
// but returns generic degree structures, not hardcoded lists
// ─────────────────────────────────────────────
function universalFallback(studentData) {
  const { query = "", interests = [], stream = "Science" } = studentData;
  const q = (query + " " + interests.join(" ")).toLowerCase();

  // Pattern detection — broad categories
  const patterns = [
    { p: /geology|earth science|mineral|petrol|seismol|geomorph|litholog|stratigraphy/,
      degrees: [
        { name: "B.Sc Geology", duration: "3 years", stream_required: "Science (PCM or PCB)", min_marks_typical: 50, why_relevant: "Core geology degree available at many Indian universities", career_paths: ["Geologist", "Seismologist", "Mining Geologist", "Petroleum Geologist"] },
        { name: "B.Tech Geological Engineering", duration: "4 years", stream_required: "Science (PCM)", min_marks_typical: 70, why_relevant: "Engineering approach to geology — oil, mining, environment", career_paths: ["Geological Engineer", "Petroleum Engineer", "Environmental Engineer"] },
        { name: "B.Sc Applied Geology", duration: "3 years", stream_required: "Science", min_marks_typical: 50, why_relevant: "Applied geology for industry", career_paths: ["Mining Geologist", "Environmental Consultant", "Hydrologist"] },
        { name: "M.Sc Earth Sciences / Geology", duration: "2 years", stream_required: "Science (B.Sc required)", min_marks_typical: 55, why_relevant: "Advanced research in earth sciences", career_paths: ["Research Geologist", "University Professor", "ISRO Earth Sciences"] },
      ],
      stream: "Science", exams: ["CUET", "JEE Main (for B.Tech)", "JAM (for M.Sc)", "State university entrance"],
      careers: [{ title: "Geologist", confidence: 92 }, { title: "Mining Engineer", confidence: 78 }, { title: "Environmental Geologist", confidence: 75 }] },

    { p: /geopol|international relation|foreign policy|diplomac|strategic studi|security stud|global affair|ir studi/,
      degrees: [
        { name: "B.A. (Hons.) Political Science", duration: "3 years", stream_required: "Any stream eligible", min_marks_typical: 50, why_relevant: "Foundation for geopolitics and international relations", career_paths: ["Geopolitics Analyst", "Diplomat (IFS)", "Policy Analyst", "Journalist"] },
        { name: "B.A. (Hons.) Geography", duration: "3 years", stream_required: "Arts / Science", min_marks_typical: 50, why_relevant: "Geographic perspective on geopolitics", career_paths: ["Geopolitical Analyst", "Cartographer", "GIS Analyst"] },
        { name: "M.A. International Studies / Geopolitics", duration: "2 years", stream_required: "Any graduation", min_marks_typical: 55, why_relevant: "Specialized geopolitics & IR — JNU is the best", career_paths: ["Foreign Policy Analyst", "Diplomat", "Think Tank Researcher"] },
        { name: "M.A. Strategic & Security Studies", duration: "2 years", stream_required: "Any graduation", min_marks_typical: 55, why_relevant: "Defense, security and geopolitical strategy", career_paths: ["Strategic Analyst", "Defense Ministry Advisor", "NSA Officer", "Think Tank"] },
      ],
      stream: "Arts", exams: ["CUET", "JNUEE (JNU Entrance)", "UPSC CSE (for IFS/IAS)"],
      careers: [{ title: "Geopolitics Analyst", confidence: 92 }, { title: "Diplomat (IFS)", confidence: 85 }, { title: "Policy Researcher", confidence: 80 }] },

    { p: /architect|urban plan|build design|interior design|landscape/,
      degrees: [
        { name: "B.Arch (Bachelor of Architecture)", duration: "5 years", stream_required: "Science (Maths required)", min_marks_typical: 50, why_relevant: "Core architecture degree — mandatory for practising architect", career_paths: ["Architect", "Urban Planner", "Interior Designer", "Landscape Architect"] },
        { name: "B.Des Interior Design", duration: "4 years", stream_required: "Any", min_marks_typical: 50, why_relevant: "Interior spaces design", career_paths: ["Interior Designer", "Space Planner", "Set Designer"] },
        { name: "M.Arch (Master of Architecture)", duration: "2 years", stream_required: "B.Arch required", min_marks_typical: 50, why_relevant: "Advanced architecture specialization", career_paths: ["Senior Architect", "Urban Designer", "Professor"] },
        { name: "B.Planning (Urban & Regional Planning)", duration: "4 years", stream_required: "Science / Arts", min_marks_typical: 50, why_relevant: "City and regional planning", career_paths: ["Town Planner", "Smart Cities Expert", "Urban Policy Analyst"] },
      ],
      stream: "Science", exams: ["NATA (National Aptitude Test in Architecture)", "JEE Main (Paper 2)", "NID DAT (Design)"],
      careers: [{ title: "Architect", confidence: 92 }, { title: "Urban Planner", confidence: 80 }, { title: "Interior Designer", confidence: 78 }] },

    { p: /environment|ecology|wildlif|conservation|forest|biodiversit|climate|marine|oceanograph|zoolog|botan|nature|sea|coral/,
      degrees: [
        { name: "B.Sc Environmental Science", duration: "3 years", stream_required: "Science (PCB or PCM)", min_marks_typical: 50, why_relevant: "Comprehensive environment and ecosystems study", career_paths: ["Environmental Scientist", "Climate Researcher", "Conservation Officer"] },
        { name: "B.Sc Zoology", duration: "3 years", stream_required: "Science (PCB)", min_marks_typical: 50, why_relevant: "Wildlife and animal biology", career_paths: ["Wildlife Biologist", "Zoologist", "Conservation Officer"] },
        { name: "B.Sc Botany", duration: "3 years", stream_required: "Science (PCB)", min_marks_typical: 50, why_relevant: "Plant biology and ecology", career_paths: ["Botanist", "Ecologist", "Forest Officer"] },
        { name: "M.Sc Marine Biology / Oceanography", duration: "2 years", stream_required: "Science (B.Sc required)", min_marks_typical: 55, why_relevant: "Ocean and marine ecosystem study", career_paths: ["Marine Biologist", "Oceanographer", "Marine Conservationist"] },
        { name: "B.F.Sc (Fisheries Science)", duration: "4 years", stream_required: "Science (PCB)", min_marks_typical: 50, why_relevant: "Aquatic biology and fisheries management", career_paths: ["Fisheries Officer", "Aquaculture Scientist", "Marine Biologist"] },
      ],
      stream: "Science", exams: ["CUET", "JAM (for M.Sc)", "IFS (UPSC for forest service)"],
      careers: [{ title: "Environmental Scientist", confidence: 88 }, { title: "Wildlife Biologist", confidence: 82 }] },

    { p: /psycholog|counsell|mental health|behaviour|human mind|therapy|cognitive/,
      degrees: [
        { name: "B.A. / B.Sc Psychology", duration: "3 years", stream_required: "Arts or Science", min_marks_typical: 50, why_relevant: "Foundation psychology degree", career_paths: ["Psychologist", "Counsellor", "HR Specialist", "UX Researcher"] },
        { name: "M.A. / M.Sc Clinical Psychology", duration: "2 years", stream_required: "After B.A./B.Sc Psychology", min_marks_typical: 55, why_relevant: "Clinical practice in mental health", career_paths: ["Clinical Psychologist", "Therapist", "School Counsellor"] },
        { name: "M.Phil Clinical Psychology (RCI recognized)", duration: "2 years", stream_required: "M.Sc Psychology required", min_marks_typical: 55, why_relevant: "Required to practise clinical psychology in India", career_paths: ["Clinical Psychologist (RCI registered)", "Therapist"] },
      ],
      stream: "Arts", exams: ["CUET", "JNUEE", "NIMHANS entrance", "TISS NET"],
      careers: [{ title: "Psychologist / Counsellor", confidence: 88 }] },

    { p: /archaeolog|ancient histor|museum|heritage|excavat|indolog|numismatic/,
      degrees: [
        { name: "B.A. (Hons.) Archaeology", duration: "3 years", stream_required: "Arts (any stream eligible)", min_marks_typical: 50, why_relevant: "Study of ancient civilisations and excavation", career_paths: ["Archaeologist", "Museum Curator", "Heritage Conservation Officer"] },
        { name: "B.A. (Hons.) Ancient Indian History Culture & Archaeology", duration: "3 years", stream_required: "Arts", min_marks_typical: 50, why_relevant: "Deep study of India's ancient past", career_paths: ["Historian", "Archaeologist", "UPSC (History optional)"] },
        { name: "M.A. Archaeology", duration: "2 years", stream_required: "Arts graduation", min_marks_typical: 55, why_relevant: "Advanced archaeological research and fieldwork", career_paths: ["Archaeological Survey of India", "Museum Director", "UNESCO Heritage"] },
        { name: "M.A. Museum Studies", duration: "2 years", stream_required: "Any humanities graduation", min_marks_typical: 50, why_relevant: "Museum curation, preservation and management", career_paths: ["Museum Curator", "Art Historian", "Heritage Manager"] },
      ],
      stream: "Arts", exams: ["CUET", "BHU UET", "AMU entrance", "Deccan College entrance (for Archaeology)"],
      careers: [{ title: "Archaeologist", confidence: 90 }, { title: "Museum Curator", confidence: 82 }] },

    { p: /film|cinema|direction|cinematograph|screenplay|animation|vfx|visual effect|ott|web series/,
      degrees: [
        { name: "B.F.A. / Diploma in Direction & Screenplay (FTII)", duration: "3 years", stream_required: "Any stream", min_marks_typical: 50, why_relevant: "India's premier film institute — very competitive", career_paths: ["Film Director", "Screenwriter", "OTT Content Creator"] },
        { name: "B.Sc Animation & VFX", duration: "3-4 years", stream_required: "Any stream", min_marks_typical: 50, why_relevant: "Animation and visual effects for films and games", career_paths: ["Animator", "VFX Artist", "Game Designer", "Motion Graphics"] },
        { name: "B.A. Film Studies / Mass Communication", duration: "3 years", stream_required: "Arts", min_marks_typical: 50, why_relevant: "Theoretical and practical cinema studies", career_paths: ["Film Critic", "Producer", "Journalist", "Director"] },
        { name: "P.G. Diploma in Cinematography (FTII / SRFTI)", duration: "3 years", stream_required: "Any graduation", min_marks_typical: 50, why_relevant: "Professional cinematography training", career_paths: ["Cinematographer", "Camera Operator", "DOP"] },
      ],
      stream: "Arts", exams: ["FTII Entrance Exam", "SRFTI Entrance", "IIMC Entrance"],
      careers: [{ title: "Film Director / Filmmaker", confidence: 88 }, { title: "Animator / VFX Artist", confidence: 82 }] },

    { p: /social work|ngo|development|community|human right|welfare|rural development|poverty/,
      degrees: [
        { name: "B.A. Social Work / B.S.W.", duration: "3 years", stream_required: "Any stream", min_marks_typical: 45, why_relevant: "Foundation social work degree", career_paths: ["Social Worker", "NGO Professional", "Community Development Officer"] },
        { name: "M.S.W. / M.A. Social Work", duration: "2 years", stream_required: "Any graduation", min_marks_typical: 50, why_relevant: "Professional social work qualification", career_paths: ["Senior Social Worker", "NGO Manager", "UNICEF/World Bank", "Government (IAS/IPS)"] },
        { name: "M.A. Development Studies", duration: "2 years", stream_required: "Any graduation", min_marks_typical: 55, why_relevant: "Economic and social development policy", career_paths: ["Development Researcher", "Policy Analyst", "UN/UNDP", "World Bank"] },
      ],
      stream: "Arts", exams: ["TISS NET", "CUET", "JNUEE"],
      careers: [{ title: "Social Worker / Development Professional", confidence: 90 }] },

    { p: /music|vocal|instrumental|classical music|carnatic|hindustani|guitar|piano|composit|song/,
      degrees: [
        { name: "B.A. (Hons.) Music (Vocal/Instrumental)", duration: "3 years", stream_required: "Any stream", min_marks_typical: 45, why_relevant: "Classical and contemporary music study", career_paths: ["Musician", "Music Teacher", "Composer", "Performer"] },
        { name: "B.Mus (Bachelor of Music)", duration: "3-4 years", stream_required: "Any stream", min_marks_typical: 45, why_relevant: "Professional music degree", career_paths: ["Professional Musician", "Music Director", "Composer", "Music Teacher"] },
        { name: "M.A. / M.Mus Music", duration: "2 years", stream_required: "B.A./B.Mus Music", min_marks_typical: 50, why_relevant: "Advanced music research and performance", career_paths: ["University Professor", "Concert Performer", "Music Director"] },
        { name: "Diploma in Music Production / Sound Engineering", duration: "1-2 years", stream_required: "Any stream", min_marks_typical: 45, why_relevant: "Modern music production for studios and OTT", career_paths: ["Music Producer", "Sound Engineer", "Studio Recording Engineer"] },
      ],
      stream: "Arts", exams: ["DU Music Entrance", "BHU Music Entrance", "CUET"],
      careers: [{ title: "Musician / Performer", confidence: 88 }, { title: "Music Teacher / Professor", confidence: 75 }] },
  ];

  // Find matching pattern
  for (const pat of patterns) {
    if (pat.p.test(q)) {
      return {
        source: "fallback",
        data: {
          degrees: pat.degrees,
          careers: pat.careers.map((c) => ({ ...c, reason: `Direct match for your query: "${query}"` })),
          exams_needed: pat.exams,
          skills: ["Research", "Critical Thinking", "Communication", "Subject Knowledge", "Field Work"],
          stream_recommendation: pat.stream,
          reasoning: `Based on your interest in "${query}"`,
          universities: [],
        },
      };
    }
  }

  // Generic fallback — still useful
  return {
    source: "fallback",
    data: {
      degrees: [
        { name: `B.A. (Hons.) ${query.charAt(0).toUpperCase() + query.slice(1).split(" ")[0]}`, duration: "3 years", stream_required: stream || "Any", min_marks_typical: 50, why_relevant: `Core degree in your area of interest`, career_paths: [`${query} Professional`, "Researcher", "Consultant"] },
        { name: "B.Sc (General Science)", duration: "3 years", stream_required: "Science", min_marks_typical: 45, why_relevant: "Broad science base degree", career_paths: ["Various science fields"] },
      ],
      careers: [{ title: `${query} Professional`, confidence: 65, reason: "Based on your query" }],
      exams_needed: ["CUET"],
      skills: ["Research", "Communication", "Problem Solving"],
      stream_recommendation: stream || "Science",
      reasoning: "Please add an AI API key for more precise results",
      universities: [],
    },
  };
}

// ─── MAIN EXPORT ──────────────────────────────
export async function getAIResponses(studentData) {
  const prompt = buildPrompt(studentData);
  const sessionId = studentData.session_id || "unknown";

  await logger.userQuery(
    `🔍 User query: "${studentData.query || studentData.interests?.join(", ")}" | Marks: ${studentData.marks?.percentage || "N/A"}%`,
    { session_id: sessionId, query: studentData.query, marks: studentData.marks?.percentage, stream: studentData.stream }
  );

  const [gptRes, geminiRes, claudeRes] = await Promise.allSettled([
    queryGPT(prompt, sessionId),
    queryGemini(prompt, sessionId),
    queryClaude(prompt, sessionId),
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
