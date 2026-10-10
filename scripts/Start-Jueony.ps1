param([switch]$BrowserTab,[switch]$ServeOnly,[switch]$RestartServer,[ValidateRange(1024,65535)][int]$Port=4173)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundleRoot = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'server.mjs')) { $PSScriptRoot } else { Join-Path $projectRoot 'build/jueony-mvp' }
if ((Test-Path -LiteralPath (Join-Path $bundleRoot 'runtime/node.exe')) -and (Test-Path -LiteralPath (Join-Path $bundleRoot 'dist/index.html'))) {
    $appRoot = $bundleRoot
    $dist = Join-Path $bundleRoot 'dist'
    $serverScript = Join-Path $bundleRoot 'server.mjs'
    $nodePath = Join-Path $bundleRoot 'runtime/node.exe'
} else {
    $appRoot = Join-Path $projectRoot 'apps/editor'
    $dist = Join-Path $appRoot 'dist'
    $serverScript = Join-Path $projectRoot 'apps/launcher/server.mjs'
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    $voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
    if (Test-Path -LiteralPath $voltaNodes) {
        $installed = Get-ChildItem -LiteralPath $voltaNodes -Directory | Where-Object { ([version]$_.Name).Major -ge 22 } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
        if ($installed) { $nodePath = Join-Path $installed.FullName 'node.exe' }
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'scripts/Build-Jueony.ps1을 먼저 실행해 주세요.' }
if (-not $nodePath) { throw 'Node.js 22 이상 또는 준비된 jueony-mvp 실행 묶음이 필요합니다.' }
$running = $false
try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 2; $running = $health.application -eq 'jueony' -and $health.apiVersion -eq 1 -and $health.connectionStorageVersion -eq 1 } catch {}
if ($running -and $RestartServer) {
    # Only this bundle's verified server is restarted. Save and close windows first.
    $listener = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop)
    $ownerIds = @($listener.OwningProcess | Sort-Object -Unique)
    if ($ownerIds.Count -ne 1) { throw '서버 프로세스를 하나로 확인하지 못했습니다.' }
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($ownerIds[0])"
    $expectedServer = [IO.Path]::GetFullPath($serverScript)
    $expectedNode = [IO.Path]::GetFullPath($nodePath)
    $escapedServer = [regex]::Escape($expectedServer)
    if ($taskProcess.ExecutablePath -ine $expectedNode -or $taskProcess.CommandLine -notmatch ('(?:"|\s)' + $escapedServer + '(?:"|\s|$)')) { throw '이 실행 묶음의 서버가 아니므로 종료하지 않았습니다.' }
    Stop-Process -Id $ownerIds[0] -ErrorAction Stop
    Wait-Process -Id $ownerIds[0] -Timeout 10 -ErrorAction SilentlyContinue
    $running = $false
}
if ($running -and ($health.documentControlVersion -ne 1 -or $health.providerCatalogVersion -ne 1)) { throw '이전 AI 서버가 실행 중입니다. 문서를 저장하고 편집기 창을 닫은 뒤 Restart-Jueony.cmd를 실행하세요.' }
if (-not $running) {
    $occupied = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($occupied) { throw "$port 포트의 이전 편집기 서버 또는 다른 프로그램을 종료한 뒤 다시 실행해 주세요. 열린 문서는 먼저 저장하세요." }
    $evidence = Join-Path $appRoot 'evidence'
    New-Item -ItemType Directory -Force $evidence | Out-Null
    $logStem = if ($port -eq 4173) { 'mvp-server' } else { "mvp-server-$port" }
    $previousDist = $env:JUEONY_DIST
    $previousPort = $env:JUEONY_PORT
    try {
        $env:JUEONY_DIST = $dist
        $env:JUEONY_PORT = "$port"
        Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence "$logStem.log") -RedirectStandardError (Join-Path $evidence "$logStem-error.log") | Out-Null
    } finally { $env:JUEONY_DIST = $previousDist; $env:JUEONY_PORT = $previousPort }
    for ($attempt=0;$attempt -lt 30;$attempt++) {
        try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 1; if ($health.application -eq 'jueony' -and $health.apiVersion -eq 1 -and $health.connectionStorageVersion -eq 1 -and $health.documentControlVersion -eq 1) { $running=$true;break } } catch {}
        Start-Sleep -Milliseconds 200
    }
    if (-not $running) { throw "업무 서버 시작 실패. 실행 묶음의 evidence/$logStem-error.log를 확인해 주세요." }
}
if ($ServeOnly) { Write-Output "Jueony server ready: http://127.0.0.1:$port/";exit }
$url="http://127.0.0.1:$port/"
if ($BrowserTab) { Start-Process $url; exit }
$browserPath=@(
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Microsoft/Edge/Application/msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browserPath) { Start-Process $url;exit }
Start-Process -FilePath $browserPath -ArgumentList "--app=$url",'--window-size=1440,960'
