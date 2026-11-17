# Agent — PC Trợ Lý AI

Agent chạy trên laptop Windows, làm 3 việc:

1. Thu thập telemetry (CPU, RAM, ổ đĩa, pin, nhiệt độ, top process) mỗi 60 giây.
2. `POST /api/ingest` kèm device token → nhận lại danh sách lệnh đang chờ.
3. Thực thi lệnh **chỉ khi** thuộc allowlist trong `executor.py`, rồi báo kết quả.

Agent **không** có shell từ xa, không upload file, không đọc dữ liệu người dùng — chỉ gửi số liệu tổng hợp.

## Chạy thử (không cần cài)

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py --api-url "https://your-app.vercel.app" --token "pca_..." --once
```

`--once` gửi đúng 1 lần để kiểm tra token/URL. Nếu log ghi `ingest ok` và dashboard báo online → OK.

## Cài chính thức

```powershell
# 1) Build exe (máy dev, cần pyinstaller)
pip install pyinstaller
pyinstaller --clean --noconfirm build.spec      # -> dist/agent.exe

# 2) Trên laptop đích, mở PowerShell as Administrator
powershell -ExecutionPolicy Bypass -File .\install.ps1 `
  -ApiUrl "https://your-app.vercel.app" `
  -Token "pca_..."
```

Script sẽ tạo task `PCtroLyAI-Agent` chạy bằng SYSTEM khi khởi động, ghi config vào
`C:\ProgramData\PCtroLyAI\agent-config.json` và chặn quyền truy cập thư mục đó.

Gỡ cài đặt: `powershell -ExecutionPolicy Bypass -File .\uninstall.ps1`

## Cấu hình

Ưu tiên: tham số CLI → biến môi trường (`PCA_API_URL`, `PCA_TOKEN`, `PCA_INTERVAL`) → file JSON.

| Trường | Ý nghĩa |
| --- | --- |
| `apiUrl` | URL dashboard, không có dấu `/` cuối |
| `token` | Device token (`pca_...`) — chỉ hiện 1 lần khi tạo thiết bị |
| `intervalSec` | Chu kỳ gửi, tối thiểu 15 |
| `logDir` | Thư mục log (rotating 2 MB × 3) |

## Ghi chú kỹ thuật

- Nhiệt độ CPU: `psutil` không đọc được trên Windows (cần driver như LibreHardwareMonitor). Khi `tempCpu = null`, dashboard hiển thị "N/A" và rules engine bỏ qua kiểm tra nhiệt độ.
- Độ chai pin: đọc qua CIM (`BatteryStaticData` / `BatteryFullChargedCapacity`), cache 1 giờ.
- `sfc_scan` chạy nền (`start /min sfc /scannow`) để không làm gián đoạn heartbeat.
- `clean_temp` mặc định **dry-run**; chỉ xoá thật khi `params.confirm = true` (UI gửi `true`).
