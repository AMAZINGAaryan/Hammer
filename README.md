# Hammer

A fast, focused **Windows load-testing app** written in pure Rust. Enter a domain
you control, Hammer auto-discovers its pages from the sitemap, and blasts them at
high concurrency with live throughput stats. One engine, one `.exe`, no runtime
to install.

> Authorized testing only. Use Hammer against domains you own or have explicit
> permission to load test.

## Download

**[Download the Windows installer](https://github.com/AMAZINGAaryan/Hammer/releases/latest/download/hammer.exe)**
— or visit the [download page](https://amazingaaryan.github.io/Hammer/).

The installer:

- Installs the **Visual C++ 2022 Redistributable** silently if missing (bundled,
  no internet needed on the target PC).
- Installs `hammer.exe` to `Program Files\Hammer`.
- Adds Start Menu and optional Desktop shortcuts, plus an uninstaller.

The app renders its GUI through **wgpu**, which falls back to Windows' built-in
**WARP** software renderer — so it works on bare VMs, RDP sessions, and machines
with no GPU driver, with nothing extra to install.

## Features

- **Up to 100,000 workers**, with machine-aware presets (Light / Medium / Heavy /
  MAX) and a logarithmic slider. The app detects your CPU count and recommends a
  starting value.
- **Sitemap discovery** with fallback to common paths.
- **Keep-alive connection pooling** that scales with the worker count.
- **Live stats**: throughput (req/s), success rate, data received, elapsed time.
- **Headless CLI mode** for scripting:
  ```
  hammer.exe cli <domain> <concurrency> <seconds> [insecure]
  ```

## A note on very high worker counts

The real ceiling on *concurrent connections* is your OS ephemeral port range
(~16k by default on Windows). Beyond ~28k workers Hammer reuses pooled keep-alive
connections rather than opening new sockets, so more workers raise sustained
pressure but do not create unlimited simultaneous sockets. Run high counts on a
strong machine and watch CPU/RAM.

## Build from source

```powershell
cargo build --release
# Build the installer (downloads VC++ redist + uses Inno Setup):
.\installer\build_installer.ps1
```

Requirements: Rust (stable, MSVC toolchain) and [Inno Setup 6](https://jrsoftware.org/isdl.php)
(the build script will fetch it if missing).
