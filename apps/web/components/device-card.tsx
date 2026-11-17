import Link from "next/link";
import { ArrowUpRight, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { HealthGauge, Meter, StatusDot, ToneBadge } from "@/components/ui";
import { formatGb, formatPct, timeAgo, usageTone } from "@/lib/utils";

export type DeviceCardData = {
  id: string;
  name: string;
  hostname: string | null;
  osName: string | null;
  cpuModel: string | null;
  status: "ONLINE" | "OFFLINE" | "DISABLED";
  lastSeenAt: Date | null;
  healthScore: number | null;
  openEvents: number;
  latestMetric: {
    cpuPct: number;
    memPct: number;
    diskPct: number;
    diskFreeGb: number;
    batteryPct: number | null;
    batteryWear: number | null;
    tempCpu: number | null;
    ts: Date;
  } | null;
};

export function DeviceCard({ device }: { device: DeviceCardData }) {
  const online = device.status === "ONLINE";
  const metric = device.latestMetric;

  return (
    <Link
      href={`/devices/${device.id}`}
      className="panel group flex flex-col gap-4 p-5 transition hover:border-cyan-400/25 hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">{device.name}</h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-300" />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {device.hostname ?? "chưa nhận hostname"} · {device.osName ?? "chưa rõ OS"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusDot online={online} />
            <span className="text-[11px] text-slate-500">{timeAgo(device.lastSeenAt)}</span>
            {device.openEvents > 0 ? (
              <ToneBadge tone="warn">{device.openEvents} cảnh báo</ToneBadge>
            ) : (
              <ToneBadge tone="good">không cảnh báo</ToneBadge>
            )}
          </div>
        </div>
        <HealthGauge score={device.healthScore} />
      </div>

      {metric ? (
        <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
          <Meter label="CPU" value={metric.cpuPct} tone={usageTone(metric.cpuPct)} />
          <Meter label="RAM" value={metric.memPct} tone={usageTone(metric.memPct)} />
          <Meter
            label="Ổ C:"
            value={metric.diskPct}
            tone={usageTone(metric.diskPct)}
            detail={`còn ${formatGb(metric.diskFreeGb)}`}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
          Chưa có telemetry. Cài agent trên máy này để bắt đầu giám sát.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          {device.cpuModel ? device.cpuModel.slice(0, 28) : "CPU: —"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MemoryStick className="h-3.5 w-3.5" aria-hidden />
          {metric ? `pin ${formatPct(metric.batteryPct)}` : "pin: —"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" aria-hidden />
          {metric?.tempCpu ? `${metric.tempCpu.toFixed(0)}°C` : "nhiệt độ: N/A"}
        </span>
      </div>
    </Link>
  );
}
