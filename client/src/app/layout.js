  import "./globals.css";

  export const metadata = {
    title: "Career AI Platform",
    description: "AI-powered career guidance for students",
  };

  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }