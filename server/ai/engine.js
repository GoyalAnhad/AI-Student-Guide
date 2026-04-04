// server/ai/engine.js
// Orchestrates: AI queries → merge/debate → verify unis → DB validation → final output.

import { getAIResponses }    from "./multiAI.js";
import { mergeAIResponses }  from "./merge.js";
import { validateAndEnrich } from "./validator.js";

export async function processStudent(studentData) {
  console.log("🚀 Processing:", JSON.stringify(studentData));

  try {
    // STEP 1: Query multiple AIs in parallel
    console.log("🤖 Step 1: Querying AIs...");
    const aiResponses = await getAIResponses(studentData);
    console.log(`✅ Got ${aiResponses.length} AI response(s) from: ${aiResponses.map((r) => r.source).join(", ")}`);

    // STEP 2: Debate & merge
    console.log("⚖️  Step 2: Debate engine running...");
    const mergedData = mergeAIResponses(aiResponses);
    console.log(`✅ Merged. Top career: ${mergedData.careers[0]?.title}. AI unis: ${mergedData.aiSuggestedUniversities?.length}`);

    // STEP 3: Validate against DB + verify AI-suggested unis (scraping)
    console.log("🔍 Step 3: Validating against DB + verifying universities...");
    const finalResult = await validateAndEnrich(mergedData, studentData);
    console.log(`✅ Done. ${finalResult.colleges.length} colleges total.`);

    // Separate verified vs AI-unverified colleges for frontend display
    const verifiedColleges   = finalResult.colleges.filter((c) => c.is_verified);
    const unverifiedColleges = finalResult.colleges.filter((c) => !c.is_verified);

    return {
      success: true,
      careers:            finalResult.careers,
      exams:              finalResult.exams,
      colleges:           verifiedColleges,
      aiSuggestedColleges: unverifiedColleges,
      roadmap:            finalResult.roadmap,
      skills:             finalResult.skills,
      stream_recommendation: finalResult.stream_recommendation,
      meta:               finalResult.meta,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ Engine error:", err);
    return { success: false, error: "Analysis failed. Please try again.", careers: [], colleges: [], aiSuggestedColleges: [], exams: [], roadmap: [] };
  }
}
