/* =========================================================
   CUSTOMIZATION — change these two values to personalize
   the entire website. Everything downstream reacts to them.
   ========================================================= */
const personName = "Rem";

const birthdayMessage =
`Hey ${personName} ❤️

Happy Birthday!

May your day be filled with laughter,
love, happiness,
good health,
and countless blessings.

Thank you for being such a wonderful person.

I just want you to know that I really appreciate you

I hope every dream you have comes true.

Enjoy your special day!

Have an amazing birthday!

Thank you

-Lucky`;

const LEAF_COLORS = [
  "#ff4f94", "#ff6699", "#ff8abf", "#ff5a8b",
  "#ff7ab6", "#ffb3d9", "#f06292"
];

/* =========================================================
   DOM REFERENCES
   ========================================================= */
const stage          = document.getElementById("stage");
const tapScene        = document.getElementById("tapScene");
const tapLabel        = document.getElementById("tapLabel");
const mainHeart       = document.getElementById("mainHeart");
const treeSvg         = document.getElementById("treeSvg");
const treeGroup       = document.getElementById("treeGroup");
const blossomLayer    = document.getElementById("blossomLayer");
const sparkleLayer    = document.getElementById("sparkleLayer");
const particleLayer   = document.getElementById("particleLayer");
const messageCard     = document.getElementById("messageCard");
const nameHighlight   = document.getElementById("nameHighlight");
const typewriterText  = document.getElementById("typewriterText");
const replayBtn       = document.getElementById("replayBtn");
const bgHeartsLayer   = document.getElementById("bgHearts");
const bgMusic         = document.getElementById("bgMusic");
const confettiCanvas  = document.getElementById("confettiCanvas");
const ctx             = confettiCanvas.getContext("2d");

/* =========================================================
   GLOBAL STATE (used so "Watch Again" can cleanly reset)
   ========================================================= */
let pendingTimers = [];      // every setTimeout id, so we can cancel on replay
let bgHeartsIntervalId = null;
let confettiActive = false;
let confettiRafId = null;
let confettiParticles = [];

/** setTimeout wrapper that remembers its id for cleanup */
function schedule(fn, delay) {
  const id = setTimeout(fn, delay);
  pendingTimers.push(id);
  return id;
}

function clearAllTimers() {
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers = [];
}

/* =========================================================
   BACKGROUND FLOATING HEARTS (continuous ambient effect)
   ========================================================= */
function spawnBackgroundHeart(boosted = false) {
  const heart = document.createElement("div");
  heart.className = "bg-heart";
  heart.textContent = "❤";

  const size = 10 + Math.random() * (boosted ? 26 : 18);
  const opacity = (boosted ? 0.35 : 0.18) + Math.random() * 0.3;
  const duration = 7 + Math.random() * 8;
  const drift = (Math.random() * 160 - 80).toFixed(0) + "px";
  const startX = Math.random() * window.innerWidth;

  heart.style.left = `${startX}px`;
  heart.style.fontSize = `${size}px`;
  heart.style.setProperty("--target-opacity", opacity.toFixed(2));
  heart.style.setProperty("--drift", drift);
  heart.style.animation = `floatUp ${duration}s linear forwards`;

  bgHeartsLayer.appendChild(heart);
  heart.addEventListener("animationend", () => heart.remove());
}

function startBackgroundHearts(boosted = false) {
  if (bgHeartsIntervalId) clearInterval(bgHeartsIntervalId);
  const rate = boosted ? 600 : 900;
  bgHeartsIntervalId = setInterval(() => spawnBackgroundHeart(boosted), rate);
}

/* start a gentle ambient stream immediately on page load */
startBackgroundHearts(false);

/* =========================================================
   AUDIO HELPERS — fade in / fade out background music
   ========================================================= */
function fadeAudio(targetVolume, duration, onDone) {
  const steps = 20;
  const stepTime = duration / steps;
  const startVolume = bgMusic.volume;
  const delta = (targetVolume - startVolume) / steps;
  let count = 0;

  const iv = setInterval(() => {
    count++;
    bgMusic.volume = Math.min(1, Math.max(0, startVolume + delta * count));
    if (count >= steps) {
      clearInterval(iv);
      if (onDone) onDone();
    }
  }, stepTime);
}

function playMusicFadeIn() {
  bgMusic.volume = 0;
  bgMusic.currentTime = 0;
  const playPromise = bgMusic.play();
  if (playPromise) playPromise.catch(() => { /* autoplay blocked until tap; fine, tap triggers this */ });
  fadeAudio(0.6, 1200);
}

function stopMusicFadeOut(callback) {
  fadeAudio(0, 700, () => {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    if (callback) callback();
  });
}

/* =========================================================
   STEP 2 — HEART FALL + LAND + SPARKLE BURST
   ========================================================= */
function dropHeart() {
  playMusicFadeIn();

  const rect = mainHeart.getBoundingClientRect();
  const groundY = window.innerHeight * 0.34; // where the heart "lands" near the tree base
  const fallDistance = Math.max(120, groundY - rect.top);

  // freeze the heart at its current screen position, then switch to fixed
  mainHeart.style.setProperty("--fall-distance", `${fallDistance}px`);
  mainHeart.style.left = `${rect.left}px`;
  mainHeart.style.top = `${rect.top}px`;
  mainHeart.style.margin = "0";
  mainHeart.classList.add("falling");

  // hide the "tap the heart" label right away
  tapLabel.style.transition = "opacity 0.4s ease";
  tapLabel.style.opacity = "0";

  mainHeart.addEventListener("animationend", onHeartLanded, { once: true });
}

function onHeartLanded() {
  const rect = mainHeart.getBoundingClientRect();
  const landX = rect.left + rect.width / 2;
  const landY = rect.top + rect.height * 0.85;

  createSparkleBurst(landX, landY);
  tapScene.style.display = "none";

  schedule(() => growTree(landX, landY), 350);
}

function createSparkleBurst(x, y) {
  const burst = document.createElement("div");
  burst.className = "sparkle-burst";
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;

  const dotCount = 14;
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement("div");
    dot.className = "sparkle-dot";
    const angle = (Math.PI * 2 * i) / dotCount + Math.random() * 0.3;
    const dist = 30 + Math.random() * 40;
    dot.style.setProperty("--sx", `${Math.cos(angle) * dist}px`);
    dot.style.setProperty("--sy", `${Math.sin(angle) * dist}px`);
    burst.appendChild(dot);
  }

  document.body.appendChild(burst);
  schedule(() => burst.remove(), 900);
}

/* =========================================================
   STEP 3 — SVG TREE GROWTH (trunk draws, then branches)
   ========================================================= */
function growTree() {
  treeGroup.innerHTML = "";
  treeSvg.classList.add("visible");

  // trunk: a gently curving path from the base up to the crown
  const trunkData = "M200,500 C195,430 205,380 198,320 C193,278 202,250 200,222";
  const branches = [
    "M200,300 C170,285 140,270 108,275",
    "M200,300 C230,285 262,272 292,280",
    "M199,260 C172,240 145,222 116,222",
    "M199,260 C226,240 254,224 282,226",
    "M200,225 C182,205 160,190 136,182",
    "M200,225 C219,205 242,190 266,184"
  ];

  const trunkPath = makeTreePath(trunkData, 7);
  treeGroup.appendChild(trunkPath);
  animatePathDraw(trunkPath, 0, 1100);

  branches.forEach((d, i) => {
    const branchPath = makeTreePath(d, 4.5);
    treeGroup.appendChild(branchPath);
    // branches start drawing once the trunk has mostly finished, one by one
    animatePathDraw(branchPath, 950 + i * 220, 700);
  });

  const totalTime = 950 + branches.length * 220 + 700;
  schedule(() => growBlossom(), totalTime + 200);
}

function makeTreePath(d, width) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke-width", width);
  path.classList.add("tree-path");
  return path;
}

function animatePathDraw(path, delay, duration) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  path.style.transition = "none";

  schedule(() => {
    // force reflow so the browser registers the starting offset first
    path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
    path.style.strokeDashoffset = "0";
  }, delay);
}

/* =========================================================
   STEP 4 — THE HEART-SHAPED BLOSSOM MADE OF TINY HEARTS
   ========================================================= */
function heartShapePoints(count) {
  const points = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 40) {
    attempts++;
    const x = Math.random() * 2.8 - 1.4;
    const y = Math.random() * 2.8 - 1.4;
    const value = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
    if (value <= 0) points.push({ x, y });
  }
  return points;
}

function growBlossom() {
  // pause the ambient background hearts during the busiest moment -
  // hundreds of leaves are about to animate in, no need for extra work in parallel
  if (bgHeartsIntervalId) clearInterval(bgHeartsIntervalId);

  const treeRect = treeSvg.getBoundingClientRect();
  const centerX = treeRect.left + treeRect.width / 2;
  const centerY = treeRect.top + treeRect.height * 0.16;
  const scale = Math.min(window.innerWidth * 0.85, 360) / 2.6;

  const leafCount = 350;
  const points = heartShapePoints(leafCount);
  const maxStagger = 3000;
  const fragment = document.createDocumentFragment();
  const leaves = [];

  points.forEach((pt) => {
    const leaf = document.createElement("div");
    leaf.className = "leaf-heart";
    leaf.textContent = "❤";
    leaf.style.color = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];

    // random starting point somewhere around the edges of the screen
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight * 0.6;
    leaf.style.transform = `translate(${startX}px, ${startY}px) scale(0.2) rotate(${Math.random() * 360}deg)`;
    leaf.style.opacity = "0";

    fragment.appendChild(leaf);
    leaves.push({ el: leaf, pt });
  });

  // one single DOM mutation for all 380 leaves instead of 380 separate reflows
  blossomLayer.appendChild(fragment);

  leaves.forEach(({ el, pt }, i) => {
    const targetX = centerX + pt.x * scale;
    const targetY = centerY - pt.y * scale;
    const finalScale = 0.75 + Math.random() * 0.5;
    const finalRotate = Math.random() * 30 - 15;
    const delay = (i / leafCount) * maxStagger;

    schedule(() => {
      // promote to its own GPU layer only while it's actively animating,
      // then hand it back so the browser isn't juggling hundreds of layers forever
      el.style.willChange = "transform, opacity";
      el.style.transform = `translate(${targetX}px, ${targetY}px) scale(${finalScale}) rotate(${finalRotate}deg)`;
      el.style.opacity = "0.95";
      el.addEventListener("transitionend", () => { el.style.willChange = "auto"; }, { once: true });
    }, delay);
  });

  schedule(() => finishBlossom(), maxStagger + 1000);
}

function finishBlossom() {
  gentleZoom();
  decorateTreeWithSparklesAndParticles();
  startBackgroundHearts(true); // boost the ambient hearts, per step 5
  schedule(() => revealMessageCard(), 900);
}

function gentleZoom() {
  stage.classList.add("zoomed");
  schedule(() => stage.classList.remove("zoomed"), 1600);
}

function decorateTreeWithSparklesAndParticles() {
  const treeRect = treeSvg.getBoundingClientRect();

  for (let i = 0; i < 12; i++) {
    const sparkle = document.createElement("div");
    sparkle.className = "tree-sparkle";
    sparkle.style.left = `${treeRect.left + Math.random() * treeRect.width}px`;
    sparkle.style.top = `${treeRect.top + Math.random() * treeRect.height * 0.7}px`;
    sparkle.style.animationDelay = `${Math.random() * 1.8}s`;
    sparkleLayer.appendChild(sparkle);
  }

  for (let i = 0; i < 6; i++) {
    const particle = document.createElement("div");
    particle.className = "glow-particle";
    particle.style.left = `${treeRect.left + Math.random() * treeRect.width}px`;
    particle.style.top = `${treeRect.top + Math.random() * treeRect.height * 0.6}px`;
    particle.style.setProperty("--px", `${Math.random() * 30 - 15}px`);
    particle.style.setProperty("--py", `${Math.random() * 30 - 15}px`);
    particle.style.animationDuration = `${4 + Math.random() * 3}s`;
    particleLayer.appendChild(particle);
  }
}

/* =========================================================
   STEP 6 — GLASSMORPHISM MESSAGE CARD
   ========================================================= */
function revealMessageCard() {
  nameHighlight.textContent = personName;
  messageCard.classList.add("visible");
  schedule(() => startTypewriter(), 700);
}

/* =========================================================
   STEP 7 — TYPEWRITER MESSAGE
   ========================================================= */
function startTypewriter() {
  typewriterText.innerHTML = "";
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  typewriterText.appendChild(cursor);

  const fullText = birthdayMessage;
  let index = 0;

  function typeNextChar() {
    if (index >= fullText.length) {
      cursor.remove();
      schedule(() => launchConfetti(), 500);
      return;
    }

    const char = fullText[index];
    const textNode = document.createTextNode(char === "\n" ? "\n" : char);
    typewriterText.insertBefore(textNode, cursor);
    index++;

    typewriterText.scrollTop = typewriterText.scrollHeight;

    // pause a little longer right after a line break
    const isLineBreak = char === "\n";
    const delay = isLineBreak ? 260 : 26 + Math.random() * 20;
    schedule(typeNextChar, delay);
  }

  schedule(typeNextChar, 150);
}

/* =========================================================
   STEP 8 — CONFETTI (canvas based, falling from both sides)
   ========================================================= */
const CONFETTI_COLORS = ["#ff4f94", "#ff8abf", "#ffb3d9", "#f06292", "#eee0ff", "#ffe9dd", "#ffffff"];

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfettiCanvas();
window.addEventListener("resize", resizeConfettiCanvas);

function makeConfettiPiece(fromLeft) {
  return {
    x: fromLeft ? -10 : confettiCanvas.width + 10,
    y: Math.random() * confettiCanvas.height * 0.5,
    vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 4),
    vy: -2 - Math.random() * 3,
    gravity: 0.12 + Math.random() * 0.05,
    size: 6 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.3,
    life: 0
  };
}

function launchConfetti() {
  confettiActive = true;
  confettiParticles = [];
  const spawnStart = performance.now();
  const spawnDuration = 8000;

  function spawnBatch() {
    if (!confettiActive) return;
    const elapsed = performance.now() - spawnStart;
    if (elapsed < spawnDuration) {
      for (let i = 0; i < 3; i++) confettiParticles.push(makeConfettiPiece(true));
      for (let i = 0; i < 3; i++) confettiParticles.push(makeConfettiPiece(false));
      schedule(spawnBatch, 90);
    } else {
      confettiActive = false;
      schedule(finishConfetti, 1600);
    }
  }
  spawnBatch();
  confettiTick();
}

function confettiTick() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach(p => {
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotSpeed;
    p.life++;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  });

  confettiParticles = confettiParticles.filter(p => p.y < confettiCanvas.height + 40);

  if (confettiActive || confettiParticles.length > 0) {
    confettiRafId = requestAnimationFrame(confettiTick);
  } else {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function finishConfetti() {
  showReplayButton();
}

/* =========================================================
   STEP 9 — REPLAY BUTTON
   ========================================================= */
function showReplayButton() {
  replayBtn.classList.add("visible");
}

function resetExperience() {
  // stop everything in flight
  clearAllTimers();
  confettiActive = false;
  confettiParticles = [];
  if (confettiRafId) cancelAnimationFrame(confettiRafId);
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  stopMusicFadeOut(() => {
    // wipe dynamically generated layers
    blossomLayer.innerHTML = "";
    sparkleLayer.innerHTML = "";
    particleLayer.innerHTML = "";
    treeGroup.innerHTML = "";
    treeSvg.classList.remove("visible");

    // reset message card + typewriter
    messageCard.classList.remove("visible");
    typewriterText.innerHTML = "";
    replayBtn.classList.remove("visible");
    stage.classList.remove("zoomed");

    // reset the heart back to its resting tap position
    mainHeart.classList.remove("falling");
    mainHeart.removeAttribute("style");
    tapScene.style.display = "flex";
    tapScene.style.opacity = "1";
    tapLabel.style.opacity = "1";

    startBackgroundHearts(false);

    schedule(() => attachHeartTapHandler(), 300);
  });
}

/* =========================================================
   INITIAL INTERACTION — tap the heart to begin
   ========================================================= */
function attachHeartTapHandler() {
  mainHeart.addEventListener("click", dropHeart, { once: true });
}

replayBtn.addEventListener("click", resetExperience);

attachHeartTapHandler();
