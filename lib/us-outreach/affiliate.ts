/**
 * Free AI Course — universal high-conversion cold-call offer.
 *
 * Defaults to DeepLearning.AI's free short-courses hub, which is:
 *   - Actually free forever (no trial, no payment required)
 *   - Globally trusted brand (Andrew Ng)
 *   - No signup required to browse the catalog
 *   - Multi-language friendly (English, but universally understood)
 *
 * Override with env COURSE_URL for a different landing page (Coursera,
 * your own Typeform, your own landing, etc.).
 */
const COURSE_URL =
  process.env.COURSE_URL ??
  "https://www.deeplearning.ai/short-courses/";

const BRAND =
  process.env.COURSE_BRAND ?? "Yale University";

export const AFFILIATE = {
  productName: `${BRAND} — Free AI Course`,
  brandName: BRAND,
  productUrl: COURSE_URL,
  hopId: "ai-academy",
  hopParam: "cid",
  defaultCommissionUsd: 0,
} as const;

/**
 * Build a URL for the course landing page, tagged with call_id so we can
 * trace conversions in our own logs if the landing supports cid params.
 */
export function buildTrackedQuizUrl(callId: string): string {
  try {
    const u = new URL(AFFILIATE.productUrl);
    u.searchParams.set("ref", AFFILIATE.hopId);
    u.searchParams.set("cid", callId);
    return u.toString();
  } catch {
    return AFFILIATE.productUrl;
  }
}
