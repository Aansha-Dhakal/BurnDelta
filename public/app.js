const state = {
  data: null,
  busy: false,
  message: "",
  toastTimer: null,
  telemetryFrame: null,
  calendarDate: null   // YYYY-MM-DD currently viewed in calendar
};

const app = document.querySelector("#app");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function fmt(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtDate(dateStr) {
  // dateStr = YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function setMessage(message, autoClear = false) {
  state.message = message;
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = null;
  if (autoClear) {
    state.toastTimer = setTimeout(() => { state.message = ""; render(); }, 3500);
  }
}

function renderToast() {
  if (!state.message) return "";
  const isError = state.message.startsWith("Error");
  return `<div class="toast ${isError ? "error" : ""}" role="status">${esc(state.message)}</div>`;
}

function renderShell(content) {
  const profile = state.data?.user?.profile;
  if (state.telemetryFrame) {
    cancelAnimationFrame(state.telemetryFrame);
    state.telemetryFrame = null;
  }
  if (window.telemetryResizeHandler) {
    window.removeEventListener("resize", window.telemetryResizeHandler);
    window.telemetryResizeHandler = null;
  }
  if (window._authBgCanvasCleanup) {
    window._authBgCanvasCleanup();
    window._authBgCanvasCleanup = null;
  }
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand"><span class="mark">⚡</span><span>BURNDELTA</span></div>
        <div class="actions" style="margin:0">
          ${profile ? `<span class="metric-pill">${fmt(profile.weightKg)} kg</span>` : ""}
          ${state.data ? `<button class="btn secondary" data-action="logout">Logout</button>` : ""}
        </div>
      </header>
      ${content}
      ${renderToast()}
    </main>
  `;
  bindGlobal();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function renderAuth() {
  renderShell(`
    <section class="auth-wrap auth-hero">
      <canvas class="auth-bg-canvas" id="authBgCanvas" aria-hidden="true"></canvas>

      <div class="auth-experience">

        <!-- LEFT: login panel -->
        <div class="auth-panel">
          <div class="auth-logo">
            <span class="auth-bolt">⚡</span>
            <span>BURNDELTA</span>
          </div>
          <p class="auth-copy">Sign in to sync meal analysis, burn-rate math, and kinetic offset guidance.</p>

          <form id="loginForm" class="auth-form" novalidate>
            <div class="auth-field">
              <label for="li-email">EMAIL</label>
              <input id="li-email" name="email" type="email" autocomplete="email" placeholder="your@email.com" required>
            </div>
            <div class="auth-field">
              <label for="li-pw">PASSWORD</label>
              <input id="li-pw" name="password" type="password" autocomplete="current-password" placeholder="Password" minlength="10" required>
            </div>
            <button class="btn auth-submit" type="submit">SIGN IN</button>
          </form>

          <div class="auth-divider"><span>NEW OPERATOR</span></div>

          <form id="registerForm" class="auth-form" novalidate>
            <div class="auth-field">
              <label for="reg-email">EMAIL</label>
              <input id="reg-email" name="email" type="email" autocomplete="email" placeholder="your@email.com" required>
            </div>
            <div class="auth-field">
              <label for="reg-pw">PASSWORD</label>
              <input id="reg-pw" name="password" type="password" autocomplete="new-password" placeholder="10+ characters" minlength="10" required>
            </div>
            <button class="btn auth-submit-reg" type="submit">CREATE ACCOUNT</button>
          </form>

          <div class="auth-status-bar">
            <span class="auth-status-dot"></span>
            <span>SYS_STATUS // ONLINE</span>
            <span class="auth-status-ver">v0.1.0</span>
          </div>
        </div>

        <!-- RIGHT: animated HUD visual -->
        <div class="auth-visual" aria-hidden="true">

          <!-- Top-left data chip -->
          <div class="auth-chip auth-chip-eq">
            <span class="chip-label">METABOLIC EQUATION</span>
            <span class="chip-line">m = &Delta;(biometric) &minus; B</span>
            <span class="chip-line">= 14500 + 3491 (1.287)</span>
            <span class="chip-line hl">= 16480 &minus; 8.57</span>
          </div>

          <!-- Top-right burn-rate chip -->
          <div class="auth-chip auth-chip-rate">
            <span class="chip-label">BURN-RATE</span>
            <span class="chip-val">137.250</span>
            <span class="chip-sub">19,999</span>
            <span class="chip-sub">28.1%</span>
          </div>

          <!-- Central HUD rings + schematic figure -->

          <!-- Metabolic core orb -->
          <div class="pulse-orb-wrap" aria-hidden="true">
            <svg class="pulse-orb-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stop-color="#f59e0b" stop-opacity="0.9"/>
                  <stop offset="40%"  stop-color="#f59e0b" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="orbInner" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stop-color="#fde68a" stop-opacity="1"/>
                  <stop offset="60%"  stop-color="#f59e0b" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#d97706" stop-opacity="0.8"/>
                </radialGradient>
                <filter id="orbBlur">
                  <feGaussianBlur stdDeviation="3.5"/>
                </filter>
              </defs>
              <!-- Outer glow rings -->
              <circle class="orb-ring orb-ring-1" cx="60" cy="60" r="46" stroke="#f59e0b" stroke-width="0.6" stroke-opacity="0.15"/>
              <circle class="orb-ring orb-ring-2" cx="60" cy="60" r="36" stroke="#f59e0b" stroke-width="0.8" stroke-opacity="0.22"/>
              <circle class="orb-ring orb-ring-3" cx="60" cy="60" r="26" stroke="#f59e0b" stroke-width="1"   stroke-opacity="0.30"/>
              <!-- Soft bloom -->
              <circle cx="60" cy="60" r="22" fill="url(#orbGlow)" filter="url(#orbBlur)"/>
              <!-- Expanding pulse waves -->
              <circle class="orb-pulse orb-pulse-a" cx="60" cy="60" r="14" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.6"/>
              <circle class="orb-pulse orb-pulse-b" cx="60" cy="60" r="14" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.6"/>
              <circle class="orb-pulse orb-pulse-c" cx="60" cy="60" r="14" fill="none" stroke="#fbbf24" stroke-width="1"   stroke-opacity="0.4"/>
              <!-- Solid core -->
              <circle cx="60" cy="60" r="8" fill="url(#orbInner)" filter="url(#orbBlur)"/>
              <circle cx="60" cy="60" r="5.5" fill="#fde68a"/>
              <circle cx="60" cy="60" r="3"   fill="#ffffff" opacity="0.85"/>
            </svg>
          </div>

          <div class="auth-wave-panel">
            <div class="wave-head">
              <span>Thermodynamic Feed</span>
              <span class="wave-badge">[Meal-Analysis 94.2%] | Kinetic Offset Active</span>
            </div>
            <div class="wave-frame">
              <canvas id="thermoCanvas"></canvas>
            </div>
          </div>

          <!-- Bottom formula overlay -->
          <div class="auth-formula-bar">
            <span>m=&Delta;(biometric) &minus; intake</span>
            <span>&Delta; = &int;(biometric_sensors) &minus; &int;(energy_input)</span>
          </div>
        </div>

      </div>
    </section>
  `);
  bindAuthBgCanvas();
  bindTelemetryCanvas();
  document.querySelector("#loginForm").addEventListener("submit", submitAuth("login"));
  document.querySelector("#registerForm").addEventListener("submit", submitAuth("register"));
}

function bindAuthBgCanvas() {
  if (state.telemetryFrame) cancelAnimationFrame(state.telemetryFrame);
  const canvas = document.getElementById("authBgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const particles = [];
  const PARTICLE_COUNT = 55;
  let W, H, raf;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawnParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.4,
      alpha: Math.random() * 0.45 + 0.12,
      color: Math.random() < 0.72 ? "0,229,160" : "249,115,22"
    };
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawnParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connection lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const opacity = (1 - dist / 130) * 0.13;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,229,160,${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    }

    raf = requestAnimationFrame(draw);
  }

  draw();
  // Store cleanup handle in a way we can cancel on next render
  window._authBgRaf = raf;
  window._authBgCanvasCleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}

function submitAuth(kind) {
  return async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state.data = await api(`/api/auth/${kind}`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      setMessage("");
      render();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      render();
    }
  };
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function renderOnboarding() {
  renderShell(`
    <section class="ob-page">
      <div class="ob-bg-grid" aria-hidden="true"></div>
      <form id="profileForm" class="ob-card" novalidate>

        <div class="ob-head">
          <div class="ob-head-logo">
            <span class="ob-bolt">⚡</span>
            <span>BURNDELTA</span>
          </div>
          <div class="ob-head-title">
            <h1>Initialize Metabolic Baseline</h1>
          </div>
        </div>

        <!-- ── ROW 1: Biometric readouts ── -->
        <div class="ob-row ob-row-bio">

          <!-- Age readout -->
          <div class="ob-readout">
            <div class="ob-readout-head">
              <span class="ob-tag">SYS_01</span>
              <span class="ob-label">AGE</span>
            </div>
            <div class="ob-readout-body">
              <input class="ob-input ob-input-big" name="age" type="number" min="13" max="110" value="22" required>
              <span class="ob-unit">YRS</span>
            </div>
            <div class="ob-readout-foot">BIOLOGICAL_AGE</div>
          </div>

          <!-- Sex readout -->
          <div class="ob-readout">
            <div class="ob-readout-head">
              <span class="ob-tag">SYS_02</span>
              <span class="ob-label">SEX</span>
            </div>
            <input type="hidden" name="sex" value="female">
            <div class="ob-readout-body ob-readout-body--fill">
              <div class="ob-pill" role="group" aria-label="Sex">
                <button class="active" type="button" data-action="set-toggle" data-input="sex" data-value="female">FEMALE</button>
                <button type="button" data-action="set-toggle" data-input="sex" data-value="male">MALE</button>
              </div>
            </div>
            <div class="ob-readout-foot">HORMONAL_PROFILE</div>
          </div>

          <!-- Height readout -->
          <div class="ob-readout">
            <div class="ob-readout-head">
              <span class="ob-tag">SYS_03</span>
              <span class="ob-label">HEIGHT</span>
            </div>
            <div class="ob-readout-body">
              <input class="ob-input ob-input-big" name="heightCm" type="number" min="120" max="230" step="0.1" value="168" required>
              <span class="ob-unit">CM</span>
            </div>
            <div class="ob-readout-foot">SKELETAL_FRAME</div>
          </div>

          <!-- Current weight readout -->
          <div class="ob-readout ob-readout--accent">
            <div class="ob-readout-head">
              <span class="ob-tag ob-tag--surplus">SYS_04</span>
              <span class="ob-label">CURRENT MASS</span>
            </div>
            <div class="ob-readout-body">
              <input class="ob-input ob-input-big" name="weightKg" type="number" min="30" max="300" step="0.1" value="70" required>
              <span class="ob-unit">KG</span>
            </div>
            <div class="ob-readout-foot">BODY_MASS_INPUT</div>
          </div>

          <!-- Target weight readout -->
          <div class="ob-readout ob-readout--accent">
            <div class="ob-readout-head">
              <span class="ob-tag ob-tag--surplus">SYS_05</span>
              <span class="ob-label">TARGET MASS</span>
            </div>
            <div class="ob-readout-body">
              <input class="ob-input ob-input-big" name="targetWeightKg" type="number" min="30" max="300" step="0.1" value="66" required>
              <span class="ob-unit">KG</span>
            </div>
            <div class="ob-readout-foot">DELTA_OBJECTIVE</div>
          </div>

        </div>

        <!-- ── ROW 2: Activity + Goal ── -->
        <div class="ob-row ob-row-config">

          <!-- Activity level — telemetry module -->
          <div class="ob-module" style="position:relative">
            <div class="ob-module-head">
              <div class="ob-module-title">
                <span class="ob-tag">MOD_01</span>
                <span class="ob-label">ACTIVITY COEFFICIENT</span>
              </div>
              <span class="ob-module-badge" id="activityBadge">1.55×</span>
            </div>
            <input type="hidden" name="activityLevel" value="moderate">
            <div class="ob-activity-grid">
              <button class="ob-activity-btn" type="button" data-action="set-activity" data-value="sedentary" data-label="Sedentary // 1.23x" data-mult="1.23">
                <span class="ob-ab-mult">1.23×</span>
                <span class="ob-ab-name">SEDENTARY</span>
                <span class="ob-ab-desc">little or no exercise</span>
              </button>
              <button class="ob-activity-btn" type="button" data-action="set-activity" data-value="light" data-label="Light Activity // 1.37x" data-mult="1.37">
                <span class="ob-ab-mult">1.37×</span>
                <span class="ob-ab-name">LIGHT</span>
                <span class="ob-ab-desc">1–3 days / week</span>
              </button>
              <button class="ob-activity-btn active" type="button" data-action="set-activity" data-value="moderate" data-label="Moderate Activity // 1.55x" data-mult="1.55">
                <span class="ob-ab-mult">1.55×</span>
                <span class="ob-ab-name">MODERATE</span>
                <span class="ob-ab-desc">3–5 days / week</span>
              </button>
              <button class="ob-activity-btn" type="button" data-action="set-activity" data-value="intense" data-label="Intense Training // 1.72x" data-mult="1.72">
                <span class="ob-ab-mult">1.72×</span>
                <span class="ob-ab-name">INTENSE</span>
                <span class="ob-ab-desc">6–7 days / week</span>
              </button>
            </div>
          </div>

          <!-- Fitness goal -->
          <div class="ob-module ob-module--narrow" style="position:relative">
            <div class="ob-module-head">
              <div class="ob-module-title">
                <span class="ob-tag">MOD_02</span>
                <span class="ob-label">FITNESS DIRECTIVE</span>
              </div>
            </div>
            <input type="hidden" name="goal" value="loss">
            <div class="ob-goal-stack">
              <button class="ob-goal-btn active" type="button" data-action="set-goal" data-value="loss" data-label="Weight Loss">
                <span class="ob-goal-icon">▼</span>
                <div>
                  <span class="ob-goal-name">WEIGHT LOSS</span>
                  <span class="ob-goal-sub">TDEE − 500 kcal/day</span>
                </div>
              </button>
              <button class="ob-goal-btn" type="button" data-action="set-goal" data-value="maintain" data-label="Maintenance">
                <span class="ob-goal-icon">◆</span>
                <div>
                  <span class="ob-goal-name">MAINTENANCE</span>
                  <span class="ob-goal-sub">TDEE = target</span>
                </div>
              </button>
              <button class="ob-goal-btn" type="button" data-action="set-goal" data-value="gain" data-label="Mass Gain">
                <span class="ob-goal-icon">▲</span>
                <div>
                  <span class="ob-goal-name">MASS GAIN</span>
                  <span class="ob-goal-sub">TDEE + 350 kcal/day</span>
                </div>
              </button>
            </div>
          </div>

        </div>

        <button class="ob-submit" type="submit">SAVE AND CONTINUE</button>

        <div class="ob-footer">
          <span class="ob-status-dot"></span>
          <span>METABOLIC_ENGINE // READY</span>
          <span class="ob-footer-ver">v0.1.0</span>
        </div>

      </form>
    </section>
  `);
  const profileForm = document.querySelector("#profileForm");
  bindProfileControls(profileForm);
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state.data = await api("/api/profile", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
      setMessage("");
      render();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      render();
    }
  });
}

function bindProfileControls(profileForm) {
  profileForm.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;

    if (action.dataset.action === "set-activity") {
      profileForm.elements.activityLevel.value = action.dataset.value;
      profileForm.querySelectorAll("[data-action='set-activity']").forEach((btn) => btn.classList.toggle("active", btn === action));
      const badge = profileForm.querySelector("#activityBadge");
      if (badge) badge.textContent = action.dataset.mult + "×";
      return;
    }

    if (action.dataset.action === "set-goal") {
      profileForm.elements.goal.value = action.dataset.value;
      profileForm.querySelectorAll("[data-action='set-goal']").forEach((btn) => btn.classList.toggle("active", btn === action));
      return;
    }

    if (action.dataset.action === "set-toggle") {
      profileForm.elements[action.dataset.input].value = action.dataset.value;
      action.closest(".ob-pill").querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn === action));
    }
  });
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function bindTelemetryCanvas() {
  if (state.telemetryFrame) cancelAnimationFrame(state.telemetryFrame);
  const canvas = document.querySelector("#thermoCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let offset = 0;
  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.floor(85 * scale);
    canvas.style.height = "85px";
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };

  resize();
  if (window.telemetryResizeHandler) window.removeEventListener("resize", window.telemetryResizeHandler);
  window.telemetryResizeHandler = resize;
  window.addEventListener("resize", window.telemetryResizeHandler, { passive: true });

  const drawWave = (width, height, color, lineWidth, phase, amp, freq) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (let x = 0; x <= width; x += 1) {
      const y = height / 2 + Math.sin(x * freq + phase) * amp + Math.cos(x * freq * 1.8 + phase * 0.45) * (amp * 0.28);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const draw = () => {
    const width = canvas.clientWidth;
    const height = 85;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(39,39,42,0.45)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    drawWave(width, height, "rgba(34,211,238,0.55)", 2, offset, 14, 0.02);
    drawWave(width, height, "rgba(52,211,153,0.30)", 1.5, -offset * 0.9, 10, 0.028);

    offset += 0.035;
    state.telemetryFrame = requestAnimationFrame(draw);
  };

  draw();
}

function renderDashboard() {
  const profile = state.data.user.profile;
  const totals = state.data.totals;
  const todayMeals = state.data.meals;
  const target = profile.calorieTarget || 1;
  const consumed = totals.consumed;
  const percent = Math.min(1, consumed / target);
  const surplus = totals.delta > 0;
  const ringText = surplus ? `+${fmt(totals.delta)}` : fmt(Math.max(0, totals.remaining));
  const ringLabel = surplus ? "kcal surplus" : "calories left";
  const today = state.data.today;
  const isSunday = new Date(today + "T00:00:00").getDay() === 0;

  renderShell(`
    <section class="page">
      <nav class="tab-bar">
        <button class="tab active" data-tab="today">Today</button>
        <button class="tab" data-tab="calendar">Calendar</button>
      </nav>

      <div id="tabToday">
        <div class="grid">

          <!-- Left: ring + stats -->
          <div class="panel">
            <div class="status-stage">
              <div class="ring" style="--progress:${percent * 360}deg;--ring-color:${surplus ? "var(--surplus)" : "var(--safe)"}">
                <div class="ring-inner">
                  <div>
                    <div class="big-number" style="color:${surplus ? "var(--surplus)" : "var(--safe)"}">${ringText}</div>
                    <div class="muted small">${ringLabel}</div>
                  </div>
                </div>
              </div>
              <div class="stats-aside">
                <div>
                  <p class="stats-date">Today — ${fmtDate(today)}</p>
                  <p class="stats-consumed">${fmt(consumed)} / ${fmt(target)} kcal</p>
                </div>
                <div class="baseline-grid">
                  <div class="mini">
                    <span class="mini-label">BMR</span>
                    <strong>${fmt(profile.bmr)}</strong>
                  </div>
                  <div class="mini">
                    <span class="mini-label">TDEE</span>
                    <strong>${fmt(profile.tdee)}</strong>
                  </div>
                  <div class="mini">
                    <span class="mini-label">Target</span>
                    <strong>${fmt(target)}</strong>
                  </div>
                </div>
                ${surplus ? kineticCard(totals) : ""}
              </div>
            </div>
          </div>

          <!-- Right: log meal -->
          <div class="panel">
            <p class="log-panel-title">Log a meal</p>
            <form id="mealForm">
              <div class="upload-actions">
                <label class="dropzone" id="dropzone">
                  <span class="camera-icon">+</span>
                  <strong>Upload or take a photo</strong>
                  <span class="muted small" id="fileName">PNG, JPEG, or WEBP</span>
                  <input id="mealImage" name="mealImage" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden>
                </label>
                <button class="remote-btn" data-action="remote-capture" type="button">Snap with phone</button>
              </div>
              <div class="field" style="margin-top:4px">
                <span class="describe-label">Or describe the meal</span>
                <textarea name="description" rows="3" maxlength="180" placeholder="e.g. chicken breast, rice, broccoli"></textarea>
              </div>
              <div class="actions" style="margin-top:12px">
                <button class="btn" type="submit">${state.busy ? "Analyzing…" : "Log meal"}</button>
              </div>
            </form>
          </div>
        </div>

        ${isSunday ? weeklySundayBanner() : ""}

        <div class="panel" style="margin-top:16px">
          <p class="ledger-title">Meals today</p>
          <div class="ledger">${todayMeals.length ? todayMeals.map(mealCard).join("") : `<p class="muted" style="font-size:13px">No meals logged yet today.</p>`}</div>
        </div>
      </div>

      <div id="tabCalendar" style="display:none">
        ${renderCalendarHTML()}
      </div>
    </section>
  `);

  bindMealForm();
  bindTabs();
  bindCalendar();
}

function weeklySundayBanner() {
  const summaries = state.data.weeklySummaries;
  if (!summaries || summaries.length === 0) return "";
  // Current week is the most recent one
  const week = summaries[0];
  const over = week.overBy > 0;
  return `
    <div class="panel weekly-banner ${over ? "weekly-over" : "weekly-ok"}" style="margin-top:16px">
      <div class="weekly-banner-inner">
        <div>
          <p class="muted small" style="margin:0">📅 Weekly Review — week of ${fmtDate(week.weekStart)}</p>
          <p class="weekly-total">${fmt(week.totalCalories)} <span class="muted small">/ ${fmt(week.weeklyTarget)} kcal this week</span></p>
        </div>
        <div class="weekly-verdict ${over ? "surplus-text" : "safe-text"}">
          ${over
            ? `+${fmt(week.overBy)} kcal over weekly target`
            : `${fmt(week.underBy)} kcal under — great week!`}
        </div>
      </div>
    </div>
  `;
}

function kineticCard(totals) {
  return `
    <div class="alert">
      <p class="alert-title">⚡ ${fmt(totals.delta)} kcal surplus — offset with cardio</p>
      <div class="offset-grid">
        <div class="mini"><span class="mini-label">🏃 Run</span><strong>${fmt(totals.cardio.runningMins)} min</strong></div>
        <div class="mini"><span class="mini-label">🚴 Cycle</span><strong>${fmt(totals.cardio.cyclingMins)} min</strong></div>
        <div class="mini"><span class="mini-label">🚶 Walk</span><strong>${fmt(totals.cardio.walkingMins)} min</strong></div>
      </div>
    </div>
  `;
}

function mealCard(meal) {
  const totalMacro = meal.macros.proteinG + meal.macros.carbsG + meal.macros.fatsG || 1;
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `
    <article class="meal">
      <div class="thumb">${meal.imagePreview ? `<img src="${esc(meal.imagePreview)}" alt="">` : `${fmt(meal.macros.calories)}<br>kcal`}</div>
      <div>
        <strong>${esc(meal.foodIdentified)}</strong>
        <div class="muted small">${fmt(meal.macros.calories)} kcal | P ${fmt(meal.macros.proteinG)}g | C ${fmt(meal.macros.carbsG)}g | F ${fmt(meal.macros.fatsG)}g</div>
        <div class="bars">
          <div class="bar"><span class="protein" style="width:${(meal.macros.proteinG / totalMacro) * 100}%"></span></div>
          <div class="bar"><span class="carbs" style="width:${(meal.macros.carbsG / totalMacro) * 100}%"></span></div>
          <div class="bar"><span class="fats" style="width:${(meal.macros.fatsG / totalMacro) * 100}%"></span></div>
        </div>
      </div>
      <div style="text-align:right">
        <span class="metric-pill">${fmt(meal.confidenceScore * 100)}%</span>
        <div class="muted small" style="margin-top:4px">${time}</div>
      </div>
    </article>
  `;
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function renderCalendarHTML() {
  const byDate = state.data.allMealsByDate || {};
  const target = state.data.user.profile?.calorieTarget || 0;
  const today = state.data.today;

  // Determine which month to show
  const viewDateStr = state.calendarDate || today;
  const [vy, vm] = viewDateStr.split("-").map(Number);

  const firstDay = new Date(vy, vm - 1, 1);
  const lastDay = new Date(vy, vm, 0);
  const monthName = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Start grid from Sunday of the week containing the 1st
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  // Build calendar cells
  let cells = "";
  // Day headers
  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map(d => `<div class="cal-header">${d}</div>`).join("");

  // Empty cells before month start
  for (let i = 0; i < startOffset; i++) {
    cells += `<div class="cal-cell empty"></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${vy}-${String(vm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayMeals = byDate[dateStr] || [];
    const dayCals = dayMeals.reduce((s, m) => s + m.macros.calories, 0);
    const hasMeals = dayMeals.length > 0;
    const isToday = dateStr === today;
    const isOver = hasMeals && target > 0 && dayCals > target;
    const isSelected = dateStr === state.calendarDate;

    let dotClass = "";
    if (hasMeals) dotClass = isOver ? "dot-over" : "dot-ok";

    cells += `
      <div class="cal-cell ${isToday ? "cal-today" : ""} ${isSelected ? "cal-selected" : ""}" data-date="${dateStr}">
        <span class="cal-day-num">${d}</span>
        ${hasMeals ? `<span class="cal-dot ${dotClass}"></span><span class="cal-kcal">${Math.round(dayCals)}</span>` : ""}
      </div>
    `;
  }

  // Weekly summaries section
  const weeklySummaries = state.data.weeklySummaries || [];
  const weekRows = weeklySummaries.map(w => {
    const over = w.overBy > 0;
    const pct = Math.min(100, (w.totalCalories / (w.weeklyTarget || 1)) * 100);
    return `
      <div class="week-row">
        <div class="week-label">Week of ${fmtDate(w.weekStart)}</div>
        <div class="week-bar-wrap">
          <div class="week-bar-bg">
            <div class="week-bar-fill ${over ? "week-bar-over" : "week-bar-ok"}" style="width:${pct}%"></div>
          </div>
          <span class="week-bar-label ${over ? "surplus-text" : "safe-text"}">${fmt(w.totalCalories)} / ${fmt(w.weeklyTarget)} kcal</span>
        </div>
        <div class="week-verdict ${over ? "surplus-text" : "safe-text"}">${over ? `+${fmt(w.overBy)} over` : `${fmt(w.underBy)} under`}</div>
      </div>
    `;
  }).join("");

  // Day detail panel
  const selectedDate = state.calendarDate;
  const selectedMeals = selectedDate ? (byDate[selectedDate] || []) : [];
  const selectedCals = selectedMeals.reduce((s, m) => s + m.macros.calories, 0);

  const dayDetail = selectedDate ? `
    <div class="panel" style="margin-top:16px">
      <p class="muted small">Meals on ${fmtDate(selectedDate)}</p>
      ${selectedMeals.length
        ? `<p class="muted small" style="margin-bottom:10px">Total: <strong style="color:var(--text)">${fmt(selectedCals)} kcal</strong></p>
           <div class="ledger">${selectedMeals.map(mealCard).join("")}</div>`
        : `<p class="muted">No meals logged on this day.</p>`}
    </div>
  ` : "";

  return `
    <div class="calendar-wrap">
      <div class="panel">
        <div class="cal-nav">
          <button class="btn secondary cal-nav-btn" data-cal-prev>&#8249;</button>
          <span class="cal-month-label">${monthName}</span>
          <button class="btn secondary cal-nav-btn" data-cal-next>&#8250;</button>
        </div>
        <div class="cal-grid">
          ${dayHeaders}
          ${cells}
        </div>
        <div class="cal-legend">
          <span class="cal-dot dot-ok"></span><span class="muted small">Within target</span>
          <span class="cal-dot dot-over" style="margin-left:12px"></span><span class="muted small">Over target</span>
        </div>
      </div>

      ${dayDetail}

      ${weeklySummaries.length ? `
        <div class="panel" style="margin-top:16px">
          <p class="muted small">Weekly caloric summary</p>
          <div class="week-list">${weekRows}</div>
        </div>
      ` : ""}
    </div>
  `;
}

// ─── BIND TABS ────────────────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("tabToday").style.display = tab === "today" ? "" : "none";
      document.getElementById("tabCalendar").style.display = tab === "calendar" ? "" : "none";
    });
  });
}

function bindCalendar() {
  // Day cell click
  document.querySelectorAll(".cal-cell[data-date]").forEach(cell => {
    cell.addEventListener("click", () => {
      const date = cell.dataset.date;
      state.calendarDate = state.calendarDate === date ? null : date;
      // Re-render just the calendar tab content
      document.getElementById("tabCalendar").innerHTML = renderCalendarHTML();
      bindCalendar();
    });
  });

  // Month navigation
  document.querySelector("[data-cal-prev]")?.addEventListener("click", () => {
    const base = state.calendarDate || state.data.today;
    const [y, m] = base.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    state.calendarDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
    document.getElementById("tabCalendar").innerHTML = renderCalendarHTML();
    bindCalendar();
  });

  document.querySelector("[data-cal-next]")?.addEventListener("click", () => {
    const base = state.calendarDate || state.data.today;
    const [y, m] = base.split("-").map(Number);
    const next = new Date(y, m, 1);
    state.calendarDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    document.getElementById("tabCalendar").innerHTML = renderCalendarHTML();
    bindCalendar();
  });
}

// ─── MEAL FORM ────────────────────────────────────────────────────────────────
function bindMealForm() {
  const form = document.querySelector("#mealForm");
  if (!form) return;
  const input = document.querySelector("#mealImage");
  const dropzone = document.querySelector("#dropzone");
  const fileName = document.querySelector("#fileName");

  if (input && fileName) {
    input.addEventListener("change", () => {
      fileName.textContent = input.files[0]?.name || "PNG, JPEG, or WEBP";
    });
  }

  if (dropzone && input && fileName) {
    ["dragenter", "dragover"].forEach(evt => dropzone.addEventListener(evt, (e) => {
      e.preventDefault(); dropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(evt => dropzone.addEventListener(evt, (e) => {
      e.preventDefault(); dropzone.classList.remove("dragging");
    }));
    dropzone.addEventListener("drop", (e) => {
      input.files = e.dataTransfer.files;
      fileName.textContent = input.files[0]?.name || "PNG, JPEG, or WEBP";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const file = input ? input.files[0] : null;
    try {
      state.busy = true;
      setMessage("Analyzing meal…");
      renderDashboard();
      state.data = await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          description: formData.get("description"),
          imageDataUrl: file ? await fileToDataUrl(file) : ""
        })
      });
      state.busy = false;
      setMessage("Meal logged.", true);
      renderDashboard();
    } catch (error) {
      state.busy = false;
      setMessage(`Error: ${error.message}`);
      renderDashboard();
    }
  });
}

function fileToDataUrl(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) {
    return Promise.reject(new Error("Use a PNG, JPEG, or WEBP image under 5 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

// ─── GLOBAL BINDINGS ──────────────────────────────────────────────────────────
function bindGlobal() {
  document.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    state.data = null;
    setMessage("");
    renderAuth();
  });
  
  // ── Remote capture: generate QR code modal ──────────────────────────────────
  document.querySelector('[data-action="remote-capture"]')?.addEventListener("click", async () => {
    openMobileModal();
  });
}

function render() {
  if (!state.data) return renderAuth();
  if (!state.data.user) return renderAuth();
  if (!state.data.user.profile) return renderOnboarding();
  return renderDashboard();
}

// ─── MOBILE QR MODAL ──────────────────────────────────────────────────────────

// Self-contained QR code renderer — no external dependency.
// Implements QR version 1-10, byte mode, mask pattern 0, ECC level M.
// Draws to a <canvas> element using the project's green/dark palette.
function drawQRCode(canvas, text) {
  // ── GF(256) arithmetic ───────────────────────────────────────────────────────
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = x & 128 ? (x << 1) ^ 285 : x << 1; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const gMul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  function rsGenerator(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const t = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { t[j] ^= g[j]; t[j + 1] ^= gMul(g[j], EXP[i]); }
      g = t;
    }
    return g;
  }

  function rsRemainder(data, gen) {
    const rem = new Array(gen.length - 1).fill(0);
    for (const byte of data) {
      const factor = byte ^ rem.shift();
      rem.push(0);
      for (let i = 0; i < gen.length - 1; i++) rem[i] ^= gMul(gen[i + 1], factor);
    }
    return rem;
  }

  // ── Capacity table: ECC level M ──────────────────────────────────────────────
  // [totalDataCW, ecCW_per_block, blocks_g1, cw_per_block_g1, blocks_g2, cw_per_block_g2]
  const CAP = [
    null,
    [16, 10, 1, 16, 0, 0],   // v1
    [28, 16, 1, 28, 0, 0],   // v2
    [44, 26, 1, 44, 0, 0],   // v3
    [64, 18, 2, 32, 0, 0],   // v4
    [86, 24, 2, 43, 0, 0],   // v5
    [108, 16, 4, 27, 0, 0],  // v6
    [124, 18, 4, 31, 0, 0],  // v7
    [154, 22, 2, 38, 2, 39], // v8
    [182, 22, 3, 36, 2, 37], // v9
    [216, 26, 4, 43, 1, 44], // v10
  ];

  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  while (ver <= 10 && CAP[ver][0] < bytes.length + 3) ver++;
  if (ver > 10) { console.error("QR: URL too long"); return; }

  const [totalCW, ecPerBlock, b1, cw1, b2, cw2] = CAP[ver];
  const size = ver * 4 + 17;

  // ── Build data bitstream ─────────────────────────────────────────────────────
  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(4, 4);  // byte mode
  push(bytes.length, 8);
  bytes.forEach(b => push(b, 8));
  push(0, Math.min(4, totalCW * 8 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  for (let p = 0; bits.length < totalCW * 8; p = 1 - p) push(p ? 0x11 : 0xEC, 8);

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    dataBytes.push(v);
  }

  // ── Reed-Solomon error correction ────────────────────────────────────────────
  const gen = rsGenerator(ecPerBlock);
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < b1; i++) { const d = dataBytes.slice(offset, offset + cw1); blocks.push({ data: d, ec: rsRemainder(d, gen) }); offset += cw1; }
  for (let i = 0; i < b2; i++) { const d = dataBytes.slice(offset, offset + cw2); blocks.push({ data: d, ec: rsRemainder(d, gen) }); offset += cw2; }

  // Interleave
  const codewords = [];
  const maxData = Math.max(cw1, cw2 || 0);
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) codewords.push(b.data[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of blocks) codewords.push(b.ec[i]);

  // ── Build module matrix ──────────────────────────────────────────────────────
  const M   = Array.from({length: size}, () => new Int8Array(size).fill(-1));
  const FN  = Array.from({length: size}, () => new Uint8Array(size));
  const mark = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { M[r][c] = v; FN[r][c] = 1; } };

  // Finder patterns + separators
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      if (r < 0 || r > 6 || c < 0 || c > 6) { mark(row + r, col + c, 0); continue; }
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore   = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      mark(row + r, col + c, onBorder || inCore ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Timing strips
  for (let i = 8; i <= size - 9; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    mark(6, i, v); mark(i, 6, v);
  }

  // Dark module
  mark(size - 8, 8, 1);

  // Alignment patterns
  const ALN = [null,null,[6,18],[6,22],[6,26],[6,30],[6,34],
    [6,22,38],[6,24,42],[6,28,46],[6,26,44]];
  if (ALN[ver]) for (const ar of ALN[ver]) for (const ac of ALN[ver]) {
    if (FN[ar][ac]) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const onEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2;
      const center = dr === 0 && dc === 0;
      mark(ar + dr, ac + dc, onEdge || center ? 1 : 0);
    }
  }

  // Format info (ECC-M=00, mask=101, BCH, XOR with 101010000010010)
  // Precomputed for mask pattern 5 (checkerboard, best for readability)
  const FMT = [1,1,0,0,1,1,1,1,0,0,0,1,0,0,0]; // M + mask 5
  const FP1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const FP2 = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[size-8,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2]];
  FMT.forEach((v, i) => { mark(FP1[i][0], FP1[i][1], v); mark(FP2[i][0], FP2[i][1], v); });

  // ── Place data bits (column-pair zigzag) ─────────────────────────────────────
  const cwBits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) cwBits.push((cw >> i) & 1);

  let bi = 0;
  let colPair = 0; // 0 = rightmost pair, increments left
  for (let colRight = size - 1; colRight >= 1; colRight -= 2) {
    if (colRight === 6) colRight--; // skip timing column
    const upward = (colPair % 2 === 0);
    colPair++;
    for (let row = 0; row < size; row++) {
      const r = upward ? (size - 1 - row) : row;
      for (let d = 0; d < 2; d++) {
        const c = colRight - d;
        if (FN[r][c]) continue;
        M[r][c] = bi < cwBits.length ? cwBits[bi++] : 0;
      }
    }
  }

  // Apply mask pattern 5: (row % 2 + col % 3) % 2 === 0 ... actually mask 0: (r+c)%2==0
  // Use mask 0 to match format info above (FMT is for mask 5 — let me use mask 0 and correct FMT)
  // Format for ECC-M, mask 0: data bits = 00 000 → BCH → 0000101001111 → XOR 101010000010010 = 101010101101101
  // Use this precomputed value:
  const FMT0 = [1,0,1,0,1,0,1,0,1,1,0,1,1,0,1];
  FMT0.forEach((v, i) => { M[FP1[i][0]][FP1[i][1]] = v; M[FP2[i][0]][FP2[i][1]] = v; });

  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!FN[r][c] && M[r][c] !== -1 && (r + c) % 2 === 0) M[r][c] ^= 1;
  }

  // ── Render to canvas ─────────────────────────────────────────────────────────
  const QUIET = 2;
  const CELL  = Math.max(2, Math.floor(210 / (size + QUIET * 2)));
  const PX    = (size + QUIET * 2) * CELL;
  canvas.width = canvas.height = PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#090c0c";
  ctx.fillRect(0, 0, PX, PX);
  ctx.fillStyle = "#00e5a0";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    if (M[r][c] === 1) ctx.fillRect((c + QUIET) * CELL, (r + QUIET) * CELL, CELL, CELL);
}
let _mobileModalState = { pollInterval: null, tokenExpiry: null, countdownInterval: null };

function closeMobileModal() {
  clearInterval(_mobileModalState.pollInterval);
  clearInterval(_mobileModalState.countdownInterval);
  _mobileModalState = { pollInterval: null, tokenExpiry: null, countdownInterval: null };
  document.getElementById("mobileQrModal")?.remove();
  document.getElementById("mobileQrBackdrop")?.remove();
}

async function openMobileModal() {
  if (document.getElementById("mobileQrModal")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "mobileQrBackdrop";
  backdrop.className = "qr-backdrop";
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeMobileModal(); });

  const modal = document.createElement("div");
  modal.id = "mobileQrModal";
  modal.className = "qr-modal";
  modal.innerHTML = `
    <div class="qr-modal-head">
      <div class="qr-modal-title">
        <span class="qr-tag">MOD_03</span>
        <span class="qr-label">MOBILE LINK</span>
      </div>
      <button class="qr-close" id="qrCloseBtn" aria-label="Close">✕</button>
    </div>
    <p class="qr-desc">Scan with your phone camera to snap a meal photo directly into this session.</p>
    <div class="qr-canvas-wrap" id="qrCanvasWrap">
      <div class="qr-loading">
        <span class="qr-spinner"></span>
        <span>Generating secure link…</span>
      </div>
    </div>
    <div class="qr-meta">
      <span class="qr-status-dot" id="qrStatusDot"></span>
      <span id="qrStatusText">Waiting for phone…</span>
      <span class="qr-countdown" id="qrCountdown"></span>
    </div>
    <div class="qr-url-bar" id="qrUrlBar" hidden>
      <span id="qrUrlText"></span>
      <button class="qr-copy-btn" id="qrCopyBtn">COPY</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  document.getElementById("qrCloseBtn").addEventListener("click", closeMobileModal);

  // Check server version first — tells user immediately if server.mjs is outdated
  try {
    const v = await api("/api/version");
    if (!v.features?.includes("mobile-qr")) throw new Error("outdated");
  } catch {
    document.getElementById("qrCanvasWrap").innerHTML = `
      <div style="padding:20px;text-align:center;display:flex;flex-direction:column;gap:10px">
        <p style="font-family:var(--sys-font);font-size:11px;color:rgba(249,115,22,0.85);letter-spacing:0.04em">
          SERVER NOT UPDATED
        </p>
        <p style="font-family:var(--sys-font);font-size:9.5px;color:#52525b;letter-spacing:0.04em;line-height:1.6">
          Stop the server, replace server.mjs with the latest version, then run:<br>
          <span style="color:#00e5a0">node --env-file=.env server.mjs</span>
        </p>
      </div>`;
    return;
  }

  // Fetch token first — required.
  let token, uploadUrl;
  try {
    const tokenRes = await api("/api/mobile-token", { method: "POST", body: "{}" });
    token = tokenRes.token;
  } catch (err) {
    const wrap = document.getElementById("qrCanvasWrap");
    wrap.innerHTML = `
      <div style="padding:16px;text-align:center">
        <p class="qr-error" style="margin-bottom:8px">Could not reach server: ${err.message}</p>
        <p style="font-family:var(--sys-font);font-size:9px;color:#3a5050;letter-spacing:0.06em">
          Make sure server.mjs is updated and the server is running.
        </p>
      </div>`;
    return;
  }

  // Try to get the LAN IP — falls back to window.location.host if not available
  let lanHost = location.host;
  try {
    const ipRes = await api("/api/local-ip");
    if (ipRes.ip) lanHost = `${ipRes.ip}:${ipRes.port}`;
  } catch {
    // Old server without /api/local-ip — URL will use localhost, still works on desktop
  }
  uploadUrl = `http://${lanHost}/mobile.html?token=${token}`;

  // Draw QR code onto canvas
  const wrap = document.getElementById("qrCanvasWrap");
  wrap.innerHTML = "";
  const qrCanvas = document.createElement("canvas");
  qrCanvas.id = "qrCodeCanvas";
  wrap.appendChild(qrCanvas);
  drawQRCode(qrCanvas, uploadUrl);

  // Show copyable URL bar
  const urlBar = document.getElementById("qrUrlBar");
  const urlText = document.getElementById("qrUrlText");
  urlText.textContent = uploadUrl;
  urlBar.hidden = false;

  // Warn if URL is localhost — phone won't be able to scan it
  const isLocalhost = lanHost.startsWith("localhost") || lanHost.startsWith("127.");
  if (isLocalhost) {
    const warn = document.createElement("p");
    warn.style.cssText = "font-family:var(--sys-font);font-size:9px;color:rgba(249,115,22,0.7);letter-spacing:0.05em;margin:8px 0 0;line-height:1.5";
    warn.textContent = "⚠ URL shows localhost — update server.mjs to get your LAN IP so your phone can scan this.";
    urlBar.parentNode.insertBefore(warn, urlBar.nextSibling);
  }

  document.getElementById("qrCopyBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(uploadUrl).then(() => {
      document.getElementById("qrCopyBtn").textContent = "COPIED";
      setTimeout(() => { document.getElementById("qrCopyBtn").textContent = "COPY"; }, 2000);
    });
  });

  // Countdown timer
  const expiryMs = Date.now() + 600_000; // 10 min
  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
    const m = String(Math.floor(remaining / 60)).padStart(2, "0");
    const s = String(remaining % 60).padStart(2, "0");
    const el = document.getElementById("qrCountdown");
    if (el) el.textContent = `${m}:${s}`;
    if (remaining === 0) {
      clearInterval(_mobileModalState.countdownInterval);
      const statusEl = document.getElementById("qrStatusText");
      if (statusEl) statusEl.textContent = "Link expired. Close and try again.";
      wrap.innerHTML = `<p class="qr-error">QR code expired.</p>`;
    }
  }
  updateCountdown();
  _mobileModalState.countdownInterval = setInterval(updateCountdown, 1000);

  // Poll for upload completion
  _mobileModalState.pollInterval = setInterval(async () => {
    try {
      const pollRes = await api(`/api/mobile-token/poll?token=${token}`);
      if (pollRes.used) {
        clearInterval(_mobileModalState.pollInterval);
        clearInterval(_mobileModalState.countdownInterval);
        // Update modal to success state
        const dot = document.getElementById("qrStatusDot");
        const txt = document.getElementById("qrStatusText");
        if (dot) dot.classList.add("qr-status-dot--success");
        if (txt) txt.textContent = "Photo received! Refreshing…";
        wrap.innerHTML = `<div class="qr-success"><span class="qr-success-icon">✓</span><span>Meal logged from phone</span></div>`;
        setTimeout(async () => {
          closeMobileModal();
          state.data = await api("/api/me");
          render();
        }, 1800);
      }
    } catch {
      // Token expired or gone — stop polling
      clearInterval(_mobileModalState.pollInterval);
    }
  }, 2500);
}

api("/api/me")
  .then((data) => { state.data = data; render(); })
  .catch(() => renderAuth());