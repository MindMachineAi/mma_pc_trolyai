import { cn } from "@/lib/utils";
import { healthLabel } from "@/lib/health";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("panel panel-pad", className)}>{children}</section>;
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600",
        )}
      />
      <span className={online ? "text-emerald-300" : "text-slate-400"}>
        {online ? "Đang online" : "Offline"}
      </span>
    </span>
  );
}

export function ToneBadge({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good" ? "badge-good" : tone === "warn" ? "badge-warn" : tone === "bad" ? "badge-bad" : "badge-muted";
  return <span className={cls}>{children}</span>;
}

const barColor: Record<"good" | "warn" | "bad", string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-rose-400",
};

export function Meter({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad";
  detail?: string;
}) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="mono text-slate-300">{value.toFixed(0)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn("h-full rounded-full transition-all", barColor[tone])} style={{ width: `${width}%` }} />
      </div>
      {detail ? <p className="mt-1 text-[11px] text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function HealthGauge({ score }: { score: number | null | undefined }) {
  const value = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const color = value >= 80 ? "#34d399" : value >= 55 ? "#fbbf24" : "#fb7185";
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${value * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
        }}
      >
        <div className="absolute inset-[5px] grid place-items-center rounded-full bg-ink-900">
          <span className="text-lg font-semibold text-white">
            {typeof score === "number" ? score : "—"}
          </span>
        </div>
      </div>
      <div>
        <p className="eyebrow">Sức khỏe</p>
        <p className="text-sm font-medium text-slate-200">
          {typeof score === "number" ? healthLabel(score) : "Chưa có dữ liệu"}
        </p>
        <p className="text-[11px] text-slate-500">thang điểm 0–100</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel panel-pad flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-base font-medium text-slate-200">{title}</p>
      <p className="max-w-md text-sm text-slate-400">{description}</p>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "muted";
}) {
  const accent =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-rose-300"
          : "text-white";
  return (
    <div className="panel px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", accent)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
