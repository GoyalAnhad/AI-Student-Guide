// server/utils/logger.js
// Central logger. Saves every backend event to MongoDB AND emits to admin dashboard via socket.

import AdminLog from "../models/AdminLog.js";

let _adminIO = null; // socket.io admin namespace

// Call this once from socket.js to wire up the admin namespace
export function setAdminIO(io) {
  _adminIO = io;
}

// ─────────────────────────────────────────────
// MAIN LOG FUNCTION
// ─────────────────────────────────────────────
export async function log(type, message, extras = {}) {
  const entry = {
    type,
    message,
    timestamp: new Date(),
    ...extras,
  };

  // 1. Save to MongoDB (best-effort, don't crash if it fails)
  try {
    await AdminLog.create(entry);
  } catch (_) {}

  // 2. Emit to admin dashboard in real-time
  if (_adminIO) {
    _adminIO.emit("log", entry);
  }

  // 3. Also log to server console with color
  const color = {
    user_query:       "\x1b[36m",   // cyan
    ai_request:       "\x1b[33m",   // yellow
    ai_response:      "\x1b[32m",   // green
    ai_error:         "\x1b[31m",   // red
    db_search:        "\x1b[35m",   // magenta
    db_result:        "\x1b[35m",
    scraper_start:    "\x1b[34m",   // blue
    scraper_progress: "\x1b[34m",
    scraper_done:     "\x1b[32m",
    scraper_error:    "\x1b[31m",
    college_saved:    "\x1b[32m",
    analysis_complete:"\x1b[32m",
    system:           "\x1b[37m",
  }[type] || "\x1b[37m";

  console.log(`${color}[${type.toUpperCase()}]\x1b[0m ${message}`);
}

// Convenience wrappers
export const logger = {
  userQuery:    (msg, extras) => log("user_query",        msg, extras),
  aiRequest:    (msg, extras) => log("ai_request",        msg, extras),
  aiResponse:   (msg, extras) => log("ai_response",       msg, extras),
  aiError:      (msg, extras) => log("ai_error",          msg, extras),
  dbSearch:     (msg, extras) => log("db_search",         msg, extras),
  dbResult:     (msg, extras) => log("db_result",         msg, extras),
  scraperStart: (msg, extras) => log("scraper_start",     msg, extras),
  scraperProg:  (msg, extras) => log("scraper_progress",  msg, extras),
  scraperDone:  (msg, extras) => log("scraper_done",      msg, extras),
  scraperError: (msg, extras) => log("scraper_error",     msg, extras),
  collegeSaved: (msg, extras) => log("college_saved",     msg, extras),
  complete:     (msg, extras) => log("analysis_complete", msg, extras),
  system:       (msg, extras) => log("system",            msg, extras),
};
