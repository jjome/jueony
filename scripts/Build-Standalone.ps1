$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
$env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
$compiler = Join-Path $env:CARGO_HOME 'bin/rustc.exe'
$output = Join-Path $projectRoot 'build/windows-preview'
New-Item -ItemType Directory -Force $output | Out-Null
& $compiler --edition 2021 -O (Join-Path $projectRoot 'apps/launcher/main.rs') -o (Join-Path $output 'JoouniEditor.exe')
if ($LASTEXITCODE -ne 0) { throw 'Rust 런처 빌드 실패' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/dist') -Destination $output -Recurse -Force
Write-Output "실행 파일: $output\JoouniEditor.exe"
