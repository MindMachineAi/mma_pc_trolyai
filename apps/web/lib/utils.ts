export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatGb(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} GB`;
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "chưa từng";
  const value = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec} giây trước`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return `${Math.floor(diffSec / 86400)} ngày trước`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Màu theo ngưỡng sử dụng: thấp = tốt, cao = xấu. */
export function usageTone(pct: number): "good" | "warn" | "bad" {
  if (pct >= 90) return "bad";
  if (pct >= 75) return "warn";
  return "good";
}

export function healthTone(score: number | null | undefined): "good" | "warn" | "bad" | "muted" {
  if (score === null || score === undefined) return "muted";
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

export function severityTone(severity: string): "good" | "warn" | "bad" | "muted" {
  switch (severity) {
    case "CRITICAL":
      return "bad";
    case "WARN":
      return "warn";
    case "INFO":
      return "muted";
    default:
      return "muted";
  }
}
