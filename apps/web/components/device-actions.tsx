"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BatteryCharging, Eraser, Globe, ShieldCheck, Zap } from "lucide-react";

const ACTIONS = [
  {
    type: "clean_temp",
    label: "Dọn file tạm",
    icon: Eraser,
    params: { confirm: true, olderThanDays: 7 },
    hint: "Chỉ xoá file tạm cũ hơn 7 ngày",
  },
  { type: "flush_dns", label: "Flush DNS", icon: Globe, params: {}, hint: "Sửa lỗi mạng chập chờn" },
  { type: "battery_report", label: "Báo cáo pin", icon: BatteryCharging, params: {}, hint: "Xuất HTML powercfg" },
  { type: "trim", label: "TRIM ổ SSD", icon: Zap, params: {}, hint: "Tối ưu SSD (chỉ SSD)" },
  { type: "sfc_scan", label: "Quét SFC", icon: ShieldCheck, params: {}, hint: "5–20 phút, chạy nền" },
] as const;

export function DeviceActions({ deviceId, disabled }: { deviceId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(type: string, params: Record<string, unknown>) {
    setPending(type);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, type, params }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không gửi được lệnh");
      setMessage("Đã xếp hàng lệnh — agent sẽ nhận trong ≤60 giây.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              type="button"
              className="btn-ghost"
              title={action.hint}
              disabled={disabled || pending !== null}
              onClick={() => send(action.type, { ...action.params })}
            >
              <Icon className="h-4 w-4 text-cyan-300" aria-hidden />
              {pending === action.type ? "Đang gửi…" : action.label}
            </button>
          );
        })}
      </div>
      {message ? <p className="mt-2 text-[11px] text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
      {disabled ? (
        <p className="mt-2 text-[11px] text-amber-300">Thiết bị đang offline — lệnh sẽ chờ đến khi máy online.</p>
      ) : null}
    </div>
  );
}
