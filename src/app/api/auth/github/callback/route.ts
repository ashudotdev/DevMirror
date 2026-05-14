import { NextRequest, NextResponse } from "next/server";
import { createSession, type GitHubUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const origin = request.nextUrl.origin;

  // Verify state matches
  const storedState = request.cookies.get("gh_oauth_state")?.value;
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/?auth_error=invalid_state", origin));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?auth_error=not_configured", origin));
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error("[DevMirror] GitHub token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/?auth_error=token_failed", origin));
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/?auth_error=user_fetch_failed", origin));
    }

    const userData = await userRes.json();

    const user: GitHubUser = {
      id: userData.id,
      login: userData.login,
      avatar_url: userData.avatar_url,
      name: userData.name,
      accessToken,
    };

    // Create session
    await createSession(user);

    // Redirect back to app — clear the OAuth state cookie
    const response = NextResponse.redirect(new URL("/", origin));
    response.cookies.set("gh_oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("[DevMirror] GitHub OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?auth_error=unknown", origin));
  }
}
