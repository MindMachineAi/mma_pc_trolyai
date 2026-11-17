# Triển khai (Neon + Vercel) — từ số 0

> Điều kiện: repo đã có code (bạn đang ở đây). Tất cả secret **chỉ** nhập vào Neon/Vercel/`apps/web/.env`.

## 0. Cài môi trường trên máy dev

```powershell
# Node.js 22 LTS: https://nodejs.org (chọn LTS)
node -v      # >= v20.11
corepack enable
pnpm -v      # nếu chưa có: npm i -g pnpm
```

Kiểm tra nhanh trong repo:

```powershell
pnpm install
pnpm --filter web prisma:generate
```

## 1. Tạo database Neon (free tier)

1. https://console.neon.tech → **New Project** (region gần VN: Singapore).
2. Mở **Connection Details**, copy 2 chuỗi:
   - **Pooled connection** → `DATABASE_URL` (có `-pooler` trong host)
   - **Direct connection** → `DIRECT_URL` (dùng cho migrate)
3. Đảm bảo chuỗi có `?sslmode=require`.

## 2. Sinh secrets

```powershell
pnpm gen:secrets
```

Copy 3 giá trị (`AUTH_SECRET`, `DEVICE_REGISTRATION_SECRET`, `CRON_SECRET`) — script chỉ in ra
màn hình, không ghi file.

## 3. Tạo file env cho app

> Prisma CLI chỉ đọc `apps/web/.env` (không đọc `.env.local` ở root), còn Next.js đọc cả hai.
> Vì vậy dùng **một file duy nhất**: `apps/web/.env` (đã nằm trong `.gitignore`).

```powershell
Copy-Item .env.example apps\web\.env
notepad apps\web\.env
```

Điền tối thiểu:

```dotenv
DATABASE_URL="postgresql://…-pooler…neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://…neon.tech/neondb?sslmode=require"
AUTH_SECRET="…64 ký tự…"
ADMIN_EMAIL="ban@example.com"
ADMIN_PASSWORD="mat-khau-rat-manh"
DEVICE_REGISTRATION_SECRET="…"
DEEPSEEK_API_KEY="sk-…"
DEEPSEEK_MODEL="deepseek-flash"
CRON_SECRET="…"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Lấy `DEEPSEEK_API_KEY` tại https://platform.deepseek.com → **API keys**.

## 4. Đẩy schema lên Neon & chạy local

```powershell
pnpm --filter web prisma:push     # tạo bảng từ schema.prisma
pnpm dev                          # http://localhost:3000
```

Kiểm tra:

- `http://localhost:3000/api/health` → `"ok": true`
- Đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- **Thêm thiết bị** → copy token
- Terminal khác: chạy agent 1 lần

```powershell
cd apps\agent
python main.py --api-url "http://localhost:3000" --token "pca_..." --once
```

## 5. Đưa lên GitHub (repo public)

Repo đích: <https://github.com/MindMachineAi/mma_pc_trolyai>

```powershell
git init -b main
git add -A
git commit -m "feat: P0 scaffold - dashboard + agent + rules engine + AI insights"
git remote add origin https://github.com/MindMachineAi/mma_pc_trolyai.git
git push -u origin main
```

> Repo ở thư mục này **đã được `git init` + gắn remote `origin`** sẵn (7 commit đã có,
> gồm lockfile + Next 15.5.29), nên bạn chỉ cần chạy `git push -u origin main`.
>
> Repo trên GitHub hiện **public và rỗng** (0 nhánh) — `git ls-remote --heads origin`
> trả về rỗng là bình thường trước lần push đầu.

> Lần push đầu tiên Git Credential Manager sẽ mở trình duyệt để đăng nhập GitHub
> (cần quyền ghi vào org `MindMachineAi`).
>
> Nếu chạy trong shell không tương tác (script/CI/agent) sẽ gặp
> `fatal: Cannot prompt because user interactivity has been disabled` — hãy chạy
> `git push -u origin main` trong **Terminal bình thường** (PowerShell / VS Code) để
> GCM mở trình duyệt đăng nhập. Hoặc dùng PAT:
> `git remote set-url origin https://<PAT>@github.com/MindMachineAi/mma_pc_trolyai.git`,
> push xong **nhớ đổi lại URL không chứa PAT**.
>
> ⚠️ **Đừng để repo nằm trong thư mục Google Drive / OneDrive đang sync.** Drive tạo
> `desktop.ini` trong *mọi* thư mục, kể cả `.git\refs\heads\`, sinh ra ref hỏng
> (`warning: ignoring broken ref refs/heads/desktop.ini`). Nếu đã lỡ, xoá file đó:
> `Remove-Item -LiteralPath '.git\refs\heads\desktop.ini' -Force`
> — hoặc tốt hơn: clone repo ra `C:\dev\...` rồi làm việc ở đó.

Sau khi push, bật các lớp bảo vệ trên GitHub (Settings → Code security):
Secret scanning + Push protection, Dependabot alerts, và branch protection cho `main`
(bắt buộc PR + CI xanh). Thêm repository secret `APP_URL`, `CRON_SECRET` cho workflow cron.

Trước khi push, xác nhận **không có secret** trong staged files:

```powershell
git diff --cached --name-only | Select-String -Pattern '\.env'
```

Nếu lỡ commit file `.env` → **đổi toàn bộ key** rồi `git filter-repo` xoá khỏi lịch sử.

## 6. Deploy Vercel

1. https://vercel.com/new → **Import Git Repository** → chọn repo.
2. **Root Directory**: `apps/web` (quan trọng — repo là monorepo).
3. Framework preset: Next.js (tự nhận). Build command đã cấu hình trong `apps/web/vercel.json`.
4. **Environment Variables** — thêm từng biến (Production + Preview):

   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `DEVICE_REGISTRATION_SECRET`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`,
   `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (= domain Vercel, ví dụ `https://pc-troly-ai.vercel.app`)

5. **Deploy** → mở `https://<app>/api/health` kiểm tra `ok: true`.
6. Đăng nhập dashboard bằng tài khoản admin vừa cấu hình.

> Prisma trên Vercel: `build` đã chạy `prisma generate`. Không cần `prisma migrate` trên Vercel
> nếu bạn đã `prisma:push` từ máy dev. Khi có migration thật, chạy `pnpm --filter web prisma:deploy`
> trong CI hoặc từ máy dev.

## 7. Cron phân tích AI

Hai lớp, dùng đồng thời được:

| Nguồn | Nhịp | Cấu hình |
| --- | --- | --- |
| Vercel Cron (`apps/web/vercel.json`) | 1 lần/ngày, 20:00 UTC (03:00 giờ VN, ngoài giờ cao điểm) | tự động sau deploy |
| GitHub Actions (`.github/workflows/cron-analyze.yml`) | 30 phút | thêm repo secrets `APP_URL`, `CRON_SECRET` |

Thêm secrets: repo → **Settings → Secrets and variables → Actions → New repository secret**.

## 8. Bảo vệ repo (khuyến nghị bật ngay)

1. **Settings → Code security**: bật *Secret scanning*, *Push protection*, *Dependabot alerts*.
2. **Settings → Branches → Add branch protection rule** cho `main`: require PR + require status
   checks (`CI / web`, `CI / agent`, `Secret scan / gitleaks`), cấm force push.
3. (Tuỳ chọn) Bật CodeQL: **Security → Code scanning → Set up CodeQL** (mặc định đủ dùng).

## 9. Checklist sau deploy

- [ ] `/api/health` → `ok: true`, `database: connected`, `aiConfigured: true`
- [ ] Đăng nhập / đăng xuất hoạt động
- [ ] Thêm thiết bị → nhận token `pca_…` (chỉ 1 lần)
- [ ] Cài agent trên 1 laptop → sau ≤2 phút hiện ONLINE
- [ ] Biểu đồ có dữ liệu sau ~5 phút
- [ ] Bấm **Phân tích bằng AI** → thấy đề xuất ở trang *Cảnh báo & AI*
- [ ] Gửi thử lệnh `flush_dns` → trạng thái chuyển DONE trong ≤60 giây
- [ ] `git log` không chứa file env; gitleaks CI xanh

## 10. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `ok: false`, `databaseError` | `DATABASE_URL` sai / Neon sleep | Kiểm tra chuỗi pooled, chạy lại `prisma:push` |
| Login báo "chưa cấu hình ADMIN_*" | Thiếu env trên Vercel | Thêm env → **Redeploy** |
| Agent log `401 invalid_token` | Token bị thu hồi / copy thiếu | Tạo thiết bị mới, cài lại |
| Agent log `kết nối thất bại` | Proxy/firewall | Cho phép outbound 443 tới domain Vercel |
| AI trả `aiSkipped` | Thiếu `DEEPSEEK_API_KEY` | Thêm env, redeploy |
| AI `HTTP 402` | Hết số dư DeepSeek | Nạp tiền hoặc đổi provider |
| Trang 500 sau deploy | Thiếu `AUTH_SECRET` (<32 ký tự) | Sinh lại bằng `pnpm gen:secrets` |
| Cron 401 | `CRON_SECRET` không khớp | Cập nhật secret ở cả Vercel và GitHub |
