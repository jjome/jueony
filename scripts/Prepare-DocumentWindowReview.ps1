param([Parameter(Mandatory=$true)][string]$Dist,[switch]$Build)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distPath=(Resolve-Path -LiteralPath $Dist).Path
if(!(Test-Path -LiteralPath (Join-Path $distPath 'index.html')) -or !(Test-Path -LiteralPath (Join-Path $distPath 'build-evidence.json'))){throw '검수 프런트엔드와 지문이 필요합니다.'}
$reviewId=[guid]::NewGuid().ToString('N')
$output=Join-Path $repo ('build/document-window-native-review/'+$reviewId)
New-Item -ItemType Directory -Path $output | Out-Null
$configPath=Join-Path $output 'tauri-review.json'
$manifestPath=Join-Path $output 'manifest.json'
$utf8=New-Object System.Text.UTF8Encoding($false)
function Write-ReviewJson($path,$value){[IO.File]::WriteAllText($path,($value|ConvertTo-Json -Depth 10),$utf8)}
# Tauri accepts either a directory or a URL here. A Windows drive prefix can
# deserialize as a URL and show a file:// directory listing instead of the app.
# Resolve a relative directory from Tauri's config root, also on PowerShell 5.1.
$tauriRoot=Join-Path $repo 'apps/editor/src-tauri'
$baseUri=New-Object System.Uri($tauriRoot+[IO.Path]::DirectorySeparatorChar)
$distUri=New-Object System.Uri($distPath+[IO.Path]::DirectorySeparatorChar)
$frontendDist=[Uri]::UnescapeDataString($baseUri.MakeRelativeUri($distUri).ToString()).TrimEnd('/')
if($frontendDist.Contains(':') -or [IO.Path]::IsPathRooted($frontendDist)){throw '검수 프런트엔드는 Tauri 설정과 같은 드라이브의 상대 디렉터리여야 합니다.'}
$resolvedEntry=[IO.Path]::GetFullPath((Join-Path $tauriRoot ($frontendDist+'/index.html')))
if($resolvedEntry -ne (Join-Path $distPath 'index.html')){throw '검수 프런트엔드 상대 경로가 일치하지 않습니다.'}
$config=@{productName=('Jueony Document Windows Review '+$reviewId.Substring(0,8));identifier=('local.jueony.documentwindows.review'+$reviewId);build=@{frontendDist=$frontendDist};app=@{windows=@(@{label='main';title=('Jueony · 문서 창 격리 검수 '+$reviewId.Substring(0,8));width=1440;height=960;minWidth=980;minHeight=640;dragDropEnabled=$false})}}
Write-ReviewJson $configPath $config
$manifest=@{reviewId=$reviewId;identifier=$config.identifier;dist=$distPath;config=$configPath;launched=$false;status='prepared';offline=$true;locked=$true;scope='새 identifier의 전용 AppData/WebView 저장소. 사용자 앱과 문서는 열거나 닫지 않음.'}
Write-ReviewJson $manifestPath $manifest
if($Build){
 $stdout=Join-Path $output 'stdout.log';$stderr=Join-Path $output 'stderr.log';$log=Join-Path $output 'build.log'
 $manifest.stdout=$stdout;$manifest.stderr=$stderr;$manifest.log=$log;$manifest.status='building'
 [IO.File]::WriteAllText($log,"stdout: $stdout`r`nstderr: $stderr`r`n",$utf8)
 try{
  $env:RUSTUP_HOME=Join-Path $repo '.tools/rustup';$env:CARGO_HOME=Join-Path $repo '.tools/cargo'
  $env:TEMP=Join-Path $output 'temp';$env:TMP=$env:TEMP
  New-Item -ItemType Directory -Path $env:TEMP | Out-Null
  $env:PATH=(Join-Path $repo '.tools/cargo/bin')+';'+$env:PATH
  $env:CARGO_TARGET_DIR=Join-Path $output 'target';$env:CARGO_NET_OFFLINE='true'
  $node=(Get-Command node -ErrorAction Stop).Source
  $lock=Join-Path $repo 'apps/editor/src-tauri/Cargo.lock'
  $manifest.cargoLockSha256=(Get-FileHash -LiteralPath $lock -Algorithm SHA256).Hash.ToLowerInvariant()
  $arguments=@('node_modules/@tauri-apps/cli/tauri.js','build','--ci','--no-bundle','--config',$configPath,'--','--offline','--locked')
  $quoted=($arguments|ForEach-Object{if($_.Contains('"')){throw '빌드 인자의 따옴표는 지원하지 않습니다.'};'"'+$_+'"'}) -join ' '
  $manifest.command=@{program=$node;arguments=$arguments;workingDirectory=(Join-Path $repo 'apps/editor')};Write-ReviewJson $manifestPath $manifest
  # Redirect at process creation: PS 5.1 must not turn ordinary native stderr into NativeCommandError.
  $process=Start-Process -FilePath $node -ArgumentList $quoted -WorkingDirectory (Join-Path $repo 'apps/editor') -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  $null=$process.Handle;$manifest.processId=$process.Id;Write-ReviewJson $manifestPath $manifest
  $process.WaitForExit();$process.Refresh();$manifest.exitCode=$process.ExitCode
  [IO.File]::WriteAllText($log,("=== stdout ===`r`n"+[IO.File]::ReadAllText($stdout)+"`r`n=== stderr ===`r`n"+[IO.File]::ReadAllText($stderr)), $utf8)
  if($manifest.exitCode -ne 0){throw ('네이티브 검수본 빌드 실패, 종료 코드 '+$manifest.exitCode+'. '+$log)}
  if((Get-FileHash -LiteralPath $lock -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.cargoLockSha256){throw 'Cargo.lock이 바뀌어 검수본을 승인하지 않았습니다.'}
  $exe=Join-Path $output ('JueonyDocumentWindowsReview-'+$reviewId+'.exe')
  Copy-Item -LiteralPath (Join-Path $env:CARGO_TARGET_DIR 'release/jueony-editor.exe') -Destination $exe
  $manifest.exe=$exe;$manifest.sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant();$manifest.status='built'
 }catch{
  $manifest.status='failed';$manifest.error=$_.Exception.Message
  if(!(Test-Path -LiteralPath $log)){[IO.File]::WriteAllText($log,$manifest.error,$utf8)}else{[IO.File]::AppendAllText($log,("`r`nERROR: "+$manifest.error),$utf8)}
  Write-ReviewJson $manifestPath $manifest
  Write-Output ('검수 빌드 실패 기록: '+$manifestPath)
  throw
 }finally{Write-ReviewJson $manifestPath $manifest}
}
$manifest|ConvertTo-Json -Depth 10
