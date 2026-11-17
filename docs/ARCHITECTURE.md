# Kiến trúc — PC Trợ Lý AI

## 1. Tổng quan

```
┌─────────────────────┐        POST /api/ingest (Bearer device token)
│  Laptop 1           │  ───────────────────────────────────────────┐
│  agent.exe (Python) │  ◀──── commands[] (kéo về khi poll) ────────┤
└─────────────────────┘                                             │
┌─────────────────────┐                                             ▼
│  Laptop 2 … N       │ ───────────────────────▶ ┌────────────────────────────────┐
└─────────────────────┘                          │  Next.js 15 (Vercel)           │
                                                 │  ├─ Route Handlers (API)        │
┌─────────────────────┐   HTTPS (session JWT)    │  ├─ Server Components (UI)      │
│  Trình duyệt admin  │ ◀──────────────────────▶ │  └─ Middleware bảo vệ trang     │
└─────────────────────┘                          └───────────┬────────────────────┘
                                                             │ Prisma
                                                             ▼
                                                 ┌────────────────────────────────┐
                                                 │  Neon Postgres (serverless)    │
                                                 └────────────────────────────────┘
                                                             ▲
                                     cron (Vercel hoặc GH Actions)
                                                             │
                                                 ┌────────────────────────────────┐
                                                 │  DeepSeek API (JSON output)    │
                                                 └────────────────────────────────┘
```

**Vì sao agent poll thay vì server push?** Laptop thường ở sau NAT, không có IP công khai.
Agent chủ động gọi ra ngoài (outbound 443) nên không cần mở port, không cần VPN, không cần
DDNS. Đổi lại lệnh có độ trễ tối đa bằng chu kỳ poll (60 giây) — chấp nhận được với tác vụ
bảo trì.

## 2. Luồng dữ liệu (1 chu kỳ 60 giây)

1. **Agent** đọc psutil → dựng payload `metrics` (+ `system` mỗi 30 chu kỳ).
2. `POST /api/ingest` với `Authorization: Bearer pca_…`.
3. Server băm token → tra `Device.tokenHash` (unique index).
4. Validate payload bằng Zod → ghi `Metric`, cập nhật `Device` (ONLINE, lastSeenAt, thông tin máy).
5. **Rules engine** (`lib/rules.ts`) chạy tức thời, không tốn phí; mỗi cảnh báo chống trùng theo
   `code` trong cửa sổ 6 giờ → ghi `Event`.
6. Server tính **điểm sức khỏe tất định** (`lib/health.ts`), lưu `HealthSnapshot` mỗi 10 phút.
7. Server trả về danh sách `Command` đang PENDING (tối đa 5) và đánh dấu `SENT`.
8. Agent thực thi từng lệnh trong **allowlist**, rồi `POST /api/commands/result`.

## 3. Vì sao tách "rules" và "AI"

| | Rules engine | AI (DeepSeek) |
| --- | --- | --- |
| Chạy khi nào | Mỗi lần ingest | Cron 30 phút / bấm tay |
| Chi phí | 0 | Tốn token |
| Độ tất định | 100% | Có thể dao động |
| Vai trò | Phát hiện ngưỡng, chống bỏ sót | Giải thích nguyên nhân, xếp ưu tiên, gợi ý cách xử lý |

Dashboard **luôn** có số liệu và cảnh báo kể cả khi AI lỗi/hết quota. AI là lớp "cố vấn",
không phải nguồn sự thật.

## 4. Ngưỡng cảnh báo (lib/rules.ts)

| Code | Điều kiện | Mức |
| --- | --- | --- |
| `DISK_CRITICAL` | ổ C: ≥ 90% | CRITICAL |
| `DISK_LOW` | ổ C: ≥ 80% | WARN |
| `DISK_FREE_CRITICAL` | trống < 8 GB | CRITICAL |
| `MEM_CRITICAL` / `MEM_HIGH` | RAM ≥ 90% / ≥ 80% | CRITICAL / WARN |
| `CPU_SUSTAINED_HIGH` | CPU ≥ 90% ở ≥ 3/4 mẫu gần nhất | WARN |
| `TEMP_CRITICAL` / `TEMP_HIGH` | CPU ≥ 95°C / ≥ 85°C | CRITICAL / WARN |
| `BATTERY_DEGRADED_CRITICAL` / `BATTERY_DEGRADED` | chai ≥ 50% / ≥ 30% | CRITICAL / WARN |
| `DISK_GROWING_FAST` | ổ tăng ≥ 1.5 điểm % trong chuỗi mẫu gần nhất | INFO |

Muốn đổi ngưỡng: sửa `THRESHOLDS` trong `apps/web/lib/rules.ts` (một chỗ duy nhất).

## 5. Điểm sức khỏe (lib/health.ts)

Trọng số: ổ đĩa 28% · RAM 20% · nhiệt độ 19% · pin 19% · CPU 14%.
Mỗi thành phần map tuyến tính từ "tốt" (100 điểm) xuống "xấu" (0 điểm), rồi cộng có trọng số.

Điểm này được tính **trong code**, không gọi AI → mở dashboard là có số ngay. Điểm do AI trả về
được lưu riêng ở `Insight.healthScore` để so sánh.

## 6. Thiết kế AI

- Interface `AiProvider` (`lib/ai/provider.ts`) → đổi nhà cung cấp chỉ cần 1 file mới.
- DeepSeek gọi ở chế độ `response_format: { type: "json_object" }`; prompt có chữ "json" và
  mẫu JSON; `max_tokens` 1200; retry 1 lần nếu `content` rỗng.
- Output được validate bằng Zod (`aiInsightSchema`) — sai schema = bỏ, không hiển thị rác.
- `actionType` do AI gợi ý **chỉ được giữ nếu nằm trong allowlist**; ngoài allowlist bị xoá.
- Ngữ cảnh gửi đi chỉ gồm: tên thiết bị, OS, CPU, RAM, 12 mẫu số liệu, danh sách mã cảnh báo.
  Không gửi tên file, đường dẫn, serial, email, lịch sử duyệt web.

## 7. Bảo mật 3 lớp

| Lớp | Cơ chế |
| --- | --- |
| Token thiết bị | Sinh `pca_` + 32 byte ngẫu nhiên; DB chỉ lưu SHA-256, tra cứu theo `tokenHash` (unique). Token gốc hiển thị 1 lần. |
| Admin | Mật khẩu so sánh bằng `timingSafeEqual`; session là JWT HS256 (`AUTH_SECRET`) trong cookie `httpOnly`, `secure` ở production, hết hạn 7 ngày. |
| Cron | `CRON_SECRET` so sánh hằng thời gian qua header `Authorization` hoặc `x-cron-secret`. |
| Hàng rào | gitleaks CI + GitHub push protection + Dependabot + branch protection; `.env*` bị ignore. |

Thu hồi thiết bị = `status = DISABLED` → mọi request ingest/poll trả 403 ngay lập tức.

## 8. Mô hình dữ liệu

| Bảng | Vai trò | Ghi chú |
| --- | --- | --- |
| `Device` | 1 laptop | `tokenHash` unique; `status` ONLINE/OFFLINE/DISABLED |
| `Metric` | Chuỗi thời gian 60 giây | Giữ 7 ngày; index `(deviceId, ts desc)` |
| `Event` | Cảnh báo do rules engine | Chống trùng theo `code` 6 giờ; tự đóng sau 24 giờ |
| `Insight` | Kết quả AI | `recommendations` là JSON đã validate; `OPEN/ACKED/DONE` |
| `Command` | Lệnh bảo trì | Vòng đời `PENDING → SENT → DONE/FAILED` |
| `HealthSnapshot` | Lịch sử điểm sức khỏe | Mỗi 10 phút / 1 lần |

## 9. Đánh đổi đã chấp nhận (P0)

| Quyết định | Lý do | Khi nào nâng cấp |
| --- | --- | --- |
| 1 admin duy nhất từ env | Đủ cho mô hình cá nhân, không cần bảng User | P5: adapter + nhiều user/team |
| Session JWT tự viết (`jose`) | Không phụ thuộc `next-auth@beta`, ít rủi ro hơn khi chưa có Node để test | Cần OAuth/SSO → thay bằng Auth.js v5 |
| UI primitive tự viết (Tailwind) | Lúc scaffold chưa có Node nên không chạy được `shadcn init` | Chạy `npx shadcn@latest init` rồi thay dần |
| Metric thô giữ 7 ngày | Neon free tier | Nâng gói hoặc rollup sang bảng giờ/ngày |
| Cron Vercel Hobby 1 lần/ngày | Giới hạn gói free | GitHub Actions 30 phút (đã có) hoặc gói Pro |
| Nhiệt độ CPU = null trên Windows | psutil không đọc được cảm biến | P3: tích hợp LibreHardwareMonitor |

