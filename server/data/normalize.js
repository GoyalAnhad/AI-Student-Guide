    export function normalizeUniversity(raw) {
    return {
        name: raw.name,
        country: raw.country || "Unknown",
        courses: raw.courses || [],
        exams_required: raw.exams || [],
    };
    }