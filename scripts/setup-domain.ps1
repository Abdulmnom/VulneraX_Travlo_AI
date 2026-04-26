#Requires -RunAsAdministrator

<#
.SYNOPSIS
    إعداد Domain و SSL Certificates لـ VulneraX بدون Docker
.DESCRIPTION
    يقوم بتثبيت mkcert، توليد شهادات SSL، وتحديث ملف hosts
    لمحاكاة بيئة الإنتاج على vulnerax.local
.NOTES
    يجب تشغيل هذا السكربت كـ Administrator
#>

param(
    [string]$Domain = "vulnerax.local",
    [string[]]$Subdomains = @("tenant1", "tenant2", "admin", "www"),
    [switch]$SkipMkcertInstall,
    [switch]$SkipHostsUpdate
)

$ErrorActionPreference = "Stop"

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────
function Write-Info { param($Message) Write-Host "[ℹ️] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[✅] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[⚠️] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[❌] $Message" -ForegroundColor Red }

# ─────────────────────────────────────────────────────────────────────────────
# 1. التحقق من وجود mkcert
# ─────────────────────────────────────────────────────────────────────────────
Write-Info "التحقق من وجود mkcert..."

function Install-Mkcert {
    Write-Warning "mkcert غير مثبت. جاري التثبيت..."
    
    # التحقق من وجود Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install mkcert -y
    }
    # التحقق من وجود Winget
    elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install FiloSottile.mkcert --accept-source-agreements --accept-package-agreements
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
}

if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
    if ($SkipMkcertInstall) {
        Write-Error "mkcert غير مثبت. قم بتثبيته يدويًا أو أزل معامل -SkipMkcertInstall"
        exit 1
    }
    Install-Mkcert
    
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
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$certDir = Join-Path $projectDir "nginx\ssl"

Write-Info "إنشاء مجلد الشهادات: $certDir"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

# ─────────────────────────────────────────────────────────────────────────────
# 4. توليد الشهادات
# ─────────────────────────────────────────────────────────────────────────────
$certFile = Join-Path $certDir "$Domain.crt"
$keyFile = Join-Path $certDir "$Domain.key"

# بناء قائمة النطاقات
$domains = @($Domain, "*.$Domain", "www.$Domain", "localhost", "127.0.0.1", "::1")
foreach ($sub in $Subdomains) {
    if ($sub -ne "www") {
        $domains += "$sub.$Domain"
    }
}

Write-Info "توليد شهادة wildcard لـ $Domain..."
Write-Host "   النطاقات المضمنة:" -ForegroundColor Gray
$domains | ForEach-Object { Write-Host "     - $_" -ForegroundColor DarkGray }

$domainArgs = $domains -join " "
Invoke-Expression "mkcert -cert-file `"$certFile`" -key-file `"$keyFile`" $domainArgs"

if ($LASTEXITCODE -ne 0) {
    Write-Error "فشل توليد الشهادات"
    exit 1
}

Write-Success "تم توليد الشهادات بنجاح!"

# ─────────────────────────────────────────────────────────────────────────────
# 5. تحديث ملف hosts
# ─────────────────────────────────────────────────────────────────────────────
if (!$SkipHostsUpdate) {
    $hostsPath = "C:\Windows\System32\drivers\etc\hosts"
    
    Write-Info "تحديث ملف hosts..."
    
    $hostEntries = @()
    $hostEntries += "127.0.0.1    $Domain"
    $hostEntries += "127.0.0.1    www.$Domain"
    
    foreach ($sub in $Subdomains) {
        if ($sub -ne "www") {
            $hostEntries += "127.0.0.1    $sub.$Domain"
        }
    }
    
    # إضافة علامة للتعرف على إدخالاتنا
    $hostEntries += "# VulneraX Local Development End"
    
    $hostsContent = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
    if (!$hostsContent) { $hostsContent = "" }
    
    # إزالة الإدخالات القديمة
    $pattern = "# VulneraX Local Development.*?# VulneraX Local Development End"
    $hostsContent = $hostsContent -replace $pattern, ""
    $hostsContent = $hostsContent -replace "# VulneraX Local Development End", ""
    $hostsContent = $hostsContent.Trim()
    
    # إضافة الإدخالات الجديدة
    $newEntries = @("# VulneraX Local Development") + $hostEntries
    $hostsContent += "`r`n`r`n" + ($newEntries -join "`r`n")
    
    # حفظ الملف
    $hostsContent | Set-Content -Path $hostsPath -Force
    
    Write-Success "تم تحديث ملف hosts"
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. عرض المعلومات
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "                    ملخص الإعداد                           " -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "📁 موقع الشهادات:" -ForegroundColor White
Write-Host "   • الشهادة: $certFile" -ForegroundColor Gray
Write-Host "   • المفتاح:  $keyFile" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 النطاقات المدعومة:" -ForegroundColor White
$domains | ForEach-Object { Write-Host "   • $_" -ForegroundColor Gray }
Write-Host ""
Write-Host "🔒 CA Root Location: $(mkcert -CAROOT)\rootCA.pem" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "📌 الخطوات التالية:" -ForegroundColor Cyan
Write-Host "   1. تثبيت الحزم:" -ForegroundColor White
Write-Host "      npm install" -ForegroundColor Yellow
Write-Host ""
Write-Host "   2. تشغيل السيرفر (يحتاج PowerShell كـ Administrator):" -ForegroundColor White
Write-Host "      npm run start:local" -ForegroundColor Yellow
Write-Host ""
Write-Host "   أو تشغيل منفصل:" -ForegroundColor White
Write-Host "      Terminal 1: npm run proxy     (كـ Administrator)" -ForegroundColor Yellow
Write-Host "      Terminal 2: npm run dev       (عادي)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   3. فتح التطبيق:" -ForegroundColor White
Write-Host "      https://$Domain" -ForegroundColor Green
Write-Host "      https://tenant1.$Domain" -ForegroundColor Green
Write-Host "      https://admin.$Domain/security/dashboard" -ForegroundColor Green
Write-Host ""
Write-Host "   4. اختبار الهجمات:" -ForegroundColor White
Write-Host "      npm run simulate:attacks" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
