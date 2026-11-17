import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateDeviceToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kết nối lại thiết bị: cấp token MỚI (token cũ mất hiệu lực ngay), đưa thiết bị
 * về OFFLINE và hủy các lệnh đang chờ. Dùng khi:
 * - máy cài lại Windows / cài agent trên máy khác;
 * - thiết bị đã bị thu hồi (DISABLED) muốn dùng lại;
 * - nghi token cũ bị lộ.
 *
 * Token mới chỉ trả về 1 lần → dashboard hiện luôn nút "Tải bộ cài".
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.device.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { token, tokenHash, tokenPrefix } = generateDeviceToken();

  await prisma.$transaction([
    prisma.device.update({
      where: { id },
      data: { tokenHash, tokenPrefix, status: "OFFLINE" },
    }),
    prisma.command.updateMany({
      where: { deviceId: id, status: { in: ["PENDING", "SENT"] } },
      data: { status: "FAILED", completedAt: new Date(), result: { error: "token_rotated" } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    device: { id: existing.id, name: existing.name },
    token,
    tokenPrefix,
    note: "Token mới chỉ hiển thị 1 lần. Agent đang chạy bằng token cũ sẽ bị từ chối (401) — hãy cài lại bằng bộ cài mới.",
  });
}
