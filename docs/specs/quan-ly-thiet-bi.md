# Quản lý thiết bị: sửa tên, kết nối lại, thu hồi, xoá

## Mục tiêu
Mỗi PC đã tạo phải tự quản lý được ngay trên dashboard, không cần gõ API:
đổi tên hiển thị, cấp token mới + tải lại bộ cài (kết nối lại), thu hồi (giữ lịch sử),
xoá vĩnh viễn (thanh lý máy).

## Hiện trạng (đã đọc trong code)
- `apps/web/app/api/devices/route.ts`: `POST /api/devices` tạo thiết bị, trả token 1 lần
  (`generateDeviceToken` ở `apps/web/lib/tokens.ts`, DB chỉ lưu SHA-256).
- `apps/web/app/api/devices/[id]/route.ts` (trước spec này): chỉ có `DELETE` = thu hồi
  (`status = DISABLED` + huỷ lệnh `PENDING`/`SENT`). Không có cách đổi tên, không cấp lại token,
  không xoá cứng → thiết bị hỏng/cài lại Windows phải tạo bản ghi mới, lịch sử bị phân mảnh.
- `apps/web/components/device-card.tsx`: cả thẻ là một `Link`; `apps/web/app/(dashboard)/devices/[id]/page.tsx`
  chỉ hiển thị thông tin, không có thao tác.
- `apps/web/prisma/schema.prisma`: `Metric`, `Event`, `Insight`, `Command`, `HealthSnapshot` đều
  `onDelete: Cascade` theo `Device`; `Device` lưu `tokenHash` (unique) + `tokenPrefix`,
  nên cấp token mới chỉ là ghi đè `tokenHash` → token cũ hết hiệu lực ngay, không cần bảng token riêng.
- `apps/agent/api_client.py`: gửi token trong header; token sai/bị thu hồi → 401/403 và agent không gửi được metric.
- `docs/specs/tai-bo-cai-agent.md` mục "Không làm" ghi cấp lại token "là spec khác" → spec này chính là spec đó.

## Nguyên tắc bắt buộc
- Mọi route phải gọi `getSession()`; không có session → 401 `{ error: "unauthenticated" }`.
- Input validate bằng zod trong `apps/web/lib/validators.ts` (payload và query).
- Token mới chỉ trả về **một lần** trong response; không log, không lưu DB dạng thô.
- Thông báo lỗi/UI bằng tiếng Việt; mã lỗi API giữ tiếng Anh (`unauthenticated`, `not_found`,
  `invalid_payload`, `invalid_query`) để UI map sang câu tiếng Việt.
- Không thêm package npm, không đổi schema Prisma, không sửa `apps/agent/*.py`, `install.ps1`.
- Không tự tạo tag/Release.

## Việc cần làm
1. **`apps/web/lib/validators.ts`**
   - `createDeviceSchema`: `name` trim trước khi kiểm tra độ dài (2–60). `ownerLabel` ≤ 60.
   - `updateDeviceSchema`: `name` (2–60) và/hoặc `ownerLabel` (≤ 60), cả hai đều trim, bắt buộc có ít nhất một trường.
   - `deleteDeviceQuerySchema`: `purge` chỉ nhận `"true"`/`"false"` (không truyền = thu hồi).
2. **`apps/web/app/api/devices/[id]/route.ts`**
   - `PATCH`: đổi `name`/`ownerLabel`. Token, `status`, lịch sử giữ nguyên; không chạm agent đang chạy.
     Thiếu cả hai trường → 422 `invalid_payload`. Không tìm thấy → 404 `not_found`.
   - `DELETE`: mặc định = thu hồi như cũ (giữ lịch sử). `?purge=true` = xoá cứng thiết bị;
     dữ liệu con xoá theo cascade. Query sai → 422 `invalid_query`.
3. **`apps/web/app/api/devices/[id]/reconnect/route.ts`** (mới) — `POST`:
   - Sinh token mới (`generateDeviceToken`), ghi đè `tokenHash`/`tokenPrefix` (token cũ mất hiệu lực ngay),
     đặt `status = OFFLINE`, đánh dấu `FAILED` (lý do `token_rotated`) cho lệnh `PENDING`/`SENT`.
   - Trả `{ ok: true, token, device: { id, name } }`. Dùng được cả với thiết bị đã `DISABLED`
     (đây là cách duy nhất để dùng lại thiết bị đã thu hồi — không có nút "bật lại" riêng).
4. **`apps/web/components/device-manage.tsx`** (mới, `"use client"`) — 4 thao tác, xác nhận 2 bước với
   thu hồi/xoá, `variant: "card" | "page"`:
   - Sửa tên: form inline, gọi `PATCH`, xong thì `router.refresh()`.
   - Kết nối lại: gọi `POST .../reconnect`, hiện token + nút Copy + nút **Tải bộ cài**
     (`buildInstallerCmd`/`installerFileName` từ `apps/web/lib/agent-installer.ts`, URL = `window.location.origin`).
     Khi đang hiện token: khoá các nút thao tác khác và hỏi xác nhận trước khi đóng bảng,
     vì token chỉ hiện một lần.
   - Thu hồi: `DELETE` (không purge); thiết bị đã `DISABLED` thì ẩn nút này.
   - Xoá vĩnh viễn: `DELETE ?purge=true`; ở trang chi tiết thì quay về `/dashboard` sau khi xoá.
5. **`apps/web/components/device-card.tsx`**: nội dung thẻ nằm trong `Link`, hàng nút `DeviceManage`
   đặt ngoài `Link` (không lồng phần tử bấm được). Thiết bị `DISABLED` có badge "đã thu hồi".
6. **`apps/web/app/(dashboard)/devices/[id]/page.tsx`**: thêm `DeviceManage variant="page"`.
7. **`docs/API.md`**: ghi `PATCH`, `DELETE ?purge=true`, `POST .../reconnect`.
   **`docs/AGENT-INSTALL.md`**: thêm luồng "cấp lại token qua Kết nối lại".

## Biến môi trường
Không thêm biến mới.

## Không làm
- Không thêm lệnh vào `ALLOWED_COMMANDS`, không đổi `apps/agent/executor.py`.
- Không lưu token vào localStorage/sessionStorage, không gửi token lên server lần thứ hai.
- Không xoá mềm (soft delete), không thêm bảng audit log.
- Không đổi cơ chế xác thực agent (vẫn header token + SHA-256 trong DB).

## Quyết định đã chốt
- Giữ chung một PR với việc sửa báo lỗi bộ cài (`fix(web): bo cai bao ro file nao tai that bai`) — người dùng duyệt.
- "Kết nối lại" là cách duy nhất dùng lại thiết bị đã `DISABLED`; không thêm nút "bật lại" riêng.
- "Xoá vĩnh viễn" cho phép ở mọi trạng thái, bảo vệ bằng hộp xác nhận riêng (không cần thu hồi trước).
  Phương án thay thế "chỉ cho xoá khi đã thu hồi" được ghi nhận nhưng chưa áp dụng.

## Nghiệm thu
1. `pnpm --filter web prisma:generate`, `pnpm --filter web prisma:validate`, `pnpm typecheck`, `pnpm build` đều đạt.
2. Dashboard → thẻ thiết bị có 4 nút; bấm **Sửa tên**, nhập tên có dấu cách đầu/cuối → lưu xong tên đã trim.
3. **Kết nối lại** → hiện token mới; copy được; tải được `cai-dat-pca-<slug>.cmd` chứa token đó.
   Đóng bảng khi chưa xác nhận thì có hộp thoại cảnh báo; đóng rồi mở lại thì không còn token cũ.
4. Agent đang chạy bằng token cũ: sau khi kết nối lại, lần gửi kế tiếp bị 401 (kiểm bằng log agent).
5. **Thu hồi** → thiết bị `DISABLED`, badge "đã thu hồi", agent nhận 403; lịch sử metric vẫn còn.
6. **Xoá vĩnh viễn** → thiết bị biến khỏi danh sách, `Metric`/`Event`/`Insight`/`Command` của nó cũng mất.
7. `DELETE /api/devices/{id}?purge=abc` trả 422 `invalid_query`, không xoá gì.
8. Gọi API khi chưa đăng nhập → 401 `unauthenticated` với cả 3 route.

## Người dùng cần chuẩn bị
- Một thiết bị thật đang `ONLINE` để thử mục 3–5, và chấp nhận mất dữ liệu của thiết bị dùng thử mục 6.
- Sau khi merge: không cần tag mới, tính năng chỉ chạy trên web (agent không đổi).
