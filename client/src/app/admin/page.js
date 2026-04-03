    "use client";

    import { useEffect, useState } from "react";

    export default function Admin() {
    const [data, setData] = useState(null);

    const fetchData = async () => {
        const res = await fetch("http://localhost:5000/api/admin/data");
        const d = await res.json();
        setData(d);
    };

    const runScraper = async () => {
        await fetch("http://localhost:5000/api/admin/scrape", {
        method: "POST",
        });
        fetchData();
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div style={{ padding: "20px" }}>
        <h1>Admin Dashboard</h1>

        <button onClick={runScraper}>
            Run Scraper
        </button>

        {data && (
            <div>
            <h2>Exams</h2>
            {data.exams.map((e, i) => (
                <div key={i}>{e.name}</div>
            ))}

            <h2>Universities</h2>
            {data.universities.map((u, i) => (
                <div key={i}>{u.name}</div>
            ))}
            </div>
        )}
        </div>
    );
    }