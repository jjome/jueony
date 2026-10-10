param([ValidateSet('Protect','Unprotect')][string]$Mode)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Security
    $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
    $entropy = [Text.Encoding]::UTF8.GetBytes('Jueony.Connections.v1')
    if ($Mode -eq 'Protect') {
        $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else {
        $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    }
    [Console]::Out.Write([Convert]::ToBase64String($result))
} catch { exit 1 }
finally {
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($result) { [Array]::Clear($result, 0, $result.Length) }
}
