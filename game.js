const PHYSICS = { gravity: 1400, velocityScale: 4.3, maxPull: 170, projectileLifeMs: 4200, hitRadius: 14 };
const STREAK_MEDALS = { 3: "ON FIRE x3", 5: "HEAT CHECK x5", 8: "EGG SNIPER x8", 12: "LEGENDARY x12" };
const MAJOR_STREAKS = new Set([5, 8, 12]);
const STREAK_TIMEOUT_MS = 4500;
const BEST_SCORE_KEY = "feed-eggs-best-score";

const state = {
  score: 0, best: 0, streak: 0, hits: 0, level: 1, soundOn: true, audioCtx: null,
  aiming: false, aimPullX: 0, aimPullY: 0, projectile: null, targetTime: 0, frame: null, lastTs: 0, medalTimer: null,
  lastHitAt: 0
};

const el = {
  playfield: document.querySelector("#playfield"),
  targetZone: document.querySelector("#target-zone"),
  targetArt: document.querySelector("#target-art"),
  mouth: document.querySelector("#mouth-hitbox"),
  launcher: document.querySelector("#launcher-zone"),
  launcherEgg: document.querySelector("#launcher-egg"),
  trajectoryOverlay: document.querySelector("#trajectory-overlay"),
  trajectoryLine: document.querySelector("#trajectory-line"),
  score: document.querySelector("#score-display"),
  best: document.querySelector("#best-display"),
  level: document.querySelector("#level-display"),
  streak: document.querySelector("#streak-display"),
  medalBanner: document.querySelector("#medal-banner"),
  medalText: document.querySelector("#medal-text"),
  status: document.querySelector("#status-line"),
  soundToggle: document.querySelector("#sound-toggle"),
  reset: document.querySelector("#reset-button")
};

function init() {
  if (!el.playfield || !el.launcher || !el.targetZone) return;
  loadBestScore();
  el.targetArt.innerHTML = targetEggSvg();
  el.launcherEgg.innerHTML = looseEggSvg();
  bindEvents();
  resetGame();
  startLoop();
}

function bindEvents() {
  el.launcher.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  el.soundToggle.addEventListener("click", toggleSound);
  el.reset.addEventListener("click", () => { resetGame(); beep(260, 340); });
}

function onPointerDown(e) {
  if (state.projectile) return;
  ensureAudio();
  state.aiming = true;
  state.aimPullX = 0;
  state.aimPullY = 0;
  el.launcher.classList.add("is-armed");
  setStatus("Pull back and release.");
  updateAim(e.clientX, e.clientY);
}

function onPointerMove(e) {
  if (!state.aiming) return;
  updateAim(e.clientX, e.clientY);
}

function onPointerUp() {
  if (!state.aiming) return;
  state.aiming = false;
  el.launcher.classList.remove("is-armed");
  launchProjectile();
}

function updateAim(x, y) {
  const origin = launcherOrigin();
  let pullX = origin.x - x;
  let pullY = origin.y - y;
  const length = Math.hypot(pullX, pullY) || 1;
  const clamped = Math.min(length, PHYSICS.maxPull);
  const factor = clamped / length;
  pullX *= factor;
  pullY *= factor;
  state.aimPullX = pullX;
  state.aimPullY = pullY;
  drawTrajectory(origin, pullX, pullY);
}

function launchProjectile() {
  const origin = launcherOrigin();
  const node = document.createElement("div");
  node.className = "drag-egg";
  node.style.position = "absolute";
  node.style.zIndex = "8";
  node.innerHTML = looseEggSvg();
  el.playfield.appendChild(node);

  state.projectile = {
    node,
    x: origin.x, y: origin.y,
    vx: -state.aimPullX * PHYSICS.velocityScale,
    vy: -state.aimPullY * PHYSICS.velocityScale,
    spawn: performance.now()
  };
  placeProjectile(state.projectile);
  clearTrajectory();
  el.launcher.classList.add("is-firing");
  window.setTimeout(() => el.launcher.classList.remove("is-firing"), 220);
  setStatus("Egg launched.");
  beep(340, 260);
}

function startLoop() {
  const tick = (ts) => {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min((ts - state.lastTs) / 1000, 0.04);
    state.lastTs = ts;
    state.targetTime += dt;
    maybeDecayStreak(ts);
    moveTarget(dt);
    stepProjectile(dt, ts);
    state.frame = window.requestAnimationFrame(tick);
  };
  state.frame = window.requestAnimationFrame(tick);
}

function moveTarget(dt) {
  const field = el.playfield.getBoundingClientRect();
  const mouth = el.targetZone.getBoundingClientRect();
  const minX = 0.05;
  const maxX = Math.max(minX, 0.64 - mouth.width / field.width);
  const minY = 0.34;
  const maxY = Math.max(minY, 0.9 - mouth.height / field.height);
  let x = 0.16, y = 0.72;

  if (state.level <= 2) {
    x += Math.sin(state.targetTime * 0.6) * 0.02 * (state.level - 1);
  } else if (state.level <= 5) {
    x = 0.18 + Math.sin(state.targetTime * (0.8 + state.level * 0.15)) * 0.1;
    y = 0.66 + Math.cos(state.targetTime * (0.6 + state.level * 0.1)) * 0.05;
  } else {
    x = 0.22 + Math.sin(state.targetTime * (1.1 + state.level * 0.18)) * 0.2;
    y = 0.62 + Math.sin(state.targetTime * (0.9 + state.level * 0.15)) * 0.14;
  }
  x = clamp(x, minX, maxX);
  y = clamp(y, minY, maxY);
  el.targetZone.style.left = `${x * 100}%`;
  el.targetZone.style.top = `${y * 100}%`;
  el.targetZone.style.bottom = "auto";
}

function stepProjectile(dt, now) {
  const p = state.projectile;
  if (!p) return;
  p.vy += PHYSICS.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  placeProjectile(p);

  const field = el.playfield.getBoundingClientRect();
  const out = p.x < field.left - 40 || p.x > field.right + 40 || p.y > field.bottom + 40 || p.y < field.top - 40;
  const expired = now - p.spawn > PHYSICS.projectileLifeMs;
  if (hitMouth(p)) return handleHit();
  if (out || expired) handleMiss();
}

function hitMouth(p) {
  const m = el.mouth.getBoundingClientRect();
  const cx = clamp(p.x, m.left, m.right);
  const cy = clamp(p.y, m.top, m.bottom);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy <= PHYSICS.hitRadius * PHYSICS.hitRadius;
}

function handleHit() {
  removeProjectile();
  const prevLevel = state.level;
  state.hits += 1;
  state.streak += 1;
  state.level = 1 + Math.floor(state.hits / 4);
  state.lastHitAt = performance.now();
  const multiplier = 1 + Math.min((state.streak - 1) * 0.25, 3);
  const points = Math.round(100 * multiplier);
  state.score += points;
  if (state.score > state.best) {
    state.best = state.score;
    saveBestScore();
  }
  updateHud();
  if (state.level > prevLevel) {
    showBanner(`LEVEL ${state.level}`, { major: true, duration: 1200 });
  }
  maybeMedal();
  setStatus(`Mouth hit! +${points} (x${multiplier.toFixed(1)})`);
  beep(300, 420);
}

function handleMiss() {
  removeProjectile();
  if (state.streak > 0) {
    state.streak = 0;
    updateHud();
  }
  setStatus("Missed shot. Streak reset.");
  beep(170, 120);
}

function maybeMedal() {
  const label = STREAK_MEDALS[state.streak];
  if (!label) return;
  const major = MAJOR_STREAKS.has(state.streak);
  showBanner(label, { major, duration: 1500 });
  if (major) {
    pulsePlayfield();
    burstParticles();
  }
}

function drawTrajectory(origin, pullX, pullY) {
  const rect = el.playfield.getBoundingClientRect();
  const vx = -pullX * PHYSICS.velocityScale;
  const vy = -pullY * PHYSICS.velocityScale;
  const points = [];
  for (let t = 0.07; t <= 1.25; t += 0.08) {
    const x = origin.x - rect.left + vx * t;
    const y = origin.y - rect.top + vy * t + 0.5 * PHYSICS.gravity * t * t;
    points.push(`${((x / rect.width) * 100).toFixed(2)},${((y / rect.height) * 100).toFixed(2)}`);
  }
  el.trajectoryLine.setAttribute("points", points.join(" "));
  el.trajectoryLine.setAttribute("stroke", "rgba(255,255,255,0.95)");
  el.trajectoryLine.setAttribute("stroke-width", "0.7");
  el.trajectoryLine.setAttribute("fill", "none");
}

function clearTrajectory() {
  el.trajectoryLine.setAttribute("points", "");
}

function launcherOrigin() {
  const r = el.launcher.getBoundingClientRect();
  return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.45 };
}

function placeProjectile(p) {
  const rect = el.playfield.getBoundingClientRect();
  p.node.style.left = `${p.x - rect.left}px`;
  p.node.style.top = `${p.y - rect.top}px`;
}

function removeProjectile() {
  if (state.projectile?.node) state.projectile.node.remove();
  state.projectile = null;
}

function updateHud() {
  el.score.textContent = String(state.score);
  el.best.textContent = String(state.best);
  el.level.textContent = String(state.level);
  el.streak.textContent = String(state.streak);
}

function resetGame() {
  clearTimeout(state.medalTimer);
  removeProjectile();
  clearTrajectory();
  state.score = 0; state.streak = 0; state.hits = 0; state.level = 1;
  state.lastHitAt = 0;
  el.medalBanner.hidden = true;
  updateHud();
  setStatus("Pull from launcher, then release to fling.");
}

function maybeDecayStreak(now) {
  if (state.streak === 0 || state.lastHitAt === 0) return;
  if (now - state.lastHitAt < STREAK_TIMEOUT_MS) return;
  state.streak = 0;
  state.lastHitAt = 0;
  updateHud();
  setStatus("Streak timed out.");
}

function showBanner(text, { major = false, duration = 1300 } = {}) {
  clearTimeout(state.medalTimer);
  el.medalText.textContent = text;
  el.medalBanner.hidden = false;
  el.medalBanner.classList.remove("is-live", "is-milestone");
  void el.medalBanner.offsetWidth;
  el.medalBanner.classList.add("is-live");
  if (major) {
    el.medalBanner.classList.add("is-milestone");
  }
  state.medalTimer = window.setTimeout(() => {
    el.medalBanner.hidden = true;
    el.medalBanner.classList.remove("is-live", "is-milestone");
  }, duration);
}

function pulsePlayfield() {
  el.playfield.classList.remove("is-major-hit");
  void el.playfield.offsetWidth;
  el.playfield.classList.add("is-major-hit");
  window.setTimeout(() => el.playfield.classList.remove("is-major-hit"), 260);
}

function burstParticles() {
  const fieldRect = el.playfield.getBoundingClientRect();
  const mouthRect = el.mouth.getBoundingClientRect();
  const originX = mouthRect.left - fieldRect.left + mouthRect.width / 2;
  const originY = mouthRect.top - fieldRect.top + mouthRect.height / 2;
  for (let i = 0; i < 10; i += 1) {
    const node = document.createElement("span");
    node.className = "hit-particle";
    const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const distance = 26 + Math.random() * 20;
    node.style.left = `${originX}px`;
    node.style.top = `${originY}px`;
    node.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    node.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    el.playfield.appendChild(node);
    window.setTimeout(() => node.remove(), 420);
  }
}

function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      state.best = parsed;
    }
  } catch (_error) {
    // Ignore localStorage failures in restricted contexts.
  }
}

function saveBestScore() {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(state.best));
  } catch (_error) {
    // Ignore localStorage failures in restricted contexts.
  }
}

function setStatus(text) { el.status.textContent = text; }
function toggleSound() {
  state.soundOn = !state.soundOn;
  el.soundToggle.textContent = state.soundOn ? "SOUND ON" : "SOUND OFF";
  if (state.soundOn) beep(420, 420);
}
function ensureAudio() {
  if (!state.soundOn) return null;
  if (!state.audioCtx) state.audioCtx = new window.AudioContext();
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();
  return state.audioCtx;
}
function beep(f1, f2) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const start = ctx.currentTime;
  o.type = "triangle";
  o.frequency.setValueAtTime(f1, start);
  o.frequency.linearRampToValueAtTime(f2, start + 0.08);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.02, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
  o.connect(g); g.connect(ctx.destination); o.start(start); o.stop(start + 0.09);
}
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function targetEggSvg() { return `<svg viewBox="0 0 210 240" aria-hidden="true"><g fill="none" stroke="#111" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="104" cy="214" rx="48" ry="8" fill="rgba(17,17,17,0.08)" stroke="none"/><ellipse cx="104" cy="98" rx="60" ry="78" fill="#fff"/><circle cx="81" cy="69" r="10" fill="#fff"/><circle cx="127" cy="69" r="10" fill="#fff"/><circle cx="81" cy="69" r="3" fill="#111" stroke="none"/><circle cx="127" cy="69" r="3" fill="#111" stroke="none"/><circle class="mouth-ring" cx="104" cy="124" r="36" fill="#111" stroke="none"/></g></svg>`; }
function looseEggSvg() { return `<svg viewBox="0 0 50 64" aria-hidden="true"><ellipse cx="25" cy="30" rx="18" ry="24" fill="#fff" stroke="#111" stroke-width="2.6"/></svg>`; }

init();
