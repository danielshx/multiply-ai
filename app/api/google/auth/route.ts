import { NextResponse } from "next/server";

/**
 * GET /api/google/auth — kicks off the OAuth consent flow.
 * Visit once after setting GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET
 * in .env.local. Google will redirect to /api/google/callback with a code,
 * which we exchange for a refresh token and display.
 */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID is not set in .env.local" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
