    import Exam from "../models/Exam.js";
    import University from "../models/University.js";

    export async function saveData({ exams, universities }) {
    for (let exam of exams) {
        await Exam.updateOne(
        { name: exam.name },
        exam,
        { upsert: true }
        );
    }

    for (let uni of universities) {
        await University.updateOne(
        { name: uni.name },
        uni,
        { upsert: true }
        );
    }
    }