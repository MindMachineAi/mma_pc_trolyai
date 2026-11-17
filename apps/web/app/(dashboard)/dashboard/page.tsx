import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { AddDevice } from "@/components/add-device";
import { AnalyzeButton } from "@/components/analyze-button";
import { DeviceCard, type DeviceCardData } from "@/components/device-card";
import { EmptyState, Panel, StatCard, ToneBadge } from "@/components/ui";
import { severityTone, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [devices, openEventRows, openInsights] = await Promise.all([
    prisma.device.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        metrics: { orderBy: { ts: "desc" }, take: 1 },
        health: { orderBy: { ts: "desc" }, take: 1 },
      },
    }),
    prisma.event.groupBy({ by: ["deviceId"], where: { resolvedAt: null }, _count: { _all: true } }),
    prisma.insight.findMany({
      where: { status: "OPEN" },
      orderBy: { ts: "desc" },
      take: 3,
      include: { device: { select: { id: true, name: true } } },
    }),
  ]);

  const openMap = new Map(openEventRows.map((row) => [row.deviceId, row._count._all]));
  const totalOpenEvents = openEventRows.reduce((sum, row) => sum + row._count._all, 0);
  const onlineCount = devices.filter((device) => device.status === "ONLINE").length;
  const scored = devices
    .map((device) => device.health[0]?.score)
    .filter((score): score is number => typeof score === "number");
  const avgHealth =
    scored.length > 0 ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : null;

  const cards: DeviceCardData[] = devices.map((device) => {
    const metric = device.metrics[0];
    return {
      id: device.id,
      name: device.name,
      hostname: device.hostname,
      osName: device.osName,
      cpuModel: device.cpuModel,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      healthScore: device.health[0]?.score ?? null,
      openEvents: openMap.get(device.id) ?? 0,
      latestMetric: metric
        ? {
            cpuPct: metric.cpuPct,
            memPct: metric.memPct,
            diskPct: metric.diskPct,
            diskFreeGb: metric.diskFreeGb,
            batteryPct: metric.batteryPct,
            batteryWear: metric.batteryWear,
            tempCpu: metric.tempCpu,
            ts: metric.ts,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Tổng quan</p>
          <h1 className="h1 mt-1">Thiết bị của bạn</h1>
          <p className="muted mt-1">Agent gửi telemetry mỗi 60 giây · cảnh báo tính tự động mỗi lần nhận dữ liệu.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <AnalyzeButton />
          <AddDevice />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Thiết bị" value={devices.length} hint="đã đăng ký trong hệ thống" />
        <StatCard
          label="Đang online"
          value={`${onlineCount}/${devices.length}`}
          tone={onlineCount > 0 ? "good" : "muted"}
          hint="có telemetry trong 5 phút gần nhất"
        />
        <StatCard
          label="Cảnh báo mở"
          value={totalOpenEvents}
          tone={totalOpenEvents > 0 ? "warn" : "good"}
          hint="tự đóng sau 24 giờ"
        />
        <StatCard
          label="Sức khỏe TB"
          value={avgHealth ?? "—"}
          tone={avgHealth === null ? "muted" : avgHealth >= 80 ? "good" : avgHealth >= 55 ? "warn" : "bad"}
          hint="thang điểm 0–100"
        />
      </div>

      {devices.length === 0 ? (
        <EmptyState
          title="Chưa có thiết bị nào"
          description="Bấm “Thêm thiết bị” để tạo token, rồi tải bộ cài (.cmd) và chạy bằng Run as administrator trên laptop. Agent sẽ tự gửi dữ liệu mỗi 60 giây."
        >
          <AddDevice />
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <DeviceCard key={card.id} device={card} />
          ))}
        </div>
      )}

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="h2">AI đề xuất mới nhất</h2>
            <p className="muted mt-1">Sinh bởi rules engine + DeepSeek, chỉ dựa trên số liệu tổng hợp.</p>
          </div>
          <Link href="/insights" className="btn-ghost">
            Xem tất cả
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {openInsights.length === 0 ? (
            <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
              Chưa có đề xuất nào. Bấm “Phân tích bằng AI” hoặc chờ cron chạy.
            </p>
          ) : (
            openInsights.map((insight) => (
              <Link
                key={insight.id}
                href={`/devices/${insight.device.id}`}
                className="block rounded-lg border border-white/5 bg-white/[0.02] p-4 transition hover:border-cyan-400/25"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={severityTone(insight.severity)}>{insight.severity}</ToneBadge>
                  <span className="text-sm font-medium text-slate-200">{insight.device.name}</span>
                  <span className="text-[11px] text-slate-500">{timeAgo(insight.ts)}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{insight.summary}</p>
              </Link>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
