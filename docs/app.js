const btn = document.getElementById("downloadBtn");
const releaseVersionEl = document.getElementById("releaseVersion");
const releaseDateEl = document.getElementById("releaseDate");
const releaseSizeEl = document.getElementById("releaseSize");

const owner = "AMAZINGAaryan";
const repo = "Hammer";
const releaseApi = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

// ---- continuous "all colors in the world" cycling --------------------
// Drive a base hue with requestAnimationFrame and derive 4 accent colors
// from it. Smooth, never repeats the same frame, covers the full spectrum.
let baseHue = 0;
function cycleColors(ts) {
  baseHue = (ts * 0.04) % 360;
  const root = document.documentElement.style;
  root.setProperty("--c1", `hsl(${baseHue} 92% 58%)`);
  root.setProperty("--c2", `hsl(${(baseHue + 90) % 360} 92% 60%)`);
  root.setProperty("--c3", `hsl(${(baseHue + 180) % 360} 90% 55%)`);
  root.setProperty("--c4", `hsl(${(baseHue + 270) % 360} 98% 62%)`);
  requestAnimationFrame(cycleColors);
}
requestAnimationFrame(cycleColors);

// ---- pull latest release metadata + correct download asset -----------
async function hydrateReleaseMeta() {
  try {
    const res = await fetch(releaseApi, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

    const data = await res.json();
    const tag = data.tag_name || data.name || "Latest";
    const published = data.published_at ? new Date(data.published_at) : null;

    if (releaseVersionEl) releaseVersionEl.textContent = tag;
    if (releaseDateEl) {
      releaseDateEl.textContent = published
        ? published.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : "Release date unknown";
    }

    if (Array.isArray(data.assets) && data.assets.length) {
      // Prefer an installer-looking .exe, otherwise the first .exe.
      const exes = data.assets.filter((a) => a.name.toLowerCase().endsWith(".exe"));
      const asset =
        exes.find((a) => /setup|install/i.test(a.name)) || exes[0] || data.assets[0];

      if (asset && asset.browser_download_url) {
        btn.href = asset.browser_download_url;
        btn.dataset.download = asset.browser_download_url;
      }
      if (asset && typeof asset.size === "number" && releaseSizeEl) {
        releaseSizeEl.textContent = `${(asset.size / (1024 * 1024)).toFixed(1)} MB`;
      }
    }
  } catch (err) {
    if (releaseVersionEl) releaseVersionEl.textContent = "GitHub Releases";
    if (releaseDateEl) releaseDateEl.textContent = "Release data unavailable";
    if (releaseSizeEl) releaseSizeEl.textContent = "Check releases";
  }
}
hydrateReleaseMeta();

// ---- the blast ------------------------------------------------------
function blast() {
  btn.classList.remove("is-blasting");
  void btn.offsetWidth;
  btn.classList.add("is-blasting");

  // shockwave ring
  const ring = document.createElement("span");
  ring.className = "shockwave";
  btn.appendChild(ring);
  setTimeout(() => ring.remove(), 700);

  // burst of colorful sparks in all directions
  const count = 36;
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("span");
    spark.className = "spark";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const distance = 70 + Math.random() * 120;
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--hue", `${Math.floor((baseHue + i * 12) % 360)}`);
    spark.style.setProperty("--sz", `${6 + Math.random() * 12}px`);
    spark.style.left = "50%";
    spark.style.top = "50%";
    btn.appendChild(spark);
    setTimeout(() => spark.remove(), 1000);
  }

  // brief full-screen color flash
  const flash = document.createElement("div");
  flash.className = "flash";
  flash.style.background = `radial-gradient(circle at 50% 50%, hsl(${baseHue} 95% 60% / 0.55), transparent 60%)`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

btn.addEventListener("click", blast);
