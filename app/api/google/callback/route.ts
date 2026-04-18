import { NextResponse } from "next/server";

/**
 * GET /api/google/callback — Google redirects here with `?code=...`.
 * We exchange it for a refresh_token and show it as plain text so the user
 * can paste GOOGLE_OAUTH_REFRESH_TOKEN into .env.local.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Missing ?code parameter", { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set" },
      { status: 500 },
    );
  }

  const redirectUri = `${url.origin}/api/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse(
      `Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`,
      { status: 502 },
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    return new NextResponse(
      "No refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and try again — Google only issues refresh_token on first consent.",
      { status: 400 },
    );
  }

  const html = `<!doctype html>
<html><head><title>Multiply · Google OAuth complete</title>
<style>body{font:14px ui-monospace,Menlo;padding:40px;max-width:780px;margin:0 auto;background:#fafafa}
code{display:block;padding:14px;background:#fff;border:1px solid #e8e8eb;border-radius:6px;word-break:break-all}
h1{font-family:Georgia,serif;font-weight:400;font-size:32px}</style></head>
<body>
<h1>Refresh token captured ✓</h1>
<p>Paste this into <code>.env.local</code> as <strong>GOOGLE_OAUTH_REFRESH_TOKEN</strong>:</p>
<code>${tokens.refresh_token}</code>
<p style="margin-top:20px;color:#525257">Then restart the dev server. Tell me you're done and I'll smoke-test the book-meeting tool.</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
