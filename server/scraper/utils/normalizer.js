    export function normalizeExam(exam) {
    return {
        name: exam.name || "Unknown",
        date: exam.date || "TBD",
        country: "India",
    };
    }

    export function normalizeUniversity(u) {
    return {
        name: u.name,
        location: u.location || "Unknown",
    };
    }