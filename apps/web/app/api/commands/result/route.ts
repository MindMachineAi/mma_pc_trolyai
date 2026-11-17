import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashDeviceToken, extractBearerToken } from "@/lib/tokens";
import { commandResultSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Agent báo kết quả thực thi lệnh: POST /api/commands/result */
export async function POST(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const device = await prisma.device.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
    select: { id: true },
  });
  if (!device) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = commandResultSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  }

  const command = await prisma.command.findFirst({
    where: { id: parsed.data.commandId, deviceId: device.id },
    select: { id: true },
  });
  if (!command) return NextResponse.json({ error: "command_not_found" }, { status: 404 });

  const resultPayload = {
    ...(parsed.data.result ?? {}),
    ...(parsed.data.error ? { error: parsed.data.error } : {}),
  } as Prisma.InputJsonValue;

  await prisma.command.update({
    where: { id: command.id },
    data: {
      status: parsed.data.status,
      completedAt: new Date(),
      result: resultPayload,
    },
  });

  return NextResponse.json({ ok: true });
}
