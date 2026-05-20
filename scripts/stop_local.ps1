# AI-Finance 停止本地服务
$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidsFile = Join-Path $ProjectRoot ".local_pids.json"

Write-Host "AI-Finance 停止服务" -ForegroundColor Cyan
Write-Host "==================`n"

if (-not (Test-Path $PidsFile)) {
    Write-Host "未找到 .local_pids.json，服务可能未通过 start_local 启动。" -ForegroundColor Yellow
    Write-Host "尝试手动停止端口进程..." -ForegroundColor Gray

    $ports = @(3000, 8000, 8501)
    foreach ($port in $ports) {
        $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conn) {
            $procId = $conn.OwningProcess | Select-Object -First 1
            $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "  停止端口 $port 进程 ($procName, PID: $procId)" -ForegroundColor Gray
        }
    }
    Write-Host "完成。" -ForegroundColor Green
    exit 0
}

$pids = Get-Content $PidsFile | ConvertFrom-Json

$stopped = 0
foreach ($prop in $pids.PSObject.Properties) {
    $name = $prop.Name
    $pid = $prop.Value
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
        Stop-Process -Id $pid -Force
        Write-Host "  停止 $name (PID: $pid)" -ForegroundColor Gray
        $stopped++
    } else {
        Write-Host "  $name (PID: $pid) 已不在运行" -ForegroundColor DarkGray
    }
}

Remove-Item $PidsFile -Force -ErrorAction SilentlyContinue
Write-Host "`n已停止 $stopped 个服务。" -ForegroundColor Green
