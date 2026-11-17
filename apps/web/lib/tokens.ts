// Sinh & băm device token. Token gốc chỉ trả về 1 lần cho người dùng;
// DB chỉ lưu SHA-256 hash → lộ DB cũng không dùng lại được token.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DEVICE_TOKEN_PREFIX = "pca_";

export function generateDeviceToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const token = `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return {
    token,
    tokenHash: hashDeviceToken(token),
    tokenPrefix: `${token.slice(0, 12)}…`,
  };
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 8 ? token : null;
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Vercel Cron gửi header `x-vercel-cron` — kiểm tra thêm CRON_SECRET để chắc chắn. */
export function isAuthorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const token = extractBearerToken(request);
  if (token && safeEqualString(token, expected)) return true;
  const headerSecret = request.headers.get("x-cron-secret");
  return Boolean(headerSecret && safeEqualString(headerSecret, expected));
}
