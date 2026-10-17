param([Parameter(Mandatory=$true)][string]$Repository)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$build=Join-Path $Repository 'scripts/Build-DocumentEngine.ps1'
$wsl=Join-Path $Repository 'scripts/build-document-engine-wsl.sh'
$baseCommit='1a76570e833917d15817415a53c09ad61ab3203f'
$files=@(Get-ChildItem -LiteralPath (Join-Path $Repository 'engine/patches') -Filter '*.patch' | Sort-Object Name)
# Exact production construction, with no prepare/build/apply/Cargo side effects.
$unordered=@($files | ForEach-Object { @{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$ordered=@($files | ForEach-Object { [ordered]@{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$scriptHash=(Get-FileHash -LiteralPath $build -Algorithm SHA256).Hash
$wslHash=(Get-FileHash -LiteralPath $wsl -Algorithm SHA256).Hash
$unorderedJson=$unordered | ConvertTo-Json -Compress
$orderedJson=$ordered | ConvertTo-Json -Compress
function Digest([string]$text){$h=[System.Security.Cryptography.SHA256]::Create();try{return [Convert]::ToHexString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))).ToLowerInvariant()}finally{$h.Dispose()}}
[ordered]@{pid=$PID;patchCount=$files.Count;buildScriptSha256=$scriptHash.ToLowerInvariant();wslScriptSha256=$wslHash.ToLowerInvariant();unorderedPatchJson=$unorderedJson;unorderedPatchJsonSha256=(Digest $unorderedJson);unorderedSourceId=(Digest ($baseCommit+$unorderedJson+$scriptHash+$wslHash)).Substring(0,16);orderedPatchJson=$orderedJson;orderedPatchJsonSha256=(Digest $orderedJson);orderedSerializationOnlySourceId=(Digest ($baseCommit+$orderedJson+$scriptHash+$wslHash)).Substring(0,16);note='Read-only sourceId reproduction using current unchanged Build script hash; ordered control does not predict a changed Build script own hash.'}|ConvertTo-Json -Depth 4
