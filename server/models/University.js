// server/models/University.js

import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  degree:      { type: String },                // B.Tech, B.Sc, BA, BCA, B.Com, LLB, MBBS, etc.
  duration:    { type: String },                // "4 years"
  fees:        { type: Number },                // per year in INR (null if unknown)
  seats:       { type: Number },
  eligibility: { type: String },
  stream:      { type: String },                // Science | Commerce | Arts | Any
  tags:        [String],                        // ["CS","AI","Robotics"] — used for matching
  source:      { type: String, default: "seed" }, // seed | scraped | ai_suggested
});

const universitySchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true },
  shortName:  { type: String },
  location: {
    city:    String,
    state:   String,
    country: { type: String, default: "India" },
  },

  // ── Ownership ──────────────────────────────
  ownership: {
    type: String,
    enum: ["Public", "Private", "Deemed", "Autonomous"],
    default: "Public",
  },
  // Convenience booleans derived from ownership
  isPublic:  { type: Boolean, default: true },
  isPrivate: { type: Boolean, default: false },

  // ── Type ────────────────────────────────────
  type: {
    type: String,
    enum: ["IIT", "NIT", "IIIT", "IIM", "AIIMS", "Central", "State", "Deemed", "Private", "Law", "Other"],
    default: "State",
  },

  // ── Rankings ────────────────────────────────
  nirf_ranking: { type: Number },
  qs_ranking:   { type: Number },
  established:  { type: Number },
  website:      { type: String },

  // ── Academic ────────────────────────────────
  courses:          [courseSchema],
  exams_accepted:   [String],
  total_courses:    { type: Number },         // total number of programs
  streams_offered:  [String],               // ["Science","Commerce","Arts"]

  // ── Placement ───────────────────────────────
  avg_placement_lpa: { type: Number },
  top_recruiters:    [String],

  // ── Tags ────────────────────────────────────
  tags: [String],                             // ["Engineering","Research","Tech","Medical","Law"]

  // ── Data quality ────────────────────────────
  is_verified:    { type: Boolean, default: false },  // true = data confirmed from official source
  data_source:    { type: String, default: "seed" },  // seed | scraped | ai_suggested
  scrape_url:     { type: String },                   // URL we tried/can try to verify
  scrape_status:  {
    type: String,
    enum: ["not_attempted", "success", "failed", "blocked"],
    default: "not_attempted",
  },
  scrape_error:   { type: String },

  last_updated: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes
universitySchema.index({ "location.state": 1 });
universitySchema.index({ nirf_ranking: 1 });
universitySchema.index({ tags: 1 });
universitySchema.index({ exams_accepted: 1 });
universitySchema.index({ ownership: 1 });
universitySchema.index({ "courses.tags": 1 });
universitySchema.index({ name: "text", "courses.name": "text", tags: "text" });

export default mongoose.model("University", universitySchema);
