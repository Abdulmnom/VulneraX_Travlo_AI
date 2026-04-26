#Requires -RunAsAdministrator

<#
.SYNOPSIS
    إنشاء شهادات SSL موثوقة محليًا باستخدام mkcert لـ vulnerax.local
.DESCRIPTION
    يقوم بتثبيت mkcert إذا لم يكن موجودًا، وتوليد شهادات wildcard
    لـ vulnerax.local و *.vulnerax.local
.NOTES
    يجب تشغيل هذا السكربت كـ Administrator
#>

param(
    [string]$Domain = "vulnerax.local",
    [switch]$SkipMkcertInstall
)

$ErrorActionPreference = "Stop"

function Write-Info { param($Message) Write-Host "[ℹ️] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[✅] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[⚠️] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[❌] $Message" -ForegroundColor Red }

# ─────────────────────────────────────────────────────────────────────────────
# 1. التحقق من وجود mkcert
# ─────────────────────────────────────────────────────────────────────────────
Write-Info "التحقق من وجود mkcert..."

if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
    if ($SkipMkcertInstall) {
        Write-Error "mkcert غير مثبت. قم بتثبيته يدويًا أو أزل معامل -SkipMkcertInstall"
        exit 1
    }
    
    Write-Warning "mkcert غير مثبت. جاري التثبيت..."
    
    # التحقق من وجود Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install mkcert -y
    }
    # التحقق من وجود Winget
    elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install FiloSottile.mkcert
    }
    # التثبيت اليدوي
    else {
        Write-Info "جاري التثبيت اليدوي..."
        $mkcertUrl = "https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-windows-amd64.exe"
        $mkcertPath = "$env:LOCALAPPDATA\mkcert\mkcert.exe"
        
        New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\mkcert" | Out-Null
        Invoke-WebRequest -Uri $mkcertUrl -OutFile $mkcertPath
        
        # إضافة للـ PATH
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -notlike "*$env:LOCALAPPDATA\mkcert*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$env:LOCALAPPDATA\mkcert", "User")
        }
        
        # تحديث PATH للجلسة الحالية
        $env:Path += ";$env:LOCALAPPDATA\mkcert"
    }
    
    # التحقق مرة أخرى
    if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
        Write-Error "فشل تثبيت mkcert. أعد تشغيل PowerShell والمحاولة مرة أخرى."
        exit 1
    }
    
    Write-Success "تم تثبيت mkcert بنجاح"
}
else {
    Write-Success "mkcert موجود: $(Get-Command mkcert | Select-Object -ExpandProperty Source)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. تثبيت الـ Local CA
# ─────────────────────────────────────────────────────────────────────────────
Write-Info "تثبيت الـ Local Certificate Authority..."
mkcert -install
if ($LASTEXITCODE -ne 0) {
    Write-Error "فشل تثبيت الـ CA. تأكد من تشغيل السكربت كـ Administrator"
    exit 1
}
Write-Success "تم تثبيت Local CA بنجاح"

# ─────────────────────────────────────────────────────────────────────────────
# 3. إنشاء مجلد الشهادات
# ─────────────────────────────────────────────────────────────────────────────
$certDir = Join-Path $PSScriptRoot ".." "nginx" "ssl" | Resolve-Path
Write-Info "إنشاء مجلد الشهادات: $certDir"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

# ─────────────────────────────────────────────────────────────────────────────
# 4. توليد الشهادات
# ─────────────────────────────────────────────────────────────────────────────
$certFile = Join-Path $certDir "$Domain.crt"
$keyFile = Join-Path $certDir "$Domain.key"

Write-Info "توليد شهادة wildcard لـ $Domain..."
mkcert -cert-file $certFile -key-file $keyFile `
    $Domain `
    "*.$Domain" `
    "www.$Domain" `
    "localhost" `
    "127.0.0.1" `
    "::1"

if ($LASTEXITCODE -ne 0) {
    Write-Error "فشل توليد الشهادات"
    exit 1
}

Write-Success "تم توليد الشهادات بنجاح!"

# ─────────────────────────────────────────────────────────────────────────────
# 5. عرض المعلومات
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "                    ملخص الشهادات                          " -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "📁 موقع الشهادات:"
Write-Host "   • الشهادة: $certFile" -ForegroundColor Gray
Write-Host "   • المفتاح:  $keyFile" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 النطاقات المدعومة:"
Write-Host "   • vulnerax.local" -ForegroundColor Gray
Write-Host "   • *.vulnerax.local (أي subdomain)" -ForegroundColor Gray
Write-Host "   • localhost" -ForegroundColor Gray
Write-Host "   • 127.0.0.1" -ForegroundColor Gray
Write-Host ""
Write-Host "🔒 CA Root Location: $(mkcert -CAROOT)\rootCA.pem" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  لتفعيل HTTPS على Android/iOS: انسخ rootCA.pem للجهاز" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue

# ─────────────────────────────────────────────────────────────────────────────
# 6. تحديث ملف hosts
# ─────────────────────────────────────────────────────────────────────────────
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$hostEntries = @(
    "127.0.0.1    vulnerax.local",
    "127.0.0.1    www.vulnerax.local",
    "127.0.0.1    tenant1.vulnerax.local",
    "127.0.0.1    tenant2.vulnerax.local",
    "127.0.0.1    admin.vulnerax.local"
)

Write-Info "تحديث ملف hosts..."

$hostsContent = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
if (!$hostsContent) { $hostsContent = "" }

foreach ($entry in $hostEntries) {
    if ($hostsContent -notmatch [regex]::Escape($entry)) {
        Add-Content -Path $hostsPath -Value "`n$entry"
        Write-Host "   + $entry" -ForegroundColor DarkGreen
    }
}

Write-Success "تم تحديث ملف hosts"
Write-Host ""
Write-Host "📌 الخطوات التالية:" -ForegroundColor Cyan
Write-Host "   1. تشغيل Docker Compose: docker-compose -f docker-compose.security.yml up --build"
Write-Host "   2. فتح المتصفح على: https://vulnerax.local"
Write-Host "   3. اختبار subdomain: https://tenant1.vulnerax.local"
