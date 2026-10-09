$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
$env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
$compiler = Join-Path $env:CARGO_HOME 'bin/rustc.exe'
$output = Join-Path $projectRoot 'build/jueony-preview'
New-Item -ItemType Directory -Force $output | Out-Null
& $compiler --edition 2021 -O (Join-Path $projectRoot 'apps/launcher/main.rs') -o (Join-Path $output 'JueonyEditor.exe')
if ($LASTEXITCODE -ne 0) { throw 'Rust 런처 빌드 실패' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/dist') -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/fixtures') -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/README.md') -Destination (Join-Path $output 'README.md') -Force
$rustNotice = Join-Path $env:RUSTUP_HOME 'toolchains/1.93.1-x86_64-pc-windows-msvc/share/doc/rust/COPYRIGHT-library.html'
if (Test-Path -LiteralPath $rustNotice) {
    Copy-Item -LiteralPath $rustNotice -Destination (Join-Path $output 'Rust-COPYRIGHT-library.html') -Force
}
Write-Output "실행 파일: $output\JueonyEditor.exe"
