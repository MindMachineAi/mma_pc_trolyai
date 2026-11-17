# API Reference

Base URL: `https://<your-app>.vercel.app`

Ba nhóm xác thực:

| Nhóm | Cách gửi | Dùng cho |
| --- | --- | --- |
| Device | `Authorization: Bearer pca_…` | Agent trên laptop |
| Admin | Cookie session `pca_session` | Dashboard (tự động) |
| Cron | `Authorization: Bearer $CRON_SECRET` | Vercel Cron / GitHub Actions |

---

## GET /api/health

Không cần xác thực. Trả trạng thái cấu hình (không lộ giá trị secret).

```json
{
  "ok": true,
  "version": "0.1.0",
  "database": "connected",
  "authConfigured": true,
  "aiConfigured": true,
  "cronConfigured": true,
  "aiProvider": "deepseek-flash"
}
```

Dùng để kiểm tra nhanh sau khi deploy: mở `https://app/api/health`. `ok: false` kèm
`databaseError` nghĩa là `DATABASE_URL` sai hoặc Neon đang sleep.

---

## POST /api/devices

Tạo thiết bị, trả token **một lần duy nhất**.

Uỷ quyền: admin session, hoặc header `x-registration-secret: $DEVICE_REGISTRATION_SECRET`.

```json
{ "name": "Dell Inspiron 15", "ownerLabel": "me" }
```

Phản hồi `201`:

```json
{
  "device": { "id": "clx…", "name": "Dell Inspiron 15", "createdAt": "2026-01-01T00:00:00.000Z" },
  "token": "pca_9f2c…",
  "tokenPrefix": "pca_9f2c1234…",
  "note": "Token chỉ hiển thị 1 lần. Hãy lưu vào agent-config.json trên laptop."
}
```

## GET /api/devices

Admin. Danh sách thiết bị + metric mới nhất + điểm sức khỏe + số cảnh báo mở.

## DELETE /api/devices/{id}

Admin. Thu hồi thiết bị: `status = DISABLED`, hủy mọi lệnh đang chờ. Lịch sử được giữ lại.

---

## POST /api/ingest

Device token. Agent gọi mỗi 60 giây.

```json
{
  "agentVersion": "0.1.0",
  "system": {
    "hostname": "DESKTOP-ABC",
    "osName": "Windows 11 10.0.22631",
    "cpuModel": "Intel(R) Core(TM) i5-1135G7",
    "gpuModel": "Intel(R) Iris(R) Xe Graphics",
    "ramGb": 16
  },
  "metrics": {
    "cpuPct": 23.4,
    "memPct": 61.2,
    "diskPct": 84.7,
    "diskFreeGb": 71.5,
    "tempCpu": null,
    "batteryPct": 92,
    "batteryWear": 18.5,
    "netUpKbps": 12.3,
    "netDownKbps": 240.1,
    "uptimeSec": 182400,
    "procCount": 245,
    "topProcesses": [{ "name": "chrome.exe", "cpu": 18.2, "memMb": 1450.4 }]
  }
}
```

`system` chỉ cần gửi lần đầu (agent gửi lại mỗi 30 chu kỳ). `tempCpu`, `batteryPct`,
`batteryWear`, `netUpKbps`, `netDownKbps`, `procCount` có thể là `null`/bỏ qua.

Phản hồi `200`:

```json
{
  "ok": true,
  "serverTime": "2026-01-01T10:00:00.000Z",
  "healthScore": 68,
  "newEvents": ["DISK_LOW"],
  "commands": [{ "id": "cmd_1", "type": "flush_dns", "params": {}, "createdAt": "…" }]
}
```

Lỗi: `401 missing_token` / `401 invalid_token` / `403 device_disabled` / `422 invalid_payload`.

---

## GET /api/commands

- **Device token** → poll: trả các lệnh `PENDING`, đánh dấu `SENT`.
- **Admin session** → liệt kê 25 lệnh gần nhất (lọc `?deviceId=`).

## POST /api/commands

Admin. Tạo lệnh — người dùng phải bấm xác nhận trên UI trước khi lệnh được xếp hàng.

```json
{ "deviceId": "clx…", "type": "clean_temp", "params": { "confirm": true, "olderThanDays": 7 } }
```

`type` chỉ nhận: `clean_temp` · `flush_dns` · `battery_report` · `trim` · `sfc_scan`.
Giá trị khác bị Zod từ chối với `422`.

## POST /api/commands/result

Device token.

```json
{ "commandId": "cmd_1", "status": "DONE", "result": { "freedMb": 1832.4 } }
```

`status` ∈ `DONE` | `FAILED`; khi FAILED gửi thêm `error`.

---

## GET | POST /api/cron/analyze?limit=2

Admin session hoặc `CRON_SECRET`. Mỗi lần chạy:

1. Chuyển thiết bị không gửi dữ liệu > 5 phút sang `OFFLINE`.
2. Tự đóng cảnh báo cũ hơn 24 giờ (tránh cảnh báo "treo").
3. Xoá metric thô cũ hơn 7 ngày (retention).
4. Gọi DeepSeek cho tối đa `limit` thiết bị (mặc định 2) cần phân tích, tạo `Insight`.

```json
{
  "ok": true,
  "counters": { "offlineMarked": 1, "staleEventsResolved": 3, "metricsPurged": 0 },
  "results": [
    { "deviceId": "clx…", "name": "Dell Inspiron 15", "status": "analyzed", "insightId": 12,
      "healthScore": 64, "usage": { "promptTokens": 980, "completionTokens": 420 } }
  ]
}
```

`limit` nhỏ để phù hợp giới hạn 10 giây của Vercel Hobby; GitHub Actions gọi lặp lại mỗi 30 phút.
