import Exam from "../../models/Exam.js";
import University from "../../models/University.js";

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
