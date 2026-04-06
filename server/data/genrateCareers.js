    import { getAIResponses } from "../ai/multiAI.js";

    export async function expandCareers(domain) {
    const prompt = `
    List 50 careers related to ${domain} with required skills and degrees
    `;

    const responses = await getAIResponses({ query: domain, interests: [domain], marks: {}, stream: "Any", grade: "12th", subjects: [] });

    return responses;
    }