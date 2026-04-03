    export default function ResultCard({ title, items }) {
    return (
        <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "15px"
        }}>
        <h3>{title}</h3>
        {items.map((item, i) => (
            <div key={i}>• {item}</div>
        ))}
        </div>
    );
    }