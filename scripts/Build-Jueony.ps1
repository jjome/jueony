param([switch]$Native)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot 'apps/editor'
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
$voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
if (Test-Path $voltaNodes) {
    $installed = Get-ChildItem -LiteralPath $voltaNodes -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if ($installed) { $nodePath = Join-Path $installed.FullName 'node.exe' }
}
if (-not $nodePath) { throw 'Node.js 22 이상이 필요합니다.' }
Push-Location $appRoot
try {
    & $nodePath 'scripts/build.mjs'
    if ($LASTEXITCODE -ne 0) { throw '편집 화면 빌드 실패' }
    if ($Native) {
        $env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
        $env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
        $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
        & $nodePath 'node_modules/@tauri-apps/cli/tauri.js' build --debug --no-bundle
        if ($LASTEXITCODE -ne 0) { throw 'Windows 앱 빌드 실패. 빌드 로그를 확인해 주세요.' }
    }
} finally { Pop-Location }
