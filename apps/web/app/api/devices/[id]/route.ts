import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thu hồi thiết bị: chuyển status = DISABLED và hủy các lệnh đang chờ.
 * Giữ lại lịch sử để đối soát (không xoá cứng).
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.device.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.device.update({ where: { id }, data: { status: "DISABLED" } }),
    prisma.command.updateMany({
      where: { deviceId: id, status: { in: ["PENDING", "SENT"] } },
      data: { status: "FAILED", completedAt: new Date(), result: { error: "device_revoked" } },
    }),
  ]);

  return NextResponse.json({ ok: true, revoked: id });
}
