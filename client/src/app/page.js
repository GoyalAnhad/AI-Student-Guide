"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";

import Navbar from "../components/Navbar";
import Card from "../components/Card";
import ResultCard from "../components/ResultCard";
import ProgressBar from "../components/ProgressBar";

const socket = io("http://localhost:5000");

export default function Home() {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    socket.on("result", (data) => {
      setResult(data);
      setStep(3);
    });
  }, []);

  const analyze = () => {
    socket.emit("analyze", {
      interests: interests.split(","),
    });
  };

  return (
    <div>
      <Navbar />

      <div style={{ padding: "20px" }}>
        <ProgressBar step={step} />

        {/* STEP 1 */}
        {step === 1 && (
          <Card>
            <h2>Your Interests</h2>

            <input
              placeholder="e.g robotics, security"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              style={{ width: "100%", padding: "10px" }}
            />

            <button onClick={() => setStep(2)}>
              Next
            </button>
          </Card>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <Card>
            <h2>Analyze</h2>

            <button onClick={analyze}>
              Run AI Analysis
            </button>
          </Card>
        )}

        {/* RESULT */}
        {step === 3 && result && (
          <div>
            <h2>🎯 Your Results</h2>

            <ResultCard
              title="Careers"
              items={result.careers.map(c => c.career)}
            />

            <ResultCard
              title="Roadmap"
              items={result.roadmap.flat()}
            />
          </div>
        )}
      </div>
    </div>
  );
}