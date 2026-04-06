// server/ai/merge.js
// Debate engine: merges career + university suggestions from multiple AIs.

export function mergeAIResponses(aiResponses) {
  if (!aiResponses?.length) return { careers: [], degrees: [], exams: [], skills: [], universities: [] };

  const allCareers   = [];
  const allDegrees   = [];
  const allExams     = [];
  const allSkills    = [];
  const allUnis      = [];
  const streamVotes  = {};

  for (const resp of aiResponses) {
    if (!resp.data) continue;
    const { careers=[], degrees=[], exams=[], exams_needed=[], skills=[], universities=[], stream_recommendation } = resp.data;
    const w = sourceWeight(resp.source);

    // ── Merge careers ──
    for (const c of careers) {
      const ex = allCareers.find((x) => x.title.toLowerCase() === c.title.toLowerCase());
      if (ex) {
        ex.confidence = Math.min(100, ex.confidence + c.confidence * 0.3 * w);
        ex.sources.push(resp.source);
        ex.agreement++;
      } else {
        allCareers.push({ title: c.title, confidence: c.confidence * w, reason: c.reason || "", sources: [resp.source], agreement: 1 });
      }
    }

    // ── Merge AI-suggested universities ──
    for (const u of (universities || [])) {
      if (!u?.name) continue;
      const norm = u.name.toLowerCase().trim();
      const ex = allUnis.find((x) => x.name.toLowerCase() === norm);
      if (ex) {
        ex.agreement++;
        ex.sources.push(resp.source);
        // Merge courses
        for (const c of (u.relevant_courses || [])) {
          if (!ex.relevant_courses.some((x) => String(x).toLowerCase() === String(c).toLowerCase())) ex.relevant_courses.push(c);
        }
      } else {
        allUnis.push({
          name: u.name,
          shortName: u.shortName || "",
          city: u.city || "",
          state: u.state || "",
          type: u.type || "Other",
          ownership: u.ownership || "Unknown",
          relevant_courses: u.relevant_courses || [],
          exams_accepted: u.exams_accepted || [],
          website: u.website || "",
          why_relevant: u.why_relevant || "",
          sources: [resp.source],
          agreement: 1,
        });
      }
    }

    for (const d of degrees) {
      const norm = String(d).trim().toLowerCase();
      if (norm && !allDegrees.some((x) => String(x).trim().toLowerCase() === norm)) allDegrees.push(d);
    }
    [...exams, ...exams_needed].forEach((e) => {
      const norm = String(e).trim().toLowerCase();
      if (norm && !allExams.some((x) => String(x).trim().toLowerCase() === norm)) allExams.push(e);
    });
    skills.forEach((s) => {
      const norm = String(s).trim().toLowerCase();
      if (norm && !allSkills.some((x) => String(x).trim().toLowerCase() === norm)) allSkills.push(s);
    });
    if (stream_recommendation) streamVotes[stream_recommendation] = (streamVotes[stream_recommendation]||0) + w;
  }

  // Sort careers
  const mergedCareers = allCareers
    .sort((a, b) => (b.confidence + (b.agreement-1)*20) - (a.confidence + (a.agreement-1)*20))
    .slice(0, 5)
    .map((c) => ({
      title: c.title,
      confidence: Math.round(Math.min(100, c.confidence)),
      reason: c.reason,
      agreedBy: c.sources,
      aiAgreement: c.sources.length >= 2 ? `✅ ${c.sources.length} AIs agree` : `⚠️ 1 AI suggested`,
    }));

  // Sort AI-suggested universities by agreement
  const mergedUnis = allUnis
    .sort((a, b) => b.agreement - a.agreement)
    .slice(0, 15);   // keep up to 15 for verification

  const stream = Object.entries(streamVotes).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Science";
  const numSrc = aiResponses.filter((r)=>r.data).length;

  return {
    careers: mergedCareers,
    degrees: allDegrees.slice(0, 6),
    exams:   allExams.slice(0, 8),
    skills:  allSkills.slice(0, 8),
    stream_recommendation: stream,
    aiSuggestedUniversities: mergedUnis,
    meta: {
      sources_used: aiResponses.map((r) => r.source),
      total_sources: numSrc,
      debate_summary: buildDebateSummary(aiResponses, mergedCareers),
    },
  };
}

function sourceWeight(source) {
  return { gpt: 1.1, claude: 1.1, gemini: 1.0, fallback: 0.7 }[source] || 1.0;
}

function buildDebateSummary(responses, careers) {
  const n = responses.filter((r)=>r.data).length;
  if (!n) return "No AI data.";
  if (n === 1) return `${responses[0].source.toUpperCase()} analysis: ${careers[0]?.title} is the best match.`;
  const agreed = careers.filter((c) => c.agreedBy.length >= 2);
  const conflict = careers.filter((c) => c.agreedBy.length === 1);
  let s = `${n} AIs consulted. `;
  if (agreed.length)   s += `Agreed on: ${agreed.map((c)=>c.title).join(", ")}. `;
  if (conflict.length) s += `${conflict[0].agreedBy[0].toUpperCase()} uniquely suggested: ${conflict[0].title}.`;
  return s;
}
