"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Pencil, Plug, PowerOff, Trash2, X } from "lucide-react";
import { buildInstallerCmd, installerFileName } from "@/lib/agent-installer";
import { cn } from "@/lib/utils";

type DeviceStatus = "ONLINE" | "OFFLINE" | "DISABLED";
type Mode = "rename" | "reconnect" | "revoke" | "delete" | null;

/** Lỗi API trả về mã tiếng Anh → thông báo tiếng Việt cho người dùng. */
function toMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "unauthenticated") return "Phiên đăng nhập đã hết hạn — đăng nhập lại rồi thử lại.";
  if (code === "not_found") return "Thiết bị không còn tồn tại (có thể đã bị xoá ở tab khác).";
  if (code === "invalid_payload") return "Dữ liệu không hợp lệ — kiểm tra lại tên thiết bị.";
  return code || "Lỗi không xác định";
}

export function DeviceManage({
  deviceId,
  name,
  status,
  variant = "card",
  redirectOnDelete = false,
}: {
  deviceId: string;
  name: string;
  status: DeviceStatus;
  variant?: "card" | "page";
  redirectOnDelete?: boolean;
}) {
  const router = useRouter();
  const compact = variant === "card";
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState<Mode>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(name);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  const revoked = status === "DISABLED";

  function close() {
    setMode(null);
    setBusy(null);
    setError(null);
    setCopied(false);
    setToken(null);
  }

  function open(next: Exclude<Mode, null>) {
    setMode(next);
    setError(null);
    setCopied(false);
    if (next === "rename") setDraftName(name);
    if (next === "reconnect") setToken(null);
  }

  async function call(path: string, init?: RequestInit) {
    const response = await fetch(path, init);
    const data = (await response.json().catch(() => ({}))) as { error?: string; token?: string };
    if (!response.ok) throw new Error(data.error ?? "");
    return data;
  }

  async function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draftName.trim();
    if (next.length < 2) {
      setError("Tên thiết bị tối thiểu 2 ký tự.");
      return;
    }
    setBusy("rename");
    setError(null);
    try {
      await call(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      close();
      router.refresh();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reconnect() {
    setBusy("reconnect");
    setError(null);
    try {
      const data = await call(`/api/devices/${deviceId}/reconnect`, { method: "POST" });
      setToken(data.token ?? null);
      router.refresh();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    setError(null);
    try {
      await call(`/api/devices/${deviceId}`, { method: "DELETE" });
      close();
      router.refresh();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    setBusy("delete");
    setError(null);
    try {
      await call(`/api/devices/${deviceId}?purge=true`, { method: "DELETE" });
      close();
      if (redirectOnDelete) router.push("/dashboard");
      else router.refresh();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function downloadInstaller() {
    if (!token) return;
    try {
      const cmd = buildInstallerCmd(origin || window.location.origin, token);
      const blob = new Blob([cmd], { type: "application/octet-stream" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = installerFileName(name);
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

  const btn = compact ? "btn-ghost px-2 py-1 text-[11px]" : "btn-ghost";
  const icon = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} onClick={() => open("rename")} title="Đổi tên hiển thị">
          <Pencil className={icon} aria-hidden />
          Sửa tên
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => open("reconnect")}
          title="Cấp token mới và tải lại bộ cài"
        >
          <Plug className={icon} aria-hidden />
          Kết nối lại
        </button>
        {revoked ? null : (
          <button
            type="button"
            className={btn}
            onClick={() => open("revoke")}
            title="Ngắt kết nối nhưng giữ lịch sử"
          >
            <PowerOff className={icon} aria-hidden />
            Thu hồi
          </button>
        )}
        <button
          type="button"
          className={cn(btn, "text-rose-300 hover:text-rose-200")}
          onClick={() => open("delete")}
          title="Xoá vĩnh viễn khỏi hệ thống"
        >
          <Trash2 className={icon} aria-hidden />
          Xoá
        </button>
      </div>

      {mode === "rename" ? (
        <form onSubmit={submitRename} className="mt-3 rounded-lg border border-white/10 bg-ink-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-300">Đổi tên thiết bị</p>
            <button type="button" className="btn-ghost px-1.5 py-0.5" onClick={close} aria-label="Đóng">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <input
            className="input mt-2"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            aria-label="Tên thiết bị"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary px-3 py-1 text-xs" disabled={busy !== null}>
              {busy === "rename" ? "Đang lưu…" : "Lưu tên"}
            </button>
            <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={close}>
              Huỷ
            </button>
          </div>
        </form>
      ) : null}

      {mode === "reconnect" ? (
        <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-200">Kết nối lại thiết bị</p>
            <button type="button" className="btn-ghost px-1.5 py-0.5" onClick={close} aria-label="Đóng">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          {token ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Đã cấp token mới cho <span className="text-slate-200">{name}</span>. Token chỉ hiển thị 1 lần — tải
                bộ cài rồi chạy <span className="mono">Run as administrator</span> trên máy đó.
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                <code className="mono min-w-[200px] flex-1 overflow-x-auto rounded-lg border border-white/10 bg-ink-950 px-2.5 py-2 text-[12px] text-cyan-200">
                  {token}
                </code>
                <button type="button" className="btn-ghost px-2 py-1 text-[11px]" onClick={copyToken}>
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {copied ? "Đã copy" : "Copy"}
                </button>
                <button type="button" className="btn-primary px-2 py-1 text-[11px]" onClick={downloadInstaller}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Tải bộ cài
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-300">
                Agent đang chạy bằng token cũ sẽ bị từ chối (401) ngay sau bước này — phải cài lại bằng bộ cài mới.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Cấp token mới cho <span className="text-slate-200">{name}</span> và tải bộ cài. Dùng khi cài lại
                Windows, chuyển agent sang máy khác, thiết bị đang bị thu hồi, hoặc nghi token cũ bị lộ.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary px-3 py-1 text-xs"
                  disabled={busy !== null}
                  onClick={reconnect}
                >
                  {busy === "reconnect" ? "Đang cấp token…" : "Cấp token mới"}
                </button>
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={close}>
                  Huỷ
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {mode === "revoke" ? (
        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-200">Thu hồi {name}?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Agent trên máy sẽ bị từ chối (403) ở lần gửi kế tiếp. Lịch sử metric/cảnh báo vẫn được giữ. Muốn dùng
            lại thì bấm Kết nối lại để cấp token mới.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-danger px-3 py-1 text-xs" disabled={busy !== null} onClick={revoke}>
              {busy === "revoke" ? "Đang thu hồi…" : "Thu hồi thiết bị"}
            </button>
            <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={close}>
              Huỷ
            </button>
          </div>
        </div>
      ) : null}

      {mode === "delete" ? (
        <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/5 p-3">
          <p className="text-xs font-medium text-rose-200">Xoá vĩnh viễn {name}?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Xoá thiết bị cùng toàn bộ metric, cảnh báo, đề xuất và lệnh đã ghi. Không khôi phục được. Agent trên
            máy (nếu còn) sẽ nhận 401 ở lần gửi kế tiếp.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-danger px-3 py-1 text-xs" disabled={busy !== null} onClick={purge}>
              {busy === "delete" ? "Đang xoá…" : "Xoá vĩnh viễn"}
            </button>
            <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={close}>
              Huỷ
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
