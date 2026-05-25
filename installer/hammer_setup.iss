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

; VC++ 2022 Redistributable - bundled so no internet needed.
; dontcopy = packed into the installer but NOT auto-extracted; we pull it out
; on demand with ExtractTemporaryFile() in [Code]. This is required because
; PrepareToInstall runs BEFORE the normal [Files] copy step, so a plain
; DestDir:{tmp} entry would not exist yet at the moment we need it.
Source: "deps\vc_redist.x64.exe"; Flags: dontcopy noencryption

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
//  Make the bundled redist available at {tmp}\vc_redist.x64.exe.
//  Primary: extract the copy packed inside this installer (dontcopy).
//  Fallback: if extraction somehow fails, download it from Microsoft.
//  Returns the full path, or '' if it could not be obtained.
// ----------------------------------------------------------------
function ObtainVCRedist: String;
var
  RedistPath: String;
  ResultCode: Integer;
begin
  RedistPath := ExpandConstant('{tmp}\vc_redist.x64.exe');

  // 1) Try to extract the bundled copy on demand.
  if not FileExists(RedistPath) then
  begin
    try
      ExtractTemporaryFile('vc_redist.x64.exe');
    except
      Log('ExtractTemporaryFile(vc_redist.x64.exe) failed: ' + GetExceptionMessage);
    end;
  end;

  // 2) Fallback: download straight from Microsoft (curl ships with Win10/11).
  if not FileExists(RedistPath) then
  begin
    Log('Bundled redist unavailable - downloading from Microsoft...');
    Exec(ExpandConstant('{cmd}'),
      '/c curl.exe -L --fail --silent --show-error -o "' + RedistPath +
      '" https://aka.ms/vs/17/release/vc_redist.x64.exe',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if (ResultCode <> 0) or (not FileExists(RedistPath)) then
    begin
      // Last resort: PowerShell download.
      Exec(ExpandConstant('{cmd}'),
        '/c powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
        '[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;' +
        'Invoke-WebRequest -Uri https://aka.ms/vs/17/release/vc_redist.x64.exe -OutFile ''' +
        RedistPath + ''' -UseBasicParsing"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;

  if FileExists(RedistPath) then
    Result := RedistPath
  else
    Result := '';
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

  if VCRedistInstalled then
  begin
    Log('VC++ 2022 x64 Redistributable already installed - skipping.');
    Exit;
  end;

  Log('VC++ 2022 x64 Redistributable not found - installing silently...');
  RedistPath := ObtainVCRedist;

  if RedistPath = '' then
  begin
    Result := 'Could not obtain the Visual C++ 2022 Redistributable (the bundled ' +
              'copy was unavailable and no internet connection could be reached). ' +
              'Please install it manually from ' +
              'https://aka.ms/vs/17/release/vc_redist.x64.exe and re-run this installer.';
    Exit;
  end;

  if not Exec(RedistPath, '/install /quiet /norestart', '', SW_HIDE,
              ewWaitUntilTerminated, ResultCode) then
  begin
    Result := 'Failed to launch the Visual C++ 2022 Redistributable installer. ' +
              'Please install it manually from ' +
              'https://aka.ms/vs/17/release/vc_redist.x64.exe and re-run this installer.';
  end
  else if (ResultCode = 3010) then
  begin
    NeedsRestart := True;
    Log('VC++ 2022 x64 Redistributable installed - restart required.');
  end
  else if (ResultCode <> 0) and (ResultCode <> 1638) and (ResultCode <> 5100) then
  begin
    // 1638 / 5100 = a same-or-newer version is already present; treat as OK.
    Result := 'Visual C++ 2022 Redistributable installer returned code ' +
              IntToStr(ResultCode) + '. If Hammer does not launch, please ' +
              'install VC++ 2022 x64 manually.';
  end
  else
    Log('VC++ 2022 x64 Redistributable installed successfully.');
end;
