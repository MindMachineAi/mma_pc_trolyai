"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

type AnalyzeResponse = {
  ok?: boolean;
  aiSkipped?: boolean;
  reason?: string;
  results?: Array<{ name: string; status: string; detail?: string }>;
  error?: string;
};

export function AnalyzeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/cron/analyze?limit=2", { method: "POST" });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) throw new Error(data.error ?? "Phân tích thất bại");

      if (data.aiSkipped) {
        setMessage(`Chưa cấu hình AI: ${data.reason ?? "thiếu DEEPSEEK_API_KEY"}`);
      } else {
        const analyzed = data.results?.filter((item) => item.status === "analyzed").length ?? 0;
        const errors = data.results?.filter((item) => item.status === "error") ?? [];
        if (analyzed > 0) {
          setMessage(`Đã phân tích ${analyzed} thiết bị — xem mục "Cảnh báo & AI".`);
        } else if (errors.length > 0) {
          setError(errors[0]?.detail ?? "AI trả lỗi");
        } else {
          setMessage("Chưa có dữ liệu mới cần phân tích.");
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn-ghost" onClick={run} disabled={loading}>
        <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
        {loading ? "AI đang phân tích…" : "Phân tích bằng AI"}
      </button>
      {message ? <p className="text-[11px] text-emerald-300">{message}</p> : null}
      {error ? <p className="max-w-xs text-right text-[11px] text-rose-300">{error}</p> : null}
    </div>
  );
}
