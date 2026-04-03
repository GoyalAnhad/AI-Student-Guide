import "../styles/globals.css";

export const metadata = {
  title: "Career AI Platform",
};

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}