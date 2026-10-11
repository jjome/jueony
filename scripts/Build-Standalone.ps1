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
foreach ($guide in @('13-llm-provider-adapters.md', '14-hyperclova-x-api-guide.md', '15-ai-editor-control-plan.md', '16-hangul-shortcuts-plan.md', '17-editor-control-implementation.md', '18-pane-resize-agent-check.md', '19-agent-interaction-fix.md', '20-native-providers-and-editing.md', '21-public-document-validation.md', '22-agent-retrieval-execution-design.md', '23-autonomous-work-result.md', 'agent-evaluation-cases.csv', 'ai-editor-capability-matrix.csv')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/' + $guide)) -Destination (Join-Path $output $guide) -Force
}
$llmEvidence = Join-Path $output 'evidence'
New-Item -ItemType Directory -Force $llmEvidence | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/llm-adapters-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/hyperclova-live-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/mvp-acceptance-results.csv') -Destination $output -Force
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
$sourceNode = Join-Path $installedNode.FullName 'node.exe'
$targetNode = Join-Path $runtimePath 'node.exe'
if (-not (Test-Path -LiteralPath $targetNode) -or (Get-FileHash -LiteralPath $sourceNode).Hash -ne (Get-FileHash -LiteralPath $targetNode).Hash) {
    Copy-Item -LiteralPath $sourceNode -Destination $targetNode -Force
}
Copy-Item -LiteralPath (Join-Path $installedNode.FullName 'LICENSE') -Destination (Join-Path $runtimePath 'LICENSE.Node.txt') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/server.mjs') -Destination $output -Force
foreach ($supportFile in @('connection-store.mjs', 'credential-protect.ps1')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('apps/launcher/' + $supportFile)) -Destination $output -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts/Start-Jueony.ps1') -Destination (Join-Path $output 'Start-Jueony.ps1') -Force
$startCmd = "@echo off" + [Environment]::NewLine + 'powershell.exe -NoProfile -File "%~dp0Start-Jueony.ps1"' + [Environment]::NewLine + 'if errorlevel 1 pause' + [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $output 'Start-Jueony.cmd'), $startCmd, [Text.Encoding]::ASCII)
$restartCmd = "@echo off" + [Environment]::NewLine + 'echo Save your documents and close Jueony windows before restarting.' + [Environment]::NewLine + 'powershell.exe -NoProfile -File "%~dp0Start-Jueony.ps1" -RestartServer' + [Environment]::NewLine + 'if errorlevel 1 pause' + [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $output 'Restart-Jueony.cmd'), $restartCmd, [Text.Encoding]::ASCII)
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/editor-control-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/pane-agent-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/agent-interaction-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/native-agent-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/claude-live-fix-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/providers') -Destination $output -Recurse -Force
$nodeVersion = & (Join-Path $runtimePath 'node.exe') --version
$providerHashes = [ordered]@{}
Get-ChildItem -LiteralPath (Join-Path $output 'providers') -Filter '*.mjs' | Sort-Object Name | ForEach-Object { $providerHashes[$_.Name] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
$manifest = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    nodeVersion = $nodeVersion
    nodeSha256 = (Get-FileHash -LiteralPath (Join-Path $runtimePath 'node.exe') -Algorithm SHA256).Hash
    launcherSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'JueonyEditor.exe') -Algorithm SHA256).Hash
    serverSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'server.mjs') -Algorithm SHA256).Hash
    connectionStoreSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'connection-store.mjs') -Algorithm SHA256).Hash
    credentialProtectSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'credential-protect.ps1') -Algorithm SHA256).Hash
    providerSha256 = $providerHashes
    adapterSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'providers/openai-compatible.mjs') -Algorithm SHA256).Hash
    frontend = Get-Content -LiteralPath (Join-Path $output 'dist/build-evidence.json') -Raw | ConvertFrom-Json
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'bundle-evidence.json') -Encoding utf8
Write-Output "실행 파일: $output\JueonyEditor.exe"
