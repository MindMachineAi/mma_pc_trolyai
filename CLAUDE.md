# PC Trợ Lý AI — hướng dẫn cho AI

Dashboard giám sát & bảo trì từ xa nhiều laptop Windows. Agent Python gửi telemetry về
dashboard Next.js (Vercel + Neon Postgres). Rules engine tất định tính cảnh báo; DeepSeek chỉ giải thích.

## Stack
- Monorepo pnpm 9.15.0 (`pnpm-workspace.yaml`), Node 22 LTS (>=20.11).
- `apps/web`: Next.js 15.5.29 App Router, React 19, TypeScript strict, Prisma 6 (Neon), Tailwind 3,
  zod, jose (session JWT), recharts, lucide-react.
- `apps/agent`: Python 3.11, chạy nền trên Windows 10/11 (Scheduled Task), đóng gói bằng PyInstaller (`build.spec`).
- CI: `.github/workflows/ci.yml` (typecheck + prisma validate, compile agent), `security.yml` (gitleaks), `cron-analyze.yml`.

## Bản đồ code
- API: `apps/web/app/api/*` — `ingest` (agent gửi số liệu), `commands` + `commands/result` (lệnh bảo trì),
  `devices`, `cron/analyze`, `health`.
- Xác thực: `lib/auth.ts`, `lib/session.ts`, `lib/password.ts`, `lib/tokens.ts`, `middleware.ts`, `app/login/*`.
- Rules/điểm sức khỏe: `lib/rules.ts`, `lib/health.ts`. AI: `lib/ai/*`. Validate đầu vào: `lib/validators.ts`.
- Agent: `collector.py` (thu số liệu), `executor.py` (chạy lệnh allowlist), `client.py`, `config.py`, `main.py`.
- Tài liệu: `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOY.md`, `docs/AGENT-INSTALL.md`.

## Lệnh kiểm (phải pass trước khi commit)
```powershell
pnpm install
pnpm --filter web prisma:generate
pnpm --filter web prisma:validate   # cần DATABASE_URL + DIRECT_URL trong apps/web/.env (giá trị giả cũng được)
pnpm typecheck                      # 0 lỗi
python -m compileall -q apps/agent
cd apps/agent; python main.py --help
```
`pnpm build` khi đổi cấu hình Next/route. `next build` không type-check nên KHÔNG được bỏ `pnpm typecheck`.
`prisma:validate` không cần `.env` thật nếu đặt tạm `DATABASE_URL`/`DIRECT_URL` giả trong shell (giống CI).
Node >= 25 không kèm corepack → `npm install -g corepack; corepack enable` để có đúng pnpm 9.15.0.
Làm việc ở bản clone local (`C:\dev\mma_pc_trolyai`), KHÔNG trong thư mục Google Drive: Drive khóa file làm `pnpm install` lỗi ENOENT.
Windows `pnpm install` lỗi ECONNRESET → `$env:NODE_OPTIONS="--dns-result-order=ipv4first"`.
Terminal VS Code trên máy này có thể thiếu PATH Node: gọi thẳng `C:\Users\Admin\AppData\Roaming\npm\pnpm.CMD`
(`pnpm.ps1` bị ExecutionPolicy chặn) hoặc mở terminal mới để nhận PATH hệ thống.

## Quy ước
- Conventional Commits có scope: `feat(web): ...`, `fix(agent): ...`, `docs: ...`, `chore: ...`.
- Nhánh `feat/<ten>` hoặc `fix/<ten>` từ `origin/main`. Không push thẳng `main`, mọi thay đổi qua PR.
- UI và thông báo lỗi cho người dùng bằng tiếng Việt.
- Mọi input API validate bằng zod trong `lib/validators.ts`.
- Lệnh bảo trì: thêm vào `ALLOWED_COMMANDS` (`lib/validators.ts`) thì PHẢI có handler trong `apps/agent/executor.py`.
  AI không được sinh lệnh tự do; mọi hành động nằm trong allowlist và cần người dùng xác nhận.
- Không thêm dependency nếu thư viện sẵn có làm được.
- Python agent: giữ UTF-8 cho stdout/stderr (xem `main.py`).

## Bí mật — không bao giờ commit / in ra
`.env*` (trừ `.env.example`), `agent-config.json`, `*.pem`, `*.key`, device token,
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `DEVICE_REGISTRATION_SECRET`,
`DEEPSEEK_API_KEY`, `CRON_SECRET`. Repo công khai. Biến mới → thêm giá trị mẫu vào `.env.example`.

## Code nhạy cảm (review bằng Opus)
Đăng nhập/session (`lib/auth.ts`, `lib/session.ts`, `lib/password.ts`, `middleware.ts`, `app/login/*`),
token thiết bị (`lib/tokens.ts`, `api/ingest`, `api/devices`), lệnh từ xa (`api/commands*`,
`ALLOWED_COMMANDS`, `apps/agent/executor.py`, `install.ps1`), cron (`api/cron/*`).

## Quy trình Claude + Cline
- **Claude (claude.ai Project):** định hướng, chia việc, viết đặc tả `docs/specs/<ten>.md`, xử lý lỗi khó/production.
- **Cline (model rẻ):** viết code theo đặc tả, theo `.clinerules`; tự gọi Claude Code review; mở PR.
- **Claude Code (`claude` CLI):** chỉ đọc, review theo `docs/ai/REVIEW_PROMPT.md`.
  Spec chạm "Code nhạy cảm" ở trên → `--model opus`.
- **Người dùng:** trả lời câu hỏi trong khung chat Cline, xem preview Vercel, bấm merge.
- Mỗi nhánh chỉ một bên sửa (Cline). Giao việc bằng câu: `Làm docs/specs/<ten>.md`.
