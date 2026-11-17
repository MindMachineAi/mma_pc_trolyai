# Đóng góp

Cảm ơn bạn quan tâm! Repo này là dự án cá nhân nhưng mọi PR/issue đều được xem xét.

## Quy trình

1. Fork → tạo nhánh `feat/ten-tinh-nang` hoặc `fix/ten-loi`.
2. `pnpm install` và `pnpm --filter web typecheck` phải pass.
3. Agent: `python -m compileall apps/agent` phải pass.
4. Commit theo Conventional Commits: `feat(web): ...`, `fix(agent): ...`, `docs: ...`.
5. Mở PR mô tả rõ: vấn đề, cách giải quyết, cách kiểm thử.

## Quy tắc bắt buộc

- **Không commit secret** dưới bất kỳ hình thức nào (kể cả trong test, comment, ảnh chụp).
- Không thêm dependency mới nếu có thể giải quyết bằng thư viện sẵn có.
- Không thêm lệnh vào `ALLOWED_COMMANDS` (web) mà chưa thêm handler tương ứng trong `apps/agent/executor.py`.
- Không cho AI sinh lệnh tự do: mọi hành động phải nằm trong allowlist và cần người dùng xác nhận.
- Giữ tiếng Việt trong UI và thông báo lỗi hướng tới người dùng.

## Kiểm thử cục bộ (đã xác minh trên Windows)

Yêu cầu: **Node 22 LTS** (repo pin `pnpm@9.15.0` qua `packageManager`) và **Python 3.10+**.

```powershell
pnpm install                       # tải dependency (cần registry.npmjs.org)
pnpm --filter web prisma:generate  # sinh Prisma Client
pnpm --filter web prisma:validate   # cần DATABASE_URL + DIRECT_URL trong apps/web/.env
pnpm typecheck                     # tsc --noEmit — phải 0 lỗi
pnpm build                         # next build — phải in bảng "Route (app)"
python -m compileall -q apps/agent # cú pháp Python
cd apps/agent; python main.py --help
```

Lưu ý thực tế:

- `apps/web/.env` **phải có cả `DATABASE_URL` và `DIRECT_URL`**, nếu thiếu `prisma validate`
  báo `P1012 Environment variable not found: DIRECT_URL`.
- `next build` đã tắt bước type-check/lint nội bộ (`apps/web/next.config.ts`) vì CI và
  `pnpm typecheck` đã đảm nhiệm; đừng bỏ `pnpm typecheck` khỏi quy trình.
- Trên Windows nếu `pnpm install` liên tục `ECONNRESET`, chạy với
  `$env:NODE_OPTIONS="--dns-result-order=ipv4first"` (ép DNS trả IPv4 trước).

## Báo lỗi bảo mật

Xem `SECURITY.md` — không mở public issue cho lỗ hổng.
