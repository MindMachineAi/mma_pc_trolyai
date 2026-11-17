<#
.SYNOPSIS
    Go cai dat agent PC Tro Ly AI (dung scheduled task va xoa cau hinh).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
    powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -KeepLogs
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:ProgramData 'PCtroLyAI'),
    [string]$TaskName = 'PCtroLyAI-Agent',
    [switch]$KeepLogs
)

$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Can chay PowerShell voi quyen Administrator.'
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "==> Dung va xoa task $TaskName" -ForegroundColor Cyan
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
else {
    Write-Host "==> Khong thay task $TaskName (bo qua)" -ForegroundColor Yellow
}

if (Test-Path -LiteralPath $InstallDir) {
    if ($KeepLogs) {
        Write-Host "==> Xoa agent, giu lai logs trong $InstallDir" -ForegroundColor Cyan
        Get-ChildItem -LiteralPath $InstallDir -File | Remove-Item -Force -ErrorAction SilentlyContinue
    }
    else {
        Write-Host "==> Xoa $InstallDir" -ForegroundColor Cyan
        Remove-Item -LiteralPath $InstallDir -Recurse -Force
    }
}

Write-Host ''
Write-Host 'Da go cai dat. Nho vao dashboard va Thu hoi thiet bi de vo hieu hoa token.' -ForegroundColor Yellow
