    "use client";
    import { useState, useEffect } from "react";
    import { io } from "socket.io-client";

    const socket = io("http://localhost:5000");

    export default function Home() {
    const [result, setResult] = useState(null);

    useEffect(() => {
        socket.on("result", (data) => {
        setResult(data);
        });
    }, []);

    const sendData = () => {
        socket.emit("analyze", {
        interests: ["robot", "security"],
        });
    };

    return (
        <div className="p-10">
        <h1>Career AI Platform</h1>

        <button onClick={sendData}>
            Analyze
        </button>

        {result && (
            <div>
            <h2>Careers:</h2>
            {result.careers.map((c, i) => (
                <div key={i}>{c.career}</div>
            ))}
            </div>
        )}
        </div>
    );
    }
