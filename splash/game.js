const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const startPanel = document.querySelector("#startPanel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreEl = document.querySelector("#finalScore");
const startButton = document.querySelector("#start");
const restartButton = document.querySelector("#restart");
const pauseButton = document.querySelector("#pause");

const state = {
  running: false,
  paused: false,
  over: false,
  score: 0,
  wave: 1,
  lives: 8,
  spawnTimer: 0,
  spawnEvery: 980,
  lastTime: 0,
  splatches: [],
  bursts: []
};

let width = 0;
let height = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, window.innerWidth);
  height = Math.max(480, window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function reset() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.score = 0;
  state.wave = 1;
  state.lives = 8;
  state.spawnTimer = 0;
  state.spawnEvery = 940;
  state.lastTime = performance.now();
  state.splatches = [];
  state.bursts = [];
  scoreEl.textContent = "0";
  waveEl.textContent = "1";
  pauseButton.textContent = "Pause";
  pauseButton.setAttribute("aria-pressed", "false");
  startPanel.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  for (let i = 0; i < 4; i += 1) spawnSplatch(true);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnSplatch(gentle = false) {
  const largestRadius = Math.min(58 + state.wave * 2, 88, width * 0.18, height * 0.18);
  const radius = rand(20, Math.max(26, largestRadius));
  const taps = Math.max(1, Math.ceil(radius / 22) + Math.floor(state.wave / 4));
  const margin = radius + 14;
  const minY = Math.max(92, margin);
  const maxX = Math.max(margin, width - margin);
  const maxY = Math.max(minY, height - margin);
  state.splatches.push({
    x: rand(margin, maxX),
    y: rand(minY, maxY),
    radius,
    maxRadius: radius,
    taps,
    maxTaps: taps,
    age: gentle ? rand(0, 900) : 0,
    ttl: rand(5600, 7900) - Math.min(state.wave * 170, 2600),
    hue: rand(145, 178),
    wobble: rand(0, Math.PI * 2)
  });
}

function hitSplatch(x, y) {
  for (let i = state.splatches.length - 1; i >= 0; i -= 1) {
    const splatch = state.splatches[i];
    const dx = x - splatch.x;
    const dy = y - splatch.y;
    if (Math.hypot(dx, dy) <= splatch.radius + 10) {
      splatch.taps -= 1;
      splatch.radius = Math.max(12, splatch.maxRadius * (0.58 + splatch.taps / splatch.maxTaps * 0.42));
      state.score += 5;
      scoreEl.textContent = state.score;
      burst(x, y, splatch.taps <= 0 ? 16 : 7, splatch.hue);
      if (splatch.taps <= 0) {
        state.score += Math.round(splatch.maxRadius);
        scoreEl.textContent = state.score;
        state.splatches.splice(i, 1);
        if (state.score >= state.wave * 180) {
          state.wave += 1;
          state.spawnEvery = Math.max(310, state.spawnEvery - 72);
          waveEl.textContent = state.wave;
        }
      }
      return;
    }
  }
  burst(x, y, 4, 350);
}

function burst(x, y, count, hue) {
  for (let i = 0; i < count; i += 1) {
    state.bursts.push({
      x,
      y,
      vx: rand(-1.9, 1.9),
      vy: rand(-2.5, 1.4),
      size: rand(2, 6),
      life: rand(260, 560),
      age: 0,
      hue
    });
  }
}

function onPointerDown(event) {
  if (!state.running || state.paused || state.over) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  hitSplatch(event.clientX - rect.left, event.clientY - rect.top);
}

function update(dt) {
  state.spawnTimer += dt;
  while (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer -= state.spawnEvery;
    spawnSplatch();
  }

  for (let i = state.splatches.length - 1; i >= 0; i -= 1) {
    const splatch = state.splatches[i];
    splatch.age += dt;
    splatch.wobble += dt * 0.003;
    if (splatch.age > splatch.ttl) {
      state.splatches.splice(i, 1);
      state.lives -= 1;
      burst(splatch.x, splatch.y, 10, 350);
      if (state.lives <= 0) endGame();
    }
  }

  for (let i = state.bursts.length - 1; i >= 0; i -= 1) {
    const dot = state.bursts[i];
    dot.age += dt;
    dot.x += dot.vx * dt * 0.06;
    dot.y += dot.vy * dt * 0.06;
    dot.vy += 0.004 * dt;
    if (dot.age > dot.life) state.bursts.splice(i, 1);
  }
}

function drawBackground(time) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#071016";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#263844";
  ctx.lineWidth = 1;
  const gap = 42;
  const drift = (time * 0.012) % gap;
  for (let x = -gap; x < width + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x + drift, 0);
    ctx.lineTo(x - width * 0.25 + drift, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSplatch(splatch, time) {
  const pulse = 1 + Math.sin(time * 0.006 + splatch.wobble) * 0.045;
  const r = splatch.radius * pulse;
  const danger = Math.max(0, splatch.age / splatch.ttl);

  const gradient = ctx.createRadialGradient(splatch.x - r * 0.28, splatch.y - r * 0.32, r * 0.18, splatch.x, splatch.y, r);
  gradient.addColorStop(0, `hsla(${splatch.hue}, 94%, 74%, 0.98)`);
  gradient.addColorStop(0.66, `hsla(${splatch.hue - 18}, 78%, 46%, 0.95)`);
  gradient.addColorStop(1, `hsla(${345 + danger * 14}, 92%, 56%, 0.96)`);

  ctx.save();
  ctx.translate(splatch.x, splatch.y);
  ctx.rotate(Math.sin(splatch.wobble) * 0.1);
  ctx.fillStyle = gradient;
  ctx.shadowColor = `hsla(${splatch.hue}, 100%, 66%, 0.36)`;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  for (let i = 0; i < 28; i += 1) {
    const a = (Math.PI * 2 * i) / 28;
    const edge = r * (0.89 + Math.sin(a * 5 + splatch.wobble) * 0.08 + Math.cos(a * 9) * 0.035);
    const x = Math.cos(a) * edge;
    const y = Math.sin(a) * edge;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(5, 12, 16, 0.22)";
  const bumps = Math.min(9, 4 + splatch.maxTaps);
  for (let i = 0; i < bumps; i += 1) {
    const a = splatch.wobble + i * 2.28;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a * 1.4) * r * 0.34, Math.max(3, r * rand(0.05, 0.1)), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#071016";
  ctx.globalAlpha = 0.78;
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(splatch.taps), 0, 1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBursts() {
  for (const dot of state.bursts) {
    const alpha = 1 - dot.age / dot.life;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${dot.hue}, 92%, 66%)`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLives() {
  const bottom = height - Math.max(18, Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
  const total = 8;
  const size = Math.min(18, width / 28);
  const start = width / 2 - ((total - 1) * size * 1.25) / 2;
  for (let i = 0; i < total; i += 1) {
    ctx.fillStyle = i < state.lives ? "#67e8b9" : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(start + i * size * 1.25, bottom, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIdle(time) {
  drawBackground(time);
  drawBursts();
  const demo = {
    x: width / 2,
    y: height * 0.36,
    radius: Math.min(92, width * 0.18),
    maxRadius: Math.min(92, width * 0.18),
    taps: 4,
    maxTaps: 4,
    age: 0,
    ttl: 1,
    hue: 157,
    wobble: time * 0.003
  };
  drawSplatch(demo, time);
}

function draw(time) {
  drawBackground(time);
  for (const splatch of state.splatches) drawSplatch(splatch, time);
  drawBursts();
  drawLives();

  if (state.paused) {
    ctx.fillStyle = "rgba(7, 16, 22, 0.48)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f7fbff";
    ctx.font = "800 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused", width / 2, height / 2);
  }
}

function endGame() {
  state.over = true;
  state.running = false;
  finalScoreEl.textContent = `Score ${state.score}`;
  gameOverPanel.classList.remove("hidden");
}

function frame(time) {
  const dt = Math.min(32, time - state.lastTime || 16);
  state.lastTime = time;
  if (state.running && !state.paused && !state.over) update(dt);
  if (state.running) draw(time);
  else drawIdle(time);
  requestAnimationFrame(frame);
}

startButton.addEventListener("click", reset);
restartButton.addEventListener("click", reset);
pauseButton.addEventListener("click", () => {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(state.paused));
});
canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
window.addEventListener("resize", () => {
  resize();
  state.splatches = state.splatches.filter((splatch) => (
    splatch.x >= splatch.radius &&
    splatch.x <= width - splatch.radius &&
    splatch.y >= splatch.radius &&
    splatch.y <= height - splatch.radius
  ));
});

resize();
requestAnimationFrame(frame);
