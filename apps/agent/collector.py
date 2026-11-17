"""Thu thập telemetry bằng psutil — CHỈ ĐỌC, không can thiệp hệ thống."""

from __future__ import annotations

import logging
import os
import platform
import socket
import subprocess
import time
from typing import Any, Optional

import psutil

log = logging.getLogger(__name__)

CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008
BATTERY_WEAR_TTL_SEC = 3600

_CACHE: dict[str, Any] = {}
_last_net: Optional[tuple[float, int, int]] = None


def run_hidden(args: list[str], timeout: float = 20.0) -> tuple[int, str, str]:
    """Chạy lệnh ẩn cửa sổ, không bao giờ raise."""
    try:
        completed = subprocess.run(
            args,
            capture_output=True,
            timeout=timeout,
            creationflags=CREATE_NO_WINDOW,
        )
        return (
            completed.returncode,
            completed.stdout.decode("utf-8", "replace"),
            completed.stderr.decode("utf-8", "replace"),
        )
    except Exception as exc:  # pragma: no cover - phụ thuộc máy
        return -1, "", str(exc)


def system_drive() -> str:
    return (os.environ.get("SystemDrive") or "C:") + "\\"


def _cpu_model() -> Optional[str]:
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
        ) as key:
            value, _ = winreg.QueryValueEx(key, "ProcessorNameString")
        text = str(value).strip()
        return text or None
    except Exception:
        return platform.processor() or None


def _gpu_model() -> Optional[str]:
    if "gpu" in _CACHE:
        return _CACHE["gpu"]
    name: Optional[str] = None
    script = (
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8;"
        "Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name"
    )
    code, out, _ = run_hidden(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout=12
    )
    if code == 0 and out.strip():
        name = out.strip().splitlines()[0].strip()[:150] or None
    _CACHE["gpu"] = name
    return name


def collect_system() -> dict[str, Any]:
    try:
        ram_gb: Optional[float] = round(psutil.virtual_memory().total / (1024**3), 1)
    except Exception:
        ram_gb = None
    cpu = _cpu_model()
    return {
        "hostname": socket.gethostname()[:128],
        "osName": f"{platform.system()} {platform.release()} {platform.version()}"[:160],
        "cpuModel": cpu[:160] if cpu else None,
        "gpuModel": _gpu_model(),
        "ramGb": ram_gb,
    }


def _battery() -> dict[str, Any]:
    try:
        battery = psutil.sensors_battery()
    except Exception:
        battery = None
    if battery is None:
        return {"percent": None, "plugged": None}
    return {"percent": round(float(battery.percent), 1), "plugged": bool(battery.power_plugged)}


def _battery_wear() -> Optional[float]:
    """Độ chai pin (%) = (1 - FullCharged/Designed) * 100. Cache 1 giờ, đọc qua CIM."""
    cached = _CACHE.get("battery_wear")
    if cached and time.time() - cached[0] < BATTERY_WEAR_TTL_SEC:
        return cached[1]

    script = (
        "$d=(Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData "
        "-ErrorAction SilentlyContinue).DesignedCapacity;"
        "$f=(Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity "
        "-ErrorAction SilentlyContinue).FullChargedCapacity;"
        "if($d -and $f -and $d -gt 0){[math]::Round((1-($f/$d))*100,1)}"
    )
    code, out, _ = run_hidden(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout=15
    )
    wear: Optional[float] = None
    text = out.strip().splitlines()[-1].strip() if out.strip() else ""
    if code == 0 and text:
        try:
            wear = max(0.0, min(100.0, float(text)))
        except ValueError:
            wear = None
    _CACHE["battery_wear"] = (time.time(), wear)
    return wear


def _cpu_temp() -> Optional[float]:
    """psutil không đọc được nhiệt độ trên Windows (cần driver/LibreHardwareMonitor)."""
    try:
        sensors = psutil.sensors_temperatures()
    except Exception:
        return None
    if not sensors:
        return None
    for entries in sensors.values():
        for entry in entries:
            current = getattr(entry, "current", None)
            if current:
                return round(float(current), 1)
    return None


def _net_rates() -> tuple[Optional[float], Optional[float]]:
    global _last_net
    try:
        counters = psutil.net_io_counters()
    except Exception:
        return None, None
    now = time.time()
    up_kbps: Optional[float] = None
    down_kbps: Optional[float] = None
    if _last_net is not None:
        prev_ts, prev_sent, prev_recv = _last_net
        elapsed = max(now - prev_ts, 0.5)
        up_kbps = round(max(counters.bytes_sent - prev_sent, 0) / elapsed / 1024, 1)
        down_kbps = round(max(counters.bytes_recv - prev_recv, 0) / elapsed / 1024, 1)
    _last_net = (now, counters.bytes_sent, counters.bytes_recv)
    return up_kbps, down_kbps


def _top_processes(limit: int = 5) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for proc in psutil.process_iter(["name", "cpu_percent", "memory_info"]):
        try:
            info = proc.info
            mem_info = info.get("memory_info")
            rows.append(
                {
                    "name": str(info.get("name") or "?")[:64],
                    "cpu": round(float(info.get("cpu_percent") or 0.0), 1),
                    "memMb": round((getattr(mem_info, "rss", 0) or 0) / 1048576, 1),
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    rows.sort(key=lambda row: (row["cpu"], row["memMb"]), reverse=True)
    return rows[:limit]


def collect_metrics() -> dict[str, Any]:
    cpu_pct = psutil.cpu_percent(interval=1.0)
    memory = psutil.virtual_memory()

    try:
        disk = psutil.disk_usage(system_drive())
        disk_pct = round(float(disk.percent), 1)
        disk_free_gb = round(disk.free / (1024**3), 1)
    except Exception:
        disk_pct, disk_free_gb = 0.0, 0.0

    battery = _battery()
    net_up, net_down = _net_rates()

    return {
        "cpuPct": round(float(cpu_pct), 1),
        "memPct": round(float(memory.percent), 1),
        "diskPct": disk_pct,
        "diskFreeGb": disk_free_gb,
        "tempCpu": _cpu_temp(),
        "batteryPct": battery["percent"],
        "batteryWear": _battery_wear(),
        "netUpKbps": net_up,
        "netDownKbps": net_down,
        "uptimeSec": int(max(time.time() - psutil.boot_time(), 0)),
        "procCount": len(psutil.pids()),
        "topProcesses": _top_processes(),
    }

