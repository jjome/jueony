param([switch]$PrepareOnly, [ValidateSet('Native','Wsl')][string]$Runtime='Wsl', [string]$WslDistribution='Ubuntu')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
$reference = Join-Path $projectRoot 'upstream/rhwp-source'
$baseCommit = '1a76570e833917d15817415a53c09ad61ab3203f'
$actualCommit = (& git -C $reference rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualCommit -ne $baseCommit) { throw 'Engine reference commit does not match the pinned revision.' }
$changed = & git -C $reference status --porcelain -- src crates vendor Cargo.toml Cargo.lock
if ($changed) { throw 'The engine reference has local changes. Preserve it and use a clean pinned reference.' }
$patchRoot = Join-Path $projectRoot 'engine/patches'
$patches = @(Get-ChildItem -LiteralPath $patchRoot -Filter '*.patch' | Sort-Object Name)
if ($patches.Count -eq 0) { throw 'No engine patches found.' }
$patchEvidence = @($patches | ForEach-Object { @{ name=$_.Name; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } })
$inputText = $baseCommit + ($patchEvidence | ConvertTo-Json -Compress) + (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash + (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'build-document-engine-wsl.sh') -Algorithm SHA256).Hash
$hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
try { $sourceId = [Convert]::ToHexString($hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($inputText))).ToLowerInvariant().Substring(0,16) } finally { $hashAlgorithm.Dispose() }
$buildRoot = Join-Path $projectRoot 'build/rhwp-engine'
$sourceRoot = Join-Path $buildRoot ('source-' + $sourceId)
$prepared = Join-Path $sourceRoot '.jueony-prepared.json'
if (-not (Test-Path -LiteralPath $prepared)) {
    if (Test-Path -LiteralPath $sourceRoot) { throw "Incomplete source directory exists; inspect it before retrying: $sourceRoot" }
    New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
    $archive = Join-Path $buildRoot ('source-' + $sourceId + '.tar')
    # Export tracked build inputs only. Never modify the reference checkout or copy its Git history.
    & git -C $reference archive --format=tar -o $archive $baseCommit -- src crates vendor tools/rhwp-subsecond bindings/Native tools/batch-convert tools/llm_verifier/verdict_protocol tools/llm_verifier/claim_bind tools/llm_verifier/criteria_decomp scripts Cargo.toml Cargo.lock rust-toolchain.toml LICENSE README.md THIRD_PARTY_LICENSES.md saved/blank2010.hwp assets/logo mydocs/manual/agent_knowledge_map.md mydocs/manual/agent_troubleshooting_guide.md mydocs/manual/recipes mydocs/manual/gym_optional_tool.md mydocs/tech/agent_roadmap/atlas_r1_r200.md llms.txt
    if ($LASTEXITCODE -ne 0) { throw 'Engine source archive failed.' }
    # Python handles UTF-8 Git archive paths consistently on Korean Windows.
    & python.exe -c 'import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2],filter="data")' $archive $sourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Engine source extraction failed.' }
    foreach ($patch in $patches) {
        & git -C $sourceRoot apply --check --whitespace=error-all $patch.FullName
        if ($LASTEXITCODE -ne 0) { throw "Engine patch drift: $($patch.Name)" }
        & git -C $sourceRoot apply --whitespace=error-all $patch.FullName
        if ($LASTEXITCODE -ne 0) { throw "Engine patch failed: $($patch.Name)" }
    }
    @{baseCommit=$baseCommit;patches=$patchEvidence;sourceId=$sourceId} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $prepared -Encoding utf8NoBOM
}
if ($PrepareOnly) { Write-Output $sourceRoot; exit 0 }
if ($Runtime -eq 'Wsl') {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build-document-engine-wsl.sh') -Destination (Join-Path $sourceRoot 'jueony-build-wsl.sh')
    & wsl.exe -d $WslDistribution --cd $sourceRoot -- bash ./jueony-build-wsl.sh $projectRoot.Replace('\','/')
    if ($LASTEXITCODE -ne 0) { throw 'Fresh engine WSL build failed.' }
} else {
$env:RUSTUP_HOME = Join-Path $projectRoot '.tools/rustup'
$env:CARGO_HOME = Join-Path $projectRoot '.tools/cargo'
$env:CARGO = Join-Path $env:CARGO_HOME 'bin/cargo.exe'
$env:CARGO_TARGET_DIR = Join-Path $buildRoot 'target/pr-review'
$bindgen = Join-Path $projectRoot '.tools/downloads/wasm-bindgen-0.2.127-x86_64-pc-windows-msvc/wasm-bindgen.exe'
if (-not (Test-Path -LiteralPath $bindgen)) { throw 'Install official wasm-bindgen 0.2.127 under .tools/downloads first.' }
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
Push-Location $sourceRoot
try {
    # Windows application control blocks the upstream wrapper's temporary Cargo proxy.
    # Execute the installed Cargo directly; both metadata and build remain locked.
    & $env:CARGO metadata --locked --format-version 1 --no-deps | Out-File -LiteralPath (Join-Path $sourceRoot 'cargo-metadata.json') -Encoding utf8NoBOM
    if ($LASTEXITCODE -ne 0) { throw 'Locked Cargo metadata failed.' }
    & $env:CARGO build --locked --target wasm32-unknown-unknown --release --lib -p rhwp
    if ($LASTEXITCODE -ne 0) { throw 'Fresh engine WASM build failed.' }
    & $bindgen --target web --out-dir (Join-Path $sourceRoot 'pkg') --out-name rhwp (Join-Path $env:CARGO_TARGET_DIR 'wasm32-unknown-unknown/release/rhwp.wasm')
    if ($LASTEXITCODE -ne 0) { throw 'Fresh engine WASM bindings failed.' }
} finally { Pop-Location }
}
$pkg = Join-Path $sourceRoot 'pkg'
Copy-Item -LiteralPath (Join-Path $sourceRoot 'LICENSE') -Destination (Join-Path $pkg 'LICENSE')
'{"name":"@jueony/rhwp-engine-review","version":"0.8.7","type":"module","main":"rhwp.js","types":"rhwp.d.ts","license":"MIT"}' | Set-Content -LiteralPath (Join-Path $pkg 'package.json') -Encoding utf8NoBOM
$manifest = @{baseCommit=$baseCommit;patches=$patchEvidence;sourceId=$sourceId;builtAt=[DateTime]::UtcNow.ToString('o');optimized=$false;buildMode=($Runtime.ToLowerInvariant()+'-review-no-opt');wasmSha256=(Get-FileHash -LiteralPath (Join-Path $pkg 'rhwp_bg.wasm') -Algorithm SHA256).Hash.ToLowerInvariant();jsSha256=(Get-FileHash -LiteralPath (Join-Path $pkg 'rhwp.js') -Algorithm SHA256).Hash.ToLowerInvariant()}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $pkg 'jueony-engine-build.json') -Encoding utf8NoBOM
Write-Output "JUEONY_ENGINE_PACKAGE=$pkg"
