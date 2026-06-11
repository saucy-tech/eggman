const PHYSICS = { gravity: 1400, velocityScale: 4.3, maxPull: 170, projectileLifeMs: 4200, hitRadius: 14 };
const STREAK_MEDALS = { 3: "ON FIRE x3", 5: "HEAT CHECK x5", 8: "EGG SNIPER x8", 12: "LEGENDARY x12" };
const MAJOR_STREAKS = new Set([5, 8, 12]);
const STREAK_TIMEOUT_MS = 4500;
const BEST_SCORE_KEY = "feed-eggs-best-score";
const GOLDEN_CHANCE = 0.1;
const GOLDEN_BONUS = 5;

const INTRO_LINES = [
  "Pull back, release, feed the mouth. It has been waiting all day.",
  "The mouth hungers. You have eggs. Do the math.",
  "Slingshot on the left. Bottomless appetite on the right. Go.",
  "Today's forecast: scattered eggs with a chance of glory."
];

const HIT_LINES = [
  "Swallowed whole. No chewing. Slightly concerning.",
  "Direct deposit to the yolk account.",
  "Nothing but mouth.",
  "That egg had a family. It was delicious anyway.",
  "Egg-to-mouth logistics: flawless.",
  "Om nom nom. (Official physics term.)",
  "Chef's kiss. Mouth's dinner.",
  "The prophecy is fulfilled."
];

const GOLDEN_HIT_LINES = [
  "GOLDEN YOLK. The shareholders rejoice.",
  "24-karat breakfast. Incredible scenes.",
  "That egg was worth more than your car. Eaten."
];

const MISS_LINES = [
  [
    "Gravity 1, you 0.",
    "The egg died as it lived: airborne, briefly.",
    "That was a warning shot. Right?",
    "The mouth remains unfed. It remembers."
  ],
  [
    "An entire omelet, wasted on the floor.",
    "The chickens are filing a formal complaint.",
    "Have you considered aiming AT the mouth?"
  ],
  [
    "The egg union has called a strike.",
    "This is a cleanup operation now, not a game.",
    "Somewhere, a hen weeps."
  ]
];

const state = {
  score: 0, best: 0, streak: 0, hits: 0, level: 1, soundOn: true, audioCtx: null,
  aiming: false, aimPullX: 0, aimPullY: 0, projectile: null, targetTime: 0, frame: null, lastTs: 0, medalTimer: null,
  lastHitAt: 0, targetX: null, targetY: null,
  golden: false, missRun: 0, raining: false, keyBuffer: "", aimDots: []
};

const el = {
  playfield: document.querySelector("#playfield"),
  targetZone: document.querySelector("#target-zone"),
  targetArt: document.querySelector("#target-art"),
  mouth: document.querySelector("#mouth-hitbox"),
  launcher: document.querySelector("#launcher-zone"),
  launcherFrame: document.querySelector("#launcher-frame"),
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
  el.launcherFrame.innerHTML = slingSvg();
  bindEvents();
  resetGame();
  startLoop();
}

function bindEvents() {
  el.launcher.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("keydown", onKeyDown);
  el.soundToggle.addEventListener("click", toggleSound);
  el.reset.addEventListener("click", () => { resetGame(); beep(260, 340); });
}

function onKeyDown(e) {
  if (e.key.length !== 1) return;
  state.keyBuffer = (state.keyBuffer + e.key.toLowerCase()).slice(-3);
  if (state.keyBuffer === "egg") {
    state.keyBuffer = "";
    eggpocalypse();
  }
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
  el.launcherEgg.style.transform = `translate(${-pullX * 0.22}px, ${-pullY * 0.22}px)`;
  drawTrajectory(origin, pullX, pullY);
}

function launchProjectile() {
  const origin = launcherOrigin();
  const node = document.createElement("div");
  node.className = state.golden ? "drag-egg is-golden" : "drag-egg";
  node.style.position = "absolute";
  node.style.zIndex = "8";
  node.innerHTML = looseEggSvg(state.golden);
  el.playfield.appendChild(node);

  state.projectile = {
    node,
    golden: state.golden,
    x: origin.x, y: origin.y,
    vx: state.aimPullX * PHYSICS.velocityScale,
    vy: state.aimPullY * PHYSICS.velocityScale,
    spawn: performance.now()
  };
  placeProjectile(state.projectile);
  clearTrajectory();
  el.launcherEgg.style.transform = "";
  el.launcher.classList.add("is-firing");
  el.launcherEgg.innerHTML = "";
  window.setTimeout(() => el.launcher.classList.remove("is-firing"), 220);
  setStatus(state.golden ? "Golden egg away. No pressure." : "Egg launched.");
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
  const launcher = el.launcher.getBoundingClientRect();
  const launcherGapPx = 90;
  const minX = Math.max(0.05, (launcher.right - field.left + launcherGapPx) / field.width);
  const maxX = Math.max(minX, 0.64 - mouth.width / field.width);
  const minY = 0.34;
  const maxY = Math.max(minY, 0.9 - mouth.height / field.height);
  let x = 0.22;
  let y = 0.7;

  if (state.level <= 2) {
    x += Math.sin(state.targetTime * 0.55) * 0.015 * (state.level - 1);
  } else if (state.level <= 5) {
    x = 0.27 + Math.sin(state.targetTime * (0.78 + state.level * 0.11)) * 0.08;
    y = 0.66 + Math.cos(state.targetTime * (0.56 + state.level * 0.08)) * 0.04;
  } else {
    x = 0.3 + Math.sin(state.targetTime * (0.94 + state.level * 0.13)) * 0.14;
    y = 0.62 + Math.sin(state.targetTime * (0.78 + state.level * 0.1)) * 0.09;
  }
  x = clamp(x, minX, maxX);
  y = clamp(y, minY, maxY);

  if (state.targetX === null || state.targetY === null) {
    state.targetX = x;
    state.targetY = y;
  }
  const alpha = clamp(dt * 7.5, 0.08, 0.24);
  state.targetX += (x - state.targetX) * alpha;
  state.targetY += (y - state.targetY) * alpha;

  el.targetZone.style.left = `${state.targetX * 100}%`;
  el.targetZone.style.top = `${state.targetY * 100}%`;
  el.targetZone.style.bottom = "auto";
}

function stepProjectile(dt, now) {
  const p = state.projectile;
  if (!p) return;
  p.vy += PHYSICS.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  placeProjectile(p);
  const age = (now - p.spawn) / 1000;
  p.node.style.transform = `translate(-50%, -50%) rotate(${Math.sign(p.vx || 1) * age * 540}deg)`;

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
  const wasGolden = Boolean(state.projectile?.golden);
  removeProjectile();
  const prevLevel = state.level;
  state.hits += 1;
  state.streak += 1;
  state.missRun = 0;
  state.level = 1 + Math.floor(state.hits / 4);
  state.lastHitAt = performance.now();
  const multiplier = 1 + Math.min((state.streak - 1) * 0.25, 3);
  const points = Math.round(100 * multiplier) * (wasGolden ? GOLDEN_BONUS : 1);
  state.score += points;
  if (state.score > state.best) {
    state.best = state.score;
    saveBestScore();
  }
  updateHud();
  chompTarget();
  spawnScorePop(points, wasGolden);
  if (state.level > prevLevel) {
    showBanner(`LEVEL ${state.level}`, { major: true, duration: 1200 });
  }
  maybeMedal();
  if (wasGolden) {
    showBanner(`GOLDEN YOLK +${points}`, { major: true, duration: 1400 });
    pulsePlayfield();
    burstParticles();
    setStatus(pick(GOLDEN_HIT_LINES));
    beep(660, 880);
  } else {
    setStatus(`+${points} (x${multiplier.toFixed(1)}) — ${pick(HIT_LINES)}`);
    beep(300, 420);
  }
  rollNextEgg();
}

function handleMiss() {
  const p = state.projectile;
  if (p) spawnSplat(p);
  removeProjectile();
  state.missRun += 1;
  if (state.streak > 0) {
    state.streak = 0;
    updateHud();
  }
  setStatus(missLine());
  beep(170, 120);
  rollNextEgg();
}

function missLine() {
  const tier = state.missRun >= 5 ? 2 : state.missRun >= 3 ? 1 : 0;
  return pick(MISS_LINES[tier]);
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

function rollNextEgg() {
  state.golden = Math.random() < GOLDEN_CHANCE;
  el.launcherEgg.innerHTML = looseEggSvg(state.golden);
  el.launcherEgg.classList.toggle("is-golden", state.golden);
  if (state.golden) {
    showBanner("★ GOLDEN EGG LOADED ★", { duration: 1500 });
    beep(700, 980);
  }
}

function chompTarget() {
  el.targetZone.classList.remove("is-hit", "is-fed");
  void el.targetZone.offsetWidth;
  el.targetZone.classList.add("is-hit", "is-fed");
  window.setTimeout(() => el.targetZone.classList.remove("is-hit", "is-fed"), 320);
}

function spawnScorePop(points, golden) {
  const fieldRect = el.playfield.getBoundingClientRect();
  const mouthRect = el.mouth.getBoundingClientRect();
  const node = document.createElement("span");
  node.className = golden ? "score-pop is-golden" : "score-pop";
  node.textContent = `+${points}`;
  node.style.left = `${mouthRect.left - fieldRect.left + mouthRect.width / 2}px`;
  node.style.top = `${mouthRect.top - fieldRect.top - 6}px`;
  el.playfield.appendChild(node);
  window.setTimeout(() => node.remove(), 900);
}

function spawnSplat(p) {
  const rect = el.playfield.getBoundingClientRect();
  const x = clamp(p.x - rect.left, 12, rect.width - 12);
  const y = clamp(p.y - rect.top, 12, rect.height - 12);
  const node = document.createElement("div");
  node.className = "egg-splat";
  node.innerHTML = splatSvg();
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  el.playfield.appendChild(node);
  window.setTimeout(() => node.remove(), 1400);
}

function eggpocalypse() {
  if (state.raining) return;
  state.raining = true;
  showBanner("EGGPOCALYPSE", { major: true, duration: 1800 });
  pulsePlayfield();
  beep(520, 180);
  for (let i = 0; i < 26; i += 1) {
    const node = document.createElement("div");
    node.className = "rain-egg";
    node.innerHTML = looseEggSvg(Math.random() < 0.15);
    node.style.left = `${4 + Math.random() * 92}%`;
    node.style.setProperty("--fall-ms", `${1100 + Math.random() * 1300}ms`);
    node.style.setProperty("--spin", Math.random() < 0.5 ? "-1" : "1");
    node.style.animationDelay = `${Math.random() * 600}ms`;
    el.playfield.appendChild(node);
    window.setTimeout(() => node.remove(), 3400);
  }
  setStatus("You typed the forbidden word. The sky answers.");
  window.setTimeout(() => { state.raining = false; }, 3000);
}

const AIM_DOT_COUNT = 13;

function drawTrajectory(origin, pullX, pullY) {
  const rect = el.playfield.getBoundingClientRect();
  const vx = pullX * PHYSICS.velocityScale;
  const vy = pullY * PHYSICS.velocityScale;
  const power = Math.hypot(pullX, pullY) / PHYSICS.maxPull;
  ensureAimDots();
  for (let i = 0; i < AIM_DOT_COUNT; i += 1) {
    const t = 0.06 + i * 0.07;
    const x = origin.x - rect.left + vx * t;
    const y = origin.y - rect.top + vy * t + 0.5 * PHYSICS.gravity * t * t;
    const dot = state.aimDots[i];
    const inField = x > -20 && x < rect.width + 20 && y < rect.height + 20;
    dot.style.opacity = inField && power > 0.04 ? String(Math.max(0.15, 0.95 - i * 0.06)) : "0";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    const size = Math.max(4, 9 - i * 0.35);
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
  }
}

function ensureAimDots() {
  if (state.aimDots.length) return;
  for (let i = 0; i < AIM_DOT_COUNT; i += 1) {
    const dot = document.createElement("span");
    dot.className = "aim-dot";
    dot.style.opacity = "0";
    el.playfield.appendChild(dot);
    state.aimDots.push(dot);
  }
}

function clearTrajectory() {
  for (const dot of state.aimDots) dot.style.opacity = "0";
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
  state.missRun = 0;
  state.targetX = null;
  state.targetY = null;
  el.medalBanner.hidden = true;
  updateHud();
  rollNextEgg();
  setStatus(pick(INTRO_LINES));
}

function maybeDecayStreak(now) {
  if (state.streak === 0 || state.lastHitAt === 0) return;
  if (now - state.lastHitAt < STREAK_TIMEOUT_MS) return;
  state.streak = 0;
  state.lastHitAt = 0;
  updateHud();
  setStatus("Streak timed out. The mouth grew impatient.");
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
function pick(lines) { return lines[Math.floor(Math.random() * lines.length)]; }
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
function looseEggSvg(golden = false) {
  const fill = golden ? "#ffd34d" : "#fff";
  const stroke = golden ? "#8a6d1a" : "#111";
  const shine = golden ? `<ellipse cx="19" cy="22" rx="5" ry="8" fill="rgba(255,255,255,0.7)" transform="rotate(-18 19 22)"/>` : "";
  return `<svg viewBox="0 0 50 64" aria-hidden="true"><ellipse cx="25" cy="30" rx="18" ry="24" fill="${fill}" stroke="${stroke}" stroke-width="2.6"/>${shine}</svg>`;
}
function splatSvg() {
  return `<svg viewBox="0 0 80 60" aria-hidden="true"><g stroke="#111" stroke-width="2"><path d="M14 38 C8 28, 18 18, 28 22 C32 12, 50 10, 56 20 C68 18, 74 30, 64 38 C70 46, 56 52, 46 48 C38 56, 20 54, 18 44 C10 46, 8 42, 14 38 Z" fill="#fff"/><circle cx="40" cy="34" r="9" fill="#ffd34d"/></g></svg>`;
}
function slingSvg() {
  return `<svg viewBox="0 0 160 200" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M28 180 C38 132, 42 88, 46 28" stroke="#5a3f1a" stroke-width="13"/><path d="M132 180 C122 132, 118 88, 114 28" stroke="#5a3f1a" stroke-width="13"/><path d="M52 44 C74 56, 86 56, 108 44" stroke="#b88b4b" stroke-width="10"/><path d="M52 44 C74 32, 86 32, 108 44" stroke="#8f6734" stroke-width="6"/><path d="M80 52 L80 184" stroke="#3f2a10" stroke-width="6" opacity="0.42"/></g></svg>`;
}

init();
