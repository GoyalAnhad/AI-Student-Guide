    import { scrapeExams } from "./sources/exams.js";
    import { scrapeUniversities } from "./sources/universities.js";
    import { normalizeExam, normalizeUniversity } from "./utils/normalizer.js";

    export async function runScrapers() {
    console.log("Running scrapers...");

    const examsRaw = await scrapeExams();
    const uniRaw = await scrapeUniversities();

    const exams = examsRaw.map(normalizeExam);
    const universities = uniRaw.map(normalizeUniversity);

    console.log("Exams:", exams.length);
    console.log("Universities:", universities.length);

    return { exams, universities };
    }