import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAuthorizedCron } from "@/lib/tokens";
import { analyzeQuerySchema } from "@/lib/validators";
import { computeHealth } from "@/lib/health";
import { analyzeDevice } from "@/lib/ai/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OFFLINE_AFTER_MS = 5 * 60 * 1000;
const STALE_EVENT_MS = 24 * 60 * 60 * 1000;
const METRIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const INSIGHT_FRESH_MS = 6 * 60 * 60 * 1000;

type RunResult = {
  deviceId: string;
  name: string;
  status: "analyzed" | "skipped" | "error";
  detail?: string;
  insightId?: number;
  healthScore?: number;
  usage?: { promptTokens: number; completionTokens: number };
};

async function runAnalyze(request: Request) {
  const session = await getSession();
  const authorized = Boolean(session) || isAuthorizedCron(request);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedQuery = analyzeQuerySchema.safeParse({ limit: url.searchParams.get("limit") ?? undefined });
  const limit = parsedQuery.success ? (parsedQuery.data.limit ?? 2) : 2;

  const now = new Date();

  // 1) Máy không gửi dữ liệu > 5 phút → OFFLINE
  const offline = await prisma.device.updateMany({
    where: { status: "ONLINE", lastSeenAt: { lt: new Date(now.getTime() - OFFLINE_AFTER_MS) } },
    data: { status: "OFFLINE" },
  });

  // 2) Tự đóng cảnh báo cũ hơn 24h (không còn "treo" trên dashboard)
  const resolved = await prisma.event.updateMany({
    where: { resolvedAt: null, createdAt: { lt: new Date(now.getTime() - STALE_EVENT_MS) } },
    data: { resolvedAt: now },
  });

  // 3) Retention: xoá metric thô > 7 ngày (giữ chi phí Neon ở mức free)
  const purged = await prisma.metric.deleteMany({
    where: { ts: { lt: new Date(now.getTime() - METRIC_RETENTION_MS) } },
  });

  const counters = {
    offlineMarked: offline.count,
    staleEventsResolved: resolved.count,
    metricsPurged: purged.count,
  };

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      ok: true,
      aiSkipped: true,
      reason: "DEEPSEEK_API_KEY chưa cấu hình",
      counters,
      results: [] as RunResult[],
    });
  }

  const devices = await prisma.device.findMany({
    where: { status: "ONLINE" },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      metrics: { orderBy: { ts: "desc" }, take: 12 },
      events: {
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      insights: { orderBy: { ts: "desc" }, take: 1 },
    },
  });

  const results: RunResult[] = [];

  for (const device of devices) {
    const latest = device.metrics[0];
    if (!latest) {
      results.push({ deviceId: device.id, name: device.name, status: "skipped", detail: "no_metrics" });
      continue;
    }

    const lastInsight = device.insights[0];
    const hasNewerEvent =
      !lastInsight || device.events.some((event) => event.createdAt > lastInsight.ts);
    const insightStale =
      !lastInsight || now.getTime() - lastInsight.ts.getTime() > INSIGHT_FRESH_MS;

    if (!hasNewerEvent && !insightStale) {
      results.push({
        deviceId: device.id,
        name: device.name,
        status: "skipped",
        detail: "insight_still_fresh",
      });
      continue;
    }

    const health = computeHealth({
      cpuPct: latest.cpuPct,
      memPct: latest.memPct,
      diskPct: latest.diskPct,
      diskFreeGb: latest.diskFreeGb,
      tempCpu: latest.tempCpu,
      batteryWear: latest.batteryWear,
    });

    try {
      const { draft, model, usage } = await analyzeDevice({
        device: {
          name: device.name,
          hostname: device.hostname,
          osName: device.osName,
          cpuModel: device.cpuModel,
          ramGb: device.ramGb,
          status: device.status,
        },
        metrics: device.metrics.map((metric) => ({
          ts: metric.ts.toISOString(),
          cpuPct: metric.cpuPct,
          memPct: metric.memPct,
          diskPct: metric.diskPct,
          diskFreeGb: metric.diskFreeGb,
          tempCpu: metric.tempCpu,
          batteryPct: metric.batteryPct,
          batteryWear: metric.batteryWear,
          uptimeSec: metric.uptimeSec,
        })),
        events: device.events.map((event) => ({
          severity: event.severity,
          code: event.code,
          message: event.message,
          createdAt: event.createdAt.toISOString(),
        })),
        health,
      });

      const created = await prisma.$transaction(async (tx) => {
        await tx.insight.updateMany({
          where: { deviceId: device.id, status: "OPEN" },
          data: { status: "ACKED" },
        });
        return tx.insight.create({
          data: {
            deviceId: device.id,
            model,
            severity: draft.severity,
            summary: draft.summary,
            recommendations: draft.recommendations,
            healthScore: draft.healthScore,
          },
          select: { id: true },
        });
      });

      results.push({
        deviceId: device.id,
        name: device.name,
        status: "analyzed",
        insightId: created.id,
        healthScore: draft.healthScore,
        usage,
      });
    } catch (error) {
      results.push({
        deviceId: device.id,
        name: device.name,
        status: "error",
        detail: error instanceof Error ? error.message.slice(0, 300) : "unknown_error",
      });
    }
  }

  return NextResponse.json({ ok: true, counters, results });
}

/** Vercel Cron gọi bằng GET; admin có thể gọi bằng POST để "phân tích ngay". */
export async function GET(request: Request) {
  return runAnalyze(request);
}

export async function POST(request: Request) {
  return runAnalyze(request);
}
