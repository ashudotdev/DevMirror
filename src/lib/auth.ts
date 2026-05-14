import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// ─── Types ──────────────────────────────────────────────────────────

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  accessToken: string;
}

export interface SessionPayload {
  userId: number;
  login: string;
  avatar_url: string;
  name: string | null;
  accessToken: string;
  expiresAt: string;
}

// ─── Config ─────────────────────────────────────────────────────────

const SECRET = process.env.SESSION_SECRET || "devmirror-default-secret-change-me-in-prod";
const encodedKey = new TextEncoder().encode(SECRET);
const COOKIE_NAME = "dm_session";

// ─── Encrypt / Decrypt ──────────────────────────────────────────────

async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Session CRUD ───────────────────────────────────────────────────

export async function createSession(user: GitHubUser): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({
    userId: user.id,
    login: user.login,
    avatar_url: user.avatar_url,
    name: user.name,
    accessToken: user.accessToken,
    expiresAt: expiresAt.toISOString(),
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decrypt(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
