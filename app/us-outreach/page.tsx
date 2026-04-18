import type { Metadata } from "next";
import UsOutreachDashboard from "@/components/us-outreach/UsOutreachDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "US Outreach · Multiply",
  description:
    "HappyRobot-powered US cold-call dashboard for the Paid Online Writing Jobs affiliate funnel.",
  robots: { index: false, follow: false },
};

export default function UsOutreachPage() {
  return <UsOutreachDashboard />;
}
