import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MetricsChart, type ChartPoint } from "@/components/metrics-chart";
import { DeviceActions } from "@/components/device-actions";
import { DeviceManage } from "@/components/device-manage";
import { HealthGauge, Meter, Panel, StatusDot, ToneBadge } from "@/components/ui";
import { computeHealth, healthLabel } from "@/lib/health";
import { formatDateTime, formatDuration, formatGb, formatPct, severityTone, timeAgo, usageTone } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Proc = { name: string; cpu: number; memMb: number };

function parseProcesses(value: Prisma.JsonValue | null): Proc[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Prisma.JsonObject =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "?",
      cpu: typeof item.cpu === "number" ? item.cpu : 0,
      memMb: typeof item.memMb === "number" ? item.memMb : 0,
    }))
    .slice(0, 5);
}

const round = (value: number) => Math.round(value * 10) / 10;

const COMMAND_LABEL: Record<string, string> = {
  clean_temp: "Dọn file tạm",
  flush_dns: "Flush DNS",
  battery_report: "Báo cáo pin",
  trim: "TRIM ổ SSD",
  sfc_scan: "Quét SFC",
};

function commandTone(status: string): "good" | "warn" | "bad" | "muted" {
  if (status === "DONE") return "good";
  if (status === "FAILED") return "bad";
  if (status === "SENT") return "warn";
  return "muted";
}

type Rec = { title: string; why?: string; impact?: string; risk?: string; actionType?: string };

function parseRecs(value: Prisma.JsonValue): Rec[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Prisma.JsonObject =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "(không có tiêu đề)",
      why: typeof item.why === "string" ? item.why : undefined,
      impact: typeof item.impact === "string" ? item.impact : undefined,
      risk: typeof item.risk === "string" ? item.risk : undefined,
      actionType: typeof item.actionType === "string" ? item.actionType : undefined,
    }));
}

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const device = await prisma.device.findFirst({
    where: { id },
    include: {
      metrics: { orderBy: { ts: "desc" }, take: 60 },
      health: { orderBy: { ts: "desc" }, take: 1 },
      events: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
      insights: { orderBy: { ts: "desc" }, take: 1 },
      commands: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  if (!device) notFound();

  const latest = device.metrics[0] ?? null;
  const chartData: ChartPoint[] = [...device.metrics].reverse().map((metric) => ({
    t: new Date(metric.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    cpu: round(metric.cpuPct),
    mem: round(metric.memPct),
    disk: round(metric.diskPct),
  }));

  const liveHealth = latest
    ? computeHealth({
        cpuPct: latest.cpuPct,
        memPct: latest.memPct,
        diskPct: latest.diskPct,
        diskFreeGb: latest.diskFreeGb,
        tempCpu: latest.tempCpu,
        batteryWear: latest.batteryWear,
      })
    : null;

  const healthScore = liveHealth?.score ?? device.health[0]?.score ?? null;
  const processes = latest ? parseProcesses(latest.topProcesses) : [];
  const insight = device.insights[0] ?? null;
  const online = device.status === "ONLINE";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Về tổng quan
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="h1">{device.name}</h1>
            <p className="muted mt-1">
              {device.hostname ?? "chưa rõ hostname"} · {device.osName ?? "chưa rõ OS"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusDot online={online} />
              <span className="text-[11px] text-slate-500">cập nhật {timeAgo(device.lastSeenAt)}</span>
              <ToneBadge tone="muted">token {device.tokenPrefix}</ToneBadge>
              {latest ? <ToneBadge tone="muted">uptime {formatDuration(latest.uptimeSec)}</ToneBadge> : null}
            </div>
          </div>
          <HealthGauge score={healthScore} />
        </div>
      </div>

      <DeviceManage
        deviceId={device.id}
        name={device.name}
        status={device.status}
        variant="page"
        redirectOnDelete
      />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="h2">Diễn biến tài nguyên</h2>
            <p className="muted mt-0.5">{device.metrics.length} mẫu gần nhất (mỗi mẫu ~60 giây)</p>
          </div>
        </div>
        <div className="mt-3">
          <MetricsChart data={chartData} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <h2 className="h2">Chi tiết điểm sức khỏe</h2>
          <div className="mt-3 space-y-3">
            {liveHealth ? (
              liveHealth.parts.map((part) => (
                <Meter
                  key={part.key}
                  label={part.label}
                  value={part.score}
                  tone={part.score >= 80 ? "good" : part.score >= 55 ? "warn" : "bad"}
                  detail={part.note}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">Chưa có telemetry để chấm điểm.</p>
            )}
          </div>
          {healthScore !== null ? (
            <p className="mt-3 border-t border-white/5 pt-3 text-[11px] text-slate-500">
              Xếp loại: {healthLabel(healthScore)}
            </p>
          ) : null}
        </Panel>

        <Panel className="lg:col-span-2">
          <h2 className="h2">Tiến trình ngốn tài nguyên</h2>
          <p className="muted mt-0.5">Top 5 tại thời điểm lấy mẫu gần nhất</p>
          {processes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Agent chưa gửi danh sách tiến trình.</p>
          ) : (
            <table className="table-base mt-3">
              <thead>
                <tr>
                  <th>Tên tiến trình</th>
                  <th className="text-right">CPU %</th>
                  <th className="text-right">RAM (MB)</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((proc, index) => (
                  <tr key={`${proc.name}-${index}`}>
                    <td className="mono truncate text-slate-200">{proc.name}</td>
                    <td className="text-right">{proc.cpu.toFixed(1)}</td>
                    <td className="text-right">{proc.memMb.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {latest ? (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-4 sm:grid-cols-4">
              <div>
                <p className="eyebrow">Nhiệt độ</p>
                <p className="mono mt-1 text-slate-200">
                  {latest.tempCpu ? `${latest.tempCpu.toFixed(0)}°C` : "N/A"}
                </p>
              </div>
              <div>
                <p className="eyebrow">Pin</p>
                <p className="mono mt-1 text-slate-200">{formatPct(latest.batteryPct)}</p>
              </div>
              <div>
                <p className="eyebrow">Chai pin</p>
                <p className="mono mt-1 text-slate-200">
                  {latest.batteryWear !== null ? formatPct(latest.batteryWear) : "N/A"}
                </p>
              </div>
              <div>
                <p className="eyebrow">Trống ổ C:</p>
                <p className="mono mt-1 text-slate-200">{formatGb(latest.diskFreeGb)}</p>
              </div>
            </div>
          ) : null}

          {latest ? (
            <div className="mt-4">
              <Meter label="Ổ hệ thống đã dùng" value={latest.diskPct} tone={usageTone(latest.diskPct)} />
            </div>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="h2">Cảnh báo đang mở ({device.events.length})</h2>
          <div className="mt-3 space-y-2">
            {device.events.length === 0 ? (
              <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
                Không có cảnh báo nào.
              </p>
            ) : (
              device.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={severityTone(event.severity)}>{event.severity}</ToneBadge>
                    <span className="mono text-[11px] text-slate-500">{event.code}</span>
                    <span className="text-[11px] text-slate-500">· {timeAgo(event.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{event.message}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="h2">Đề xuất AI gần nhất</h2>
          {insight ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <ToneBadge tone={severityTone(insight.severity)}>{insight.severity}</ToneBadge>
                <span className="text-[11px] text-slate-500">{formatDateTime(insight.ts)}</span>
                <span className="mono text-[10px] uppercase tracking-wide text-slate-600">{insight.model}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{insight.summary}</p>
              <ol className="mt-3 space-y-2">
                {parseRecs(insight.recommendations).map((item, index) => (
                  <li key={`${insight.id}-${index}`} className="rounded-md border border-white/5 bg-ink-950/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/15 text-[11px] font-semibold text-cyan-300">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-200">{item.title}</span>
                      {item.actionType ? (
                        <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {item.actionType}
                        </span>
                      ) : null}
                    </div>
                    {item.why ? <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{item.why}</p> : null}
                    {item.impact ? <p className="mt-1 text-[11px] text-slate-500">Tác động: {item.impact}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
              Chưa có đề xuất. Bấm “Phân tích bằng AI” ở trang tổng quan.
            </p>
          )}
        </Panel>
      </div>

      <Panel>
        <div>
          <h2 className="h2">Bảo trì từ xa</h2>
          <p className="muted mt-0.5">
            Lệnh được xếp hàng và chỉ chạy khi agent poll. Agent chỉ thực thi các loại trong allowlist, không nhận shell tự do.
          </p>
        </div>
        <div className="mt-3">
          <DeviceActions deviceId={device.id} disabled={!online} />
        </div>

        {device.commands.length > 0 ? (
          <table className="table-base mt-4">
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Trạng thái</th>
                <th>Tạo lúc</th>
                <th>Hoàn tất</th>
              </tr>
            </thead>
            <tbody>
              {device.commands.map((command) => (
                <tr key={command.id}>
                  <td className="text-slate-200">{COMMAND_LABEL[command.type] ?? command.type}</td>
                  <td>
                    <ToneBadge tone={commandTone(command.status)}>{command.status}</ToneBadge>
                  </td>
                  <td className="text-[12px] text-slate-500">{formatDateTime(command.createdAt)}</td>
                  <td className="text-[12px] text-slate-500">
                    {command.completedAt ? formatDateTime(command.completedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-[11px] text-slate-500">Chưa có lệnh nào được gửi tới thiết bị này.</p>
        )}
      </Panel>
    </div>
  );
}
