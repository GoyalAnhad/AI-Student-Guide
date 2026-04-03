    "use client";

    import { useEffect, useState } from "react";

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    export default function Admin() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_URL}/api/admin/data`);

        if (!res.ok) {
            throw new Error(`Failed to fetch admin data (${res.status})`);
        }

        const d = await res.json();
        setData(d);
        } catch (err) {
        setError(err.message || "Something went wrong while loading admin data.");
        } finally {
        setLoading(false);
        }
    };

    const runScraper = async () => {
        try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_URL}/api/admin/scrape`, {
            method: "POST",
        });

        if (!res.ok) {
            throw new Error(`Scraper request failed (${res.status})`);
        }

        await fetchData();
        } catch (err) {
        setError(err.message || "Scraper failed.");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
        <h1>Admin Dashboard</h1>

        <button
            onClick={runScraper}
            disabled={loading}
            style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "10px",
            background: loading ? "#94a3b8" : "#0f172a",
            color: "white",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "16px",
            }}
        >
            {loading ? "Working..." : "Run Scraper"}
        </button>

        {error && (
            <div
            style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#fee2e2",
                color: "#991b1b",
            }}
            >
            {error}
            </div>
        )}

        {data && (
            <div>
            <h2>Exams</h2>
            {(data.exams || []).map((e, i) => (
                <div key={i} style={{ padding: "6px 0" }}>
                {e.name || e.title || "Unnamed exam"}
                </div>
            ))}

            <h2 style={{ marginTop: "24px" }}>Universities</h2>
            {(data.universities || []).map((u, i) => (
                <div key={i} style={{ padding: "6px 0" }}>
                {u.name || u.title || "Unnamed university"}
                </div>
            ))}
            </div>
        )}
        </div>
    );
    }