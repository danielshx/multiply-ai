import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiply · your sales team, multiplied",
  description:
    "Autonomous AI sales agents that find leads, qualify them, and book meetings — built for HappyRobot × TUM.ai.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
