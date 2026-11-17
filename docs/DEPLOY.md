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

### 6.1. Chuẩn bị trước khi mở Vercel

| Cần | Lấy ở đâu | Lưu ý |
| --- | --- | --- |
| `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) | Neon → **Connection Details** | `DATABASE_URL` phải có `-pooler` trong host; cả hai phải có `?sslmode=require` |
| `AUTH_SECRET`, `DEVICE_REGISTRATION_SECRET`, `CRON_SECRET` | `pnpm gen:secrets` (mục 2) | `AUTH_SECRET` **≥ 32 ký tự**, ngắn hơn thì `lib/session.ts` ném lỗi ngay khi đăng nhập |
| `DEEPSEEK_API_KEY` | https://platform.deepseek.com → **API keys** | Thiếu ⇒ cron trả `aiSkipped` (không fail), nút *Phân tích bằng AI* báo lỗi cấu hình |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Tự đặt | Thiếu ⇒ `/api/health` trả **503** và không đăng nhập được |

### 6.2. Import repo

1. https://vercel.com/new → **Import Git Repository** → chọn `MindMachineAi/mma_pc_trolyai`.
   Repo không hiện ⇒ bấm **Adjust GitHub App Permissions** → cấp quyền cho org `MindMachineAi`.
2. **Project Name**: `pc-troly-ai` → domain mặc định `pc-troly-ai.vercel.app`.
3. **Framework Preset**: Next.js (tự nhận từ `apps/web/package.json`).
4. **Root Directory**: bấm **Edit** → chọn `apps/web`. Để nguyên root repo sẽ báo
   *"No Next.js version detected"* vì repo là monorepo (`pnpm-workspace.yaml` ở root).
5. **Build and Output Settings**: để **Inherit** hết — `apps/web/vercel.json` đã khai
   `buildCommand: prisma generate && next build` và cron `/api/cron/analyze?limit=2` lúc `0 20 * * *`.
   Vercel tự chạy `pnpm install` ở workspace root (Node 22 nhờ `engines`, pnpm 9.15.0 nhờ
   `packageManager`). Chỉ cần đổi **Install Command** = `pnpm install --frozen-lockfile` nếu gặp
   lỗi lockfile.

### 6.3. Khai báo Environment Variables

Đường dẫn: **Project → Settings → Environment Variables → Add New** (Key / Value / Environments).
Bật **Sensitive** cho mọi giá trị là secret, **trừ** `NEXT_PUBLIC_APP_URL` (cần đọc lại để đối chiếu domain).

| Key | Bắt buộc | Giá trị mẫu | Môi trường | Sensitive |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Production | ✅ |
| `DIRECT_URL` | ✅ | `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Production | ✅ |
| `AUTH_SECRET` | ✅ | chuỗi base64 ≥ 32 ký tự | Production | ✅ |
| `ADMIN_EMAIL` | ✅ | `ban@example.com` | Production | ➖ |
| `ADMIN_PASSWORD` | ✅ | mật khẩu mạnh | Production | ✅ |
| `DEVICE_REGISTRATION_SECRET` | ➖ | hex 32 byte | Production | ✅ |
| `DEEPSEEK_API_KEY` | ➖ | `sk-…` | Production | ✅ |
| `DEEPSEEK_BASE_URL` | ➖ | `https://api.deepseek.com` | Production | ➖ |
| `DEEPSEEK_MODEL` | ➖ | `deepseek-flash` | Production | ➖ |
| `CRON_SECRET` | ✅ (nếu dùng cron) | hex 32 byte | Production | ✅ |
| `NEXT_PUBLIC_APP_URL` | ➖ | `https://pc-troly-ai.vercel.app` | Production | ❌ |

Vì sao cần đúng như vậy:

- `DIRECT_URL` **bắt buộc cả trên Vercel** dù runtime chỉ dùng `DATABASE_URL`: `prisma/schema.prisma`
  khai `directUrl = env("DIRECT_URL")` nên bước `prisma generate` lúc build cần biến này (CI cũng phải
  set giá trị giả — xem `.github/workflows/ci.yml`).
- `CRON_SECRET`: `lib/tokens.ts` nhận `Authorization: Bearer …` **hoặc** `x-cron-secret`. Khi project có
  biến tên `CRON_SECRET`, Vercel Cron **tự gắn** `Authorization: Bearer <giá trị>` vào request cron.
- `DEVICE_REGISTRATION_SECRET` chỉ cần khi cấp token bằng script
  (`curl -H "x-registration-secret: …"`); dashboard dùng session admin nên vẫn thêm được thiết bị nếu thiếu.
- `NEXT_PUBLIC_APP_URL` được **nhúng vào bundle lúc build** (dùng ở `dashboard/page.tsx` để in hướng dẫn
  cài agent) ⇒ đổi giá trị phải **Redeploy**, và không bật Sensitive.

**Nhập nhanh không cần gõ tay:** Vercel có ô *Paste the contents*, nhưng **không dán kèm dấu nháy kép**
(khác `apps/web/.env`, Vercel lưu nguyên `"` thành một phần giá trị → `invalid port`). Xuất bản không nháy
từ file env của bạn rồi dán:

```powershell
Get-Content apps\web\.env |
  Where-Object { $_ -match '^\s*[A-Z_]+=' } |
  ForEach-Object { $_ -replace '^([A-Z_]+)\s*=\s*"(.*)"\s*$', '$1=$2' } |
  Set-Clipboard          # Ctrl+V vào ô Environment Variables của Vercel
```

### 6.4. Deploy và kiểm tra

1. Bấm **Deploy** → log phải có `prisma generate` → `next build` → bảng **Route (app)**.
2. Mở `https://<app>/api/health`:

   ```json
   {
     "ok": true,
     "database": { "ok": true },
     "authConfigured": true,
     "aiConfigured": true,
     "cronConfigured": true,
     "aiProvider": "deepseek-flash"
   }
   ```

   `ok:false` kèm `databaseError` ⇒ chuỗi Neon sai (kiểm tra `-pooler`); `authConfigured:false` ⇒ thiếu
   1 trong 3 biến `AUTH_SECRET` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` → thêm rồi **Redeploy**
   (deployment cũ **không** tự nhận env mới).
3. Tạo bảng trong DB (Vercel **không** làm bước này): chạy một lần trên máy dev

   ```powershell
   pnpm --filter web prisma:push
   ```

4. Đăng nhập `/login` → thêm thiết bị → copy token `pca_…` → cài agent trỏ về domain Vercel
   (xem `docs/AGENT-INSTALL.md`).

> Prisma trên Vercel: build đã chạy `prisma generate`, nên không cần `prisma migrate` ở đó. Khi có
> migration thật, chạy `pnpm --filter web prisma:deploy` từ máy dev hoặc trong CI.

### 6.5. Tinh chỉnh sau deploy

| Việc | Đường dẫn trong Vercel | Lý do |
| --- | --- | --- |
| Region Functions = **Singapore (sin1)** | Settings → **Functions** → Region | Neon đặt ở Singapore, giảm độ trễ mỗi query |
| Xác nhận cron đã đăng ký | Project → **Cron Jobs** | Phải thấy `/api/cron/analyze?limit=2` — `0 20 * * *` (Hobby chỉ cho 1 cron/ngày) |
| Gắn custom domain | Settings → **Domains** | Gắn xong: sửa `NEXT_PUBLIC_APP_URL` → **Redeploy** |
| Redeploy sau mỗi lần sửa env | Deployments → ⋯ → **Redeploy** | Env không áp dụng ngược cho deployment đã build |
| Chỉ bật Preview khi có DB riêng | Settings → Environment Variables | Tránh preview deploy ghi vào DB production (dùng Neon branch riêng) |

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
| Build báo *"No Next.js version detected"* | Chưa đặt **Root Directory** = `apps/web` | Settings → General → Root Directory → **Redeploy** |
| Build dừng ở `prisma generate`: *Environment variable not found: DIRECT_URL* | Thiếu `DIRECT_URL` trên Vercel | Thêm biến (mục 6.3) → Redeploy |
| DB báo *invalid port* / host lạ | Dán giá trị kèm dấu `"` hoặc dùng chuỗi **direct** cho `DATABASE_URL` | Xoá biến, nhập lại không nháy, dùng chuỗi *Pooled* |
| Trang `/dashboard` 500 ngay sau khi thêm env | Deployment cũ chưa build lại | Deployments → ⋯ → **Redeploy** |
| Cron 401 | `CRON_SECRET` không khớp | Cập nhật secret ở cả Vercel và GitHub |
