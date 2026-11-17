# Security Policy — PC Trợ Lý AI

Repo này **công khai (public)**. Toàn bộ key vận hành **chỉ** tồn tại trong biến môi trường của người triển khai, không bao giờ nằm trong mã nguồn.

## 1. Mô hình bảo mật

| Lớp | Nội dung | Nơi lưu | Có trong Git? |
| --- | --- | --- | --- |
| Code | Next.js, agent Python, schema, docs | Repo public | ✅ Có |
| Cấu hình mẫu | `.env.example` (chỉ placeholder) | Repo public | ✅ Có |
| Secrets vận hành | `DEEPSEEK_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `DEVICE_REGISTRATION_SECRET`, `ADMIN_PASSWORD` | `apps/web/.env` (máy dev) + Vercel Environment Variables + GitHub Actions Secrets | ❌ **Không bao giờ** |

Nguyên tắc bắt buộc khi đóng góp code:

1. Không hardcode key/token, kể cả dạng giá trị mặc định.
2. Không đặt secret trong biến `NEXT_PUBLIC_*` (các biến này bị nhúng vào bundle client).
3. Chỉ đọc secret bên trong route handler / server action / server component.
4. Agent chỉ giữ **device token** (không phải key hệ thống).

## 2. Bảng secrets

| Secret | Mục đích | Lưu ở | Lộ ra client? | Khi nào rotate |
| --- | --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | Gọi AI | Vercel env / `apps/web/.env` | Không | Khi nghi lộ, hoặc đổi nhà cung cấp |
| `DATABASE_URL` / `DIRECT_URL` | Neon Postgres | Vercel env / `apps/web/.env` | Không | Khi nghi lộ |
| `AUTH_SECRET` | Ký JWT session | Vercel env | Không | Định kỳ 6 tháng (mọi session bị đăng xuất) |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Đăng nhập dashboard | Vercel env | Không | Khi đổi mật khẩu |
| `DEVICE_REGISTRATION_SECRET` | Cấp token cho thiết bị mới | Vercel env | Không | Sau mỗi lần thêm máy |
| `CRON_SECRET` | Bảo vệ `/api/cron/analyze` | Vercel env + GitHub Actions | Không | Nếu lộ trong log CI |
| Device token | Agent xác thực | Laptop (config) + **hash SHA-256** trong DB | Chỉ trên máy đó | Khi xóa/thu hồi thiết bị |

## 3. Hàng rào tự động

- **gitleaks** (pre-commit + CI) chặn commit chứa secret.
- **GitHub Secret scanning + Push protection** (bật trong Settings → Code security).
- **CodeQL** + **Dependabot** quét lỗ hổng mã nguồn và dependency.
- **Branch protection**: cấm push trực tiếp vào `main`, bắt buộc PR + CI pass.

## 4. Playbook khi nghi lộ key

1. Revoke key tại DeepSeek Platform → tạo key mới.
2. Cập nhật env trên Vercel → **Redeploy**.
3. Đổi `AUTH_SECRET` → toàn bộ session cũ mất hiệu lực.
4. Thu hồi device token bị nghi ngờ (xóa thiết bị trong dashboard).
5. Nếu `DATABASE_URL` lộ → rotate password Neon, cập nhật `DATABASE_URL`/`DIRECT_URL`.
6. Nếu key từng bị commit → `git filter-repo` để xóa khỏi lịch sử, sau đó liên hệ GitHub Support để purge cache.

## 5. Báo lỗi bảo mật

Vui lòng **không** mở public issue cho lỗ hổng bảo mật. Gửi email cho maintainer (ghi trong `README.md`) kèm mô tả và bước tái hiện. Chúng tôi phản hồi trong vòng 72 giờ.
