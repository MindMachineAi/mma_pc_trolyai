import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Endpoint kiểm tra cấu hình — KHÔNG trả về giá trị secret, chỉ trạng thái có/không. */
export async function GET() {
  const db = await pingDatabase();
  const authConfigured = Boolean(
    process.env.AUTH_SECRET && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,
  );
  const aiConfigured = Boolean(process.env.DEEPSEEK_API_KEY);
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const ok = db.ok && authConfigured;

  return NextResponse.json(
    {
      ok,
      version: "0.1.0",
      database: db.ok ? "connected" : "error",
      databaseError: db.error ?? null,
      authConfigured,
      aiConfigured,
      cronConfigured,
      aiProvider: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
    },
    { status: ok ? 200 : 503 },
  );
}
