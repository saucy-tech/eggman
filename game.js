const BEFORE_PACK_SEQUENCE = [
  { fed: 1, supply: 11, status: "Egg registered." },
  { fed: 3, supply: 10, status: "Egg registered." },
  { fed: 8, supply: 9, status: "Egg registered." },
  { fed: 6, supply: 8, status: "What? Six? I did, like, 25.", quote: "What? Six? I did, like, 25.", voice: "what-six", glitch: true },
  { fed: 12, supply: 6, status: "Egg registered." },
  { fed: 14, supply: 4, status: "Egg registered." },
  { fed: 14, supply: 0, status: "Dude, you ran out of eggs.", glitch: true, prompt: true }
];

const AFTER_PACK_SEQUENCE = [
  { fed: 55, supply: 39, status: "That one egg was 40 eggs?", quote: "That one egg was 40 eggs?", voice: "forty-eggs", glitch: true },
  { fed: 61, supply: 38, status: "Egg registered." },
  { fed: 68, supply: 37, status: "Congrats, big boy.", reward: true }
];

const VOICE_FILES = {
  "what-six": "audio/what-six.mp3",
  "forty-eggs": "audio/that-one-egg-was-40-eggs.mp3",
  "never-here": "audio/never-gotten-here-before.mp3",
  bush: "audio/bush-what-the-hell.mp3",
  porn: "audio/nude-egg-i-won.mp3"
};

const MUSIC_PATTERNS = {
  play: [
    { frequency: 196, duration: 0.18, wait: 700, volume: 0.008, type: "triangle" },
    { wait: 380 },
    { frequency: 220, duration: 0.14, wait: 720, volume: 0.007, type: "triangle" },
    { frequency: 165, duration: 0.18, wait: 860, volume: 0.008, type: "triangle" }
  ],
  win: [
    { frequency: 262, duration: 0.16, wait: 380, volume: 0.012, type: "triangle" },
    { frequency: 330, duration: 0.16, wait: 380, volume: 0.011, type: "triangle" },
    { frequency: 311, duration: 0.15, wait: 340, volume: 0.011, type: "triangle" },
    { frequency: 294, duration: 0.22, wait: 640, volume: 0.012, type: "triangle" }
  ]
};

const state = {
  phase: "before-pack",
  scriptIndex: 0,
  fed: 0,
  supply: 12,
  dragNode: null,
  soundEnabled: true,
  audioContext: null,
  quoteTimer: null,
  bannerTimer: null,
  revealView: "front",
  rewardStage: "hidden",
  musicMode: "play",
  musicLoopTimer: null,
  ambienceNodes: [],
  activeVoices: new Set(),
  missingVoiceFiles: new Set(),
  lastPointerTickAt: 0,
  lastPointerX: null,
  lastPointerY: null,
  dragSoundTimer: null
};

const elements = {
  playfield: document.querySelector("#playfield"),
  targetZone: document.querySelector("#target-zone"),
  targetArt: document.querySelector("#target-art"),
  basketZone: document.querySelector("#basket-zone"),
  basketArt: document.querySelector("#basket-art"),
  basketCount: document.querySelector("#basket-count"),
  fedDisplay: document.querySelector("#fed-display"),
  supplyDisplay: document.querySelector("#supply-display"),
  quoteBox: document.querySelector("#quote-box"),
  quoteText: document.querySelector("#quote-text"),
  transitionBanner: document.querySelector("#transition-banner"),
  transitionBannerText: document.querySelector("#transition-banner-text"),
  promptOverlay: document.querySelector("#prompt-overlay"),
  promptForm: document.querySelector("#prompt-form"),
  promptInput: document.querySelector("#prompt-input"),
  statusLine: document.querySelector("#status-line"),
  soundToggle: document.querySelector("#sound-toggle"),
  resetButton: document.querySelector("#reset-button"),
  rewardOverlay: document.querySelector("#reward-overlay"),
  rewardArt: document.querySelector("#reward-art"),
  rewardCard: document.querySelector(".reward-card"),
  rewardLine: document.querySelector("#reward-line"),
  rewardMainButton: document.querySelector("#reward-main-button"),
  rewardRotateButton: document.querySelector("#reward-rotate-button"),
  rewardResetButton: document.querySelector("#reward-reset-button")
};

function init() {
  elements.targetArt.innerHTML = targetEggSvg();
  elements.basketArt.innerHTML = basketSvg();
  setRewardArt("", "");
  updateHud();
  updateBasketState();
  bindEvents();
}

function bindEvents() {
  elements.basketZone.addEventListener("pointerdown", startDrag);
  document.addEventListener("pointermove", moveDrag);
  document.addEventListener("pointerup", endDrag);
  elements.playfield.addEventListener("pointermove", handlePlayfieldPointerMove);
  elements.promptForm.addEventListener("submit", submitPrompt);
  elements.soundToggle.addEventListener("click", toggleSound);
  elements.resetButton.addEventListener("click", resetGame);
  elements.rewardMainButton.addEventListener("click", advanceRewardStage);
  elements.rewardRotateButton.addEventListener("click", rotateRewardEgg);
  elements.rewardResetButton.addEventListener("click", resetGame);
}

function startDrag(event) {
  if (state.rewardStage !== "hidden" || !elements.promptOverlay.hidden) {
    return;
  }

  if (state.supply <= 0) {
    openPrompt();
    return;
  }

  event.preventDefault();
  ensureAudioContext();
  syncAudioState();
  playTone({ frequency: 510, duration: 0.04, type: "square", volume: 0.03 });

  const dragNode = document.createElement("div");
  dragNode.className = "drag-egg";
  dragNode.innerHTML = looseEggSvg();
  document.body.appendChild(dragNode);
  state.dragNode = dragNode;
  playEggGrabSound();
  startEggDragLoop();
  positionDrag(event.clientX, event.clientY);
}

function moveDrag(event) {
  if (!state.dragNode) {
    return;
  }

  event.preventDefault();
  positionDrag(event.clientX, event.clientY);
}

function endDrag(event) {
  if (!state.dragNode) {
    return;
  }

  const droppedInMouth = hitMouth(event.clientX, event.clientY);
  state.dragNode.remove();
  state.dragNode = null;
  stopEggDragLoop();

  if (droppedInMouth) {
    feedEgg();
  } else {
    setStatus("That egg did not count.");
    playTone({ frequency: 180, duration: 0.08, type: "sawtooth", volume: 0.025 });
  }
}

function feedEgg() {
  const sequence = state.phase === "before-pack" ? BEFORE_PACK_SEQUENCE : AFTER_PACK_SEQUENCE;
  const step = sequence[state.scriptIndex];

  if (!step) {
    return;
  }

  state.scriptIndex += 1;
  state.fed = step.fed;
  state.supply = step.supply;
  updateHud();
  updateBasketState();
  animateClass(elements.basketZone, "is-jiggle", 320);
  pulseTarget();
  setStatus(step.status);
  playDropSound(step.glitch);

  if (step.glitch) {
    glitchHud();
    animateClass(elements.playfield, "is-glitching", 320);
    playNoiseBurst();
  }

  if (step.quote) {
    showQuote(step.quote);
    playVoice(step.voice);
  }

  if (step.prompt) {
    openPrompt();
    return;
  }

  if (step.reward) {
    openReward();
  }
}

function submitPrompt(event) {
  event.preventDefault();
  closePrompt();
  state.phase = "after-pack";
  state.scriptIndex = 0;
  state.supply = 40;
  updateHud();
  updateBasketState();
  setStatus("You now have 40 eggs.");
  showTransitionBanner("80 pack installed", 1200);
  animateClass(elements.playfield, "is-pack-flash", 620);
  showQuote("I don't know. I've never gotten here before.");
  playVoice("never-here");
  playPackChime();
  playTone({ frequency: 320, duration: 0.16, type: "triangle", volume: 0.03, slideTo: 460 });
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  elements.soundToggle.textContent = state.soundEnabled ? "SOUND ON" : "SOUND OFF";

  if (state.soundEnabled) {
    ensureAudioContext();
    syncAudioState({ restartMusic: true });
    playTone({ frequency: 400, duration: 0.05, type: "square", volume: 0.03 });
  } else {
    stopBackgroundAudio();
  }
}

function resetGame() {
  closePrompt();
  closeReward();
  clearQuote();
  hideTransitionBanner();
  stopEggDragLoop();
  state.phase = "before-pack";
  state.scriptIndex = 0;
  state.fed = 0;
  state.supply = 12;
  state.revealView = "front";
  state.musicMode = "play";
  state.lastPointerTickAt = 0;
  state.lastPointerX = null;
  state.lastPointerY = null;
  updateHud();
  updateBasketState();
  elements.playfield.classList.remove("is-winning");
  syncAudioState({ restartMusic: true });
  setStatus("Drag eggs into mouth.");
  playTone({ frequency: 260, duration: 0.08, type: "square", volume: 0.02 });
}

function openPrompt() {
  elements.promptOverlay.hidden = false;
  elements.promptInput.value = "";
  elements.promptInput.focus();
  showTransitionBanner("Out of eggs", 850);
  setStatus("Dude, you ran out of eggs. Would you like to buy an 80 pack of eggs?");
  playTone({ frequency: 140, duration: 0.2, type: "sawtooth", volume: 0.03, slideTo: 110 });
}

function closePrompt() {
  elements.promptOverlay.hidden = true;
}

function openReward() {
  state.rewardStage = "congrats";
  elements.rewardOverlay.hidden = false;
  elements.playfield.classList.add("is-winning");
  setMusicMode("win");
  setRewardArt(stanceEggSvg(), "is-stance");
  elements.rewardLine.textContent = "Congrats, big boy.";
  elements.rewardMainButton.hidden = false;
  elements.rewardMainButton.textContent = "LOOK AT PRIZE";
  elements.rewardRotateButton.hidden = true;
  elements.rewardResetButton.hidden = true;
  showTransitionBanner("Congrats, big boy.", 950);
  playWinSting();
  playTone({ frequency: 280, duration: 0.1, type: "triangle", volume: 0.03, slideTo: 360 });
  window.setTimeout(() => {
    playTone({ frequency: 420, duration: 0.12, type: "triangle", volume: 0.03, slideTo: 510 });
  }, 110);
}

function advanceRewardStage() {
  if (state.rewardStage === "congrats") {
    state.rewardStage = "nude-front";
    state.revealView = "front";
    setRewardArt(nudeFrontEggSvg(), "is-provocative");
    elements.rewardLine.textContent = "You're looking at a nude egg.";
    elements.rewardMainButton.hidden = true;
    elements.rewardRotateButton.hidden = false;
    elements.rewardResetButton.hidden = false;
    showTransitionBanner("You're looking at a nude egg.", 1300);
    animateClass(elements.playfield, "is-pack-flash", 420);
    showQuote("It's got a bush? What the hell?");
    setStatus("You're looking at a nude egg.");
    playVoice("bush");
    playTone({ frequency: 90, duration: 0.22, type: "square", volume: 0.03, slideTo: 70 });
  }
}

function rotateRewardEgg() {
  if (state.rewardStage !== "nude-front" && state.rewardStage !== "nude-back") {
    return;
  }

  state.revealView = state.revealView === "front" ? "back" : "front";
  state.rewardStage = state.revealView === "front" ? "nude-front" : "nude-back";
  setRewardArt(state.revealView === "front" ? nudeFrontEggSvg() : nudeBackEggSvg(), state.revealView === "front" ? "is-provocative" : "is-back");

  if (state.revealView === "back") {
    setStatus("Porn? That's a nude egg I won from my game.");
    showQuote("Porn? That's a nude egg I won from my game.");
    playVoice("porn");
  } else {
    setStatus("You're looking at a nude egg.");
  }

  playTone({ frequency: 180, duration: 0.12, type: "square", volume: 0.028, slideTo: 220 });
}

function closeReward() {
  state.rewardStage = "hidden";
  elements.rewardOverlay.hidden = true;
  setRewardArt("", "");
  elements.rewardRotateButton.hidden = true;
  elements.rewardResetButton.hidden = true;
  elements.rewardMainButton.hidden = false;
  elements.playfield.classList.remove("is-winning");
  setMusicMode("play");
}

function pulseTarget() {
  elements.targetZone.classList.remove("is-fed");
  void elements.targetZone.offsetWidth;
  elements.targetZone.classList.add("is-fed");
}

function updateHud() {
  elements.fedDisplay.textContent = `EGGS FED: ${state.fed}`;
  elements.supplyDisplay.textContent = `BASKET: ${state.supply}`;
  elements.basketCount.textContent = `${state.supply} EGGS`;
}

function updateBasketState() {
  let level = "empty";

  if (state.supply > 20) {
    level = "full";
  } else if (state.supply > 5) {
    level = "medium";
  } else if (state.supply > 0) {
    level = "low";
  }

  elements.basketZone.dataset.level = level;
  elements.basketZone.dataset.empty = String(state.supply <= 0);
}

function setStatus(message) {
  elements.statusLine.textContent = message;
}

function showQuote(message) {
  clearTimeout(state.quoteTimer);
  elements.quoteText.textContent = message;
  elements.quoteBox.hidden = false;
  animateClass(elements.quoteBox, "is-live", 320);
  state.quoteTimer = window.setTimeout(() => {
    clearQuote();
  }, 2800);
}

function clearQuote() {
  clearTimeout(state.quoteTimer);
  elements.quoteBox.hidden = true;
}

function glitchHud() {
  animateClass(elements.fedDisplay, "is-glitching", 420);
  animateClass(elements.supplyDisplay, "is-glitching", 420);
}

function showTransitionBanner(message, duration = 1100) {
  clearTimeout(state.bannerTimer);
  elements.transitionBannerText.textContent = message.toUpperCase();
  elements.transitionBanner.hidden = false;
  animateClass(elements.transitionBanner, "is-live", 620);
  state.bannerTimer = window.setTimeout(() => {
    hideTransitionBanner();
  }, duration);
}

function hideTransitionBanner() {
  clearTimeout(state.bannerTimer);
  elements.transitionBanner.hidden = true;
}

function animateClass(node, className, duration = 320) {
  if (!node) {
    return;
  }

  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  window.setTimeout(() => {
    node.classList.remove(className);
  }, duration);
}

function handlePlayfieldPointerMove(event) {
  if (!state.soundEnabled) {
    return;
  }

  const now = performance.now();

  if (state.lastPointerX !== null && state.lastPointerY !== null) {
    const dx = event.clientX - state.lastPointerX;
    const dy = event.clientY - state.lastPointerY;
    const distance = Math.hypot(dx, dy);

    if (distance < 18 || now - state.lastPointerTickAt < 42) {
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      return;
    }
  }

  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  state.lastPointerTickAt = now;
  playPointerTick();
}

function setRewardArt(markup, poseClass) {
  elements.rewardArt.className = poseClass ? `reward-art ${poseClass}` : "reward-art";
  elements.rewardArt.innerHTML = markup;
}

function positionDrag(x, y) {
  if (!state.dragNode) {
    return;
  }

  state.dragNode.style.left = `${x}px`;
  state.dragNode.style.top = `${y}px`;
}

function hitMouth(x, y) {
  const rect = document.querySelector("#mouth-hitbox").getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function ensureAudioContext() {
  if (!state.soundEnabled) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new window.AudioContext();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function syncAudioState({ restartMusic = false } = {}) {
  if (!state.soundEnabled) {
    stopBackgroundAudio();
    return;
  }

  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  if (!state.ambienceNodes.length) {
    startAmbience(context);
  }

  startMusicLoop(restartMusic);
}

function startAmbience(context) {
  if (state.ambienceNodes.length) {
    return;
  }

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 240;

  const low = context.createOscillator();
  low.type = "sine";
  low.frequency.value = 58;
  const lowGain = context.createGain();
  lowGain.gain.value = 0.0026;

  const high = context.createOscillator();
  high.type = "triangle";
  high.frequency.value = 118;
  const highGain = context.createGain();
  highGain.gain.value = 0.0014;

  low.connect(lowGain);
  high.connect(highGain);
  lowGain.connect(filter);
  highGain.connect(filter);
  filter.connect(context.destination);

  low.start();
  high.start();

  state.ambienceNodes = [low, high, lowGain, highGain, filter];
}

function startMusicLoop(restart = false) {
  if (!state.soundEnabled || !state.audioContext) {
    return;
  }

  if (state.musicLoopTimer && !restart) {
    return;
  }

  clearTimeout(state.musicLoopTimer);

  const pattern = MUSIC_PATTERNS[state.musicMode];
  let index = 0;

  const loop = () => {
    if (!state.soundEnabled || !state.audioContext) {
      state.musicLoopTimer = null;
      return;
    }

    const note = pattern[index];

    if (note.frequency) {
      playTone({
        frequency: note.frequency,
        duration: note.duration,
        type: note.type,
        volume: note.volume
      });
    }

    index = (index + 1) % pattern.length;
    state.musicLoopTimer = window.setTimeout(loop, note.wait);
  };

  state.musicLoopTimer = window.setTimeout(loop, 120);
}

function setMusicMode(mode) {
  state.musicMode = mode;

  if (state.soundEnabled && state.audioContext) {
    startMusicLoop(true);
  }
}

function stopBackgroundAudio() {
  stopEggDragLoop();
  clearTimeout(state.musicLoopTimer);
  state.musicLoopTimer = null;

  state.ambienceNodes.forEach((node) => {
    if (typeof node.stop === "function") {
      try {
        node.stop();
      } catch (_error) {
        // Ignore already-stopped oscillators.
      }
    }

    if (typeof node.disconnect === "function") {
      node.disconnect();
    }
  });

  state.ambienceNodes = [];

  state.activeVoices.forEach((voice) => {
    voice.pause();
    voice.currentTime = 0;
  });
  state.activeVoices.clear();
}

function playTone({ frequency, duration, type, volume, slideTo }) {
  if (!state.soundEnabled) {
    return;
  }

  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const start = context.currentTime;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);

  if (slideTo) {
    oscillator.frequency.linearRampToValueAtTime(slideTo, end);
  }

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

function playDropSound(isGlitchy) {
  playTone({ frequency: 220, duration: 0.05, type: "square", volume: 0.03, slideTo: 260 });
  window.setTimeout(() => {
    playTone({
      frequency: isGlitchy ? 480 : 330,
      duration: isGlitchy ? 0.1 : 0.06,
      type: isGlitchy ? "sawtooth" : "triangle",
      volume: 0.026,
      slideTo: isGlitchy ? 180 : 390
    });
  }, 40);
}

function playNoiseBurst() {
  [110, 330, 145].forEach((frequency, index) => {
    window.setTimeout(() => {
      playTone({
        frequency,
        duration: 0.06,
        type: index % 2 === 0 ? "sawtooth" : "square",
        volume: 0.02,
        slideTo: frequency * 0.8
      });
    }, index * 35);
  });
}

function playPointerTick() {
  const pitch = 1350 + Math.random() * 220;
  playTone({
    frequency: pitch,
    duration: 0.014,
    type: "square",
    volume: 0.0055,
    slideTo: pitch * 0.92
  });
}

function playEggGrabSound() {
  playTone({
    frequency: 610,
    duration: 0.03,
    type: "square",
    volume: 0.015,
    slideTo: 540
  });
  window.setTimeout(() => {
    playTone({
      frequency: 300,
      duration: 0.035,
      type: "triangle",
      volume: 0.01,
      slideTo: 260
    });
  }, 18);
}

function playEggDragTick() {
  const base = 430 + Math.random() * 70;
  playTone({
    frequency: base,
    duration: 0.022,
    type: "triangle",
    volume: 0.007,
    slideTo: base * 0.87
  });
}

function startEggDragLoop() {
  stopEggDragLoop();

  const loop = () => {
    if (!state.dragNode || !state.soundEnabled) {
      state.dragSoundTimer = null;
      return;
    }

    playEggDragTick();
    state.dragSoundTimer = window.setTimeout(loop, 78);
  };

  state.dragSoundTimer = window.setTimeout(loop, 54);
}

function stopEggDragLoop() {
  clearTimeout(state.dragSoundTimer);
  state.dragSoundTimer = null;
}

function playPackChime() {
  [262, 392, 524].forEach((frequency, index) => {
    window.setTimeout(() => {
      playTone({
        frequency,
        duration: 0.11,
        type: "triangle",
        volume: 0.026,
        slideTo: frequency * 1.05
      });
    }, index * 80);
  });
}

function playWinSting() {
  [196, 247, 330, 392].forEach((frequency, index) => {
    window.setTimeout(() => {
      playTone({
        frequency,
        duration: 0.12,
        type: "triangle",
        volume: 0.028,
        slideTo: frequency * 1.08
      });
    }, index * 75);
  });
}

function playVoice(key) {
  const file = VOICE_FILES[key];

  if (!file || !state.soundEnabled) {
    return;
  }

  if (state.missingVoiceFiles.has(key)) {
    playTone({ frequency: 250, duration: 0.14, type: "triangle", volume: 0.02, slideTo: 210 });
    return;
  }

  const voice = new Audio(file);
  state.activeVoices.add(voice);
  voice.volume = 0.9;

  let handled = false;
  const fail = () => {
    if (handled) {
      return;
    }

    handled = true;
    state.activeVoices.delete(voice);
    state.missingVoiceFiles.add(key);
    playTone({ frequency: 250, duration: 0.14, type: "triangle", volume: 0.02, slideTo: 210 });
  };

  voice.addEventListener("ended", () => {
    state.activeVoices.delete(voice);
  }, { once: true });
  voice.addEventListener("error", fail, { once: true });
  voice.play().catch(fail);
}

function targetEggSvg() {
  return `
    <svg viewBox="0 0 210 240" aria-hidden="true">
      <g fill="none" stroke="#111111" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="104" cy="214" rx="48" ry="8" fill="rgba(17,17,17,0.08)" stroke="none" />
        <path d="M58 210H20c-4 0-6-3-5-7c3-12 12-20 28-22h31v29z" fill="#ffffff" />
        <path d="M149 210h38c4 0 6-3 5-7c-3-12-12-20-28-22h-31v29z" fill="#ffffff" />
        <path d="M74 181v-41" />
        <path d="M134 181v-41" />
        <ellipse cx="104" cy="98" rx="60" ry="78" fill="#ffffff" />
        <circle cx="81" cy="69" r="10" fill="#ffffff" />
        <circle cx="127" cy="69" r="10" fill="#ffffff" />
        <circle cx="81" cy="69" r="3" fill="#111111" stroke="none" />
        <circle cx="127" cy="69" r="3" fill="#111111" stroke="none" />
        <circle class="mouth-ring" cx="104" cy="124" r="36" fill="#111111" stroke="none" />
      </g>
    </svg>
  `;
}

function looseEggSvg() {
  return `
    <svg viewBox="0 0 50 64" aria-hidden="true">
      <ellipse cx="25" cy="30" rx="18" ry="24" fill="#ffffff" stroke="#111111" stroke-width="2.6" />
    </svg>
  `;
}

function basketSvg() {
  return `
    <svg viewBox="0 0 180 170" aria-hidden="true">
      <g fill="none" stroke="#111111" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="92" cy="145" rx="44" ry="8" fill="rgba(17,17,17,0.08)" stroke="none" />
        <g fill="#ffffff">
          <ellipse class="pile-egg" data-min="low" cx="67" cy="70" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="low" cx="92" cy="55" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="medium" cx="117" cy="70" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="medium" cx="54" cy="88" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="medium" cx="80" cy="90" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="full" cx="105" cy="90" rx="18" ry="24" />
          <ellipse class="pile-egg" data-min="full" cx="130" cy="88" rx="18" ry="24" />
        </g>
        <path d="M43 92h100l-7 45H50z" fill="#6f7775" />
        <path d="M38 82h110c5 0 9 4 9 9c0 4-4 8-9 8H38c-5 0-9-4-9-8c0-5 4-9 9-9z" fill="#d7cddd" />
        <path d="M56 100h74" />
        <path d="M54 111h78" />
        <path d="M50 121l84 0" />
        <path d="M57 92l-8 45" />
        <path d="M76 92l-8 45" />
        <path d="M95 92l-8 45" />
        <path d="M114 92l-8 45" />
        <path d="M133 92l-8 45" />
      </g>
    </svg>
  `;
}

function stanceEggSvg() {
  return `
    <svg viewBox="0 0 220 270" aria-hidden="true">
      <g fill="none" stroke="#111111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="110" cy="246" rx="48" ry="8" fill="rgba(17,17,17,0.08)" stroke="none" />
        <path d="M67 239H31c-4 0-6-3-5-7c3-11 12-19 29-22h32v29z" fill="#ffffff" />
        <path d="M154 239h36c4 0 6-3 5-7c-3-11-12-19-29-22h-32v29z" fill="#ffffff" />
        <path d="M88 210v-44" />
        <path d="M132 210v-44" />
        <ellipse cx="110" cy="118" rx="58" ry="82" fill="#ffffff" />
        <path d="M73 130L49 149L57 174" />
        <path d="M147 130l24 19l-8 25" />
        <path d="M57 174l-11 3l2 11l12-1" fill="#ffffff" />
        <path d="M163 174l11 3l-2 11l-12-1" fill="#ffffff" />
        <circle cx="90" cy="92" r="11" fill="#ffffff" />
        <circle cx="130" cy="92" r="11" fill="#ffffff" />
        <circle cx="90" cy="92" r="3" fill="#111111" stroke="none" />
        <circle cx="130" cy="92" r="3" fill="#111111" stroke="none" />
        <path d="M101 126h18" />
      </g>
    </svg>
  `;
}

function nudeFrontEggSvg() {
  return `
    <svg viewBox="0 0 240 300" aria-hidden="true">
      <g fill="none" stroke="#111111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="120" cy="274" rx="50" ry="8" fill="rgba(17,17,17,0.08)" stroke="none" />
        <path d="M76 266H39c-4 0-6-3-5-7c3-11 12-19 28-22h34v29z" fill="#ffffff" />
        <path d="M164 266h37c4 0 6-3 5-7c-3-11-12-19-28-22h-34v29z" fill="#ffffff" />
        <path d="M98 238v-46" />
        <path d="M143 238v-46" />
        <g transform="rotate(-7 122 128)">
          <ellipse cx="122" cy="122" rx="60" ry="85" fill="#ffffff" />
          <path d="M88 135L66 153L72 179" />
          <path d="M154 131l24 14l-9 27" />
          <path d="M72 179l-11 3l2 12l12-1" fill="#ffffff" />
          <path d="M169 172l11 3l-2 12l-12-1" fill="#ffffff" />
          <path d="M98 89c7-7 18-7 25 0" />
          <path d="M128 89c7-7 18-7 25 0" />
          <circle cx="107" cy="96" r="3" fill="#111111" stroke="none" />
          <circle cx="142" cy="96" r="3" fill="#111111" stroke="none" />
          <path d="M118 129c9 2 18 2 27 0" />
        </g>
        <path d="M91 205c16 7 55 8 74 1" />
        <path d="M95 207c8 10 16 18 25 18c9 0 17-8 25-18" />
        <path d="M108 206c6-12 14-18 24-18c10 0 18 6 24 18" />
        <path d="M113 207l6-5" />
        <path d="M125 201l5 6" />
        <path d="M137 207l6-5" />
        <path d="M111 232c7 5 15 5 22 0" />
      </g>
    </svg>
  `;
}

function nudeBackEggSvg() {
  return `
    <svg viewBox="0 0 240 300" aria-hidden="true">
      <g fill="none" stroke="#111111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="120" cy="274" rx="50" ry="8" fill="rgba(17,17,17,0.08)" stroke="none" />
        <path d="M76 266H39c-4 0-6-3-5-7c3-11 12-19 28-22h34v29z" fill="#ffffff" />
        <path d="M164 266h37c4 0 6-3 5-7c-3-11-12-19-28-22h-34v29z" fill="#ffffff" />
        <path d="M98 238v-46" />
        <path d="M143 238v-46" />
        <g transform="rotate(8 120 126)">
          <path d="M78 70c9-19 25-31 42-31c18 0 34 12 43 31c10 21 12 48 12 72c0 28-3 48-19 62c-10 9-22 13-36 13c-14 0-26-4-36-13c-16-14-19-34-19-62c0-24 2-51 13-72z" fill="#ffffff" />
          <path d="M120 182c7 5 15 5 22 0" />
          <path d="M97 180c12 10 35 10 47 0" />
          <ellipse cx="120" cy="202" rx="8" ry="10" fill="#111111" />
          <path d="M108 201c2 5 3 9 3 13" />
          <path d="M132 201c-2 5-3 9-3 13" />
          <path d="M83 132L60 150L68 176" />
          <path d="M157 132l23 18l-8 26" />
          <path d="M68 176l-11 3l2 12l12-1" fill="#ffffff" />
          <path d="M172 176l11 3l-2 12l-12-1" fill="#ffffff" />
        </g>
        <path d="M92 205c16 7 55 8 74 1" />
      </g>
    </svg>
  `;
}

init();
