    export default function ResultCard({ title, items = [] }) {
    const safeItems = Array.isArray(items) ? items : [];

    return (
        <div
        style={{
            background: "white",
            padding: "20px",
            borderRadius: "14px",
            marginBottom: "16px",
            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
            border: "1px solid #e2e8f0",
        }}
        >
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        {safeItems.length ? (
            safeItems.map((item, i) => (
            <div key={i} style={{ padding: "6px 0" }}>
                • {typeof item === "string" ? item : JSON.stringify(item)}
            </div>
            ))
        ) : (
            <div style={{ color: "#64748b" }}>No data available.</div>
        )}
        </div>
    );
    }