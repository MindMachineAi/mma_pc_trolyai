"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Plus, X } from "lucide-react";
import { buildInstallerCmd, installerFileName } from "@/lib/agent-installer";

export function AddDevice() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  function downloadInstaller() {
    if (!created) return;
    try {
      const cmd = buildInstallerCmd(window.location.origin, created.token);
      const blob = new Blob([cmd], { type: "application/octet-stream" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = installerFileName(created.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Thu hồi URL sau khi trình duyệt kịp bắt đầu tải (Safari/Firefox cũ cần delay).
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được bộ cài");
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
            Token dưới đây <strong className="text-amber-300">chỉ hiển thị 1 lần</strong>. Tải bộ cài cho laptop{" "}
            <span className="text-slate-200">{created.name}</span> hoặc copy token để cài thủ công.
          </p>
          <div className="flex flex-wrap items-stretch gap-2">
            <code className="mono min-w-[220px] flex-1 overflow-x-auto rounded-lg border border-white/10 bg-ink-950 px-3 py-2.5 text-cyan-200">
              {created.token}
            </code>
            <button type="button" className="btn-ghost" onClick={copyToken}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Đã copy" : "Copy"}
            </button>
            <button type="button" className="btn-primary" onClick={downloadInstaller}>
              <Download className="h-4 w-4" aria-hidden />
              Tải bộ cài
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Copy file sang laptop mới → chuột phải → Run as administrator. Trình duyệt/Windows có thể cảnh báo file
            .cmd, chọn Giữ lại / More info → Run anyway. File chứa token: xoá sau khi cài (script tự xoá khi cài
            thành công).
          </p>
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="eyebrow mb-1.5">Hoặc cài thủ công trên laptop (PowerShell admin)</p>
            {origin ? (
              <pre className="mono overflow-x-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">
{`powershell -ExecutionPolicy Bypass -File .\\install.ps1 \`
  -ApiUrl "${origin}" \`
  -Token "${created.token}"`}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">Đang xác định địa chỉ dashboard…</p>
            )}
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
