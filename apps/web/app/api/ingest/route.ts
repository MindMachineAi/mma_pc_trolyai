import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashDeviceToken, extractBearerToken } from "@/lib/tokens";
import { ingestSchema } from "@/lib/validators";
import { evaluateRules } from "@/lib/rules";
import { computeHealth } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HISTORY_TAKE = 10;
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 giờ
const SNAPSHOT_MINUTE_MODULO = 10;

/**
 * Agent gọi mỗi 60s: POST /api/ingest
 * - Xác thực bằng device token (Bearer)
 * - Lưu metric, chấm điểm sức khỏe, chạy rules engine → tạo event (có chống trùng)
 * - Trả về danh sách lệnh đang chờ để agent thực thi (1 round-trip)
 */
export async function POST(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  const device = await prisma.device.findUnique({
    where: { tokenHash: hashDeviceToken(token) },
    select: { id: true, status: true },
  });

  if (!device) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (device.status === "DISABLED") {
    return NextResponse.json({ error: "device_disabled" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 8) },
      { status: 422 },
    );
  }

  const now = new Date();
  const { system, metrics } = parsed.data;

  const history = await prisma.metric.findMany({
    where: { deviceId: device.id },
    orderBy: { ts: "desc" },
    take: HISTORY_TAKE,
    select: {
      cpuPct: true,
      memPct: true,
      diskPct: true,
      diskFreeGb: true,
      tempCpu: true,
      batteryPct: true,
      batteryWear: true,
    },
  });

  const health = computeHealth({
    cpuPct: metrics.cpuPct,
    memPct: metrics.memPct,
    diskPct: metrics.diskPct,
    diskFreeGb: metrics.diskFreeGb,
    tempCpu: metrics.tempCpu ?? null,
    batteryWear: metrics.batteryWear ?? null,
  });

  const ruleEvents = evaluateRules(metrics, history);

  let eventsToCreate: typeof ruleEvents = [];
  if (ruleEvents.length > 0) {
    const recent = await prisma.event.findMany({
      where: {
        deviceId: device.id,
        resolvedAt: null,
        createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      select: { code: true },
    });
    const existingCodes = new Set(recent.map((event) => event.code));
    eventsToCreate = ruleEvents.filter((event) => !existingCodes.has(event.code));
  }

  const deviceUpdate: Prisma.DeviceUpdateInput = { status: "ONLINE", lastSeenAt: now };
  if (system?.hostname) deviceUpdate.hostname = system.hostname;
  if (system?.osName) deviceUpdate.osName = system.osName;
  if (system?.cpuModel) deviceUpdate.cpuModel = system.cpuModel;
  if (system?.gpuModel) deviceUpdate.gpuModel = system.gpuModel;
  if (typeof system?.ramGb === "number") deviceUpdate.ramGb = system.ramGb;

  const writeSnapshot = now.getUTCMinutes() % SNAPSHOT_MINUTE_MODULO === 0;

  await prisma.$transaction(async (tx) => {
    await tx.metric.create({
      data: {
        deviceId: device.id,
        ts: now,
        cpuPct: metrics.cpuPct,
        memPct: metrics.memPct,
        diskPct: metrics.diskPct,
        diskFreeGb: metrics.diskFreeGb,
        tempCpu: metrics.tempCpu ?? null,
        batteryPct: metrics.batteryPct ?? null,
        batteryWear: metrics.batteryWear ?? null,
        netUpKbps: metrics.netUpKbps ?? null,
        netDownKbps: metrics.netDownKbps ?? null,
        uptimeSec: metrics.uptimeSec,
        procCount: metrics.procCount ?? null,
        topProcesses: metrics.topProcesses
          ? (metrics.topProcesses as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    await tx.device.update({ where: { id: device.id }, data: deviceUpdate });

    for (const event of eventsToCreate) {
      await tx.event.create({
        data: {
          deviceId: device.id,
          severity: event.severity,
          code: event.code,
          message: event.message,
          details: event.details
            ? (event.details as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    }

    if (writeSnapshot) {
      await tx.healthSnapshot.create({
        data: {
          deviceId: device.id,
          score: health.score,
          breakdown: health.parts as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  const pendingCommands = await prisma.command.findMany({
    where: { deviceId: device.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, type: true, params: true, createdAt: true },
  });

  if (pendingCommands.length > 0) {
    await prisma.command.updateMany({
      where: { id: { in: pendingCommands.map((command) => command.id) } },
      data: { status: "SENT", sentAt: now },
    });
  }

  return NextResponse.json({
    ok: true,
    serverTime: now.toISOString(),
    healthScore: health.score,
    newEvents: eventsToCreate.map((event) => event.code),
    commands: pendingCommands,
  });
}
