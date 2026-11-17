// Session JWT ký bằng AUTH_SECRET (HS256) — tương thích Edge Runtime (dùng trong middleware).
// Tách riêng khỏi lib/auth.ts để middleware không kéo theo next/headers.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pca_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 ngày
const ISSUER = "pctrolyai";

export type SessionPayload = {
  email: string;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET chưa được cấu hình hoặc ngắn hơn 32 ký tự.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: ISSUER });
    return typeof payload.email === "string" ? { email: payload.email } : null;
  } catch {
    return null;
  }
}
