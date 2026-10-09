[CmdletBinding(SupportsShouldProcess)]
param()
$ErrorActionPreference = 'Stop'
try {
    $source = (Get-Item -LiteralPath (Split-Path -Parent $PSScriptRoot)).FullName
    if ((Split-Path -Leaf $source) -eq 'jueony') {
        Write-Output "Already renamed: $source"
        exit 0
    }
    if ((Split-Path -Leaf $source) -ne 'joouni' -or
        (Get-Item -LiteralPath $source).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint) -or
        -not (Test-Path -LiteralPath (Join-Path $source '.git')) -or
        -not (Test-Path -LiteralPath (Join-Path $source 'Start-Jueony.cmd'))) {
        throw 'This script must be inside the original joouni project folder.'
    }
    $parent = Split-Path -Parent $source
    $destination = [IO.Path]::GetFullPath((Join-Path $parent 'jueony'))
    if ((Split-Path -Parent $destination) -ne $parent -or (Test-Path -LiteralPath $destination)) {
        throw "Destination already exists or is invalid: $destination. No files were moved."
    }
    Set-Location -LiteralPath $parent
    if ($PSCmdlet.ShouldProcess($source, "Rename folder to $destination")) {
        # Stop only this project's static Rust server; browser documents are not touched.
        $launcher = Join-Path $source 'build\jueony-preview\JueonyEditor.exe'
        Get-CimInstance Win32_Process -Filter "Name = 'JueonyEditor.exe'" |
            Where-Object { $_.ExecutablePath -eq $launcher } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
        Rename-Item -LiteralPath $source -NewName 'jueony'
        Write-Output "Renamed: $destination"
        Write-Output "Run: $destination\Start-Jueony.cmd"
        Write-Output 'In Codex, use Edit project to select the new folder before starting a new chat.'
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Close Codex, editor and terminal windows using this folder, then run Rename-Folder-to-Jueony.cmd again.'
    exit 1
}
