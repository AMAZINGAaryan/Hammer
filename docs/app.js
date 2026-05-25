"use strict";

/* ============================================================
   Project Hammer - by Aaryan
   Interactive landing page: animated background, exploding logo
   (with synthesized sound), and a balloon-shooting download game.
   ============================================================ */

const OWNER = "AMAZINGAaryan";
const REPO = "Hammer";
let downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/hammer.exe`;

// ---------- canvas helpers ----------
const DPR = Math.min(window.devicePixelRatio || 1, 2);
function fit(canvas, w, h) {
  canvas.width = Math.max(1, Math.round(w * DPR));
  canvas.height = Math.max(1, Math.round(h * DPR));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

// ---------- logo image (for canvas particles) ----------
const logoImg = new Image();
logoImg.src = "assets/logo.png";

// ============================================================
//  Synthesized sound (Web Audio) - no external files
// ============================================================
let actx = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  if (actx && actx.state === "suspended") actx.resume();
  return actx;
}
function noiseBuffer(dur) {
  const a = audio();
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function boom() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(26, t + 0.55);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.8);

  const src = a.createBufferSource(); src.buffer = noiseBuffer(0.6);
  const lp = a.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(2200, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + 0.5);
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.85, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t); src.stop(t + 0.6);
}
function shot() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const src = a.createBufferSource(); src.buffer = noiseBuffer(0.12);
  const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 700;
  const g = a.createGain();
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(hp).connect(g).connect(a.destination); src.start(t); src.stop(t + 0.13);

  const o = a.createOscillator(), og = a.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
  og.gain.setValueAtTime(0.22, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(og).connect(a.destination); o.start(t); o.stop(t + 0.09);
}
function popSound() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(950, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.17);

  const src = a.createBufferSource(); src.buffer = noiseBuffer(0.08);
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(ng).connect(a.destination); src.start(t); src.stop(t + 0.1);
}

// ============================================================
//  Animated background (#bg) + theme color cycling
// ============================================================
const bg = document.getElementById("bg");
let bctx, BW, BH;
const blobs = Array.from({ length: 6 }, (_, i) => ({
  hue: i * 60,
  px: Math.random() * Math.PI * 2,
  py: Math.random() * Math.PI * 2,
  sx: 0.00006 + Math.random() * 0.00008,
  sy: 0.00007 + Math.random() * 0.00009,
  r: 0.32 + Math.random() * 0.22,
}));
function sizeBg() { BW = window.innerWidth; BH = window.innerHeight; bctx = fit(bg, BW, BH); }
function drawBg(t) {
  const baseHue = (t * 0.012) % 360;
  bctx.globalCompositeOperation = "source-over";
  bctx.fillStyle = "#07060f";
  bctx.fillRect(0, 0, BW, BH);
  bctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    const x = BW * (0.5 + 0.42 * Math.sin(t * b.sx + b.px));
    const y = BH * (0.5 + 0.42 * Math.cos(t * b.sy + b.py));
    const rad = Math.min(BW, BH) * b.r;
    const hue = (baseHue + b.hue) % 360;
    const grd = bctx.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.55)`);
    grd.addColorStop(1, "hsla(0,0%,0%,0)");
    bctx.fillStyle = grd;
    bctx.beginPath();
    bctx.arc(x, y, rad, 0, Math.PI * 2);
    bctx.fill();
  }
  bctx.globalCompositeOperation = "source-over";

  // pulse the theme accents with the background
  const root = document.documentElement.style;
  root.setProperty("--c1", `hsl(${baseHue}, 92%, 62%)`);
  root.setProperty("--c2", `hsl(${(baseHue + 90) % 360}, 92%, 60%)`);
  root.setProperty("--c3", `hsl(${(baseHue + 180) % 360}, 95%, 60%)`);
  root.setProperty("--c4", `hsl(${(baseHue + 270) % 360}, 90%, 62%)`);
}

// ============================================================
//  FX layer (#fx) - logo explosion particles
// ============================================================
const fx = document.getElementById("fx");
let fctx, FW, FH;
let fxParts = [];
function sizeFx() { FW = window.innerWidth; FH = window.innerHeight; fctx = fit(fx, FW, FH); }
function stepFx(dt) {
  fctx.clearRect(0, 0, FW, FH);
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i];
    p.life -= dt;
    if (p.life <= 0) { fxParts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const a = Math.max(0, p.life / p.max);
    fctx.save();
    fctx.globalAlpha = a;
    fctx.translate(p.x, p.y);
    fctx.rotate(p.rot);
    if (p.kind === "shard" && logoImg.complete) {
      fctx.drawImage(logoImg, -p.s / 2, -p.s / 2, p.s, p.s);
    } else if (p.kind === "ring") {
      fctx.globalAlpha = a * 0.7;
      fctx.strokeStyle = `hsl(${p.hue},95%,65%)`;
      fctx.lineWidth = 6 * a + 1;
      fctx.beginPath();
      fctx.arc(0, 0, p.s * (1 - a) * 6 + 10, 0, Math.PI * 2);
      fctx.stroke();
    } else {
      fctx.fillStyle = `hsl(${p.hue},95%,62%)`;
      fctx.beginPath();
      fctx.arc(0, 0, p.s, 0, Math.PI * 2);
      fctx.fill();
    }
    fctx.restore();
  }
}
function explodeAt(cx, cy, scale) {
  // image shards
  for (let i = 0; i < 22; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.25 + Math.random() * 0.7) * scale;
    fxParts.push({
      kind: "shard", x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.2 * scale,
      g: 0.0016, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02,
      s: (28 + Math.random() * 48) * (scale / 1.4),
      life: 900 + Math.random() * 600, max: 1500,
    });
  }
  // colored sparks
  for (let i = 0; i < 60; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 1.1) * scale;
    fxParts.push({
      kind: "spark", x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      g: 0.0012, rot: 0, vr: 0,
      s: 2 + Math.random() * 5, hue: Math.floor(Math.random() * 360),
      life: 600 + Math.random() * 700, max: 1300,
    });
  }
  // shockwave rings
  for (let i = 0; i < 3; i++) {
    fxParts.push({
      kind: "ring", x: cx, y: cy, vx: 0, vy: 0, g: 0, rot: 0, vr: 0,
      s: 1 + i, hue: Math.floor(Math.random() * 360),
      life: 600, max: 600,
    });
  }
}

// ============================================================
//  Master animation loop (bg + fx)
// ============================================================
let lastTs = performance.now();
function master(ts) {
  const dt = Math.min(48, ts - lastTs);
  lastTs = ts;
  drawBg(ts);
  stepFx(dt);
  requestAnimationFrame(master);
}

// ============================================================
//  Logo detonation -> reveal stage
// ============================================================
const intro = document.getElementById("intro");
const logoBtn = document.getElementById("logoBtn");
let detonated = false;
function detonate() {
  if (detonated) return;
  detonated = true;
  audio(); boom();
  const r = logoBtn.getBoundingClientRect();
  explodeAt(r.left + r.width / 2, r.top + r.height / 2, Math.min(2, r.width / 220 + 0.6));
  intro.classList.add("gone");
  setTimeout(() => {
    document.body.classList.add("revealed");
    intro.style.display = "none";
    startGallery();
  }, 760);
}
logoBtn.addEventListener("click", detonate);

// ============================================================
//  Shooting gallery
// ============================================================
const arena = document.getElementById("arena");
const arenaCanvas = document.getElementById("arenaCanvas");
const gunBarrel = document.querySelector(".gun-barrel");
const scoreEl = document.getElementById("score");
const toastEl = document.getElementById("toast");
const directDl = document.getElementById("directDl");

let actx2, AW, AH;
let balloons = [];
let bullets = [];
let pops = [];
let popped = 0;
let lastDl = 0;
let galleryOn = false;
let lastSpawn = 0;
let spawnEvery = 900;
let mouse = { x: 0, y: 0 };
let galleryLast = performance.now();

const BAL_COLORS = ["#ff2db8", "#00e5ff", "#ffd400", "#7c4dff", "#37e06b", "#ff7a00"];
const MAX_BALLOONS = 9;

function sizeArena() {
  AW = arena.clientWidth; AH = arena.clientHeight;
  actx2 = fit(arenaCanvas, AW, AH);
}

function addBalloon() {
  const size = 64 + Math.random() * 46;
  const el = document.createElement("div");
  el.className = "balloon";
  const color = BAL_COLORS[Math.floor(Math.random() * BAL_COLORS.length)];
  el.style.setProperty("--bs", size + "px");
  el.style.setProperty("--bc", color);
  el.innerHTML =
    '<div class="body"><img src="assets/logo.png" alt=""></div>' +
    '<span class="knot"></span><span class="string"></span>';
  arena.appendChild(el);
  balloons.push({
    el, w: size,
    x: 20 + Math.random() * Math.max(1, AW - size - 40),
    y: AH + 10,
    speed: 0.045 + Math.random() * 0.04,
    swayAmp: 8 + Math.random() * 22,
    swayPh: Math.random() * Math.PI * 2,
    baseX: 0,
  });
  const b = balloons[balloons.length - 1];
  b.baseX = b.x;
}

function balloonCenter(b) {
  return { cx: b.x + b.w / 2, cy: b.y + b.w * 0.5, r: b.w * 0.52 };
}

function aim() {
  // gun pivot in arena coords
  const px = AW / 2, py = AH - 30;
  let dx = mouse.x - px, dy = mouse.y - py;
  if (dy > -10) dy = -10; // never aim downward
  const ang = Math.atan2(dy, dx);          // radians, points toward cursor
  const deg = ang * 180 / Math.PI + 90;    // barrel default points up
  gunBarrel.style.transform = `rotate(${deg}deg)`;
  return ang;
}

function fire() {
  if (!galleryOn) return;
  const ang = aim();
  const px = AW / 2, py = AH - 30, L = 70;
  const tx = px + Math.cos(ang) * L, ty = py + Math.sin(ang) * L;
  const spd = 0.95;
  bullets.push({ x: tx, y: ty, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1600 });
  shot();
}

function spawnPops(x, y, color) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.1 + Math.random() * 0.45;
    pops.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.1,
      life: 500 + Math.random() * 400, max: 900,
      size: 2 + Math.random() * 5,
      color: Math.random() < 0.5 ? color : `hsl(${Math.floor(Math.random() * 360)},95%,62%)`,
    });
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function startDownload() {
  const now = performance.now();
  if (now - lastDl < 2500) return;
  lastDl = now;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.setAttribute("download", "");
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast("Download started! 🎉");
}

function popBalloon(b, idx) {
  const c = balloonCenter(b);
  const color = b.el.style.getPropertyValue("--bc") || "#ff2db8";
  b.el.remove();
  balloons.splice(idx, 1);
  popSound();
  spawnPops(c.cx, c.cy, color.trim());
  popped++;
  scoreEl.textContent = "POPPED: " + popped;
  startDownload();
}

function galleryLoop(ts) {
  if (!galleryOn) return;
  const dt = Math.min(48, ts - galleryLast);
  galleryLast = ts;

  // spawn
  if (ts - lastSpawn > spawnEvery && balloons.length < MAX_BALLOONS) {
    addBalloon();
    lastSpawn = ts;
    spawnEvery = 750 + Math.random() * 800;
  }

  // move balloons
  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i];
    b.y -= b.speed * dt;
    b.swayPh += 0.0016 * dt;
    b.x = b.baseX + Math.sin(b.swayPh) * b.swayAmp;
    if (b.y + b.w * 1.18 < -60) { b.el.remove(); balloons.splice(i, 1); continue; }
    b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
  }

  // aim continuously
  aim();

  // bullets + collisions
  actx2.clearRect(0, 0, AW, AH);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const u = bullets[i];
    u.life -= dt;
    u.x += u.vx * dt; u.y += u.vy * dt;
    if (u.life <= 0 || u.x < -20 || u.x > AW + 20 || u.y < -20 || u.y > AH + 20) {
      bullets.splice(i, 1); continue;
    }
    // collision
    let hit = false;
    for (let j = balloons.length - 1; j >= 0; j--) {
      const c = balloonCenter(balloons[j]);
      const dx = u.x - c.cx, dy = u.y - c.cy;
      if (dx * dx + dy * dy < c.r * c.r) { popBalloon(balloons[j], j); hit = true; break; }
    }
    if (hit) { bullets.splice(i, 1); continue; }
    // draw glowing bullet + trail
    actx2.save();
    actx2.globalCompositeOperation = "lighter";
    const grd = actx2.createRadialGradient(u.x, u.y, 0, u.x, u.y, 14);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.4, "rgba(255,210,80,0.8)");
    grd.addColorStop(1, "rgba(255,120,0,0)");
    actx2.fillStyle = grd;
    actx2.beginPath(); actx2.arc(u.x, u.y, 14, 0, Math.PI * 2); actx2.fill();
    actx2.restore();
  }

  // pop particles
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.life -= dt;
    if (p.life <= 0) { pops.splice(i, 1); continue; }
    p.vy += 0.0011 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    actx2.globalAlpha = Math.max(0, p.life / p.max);
    actx2.fillStyle = p.color;
    actx2.beginPath(); actx2.arc(p.x, p.y, p.size, 0, Math.PI * 2); actx2.fill();
  }
  actx2.globalAlpha = 1;

  requestAnimationFrame(galleryLoop);
}

function startGallery() {
  if (galleryOn) return;
  sizeArena();
  galleryOn = true;
  galleryLast = performance.now();
  lastSpawn = 0;
  mouse = { x: AW / 2, y: AH / 2 };
  requestAnimationFrame(galleryLoop);
}

arena.addEventListener("mousemove", (e) => {
  const r = arena.getBoundingClientRect();
  mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
});
arena.addEventListener("click", (e) => {
  const r = arena.getBoundingClientRect();
  mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  fire();
});
arena.addEventListener("touchstart", (e) => {
  const r = arena.getBoundingClientRect();
  const t = e.touches[0];
  mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top;
  fire();
}, { passive: true });

// ============================================================
//  Release metadata + correct asset URL
// ============================================================
async function hydrate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const tag = data.tag_name || data.name || "Latest";
    const v = document.getElementById("releaseVersion");
    const d = document.getElementById("releaseDate");
    const s = document.getElementById("releaseSize");
    if (v) v.textContent = tag;
    if (d) d.textContent = data.published_at
      ? new Date(data.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "released";
    if (Array.isArray(data.assets) && data.assets.length) {
      const exes = data.assets.filter((a) => a.name.toLowerCase().endsWith(".exe"));
      const asset = exes.find((a) => /setup|install|hammer/i.test(a.name)) || exes[0] || data.assets[0];
      if (asset && asset.browser_download_url) {
        downloadUrl = asset.browser_download_url;
        if (directDl) directDl.href = downloadUrl;
      }
      if (asset && typeof asset.size === "number" && s) s.textContent = `${(asset.size / 1048576).toFixed(1)} MB`;
    }
  } catch (e) {
    const v = document.getElementById("releaseVersion");
    const s = document.getElementById("releaseSize");
    if (v) v.textContent = "GitHub";
    if (s) s.textContent = "~31 MB";
  }
}

// ============================================================
//  Boot
// ============================================================
function onResize() { sizeBg(); sizeFx(); if (galleryOn) sizeArena(); }
window.addEventListener("resize", onResize);
sizeBg(); sizeFx();
requestAnimationFrame(master);
hydrate();
