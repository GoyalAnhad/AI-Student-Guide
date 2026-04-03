import Exam from "../models/Exam.js";
import University from "../models/University.js";
import examsData from "../data/exams.json" with { type: "json" };
import universitiesData from "../data/universities.json" with { type: "json" };

export async function runScrapers() {
  // Placeholder implementation for production safety.
  // Replace this with real scrapers for your chosen sources.
  return {
    exams: examsData.map((exam) => ({
      name: exam.name,
      date: exam.date || "TBD",
      country: exam.country || "Global",
    })),
    universities: universitiesData.map((uni) => ({
      name: uni.name,
      location: uni.location || "Unknown",
    })),
  };
}

export async function saveData({ exams = [], universities = [] }) {
  for (const exam of exams) {
    if (!exam?.name) continue;
    await Exam.updateOne(
      { name: exam.name },
      { $set: exam },
      { upsert: true }
    );
  }

  for (const uni of universities) {
    if (!uni?.name) continue;
    await University.updateOne(
      { name: uni.name },
      { $set: uni },
      { upsert: true }
    );
  }
}
