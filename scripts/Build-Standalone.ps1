param([string]$OutputName = 'jueony-preview')
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
foreach ($notice in @('LICENSE.txt', 'THIRD_PARTY_NOTICES.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $notice) -Destination (Join-Path $output $notice) -Force
}
$rustNotice = Join-Path $env:RUSTUP_HOME 'toolchains/1.93.1-x86_64-pc-windows-msvc/share/doc/rust/COPYRIGHT-library.html'
if (Test-Path -LiteralPath $rustNotice) {
    Copy-Item -LiteralPath $rustNotice -Destination (Join-Path $output 'Rust-COPYRIGHT-library.html') -Force
}
$voltaNodes = Join-Path $env:LOCALAPPDATA 'Volta/tools/image/node'
$installedNode = Get-ChildItem -LiteralPath $voltaNodes -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $installedNode) { throw '실행 묶음에 포함할 Node.js 22 이상이 필요합니다.' }
$runtimePath = Join-Path $output 'runtime'
New-Item -ItemType Directory -Force $runtimePath | Out-Null
Copy-Item -LiteralPath (Join-Path $installedNode.FullName 'node.exe') -Destination $runtimePath -Force
Copy-Item -LiteralPath (Join-Path $installedNode.FullName 'LICENSE') -Destination (Join-Path $runtimePath 'LICENSE.Node.txt') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/server.mjs') -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/providers') -Destination $output -Recurse -Force
Write-Output "실행 파일: $output\JueonyEditor.exe"
