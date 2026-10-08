param([switch]$BrowserTab)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot 'apps/editor'
if (-not (Test-Path (Join-Path $appRoot 'dist/index.html'))) {
    throw '편집기 빌드가 없습니다. scripts/Build-Editor.ps1을 먼저 실행해 주세요.'
}
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
$voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
if (Test-Path $voltaNodes) {
    $installed = Get-ChildItem -LiteralPath $voltaNodes -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if ($installed) { $nodePath = Join-Path $installed.FullName 'node.exe' }
}
if (-not $nodePath) { throw 'Node.js 22 이상의 설치가 필요합니다.' }
$port = 4173
$running = $false
try {
    $result = Invoke-RestMethod "http://127.0.0.1:$port/build-evidence.json" -TimeoutSec 2
    $running = $result.applicationId -eq 'joouni-editor'
    if (-not $running) { throw '다른 프로그램이 4173 포트를 사용 중입니다.' }
} catch [System.Net.Http.HttpRequestException] {
    $running = $false
} catch [System.Net.WebException] {
    $running = $false
}
if (-not $running) {
    $evidence = Join-Path $appRoot 'evidence'
    New-Item -ItemType Directory -Force $evidence | Out-Null
    Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'preview.log') -RedirectStandardError (Join-Path $evidence 'preview-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $result = Invoke-RestMethod "http://127.0.0.1:$port/build-evidence.json" -TimeoutSec 1
            if ($result.applicationId -eq 'joouni-editor') { $running = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $running) { throw '편집기 서버 시작에 실패했습니다. apps/editor/evidence/preview-error.log를 확인해 주세요.' }
}
$url = "http://127.0.0.1:$port/"
if ($BrowserTab) { Start-Process $url; exit }
$browserPath = @(
    (Join-Path ${env:ProgramFiles} 'Google/Chrome/Application/chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft/Edge/Application/msedge.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browserPath) { Start-Process $url; exit }
# 사용자가 요청한 편집기 창을 연다. 백그라운드 서버와 달리 작업 창은 표시한다.
Start-Process -FilePath $browserPath -ArgumentList "--app=$url", '--window-size=1440,960'
