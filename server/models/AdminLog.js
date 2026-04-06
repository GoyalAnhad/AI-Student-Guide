// server/models/AdminLog.js
// Stores every backend event: user queries, AI responses, college searches, DB saves.

import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "user_query",        // student submitted a search
      "ai_request",        // sent request to GPT/Gemini/Claude
      "ai_response",       // got response from AI
      "ai_error",          // AI call failed
      "db_search",         // searched MongoDB
      "db_result",         // results from MongoDB
      "scraper_start",     // scraper began for a state
      "scraper_progress",  // scraper found a college
      "scraper_done",      // scraper finished a state
      "scraper_error",     // scraper failed
      "college_saved",     // college saved to DB
      "analysis_complete", // full analysis done for user
      "system",            // general system info
    ],
    required: true,
  },

  // Who triggered this (user socket id or "system")
  session_id: { type: String },

  // What was the user looking for
  query:    { type: String },
  stream:   { type: String },
  marks:    { type: Number },

  // Details of the event
  source:   { type: String },   // gpt | gemini | claude | mongodb | scraper
  state:    { type: String },   // for scraper events
  message:  { type: String, required: true },

  // Payload (AI response, DB results, etc.)
  data: { type: mongoose.Schema.Types.Mixed },

  // Timing
  duration_ms: { type: Number },
  timestamp:   { type: Date, default: Date.now },
}, { timestamps: false });

adminLogSchema.index({ timestamp: -1 });
adminLogSchema.index({ type: 1 });
adminLogSchema.index({ session_id: 1 });

export default mongoose.model("AdminLog", adminLogSchema);
