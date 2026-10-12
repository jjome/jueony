param([string]$OutputName = 'jueony-mvp',[string]$FrontendProfile = '',[ValidateRange(1024,65535)][int]$ReviewPort = 4173)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
$env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
$compiler = Join-Path $env:CARGO_HOME 'bin/rustc.exe'
if ($OutputName -notmatch '^[a-zA-Z0-9_-]+$') { throw '잘못된 출력 폴더 이름' }
if ($FrontendProfile -and $FrontendProfile -notmatch '^[a-z][a-z0-9-]{0,30}$') { throw '잘못된 프런트엔드 프로필' }
$frontend = if ($FrontendProfile) { Join-Path $projectRoot ('apps/editor/evidence/dist-' + $FrontendProfile) } else { Join-Path $projectRoot 'apps/editor/dist' }
if (-not (Test-Path -LiteralPath (Join-Path $frontend 'build-evidence.json'))) { throw '프런트엔드 빌드를 먼저 실행해 주세요.' }
$output = Join-Path $projectRoot ('build/' + $OutputName)
New-Item -ItemType Directory -Force $output | Out-Null
$previousLauncherAddress = $env:JUEONY_LAUNCHER_ADDRESS
try {
    $env:JUEONY_LAUNCHER_ADDRESS = "127.0.0.1:$ReviewPort"
    & $compiler --edition 2021 -O (Join-Path $projectRoot 'apps/launcher/main.rs') -o (Join-Path $output 'JueonyEditor.exe')
    if ($LASTEXITCODE -ne 0) { throw 'Rust 런처 빌드 실패' }
} finally { $env:JUEONY_LAUNCHER_ADDRESS = $previousLauncherAddress }
$frontendOutput = Join-Path $output 'dist'
New-Item -ItemType Directory -Force $frontendOutput | Out-Null
Get-ChildItem -LiteralPath $frontend -Force | Copy-Item -Destination $frontendOutput -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/fixtures') -Destination $output -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/README.md') -Destination (Join-Path $output 'README.md') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/12-mvp-implementation.md') -Destination (Join-Path $output 'MVP-GUIDE.md') -Force
foreach ($guide in @('13-llm-provider-adapters.md', '14-hyperclova-x-api-guide.md', '15-ai-editor-control-plan.md', '16-hangul-shortcuts-plan.md', '17-editor-control-implementation.md', '18-pane-resize-agent-check.md', '19-agent-interaction-fix.md', '20-native-providers-and-editing.md', '21-public-document-validation.md', '22-agent-retrieval-execution-design.md', '23-autonomous-work-result.md', '24-next-development-plan.md', '25-hangul-parity-and-state-plan.md', '26-parallel-execution-plan.md', '27-parity-foundation-result.md', '28-continuation-implementation.md', 'hangul-2024-feature-audit.csv', 'editor-state-contract.csv', 'agent-evaluation-cases.csv', 'ai-editor-capability-matrix.csv')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/' + $guide)) -Destination (Join-Path $output $guide) -Force
}
$llmEvidence = Join-Path $output 'evidence'
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/42-document-insertion-result.md') -Destination $output -Force
foreach ($guide in @('30-layered-modular-refactor-plan.md','31-facade-contracts.md','32-modular-refactor-result.md','33-editor-parity-features-result.md','34-sections-tabs-result.md','35-section-boundary-merge-result.md','36-native-section-comparison.md','37-basic-editing-state-result.md','38-paragraph-selection-state-result.md','39-native-dialog-investigation.md','40-basic-navigation-calendar-result.md','41-pre-agent-editor-progress.md','refactor-work-plan.csv','hangul-2024-gap-checklist.csv')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/' + $guide)) -Destination (Join-Path $output $guide) -Force
}
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
$startCmd = "@echo off" + [Environment]::NewLine + ('powershell.exe -NoProfile -File "%~dp0Start-Jueony.ps1" -Port ' + $ReviewPort) + [Environment]::NewLine + 'if errorlevel 1 pause' + [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $output 'Start-Jueony.cmd'), $startCmd, [Text.Encoding]::ASCII)
if ($ReviewPort -ne 4173) { [IO.File]::WriteAllText((Join-Path $output 'Start-Review.cmd'), $startCmd, [Text.Encoding]::ASCII) }
$restartCmd = "@echo off" + [Environment]::NewLine + 'echo Save your documents and close Jueony windows before restarting.' + [Environment]::NewLine + ('powershell.exe -NoProfile -File "%~dp0Start-Jueony.ps1" -Port ' + $ReviewPort + ' -RestartServer') + [Environment]::NewLine + 'if errorlevel 1 pause' + [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $output 'Restart-Jueony.cmd'), $restartCmd, [Text.Encoding]::ASCII)
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/editor-control-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/pane-agent-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/agent-interaction-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/native-agent-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/claude-live-fix-2026-10-11') -Destination $llmEvidence -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/launcher/providers') -Destination $output -Recurse -Force
foreach ($moduleDirectory in @('services', 'contracts')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('apps/launcher/' + $moduleDirectory)) -Destination $output -Recurse -Force
}
# Package the canonical document wire contract; the source-only re-export is not deployable.
Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/editor/src/modules/document/public/wire-schema.mjs') -Destination (Join-Path $output 'contracts/document-wire-schema.mjs') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/evidence/continuation-2026-10-11') -Destination $llmEvidence -Recurse -Force
$reviewDocuments = Join-Path $output 'review-documents'
New-Item -ItemType Directory -Force $reviewDocuments | Out-Null
foreach ($relative in @('behavior', 'state', 'agent/preflight')) {
    Get-ChildItem -LiteralPath (Join-Path $projectRoot ('docs/evidence/continuation-2026-10-11/' + $relative)) -File |
        Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
}
$nodeVersion = & (Join-Path $runtimePath 'node.exe') --version
$featureDocuments = Join-Path $projectRoot 'docs/evidence/features-2026-10-11/documents'
if (Test-Path -LiteralPath $featureDocuments) {
    Get-ChildItem -LiteralPath $featureDocuments -File |
        Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
}
$sectionEvidence = Join-Path $projectRoot 'docs/evidence/sections-tabs-2026-10-12'
if (Test-Path -LiteralPath $sectionEvidence) {
    Copy-Item -LiteralPath $sectionEvidence -Destination $llmEvidence -Recurse -Force
    $sectionDocuments = Join-Path $sectionEvidence 'documents'
    if (Test-Path -LiteralPath $sectionDocuments) {
        Get-ChildItem -LiteralPath $sectionDocuments -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
    }
}
$providerHashes = [ordered]@{}
$mergeEvidence = Join-Path $projectRoot 'docs/evidence/section-merge-2026-10-12'
if (Test-Path -LiteralPath $mergeEvidence) {
    Copy-Item -LiteralPath $mergeEvidence -Destination $llmEvidence -Recurse -Force
    $mergeDocuments = Join-Path $mergeEvidence 'documents'
    if (Test-Path -LiteralPath $mergeDocuments) {
        Get-ChildItem -LiteralPath $mergeDocuments -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
    }
}
foreach ($guide in @('37-basic-editing-state-result.md','38-paragraph-selection-state-result.md','39-native-dialog-investigation.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/' + $guide)) -Destination $output -Force
}
$selectionEvidence = Join-Path $projectRoot 'docs/evidence/selection-spacing-2026-10-12'
if (Test-Path -LiteralPath $selectionEvidence) {
    Copy-Item -LiteralPath $selectionEvidence -Destination $llmEvidence -Recurse -Force
    $selectionDocuments = Join-Path $selectionEvidence 'verified'
    if (Test-Path -LiteralPath $selectionDocuments) {
        Get-ChildItem -LiteralPath $selectionDocuments -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
    }
}
$basicEvidence = Join-Path $projectRoot 'docs/evidence/basic-state-2026-10-12'
if (Test-Path -LiteralPath $basicEvidence) {
    Copy-Item -LiteralPath $basicEvidence -Destination $llmEvidence -Recurse -Force
    $basicDocuments = Join-Path $basicEvidence 'browser-verified'
    if (Test-Path -LiteralPath $basicDocuments) {
        Get-ChildItem -LiteralPath $basicDocuments -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
    }
}
$nativeEvidence = Join-Path $projectRoot 'docs/evidence/native-section-merge-2026-10-12'
if (Test-Path -LiteralPath $nativeEvidence) {
    Copy-Item -LiteralPath $nativeEvidence -Destination $llmEvidence -Recurse -Force
    # Corrected exports supersede earlier synthetic fixtures in the review bundle;
    # historical evidence remains in its original source directory.
    foreach ($directory in @($nativeEvidence, (Join-Path $nativeEvidence 'documents'))) {
        if (Test-Path -LiteralPath $directory) {
            Get-ChildItem -LiteralPath $directory -File |
                Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
        }
    }
}
Get-ChildItem -LiteralPath (Join-Path $output 'providers') -Filter '*.mjs' | Sort-Object Name | ForEach-Object { $providerHashes[$_.Name] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
$insertionEvidence = Join-Path $projectRoot 'docs/evidence/document-insert-2026-10-12'
if (Test-Path -LiteralPath $insertionEvidence) {
    Copy-Item -LiteralPath $insertionEvidence -Destination $llmEvidence -Recurse -Force
    $insertionDocuments = Join-Path $insertionEvidence 'final-verified'
    if (Test-Path -LiteralPath $insertionDocuments) {
        Get-ChildItem -LiteralPath $insertionDocuments -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $reviewDocuments -Force
    }
    $engineInsertion = Join-Path $insertionEvidence 'engine-complete'
    if (Test-Path -LiteralPath $engineInsertion) {
        $engineReview = Join-Path $reviewDocuments 'engine-insertion'
        New-Item -ItemType Directory -Force $engineReview | Out-Null
        Get-ChildItem -LiteralPath $engineInsertion -File |
            Where-Object { $_.Extension -in @('.hwp', '.hwpx') } | Copy-Item -Destination $engineReview -Force
    }
}
$moduleHashes = [ordered]@{}
foreach ($directory in @('services', 'contracts')) {
    Get-ChildItem -LiteralPath (Join-Path $output $directory) -Filter '*.mjs' -Recurse | Sort-Object FullName | ForEach-Object { $moduleHashes[$directory + '/' + $_.Name] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
}
$manifest = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    reviewPort = $ReviewPort
    nodeVersion = $nodeVersion
    nodeSha256 = (Get-FileHash -LiteralPath (Join-Path $runtimePath 'node.exe') -Algorithm SHA256).Hash
    launcherSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'JueonyEditor.exe') -Algorithm SHA256).Hash
    serverSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'server.mjs') -Algorithm SHA256).Hash
    connectionStoreSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'connection-store.mjs') -Algorithm SHA256).Hash
    credentialProtectSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'credential-protect.ps1') -Algorithm SHA256).Hash
    providerSha256 = $providerHashes
    moduleSha256 = $moduleHashes
    adapterSha256 = (Get-FileHash -LiteralPath (Join-Path $output 'providers/openai-compatible.mjs') -Algorithm SHA256).Hash
    frontend = Get-Content -LiteralPath (Join-Path $output 'dist/build-evidence.json') -Raw | ConvertFrom-Json
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $output 'bundle-evidence.json') -Encoding utf8
Write-Output "실행 파일: $output\JueonyEditor.exe"
