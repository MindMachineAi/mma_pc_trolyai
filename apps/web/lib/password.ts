// Xác thực admin — CHỈ dùng ở server (Node runtime), không import vào middleware/edge.
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPassword) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail);
  const passwordOk = safeEqual(password, expectedPassword);
  return emailOk && passwordOk;
}
