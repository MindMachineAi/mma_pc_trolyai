"""Nạp cấu hình agent.

Thứ tự ưu tiên: tham số dòng lệnh > biến môi trường > file JSON.
File mặc định: %ProgramData%\\PCtroLyAI\\agent-config.json (do install.ps1 tạo).
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CONFIG_DIR = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "PCtroLyAI"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "agent-config.json"
DEFAULT_LOG_DIR = DEFAULT_CONFIG_DIR / "logs"
MIN_INTERVAL_SEC = 15


class ConfigError(RuntimeError):
    """Cấu hình thiếu hoặc không đọc được."""


@dataclass
class AgentConfig:
    api_url: str
    token: str
    interval_sec: int = 60
    log_dir: Path = field(default_factory=lambda: DEFAULT_LOG_DIR)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PC Trợ Lý AI — agent giám sát laptop")
    parser.add_argument("--api-url", help="URL dashboard, ví dụ https://pc-troly-ai.vercel.app")
    parser.add_argument("--token", help="Device token (pca_...) lấy khi thêm thiết bị")
    parser.add_argument("--interval", type=int, help="Chu kỳ gửi dữ liệu (giây), tối thiểu 15")
    parser.add_argument("--config", help="Đường dẫn file cấu hình JSON khác mặc định")
    parser.add_argument("--once", action="store_true", help="Gửi 1 lần rồi thoát (dùng để kiểm tra)")
    return parser.parse_args(argv)


def load_config(args: argparse.Namespace) -> AgentConfig:
    file_data: dict[str, object] = {}
    config_path = Path(args.config) if args.config else DEFAULT_CONFIG_FILE

    if config_path.exists():
        try:
            # utf-8-sig: install.ps1 ghi file bằng Out-File -Encoding utf8 (có BOM trên PS 5.1)
            raw = json.loads(config_path.read_text(encoding="utf-8-sig"))
            if isinstance(raw, dict):
                file_data = raw
        except (OSError, ValueError) as exc:
            raise ConfigError(f"Không đọc được cấu hình {config_path}: {exc}") from exc

    api_url = (
        args.api_url
        or os.environ.get("PCA_API_URL")
        or str(file_data.get("apiUrl") or "")
    ).strip()
    token = (
        args.token
        or os.environ.get("PCA_TOKEN")
        or str(file_data.get("token") or "")
    ).strip()

    raw_interval = args.interval or os.environ.get("PCA_INTERVAL") or file_data.get("intervalSec") or 60
    try:
        interval = int(raw_interval)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        interval = 60

    if not api_url:
        raise ConfigError("Thiếu apiUrl (--api-url, PCA_API_URL hoặc apiUrl trong file cấu hình).")
    if not token:
        raise ConfigError("Thiếu token (--token, PCA_TOKEN hoặc token trong file cấu hình).")
    if not api_url.startswith(("http://", "https://")):
        raise ConfigError("apiUrl phải bắt đầu bằng http:// hoặc https://")

    log_dir = Path(str(file_data.get("logDir") or DEFAULT_LOG_DIR))

    return AgentConfig(
        api_url=api_url.rstrip("/"),
        token=token,
        interval_sec=max(MIN_INTERVAL_SEC, interval),
        log_dir=log_dir,
    )
