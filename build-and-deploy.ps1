# =======================================================
# Fire Roach KillerV2.6 - Build and Deploy Script
# 构建并部署到 Cloudflare Pages
# =======================================================

# 设置错误处理：遇到错误立即停止
$ErrorActionPreference = "Stop"

# 颜色定义
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Cyan = [System.ConsoleColor]::Cyan

function Write-Step {
    param([string]$Message)
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor $Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor $Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor $Yellow
}

# =======================================================
# 步骤 0: 环境检查
# =======================================================
Write-Step "0. 检查环境依赖"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "Node.js 未安装或不在 PATH 中。请安装 Node.js 18+。"
    exit 1
}
Write-Success "Node.js 版本: $(node --version)"

if (-not (Test-Path "package.json")) {
    Write-Error-Custom "当前目录不是项目根目录（找不到 package.json）。"
    exit 1
}

# 检查 dist/public 是否存在
if (-not (Test-Path "dist\public")) {
    Write-Warning-Custom "dist\public 目录不存在，将进行构建。"
}

# =======================================================
# 步骤 1: 构建项目
# =======================================================
Write-Step "1. 执行项目构建 (npm run build)"

try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build 退出码: $LASTEXITCODE"
    }
    Write-Success "构建成功！"
} catch {
    Write-Error-Custom "构建失败: $_"
    Write-Host "请检查上方的构建日志，修复代码错误后重试。" -ForegroundColor $Yellow
    exit 1
}

# 验证构建产物
if (-not (Test-Path "dist\public\index.html")) {
    Write-Error-Custom "构建产物缺失：dist\public\index.html 未找到。"
    exit 1
}
Write-Success "产物验证通过 (dist/public 已生成)"

# =======================================================
# 步骤 2: 部署到 Cloudflare Pages
# =======================================================
Write-Step "2. 部署到 Cloudflare Pages"

# 检查 wrangler 是否可用
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "npx 命令不可用。"
    exit 1
}

# 检查 Cloudflare 认证状态
Write-Host "  检查 Cloudflare 认证状态..." -ForegroundColor $Cyan
$authStatus = npx wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning-Custom "未检测到 Cloudflare 登录状态。请先执行 npx wrangler login"
    Write-Host "  正在发起登录流程..." -ForegroundColor $Yellow
    npx wrangler login
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "登录失败。"
        exit 1
    }
}
Write-Success "Cloudflare 账户已认证"

# 执行部署
Write-Host "  开始上传构建产物到 Cloudflare..." -ForegroundColor $Cyan
try {
    npx wrangler pages deploy dist/public --project-name=fire-roach-killer --branch=main
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler deploy 退出码: $LASTEXITCODE"
    }
    Write-Success "部署流程执行完毕！"
} catch {
    Write-Error-Custom "部署失败: $_"
    Write-Host "可能原因：" -ForegroundColor $Yellow
    Write-Host "  1. Cloudflare 网络连接问题"
    Write-Host "  2. 项目名 fire-roach-killer 不存在（需在 Cloudflare 控制台创建）"
    Write-Host "  3. 文件权限问题"
    exit 1
}

# =======================================================
# 完成
# =======================================================
Write-Host ""
Write-Host "=======================================================" -ForegroundColor $Green
Write-Host "  ✅ 全流程完成！" -ForegroundColor $Green
Write-Host "=======================================================" -ForegroundColor $Green
Write-Host ""
Write-Host "  生产地址: https://fire-roach-killer.pages.dev" -ForegroundColor $Cyan
Write-Host "  自定义域名: https://games.eqtool.xin" -ForegroundColor $Cyan
Write-Host ""
Write-Host "  打开浏览器访问上述地址验证游戏是否正常。" -ForegroundColor $Yellow
