# Sinh giá trị ngẫu nhiên an toàn cho các biến môi trường.
# Script CHỈ in ra màn hình, KHÔNG ghi vào file nào (tránh vô tình commit).
# Cách dùng:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gen-secrets.ps1

function New-Hex([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return ($buffer | ForEach-Object { $_.ToString('x2') }) -join ''
}

function New-Base64([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer)
}

Write-Host ''
Write-Host '=== PC Tro Ly AI - sinh secrets (copy sang apps\web\.env / Vercel) ===' -ForegroundColor Cyan
Write-Host ''
Write-Host ('AUTH_SECRET="' + (New-Base64 32) + '"')
Write-Host ('DEVICE_REGISTRATION_SECRET="' + (New-Hex 32) + '"')
Write-Host ('CRON_SECRET="' + (New-Hex 32) + '"')
Write-Host ''
Write-Host 'Mat khau admin goi y (tu dat lai cho de nho):' -ForegroundColor Yellow
Write-Host ('ADMIN_PASSWORD="' + (New-Base64 18) + '"')
Write-Host ''
Write-Host 'Luu y: KHONG commit gia tri vua sinh. Dan truc tiep vao Vercel > Settings > Environment Variables.' -ForegroundColor Yellow
Write-Host ''
