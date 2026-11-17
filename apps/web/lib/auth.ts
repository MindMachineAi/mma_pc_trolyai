// Quản lý session qua cookie httpOnly (chỉ dùng ở Server Component / Server Action / Route Handler).
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

export { SESSION_COOKIE, SESSION_MAX_AGE_SEC, verifySessionToken };
export type { SessionPayload };

export async function createSession(email: string): Promise<void> {
  const token = await signSessionToken({ email });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Trả về session hoặc null — route handler tự quyết định trả 401. */
export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}
