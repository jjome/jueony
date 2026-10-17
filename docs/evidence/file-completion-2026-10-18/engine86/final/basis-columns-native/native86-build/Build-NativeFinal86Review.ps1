param(
 [switch]$Build,
 [Parameter(Mandatory=$true)][string]$Frontend,
 [Parameter(Mandatory=$true)][string]$EnginePackage,
 [Parameter(Mandatory=$true)][string]$ExpectedSource,
 [Parameter(Mandatory=$true)][string]$ExpectedWasmSha256
)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$editor=Join-Path $repo 'apps/editor';$production=Join-Path $editor 'src-tauri'
if(-not[IO.Path]::IsPathRooted($Frontend) -or -not[IO.Path]::IsPathRooted($EnginePackage)){throw 'Explicit absolute frontend and engine package paths required'}
$front=[IO.Path]::GetFullPath($Frontend)
$pkg=[IO.Path]::GetFullPath($EnginePackage)
$expectedSource=$ExpectedSource;$expectedWasm=$ExpectedWasmSha256.ToLowerInvariant()
$node='C:/Users/jjome/AppData/Local/Volta/tools/image/node/22.22.2/node.exe';$cli=Join-Path $editor 'node_modules/@tauri-apps/cli/tauri.js'
$project=Join-Path $PSScriptRoot 'project';$source=Join-Path $project 'src-tauri'
$cache=Join-Path $production 'target';$binaryName='jueony-native-final86-review'
$built=Join-Path $cache ('debug/'+$binaryName+'.exe');$destination=Join-Path $PSScriptRoot 'JueonyNativeFinal86Review.exe'
foreach($path in @($node,$cli,(Join-Path $front 'index.html'),(Join-Path $front 'editor.html'),(Join-Path $front 'build-evidence.json'))){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "Missing required file: $path"}}
if(Test-Path -LiteralPath $destination){throw 'Unique review output already exists; refusing overwrite'}
if(Test-Path -LiteralPath $built){throw 'Unique native cache binary already exists; refusing overwrite'}
function Sha([string]$Path){(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Proof([string]$Root){@(Get-ChildItem -LiteralPath $Root -Recurse -File | Sort-Object FullName | ForEach-Object {[ordered]@{path=[IO.Path]::GetRelativePath($Root,$_.FullName).Replace('\','/');bytes=$_.Length;sha256=(Sha $_.FullName)}})}
$evidence=Get-Content -LiteralPath (Join-Path $front 'build-evidence.json') -Raw | ConvertFrom-Json
if($evidence.engineBuild.sourceId -cne $expectedSource -or $evidence.engineWasmSha256 -cne $expectedWasm){throw 'Final86 frontend provenance mismatch'}
$wasms=@(Get-ChildItem -LiteralPath $front -Filter 'rhwp_bg*.wasm' -Recurse -File)
if($wasms.Count -ne 1 -or (Sha $wasms[0].FullName) -cne $expectedWasm){throw 'Actual embedded final86 WASM mismatch'}

$meta=Get-Content -Raw -LiteralPath (Join-Path $pkg 'jueony-engine-build.json') | ConvertFrom-Json
if($meta.sourceId -cne $expectedSource -or (Sha (Join-Path $pkg 'rhwp_bg.wasm')) -cne $expectedWasm -or (Sha (Join-Path $pkg 'rhwp.js')) -cne $meta.jsSha256){throw 'Final86 engine package provenance mismatch'}
$frontBefore=Proof $front
$productionInputs=@('Cargo.toml','Cargo.lock','build.rs','tauri.conf.json')
foreach($folder in @('src','capabilities','icons')){
 $productionInputs+=@(Get-ChildItem -LiteralPath (Join-Path $production $folder) -Recurse -File | ForEach-Object {[IO.Path]::GetRelativePath($production,$_.FullName).Replace('\','/')})
}
$productionInputs=@($productionInputs | Sort-Object -Unique)
foreach($required in @('src/main.rs','src/storage.rs','src/native_recents.rs','src/file_bindings.rs','src/document_windows.rs')){
 if($productionInputs -notcontains $required){throw "Current native command/service input missing: $required"}
}
if(Test-Path -LiteralPath $project){throw 'Isolated project already exists; refusing input replacement. Use a fresh review directory.'}
$sourceBefore=@($productionInputs | ForEach-Object {[ordered]@{path=$_;sha256=(Sha (Join-Path $production $_))}})
$oldExePaths=@((Join-Path $production 'target/debug/jueony-editor.exe'))
foreach($oldDir in @(Get-ChildItem -LiteralPath (Join-Path $repo 'build') -Directory | Where-Object {$_.Name.StartsWith('native')})){
 $oldExePaths+=@(Get-ChildItem -LiteralPath $oldDir.FullName -Filter '*.exe' -File | ForEach-Object FullName)
}
$oldExeProof=@($oldExePaths | Where-Object {Test-Path -LiteralPath $_ -PathType Leaf} | Sort-Object -Unique | ForEach-Object {[ordered]@{path=$_;bytes=(Get-Item -LiteralPath $_).Length;sha256=(Sha $_)}})
New-Item -ItemType Directory -Path $source -Force | Out-Null
foreach($file in @('Cargo.toml','Cargo.lock','build.rs','tauri.conf.json')){Copy-Item -LiteralPath (Join-Path $production $file) -Destination (Join-Path $source $file)}
foreach($folder in @('src','capabilities','icons')){Copy-Item -LiteralPath (Join-Path $production $folder) -Destination (Join-Path $source $folder) -Recurse}
Copy-Item -LiteralPath (Join-Path $editor 'LICENSE.txt') -Destination (Join-Path $project 'LICENSE.txt')
'{"name":"jueony-native-final86-review","private":true,"version":"0.0.1"}' | Set-Content -LiteralPath (Join-Path $project 'package.json') -Encoding utf8
$cargoPath=Join-Path $source 'Cargo.toml';$cargo=Get-Content -Raw -LiteralPath $cargoPath
if($cargo.Split('publish = false').Count -ne 2){throw 'Native manifest baseline changed'}
$cargo=$cargo.Replace('publish = false',"publish = false`nautobins = false")+"`n[[bin]]`nname = `"$binaryName`"`npath = `"src/main.rs`"`n"
[IO.File]::WriteAllText($cargoPath,$cargo,[Text.UTF8Encoding]::new($false))
$relative=[IO.Path]::GetRelativePath($source,$front).Replace('\','/')
if([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':')){throw 'frontendDist must be relative embedded PathBuf, never an absolute file URL'}
$config=[ordered]@{productName='Jueony Native Final86 Review';mainBinaryName=$binaryName;identifier='local.jueony.nativefinal86review20261018';bundle=@{active=$false};build=@{frontendDist=$relative};app=@{windows=@(@{label='main';url='index.html';title='Jueony Native Final86 Review 20261018';width=1440;height=960;minWidth=980;minHeight=640;dragDropEnabled=$false})}}
$configPath=Join-Path $PSScriptRoot 'tauri-final86-review.conf.json';$config|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $configPath -Encoding utf8
$frontBefore|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'frontend-before.json') -Encoding utf8
$sourceBefore|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'production-source-before.json') -Encoding utf8
$oldExeProof|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'existing-exes-before.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $source 'capabilities/main.json') -Destination (Join-Path $PSScriptRoot 'source-capabilities.json')
$permissions=(Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'source-capabilities.json')|ConvertFrom-Json).permissions
if($permissions -notcontains 'core:window:allow-destroy'){throw 'Required explicit recovery close capability missing'}
$command=@($cli,'build','--debug','--no-bundle','--ci','--config',$configPath,'--','--offline','--locked','--bin',$binaryName)
[ordered]@{status='PREPARED_NOT_BUILT';frontend=$front;engineSourceId=$expectedSource;wasmSha256=$expectedWasm;nativeExe=$destination;config=$configPath;project=$project;source=$source;cargoTargetCache=$cache;node=$node;arguments=$command;cwd=$project;gui='NOT_LAUNCHED';nativeGuiValidation='NOT_RUN';scope='Current Windows main/FileBindings/WindowStore source compile with exact final86 frontend; file-preview only, no API backend included; distinct identifier, no old review data migration';oldExesPreserved=$oldExeProof} | ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'preparation.json') -Encoding utf8
if(-not $Build){Write-Output 'Prepared only';return}
$saved=@{};foreach($key in @('RUSTUP_HOME','CARGO_HOME','CARGO_TARGET_DIR','CARGO_NET_OFFLINE','PATH')){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$started=Get-Date
try{
 $env:RUSTUP_HOME=Join-Path $repo '.tools/rustup';$env:CARGO_HOME=Join-Path $repo '.tools/cargo';$env:CARGO_TARGET_DIR=$cache;$env:CARGO_NET_OFFLINE='true';$env:PATH=(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
 Push-Location $project
 try{& $node @command *> (Join-Path $PSScriptRoot 'native-build.log');$buildExit=$LASTEXITCODE}finally{Pop-Location}
 if($buildExit -ne 0){throw "Native build failed ($buildExit); source and native-build.log preserved; nothing launched or substituted"}
 if(-not(Test-Path -LiteralPath $built -PathType Leaf)){throw 'Successful CLI exit without the expected unique native binary'}
 $frontAfter=Proof $front
 if(($frontBefore|ConvertTo-Json -Depth 6 -Compress) -cne ($frontAfter|ConvertTo-Json -Depth 6 -Compress)){throw 'Immutable final86 frontend changed'}
 foreach($entry in $sourceBefore){if((Sha (Join-Path $production $entry.path)) -cne $entry.sha256){throw "Production native input changed: $($entry.path)"}}
 foreach($entry in $oldExeProof){if((Sha $entry.path) -cne $entry.sha256){throw "Prior executable changed: $($entry.path)"}}
 if((Sha (Join-Path $source 'Cargo.lock')) -cne (Sha (Join-Path $production 'Cargo.lock'))){throw 'Copied native lockfile changed'}
 Copy-Item -LiteralPath $built -Destination $destination
 $frontAfter|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'frontend-after.json') -Encoding utf8
 $compiled=@(Get-ChildItem -LiteralPath (Join-Path $cache 'debug/build') -Filter 'capabilities.json' -Recurse -File | Where-Object LastWriteTime -ge $started | Sort-Object LastWriteTime -Descending)
 if($compiled.Count -lt 1){throw 'Compiled capability evidence not found; binary remains unlaunched'}
 Copy-Item -LiteralPath $compiled[0].FullName -Destination (Join-Path $PSScriptRoot 'compiled-capabilities.json')
 $compiledCapability=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'compiled-capabilities.json') | ConvertFrom-Json
 if($compiledCapability.'main-editor'.permissions -notcontains 'core:window:allow-destroy'){throw 'Compiled recovery-close capability mismatch'}
 [ordered]@{status='BUILT_NOT_GUI_TESTED';createdAt=[DateTime]::UtcNow.ToString('o');binary=$destination;binarySha256=(Sha $destination);binaryBytes=(Get-Item -LiteralPath $destination).Length;frontend=$front;frontendFiles=$frontBefore.Count;frontendUnchanged=$true;engineSourceId=$expectedSource;wasmSha256=$expectedWasm;configSha256=(Sha $configPath);productionSourceUnchanged=$true;oldExesUnchanged=$true;oldExeCount=$oldExeProof.Count;lockfileUnchanged=$true;sourceCapabilitySha256=(Sha (Join-Path $PSScriptRoot 'source-capabilities.json'));compiledCapabilitySha256=(Sha (Join-Path $PSScriptRoot 'compiled-capabilities.json'));offline=$true;locked=$true;windowsCargoOnly=$true;gui='NOT_LAUNCHED';actualNativeValidation='NOT_RUN';appApproval='A new executable may require separate app approval; previous approval timeout is not treated as resolved';apiBackend='NOT_INCLUDED';serviceInputs=@('src/main.rs','src/storage.rs','src/native_recents.rs','src/file_bindings.rs','src/document_windows.rs');notes='Isolated source copy and unique Cargo bin prevent replacement of original default cache executable and prior51/65/68 review executables. No app was launched, installed or terminated.'} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-result.json') -Encoding utf8
 Write-Output $destination
}finally{foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}}
