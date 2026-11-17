<#
.SYNOPSIS
    Cai agent PC Tro Ly AI thanh Windows Scheduled Task (chay bang SYSTEM khi may khoi dong).

.DESCRIPTION
    - Copy agent.exe (hoac source Python neu chua build) vao C:\ProgramData\PCtroLyAI
    - Ghi agent-config.json (chua device token) va chan quyen truy cap
    - Tao scheduled task tu khoi dong lai, tu chay lai khi loi

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\install.ps1 -ApiUrl "https://pc-troly-ai.vercel.app" -Token "pca_abc123..."

.NOTES
    Phai chay PowerShell voi quyen Administrator.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApiUrl,
    [Parameter(Mandatory = $true)][string]$Token,
    [string]$InstallDir = (Join-Path $env:ProgramData 'PCtroLyAI'),
    [int]$IntervalSec = 60,
    [string]$TaskName = 'PCtroLyAI-Agent'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

# --- 1. Kiem tra quyen admin -------------------------------------------------
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can chay PowerShell voi quyen Administrator (chuot phai > Run as administrator).'
}

if ($ApiUrl -notmatch '^https?://') { throw "ApiUrl khong hop le: $ApiUrl" }
if ($Token.Length -lt 16) { throw 'Token qua ngan — hay copy lai tu dashboard.' }

# --- 2. Chuan bi thu muc cai dat --------------------------------------------
Write-Step "Chuan bi $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$logDir = Join-Path $InstallDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'reports') | Out-Null

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeSource = Join-Path $scriptDir 'agent.exe'
$exePath = Join-Path $InstallDir 'agent.exe'
$argumentList = '--config "{0}"' -f (Join-Path $InstallDir 'agent-config.json')

if (Test-Path -LiteralPath $exeSource) {
    Write-Step 'Copy agent.exe'
    Copy-Item -LiteralPath $exeSource -Destination $exePath -Force
}
else {
    Write-Step 'Khong tim thay agent.exe — dung Python source (che do dev)'
    Copy-Item -Path (Join-Path $scriptDir '*.py') -Destination $InstallDir -Force
    $python = (Get-Command python -ErrorAction SilentlyContinue)
    if (-not $python) { throw 'Thieu agent.exe va khong tim thay python trong PATH.' }
    $exePath = $python.Source
    $argumentList = '"{0}" --config "{1}"' -f (Join-Path $InstallDir 'main.py'), (Join-Path $InstallDir 'agent-config.json')
    Write-Step 'Cai dependency Python (psutil, requests)'
    & $python.Source -m pip install --quiet --disable-pip-version-check -r (Join-Path $scriptDir 'requirements.txt')
}

# --- 3. Ghi cau hinh (chua token) ------------------------------------------
Write-Step 'Ghi agent-config.json'
$configPath = Join-Path $InstallDir 'agent-config.json'
$config = [ordered]@{
    apiUrl      = $ApiUrl.TrimEnd('/')
    token       = $Token
    intervalSec = [Math]::Max(15, $IntervalSec)
    logDir      = $logDir
}
$config | ConvertTo-Json | Out-File -LiteralPath $configPath -Encoding utf8 -Force

Write-Step 'Chan quyen truy cap thu muc cai dat (SYSTEM + Administrators)'
& icacls.exe $InstallDir /inheritance:r /grant '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null

# --- 4. Tao scheduled task --------------------------------------------------
Write-Step "Dang ky scheduled task $TaskName"
$action = New-ScheduledTaskAction -Execute $exePath -Argument $argumentList -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $taskPrincipal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

# --- 5. Ket qua -------------------------------------------------------------
Write-Host ''
Write-Host 'Cai dat thanh cong.' -ForegroundColor Green
Write-Host "  Thu muc   : $InstallDir"
Write-Host "  Cau hinh  : $configPath"
Write-Host "  Log       : $(Join-Path $logDir 'agent.log')"
Write-Host "  Task      : $TaskName"
Write-Host ''
Write-Host 'Kiem tra:' -ForegroundColor Yellow
Write-Host '  Get-ScheduledTask -TaskName ''PCtroLyAI-Agent'' | Get-ScheduledTaskInfo'
Write-Host "  Get-Content '$(Join-Path $logDir 'agent.log')' -Tail 20"
Write-Host ''
Write-Host 'Sau ~2 phut, thiet bi se hien "Dang online" tren dashboard.' -ForegroundColor Yellow
