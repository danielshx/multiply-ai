import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Multiply · your sales team, multiplied";
const description =
  "Seven autonomous AI agents that mine the web for buying signals, open leads, run voice calls, handle objections, and book real meetings — powered by a cognee knowledge graph that grows with every call.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("https://multiply-danielshxs-projects.vercel.app"),
  applicationName: "Multiply",
  authors: [{ name: "Multiply team · HappyRobot × TUM.ai" }],
  keywords: [
    "AI sales agents",
    "autonomous sales",
    "HappyRobot",
    "cognee",
    "knowledge graph",
    "voice AI",
    "outbound automation",
    "TUM.ai",
  ],
  openGraph: {
    title,
    description,
    url: "https://multiply-danielshxs-projects.vercel.app",
    siteName: "Multiply",
    images: [
      {
        url: "/hero.png",
        width: 1200,
        height: 630,
        alt: "Multiply — autonomous AI sales agents",
      },
    ],
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/hero.png"],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
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
