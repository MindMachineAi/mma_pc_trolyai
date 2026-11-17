# Nút "Tải bộ cài" cho thiết bị mới

## Mục tiêu
Sau khi tạo thiết bị, admin bấm **Tải bộ cài** để nhận 1 file `.cmd` đã nhúng sẵn API URL + token.
Trên laptop mới chỉ cần chuột phải file → Run as administrator là cài xong agent, không phải gõ lệnh.

## Hiện trạng (đã đọc trong code)
- `apps/web/components/add-device.tsx`: form tạo thiết bị gọi `POST /api/devices`, nhận `token` (chỉ 1 lần),
  hiện token + nút Copy + lệnh cài mẫu. URL trong lệnh lấy từ prop `appUrl`.
- `apps/web/app/(dashboard)/dashboard/page.tsx` dòng ~66: `appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""`,
  truyền vào `<AddDevice appUrl={appUrl} />` (2 chỗ, dòng ~78 và ~109). Không file nào khác dùng `NEXT_PUBLIC_APP_URL`.
- `apps/web/lib/tokens.ts`: token có dạng `pca_` + 64 ký tự hex. DB chỉ lưu SHA-256.
- `apps/agent/install.ps1`: tham số `-ApiUrl`, `-Token`; tìm `agent.exe` cùng thư mục với script;
  copy vào `C:\ProgramData\PCtroLyAI`, ghi config, đăng ký task `PCtroLyAI-Agent` (SYSTEM), rồi start task.
  Không dừng task cũ trước khi copy, nên cài lại trên máy đang chạy agent sẽ lỗi "file in use".
- `.github/workflows/build-agent.yml`: khi push tag `agent-v*` chỉ đính kèm `agent.exe` vào Release.
  Release `agent-v0.1.0` hiện chỉ có `agent.exe`, KHÔNG có `install.ps1`, nên link
  `releases/latest/download/install.ps1` trong `docs/AGENT-INSTALL.md` đang trả 404.

## Nguyên tắc bắt buộc
- Token chỉ tồn tại trong trình duyệt (state hiện có) và trong file `.cmd` tải về. KHÔNG gửi token lên server lần nữa,
  KHÔNG lưu vào localStorage, KHÔNG log ra console.
- Không thêm API route mới, không đổi schema Prisma, không thêm package npm.
- Trước khi nhúng vào file, kiểm tra:
  - token khớp `^pca_[a-f0-9]{64}$`;
  - URL khớp `^https://[A-Za-z0-9.-]+(:\d+)?$` hoặc `^http://localhost(:\d+)?$`.
  Không khớp thì không cho tải và báo lỗi tiếng Việt.
- Chữ trong file `.cmd` và PowerShell nhúng dùng tiếng Việt KHÔNG DẤU (tránh lỗi codepage console), giống `install.ps1`.
- File `.cmd` dùng xuống dòng CRLF.
- Review bằng `--model opus` (chạm token thiết bị và `install.ps1`).

## Việc cần làm
1. **`apps/web/components/add-device.tsx`**
   - Bỏ prop `appUrl`. URL cài đặt = `window.location.origin` (lấy trong lúc bấm nút, không lấy lúc render).
   - Lệnh cài mẫu đang hiển thị cũng dùng `window.location.origin` thay cho `appUrl || "https://your-app.vercel.app"`.
   - Thêm nút **Tải bộ cài** (icon `Download` của lucide-react) cạnh nút Copy, chỉ hiện khi đã có token.
   - Bấm nút → tạo nội dung `.cmd` (mục 2) → tải về bằng `Blob` + `URL.createObjectURL` + thẻ `<a download>`,
     rồi `URL.revokeObjectURL`. Tên file: `cai-dat-pca-<slug>.cmd`. `<slug>` lấy từ tên thiết bị:
     bỏ dấu tiếng Việt, chữ thường, ký tự khác `[a-z0-9]` thành `-`, gộp `-` liên tiếp, tối đa 40 ký tự,
     rỗng thì dùng `thiet-bi`.
   - Dưới nút, thêm đoạn hướng dẫn ngắn (tiếng Việt có dấu):
     "Copy file sang laptop mới → chuột phải → Run as administrator. Trình duyệt/Windows có thể cảnh báo file .cmd,
     chọn Giữ lại / More info → Run anyway. File chứa token: xoá sau khi cài (script tự xoá khi cài thành công)."
2. **Tạo `apps/web/lib/agent-installer.ts`** (thuần TypeScript, không import server-only), export
   `buildInstallerCmd(apiUrl: string, token: string): string` và `installerFileName(deviceName: string): string`.
   - Hàm `buildInstallerCmd` kiểm tra định dạng theo "Nguyên tắc bắt buộc"; sai thì `throw new Error(...)`.
   - Nội dung `.cmd` sinh ra phải làm đúng các bước sau:
     a. Nếu chưa có quyền admin (kiểm bằng `net session >nul 2>&1`) thì tự mở lại chính nó với quyền admin
        (`powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"`) rồi thoát.
        Đường dẫn file có thể chứa dấu cách.
     b. Chạy PowerShell (`-NoProfile -ExecutionPolicy Bypass`) với script nhúng ngay trong file `.cmd`.
        Ví dụ: phần PowerShell nằm sau một dòng đánh dấu, cmd đọc lại chính file đó rồi chạy phần sau dòng đánh dấu.
        Không ghi script PowerShell ra file tạm. Mọi bước dưới đây (c–i) đều chạy trong PowerShell này.
     c. Đặt `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`.
     d. Tạo thư mục tạm mới trong `$env:TEMP`, tải `agent.exe`, `install.ps1`, `SHA256SUMS.txt` từ
        `https://github.com/MindMachineAi/mma_pc_trolyai/releases/latest/download/<file>`
        (`Invoke-WebRequest -UseBasicParsing`).
     e. So SHA-256 của `agent.exe` và `install.ps1` với `SHA256SUMS.txt`. Lệch thì báo lỗi, xoá thư mục tạm, dừng.
     f. Nếu task `PCtroLyAI-Agent` đã tồn tại, gọi `Stop-ScheduledTask` trước, để copy đè `agent.exe` không lỗi.
     g. Chạy `install.ps1 -ApiUrl <url> -Token <token>` trong thư mục tạm.
     h. Luôn xoá thư mục tạm (dùng `finally`). Thành công thì in "Cai dat thanh cong" rồi tự xoá file `.cmd`.
        Lỗi thì in thông báo lỗi và KHÔNG xoá `.cmd`, để chạy lại được.
     i. Kết thúc bằng `pause`, để cửa sổ không tự đóng.
3. **`apps/web/app/(dashboard)/dashboard/page.tsx`**: bỏ biến `appUrl`, đổi 2 chỗ thành `<AddDevice />`.
4. **`.github/workflows/build-agent.yml`**: bước tạo Release đính kèm thêm `apps/agent/install.ps1`,
   `apps/agent/uninstall.ps1`, và `SHA256SUMS.txt`. File `SHA256SUMS.txt` sinh trong job: mỗi dòng
   `<sha256 hex thường>  <tên file>` cho `agent.exe`, `install.ps1`, `uninstall.ps1`.
   Chú ý: `.gitattributes` có thể đổi xuống dòng, nên hash phải tính trên đúng file được upload.
5. **`docs/AGENT-INSTALL.md`**: mục 1 thêm cách mới (nút Tải bộ cài) làm cách khuyến nghị;
   giữ cách thủ công làm phương án dự phòng.

## Biến môi trường
Không thêm biến mới. `NEXT_PUBLIC_APP_URL` vẫn giữ trong `.env.example`, nhưng `AddDevice` không dùng nữa.

## Không làm
- Không làm nút tải bộ cài cho thiết bị đã tạo trước đó. Token cũ không lấy lại được; cấp lại token là spec khác.
- Không sửa `apps/agent/*.py`, `install.ps1`, `uninstall.ps1`.
- Không ký số file `.cmd`/`.exe`, không đổi sang `.msi`.
- Không tự tạo tag hay Release (người dùng làm).

## Nghiệm thu
1. `pnpm --filter web prisma:generate`, `pnpm typecheck` và `pnpm build` đều đạt.
2. Dashboard → Thêm thiết bị → tạo xong thì thấy nút **Tải bộ cài**. Lệnh mẫu hiển thị URL đúng domain đang mở,
   không còn `your-app` hay `localhost` trên production.
3. Tải về được file `cai-dat-pca-<slug>.cmd`. Mở bằng Notepad thấy đúng URL + token, xuống dòng CRLF.
4. Tên thiết bị "Dell Inspiron 15 - phòng kế toán" cho ra file `cai-dat-pca-dell-inspiron-15-phong-ke-toan.cmd`.
5. Sau khi có Release mới (xem phần người dùng chuẩn bị), trang Release có đủ `agent.exe`, `install.ps1`,
   `uninstall.ps1`, `SHA256SUMS.txt`.
6. Trên một laptop Windows thật: nhấp đúp file `.cmd` thì hiện hộp UAC; cài xong in "Cai dat thanh cong",
   file `.cmd` tự biến mất, khoảng 2 phút sau thiết bị **Đang online** trên dashboard.
7. Chạy lại một file `.cmd` mới (token mới) trên máy đã có agent: cài đè thành công, không lỗi "file in use".
8. Sửa 1 ký tự trong `SHA256SUMS.txt` (thử bằng cách trỏ tạm sang file sai): script báo lỗi hash và dừng,
   không cài. Bước này Cline kiểm bằng cách đọc code; người dùng không bắt buộc thử.

## Người dùng cần chuẩn bị
- Sau khi merge PR: tạo tag `agent-v0.1.1` (GitHub → Releases → Draft new release → tag `agent-v0.1.1` → Publish,
  hoặc `git tag agent-v0.1.1; git push origin agent-v0.1.1`). Workflow sẽ build và đính kèm đủ 4 file.
  Thiếu bước này thì bộ cài tải về sẽ lỗi 404 khi lấy `install.ps1`.
- Một laptop Windows 10/11 để thử nghiệm thu mục 6–7.
