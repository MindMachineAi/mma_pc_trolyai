# PC Trợ Lý AI

Dashboard giám sát & bảo trì **nhiều laptop** của một người: agent Python nhỏ chạy trên từng máy,
gửi telemetry về dashboard Next.js trên Vercel, cảnh báo sớm bằng rules engine, và nhận đề xuất
xử lý từ DeepSeek AI — kèm khả năng gửi lệnh bảo trì an toàn (allowlist) từ xa.

Repo **công khai**, nhưng mọi key vận hành (`DEEPSEEK_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, …)
chỉ nằm trong biến môi trường của người triển khai. Xem [SECURITY.md](SECURITY.md).

- Repository: <https://github.com/MindMachineAi/mma_pc_trolyai>
- License: MIT · Báo lỗi: [Issues](https://github.com/MindMachineAi/mma_pc_trolyai/issues)

```
Laptop (agent.exe)  ──POST /api/ingest──▶  Next.js trên Vercel  ──▶  Neon Postgres
        ▲                                        │
        └────── commands[] (poll 60s) ───────────┘         ↕ DeepSeek (cron 30 phút)
```

## Tính năng (P0 — đã có trong mã nguồn)

- **Telemetry 60 giây**: CPU, RAM, dung lượng ổ C:, dung lượng trống, pin, độ chai pin, uptime,
  số tiến trình, top 5 tiến trình ngốn tài nguyên, nhiệt độ (nếu đọc được).
- **Rules engine tất định** (miễn phí, chạy mỗi lần nhận dữ liệu): ổ đầy, RAM cao, CPU cao kéo dài,
  pin chai, ổ tăng nhanh; chống trùng cảnh báo 6 giờ, tự đóng sau 24 giờ.
- **Điểm sức khỏe 0–100** tính trong code (ổ 28% · RAM 20% · nhiệt 19% · pin 19% · CPU 14%).
- **AI đề xuất**: DeepSeek JSON mode → tóm tắt nguyên nhân + tối đa 4 việc cần làm, có mức rủi ro;
  output được validate bằng Zod, `actionType` chỉ giữ nếu thuộc allowlist.
- **Lệnh bảo trì từ xa có xác nhận**: `clean_temp`, `flush_dns`, `battery_report`, `trim`, `sfc_scan`.
  Agent từ chối mọi loại lệnh khác, không có shell tự do.
- **Bảo mật**: device token chỉ lưu SHA-256 (hiển thị 1 lần), session JWT httpOnly, cron secret,
  gitleaks + Dependabot + CI.
- **Thu hồi thiết bị** tức thời (`DISABLED` → mọi request bị 403).

## Công nghệ

| Lớp | Lựa chọn |
| --- | --- |
| Web | Next.js 15 (App Router, Server Components), TypeScript strict, Tailwind CSS 3, Recharts, lucide-react |
| Dữ liệu | Neon Postgres + Prisma 6 |
| AI | DeepSeek (`https://api.deepseek.com`, chuẩn OpenAI, JSON mode) qua interface `AiProvider` |
| Auth | JWT HS256 bằng `jose`, cookie `httpOnly`; mật khẩu so sánh `timingSafeEqual` |
| Agent | Python 3.11 + psutil + requests, đóng gói `.exe` bằng PyInstaller, chạy bằng Scheduled Task (SYSTEM) |
| Hạ tầng | Vercel (hobby) + GitHub Actions (CI, cron, build exe) |

## Cấu trúc repo

```
.
├─ apps/
│  ├─ web/                     # Next.js 15
│  │  ├─ app/
│  │  │  ├─ (dashboard)/       # layout + dashboard + devices/[id] + insights
│  │  │  ├─ api/               # health, devices, ingest, commands, cron/analyze
│  │  │  ├─ login/             # trang đăng nhập + server actions
│  │  │  ├─ layout.tsx         # root layout (dark theme)
│  │  │  └─ globals.css        # design tokens + component classes
│  │  ├─ components/           # ui.tsx, device-card, metrics-chart, add-device, device-actions…
│  │  ├─ lib/
│  │  │  ├─ ai/                # provider.ts, deepseek.ts, analyze.ts (prompt + zod)
│  │  │  ├─ auth.ts, session.ts, password.ts, tokens.ts
│  │  │  ├─ rules.ts           # ngưỡng cảnh báo
│  │  │  ├─ health.ts          # điểm sức khỏe
│  │  │  ├─ validators.ts      # zod schema + ALLOWED_COMMANDS
│  │  │  └─ db.ts, utils.ts
│  │  ├─ prisma/schema.prisma
│  │  ├─ middleware.ts         # chặn truy cập trang khi chưa đăng nhập
│  │  └─ vercel.json           # cron 1 lần/ngày (hobby)
│  └─ agent/                   # Python agent
│     ├─ main.py               # vòng lặp ingest → execute → report
│     ├─ collector.py          # psutil telemetry
│     ├─ executor.py           # ALLOWLIST lệnh bảo trì
│     ├─ client.py, config.py
│     ├─ install.ps1 / uninstall.ps1
│     └─ build.spec            # PyInstaller one-file
├─ docs/                       # ARCHITECTURE, API, AGENT-INSTALL, DEPLOY
├─ scripts/gen-secrets.ps1
├─ .github/workflows/           # ci, security (gitleaks), cron-analyze, build-agent
├─ .env.example                 # chỉ placeholder
└─ SECURITY.md / CONTRIBUTING.md / LICENSE (MIT)
```

## Chạy nhanh (local)

Yêu cầu: Node.js ≥ 20.11 (khuyến nghị 22 LTS), pnpm, Python 3.11+, một project Neon.

```powershell
# 0. Lấy code
git clone https://github.com/MindMachineAi/mma_pc_trolyai.git
cd mma_pc_trolyai

# 1. Cài dependency
pnpm install

# 2. Sinh secrets rồi tạo file env (Prisma + Next.js đều đọc apps/web/.env)
pnpm gen:secrets
Copy-Item .env.example apps\web\.env

# 3. Tạo bảng trong Neon
pnpm --filter web prisma:push

# 4. Chạy dashboard
pnpm dev            # http://localhost:3000

# 5. Kiểm tra cấu hình
#    http://localhost:3000/api/health  → "ok": true
```

Đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD` → **Thêm thiết bị** → copy token → cài agent:

```powershell
cd apps\agent
python main.py --api-url "http://localhost:3000" --token "pca_..." --once
```

Hướng dẫn đầy đủ: [docs/DEPLOY.md](docs/DEPLOY.md) · Agent: [docs/AGENT-INSTALL.md](docs/AGENT-INSTALL.md)

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Chuỗi Neon **pooled** (`?sslmode=require`) |
| `DIRECT_URL` | ✅ | Chuỗi Neon **direct** — dùng cho `prisma migrate/push` |
| `AUTH_SECRET` | ✅ | ≥ 32 ký tự, ký JWT session. Đổi = đăng xuất mọi session |
| `ADMIN_EMAIL` | ✅ | Email đăng nhập dashboard |
| `ADMIN_PASSWORD` | ✅ | Mật khẩu admin (so sánh hằng thời gian) |
| `DEVICE_REGISTRATION_SECRET` | ➖ | Cho phép tạo thiết bị không cần session (CLI/CI) |
| `DEEPSEEK_API_KEY` | ➖ | Không có → bỏ qua AI, dashboard vẫn hoạt động |
| `DEEPSEEK_BASE_URL` | ➖ | Mặc định `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | ➖ | Mặc định `deepseek-flash` |
| `CRON_SECRET` | ➖ | Bảo vệ `/api/cron/analyze` |
| `NEXT_PUBLIC_APP_URL` | ➖ | URL dashboard, hiển thị trong hướng dẫn cài agent |

## Script

| Lệnh | Việc |
| --- | --- |
| `pnpm dev` | Chạy Next.js dev server |
| `pnpm build` | Build production (kèm `prisma generate`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:push` | Đẩy schema lên Neon |
| `pnpm db:migrate` | Tạo migration (khi cần lịch sử thay đổi) |
| `pnpm gen:secrets` | Sinh `AUTH_SECRET`, `DEVICE_REGISTRATION_SECRET`, `CRON_SECRET` |

## Bảo mật — những điều đã làm sẵn

- Device token: 32 byte ngẫu nhiên, DB chỉ lưu SHA-256 + prefix; token gốc hiển thị **một lần**.
- Admin: so sánh hằng thời gian; session `httpOnly`, `secure` ở production, SameSite=Lax.
- Cron: `CRON_SECRET` so sánh hằng thời gian, chấp nhận qua `Authorization` hoặc `x-cron-secret`.
- AI: chỉ gửi số liệu tổng hợp; output validate Zod; `actionType` giới hạn trong allowlist.
- Lệnh bảo trì: phải được người dùng bấm xác nhận; agent kiểm tra lại allowlist lần nữa.
- `.gitignore` chặn `.env*`; gitleaks chạy ở CI và có thể bật pre-commit.
- Header bảo mật cơ bản (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) trong `next.config.ts`.

Bật thêm trên GitHub: **Secret scanning + Push protection + Dependabot + branch protection**
(xem mục 8 trong [docs/DEPLOY.md](docs/DEPLOY.md)).

## Trạng thái & lộ trình

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| P0 | Scaffold, schema, ingest, rules engine, dashboard, agent, docs, CI | ✅ trong repo |
| P1 | Login/UX hoàn thiện, onboarding 3 bước, empty states | 🚧 một phần (đã có login + add-device) |
| P2 | AI insights nâng cao (so sánh xu hướng 7 ngày, gộp cảnh báo) | ⏳ |
| P3 | Nhiệt độ qua LibreHardwareMonitor, cảnh báo ổ SMART | ⏳ |
| P4 | Hàng đợi lệnh nâng cao: lịch chạy, log kết quả chi tiết, rollback | 🚧 allowlist + queue đã có |
| P5 | Nhiều người dùng/team, phân quyền, thông báo Telegram/Email | ⏳ |

## Giới hạn đã biết

- Agent Windows-only (dùng `winreg`, `CIM`, `powercfg`). macOS/Linux cần adapter riêng.
- Nhiệt độ CPU thường `null` trên Windows vì `psutil` không đọc cảm biến — cần driver phụ.
- Vercel Hobby: cron 1 lần/ngày + function tối đa 10 giây → phân tích tối đa 2 thiết bị/lần;
  dùng GitHub Actions 30 phút để bù.
- Chưa có tính năng đổi mật khẩu trong UI: đổi `ADMIN_PASSWORD` trong env rồi redeploy.

## Đóng góp & giấy phép

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Giấy phép **MIT** ([LICENSE](LICENSE)).
Lỗ hổng bảo mật: đọc [SECURITY.md](SECURITY.md) — vui lòng không mở public issue.

