# Read-only process diagnostics; no window, input, token, or settings mutation.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JueonyProcessTokenDiagnostic {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint id);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr buffer, int length, out int required);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr sid, uint index);
  public static string Read(uint id) {
    IntPtr process=OpenProcess(0x1000, false, id), token=IntPtr.Zero, buffer=IntPtr.Zero;
    if(process==IntPtr.Zero) return "unavailable:OpenProcess:"+Marshal.GetLastWin32Error();
    try {
      if(!OpenProcessToken(process, 0x0008, out token)) return "unavailable:OpenProcessToken:"+Marshal.GetLastWin32Error();
      int required; GetTokenInformation(token, 25, IntPtr.Zero, 0, out required);
      if(required<=0) return "unavailable:TokenIntegrityLevel:"+Marshal.GetLastWin32Error();
      buffer=Marshal.AllocHGlobal(required);
      if(!GetTokenInformation(token,25,buffer,required,out required)) return "unavailable:TokenIntegrityLevel:"+Marshal.GetLastWin32Error();
      IntPtr sid=Marshal.ReadIntPtr(buffer);
      byte count=Marshal.ReadByte(GetSidSubAuthorityCount(sid));
      if(count==0) return "unavailable:SID";
      uint rid=unchecked((uint)Marshal.ReadInt32(GetSidSubAuthority(sid,(uint)(count-1))));
      string level=rid<0x1000?"untrusted":rid<0x2000?"low":rid<0x3000?"medium":rid<0x4000?"high":"system";
      return level+" (0x"+rid.ToString("X")+")";
    } finally {
      if(buffer!=IntPtr.Zero) Marshal.FreeHGlobal(buffer);
      if(token!=IntPtr.Zero) CloseHandle(token);
      CloseHandle(process);
    }
  }
}
'@
$nativeProcesses = Get-Process -Name Hwp,Codex -ErrorAction SilentlyContinue
$nativeProcesses | ForEach-Object {
  [pscustomobject]@{
    process = $_.ProcessName
    id = $_.Id
    session = $_.SessionId
    responding = $_.Responding
    integrity = [JueonyProcessTokenDiagnostic]::Read([uint32]$_.Id)
  }
} | ConvertTo-Json -Depth 3
