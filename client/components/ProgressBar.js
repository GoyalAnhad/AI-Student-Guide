    export default function ProgressBar({ step }) {
    return (
        <div style={{ background: "#ddd", height: "8px", marginBottom: "20px" }}>
        <div
            style={{
            width: `${step * 33}%`,
            height: "100%",
            background: "blue"
            }}
        />
        </div>
    );
    }