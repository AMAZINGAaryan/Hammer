use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

fn main() -> io::Result<()> {
    // Rebuild if the source icon or prebuilt ICO changes.
    println!("cargo:rerun-if-changed=icon.png");
    println!("cargo:rerun-if-changed=installer/deps/hammer.ico");

    if !cfg!(windows) {
        return Ok(());
    }

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let icon_png = manifest_dir.join("icon.png");
    let prebuilt_ico = manifest_dir.join("installer").join("deps").join("hammer.ico");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let icon_ico = out_dir.join("hammer.ico");

    let icon_for_winres = if prebuilt_ico.exists() {
        prebuilt_ico
    } else {
        write_ico_from_png(&icon_png, &icon_ico)?;
        icon_ico
    };

    let mut res = winres::WindowsResource::new();
    res.set_icon(icon_for_winres.to_str().unwrap());
    res.compile()?;

    Ok(())
}

fn write_ico_from_png(png_path: &Path, ico_path: &Path) -> io::Result<()> {
    let png = fs::read(png_path)?;
    let (width, height) = read_png_dimensions(&png)?;

    if width == 0 || height == 0 || width > 256 || height > 256 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "icon.png must be between 1x1 and 256x256",
        ));
    }

    let width_byte: u8 = if width >= 256 { 0 } else { width as u8 };
    let height_byte: u8 = if height >= 256 { 0 } else { height as u8 };

    let img_size = png.len() as u32;
    let offset = 6 + 16;

    let mut header = Vec::with_capacity(offset + png.len());
    header.extend_from_slice(&[0, 0, 1, 0, 1, 0]);
    header.push(width_byte);
    header.push(height_byte);
    header.push(0);
    header.push(0);
    header.extend_from_slice(&[1, 0]);
    header.extend_from_slice(&[32, 0]);
    header.extend_from_slice(&img_size.to_le_bytes());
    header.extend_from_slice(&(offset as u32).to_le_bytes());

    let mut file = fs::File::create(ico_path)?;
    file.write_all(&header)?;
    file.write_all(&png)?;
    Ok(())
}

fn read_png_dimensions(png: &[u8]) -> io::Result<(u32, u32)> {
    let sig: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if png.len() < 24 || png[..8] != sig {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "icon.png is not a valid PNG",
        ));
    }

    let width = u32::from_be_bytes([png[16], png[17], png[18], png[19]]);
    let height = u32::from_be_bytes([png[20], png[21], png[22], png[23]]);
    Ok((width, height))
}
