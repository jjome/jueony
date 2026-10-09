param([string]$OutputName = 'jueony-mvp')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
$env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
$compiler = Join-Path $env:CARGO_HOME 'bin/rustc.exe'
if ($OutputName -notmatch '^[a-zA-Z0-9_-]+$') { throw '잘못된 출력 폴더 이름' }
$output = Join-Path $projectRoot ('build/' + $OutputName)
New-Item -ItemType Directory -Force $output | Out-Null
& $compiler --edition 2021 -O (Join-Path $projectRoot 'apps/launcher/main.rs') -o (Join-Path $output 'JueonyEditor.exe')
if ($LASTEXITCODE -ne 0) { throw 'Rust 런처 빌드 실패' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/dist') -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/fixtures') -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/README.md') -Destination (Join-Path $output 'README.md') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/12-mvp-implementation.md') -Destination (Join-Path $output 'MVP-GUIDE.md') -Force
foreach ($notice in @('LICENSE.txt', 'THIRD_PARTY_NOTICES.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $notice) -Destination (Join-Path $output $notice) -Force
}
$rustNotice = Join-Path $env:RUSTUP_HOME 'toolchains/1.93.1-x86_64-pc-windows-msvc/share/doc/rust/COPYRIGHT-library.html'
if (Test-Path -LiteralPath $rustNotice) {
    Copy-Item -LiteralPath $rustNotice -Destination (Join-Path $output 'Rust-COPYRIGHT-library.html') -Force
}
$voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
$installedNode = Get-ChildItem -LiteralPath $voltaNodes -Directory | Where-Object { ([version]$_.Name).Major -eq 22 } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $installedNode) { throw '실행 묶음에 포함할 Node.js 22 이상이 필요합니다.' }
$runtimePath = Join-Path $output 'runtime'
New-Item -ItemType Directory -Force $runtimePath | Out-Null
Copy-Item -LiteralPath (Join-Path $installedNode.FullName 'node.exe') -Destination $runtimePath -Force
Copy-Item -LiteralPath (Join-Path $installedNode.FullName 'LICENSE') -Destination (Join-Path $runtimePath 'LICENSE.Node.txt') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/server.mjs') -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/providers') -Destination $output -Recurse -Force
$nodeVersion = & (Join-Path $runtimePath 'node.exe') --version
$manifest = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    nodeVersion = $nodeVersion
    nodeSha256 = (Get-FileHash -LiteralPath (Join-Path $runtimePath 'node.exe') -Algorithm SHA256).Hash
    launcherSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'JueonyEditor.exe') -Algorithm SHA256).Hash
    serverSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'server.mjs') -Algorithm SHA256).Hash
    adapterSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'providers/openai-compatible.mjs') -Algorithm SHA256).Hash
    frontend = Get-Content -LiteralPath (Join-Path $output 'dist/build-evidence.json') -Raw | ConvertFrom-Json
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'bundle-evidence.json') -Encoding utf8
Write-Output "실행 파일: $output\JueonyEditor.exe"
