"use strict";

/* ============================================================
   Project Hammer - by Aaryan
   Click the logo -> it explodes (with sound + music) -> the whole
   page becomes a shooting range: aim the cannon, fire, and blast
   the page's own content apart. Any blast starts the download.
   ============================================================ */

const OWNER = "AMAZINGAaryan";
const REPO = "Hammer";
let downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/hammer.exe`;

const DPR = Math.min(window.devicePixelRatio || 1, 2);
function fit(canvas, w, h) {
  canvas.width = Math.max(1, Math.round(w * DPR));
  canvas.height = Math.max(1, Math.round(h * DPR));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

const logoImg = new Image();
logoImg.src = "assets/logo.webp";

// ============================================================
//  Sound (Web Audio) + background music
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
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(hp).connect(g).connect(a.destination); src.start(t); src.stop(t + 0.13);
  const o = a.createOscillator(), og = a.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
  og.gain.setValueAtTime(0.2, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(og).connect(a.destination); o.start(t); o.stop(t + 0.09);
}
function popSound() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(820, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.14);
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.19);
  const src = a.createBufferSource(); src.buffer = noiseBuffer(0.12);
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t); src.stop(t + 0.15);
}

const music = document.getElementById("music");
const muteBtn = document.getElementById("muteBtn");
let muted = false;
function startMusic() {
  if (!music) return;
  music.volume = 0.55;
  music.play().catch(() => {});
}
muteBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  muted = !muted;
  if (music) music.muted = muted;
  muteBtn.textContent = muted ? "🔇" : "🔊";
});

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
  for (const b of blobs) {
    const x = BW * (0.5 + 0.42 * Math.sin(t * b.sx + b.px));
    const y = BH * (0.5 + 0.42 * Math.cos(t * b.sy + b.py));
    const rad = Math.min(BW, BH) * b.r;
    const hue = (baseHue + b.hue) % 360;
    const grd = bctx.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.55)`);
    grd.addColorStop(1, "hsla(0,0%,0%,0)");
    bctx.fillStyle = grd;
    bctx.beginPath(); bctx.arc(x, y, rad, 0, Math.PI * 2); bctx.fill();
  }
  bctx.globalCompositeOperation = "source-over";
  const root = document.documentElement.style;
  root.setProperty("--c1", `hsl(${baseHue}, 92%, 62%)`);
  root.setProperty("--c2", `hsl(${(baseHue + 90) % 360}, 92%, 60%)`);
  root.setProperty("--c3", `hsl(${(baseHue + 180) % 360}, 95%, 60%)`);
  root.setProperty("--c4", `hsl(${(baseHue + 270) % 360}, 90%, 62%)`);
}

// ============================================================
//  FX layer (#fx): explosion particles + bullets
// ============================================================
const fx = document.getElementById("fx");
let fctx, FW, FH;
let fxParts = [];
let bullets = [];
function sizeFx() { FW = window.innerWidth; FH = window.innerHeight; fctx = fit(fx, FW, FH); }

function stepParticles(dt) {
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
      fctx.arc(0, 0, p.s * (1 - a) * 7 + 8, 0, Math.PI * 2);
      fctx.stroke();
    } else {
      fctx.fillStyle = `hsl(${p.hue},95%,62%)`;
      fctx.beginPath(); fctx.arc(0, 0, p.s, 0, Math.PI * 2); fctx.fill();
    }
    fctx.restore();
  }
}
function sparksAt(cx, cy, count, scale) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.2 + Math.random() * 0.9) * scale;
    fxParts.push({
      kind: "spark", x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      g: 0.0012, rot: 0, vr: 0,
      s: 2 + Math.random() * 5, hue: Math.floor(Math.random() * 360),
      life: 500 + Math.random() * 600, max: 1100,
    });
  }
  fxParts.push({ kind: "ring", x: cx, y: cy, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, s: 1, hue: Math.floor(Math.random() * 360), life: 520, max: 520 });
}
function explodeLogo(cx, cy, scale) {
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.25 + Math.random() * 0.7) * scale;
    fxParts.push({
      kind: "shard", x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.2 * scale,
      g: 0.0016, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02,
      s: (30 + Math.random() * 50) * (scale / 1.4),
      life: 900 + Math.random() * 600, max: 1500,
    });
  }
  sparksAt(cx, cy, 70, scale);
  for (let i = 0; i < 3; i++) {
    fxParts.push({ kind: "ring", x: cx, y: cy, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, s: 1 + i, hue: Math.floor(Math.random() * 360), life: 650, max: 650 });
  }
}

// ============================================================
//  Cannon + shooting the page apart
// ============================================================
const cannon = document.getElementById("cannon");
const gunBarrel = cannon.querySelector(".gun-barrel");
const scoreEl = document.getElementById("score");
const toastEl = document.getElementById("toast");
let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let blasted = 0;
let lastDl = 0;
let revealed = false;

function pivot() { return { x: window.innerWidth / 2, y: window.innerHeight - 30 }; }

function aimCannon() {
  const pv = pivot();
  const ang = Math.atan2(pointer.y - pv.y, pointer.x - pv.x);
  gunBarrel.style.transform = `rotate(${ang * 180 / Math.PI + 90}deg)`;
  return ang;
}

function fire() {
  if (!revealed) return;
  const pv = pivot();
  const ang = aimCannon();
  const L = 80;
  const tx = pv.x + Math.cos(ang) * L, ty = pv.y + Math.sin(ang) * L;
  const spd = 1.5;
  bullets.push({ x: tx, y: ty, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 4000 });
  shot();
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

function blastEl(el) {
  if (el.dataset.blasted) return;
  el.dataset.blasted = "1";
  const r = el.getBoundingClientRect();
  sparksAt(r.left + r.width / 2, r.top + r.height / 2, 22, 1.1 + Math.min(2, r.width / 260));
  popSound();
  const dx = (Math.random() - 0.5) * 460;
  const dy = -220 - Math.random() * 320;
  const rot = (Math.random() - 0.5) * 140;
  el.style.transition = "transform 0.6s cubic-bezier(.2,.7,.3,1), opacity 0.55s ease, filter 0.55s ease";
  el.style.transformOrigin = "center";
  el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0.25)`;
  el.style.opacity = "0";
  el.style.filter = "blur(2px)";
  el.style.pointerEvents = "none";
  setTimeout(() => { el.style.visibility = "hidden"; }, 620);
  blasted++;
  scoreEl.textContent = "BLASTED: " + blasted;
  startDownload();
}

function stepBullets(dt) {
  if (!bullets.length) return;
  const targets = Array.prototype.slice.call(document.querySelectorAll(".shootable")).filter((e) => !e.dataset.blasted);
  const rects = targets.map((e) => ({ el: e, r: e.getBoundingClientRect() }));
  for (let i = bullets.length - 1; i >= 0; i--) {
    const u = bullets[i];
    u.life -= dt;
    u.x += u.vx * dt; u.y += u.vy * dt;
    if (u.life <= 0 || u.x < -40 || u.x > FW + 40 || u.y < -40 || u.y > FH + 40) {
      bullets.splice(i, 1); continue;
    }
    let hit = false;
    for (const t of rects) {
      const r = t.r;
      if (u.x >= r.left && u.x <= r.right && u.y >= r.top && u.y <= r.bottom) {
        blastEl(t.el); hit = true; break;
      }
    }
    if (hit) { bullets.splice(i, 1); continue; }
    fctx.save();
    fctx.globalCompositeOperation = "lighter";
    const grd = fctx.createRadialGradient(u.x, u.y, 0, u.x, u.y, 13);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.4, "rgba(255,210,80,0.85)");
    grd.addColorStop(1, "rgba(255,120,0,0)");
    fctx.fillStyle = grd;
    fctx.beginPath(); fctx.arc(u.x, u.y, 13, 0, Math.PI * 2); fctx.fill();
    fctx.restore();
  }
}

// ============================================================
//  Master loop
// ============================================================
let lastTs = performance.now();
function master(ts) {
  const dt = Math.min(48, ts - lastTs);
  lastTs = ts;
  drawBg(ts);
  fctx.clearRect(0, 0, FW, FH);
  stepParticles(dt);
  if (revealed) { aimCannon(); stepBullets(dt); }
  requestAnimationFrame(master);
}

// ============================================================
//  Logo detonation -> reveal + music
// ============================================================
const intro = document.getElementById("intro");
const logoBtn = document.getElementById("logoBtn");
let detonated = false;
function detonate() {
  if (detonated) return;
  detonated = true;
  audio(); boom(); startMusic();
  const r = logoBtn.getBoundingClientRect();
  explodeLogo(r.left + r.width / 2, r.top + r.height / 2, Math.min(2, r.width / 220 + 0.6));
  intro.classList.add("gone");
  setTimeout(() => {
    document.body.classList.add("revealed");
    intro.style.display = "none";
    revealed = true;
  }, 760);
}
logoBtn.addEventListener("click", detonate);

// pointer / firing across the whole page
window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener("pointerdown", (e) => {
  if (!revealed) return;
  if (e.target.closest("#muteBtn")) return;
  pointer.x = e.clientX; pointer.y = e.clientY;
  fire();
});

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
    const v = document.getElementById("releaseVersion");
    const d = document.getElementById("releaseDate");
    const s = document.getElementById("releaseSize");
    if (v) v.textContent = data.tag_name || data.name || "Latest";
    if (d) d.textContent = data.published_at
      ? new Date(data.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "released";
    if (Array.isArray(data.assets) && data.assets.length) {
      const exes = data.assets.filter((a) => a.name.toLowerCase().endsWith(".exe"));
      const asset = exes.find((a) => /setup|install|hammer/i.test(a.name)) || exes[0] || data.assets[0];
      if (asset && asset.browser_download_url) downloadUrl = asset.browser_download_url;
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
window.addEventListener("resize", () => { sizeBg(); sizeFx(); });
sizeBg(); sizeFx();
requestAnimationFrame(master);
hydrate();
