// client/src/app/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ── Palette ───────────────────────────────────
const C = {
  bg:          "#f0f4ff",
  primary:     "#2563eb",
  primaryDark: "#1e40af",
  success:     "#16a34a",
  warning:     "#d97706",
  danger:      "#dc2626",
  purple:      "#7c3aed",
  dark:        "#0f172a",
  muted:       "#64748b",
  border:      "#e2e8f0",
  white:       "#ffffff",
  shadow:      "0 4px 20px rgba(15,23,42,0.08)",
  shadowSm:    "0 2px 8px rgba(15,23,42,0.06)",
};

// ── Atoms ─────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.white, borderRadius: 16, padding: "24px 28px", boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 18, ...style }}>
    {children}
  </div>
);

const Badge = ({ label, color = C.primary, size = "sm" }) => (
  <span style={{
    background: `${color}18`, color, padding: size === "sm" ? "3px 9px" : "5px 12px",
    borderRadius: 999, fontSize: size === "sm" ? 11 : 13, fontWeight: 600,
    marginRight: 5, marginBottom: 4, display: "inline-block",
  }}>{label}</span>
);

const ConfBar = ({ value }) => {
  const col = value >= 80 ? C.success : value >= 60 ? C.warning : C.muted;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 3 }}>
        <span>AI Confidence</span><span style={{ color: col, fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ background: C.border, borderRadius: 999, height: 5 }}>
        <div style={{ width: `${value}%`, background: col, borderRadius: 999, height: 5, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
};

// ── Step Bar ───────────────────────────────────
const StepBar = ({ step }) => {
  const steps = ["Profile", "Analyzing", "Results"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
      {steps.map((s, i) => {
        const active = step === i + 1, done = step > i + 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? C.success : active ? C.primary : C.border, color: done || active ? C.white : C.muted,
                fontWeight: 700, fontSize: 14, transition: "all 0.3s" }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: active ? C.primary : C.muted, fontWeight: active ? 600 : 400 }}>{s}</div>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: done ? C.success : C.border, marginBottom: 18, transition: "background 0.3s" }} />}
          </div>
        );
      })}
    </div>
  );
};

// ── Select component ───────────────────────────
const Select = ({ label, value, onChange, options, style = {} }) => (
  <div style={{ flex: 1, minWidth: 140, ...style }}>
    {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, display: "block", marginBottom: 6 }}>{label}</label>}
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 14, color: C.dark }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ── Filter Bar ─────────────────────────────────
const FilterBar = ({ filters, onChange }) => (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
    <Select label={null} value={filters.ownership} onChange={(v) => onChange({ ...filters, ownership: v })}
      options={[{ value: "All", label: "🏛️ All (Public + Private)" }, { value: "Public", label: "🏛️ Public Only" }, { value: "Private", label: "🏢 Private Only" }]}
      style={{ flex: "1 1 180px" }} />
    <Select label={null} value={filters.state || ""} onChange={(v) => onChange({ ...filters, state: v })}
      options={[
        { value: "", label: "📍 All States" },
        { value: "Delhi", label: "Delhi" }, { value: "Maharashtra", label: "Maharashtra" },
        { value: "Tamil Nadu", label: "Tamil Nadu" }, { value: "Karnataka", label: "Karnataka" },
        { value: "Telangana", label: "Telangana" }, { value: "Rajasthan", label: "Rajasthan" },
        { value: "Gujarat", label: "Gujarat" }, { value: "West Bengal", label: "West Bengal" },
        { value: "Uttar Pradesh", label: "Uttar Pradesh" }, { value: "Haryana", label: "Haryana" },
        { value: "Punjab", label: "Punjab" }, { value: "Kerala", label: "Kerala" },
        { value: "Andhra Pradesh", label: "Andhra Pradesh" }, { value: "Odisha", label: "Odisha" },
        { value: "Madhya Pradesh", label: "Madhya Pradesh" }, { value: "Bihar", label: "Bihar" },
        { value: "Assam", label: "Assam" }, { value: "Uttarakhand", label: "Uttarakhand" },
        { value: "Jharkhand", label: "Jharkhand" },
      ]}
      style={{ flex: "1 1 160px" }} />
    <Select label={null} value={filters.type || ""} onChange={(v) => onChange({ ...filters, type: v })}
      options={[
        { value: "", label: "🎓 All Types" },
        { value: "IIT",     label: "IITs" }, { value: "NIT",    label: "NITs" },
        { value: "IIIT",    label: "IIITs" }, { value: "IIM",   label: "IIMs" },
        { value: "AIIMS",   label: "AIIMS" }, { value: "Law",   label: "Law Schools" },
        { value: "Central", label: "Central Universities" }, { value: "State", label: "State Universities" },
        { value: "Deemed",  label: "Deemed Universities" }, { value: "Private", label: "Private Universities" },
        { value: "Other",   label: "Other (Design, Media, etc.)" },
      ]}
      style={{ flex: "1 1 180px" }} />
  </div>
);

// ── Career Card ────────────────────────────────
const CareerCard = ({ career, index }) => {
  const [open, setOpen] = useState(index === 0);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden", background: C.white }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.dark }}>#{index + 1} {career.title}</span>
            {career.isValidated && <Badge label="✅ Verified" color={C.success} />}
            {career.growth === "High" && <Badge label="🔥 High Growth" color="#f59e0b" />}
            {!career.isValidated && <Badge label="⚠️ AI suggestion" color={C.warning} />}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{career.reason}</div>
          <ConfBar value={career.confidence} />
        </div>
        <span style={{ fontSize: 18, color: C.muted, marginLeft: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: "0 20px 18px", borderTop: `1px solid ${C.border}` }}>
          {career.avg_salary && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {[["Entry", career.avg_salary.entry, "#f0fdf4", C.success], ["Mid", career.avg_salary.mid, "#eff6ff", C.primary], ["Senior", career.avg_salary.senior, "#fdf4ff", C.purple]]
                .map(([label, val, bg, col]) => val && (
                  <div key={label} style={{ background: bg, padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                    <div style={{ fontWeight: 700, color: col, fontSize: 15 }}>₹{val}L/yr</div>
                  </div>
                ))}
            </div>
          )}
          {career.topCompanies?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Top Companies:</div>
              {career.topCompanies.map((c, i) => <Badge key={i} label={c} color={C.primary} />)}
            </div>
          )}
          {career.aiAgreement && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{career.aiAgreement}</div>}
          {career.note && <div style={{ fontSize: 12, color: C.warning, marginTop: 6 }}>{career.note}</div>}
        </div>
      )}
    </div>
  );
};

// ── Degree Card ────────────────────────────────
const DegreeCard = ({ degree, index }) => {
  const [open, setOpen] = useState(index === 0);
  return (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 14, marginBottom: 12, overflow: 'hidden', background: C.white }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.dark }}>#{index + 1} {degree.name}</span>
            {degree.stream_required && <Badge label={degree.stream_required} color={C.primary} />}
            {degree.duration && <Badge label={degree.duration} color={C.purple} />}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{degree.why_relevant}</div>
        </div>
        <span style={{ fontSize: 18, color: C.muted, marginLeft: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: '0 20px 18px', borderTop: '1px solid ' + C.border }}>
          {degree.min_marks_typical !== undefined && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Typical marks: <strong style={{ color: C.dark }}>{degree.min_marks_typical}%+</strong></div>
          )}
          {degree.career_paths?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Career paths:</div>
              {degree.career_paths.map((c, i) => <Badge key={i} label={c} color={C.success} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── College Card ───────────────────────────────
const CollegeCard = ({ college, isAISuggested = false }) => {
  const [open, setOpen] = useState(false);
  const ownershipColor = college.ownership === "Public" ? C.success : college.ownership === "Private" ? C.purple : C.muted;

  return (
    <div style={{ border: `1px solid ${isAISuggested ? "#fde68a" : C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden", background: isAISuggested ? "#fffbeb" : C.white }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{college.name}</span>
            {college.nirf_ranking && <Badge label={`NIRF #${college.nirf_ranking}`} color={C.primary} />}
            {college.type && <Badge label={college.type} color={C.purple} />}
            {college.ownership && <Badge label={college.ownership} color={ownershipColor} />}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>📍 {college.location || `${college.city || ""}, ${college.state || ""}`}</div>
          {isAISuggested && (
            <div style={{ fontSize: 12, color: C.warning, marginTop: 4 }}>{college.verification_note || "⚠️ AI-suggested — details from AI knowledge"}</div>
          )}
        </div>
        <span style={{ fontSize: 18, color: C.muted, marginLeft: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: "0 20px 18px", borderTop: `1px solid ${isAISuggested ? "#fde68a" : C.border}` }}>
          {college.avg_placement_lpa && (
            <div style={{ background: "#f0fdf4", padding: "8px 14px", borderRadius: 10, display: "inline-block", marginTop: 12 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Avg Placement: </span>
              <span style={{ fontWeight: 700, color: C.success }}>₹{college.avg_placement_lpa}L/yr</span>
            </div>
          )}

          {/* Relevant courses */}
          {(college.relevantCourses?.length > 0 || college.relevant_courses?.length > 0) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Relevant Courses:</div>
              {(college.relevantCourses || college.relevant_courses || []).map((c, i) => (
                <div key={i} style={{ background: C.bg, padding: "8px 12px", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                  {typeof c === "string" ? c : <><strong>{c.name}</strong> · {c.duration} · {c.fees ? `₹${(c.fees/100000).toFixed(1)}L/yr` : "Fees N/A"}</>}
                </div>
              ))}
            </div>
          )}

          {/* Scraped programs (AI-suggested unis that were verifiable) */}
          {college.scraped_programs?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Programs found on website:</div>
              {college.scraped_programs.map((p, i) => <div key={i} style={{ background: "#f0fdf4", padding: "6px 10px", borderRadius: 8, marginBottom: 4, fontSize: 12 }}>• {p}</div>)}
            </div>
          )}

          {/* Why relevant (AI-suggested) */}
          {college.why_relevant && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#374151", fontStyle: "italic" }}>💡 {college.why_relevant}</div>
          )}

          {/* Exams accepted */}
          {(college.exams_accepted?.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: 600 }}>Exams Accepted:</div>
              {college.exams_accepted.map((e, i) => <Badge key={i} label={e} color={C.success} />)}
            </div>
          )}

          {/* Top recruiters */}
          {college.top_recruiters?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: 600 }}>Top Recruiters:</div>
              {college.top_recruiters.map((r, i) => <Badge key={i} label={r} color={C.primary} />)}
            </div>
          )}

          {/* Website */}
          {college.website && (
            <a href={college.website} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: C.primary, textDecoration: "none" }}>
              🌐 Visit Website →
            </a>
          )}

          {/* AI suggestion disclaimer */}
          {isAISuggested && (
            <div style={{ marginTop: 12, background: "#fef3c7", padding: "10px 14px", borderRadius: 10, fontSize: 12, color: "#92400e" }}>
              ⚠️ <strong>Note:</strong> This university was suggested by AI based on its training data.
              Course details, fees, and eligibility should be confirmed on the official website before applying.
              {college.scrape_status === "blocked" && " (Our automated check was blocked by this website — please visit directly.)"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Exam Card ──────────────────────────────────
const ExamCard = ({ exam }) => (
  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10, background: C.white }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{exam.name}</div>
        {exam.full_name && <div style={{ fontSize: 12, color: C.muted }}>{exam.full_name}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {exam.type  && <Badge label={exam.type}  color={C.primary} />}
        {exam.level && <Badge label={exam.level} color={C.purple} />}
      </div>
    </div>
    {exam.conducting_body && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>By: {exam.conducting_body}</div>}
    {exam.exam_month      && <div style={{ fontSize: 12, color: C.muted }}>📅 Exam Month: {exam.exam_month}</div>}
    {exam.website && (
      <a href={exam.website} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 12, color: C.primary, textDecoration: "none", display: "block", marginTop: 6 }}>
        🌐 Official Site →
      </a>
    )}
  </div>
);

// ── Roadmap ─────────────────────────────────────
const Roadmap = ({ steps = [] }) => (
  <div>
    {steps.map((s, i) => (
      <div key={i} style={{ display: "flex", gap: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.primary, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {s.step}
          </div>
          {i < steps.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 6 }} />}
        </div>
        <div style={{ flex: 1, paddingBottom: 12 }}>
          <div style={{ fontWeight: 700, color: C.dark }}>{s.title}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{s.description} · <span style={{ color: C.primary }}>{s.duration}</span></div>
          {s.actions?.map((a, j) => <div key={j} style={{ fontSize: 13, color: "#374151", padding: "2px 0" }}>→ {a}</div>)}
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function Home() {
  const socketRef = useRef(null);
  const [step, setStep]           = useState(1);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [isConnected, setIsConn]  = useState(false);
  const [progressMsg, setProgress]= useState("");
  const [activeTab, setActiveTab] = useState("degrees");

  // Form
  const [query, setQuery]         = useState("");
  const [interests, setInterests] = useState("");
  const [stream, setStream]       = useState("");
  const [grade, setGrade]         = useState("12th");
  const [percentage, setPercent]  = useState("");

  // Filters (applied to college results)
  const [filters, setFilters] = useState({ ownership: "All", state: "", type: "" });

  // ── Socket setup ──
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket"], withCredentials: false });
    socketRef.current = socket;
    socket.on("connect",        () => { setIsConn(true);  setError(""); });
    socket.on("connect_error",  () => { setIsConn(false); setError("Could not connect to backend."); });
    socket.on("progress",       (d) => setProgress(d.message));
    socket.on("result",         (d) => { setResult(d); setStep(3); setProgress(""); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  // ── Analyze ───────
  const analyze = () => {
    const cleanInterests = interests.split(",").map((i) => i.trim()).filter(Boolean);
    const q = query.trim();
    if (!q && !cleanInterests.length) { setError("Please enter a course/career query or some interests."); return; }
    if (!socketRef.current) { setError("Not connected to backend."); return; }

    setError(""); setResult(null); setStep(2);
    setProgress("🤖 Consulting AI advisors...");

    socketRef.current.emit("analyze", {
      query:     q,
      interests: q ? [q, ...cleanInterests] : cleanInterests,
      stream:    stream || undefined,
      grade,
      marks:     percentage ? { percentage: parseInt(percentage) } : {},
      filters,
    });
  };

  // ── Computed values ──
  const degrees             = result?.degrees           || [];
  const verifiedColleges    = result?.colleges          || [];
  const aiColleges          = result?.aiSuggestedColleges || [];
  const totalColleges       = verifiedColleges.length + aiColleges.length;

  const tabs = [
    { id: "degrees",  label: `Degrees (${result?.degrees?.length || 0})` },
    { id: "careers",  label: `Careers (${result?.careers?.length || 0})` },
    { id: "colleges", label: `Colleges (${totalColleges})` },
    { id: "exams",    label: `Exams (${result?.exams?.length || 0})` },
    { id: "roadmap",  label: "Roadmap" },
  ];

  // ─────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Navbar */}
      <div style={{ background: C.dark, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: C.white, fontWeight: 800, fontSize: 18 }}>🎓 CareerAI India</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted }}>GPT-4 · Gemini · Claude</div>
          <div style={{ fontSize: 12, color: isConnected ? "#4ade80" : "#f87171" }}>
            {isConnected ? "● Live" : "● Offline"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 20px" }}>
        <StepBar step={step} />

        {error && (
          <div style={{ background: "#fee2e2", color: C.danger, padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Form ────────────────────────── */}
        {step === 1 && (
          <Card>
            <h2 style={{ marginTop: 0, color: C.dark }}>What do you want to study or become?</h2>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>
              Search for <strong>any course, career, or field</strong> — engineering, law, geopolitics, design, medicine, animation, or anything else.
            </p>

            {/* Main query */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, display: "block", marginBottom: 6, marginTop: 20 }}>
              Search for a course or career *
            </label>
            <input
              placeholder="e.g. geopolitics, robotics, MBBS, chartered accountant, UX design, animation, marine biology..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              style={{ width: "100%", padding: "13px 15px", borderRadius: 10, border: `2px solid ${C.primary}`, fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />

            {/* Additional interests */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, display: "block", marginBottom: 6, marginTop: 16 }}>
              Additional interests (optional)
            </label>
            <input
              placeholder="e.g. writing, coding, travelling, environment"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" }}
            />

            {/* Row: stream, grade, percentage */}
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <Select label="Stream" value={stream} onChange={setStream}
                options={[{ value:"", label:"Not sure yet" },{ value:"Science", label:"Science (PCM/PCB)" },{ value:"Commerce", label:"Commerce" },{ value:"Arts", label:"Arts / Humanities" }]} />
              <Select label="Class" value={grade} onChange={setGrade}
                options={[{ value:"10th", label:"Class 10th" },{ value:"11th", label:"Class 11th" },{ value:"12th", label:"Class 12th" },{ value:"Graduate", label:"Graduation" }]} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, display: "block", marginBottom: 6 }}>Marks % (optional)</label>
                <input type="number" placeholder="e.g. 85" value={percentage} onChange={(e) => setPercent(e.target.value)} min="0" max="100"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* College filters */}
            <div style={{ marginTop: 20, padding: "16px", background: "#f8faff", borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 10 }}>🔍 College Filters</div>
              <FilterBar filters={filters} onChange={setFilters} />
            </div>

            <button onClick={analyze} disabled={!isConnected}
              style={{ marginTop: 20, padding: "14px 32px", background: isConnected ? C.primary : C.muted, color: C.white,
                border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: isConnected ? "pointer" : "not-allowed", width: "100%" }}>
              {isConnected ? "🚀 Find My Career & Colleges" : "Connecting to backend..."}
            </button>
          </Card>
        )}

        {/* ── STEP 2: Loading ──────────────────────── */}
        {step === 2 && (
          <Card style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h2 style={{ color: C.dark, margin: "0 0 8px" }}>Analyzing your profile...</h2>
            <p style={{ color: C.muted, fontSize: 14 }}>{progressMsg || "Consulting AI advisors, checking college data..."}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
              {["GPT-4", "Gemini", "Claude"].map((ai) => (
                <div key={ai} style={{ padding: "7px 16px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 13, color: C.muted }}>
                  {ai}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: C.muted }}>
              Also verifying universities from the web... this may take 10-15 seconds
            </div>
          </Card>
        )}

        {/* ── STEP 3: Results ──────────────────────── */}
        {step === 3 && result && (
          <div>
            {/* Summary */}
            <Card style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, color: C.dark }}>🎯 Your Career Analysis</h2>
                  {result.stream_recommendation && (
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                      Recommended Stream: <strong style={{ color: C.primary }}>{result.stream_recommendation}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge label={`${result.careers?.length || 0} Careers`}          color={C.primary} size="md" />
                  <Badge label={`${verifiedColleges.length} DB Colleges`}          color={C.success} size="md" />
                  {aiColleges.length > 0 && <Badge label={`+${aiColleges.length} AI Colleges`} color={C.warning} size="md" />}
                  <Badge label={`${result.exams?.length || 0} Exams`}              color={C.purple}  size="md" />
                </div>
              </div>

              {result.meta?.debate_summary && (
                <div style={{ background: "#f0f9ff", padding: "10px 14px", borderRadius: 10, marginTop: 14, fontSize: 13, color: "#0c4a6e" }}>
                  🧠 {result.meta.debate_summary}
                </div>
              )}
            </Card>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{ padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                    background: activeTab === t.id ? C.primary : C.white,
                    color:      activeTab === t.id ? C.white   : C.muted,
                    boxShadow:  activeTab === t.id ? "none" : C.shadowSm }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Degrees tab ── */}
            {activeTab === "degrees" && (
              <div>
                {degrees.length
                  ? degrees.map((d, i) => <DegreeCard key={i} degree={d} index={i} />)
                  : <Card><p style={{ color: C.muted }}>No degrees found.</p></Card>}
              </div>
            )}

            {/* ── Careers tab ── */}
            {activeTab === "careers" && (
              <div>
                {result.careers?.length
                  ? result.careers.map((c, i) => <CareerCard key={i} career={c} index={i} />)
                  : <Card><p style={{ color: C.muted }}>No careers found.</p></Card>}
              </div>
            )}

            {/* ── Colleges tab ── */}
            {activeTab === "colleges" && (
              <div>
                {/* Filter bar in results */}
                <Card style={{ padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 10 }}>🔍 Filter Colleges</div>
                  <FilterBar filters={filters} onChange={(f) => {
                    setFilters(f);
                    // Re-analyze with new filters
                    if (socketRef.current && isConnected) {
                      setStep(2); setResult(null);
                      setProgress("🔍 Filtering colleges...");
                      const cleanInterests = interests.split(",").map((i) => i.trim()).filter(Boolean);
                      socketRef.current.emit("analyze", {
                        query, interests: query ? [query, ...cleanInterests] : cleanInterests,
                        stream: stream || undefined, grade,
                        marks: percentage ? { percentage: parseInt(percentage) } : {},
                        filters: f,
                      });
                    }
                  }} />
                </Card>

                {/* DB verified colleges */}
                {verifiedColleges.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.success, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      ✅ Verified Colleges from Database ({verifiedColleges.length})
                    </div>
                    {verifiedColleges.map((c, i) => <CollegeCard key={i} college={c} isAISuggested={false} />)}
                  </div>
                )}

                {/* AI-suggested colleges */}
                {aiColleges.length > 0 && (
                  <div style={{ marginTop: verifiedColleges.length > 0 ? 24 : 0 }}>
                    <div style={{ background: "#fef3c7", padding: "12px 16px", borderRadius: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                        🤖 AI-Suggested Colleges ({aiColleges.length})
                      </div>
                      <div style={{ fontSize: 12, color: "#78350f" }}>
                        These colleges were identified by our AI advisors as relevant to your query.
                        Some details could not be automatically verified from official websites — please confirm fees,
                        eligibility, and course availability on the official university website before applying.
                      </div>
                    </div>
                    {aiColleges.map((c, i) => <CollegeCard key={i} college={c} isAISuggested={true} />)}
                  </div>
                )}

                {totalColleges === 0 && (
                  <Card><p style={{ color: C.muted }}>No colleges found. Try a different query or remove filters.</p></Card>
                )}
              </div>
            )}

            {/* ── Exams tab ── */}
            {activeTab === "exams" && (
              <div>
                {result.exams?.length
                  ? result.exams.map((e, i) => <ExamCard key={i} exam={e} />)
                  : <Card><p style={{ color: C.muted }}>No exams found.</p></Card>}

                {result.skills?.length > 0 && (
                  <Card style={{ marginTop: 16 }}>
                    <h3 style={{ marginTop: 0, color: C.dark }}>🛠️ Skills to Build</h3>
                    {result.skills.map((s, i) => <Badge key={i} label={s} color={C.primary} size="md" />)}
                  </Card>
                )}
              </div>
            )}

            {/* ── Roadmap tab ── */}
            {activeTab === "roadmap" && (
              <Card>
                <h3 style={{ marginTop: 0, color: C.dark }}>🗺️ Step-by-Step Roadmap</h3>
                {result.roadmap?.length
                  ? <Roadmap steps={result.roadmap} />
                  : <p style={{ color: C.muted }}>No roadmap available yet for this specific career. Try a more specific query.</p>}
              </Card>
            )}

            <button onClick={() => { setStep(1); setResult(null); setActiveTab("degrees"); }}
              style={{ marginTop: 8, padding: "11px 22px", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontSize: 14 }}>
              ← Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
