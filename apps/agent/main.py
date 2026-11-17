"""PC Trợ Lý AI — agent chính.

Vòng lặp: thu thập → POST /api/ingest → nhận lệnh → thực thi → POST /api/commands/result.

Chạy thử thủ công:
    python main.py --api-url https://xxx.vercel.app --token pca_... --once
"""

from __future__ import annotations

import logging
import logging.handlers
import sys
import time
from typing import Any

import requests

from client import AgentClient, ApiError
from collector import collect_metrics, collect_system
from config import AgentConfig, ConfigError, load_config, parse_args
from executor import CommandNotAllowed, execute

AGENT_VERSION = "0.1.0"
SYSTEM_INFO_EVERY_CYCLES = 30

log = logging.getLogger("agent")


def _force_utf8_stdio() -> None:
    """Ép stdout/stderr sang UTF-8.

    Khi agent chạy dưới Scheduled Task hoặc trong CI (stdout bị redirect), Python dùng
    codepage hệ thống (cp1252 trên runner Windows) → in tiếng Việt sẽ ném
    UnicodeEncodeError và tiến trình thoát với mã 1, kể cả `--help`.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        # Console thật trên Windows đã dùng wide-char API (PEP 528) — chỉ cần khi bị redirect.
        if getattr(stream, "isatty", lambda: True)():
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (OSError, ValueError):  # pragma: no cover - phụ thuộc môi trường
            pass


def setup_logging(config: AgentConfig) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    try:
        config.log_dir.mkdir(parents=True, exist_ok=True)
        handlers.append(
            logging.handlers.RotatingFileHandler(
                config.log_dir / "agent.log",
                maxBytes=2 * 1024 * 1024,
                backupCount=3,
                encoding="utf-8",
            )
        )
    except OSError as exc:  # pragma: no cover
        print(f"[warn] Không ghi được log file: {exc}")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
        force=True,
    )


def handle_command(client: AgentClient, command: dict[str, Any]) -> None:
    command_id = str(command.get("id") or "")
    if not command_id:
        return

    command_type = str(command.get("type") or "")
    try:
        result = execute(command)
    except CommandNotAllowed as exc:
        log.warning("từ chối lệnh %s: %s", command_type, exc)
        _safe_report(client, command_id, "FAILED", error=str(exc))
        return
    except Exception as exc:  # pragma: no cover - lỗi hệ thống
        log.exception("lỗi khi thực thi %s", command_type)
        _safe_report(client, command_id, "FAILED", error=str(exc))
        return

    _safe_report(client, command_id, "DONE", result=result)
    log.info("hoàn tất lệnh %s (%s)", command_type, command_id)


def _safe_report(
    client: AgentClient,
    command_id: str,
    status: str,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    try:
        client.report_result(command_id, status, result=result, error=error)
    except (ApiError, requests.RequestException) as exc:
        log.warning("không báo được kết quả %s: %s", command_id, exc)


def run_once(client: AgentClient, send_system: bool) -> None:
    payload: dict[str, Any] = {"agentVersion": AGENT_VERSION, "metrics": collect_metrics()}
    if send_system:
        payload["system"] = collect_system()

    response = client.send_metrics(payload)
    log.info(
        "ingest ok · health=%s · cảnh báo mới=%s",
        response.get("healthScore"),
        response.get("newEvents") or [],
    )

    commands = response.get("commands") or []
    for command in commands:
        if isinstance(command, dict):
            handle_command(client, command)


def main(argv: list[str] | None = None) -> int:
    _force_utf8_stdio()
    args = parse_args(argv)
    try:
        config = load_config(args)
    except ConfigError as exc:
        print(f"[config error] {exc}", file=sys.stderr)
        return 2

    setup_logging(config)
    log.info("PC Trợ Lý AI agent v%s → %s (chu kỳ %ss)", AGENT_VERSION, config.api_url, config.interval_sec)

    client = AgentClient(config.api_url, config.token)

    if args.once:
        try:
            run_once(client, send_system=True)
            return 0
        except (ApiError, requests.RequestException) as exc:
            log.error("lần gửi thử thất bại: %s", exc)
            return 1

    cycle = 0
    while True:
        started = time.time()
        try:
            run_once(client, send_system=(cycle % SYSTEM_INFO_EVERY_CYCLES == 0))
        except (ApiError, requests.RequestException) as exc:
            log.warning("kết nối thất bại: %s", exc)
        except Exception:  # pragma: no cover
            log.exception("lỗi không mong đợi trong chu kỳ")
        finally:
            cycle += 1

        elapsed = time.time() - started
        time.sleep(max(5.0, config.interval_sec - elapsed))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log.info("dừng bởi người dùng")
        raise SystemExit(0)
