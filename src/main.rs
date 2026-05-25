#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// ============================================================
//  HAMMER - local max-load tester (pure Rust, single .exe)
//  Enter a domain -> auto-discovers all pages from sitemap ->
//  hammers at max concurrency with no think time, keep-alive.
//  Live stats. Start / Stop. Engine = tokio + reqwest (no k6).
// ============================================================
use eframe::egui;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Default)]
struct Counters {
    total: AtomicU64,
    ok: AtomicU64,
    fail: AtomicU64,
    bytes: AtomicU64,
}

struct Shared {
    running: AtomicBool,
    counters: Counters,
    started: Mutex<Option<Instant>>,
    status: Mutex<String>,
    pages: Mutex<usize>,
}

impl Default for Shared {
    fn default() -> Self {
        Shared {
            running: AtomicBool::new(false),
            counters: Counters::default(),
            started: Mutex::new(None),
            status: Mutex::new("idle".to_string()),
            pages: Mutex::new(0),
        }
    }
}

struct App {
    domain: String,
    concurrency: u32,
    insecure: bool,
    cpus: usize,
    shared: Arc<Shared>,
}

// Max workers the slider allows. The real concurrent-connection ceiling is the
// OS ephemeral port range (~16k by default on Windows), but keep-alive + pooling
// reuses connections, so higher worker counts still raise sustained pressure.
const MAX_WORKERS: u32 = 100_000;

impl Default for App {
    fn default() -> Self {
        let cpus = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        // Machine-aware default: ~1000 workers per logical core, clamped so weak
        // and strong machines both get a sensible starting value.
        let recommended = ((cpus as u32) * 1000).clamp(500, 20_000);
        App {
            domain: String::new(),
            concurrency: recommended,
            insecure: false,
            cpus,
            shared: Arc::new(Shared::default()),
        }
    }
}

// ---- the core async engine (used by both GUI and CLI) ----
async fn run_engine(domain: String, conc: u32, insecure: bool, shared: Arc<Shared>) {
    let mut base = domain.trim().trim_end_matches('/').to_string();
    if !base.starts_with("http://") && !base.starts_with("https://") {
        base = format!("https://{}", base);
    }

    // Let the idle pool grow with the worker count so high concurrency can
    // actually reuse warm keep-alive connections instead of churning sockets.
    let pool_idle = (conc as usize).clamp(256, 50_000);
    let client = match reqwest::Client::builder()
        .pool_max_idle_per_host(pool_idle)
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .timeout(std::time::Duration::from_secs(20))
        .danger_accept_invalid_certs(insecure)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            *shared.status.lock().unwrap() = format!("client error: {}", e);
            shared.running.store(false, Ordering::SeqCst);
            return;
        }
    };

    *shared.status.lock().unwrap() = "discovering pages...".to_string();
    let paths = discover(&client, &base).await;
    *shared.pages.lock().unwrap() = paths.len();
    *shared.status.lock().unwrap() = format!("hammering ({} pages)", paths.len());
    let paths = Arc::new(paths);

    let mut handles = Vec::new();
    for _ in 0..conc {
        let client = client.clone();
        let base = base.clone();
        let paths = paths.clone();
        let shared = shared.clone();
        handles.push(tokio::spawn(async move {
            let uas = USER_AGENTS;
            while shared.running.load(Ordering::Relaxed) {
                let idx = fastrand_idx(paths.len());
                let path = &paths[idx];
                let ua = uas[fastrand_idx(uas.len())];
                let url = format!("{}{}", base, path);
                match client
                    .get(&url)
                    .header("User-Agent", ua)
                    .header("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .header("Cache-Control", "no-cache")
                    .send()
                    .await
                {
                    Ok(resp) => {
                        let st = resp.status().as_u16();
                        let body = resp.bytes().await.map(|b| b.len()).unwrap_or(0);
                        shared.counters.bytes.fetch_add(body as u64, Ordering::Relaxed);
                        shared.counters.total.fetch_add(1, Ordering::Relaxed);
                        if (200..400).contains(&st) {
                            shared.counters.ok.fetch_add(1, Ordering::Relaxed);
                        } else {
                            shared.counters.fail.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    Err(_) => {
                        shared.counters.total.fetch_add(1, Ordering::Relaxed);
                        shared.counters.fail.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }));
    }
    for h in handles {
        let _ = h.await;
    }
    *shared.status.lock().unwrap() = "stopped".to_string();
}

// GUI launches the engine on its own thread + runtime
fn spawn_engine(domain: String, conc: u32, insecure: bool, shared: Arc<Shared>) {
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread().enable_all().build() {
            Ok(r) => r,
            Err(e) => {
                *shared.status.lock().unwrap() = format!("runtime error: {}", e);
                shared.running.store(false, Ordering::SeqCst);
                return;
            }
        };
        rt.block_on(run_engine(domain, conc, insecure, shared));
    });
}

fn fastrand_idx(n: usize) -> usize {
    if n == 0 {
        return 0;
    }
    use rand::Rng;
    rand::thread_rng().gen_range(0..n)
}

const USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
];

const COMMON: &[&str] = &[
    "/", "/about/", "/about-us/", "/contact/", "/contact-us/", "/services/",
    "/products/", "/solutions/", "/blog/", "/news/", "/pricing/", "/faq/",
    "/team/", "/careers/", "/industries/", "/technologies/",
];

// fetch sitemap.xml -> paths; fallback to homepage links, then COMMON
async fn discover(client: &reqwest::Client, base: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let candidates = ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"];
    let mut subs: Vec<String> = Vec::new();

    for c in candidates {
        if let Ok(resp) = client.get(format!("{}{}", base, c)).send().await {
            if resp.status().is_success() {
                if let Ok(text) = resp.text().await {
                    for loc in extract_locs(&text) {
                        if loc.ends_with(".xml") {
                            subs.push(loc);
                        } else if let Some(p) = to_path(&loc) {
                            if !out.contains(&p) {
                                out.push(p);
                            }
                        }
                    }
                }
            }
        }
        if !out.is_empty() || !subs.is_empty() {
            break;
        }
    }

    for (i, sm) in subs.iter().enumerate() {
        if i >= 10 {
            break;
        }
        if let Ok(resp) = client.get(sm).send().await {
            if resp.status().is_success() {
                if let Ok(text) = resp.text().await {
                    for loc in extract_locs(&text) {
                        if let Some(p) = to_path(&loc) {
                            if !out.contains(&p) {
                                out.push(p);
                            }
                        }
                    }
                }
            }
        }
    }

    if out.is_empty() {
        out = COMMON.iter().map(|s| s.to_string()).collect();
    }
    if out.len() > 300 {
        out.truncate(300);
    }
    out
}

fn extract_locs(xml: &str) -> Vec<String> {
    let mut v = Vec::new();
    let bytes = xml.as_bytes();
    let mut i = 0;
    let open = b"<loc>";
    let close = b"</loc>";
    while i + open.len() < bytes.len() {
        if &bytes[i..i + open.len()] == open {
            let start = i + open.len();
            if let Some(end) = find(&bytes[start..], close) {
                let s = &xml[start..start + end];
                v.push(s.trim().to_string());
                i = start + end + close.len();
                continue;
            }
        }
        i += 1;
    }
    v
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    for i in 0..=hay.len() - needle.len() {
        if &hay[i..i + needle.len()] == needle {
            return Some(i);
        }
    }
    None
}

fn to_path(url: &str) -> Option<String> {
    // strip scheme://host, keep path (+query)
    let rest = if let Some(p) = url.find("://") {
        &url[p + 3..]
    } else {
        url
    };
    match rest.find('/') {
        Some(slash) => Some(rest[slash..].to_string()),
        None => Some("/".to_string()),
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let running = self.shared.running.load(Ordering::Relaxed);
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("HAMMER - local max-load tester");
            ui.label("Authorized load testing. Enter a domain you control.");
            ui.add_space(10.0);

            ui.horizontal(|ui| {
                ui.label("Domain:");
                ui.add_enabled(
                    !running,
                    egui::TextEdit::singleline(&mut self.domain)
                        .hint_text("example.com")
                        .desired_width(280.0),
                );
            });

            ui.horizontal(|ui| {
                ui.label("Concurrency:");
                ui.add_enabled(
                    !running,
                    egui::Slider::new(&mut self.concurrency, 50..=MAX_WORKERS)
                        .logarithmic(true)
                        .text("workers"),
                );
            });

            // Machine-aware presets - pick a level that fits your hardware.
            ui.horizontal(|ui| {
                ui.label("Presets:");
                let presets: [(&str, u32); 4] = [
                    ("Light 1K", 1_000),
                    ("Medium 10K", 10_000),
                    ("Heavy 50K", 50_000),
                    ("MAX 100K", MAX_WORKERS),
                ];
                for (label, value) in presets {
                    if ui
                        .add_enabled(!running, egui::Button::new(label))
                        .clicked()
                    {
                        self.concurrency = value;
                    }
                }
            });

            ui.label(
                egui::RichText::new(format!(
                    "This machine: {} logical CPUs detected. Recommended start: {}.",
                    self.cpus,
                    ((self.cpus as u32) * 1000).clamp(500, 20_000)
                ))
                .small()
                .weak(),
            );

            // Warn once the worker count exceeds the typical Windows ephemeral
            // port range - past this point connections are reused, not added.
            if self.concurrency > 28_000 {
                ui.label(
                    egui::RichText::new(
                        "High worker count: beyond ~28K, Windows reuses pooled \
                         keep-alive connections rather than opening new sockets. \
                         Use a strong machine and watch CPU/RAM.",
                    )
                    .small()
                    .color(egui::Color32::from_rgb(255, 170, 60)),
                );
            }

            ui.add_space(6.0);
            ui.add_enabled(
                !running,
                egui::Checkbox::new(&mut self.insecure, "Accept invalid/self-signed TLS (staging sites)"),
            );

            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if !running {
                    if ui
                        .add_sized([120.0, 36.0], egui::Button::new("START"))
                        .clicked()
                        && !self.domain.trim().is_empty()
                    {
                        // reset counters
                        self.shared.counters.total.store(0, Ordering::SeqCst);
                        self.shared.counters.ok.store(0, Ordering::SeqCst);
                        self.shared.counters.fail.store(0, Ordering::SeqCst);
                        self.shared.counters.bytes.store(0, Ordering::SeqCst);
                        *self.shared.started.lock().unwrap() = Some(Instant::now());
                        self.shared.running.store(true, Ordering::SeqCst);
                        spawn_engine(self.domain.clone(), self.concurrency, self.insecure, self.shared.clone());
                    }
                } else {
                    if ui
                        .add_sized([120.0, 36.0], egui::Button::new("STOP"))
                        .clicked()
                    {
                        self.shared.running.store(false, Ordering::SeqCst);
                    }
                }
            });

            ui.add_space(14.0);
            ui.separator();
            ui.add_space(8.0);

            let total = self.shared.counters.total.load(Ordering::Relaxed);
            let ok = self.shared.counters.ok.load(Ordering::Relaxed);
            let fail = self.shared.counters.fail.load(Ordering::Relaxed);
            let bytes = self.shared.counters.bytes.load(Ordering::Relaxed);
            let elapsed = self
                .shared
                .started
                .lock()
                .unwrap()
                .map(|s| s.elapsed().as_secs_f64())
                .unwrap_or(0.0);
            let rps = if elapsed > 0.0 {
                total as f64 / elapsed
            } else {
                0.0
            };
            let okpct = if total > 0 {
                ok as f64 / total as f64 * 100.0
            } else {
                0.0
            };
            let status = self.shared.status.lock().unwrap().clone();
            let pages = *self.shared.pages.lock().unwrap();

            egui::Grid::new("stats").num_columns(2).spacing([24.0, 8.0]).show(ui, |ui| {
                ui.label("Status:");
                ui.label(&status);
                ui.end_row();
                ui.label("Pages discovered:");
                ui.label(format!("{}", pages));
                ui.end_row();
                ui.label("Total requests:");
                ui.label(format!("{}", total));
                ui.end_row();
                ui.label("Throughput:");
                ui.label(format!("{:.0} req/s", rps));
                ui.end_row();
                ui.label("Success:");
                ui.label(format!("{:.1}%  ({} ok / {} fail)", okpct, ok, fail));
                ui.end_row();
                ui.label("Data received:");
                ui.label(format!("{:.1} MB", bytes as f64 / 1_048_576.0));
                ui.end_row();
                ui.label("Elapsed:");
                ui.label(format!("{:.0} s", elapsed));
                ui.end_row();
            });
        });

        // keep stats live
        ctx.request_repaint_after(std::time::Duration::from_millis(250));
    }
}

fn main() -> eframe::Result<()> {
    // Headless CLI mode:  hammer.exe cli <domain> <concurrency> <seconds>
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 2 && args[1] == "cli" {
        let domain = args.get(2).cloned().unwrap_or_default();
        let conc: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(500);
        let secs: u64 = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(15);
        let insecure = args.iter().any(|a| a == "insecure" || a == "-k");
        if domain.is_empty() {
            eprintln!("usage: hammer cli <domain> <concurrency> <seconds> [insecure]");
            std::process::exit(2);
        }
        let shared = Arc::new(Shared::default());
        *shared.started.lock().unwrap() = Some(Instant::now());
        shared.running.store(true, Ordering::SeqCst);
        let s2 = shared.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(secs));
            s2.running.store(false, Ordering::SeqCst);
        });
        let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build().unwrap();
        rt.block_on(run_engine(domain, conc, insecure, shared.clone()));
        let total = shared.counters.total.load(Ordering::Relaxed);
        let ok = shared.counters.ok.load(Ordering::Relaxed);
        let fail = shared.counters.fail.load(Ordering::Relaxed);
        let bytes = shared.counters.bytes.load(Ordering::Relaxed);
        let el = shared.started.lock().unwrap().map(|s| s.elapsed().as_secs_f64()).unwrap_or(1.0);
        let pages = *shared.pages.lock().unwrap();
        println!(
            "pages:{} total:{} rps:{:.0} ok:{:.1}% ({} ok / {} fail) data:{:.1}MB in {:.0}s",
            pages, total, total as f64 / el,
            if total > 0 { ok as f64 / total as f64 * 100.0 } else { 0.0 },
            ok, fail, bytes as f64 / 1_048_576.0, el
        );
        std::process::exit(0);
    }

    let icon_data = eframe::icon_data::from_png_bytes(include_bytes!("../icon.png"))
        .unwrap_or_default();
    let options = eframe::NativeOptions {
        // wgpu picks the best adapter and falls back to Windows' built-in WARP
        // software renderer when no GPU/OpenGL driver is present.
        renderer: eframe::Renderer::Wgpu,
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([560.0, 580.0])
            .with_min_inner_size([460.0, 520.0])
            .with_icon(Arc::new(icon_data)),
        ..Default::default()
    };
    eframe::run_native(
        "Hammer",
        options,
        Box::new(|_cc| Ok(Box::<App>::default())),
    )
}
