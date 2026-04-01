        import { getAIResponses } from "./multiAI.js";
        import { mergeAIResponses } from "./merge.js";
        import careersData from "../data/careers.json" assert { type: "json" };

    export async function processStudent(data) {
    const { interests } = data;

    // 1. Get careers from graph
    const graphCareers = findFromGraph(interests);

    // 2. Expand using AI
    const aiSuggestions = await getAIResponses(interests);

    // 3. Merge
    const finalCareers = merge(graphCareers, aiSuggestions);

    return {
        careers: finalCareers,
        paths: buildPaths(finalCareers),
    };
    }