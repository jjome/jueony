param([switch]$Native)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot 'apps/editor'
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
$portableNode = Join-Path $projectRoot '.tools/node-v24.22.3-win-x64/node.exe'
if (Test-Path -LiteralPath $portableNode) { $nodePath = $portableNode }
$voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
if (Test-Path $voltaNodes) {
    $installed = Get-ChildItem -LiteralPath $voltaNodes -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if ($installed -and -not (Test-Path -LiteralPath $portableNode)) { $nodePath = Join-Path $installed.FullName 'node.exe' }
}
if (-not $nodePath) { throw 'Node.js 22 이상이 필요합니다.' }
$previousEnginePackage = $env:JUEONY_ENGINE_PACKAGE
$engineBuilds = Join-Path $projectRoot 'build/rhwp-engine'
Push-Location $appRoot
try {
    if (-not $previousEnginePackage -and (Test-Path -LiteralPath $engineBuilds)) {
        $latestEngine = Get-ChildItem -LiteralPath $engineBuilds -Directory -Filter 'source-*' | ForEach-Object {
            $manifest = Join-Path $_.FullName 'pkg/jueony-engine-build.json'
            if (Test-Path -LiteralPath $manifest) { Get-Item -LiteralPath $manifest }
        } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
        if ($latestEngine) { $env:JUEONY_ENGINE_PACKAGE = $latestEngine.Directory.FullName }
    }
    & $nodePath 'scripts/build.mjs'
    if ($LASTEXITCODE -ne 0) { throw '편집 화면 빌드 실패' }
    if ($Native) {
        $env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
        $env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
        $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
        & $nodePath 'node_modules/@tauri-apps/cli/tauri.js' build --debug --no-bundle
        if ($LASTEXITCODE -ne 0) { throw 'Windows 앱 빌드 실패. 빌드 로그를 확인해 주세요.' }
    }
} finally { $env:JUEONY_ENGINE_PACKAGE = $previousEnginePackage; Pop-Location }
