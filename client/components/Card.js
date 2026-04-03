    export default function Card({ children }) {
    return (
        <div
        style={{
            background: "white",
            padding: "20px",
            borderRadius: "14px",
            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
        }}
        >
        {children}
        </div>
    );
    }