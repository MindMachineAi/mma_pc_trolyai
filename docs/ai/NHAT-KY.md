# Nhật ký dự án

Ghi lại việc đã làm theo từng buổi để phiên sau đọc là tiếp tục được. **Mới nhất ở trên.**
Mỗi mục gồm: Đã xong · Quyết định · Đang mở · Mai làm.

---

## 2026-11-18 (khuya 17/11 → rạng sáng 18/11)

### Đã xong
- **PR #13 (đã merge vào `main`)**: tính năng quản lý thiết bị — sửa tên, kết nối lại, thu hồi, xoá.
  Gồm `apps/web/components/device-manage.tsx`, `POST /api/devices/{id}/reconnect`,
  `PATCH`/`DELETE ?purge=true` ở `api/devices/[id]/route.ts`, sửa thẻ thiết bị. Kèm `9e3769f`
  (bộ cài báo rõ file nào tải thất bại).
- **PR #14 (đang mở, nhánh `feat/quan-ly-thiet-bi`)**: phần còn lại sau review
  - `docs/specs/quan-ly-thiet-bi.md` (mới) — đặc tả cho phần chạm token/xoá cứng.
  - `docs/specs/tai-bo-cai-agent.md` — file spec của nút "Tải bộ cài" (chưa từng vào `main`).
  - `validators.ts`: `createDeviceSchema.name` trim; thêm `deleteDeviceQuerySchema`.
  - `api/devices/[id]/route.ts`: validate `?purge` bằng zod → sai trả `422 invalid_query`.
  - `device-manage.tsx`: khoá 4 nút khi đang hiện token, `close()` hỏi xác nhận, thông báo `invalid_query`.
  - `device-card.tsx`: bỏ dòng trống cuối file; `docs/API.md`: ghi `invalid_query`.
  - Link: https://github.com/MindMachineAi/mma_pc_trolyai/pull/14
    Preview: https://mma-pc-trolyai-git-feat-quan-ly-thiet-bi-mindmachienai.vercel.app
- **Review Claude Code (Opus) 2 vòng**: vòng 1 CHƯA ĐẠT (thiếu spec, `?purge` chưa validate, mất token
  im lặng) → sửa hết; vòng 2 **ĐẠT** ("PHẢI SỬA: Không có", "CẦN QUYẾT ĐỊNH: Không có").
- **Kiểm tra đã pass**: `prisma:generate` 0 · `prisma:validate` 0 · `pnpm typecheck` 0 · `pnpm build` 0.
- **PR #15**: chính file nhật ký này (`docs/ai/NHAT-KY.md`) — 1 file, không đụng code.

### Quyết định đã chốt
- Giữ chung PR: bản sửa báo lỗi bộ cài + quản lý thiết bị (người dùng duyệt).
- "Kết nối lại" là cách duy nhất dùng lại thiết bị `DISABLED`; không thêm nút "bật lại" riêng.
- "Xoá vĩnh viễn" cho phép ở mọi trạng thái, bảo vệ bằng hộp xác nhận riêng (chưa áp dụng phương án
  "chỉ cho xoá khi đã thu hồi").
- Cấp token mới = ghi đè `Device.tokenHash` → token cũ hết hiệu lực ngay, không cần bảng token riêng.

### Đang mở / cần biết
- Release `agent-v0.1.0` chỉ có `agent.exe`, thiếu `install.ps1` + `SHA256SUMS.txt` → bộ cài tải về sẽ 404
  ở file thứ 2. Chưa tạo `agent-v0.1.1`.
- Chưa chạy thử trên PC Windows thật: cấp lại token (agent cũ phải 401), thu hồi (403), xoá (cascade).
- Vercel chưa ghim region `sin1`; GitHub Actions chưa có secrets `APP_URL`, `CRON_SECRET`.

### Mai làm (theo thứ tự)
1. Merge PR #14 (nếu review xong), xoá nhánh sau khi merge.
2. Tạo tag `agent-v0.1.1` để workflow đính đủ 4 file vào Release; tải bộ cài trên một laptop khác và cài thử.
3. Nghiệm thu mục 3–6 của `docs/specs/quan-ly-thiet-bi.md` trên một thiết bị đang `ONLINE`.
4. Ghim region Vercel `sin1`; thêm secrets `APP_URL`, `CRON_SECRET` cho Actions.
5. Kiểm tra `cron-analyze` chạy đúng sau khi có secret mới.

---

## Ghi chú kỹ thuật (dùng lại mỗi phiên)

- **Repo làm việc**: `C:\dev\mma_pc_trolyai` (bản clone local). KHÔNG làm trong thư mục Google Drive — Drive khoá
  file làm `pnpm install` lỗi ENOENT.
- **PATH Node**: terminal VS Code có thể thiếu PATH; gọi qua `cmd /c` với
  `set "PATH=C:\Program Files\nodejs;C:\Users\Admin\AppData\Roaming\npm;%PATH%"`.
- **Review bằng `claude` CLI**: treo nếu không có stdin → thêm `< nul`, và dùng
  `--output-format stream-json --verbose` rồi đọc dòng cuối có `"type":"result"`.
  Spec chạm "Code nhạy cảm" → `--model opus`.
- **Không có `gh` CLI**: tạo PR/bình luận qua GitHub REST API (`Invoke-RestMethod`), token lấy bằng
  `git credential-manager get` (protocol=https, host=github.com). Gửi JSON bằng `-InFile` (đừng truyền
  hashtable đã `ConvertTo-Json` qua `-Body`, GitHub sẽ nhận sai kiểu).
- **Xem diff so với main**: `git --no-pager diff --stat origin/main...HEAD` sau `git fetch origin`.
