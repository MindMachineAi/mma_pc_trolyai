"""Thực thi lệnh bảo trì — CHỈ các action trong ALLOWLIST.

Nguyên tắc: không nhận shell tự do, không nhận đường dẫn tuỳ ý từ server.
Server chỉ gửi `type` + `params` đã được validate bằng Zod ở phía Next.js.
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Dict

from collector import CREATE_NO_WINDOW, DETACHED_PROCESS, run_hidden

log = logging.getLogger(__name__)

REPORT_DIR = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "PCtroLyAI" / "reports"


class CommandNotAllowed(RuntimeError):
    """Lệnh không nằm trong allowlist."""


def clean_temp(params: dict[str, Any]) -> dict[str, Any]:
    """Xoá file tạm cũ hơn N ngày. Mặc định chỉ quét (dry run) trừ khi confirm=true."""
    older_days = int(params.get("olderThanDays", 7) or 7)
    confirm = bool(params.get("confirm", False))
    cutoff = time.time() - older_days * 86400

    targets = [
        Path(os.environ.get("TEMP") or tempfile.gettempdir()),
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Temp",
    ]

    scanned = 0
    matched = 0
    freed_bytes = 0
    skipped = 0

    for target in targets:
        if not target.exists():
            continue
        for path in target.rglob("*"):
            try:
                if not path.is_file():
                    continue
                stat = path.stat()
            except OSError:
                continue
            scanned += 1
            if stat.st_mtime > cutoff:
                continue
            matched += 1
            freed_bytes += stat.st_size
            if confirm:
                try:
                    path.unlink()
                except OSError:
                    skipped += 1

    return {
        "mode": "delete" if confirm else "dry_run",
        "olderThanDays": older_days,
        "filesScanned": scanned,
        "filesMatched": matched,
        "freedMb": round(freed_bytes / 1048576, 1),
        "skipped": skipped,
        "targets": [str(target) for target in targets],
    }


def flush_dns(_params: dict[str, Any]) -> dict[str, Any]:
    code, out, err = run_hidden(["ipconfig", "/flushdns"], timeout=30)
    return {"exitCode": code, "output": (out + err).strip()[:800]}


def battery_report(_params: dict[str, Any]) -> dict[str, Any]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    output = REPORT_DIR / "battery-report.html"
    code, out, err = run_hidden(
        ["powercfg", "/batteryreport", "/output", str(output)], timeout=60
    )
    return {
        "exitCode": code,
        "path": str(output),
        "exists": output.exists(),
        "output": (out + err).strip()[:600],
    }


def trim(_params: dict[str, Any]) -> dict[str, Any]:
    script = "Optimize-Volume -DriveLetter C -ReTrim -Verbose 4>&1 | Out-String"
    code, out, err = run_hidden(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout=180
    )
    return {"exitCode": code, "output": (out + err).strip()[:1500]}


def sfc_scan(_params: dict[str, Any]) -> dict[str, Any]:
    """Chạy nền để heartbeat không bị gián đoạn (sfc có thể mất 5–20 phút)."""
    try:
        subprocess.Popen(
            ["cmd", "/c", "start", "/min", "sfc", "/scannow"],
            creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
            close_fds=True,
        )
    except OSError as exc:
        return {"started": False, "error": str(exc)}
    return {
        "started": True,
        "note": "sfc /scannow chạy nền. Xem C:\\Windows\\Logs\\CBS\\CBS.log để đọc kết quả.",
    }


ALLOWLIST: Dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "clean_temp": clean_temp,
    "flush_dns": flush_dns,
    "battery_report": battery_report,
    "trim": trim,
    "sfc_scan": sfc_scan,
}


def execute(command: dict[str, Any]) -> dict[str, Any]:
    command_type = str(command.get("type") or "")
    handler = ALLOWLIST.get(command_type)
    if handler is None:
        raise CommandNotAllowed(f"Lệnh không nằm trong allowlist: {command_type!r}")

    params = command.get("params")
    if not isinstance(params, dict):
        params = {}

    started = time.time()
    log.info("executing %s with params %s", command_type, params)
    result = handler(params)
    result["durationSec"] = round(time.time() - started, 2)
    return result
