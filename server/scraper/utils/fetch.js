    import axios from "axios";

    const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    ];

    export async function safeFetch(url) {
    const randomAgent =
        agents[Math.floor(Math.random() * agents.length)];

    const res = await axios.get(url, {
        headers: {
        "User-Agent": randomAgent,   // 👈 HERE
        },
    });

    return res.data;
    }