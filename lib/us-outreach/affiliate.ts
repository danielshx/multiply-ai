/**
 * Paid Online Writing Jobs — ClickBank affiliate constants for /us-outreach.
 * Hop-ID can be overridden via AFFILIATE_HOP_ID env var.
 */
const HOP_ID =
  process.env.AFFILIATE_HOP_ID ?? "991c2879-98a8-47f9-befe-6eedacf996f2";

export const AFFILIATE = {
  productName: "Paid Online Writing Jobs",
  productUrl: "https://paidonlinewritingjobs.com/funnel/job-quiz/job-quiz/",
  hopId: HOP_ID,
  hopParam: "happyrob",
  defaultCommissionUsd: 25,
} as const;

/**
 * Build a tracked quiz URL with the call_id as the ClickBank `cid` parameter
 * so conversions can be attributed back to the call that drove them.
 */
export function buildTrackedQuizUrl(callId: string): string {
  const u = new URL(AFFILIATE.productUrl);
  u.searchParams.set("hopId", AFFILIATE.hopId);
  u.searchParams.set("hop", AFFILIATE.hopParam);
  u.searchParams.set("cid", callId);
  return u.toString();
}
