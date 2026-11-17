"""HTTP client tới dashboard. Chỉ gửi device token — không gửi key hệ thống."""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests

log = logging.getLogger(__name__)


class ApiError(RuntimeError):
    """Dashboard trả lỗi 4xx/5xx."""


class AgentClient:
    def __init__(self, api_url: str, token: str, timeout: float = 25.0) -> None:
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "pc-troly-ai-agent/0.1.0",
            }
        )

    def send_metrics(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post("/api/ingest", payload)

    def poll_commands(self) -> list[dict[str, Any]]:
        response = self.session.get(f"{self.api_url}/api/commands", timeout=self.timeout)
        self._raise(response)
        data = response.json()
        commands = data.get("commands")
        return commands if isinstance(commands, list) else []

    def report_result(
        self,
        command_id: str,
        status: str,
        result: Optional[dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        payload: dict[str, Any] = {"commandId": command_id, "status": status}
        if result is not None:
            payload["result"] = result
        if error:
            payload["error"] = error[:1900]
        self._post("/api/commands/result", payload)

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.session.post(f"{self.api_url}{path}", json=payload, timeout=self.timeout)
        self._raise(response)
        data = response.json()
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _raise(response: requests.Response) -> None:
        if response.status_code < 400:
            return
        try:
            detail: Any = response.json()
        except ValueError:
            detail = response.text[:200]
        raise ApiError(f"HTTP {response.status_code}: {detail}")
