"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, X } from "lucide-react";

export function AddDevice({ appUrl }: { appUrl: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setOpen(false);
    setCreated(null);
    setName("");
    setError(null);
    setCopied(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        error?: string;
        token?: string;
        device?: { name: string };
      };
      if (!response.ok || !data.token) {
        throw new Error(data.error ?? "Không tạo được thiết bị");
      }
      setCreated({ token: data.token, name: data.device?.name ?? name });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Thêm thiết bị
      </button>
    );
  }

  return (
    <div className="panel w-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="h2">{created ? "Lưu token ngay" : "Thêm laptop mới"}</h2>
        <button type="button" className="btn-ghost px-2 py-1" onClick={reset} aria-label="Đóng">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {created ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            Token dưới đây <strong className="text-amber-300">chỉ hiển thị 1 lần</strong>. Dán vào file cấu hình
            agent trên laptop <span className="text-slate-200">{created.name}</span>.
          </p>
          <div className="flex items-stretch gap-2">
            <code className="mono flex-1 overflow-x-auto rounded-lg border border-white/10 bg-ink-950 px-3 py-2.5 text-cyan-200">
              {created.token}
            </code>
            <button type="button" className="btn-ghost" onClick={copyToken}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Đã copy" : "Copy"}
            </button>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="eyebrow mb-1.5">Lệnh cài trên laptop (PowerShell admin)</p>
            <pre className="mono overflow-x-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">
{`powershell -ExecutionPolicy Bypass -File .\\install.ps1 \`
  -ApiUrl "${appUrl || "https://your-app.vercel.app"}" \`
  -Token "${created.token}"`}
            </pre>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="device-name" className="mb-1.5 block text-xs font-medium text-slate-400">
              Tên thiết bị
            </label>
            <input
              id="device-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Dell Inspiron 15 - phòng làm việc"
              minLength={2}
              maxLength={60}
              required
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={loading || name.trim().length < 2}>
            {loading ? "Đang tạo…" : "Tạo thiết bị & lấy token"}
          </button>
        </form>
      )}
    </div>
  );
}
