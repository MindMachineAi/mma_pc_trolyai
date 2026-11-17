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

## Báo lỗi bảo mật

Xem `SECURITY.md` — không mở public issue cho lỗ hổng.
