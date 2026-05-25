# ============================================================
#  build_installer.ps1
#  Full build pipeline: Rust release -> deps -> Inno Setup -> .exe
#
#  Run from the project root:
#    cd D:\tongass\hammer
#    .\installer\build_installer.ps1
#
#  Or from the installer folder:
#    cd D:\tongass\hammer\installer
#    .\build_installer.ps1
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- Paths -----------------------------------------------------------
$ScriptDir  = $PSScriptRoot
$ProjectDir = Split-Path $ScriptDir -Parent          # hammer\
$OutputDir  = Join-Path $ProjectDir "installer-output"
$DepsDir    = Join-Path $ScriptDir  "deps"
$IssFile    = Join-Path $ScriptDir  "hammer_setup.iss"

# ---- Step 0: make sure we are in the project dir -------------------
Set-Location $ProjectDir
Write-Host "`n=== Hammer Installer Build ===" -ForegroundColor Cyan

# ---- Step 1: prepare app icon (.ico) --------------------------------
Write-Host "`n[1/5] Preparing app icon..." -ForegroundColor Yellow
$WorkspaceDir = Split-Path $ProjectDir -Parent
$IconPng = Join-Path $ProjectDir "icon.png"
$IconIco = Join-Path $DepsDir "hammer.ico"

function New-ResizedPngBytes {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePng,
        [Parameter(Mandatory = $true)][int]$Size
    )

    try {
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    } catch {
        throw "System.Drawing not available; cannot resize icon."
    }

    $src = [System.Drawing.Image]::FromFile($SourcePng)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $bmp.SetResolution($src.HorizontalResolution, $src.VerticalResolution)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $scale = [Math]::Min([double]$Size / $src.Width, [double]$Size / $src.Height)
    $newW = [int][Math]::Round($src.Width * $scale)
    $newH = [int][Math]::Round($src.Height * $scale)
    $x = [int](($Size - $newW) / 2)
    $y = [int](($Size - $newH) / 2)
    $g.DrawImage($src, $x, $y, $newW, $newH)

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()

    $ms.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()

    return $bytes
}

function New-IcoFromPngMulti {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePng,
        [Parameter(Mandatory = $true)][string]$IcoPath,
        [int[]]$Sizes = @(16, 24, 32, 48, 64, 96, 128, 256)
    )

    $sizes = $Sizes | Where-Object { $_ -gt 0 -and $_ -le 256 } | Sort-Object -Unique
    if (-not $sizes -or $sizes.Count -eq 0) {
        throw "No valid icon sizes provided."
    }

    $images = @()
    foreach ($s in $sizes) {
        $images += ,@{ Size = $s; Bytes = (New-ResizedPngBytes -SourcePng $SourcePng -Size $s) }
    }

    $iconCount = $images.Count
    $header = New-Object System.Collections.Generic.List[byte]
    $header.AddRange([byte[]](0, 0, 1, 0))
    $header.AddRange([System.BitConverter]::GetBytes([UInt16]$iconCount))

    $offset = 6 + (16 * $iconCount)
    foreach ($img in $images) {
        $size = [int]$img.Size
        $bytes = [byte[]]$img.Bytes

        $widthByte = if ($size -ge 256) { [byte]0 } else { [byte]$size }
        $heightByte = if ($size -ge 256) { [byte]0 } else { [byte]$size }

        $header.Add($widthByte)
        $header.Add($heightByte)
        $header.Add(0)
        $header.Add(0)
        $header.AddRange([System.BitConverter]::GetBytes([UInt16]1))
        $header.AddRange([System.BitConverter]::GetBytes([UInt16]32))
        $header.AddRange([System.BitConverter]::GetBytes([UInt32]$bytes.Length))
        $header.AddRange([System.BitConverter]::GetBytes([UInt32]$offset))

        $offset += $bytes.Length
    }

    $allBytes = New-Object System.Collections.Generic.List[byte]
    $allBytes.AddRange($header.ToArray())
    foreach ($img in $images) {
        $allBytes.AddRange([byte[]]$img.Bytes)
    }

    [System.IO.File]::WriteAllBytes($IcoPath, $allBytes.ToArray())
}

$null = New-Item -ItemType Directory -Force -Path $DepsDir
if (-not (Test-Path $IconPng)) {
    Write-Error "Icon PNG not found: $IconPng"
    exit 1
}
New-IcoFromPngMulti -SourcePng $IconPng -IcoPath $IconIco
Write-Host "      Icon: $IconIco" -ForegroundColor Green

# ---- Step 2: cargo build --release ----------------------------------
Write-Host "`n[2/5] Building Hammer release binary..." -ForegroundColor Yellow
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "cargo not found. Install Rust from https://rustup.rs"
    exit 1
}
cargo build --release
if ($LASTEXITCODE -ne 0) { Write-Error "cargo build failed"; exit 1 }
Write-Host "      hammer.exe built OK" -ForegroundColor Green

# ---- Step 3: download VC++ 2022 Redist (if not cached) ---------------
Write-Host "`n[3/5] Fetching VC++ 2022 Redistributable (x64)..." -ForegroundColor Yellow
$null = New-Item -ItemType Directory -Force -Path $DepsDir
$VcRedistPath = Join-Path $DepsDir "vc_redist.x64.exe"
if (-not (Test-Path $VcRedistPath)) {
    $VcUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    Write-Host "      Downloading from $VcUrl ..."
    # Use curl.exe (ships with Windows 10/11) - faster than Invoke-WebRequest for large files
    & curl.exe -L -o $VcRedistPath $VcUrl
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to download VC++ Redistributable"; exit 1 }
    Write-Host "      Downloaded: $VcRedistPath" -ForegroundColor Green
} else {
    Write-Host "      Already cached: $VcRedistPath" -ForegroundColor Green
}

# ---- Step 4: locate or install Inno Setup ---------------------------
Write-Host "`n[4/5] Locating Inno Setup compiler..." -ForegroundColor Yellow
$IsccPaths = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 5\ISCC.exe"
)
$Iscc = $null
foreach ($p in $IsccPaths) {
    if (Test-Path $p) { $Iscc = $p; break }
}

if (-not $Iscc) {
    Write-Host "      Inno Setup not found - downloading portable version..." -ForegroundColor Yellow
    $InnoInstallerUrl = "https://jrsoftware.org/download.php/is.exe"
    $InnoInstaller    = Join-Path $env:TEMP "inno_setup_installer.exe"
    Write-Host "      Downloading Inno Setup from $InnoInstallerUrl ..."
    Invoke-WebRequest -Uri $InnoInstallerUrl -OutFile $InnoInstaller -UseBasicParsing
    Write-Host "      Installing Inno Setup silently (requires admin)..."
    Start-Process -FilePath $InnoInstaller -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART" -Wait
    # Re-check after install
    foreach ($p in $IsccPaths) {
        if (Test-Path $p) { $Iscc = $p; break }
    }
    if (-not $Iscc) {
        Write-Error "Inno Setup install completed but ISCC.exe not found. Try restarting the script or installing manually from https://jrsoftware.org/isdl.php"
        exit 1
    }
}
Write-Host "      Using: $Iscc" -ForegroundColor Green

# ---- Step 5: compile the installer ----------------------------------
Write-Host "`n[5/5] Compiling installer with Inno Setup..." -ForegroundColor Yellow
$null = New-Item -ItemType Directory -Force -Path $OutputDir
& $Iscc $IssFile
if ($LASTEXITCODE -ne 0) { Write-Error "Inno Setup compilation failed"; exit 1 }

$Output = Join-Path $OutputDir "hammer-setup.exe"
if (Test-Path $Output) {
    $Size = (Get-Item $Output).Length / 1MB
    Write-Host "`n=== Done! ===" -ForegroundColor Cyan
    Write-Host "    Installer: $Output" -ForegroundColor Green
    Write-Host "    Size:      $([math]::Round($Size, 1)) MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "The installer will:" -ForegroundColor White
    Write-Host "  - Install VC++ 2022 Redistributable silently (if not present)"
    Write-Host "  - Copy hammer.exe to Program Files\Hammer"
    Write-Host "  - Add Start Menu shortcut"
    Write-Host "  - Optionally add Desktop shortcut"
    Write-Host "  - Register an uninstaller in Add/Remove Programs"
} else {
    Write-Error "Expected output not found: $Output"
    exit 1
}
