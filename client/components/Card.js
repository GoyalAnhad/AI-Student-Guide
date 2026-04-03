    export default function Card({ children }) {
    return (
        <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        marginBottom: "20px"
        }}>
        {children}
        </div>
    );
    }