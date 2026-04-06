// client/src/app/admin/page.js
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const C = {
  bg: "#0f172a", card: "#1e293b", border: "#334155", muted: "#64748b",
  white: "#f1f5f9", primary: "#3b82f6", success: "#22c55e", warning: "#f59e0b",
  danger: "#ef4444", purple: "#a855f7", cyan: "#06b6d4",
};

// ── Log type colors and icons ──
const LOG_STYLE = {
  user_query:        { color: C.cyan,    icon: "🔍", bg: "#0e7490" },
  ai_request:        { color: C.warning, icon: "📤", bg: "#92400e" },
  ai_response:       { color: C.success, icon: "✅", bg: "#14532d" },
  ai_error:          { color: C.danger,  icon: "❌", bg: "#7f1d1d" },
  db_search:         { color: C.purple,  icon: "🗃️", bg: "#581c87" },
  db_result:         { color: C.purple,  icon: "📋", bg: "#4c1d95" },
  scraper_start:     { color: C.primary, icon: "🚀", bg: "#1e3a8a" },
  scraper_progress:  { color: C.primary, icon: "⏳", bg: "#1e40af" },
  scraper_done:      { color: C.success, icon: "🎉", bg: "#14532d" },
  scraper_error:     { color: C.danger,  icon: "💥", bg: "#7f1d1d" },
  college_saved:     { color: C.success, icon: "🏛️", bg: "#14532d" },
  analysis_complete: { color: C.success, icon: "🎯", bg: "#14532d" },
  system:            { color: C.muted,   icon: "⚙️", bg: "#1e293b" },
};

// ── Tiny components ──
const StatBox = ({ label, value, color = C.primary, sub }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", flex: "1 1 140px" }}>
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? "—"}</div>
    <div style={{ fontSize: 13, color: C.white, fontWeight: 600, marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const LogRow = ({ log }) => {
  const s = LOG_STYLE[log.type] || LOG_STYLE.system;
  const time = new Date(log.timestamp).toLocaleTimeString();
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start", fontFamily: "monospace" }}>
      <span style={{ color: C.muted, fontSize: 11, minWidth: 72, paddingTop: 2 }}>{time}</span>
      <span style={{ background: `${s.bg}66`, color: s.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, minWidth: 110, textAlign: "center" }}>
        {s.icon} {log.type.replace(/_/g, " ").toUpperCase()}
      </span>
      <span style={{ color: C.white, fontSize: 13, flex: 1 }}>{log.message}</span>
      {log.source && <span style={{ color: C.muted, fontSize: 11, minWidth: 55 }}>[{log.source}]</span>}
      {log.duration_ms && <span style={{ color: C.muted, fontSize: 11 }}>{log.duration_ms}ms</span>}
    </div>
  );
};

// ── State scraper panel ──
const ScraperPanel = ({ states, onScrapeState, onScrapeAll, scrapeResult }) => {
  const [selected, setSelected] = useState("delhi");
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px" }}>
      <h3 style={{ color: C.white, margin: "0 0 16px" }}>🗺️ State-by-State College Scraper</h3>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>
        Load college data for one state at a time into MongoDB. Start with Delhi, then proceed state by state.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#0f172a", color: C.white, fontSize: 14, flex: "1 1 180px" }}>
          {states.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <button onClick={() => onScrapeState(selected)}
          style={{ padding: "10px 20px", background: C.primary, color: C.white, border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          Load {selected.replace(/_/g, " ")} →
        </button>
        <button onClick={onScrapeAll}
          style={{ padding: "10px 20px", background: "#7c3aed", color: C.white, border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          Load All Available States
        </button>
      </div>

      {scrapeResult && (
        <div style={{ background: "#0f172a", padding: "12px 16px", borderRadius: 8, fontSize: 13, color: C.success }}>
          {scrapeResult}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
        📌 To add a new state: create <code style={{ color: C.cyan }}>server/data/states/statename.js</code> and register it in <code style={{ color: C.cyan }}>server/scraper/stateScraper.js</code>
      </div>
    </div>
  );
};

// ── DB State table ──
const StateTable = ({ breakdown }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px" }}>
    <h3 style={{ color: C.white, margin: "0 0 16px" }}>🏛️ Colleges in Database by State</h3>
    <div style={{ maxHeight: 300, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {["State", "Colleges", "Types"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {breakdown?.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
              <td style={{ padding: "8px 12px", color: C.white }}>{row._id || "Unknown"}</td>
              <td style={{ padding: "8px 12px", color: C.success, fontWeight: 700 }}>{row.count}</td>
              <td style={{ padding: "8px 12px", color: C.muted }}>{(row.types || []).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────
export default function AdminPage() {
  const socketRef      = useRef(null);
  const logsEndRef     = useRef(null);
  const [logs, setLogs]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [isConn, setIsConn]   = useState(false);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [states, setStates]   = useState([]);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [activeSection, setActiveSection] = useState("logs");

  // Fetch initial data
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`);
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (_) {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const url = filter === "all"
        ? `${API_URL}/api/admin/logs?limit=200`
        : `${API_URL}/api/admin/logs?limit=200&type=${filter}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.success) setLogs(data.logs.reverse()); // oldest first
    } catch (_) {}
  }, [filter]);

  const fetchStates = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/api/admin/scrape/states`);
      const data = await res.json();
      if (data.success) setStates(data.states);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLogs();
    fetchStates();
  }, [fetchStats, fetchLogs, fetchStates]);

  useEffect(() => { fetchLogs(); }, [filter]);

  // Socket for live logs
  useEffect(() => {
    const s = io(`${API_URL}/admin`, { transports: ["websocket"] });
    socketRef.current = s;
    s.on("connect",    () => setIsConn(true));
    s.on("disconnect", () => setIsConn(false));
    s.on("log", (entry) => {
      setLogs((prev) => [...prev.slice(-499), entry]); // keep last 500
      // Refresh stats occasionally
      if (entry.type === "college_saved" || entry.type === "scraper_done") {
        fetchStats();
      }
    });
    return () => s.disconnect();
  }, [fetchStats]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScrapeState = async (state) => {
    setScrapeMsg(`Loading ${state}... watch the Logs tab for progress.`);
    await fetch(`${API_URL}/api/admin/scrape/state`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  };

  const handleScrapeAll = async () => {
    setScrapeMsg("Loading all available states... watch the Logs tab for progress.");
    await fetch(`${API_URL}/api/admin/scrape/all`, { method: "POST" });
  };

  const clearLogs = async () => {
    await fetch(`${API_URL}/api/admin/logs?older_than_days=0`, { method: "DELETE" });
    setLogs([]);
  };

  // Filter and search logs
  const displayedLogs = logs.filter((l) => {
    if (filter !== "all" && l.type !== filter) return false;
    if (search && !l.message?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sections = ["logs", "scraper", "database", "stats"];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', monospace" }}>

      {/* Navbar */}
      <div style={{ background: "#020617", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 18 }}>⚙️ CareerAI — Admin</div>
          <a href="/" style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}>← Student View</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: isConn ? C.success : C.danger }}>
            {isConn ? "● Live" : "● Disconnected"}
          </div>
          <button onClick={fetchStats} style={{ padding: "6px 14px", background: C.card, color: C.white, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatBox label="Universities"  value={stats?.universities}  color={C.primary} />
          <StatBox label="Total Courses" value={stats?.total_courses} color={C.cyan} />
          <StatBox label="Careers"       value={stats?.careers}       color={C.success} />
          <StatBox label="Exams"         value={stats?.exams}         color={C.purple} />
          <StatBox label="Backend Logs"  value={stats?.total_logs}    color={C.warning} sub="stored in DB" />
          <StatBox label="Live Logs"     value={displayedLogs.length} color={C.success} sub="in view" />
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {sections.map((s) => (
            <button key={s} onClick={() => setActiveSection(s)}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize",
                background: activeSection === s ? C.primary : C.card,
                color:      activeSection === s ? C.white   : C.muted }}>
              {s === "logs" ? "📋 Live Logs" : s === "scraper" ? "🗺️ Scraper" : s === "database" ? "🗃️ Database" : "📊 Stats"}
            </button>
          ))}
        </div>

        {/* ── LOGS SECTION ── */}
        {activeSection === "logs" && (
          <div>
            {/* Controls */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.white, fontSize: 13 }}>
                <option value="all">All Types</option>
                {Object.keys(LOG_STYLE).map((t) => (
                  <option key={t} value={t}>{LOG_STYLE[t].icon} {t.replace(/_/g, " ")}</option>
                ))}
              </select>

              <input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.white, fontSize: 13, flex: "1 1 200px" }} />

              <label style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                Auto-scroll
              </label>

              <button onClick={clearLogs}
                style={{ padding: "8px 14px", background: "#7f1d1d", color: C.white, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                🗑 Clear
              </button>
              <button onClick={fetchLogs}
                style={{ padding: "8px 14px", background: C.card, color: C.white, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                ↻ Load from DB
              </button>
            </div>

            {/* Log display */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, height: "60vh", overflowY: "auto" }}>
              {displayedLogs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                  No logs yet. Make a student query to see backend activity here.
                </div>
              ) : (
                displayedLogs.map((log, i) => <LogRow key={i} log={log} />)
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Legend */}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(LOG_STYLE).map(([type, s]) => (
                <span key={type} style={{ fontSize: 10, color: s.color, background: `${s.bg}44`, padding: "2px 8px", borderRadius: 4 }}>
                  {s.icon} {type.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── SCRAPER SECTION ── */}
        {activeSection === "scraper" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ScraperPanel
              states={states.length ? states : ["delhi"]}
              onScrapeState={handleScrapeState}
              onScrapeAll={handleScrapeAll}
              scrapeResult={scrapeMsg}
            />

            {/* How to add a new state */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px" }}>
              <h3 style={{ color: C.white, margin: "0 0 12px" }}>📝 How to add a new state</h3>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 8px", color: C.white }}>Step 1: Create the state data file:</p>
                <code style={{ background: "#0f172a", padding: "8px 14px", borderRadius: 6, display: "block", color: C.cyan, marginBottom: 12 }}>
                  server/data/states/maharashtra.js
                </code>
                <p style={{ margin: "0 0 8px", color: C.white }}>Step 2: Export from it:</p>
                <code style={{ background: "#0f172a", padding: "8px 14px", borderRadius: 6, display: "block", color: C.cyan, marginBottom: 12 }}>
                  {`export const maharashtraColleges = [ { name: "...", courses: [...] } ]`}
                </code>
                <p style={{ margin: "0 0 8px", color: C.white }}>Step 3: Register in stateScraper.js:</p>
                <code style={{ background: "#0f172a", padding: "8px 14px", borderRadius: 6, display: "block", color: C.cyan }}>
                  {`"maharashtra": () => import("../data/states/maharashtra.js").then(m => m.maharashtraColleges)`}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* ── DATABASE SECTION ── */}
        {activeSection === "database" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <StateTable breakdown={stats?.state_breakdown} />
          </div>
        )}

        {/* ── STATS SECTION ── */}
        {activeSection === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px" }}>
              <h3 style={{ color: C.white, margin: "0 0 16px" }}>📊 System Statistics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  ["Total Universities", stats?.universities, C.primary],
                  ["Total Courses/Degrees", stats?.total_courses, C.cyan],
                  ["Career Paths", stats?.careers, C.success],
                  ["Exams Tracked", stats?.exams, C.purple],
                  ["Backend Log Entries", stats?.total_logs, C.warning],
                  ["States in DB", stats?.state_breakdown?.length, C.success],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ background: "#0f172a", padding: "16px", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: c }}>{v ?? "—"}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
