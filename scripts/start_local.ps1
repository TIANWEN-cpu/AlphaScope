# AI-Finance 本地启动脚本
# 用法: powershell -ExecutionPolicy Bypass -File scripts/start_local.ps1 [-WithStreamlit]

param(
    [switch]$WithStreamlit
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidsFile = Join-Path $ProjectRoot ".local_pids.json"

Write-Host "AI-Finance 本地启动" -ForegroundColor Cyan
Write-Host "==================`n"

# 1. 环境检查
Write-Host "正在检查环境..." -ForegroundColor Yellow
python (Join-Path $ProjectRoot "scripts/check_env.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n环境检查失败，请修复后重试。" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. 创建必要目录
$dirs = @("cache", "reports", "uploads")
foreach ($d in $dirs) {
    $path = Join-Path $ProjectRoot $d
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "  创建目录: $d" -ForegroundColor Gray
    }
}

# 3. 加载 .env
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
            [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
    Write-Host "  已加载 .env`n" -ForegroundColor Gray
}

# 4. 启动服务
$pids = @{}

# FastAPI
Write-Host "启动 FastAPI (端口 8000)..." -ForegroundColor Green
$apiProc = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden
$pids["api"] = $apiProc.Id
Write-Host "  PID: $($apiProc.Id)" -ForegroundColor Gray

# Next.js
Write-Host "启动 Next.js (端口 3000)..." -ForegroundColor Green
$webDir = Join-Path $ProjectRoot "apps\web"
$webProc = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $webDir -PassThru -WindowStyle Hidden
$pids["web"] = $webProc.Id
Write-Host "  PID: $($webProc.Id)" -ForegroundColor Gray

# Streamlit (可选)
if ($WithStreamlit) {
    Write-Host "启动 Streamlit (端口 8501)..." -ForegroundColor Green
    $stProc = Start-Process -FilePath "python" -ArgumentList "-m", "streamlit", "run", "frontend/dashboard.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.headless=true" -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden
    $pids["streamlit"] = $stProc.Id
    Write-Host "  PID: $($stProc.Id)" -ForegroundColor Gray
}

# 5. 保存 PID
$pids | ConvertTo-Json | Set-Content $PidsFile
Write-Host "`n进程 PID 已保存到 .local_pids.json" -ForegroundColor Gray

# 6. 等待服务就绪
Write-Host "`n等待服务就绪..." -ForegroundColor Yellow

function Wait-ForService($url, $name, $maxWait = 30) {
    for ($i = 0; $i -lt $maxWait; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  [OK] $name" -ForegroundColor Green
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    Write-Host "  [超时] $name" -ForegroundColor Red
    return $false
}

$apiReady = Wait-ForService "http://localhost:8000/health" "FastAPI"
$webReady = Wait-ForService "http://localhost:3000" "Next.js"

# 7. 打开浏览器
if ($apiReady -or $webReady) {
    Write-Host "`n正在打开浏览器..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
}

Write-Host "`n启动完成！" -ForegroundColor Green
Write-Host "  FastAPI:   http://localhost:8000" -ForegroundColor White
Write-Host "  Next.js:   http://localhost:3000" -ForegroundColor White
if ($WithStreamlit) {
    Write-Host "  Streamlit: http://localhost:8501" -ForegroundColor White
}
Write-Host "`n停止服务: powershell -ExecutionPolicy Bypass -File scripts/stop_local.ps1" -ForegroundColor Yellow
