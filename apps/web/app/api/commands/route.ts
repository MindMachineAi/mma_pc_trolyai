import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashDeviceToken, extractBearerToken } from "@/lib/tokens";
import { createCommandSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/commands
 * - Có Bearer device token  → agent poll: trả các lệnh PENDING và đánh dấu SENT
 * - Có session admin        → liệt kê lệnh gần đây (lọc theo ?deviceId=)
 */
export async function GET(request: Request) {
  const token = extractBearerToken(request);

  if (token) {
    const device = await prisma.device.findUnique({
      where: { tokenHash: hashDeviceToken(token) },
      select: { id: true, status: true },
    });
    if (!device) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    if (device.status === "DISABLED") {
      return NextResponse.json({ error: "device_disabled" }, { status: 403 });
    }

    const pending = await prisma.command.findMany({
      where: { deviceId: device.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, type: true, params: true, createdAt: true },
    });

    if (pending.length > 0) {
      await prisma.command.updateMany({
        where: { id: { in: pending.map((command) => command.id) } },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    return NextResponse.json({ commands: pending });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? undefined;
  const commands = await prisma.command.findMany({
    where: deviceId ? { deviceId } : {},
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      deviceId: true,
      type: true,
      status: true,
      params: true,
      result: true,
      createdAt: true,
      sentAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ commands });
}

/** POST /api/commands — admin tạo lệnh (yêu cầu đăng nhập). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = createCommandSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  }

  const device = await prisma.device.findUnique({
    where: { id: parsed.data.deviceId },
    select: { id: true, status: true },
  });
  if (!device) return NextResponse.json({ error: "device_not_found" }, { status: 404 });
  if (device.status === "DISABLED") {
    return NextResponse.json({ error: "device_disabled" }, { status: 409 });
  }

  const command = await prisma.command.create({
    data: {
      deviceId: device.id,
      type: parsed.data.type,
      params: parsed.data.params
        ? (parsed.data.params as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
    select: { id: true, type: true, status: true, createdAt: true },
  });

  return NextResponse.json({ command }, { status: 201 });
}
