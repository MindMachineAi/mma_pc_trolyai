import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { updateDeviceSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Đổi tên thiết bị / nhãn chủ sở hữu.
 * Token và trạng thái giữ nguyên — không ảnh hưởng agent đang chạy.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = updateDeviceSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  }

  const existing = await prisma.device.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data: { name?: string; ownerLabel?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.ownerLabel !== undefined) data.ownerLabel = parsed.data.ownerLabel || "me";

  const device = await prisma.device.update({
    where: { id },
    data,
    select: { id: true, name: true, ownerLabel: true },
  });

  return NextResponse.json({ ok: true, device });
}

/**
 * Thu hồi thiết bị: chuyển status = DISABLED và hủy các lệnh đang chờ.
 * Giữ lại lịch sử để đối soát (không xoá cứng).
 *
 * `?purge=true`: xoá vĩnh viễn thiết bị cùng toàn bộ metric/event/insight/command
 * (Prisma schema dùng onDelete: Cascade) — dùng khi đã thanh lý máy.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const purge = new URL(request.url).searchParams.get("purge") === "true";

  const existing = await prisma.device.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (purge) {
    await prisma.device.delete({ where: { id } });
    return NextResponse.json({ ok: true, purged: id });
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
