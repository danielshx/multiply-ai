/**
 * Pre-pitch reset: wipe + re-seed the cognee dataset.
 *
 * Usage:
 *   pnpm tsx scripts/seed-cognee.ts          # seed without reset
 *   pnpm tsx scripts/seed-cognee.ts --reset  # wipe first
 */
const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const reset = process.argv.includes("--reset");

(async () => {
  console.log(`→ POST ${url}/api/cognee/seed (reset=${reset})`);
  const res = await fetch(`${url}/api/cognee/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset }),
  });
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok || body.ok === false) process.exit(1);
})();
