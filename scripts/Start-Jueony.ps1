param([switch]$BrowserTab)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot 'apps/editor'
$dist = Join-Path $appRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'scripts/Build-Jueony.ps1을 먼저 실행해 주세요.' }
$nodePath = Join-Path $projectRoot 'build/jueony-mvp/runtime/node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    $voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
    if (Test-Path -LiteralPath $voltaNodes) {
        $installed = Get-ChildItem -LiteralPath $voltaNodes -Directory | Where-Object { ([version]$_.Name).Major -ge 22 } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
        if ($installed) { $nodePath = Join-Path $installed.FullName 'node.exe' }
    }
}
if (-not $nodePath) { throw 'Node.js 22 이상 또는 준비된 jueony-mvp 실행 묶음이 필요합니다.' }
$port = 4173
$running = $false
try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 2; $running = $health.application -eq 'jueony' -and $health.apiVersion -eq 1 } catch {}
if (-not $running) {
    $occupied = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($occupied) { throw '4173 포트의 이전 편집기 서버 또는 다른 프로그램을 종료한 뒤 다시 실행해 주세요. 열린 문서는 먼저 저장하세요.' }
    $evidence = Join-Path $appRoot 'evidence'
    New-Item -ItemType Directory -Force $evidence | Out-Null
    $previousDist = $env:JUEONY_DIST
    try {
        $env:JUEONY_DIST = $dist
        $serverScript = Join-Path $projectRoot 'apps/launcher/server.mjs'
        Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'mvp-server.log') -RedirectStandardError (Join-Path $evidence 'mvp-server-error.log') | Out-Null
    } finally { $env:JUEONY_DIST = $previousDist }
    for ($attempt=0;$attempt -lt 30;$attempt++) {
        try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 1; if ($health.application -eq 'jueony' -and $health.apiVersion -eq 1) { $running=$true;break } } catch {}
        Start-Sleep -Milliseconds 200
    }
    if (-not $running) { throw '업무 서버 시작 실패. apps/editor/evidence/mvp-server-error.log를 확인해 주세요.' }
}
$url="http://127.0.0.1:$port/"
if ($BrowserTab) { Start-Process $url; exit }
$browserPath=@(
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Microsoft/Edge/Application/msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browserPath) { Start-Process $url;exit }
Start-Process -FilePath $browserPath -ArgumentList "--app=$url",'--window-size=1440,960'
