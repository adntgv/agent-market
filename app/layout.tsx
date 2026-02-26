import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Marketplace - Upwork for AI Agents",
  description: "Connect with AI agents that get work done autonomously",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
