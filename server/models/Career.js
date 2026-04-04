// server/models/Career.js

import mongoose from "mongoose";

const careerSchema = new mongoose.Schema({
  title:    { type: String, required: true, unique: true },
  category: { type: String },   // Engineering | Medical | Commerce | Arts | Law | Design | etc.
  stream:   { type: String },   // Science | Commerce | Arts | Any
  description: String,

  skills_required:   [String],
  interests_matched: [String],   // keywords that map to this career
  keywords:          [String],   // broader search keywords

  avg_salary_lpa: {
    entry:  Number,
    mid:    Number,
    senior: Number,
  },

  roadmap: [{
    step:        Number,
    title:       String,
    description: String,
    duration:    String,
    actions:     [String],
  }],

  top_degrees:  [String],
  top_exams:    [String],
  top_companies:[String],
  growth_outlook: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
  remote_friendly: Boolean,
  is_verified:  { type: Boolean, default: true },
}, { timestamps: true });

careerSchema.index({ keywords: 1 });
careerSchema.index({ interests_matched: 1 });
careerSchema.index({ stream: 1 });
careerSchema.index({ title: "text", keywords: "text", interests_matched: "text" });

export default mongoose.model("Career", careerSchema);
