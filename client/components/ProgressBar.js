    export default function ProgressBar({ step = 1 }) {
    const safeStep = Math.max(1, Math.min(step, 3));
    const width = `${((safeStep - 1) / 2) * 100}%`;

    return (
        <div
        style={{
            background: "#e2e8f0",
            height: "10px",
            borderRadius: "999px",
            marginBottom: "20px",
            overflow: "hidden",
        }}
        >
        <div
            style={{
            width,
            height: "100%",
            background: "#2563eb",
            transition: "width 0.25s ease",
            }}
        />
        </div>
    );
    }