// Sinh file .cmd tự cài agent cho laptop mới: nhúng sẵn API URL + device token.
// Thuần TypeScript (không import server-only) — chạy trong trình duyệt, token không rời khỏi máy người dùng.
//
// Chữ trong file .cmd và PowerShell nhúng KHÔNG DẤU (giống install.ps1) để tránh lỗi codepage console.

const TOKEN_PATTERN = /^pca_[a-f0-9]{64}$/;
const HTTPS_URL_PATTERN = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/;
const LOCAL_URL_PATTERN = /^http:\/\/localhost(:\d+)?$/;

const RELEASE_BASE = "https://github.com/MindMachineAi/mma_pc_trolyai/releases/latest/download";
const PS_MARKER = "#---POWERSHELL---";
const MAX_SLUG_LENGTH = 40;
const FALLBACK_SLUG = "thiet-bi";

/** Bỏ dấu tiếng Việt, chữ thường, ký tự khác [a-z0-9] thành "-", gộp "-", tối đa 40 ký tự. */
function slugifyDeviceName(deviceName: string): string {
  const slug = deviceName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || FALLBACK_SLUG;
}

/** Tên file bộ cài: cai-dat-pca-<slug>.cmd */
export function installerFileName(deviceName: string): string {
  return `cai-dat-pca-${slugifyDeviceName(deviceName)}.cmd`;
}

function batchLines(): string[] {
  return [
    "@echo off",
    "setlocal",
    "title PC Tro Ly AI - Cai dat agent",
    'set "PCA_INSTALLER_FILE=%~f0"',
    // "elevated" = da duoc mo lai bang UAC, khong mo lai lan nua (tranh lap vo han).
    'if /i "%~1"=="elevated" goto :run',
    // Kiem tra quyen admin: net session, du phong fltmc (khi dich vu Server bi tat).
    "net session >nul 2>&1",
    "if not errorlevel 1 goto :run",
    "fltmc >nul 2>&1",
    "if not errorlevel 1 goto :run",
    "echo Dang mo lai voi quyen Administrator...",
    // Dung bien moi truong thay vi chen duong dan: an toan ca khi duong dan co dau nhay don.
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:PCA_INSTALLER_FILE -ArgumentList \'elevated\' -Verb RunAs"',
    "exit /b 0",
    ":run",
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:PCA_INSTALLER_FILE); $m=\'' +
      PS_MARKER +
      "'; $i=$t.LastIndexOf($m); if ($i -lt 0) { Write-Host 'Khong tim thay phan PowerShell trong file .cmd.'; exit 1 }; & ([scriptblock]::Create($t.Substring($i + $m.Length)))",
    'set "PCA_EXIT=%errorlevel%"',
    "echo.",
    "pause",
    'if not "%PCA_EXIT%"=="0" exit /b %PCA_EXIT%',
    '(goto) 2>nul & del "%~f0"',
    "exit /b 0",
    PS_MARKER,
  ];
}

function powershellLines(apiUrl: string, token: string): string[] {
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    "",
    "function Write-Step([string]$message) { Write-Host ('==> ' + $message) -ForegroundColor Cyan }",
    "",
    `$apiUrl = '${apiUrl}'`,
    `$token = '${token}'`,
    `$releaseBase = '${RELEASE_BASE}'`,
    "$tempDir = Join-Path $env:TEMP ('pca-bo-cai-' + [guid]::NewGuid().ToString('N').Substring(0, 8))",
    "$exitCode = 1",
    "",
    "try {",
    "    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null",
    "    foreach ($name in @('agent.exe', 'install.ps1', 'SHA256SUMS.txt')) {",
    "        Write-Step ('Dang tai ' + $name)",
    "        try {",
    "            Invoke-WebRequest -Uri ($releaseBase + '/' + $name) -OutFile (Join-Path $tempDir $name) -UseBasicParsing",
    "        } catch {",
    "            $status = $null",
    "            try { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } } catch { $status = $null }",
    "            $detail = if ($status) { 'HTTP ' + $status } else { $_.Exception.Message }",
    "            if ($status -eq 404) { $detail = $detail + ' - ban phat hanh moi nhat thieu file nay' }",
    "            elseif ($status -eq 403 -or $status -eq 429) { $detail = $detail + ' - GitHub dang chan IP/mang, doi mang roi thu lai' }",
    "            throw ('Khong tai duoc ' + $name + ' tu GitHub Release (' + $detail + '). Kiem tra mang, hoac cai thu cong theo docs/AGENT-INSTALL.md muc 2.')",
    "        }",
    "    }",
    "",
    "    Write-Step 'Kiem tra SHA-256'",
    "    $expected = @{}",
    "    foreach ($line in Get-Content -LiteralPath (Join-Path $tempDir 'SHA256SUMS.txt')) {",
    "        if ($line -match '^\\s*([0-9a-fA-F]{64})\\s+\\*?(\\S+)\\s*$') { $expected[$Matches[2]] = $Matches[1].ToLowerInvariant() }",
    "    }",
    "    foreach ($name in @('agent.exe', 'install.ps1')) {",
    "        if (-not $expected.ContainsKey($name)) { throw ('SHA256SUMS.txt thieu ' + $name) }",
    "        $actual = (Get-FileHash -LiteralPath (Join-Path $tempDir $name) -Algorithm SHA256).Hash.ToLowerInvariant()",
    "        if ($actual -ne $expected[$name]) { throw ('Sai SHA-256 cua ' + $name + ' - file tai ve bi loi, hay tai lai bo cai.') }",
    "    }",
    "",
    "    Write-Step 'Dung agent cu (neu co)'",
    "    $existing = Get-ScheduledTask -TaskName 'PCtroLyAI-Agent' -ErrorAction SilentlyContinue",
    "    if ($existing) { Stop-ScheduledTask -TaskName 'PCtroLyAI-Agent' -ErrorAction SilentlyContinue }",
    "    $agentExe = Join-Path $env:ProgramData 'PCtroLyAI\\agent.exe'",
    "    for ($attempt = 1; $attempt -le 10; $attempt++) {",
    "        $leftover = @(Get-Process -Name 'agent' -ErrorAction SilentlyContinue | Where-Object {",
    "            try { $_.Path -eq $agentExe } catch { $false }",
    "        })",
    "        if ($leftover.Count -eq 0) { break }",
    "        $leftover | Stop-Process -Force -ErrorAction SilentlyContinue",
    "        Start-Sleep -Seconds 1",
    "    }",
    "",
    "    Write-Step 'Cai dat agent'",
    "    & (Join-Path $tempDir 'install.ps1') -ApiUrl $apiUrl -Token $token",
    "",
    "    Write-Host ''",
    "    Write-Host 'Cai dat thanh cong. Khoang 2 phut sau thiet bi se hien Dang online tren dashboard.' -ForegroundColor Green",
    "    $exitCode = 0",
    "} catch {",
    "    Write-Host ''",
    "    Write-Host ('Cai dat that bai: ' + $_.Exception.Message) -ForegroundColor Red",
    "    Write-Host 'File .cmd duoc giu lai de chay lai sau khi xu ly loi.' -ForegroundColor Yellow",
    "    $exitCode = 1",
    "} finally {",
    "    if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue }",
    "}",
    "",
    "exit $exitCode",
  ];
}

/**
 * Nội dung file .cmd tự cài agent (CRLF, tiếng Việt không dấu).
 * Kiểm tra token + URL trước khi nhúng; sai định dạng thì throw để UI báo lỗi.
 */
export function buildInstallerCmd(apiUrl: string, token: string): string {
  const url = apiUrl.trim();
  const deviceToken = token.trim();

  if (!TOKEN_PATTERN.test(deviceToken)) {
    throw new Error("Token thiết bị không hợp lệ (phải là pca_ + 64 ký tự hex). Hãy tạo lại thiết bị.");
  }
  if (!HTTPS_URL_PATTERN.test(url) && !LOCAL_URL_PATTERN.test(url)) {
    throw new Error("Địa chỉ dashboard không hợp lệ: chỉ hỗ trợ https://<tên-miền> hoặc http://localhost.");
  }

  return [...batchLines(), ...powershellLines(url, deviceToken)].join("\r\n") + "\r\n";
}
