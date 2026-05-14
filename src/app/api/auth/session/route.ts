import { getSession } from "@/lib/auth";

// Return current session data (without the access token) to the client
export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: session.userId,
      login: session.login,
      avatar_url: session.avatar_url,
      name: session.name,
    },
  });
}
