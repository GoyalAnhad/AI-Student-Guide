// server/models/Exam.js

import mongoose from "mongoose";

const examSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true },
  full_name:  String,
  type:       { type: String },   // UG | PG | Scholarship | Fellowship | Government
  stream:     { type: String },   // Science | Commerce | Arts | Any
  level:      { type: String },   // National | State | University
  conducting_body: String,

  eligibility: {
    min_percentage: Number,
    class:    String,
    subjects: [String],
  },

  exam_pattern: {
    mode:          String,   // Online | Offline | Both
    duration_hours: Number,
    total_marks:   Number,
    sections:      [String],
  },

  schedule: {
    registration_month: String,
    exam_month:         String,
    result_month:       String,
  },

  website:                  String,
  careers_accessible:       [String],
  universities_accepting:   [String],
  is_verified: { type: Boolean, default: true },
}, { timestamps: true });

examSchema.index({ stream: 1, type: 1 });

export default mongoose.model("Exam", examSchema);
