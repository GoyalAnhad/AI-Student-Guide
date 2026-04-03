  "use client";

  import { useEffect, useRef, useState } from "react";
  import { io } from "socket.io-client";

  import Navbar from "../../components/Navbar";
  import Card from "../../components/Card";
  import ResultCard from "../../components/ResultCard";
  import ProgressBar from "../../components/ProgressBar";

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  export default function Home() {
    const socketRef = useRef(null);

    const [step, setStep] = useState(1);
    const [interests, setInterests] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
      const socket = io(API_URL, {
        transports: ["websocket"],
        withCredentials: false,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        setError("");
      });

      socket.on("connect_error", () => {
        setIsConnected(false);
        setError("Could not connect to the backend right now.");
      });

      socket.on("result", (data) => {
        setResult(data);
        setStep(3);
      });

      return () => {
        socket.off("connect");
        socket.off("connect_error");
        socket.off("result");
        socket.disconnect();
        socketRef.current = null;
      };
    }, []);

    const analyze = () => {
      const cleanInterests = interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!cleanInterests.length) {
        setError("Please enter at least one interest.");
        return;
      }

      if (!socketRef.current) {
        setError("Backend connection is not ready yet.");
        return;
      }

      setError("");
      setResult(null);
      setStep(2);

      socketRef.current.emit("analyze", {
        interests: cleanInterests,
      });
    };

    return (
      <div>
        <Navbar />

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
          <ProgressBar step={step} />

          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#fee2e2",
                color: "#991b1b",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <Card>
              <h2 style={{ marginTop: 0 }}>Your Interests</h2>
              <p style={{ marginTop: "8px", color: "#64748b" }}>
                Enter a few interests separated by commas.
              </p>

              <input
                placeholder="e.g. robotics, security, design"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  marginTop: "10px",
                  marginBottom: "16px",
                }}
              />

              <button
                onClick={() => setStep(2)}
                style={{
                  padding: "12px 18px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#0f172a",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            </Card>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <Card>
              <h2 style={{ marginTop: 0 }}>Analyze</h2>

              <p style={{ color: "#64748b" }}>
                {isConnected
                  ? "Connected to backend. Ready to run analysis."
                  : "Connecting to backend..."}
              </p>

              <button
                onClick={analyze}
                disabled={!isConnected}
                style={{
                  padding: "12px 18px",
                  border: "none",
                  borderRadius: "10px",
                  background: isConnected ? "#2563eb" : "#94a3b8",
                  color: "white",
                  fontWeight: 600,
                  cursor: isConnected ? "pointer" : "not-allowed",
                }}
              >
                Run AI Analysis
              </button>
            </Card>
          )}

          {/* RESULT */}
          {step === 3 && result && (
            <div>
              <h2 style={{ marginBottom: "16px" }}>🎯 Your Results</h2>

              <ResultCard
                title="Careers"
                items={(result.careers || []).map((c) => c.career || c)}
              />

              <ResultCard
                title="Roadmap"
                items={(result.roadmap || []).flat ? result.roadmap.flat() : result.roadmap || []}
              />
            </div>
          )}
        </div>
      </div>
    );
  }