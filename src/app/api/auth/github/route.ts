import { NextRequest, NextResponse } from "next/server";

// Redirect user to GitHub's OAuth authorization page
export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    // Redirect back to app with error (this is a browser navigation, not API call)
    return NextResponse.redirect(new URL("/?auth_error=not_configured", request.nextUrl.origin));
  }

  // Build the callback URL from the current request origin
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/github/callback`;

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user repo",
    state,
  });

  const githubUrl = `https://github.com/login/oauth/authorize?${params}`;

  // Use NextResponse so we can set cookies on the redirect
  const response = NextResponse.redirect(githubUrl);
  response.cookies.set("gh_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });

  return response;
}
