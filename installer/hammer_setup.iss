; ============================================================
;  Hammer - Inno Setup Installer Script
;  Builds a self-contained Windows installer for hammer.exe
; ============================================================

#define AppName      "Hammer"
#define AppVersion   "0.1.0"
#define AppPublisher "Tongass"
#define AppExeName   "hammer.exe"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppId={{B4F2A1C3-8D7E-4F2A-9B1C-3E5D7F8A2C4B}
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
OutputDir=..\installer-output
OutputBaseFilename=hammer
SetupIconFile=deps\hammer.ico
Compression=lzma2/max
SolidCompression=yes
; 64-bit only (matches x86_64-pc-windows-msvc build)
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
; Require Windows 10 or later
MinVersion=10.0.17763
; Uninstaller
UninstallDisplayName={#AppName} {#AppVersion}
UninstallDisplayIcon={app}\hammer.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; Main application binary
Source: "..\target\release\hammer.exe"; DestDir: "{app}"; Flags: ignoreversion

; App icon for shortcuts/uninstaller
Source: "deps\hammer.ico"; DestDir: "{app}"; Flags: ignoreversion

; VC++ 2022 Redistributable - bundled so no internet needed
; (downloaded into installer\deps\ by build_installer.ps1 before compiling)
Source: "deps\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#AppName}";         Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\hammer.ico"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\hammer.ico"
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon; IconFilename: "{app}\hammer.ico"

[Run]
; Launch after install (optional, user can uncheck)
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[Code]
// ----------------------------------------------------------------
//  Check whether VC++ 2022 (14.x) x64 Redistributable is present
// ----------------------------------------------------------------
function VCRedistInstalled: Boolean;
var
  Installed: Cardinal;
  Version:   String;
begin
  // New-style registry key used by VC++ 2015-2022 bundles
  if RegQueryDWordValue(HKLM,
    'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64',
    'Installed', Installed) then
  begin
    if Installed = 1 then
    begin
      // Also verify version >= 14.40 (VS 2022)
      if RegQueryStringValue(HKLM,
        'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64',
        'Version', Version) then
      begin
        // Version looks like "v14.40.33810" - strip leading 'v'
        if Copy(Version, 1, 1) = 'v' then
          Delete(Version, 1, 1);
        Result := (CompareStr(Version, '14.20') >= 0);
        Exit;
      end;
      Result := True;
      Exit;
    end;
  end;
  Result := False;
end;

// ----------------------------------------------------------------
//  Before the install begins: silently run VC++ Redist if needed
// ----------------------------------------------------------------
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  RedistPath: String;
begin
  Result := '';

  if not VCRedistInstalled then
  begin
    Log('VC++ 2022 x64 Redistributable not found - installing silently...');
    RedistPath := ExpandConstant('{tmp}\vc_redist.x64.exe');

    // The file was already extracted to {tmp} by the [Files] section above
    if FileExists(RedistPath) then
    begin
      if not Exec(RedistPath, '/install /quiet /norestart', '', SW_HIDE,
                  ewWaitUntilTerminated, ResultCode) then
      begin
        Result := 'Failed to install the Visual C++ 2022 Redistributable. ' +
                  'Please install it manually from https://aka.ms/vs/17/release/vc_redist.x64.exe ' +
                  'and then re-run this installer.';
      end
      else if (ResultCode <> 0) and (ResultCode <> 3010) then
      begin
        // 3010 = success, reboot required
        Result := 'Visual C++ 2022 Redistributable installer returned code ' +
                  IntToStr(ResultCode) + '. If Hammer does not launch, ' +
                  'please install VC++ 2022 x64 manually.';
      end
      else
      begin
        if ResultCode = 3010 then
          NeedsRestart := True;
        Log('VC++ 2022 x64 Redistributable installed successfully.');
      end;
    end
    else
    begin
      Result := 'Bundled VC++ Redistributable not found at: ' + RedistPath;
    end;
  end
  else
    Log('VC++ 2022 x64 Redistributable already installed - skipping.');
end;
