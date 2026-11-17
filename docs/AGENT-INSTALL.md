# Cài agent trên laptop

## 0. Chuẩn bị

- Windows 10/11 x64.
- Dashboard đã deploy và `/api/health` trả `ok: true`.
- Bạn đã bấm **Thêm thiết bị** trên dashboard và copy token `pca_…` (chỉ hiện 1 lần).

## 1. Cài nhanh bằng nút "Tải bộ cài" (khuyến nghị)

1. Trên dashboard bấm **Thêm thiết bị** → nhập tên → **Tạo thiết bị & lấy token**.
2. Bấm **Tải bộ cài** → nhận file `cai-dat-pca-<ten-thiet-bi>.cmd` (đã nhúng sẵn API URL + token).
3. Copy file sang laptop mới → chuột phải → **Run as administrator**.
   Windows/trình duyệt có thể cảnh báo file `.cmd`: chọn *Giữ lại* / *More info → Run anyway*.
4. Script tự làm hết: xin quyền UAC → tải `agent.exe`, `install.ps1`, `SHA256SUMS.txt` từ GitHub Release mới nhất
   → kiểm tra SHA-256 → dừng task cũ (nếu có) → chạy `install.ps1` → xoá thư mục tạm → in
   `Cai dat thanh cong` → xoá chính file `.cmd`.
5. Sau ~2 phút, thiết bị chuyển **Đang online** trên dashboard.

Lưu ý:

- File `.cmd` chứa token: chỉ chuyển qua kênh tin cậy, và xoá ngay nếu cài lỗi mà không dùng nữa.
- Cài lỗi thì file `.cmd` **được giữ lại** để chạy lại; xem thông báo đỏ trong cửa sổ console.
- Lỗi `Khong tai duoc install.ps1 tu GitHub Release (HTTP 404 …)` = bản phát hành mới nhất chưa đính kèm
  đủ 4 file. Cách xử lý: cài thủ công theo mục 2 (dùng token đã lưu), hoặc chờ Release mới đủ file (mục 5).
- Nút tải chỉ sinh file cho thiết bị vừa tạo (token chỉ hiện 1 lần). Thiết bị đã có: bấm **Kết nối lại** trên thẻ
  thiết bị (hoặc trang chi tiết) → cấp token mới + tải bộ cài mới; agent đang chạy bằng token cũ sẽ bị từ chối
  (`401`) cho tới khi cài lại.
- Các nút quản lý trên mỗi thiết bị: **Sửa tên** (chỉ đổi tên hiển thị) · **Kết nối lại** (token mới + bộ cài) ·
  **Thu hồi** (ngắt kết nối, giữ lịch sử) · **Xoá** (xoá vĩnh viễn thiết bị cùng metric/cảnh báo).

## 2. Cài thủ công (phương án dự phòng)

1. Tải `agent.exe` + `install.ps1` + `SHA256SUMS.txt` từ GitHub Release (tag `agent-v*`) vào cùng một thư mục:
   <https://github.com/MindMachineAi/mma_pc_trolyai/releases/latest>

   Hoặc tải trực tiếp:
   ```powershell
   $base = 'https://github.com/MindMachineAi/mma_pc_trolyai/releases/latest/download'
   Invoke-WebRequest "$base/agent.exe"       -OutFile .\agent.exe
   Invoke-WebRequest "$base/install.ps1"     -OutFile .\install.ps1
   Invoke-WebRequest "$base/SHA256SUMS.txt"  -OutFile .\SHA256SUMS.txt
   ```

   Kiểm tra file tải về (tuỳ chọn nhưng nên làm):
   ```powershell
   Get-FileHash .\agent.exe, .\install.ps1 -Algorithm SHA256 | Format-Table Hash, Path
   Get-Content .\SHA256SUMS.txt
   ```

2. Mở **PowerShell as Administrator** tại thư mục đó:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 `
  -ApiUrl "https://your-app.vercel.app" `
  -Token "pca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

3. Script sẽ:
   - copy agent vào `C:\ProgramData\PCtroLyAI\`
   - ghi `agent-config.json` (chứa device token) và chặn quyền thư mục
   - đăng ký task `PCtroLyAI-Agent` chạy bằng SYSTEM khi khởi động
4. Sau ~2 phút, thiết bị chuyển **Đang online** trên dashboard.

Nếu máy đã cài agent từ trước, dừng task trước khi copy đè (nút **Tải bộ cài** tự làm bước này):

```powershell
Stop-ScheduledTask -TaskName 'PCtroLyAI-Agent'
```

## 3. Kiểm tra

```powershell
Get-ScheduledTask -TaskName 'PCtroLyAI-Agent' | Get-ScheduledTaskInfo
Get-Content 'C:\ProgramData\PCtroLyAI\logs\agent.log' -Tail 20
```

Log tốt trông như sau:

```
2026-01-01 10:00:03,120 INFO agent: PC Trợ Lý AI agent v0.1.0 → https://your-app.vercel.app (chu kỳ 60s)
2026-01-01 10:00:05,900 INFO agent: ingest ok · health=78 · cảnh báo mới=[]
```

Nếu log báo `401 invalid_token` → token sai hoặc thiết bị đã bị thu hồi.
Nếu `kết nối thất bại` → kiểm tra firewall/proxy của mạng.

## 4. Chạy thử bằng Python (không cài task)

```powershell
cd apps\agent
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py --api-url "https://your-app.vercel.app" --token "pca_..." --once
```

`--once` gửi đúng 1 mẫu rồi thoát — dùng để debug nhanh. Bỏ `--once` để chạy vòng lặp.

## 5. Build lại exe

```powershell
cd apps\agent
pip install -r requirements.txt pyinstaller
pyinstaller --clean --noconfirm build.spec
# kết quả: apps\agent\dist\agent.exe
```

Hoặc đẩy tag `agent-v0.1.0` lên GitHub → workflow `Build agent (Windows exe)` tự build và
đính kèm file vào Release.

Release **phải có đủ 4 file** `agent.exe`, `install.ps1`, `uninstall.ps1`, `SHA256SUMS.txt`. Nút
**Tải bộ cài** tải 3 file `agent.exe`, `install.ps1`, `SHA256SUMS.txt` — thiếu file nào là báo lỗi
`HTTP 404` kèm tên file đó.

## 6. Gỡ cài đặt

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -KeepLogs   # giữ log để điều tra
```

Sau đó vào dashboard → trang thiết bị → **Thu hồi** (gọi `DELETE /api/devices/{id}`) để
vô hiệu hóa token còn sót.

## 7. Lệnh bảo trì được hỗ trợ

| `type` | Việc agent làm | Quyền |
| --- | --- | --- |
| `clean_temp` | Xoá file tạm cũ hơn N ngày trong `%TEMP%` và `C:\Windows\Temp` | Administrator |
| `flush_dns` | `ipconfig /flushdns` | User thường |
| `battery_report` | `powercfg /batteryreport` → `C:\ProgramData\PCtroLyAI\reports\battery-report.html` | Administrator |
| `trim` | `Optimize-Volume -DriveLetter C -ReTrim` | Administrator |
| `sfc_scan` | `sfc /scannow` chạy nền, không chặn heartbeat | Administrator |

`clean_temp` mặc định **dry-run** (chỉ báo dung lượng); chỉ xoá thật khi `params.confirm = true`
— UI đã gửi sẵn giá trị này khi bạn bấm nút.

Ngoài 5 lệnh trên, agent **từ chối** mọi `type` khác (kể cả khi server bị xâm nhập).

## 8. Lưu ý vận hành

- Token lưu trong `C:\ProgramData\PCtroLyAI\agent-config.json`, ACL chỉ SYSTEM + Administrators.
- Agent không mở port, không nhận kết nối vào — chỉ gọi ra ngoài.
- Máy sleep: agent không gửi được → sau 5 phút dashboard chuyển OFFLINE (bình thường).
- Đổi dashboard URL: sửa `apiUrl` trong config rồi `Restart-Service`/`Restart-ScheduledTask`:

```powershell
Stop-ScheduledTask -TaskName 'PCtroLyAI-Agent'
Start-ScheduledTask -TaskName 'PCtroLyAI-Agent'
```
