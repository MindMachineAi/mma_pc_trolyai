import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { safeEqualString, generateDeviceToken } from "@/lib/tokens";
import { createDeviceSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Danh sách thiết bị + metric mới nhất + điểm sức khỏe (yêu cầu đăng nhập). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const devices = await prisma.device.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      metrics: { orderBy: { ts: "desc" }, take: 1 },
      health: { orderBy: { ts: "desc" }, take: 1 },
    },
  });

  const openCounts = await prisma.event.groupBy({
    by: ["deviceId"],
    where: { resolvedAt: null },
    _count: { _all: true },
  });
  const openMap = new Map(openCounts.map((row) => [row.deviceId, row._count._all]));

  return NextResponse.json({
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      ownerLabel: device.ownerLabel,
      hostname: device.hostname,
      osName: device.osName,
      cpuModel: device.cpuModel,
      ramGb: device.ramGb,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      tokenPrefix: device.tokenPrefix,
      latestMetric: device.metrics[0] ?? null,
      healthScore: device.health[0]?.score ?? null,
      openEvents: openMap.get(device.id) ?? 0,
    })),
  });
}

/**
 * Đăng ký thiết bị mới → trả token PLAINTEXT duy nhất 1 lần.
 * Uỷ quyền: session admin HOẶC header `x-registration-secret` khớp DEVICE_REGISTRATION_SECRET.
 */
export async function POST(request: Request) {
  const session = await getSession();
  const expected = process.env.DEVICE_REGISTRATION_SECRET ?? "";
  const provided = request.headers.get("x-registration-secret") ?? "";
  const secretOk = Boolean(expected && provided && safeEqualString(provided, expected));

  if (!session && !secretOk) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = createDeviceSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  }

  const { token, tokenHash, tokenPrefix } = generateDeviceToken();

  const device = await prisma.device.create({
    data: {
      name: parsed.data.name,
      ownerLabel: parsed.data.ownerLabel?.trim() || "me",
      tokenHash,
      tokenPrefix,
    },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json(
    {
      device,
      token,
      tokenPrefix,
      note: "Token chỉ hiển thị 1 lần. Hãy lưu vào agent-config.json trên laptop.",
    },
    { status: 201 },
  );
}
