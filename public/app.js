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
        <div class="brand"><span class="mark"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg></span><span>BURNDELTA</span></div>
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
// ─── AUTH ─────────────────────────────────────────────────────────────────────
function renderAuth() {
  app.innerHTML = `
    <div class="auth-page">

      <!-- ── Left: branding + phone mockup ── -->
      <div class="auth-left">
        <div class="auth-brand">
          <div class="auth-brand-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg></div>
          <span>BurnDelta</span>
        </div>
        <h1 class="auth-headline">Track what you eat.<br>Know what to burn.</h1>
        <p class="auth-sub">Log meals with AI, get your exact calorie budget, and see how much cardio offsets any surplus.</p>

        <!-- Phone mockup — matches dark aesthetic -->
        <!-- Dashboard preview cards — replaces phone mockup -->
        <div class="preview-cards">

          <!-- Arc + calorie number -->
          <div class="pc-ring-card">
            <div class="pc-arc-wrap">
              <svg viewBox="0 0 120 120" class="pc-arc-svg">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#ede8df" stroke-width="8"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="#FF7A1A" stroke-width="8"
                  stroke-dasharray="314.16" stroke-dashoffset="125.7"
                  stroke-linecap="round" transform="rotate(-90 60 60)"/>
              </svg>
              <div class="pc-arc-inner">
                <span class="pc-arc-num">1,842</span>
                <span class="pc-arc-lab">kcal left</span>
              </div>
            </div>
            <div class="pc-ring-stats">
              <div class="pc-stat-row"><span class="pc-stat-label">Consumed</span><span class="pc-stat-val">2,758</span></div>
              <div class="pc-stat-row"><span class="pc-stat-label">Target</span><span class="pc-stat-val">2,386</span></div>
              <div class="pc-stat-row pc-stat-surplus"><span class="pc-stat-label">Surplus</span><span class="pc-stat-val">+348</span></div>
            </div>
          </div>

          <!-- Meal cards row -->
          <div class="pc-meals">
            <div class="pc-meal-card">
              <div class="pc-meal-top">
                <span class="pc-meal-name">Grilled salmon + rice</span>
                <span class="pc-meal-kcal">520 kcal</span>
              </div>
              <div class="pc-macro-row">
                <span class="pc-macro pc-macro-p">P 38g</span>
                <span class="pc-macro pc-macro-c">C 44g</span>
                <span class="pc-macro pc-macro-f">F 14g</span>
              </div>
              <div class="pc-bar-track"><div class="pc-bar-fill" style="width:68%"></div></div>
            </div>
            <div class="pc-meal-card">
              <div class="pc-meal-top">
                <span class="pc-meal-name">Morning oats</span>
                <span class="pc-meal-kcal">310 kcal</span>
              </div>
              <div class="pc-macro-row">
                <span class="pc-macro pc-macro-p">P 12g</span>
                <span class="pc-macro pc-macro-c">C 52g</span>
                <span class="pc-macro pc-macro-f">F 6g</span>
              </div>
              <div class="pc-bar-track"><div class="pc-bar-fill" style="width:40%"></div></div>
            </div>
          </div>

          <!-- Cardio offset pill -->
          <div class="pc-offset-card">
            <div class="pc-offset-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13Z"/></svg>
              348 kcal surplus · offset with
            </div>
            <div class="pc-offset-row">
              <div class="pc-offset-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m15 9-4 4-3 3"/><path d="m9 11-3 4H4"/><path d="m17 9 1 4-4 1"/></svg>
                <span>Run</span><strong>24 min</strong>
              </div>
              <div class="pc-offset-divider"></div>
              <div class="pc-offset-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1-1h-4"/><path d="m5.5 14 3.5-7 4.5 4.5 2-3.5 3 3"/></svg>
                <span>Cycle</span><strong>31 min</strong>
              </div>
              <div class="pc-offset-divider"></div>
              <div class="pc-offset-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="m9 10 1 4 2-2 2 4"/><path d="m7 20 2-4"/><path d="m15 20-1-4"/><path d="m9 10-2 4"/><path d="m15 10 2 4"/></svg>
                <span>Walk</span><strong>49 min</strong>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Right: login inside phone frame ── -->
      <div class="auth-right">
        <div class="auth-phone-frame">
          <div class="auth-phone-notch"></div>
          <div class="auth-phone-screen">

            <div class="auth-phone-brand">
              <div class="auth-phone-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg></div>
              <span>BurnDelta</span>
            </div>


            <!-- Tabs -->
            <div class="auth-tabs">
              <button class="auth-tab active" id="tabSignin" type="button">Sign in</button>
              <button class="auth-tab" id="tabRegister" type="button">Create account</button>
            </div>

            <!-- Sign in form -->
            <form id="loginForm" class="auth-form" novalidate>
              <div class="auth-field">
                <label for="li-email">Email</label>
                <input id="li-email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
              </div>
              <div class="auth-field">
                <label for="li-pw">Password</label>
                <input id="li-pw" name="password" type="password" autocomplete="current-password" placeholder="Your password" minlength="10" required>
              </div>
              <button class="auth-btn" type="submit">Sign in</button>
            </form>

            <!-- Register form -->
            <form id="registerForm" class="auth-form" style="display:none" novalidate>
              <div class="auth-field">
                <label for="reg-email">Email</label>
                <input id="reg-email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
              </div>
              <div class="auth-field">
                <label for="reg-pw">Password</label>
                <input id="reg-pw" name="password" type="password" autocomplete="new-password" placeholder="10+ characters" minlength="10" required>
              </div>
              <button class="auth-btn" type="submit">Create account</button>
            </form>

            ${state.message ? `<p class="auth-error">${esc(state.message)}</p>` : ""}

          </div>
          <div class="auth-phone-bar"></div>
        </div>
      </div>

    </div>
  `;

  document.getElementById("tabSignin").addEventListener("click", () => {
    document.getElementById("loginForm").style.display = "";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("tabSignin").classList.add("active");
    document.getElementById("tabRegister").classList.remove("active");
  });
  document.getElementById("tabRegister").addEventListener("click", () => {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "";
    document.getElementById("tabRegister").classList.add("active");
    document.getElementById("tabSignin").classList.remove("active");
  });

  document.querySelector("#loginForm").addEventListener("submit", submitAuth("login"));
  document.querySelector("#registerForm").addEventListener("submit", submitAuth("register"));
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
// Step-by-step flow: one question per screen, MFP-style but dark BurnDelta aesthetic

const OB_STEPS = ["goal", "sex", "body", "activity"];

// Persisted answers across steps
const obData = {
  goal: "loss",
  sex: "female",
  age: "22",
  heightCm: "168",
  weightKg: "70",
  targetWeightKg: "66",
  activityLevel: "moderate"
};

let obStep = 0;

function renderOnboarding() {
  obStep = 0;
  renderObStep();
}

function renderObStep() {
  const step = OB_STEPS[obStep];
  const total = OB_STEPS.length;
  const pct = Math.round(((obStep) / total) * 100);

  let inner = "";

  if (step === "goal") {
    inner = `
      <h2 class="ob2-q">What's your goal?</h2>
      <p class="ob2-sub">This sets your daily calorie target.</p>
      <div class="ob2-choices" id="goalChoices">
        <button class="ob2-choice ${obData.goal === "loss" ? "active" : ""}" data-val="loss">
          <span class="ob2-choice-icon">↓</span>
          <div>
            <strong>Lose weight</strong>
            <span>500 kcal deficit / day</span>
          </div>
        </button>
        <button class="ob2-choice ${obData.goal === "maintain" ? "active" : ""}" data-val="maintain">
          <span class="ob2-choice-icon">→</span>
          <div>
            <strong>Maintain weight</strong>
            <span>Match your daily burn</span>
          </div>
        </button>
        <button class="ob2-choice ${obData.goal === "gain" ? "active" : ""}" data-val="gain">
          <span class="ob2-choice-icon">↑</span>
          <div>
            <strong>Gain weight</strong>
            <span>350 kcal surplus / day</span>
          </div>
        </button>
      </div>
    `;
  } else if (step === "sex") {
    inner = `
      <h2 class="ob2-q">What's your biological sex?</h2>
      <p class="ob2-sub">Used to calculate your BMR accurately.</p>
      <div class="ob2-choices" id="sexChoices">
        <button class="ob2-choice ob2-choice--lg ${obData.sex === "female" ? "active" : ""}" data-val="female">
          <span class="ob2-choice-icon">♀</span>
          <div><strong>Female</strong></div>
        </button>
        <button class="ob2-choice ob2-choice--lg ${obData.sex === "male" ? "active" : ""}" data-val="male">
          <span class="ob2-choice-icon">♂</span>
          <div><strong>Male</strong></div>
        </button>
      </div>
    `;
  } else if (step === "body") {
    inner = `
      <h2 class="ob2-q">Tell us about your body.</h2>
      <p class="ob2-sub">Used to calculate your metabolic baseline.</p>
      <div class="ob2-fields">
        <div class="ob2-field">
          <label>Age</label>
          <div class="ob2-input-wrap">
            <input type="number" id="ob2Age" min="13" max="110" value="${obData.age}" placeholder="22">
            <span class="ob2-unit">years</span>
          </div>
        </div>
        <div class="ob2-field">
          <label>Height</label>
          <div class="ob2-input-wrap">
            <input type="number" id="ob2Height" min="120" max="230" step="0.1" value="${obData.heightCm}" placeholder="168">
            <span class="ob2-unit">cm</span>
          </div>
        </div>
        <div class="ob2-field">
          <label>Current weight</label>
          <div class="ob2-input-wrap">
            <input type="number" id="ob2Weight" min="30" max="300" step="0.1" value="${obData.weightKg}" placeholder="70">
            <span class="ob2-unit">kg</span>
          </div>
        </div>
        <div class="ob2-field">
          <label>Goal weight</label>
          <div class="ob2-input-wrap">
            <input type="number" id="ob2Target" min="30" max="300" step="0.1" value="${obData.targetWeightKg}" placeholder="66">
            <span class="ob2-unit">kg</span>
          </div>
        </div>
      </div>
    `;
  } else if (step === "activity") {
    inner = `
      <h2 class="ob2-q">How active are you day-to-day?</h2>
      <p class="ob2-sub">Not counting deliberate workouts.</p>
      <div class="ob2-choices" id="actChoices">
        <button class="ob2-choice ${obData.activityLevel === "sedentary" ? "active" : ""}" data-val="sedentary">
          <div>
            <strong>Sedentary</strong>
            <span>Desk job, little movement</span>
          </div>
        </button>
        <button class="ob2-choice ${obData.activityLevel === "light" ? "active" : ""}" data-val="light">
          <div>
            <strong>Lightly active</strong>
            <span>On your feet 1–3 days / week</span>
          </div>
        </button>
        <button class="ob2-choice ${obData.activityLevel === "moderate" ? "active" : ""}" data-val="moderate">
          <div>
            <strong>Moderately active</strong>
            <span>Regular movement 3–5 days / week</span>
          </div>
        </button>
        <button class="ob2-choice ${obData.activityLevel === "intense" ? "active" : ""}" data-val="intense">
          <div>
            <strong>Very active</strong>
            <span>Physical work or training 6–7 days</span>
          </div>
        </button>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="ob2-page">
      <div class="ob2-card">

        <!-- Progress bar -->
        <div class="ob2-progress-track">
          <div class="ob2-progress-fill" style="width:${pct}%"></div>
        </div>

        <!-- Brand -->
        <div class="ob2-brand">
          <div class="ob2-brand-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg></div>
          <span>BurnDelta</span>
        </div>

        <!-- Step content -->
        <div class="ob2-content" id="ob2Content">
          ${inner}
        </div>

        <!-- Nav -->
        <div class="ob2-nav">
          ${obStep > 0 ? `<button class="ob2-back" id="ob2Back">Back</button>` : `<span></span>`}
          <span class="ob2-step-count">${obStep + 1} / ${total}</span>
          <button class="ob2-next" id="ob2Next">
            ${obStep === total - 1 ? "Finish" : "Next"}
          </button>
        </div>

      </div>
    </div>
  `;

  // Bind choice buttons
  if (step === "goal") {
    document.querySelectorAll("#goalChoices .ob2-choice").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#goalChoices .ob2-choice").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        obData.goal = btn.dataset.val;
      });
    });
  } else if (step === "sex") {
    document.querySelectorAll("#sexChoices .ob2-choice").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#sexChoices .ob2-choice").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        obData.sex = btn.dataset.val;
      });
    });
  } else if (step === "activity") {
    document.querySelectorAll("#actChoices .ob2-choice").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#actChoices .ob2-choice").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        obData.activityLevel = btn.dataset.val;
      });
    });
  }

  // Back
  document.getElementById("ob2Back")?.addEventListener("click", () => {
    obStep--;
    renderObStep();
  });

  // Next / Finish
  document.getElementById("ob2Next").addEventListener("click", async () => {
    // Collect body fields before leaving that step
    if (step === "body") {
      const age = document.getElementById("ob2Age")?.value?.trim();
      const height = document.getElementById("ob2Height")?.value?.trim();
      const weight = document.getElementById("ob2Weight")?.value?.trim();
      const target = document.getElementById("ob2Target")?.value?.trim();
      if (!age || !height || !weight || !target) {
        alert("Please fill in all fields.");
        return;
      }
      obData.age = age;
      obData.heightCm = height;
      obData.weightKg = weight;
      obData.targetWeightKg = target;
    }

    if (obStep < OB_STEPS.length - 1) {
      obStep++;
      renderObStep();
    } else {
      // Submit
      const btn = document.getElementById("ob2Next");
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        state.data = await api("/api/profile", {
          method: "POST",
          body: JSON.stringify(obData)
        });
        setMessage("");
        render();
      } catch (error) {
        btn.disabled = false;
        btn.textContent = "Finish";
        const content = document.getElementById("ob2Content");
        if (content) {
          const err = document.createElement("p");
          err.className = "ob2-error";
          err.textContent = error.message;
          content.appendChild(err);
        }
      }
    }
  });
}

function bindProfileControls(profileForm) {
  // Legacy — kept for compatibility, step flow handles its own bindings
  profileForm?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "set-activity") {
      profileForm.elements.activityLevel.value = action.dataset.value;
      profileForm.querySelectorAll("[data-action='set-activity']").forEach((btn) => btn.classList.toggle("active", btn === action));
      const badge = profileForm.querySelector("#activityBadge");
      if (badge) badge.textContent = action.dataset.label;
    }
    if (action.dataset.action === "set-goal") {
      profileForm.elements.goal.value = action.dataset.value;
      profileForm.querySelectorAll("[data-action='set-goal']").forEach((btn) => btn.classList.toggle("active", btn === action));
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
                  <p class="stats-date">Today · ${fmtDate(today)}</p>
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
                  <span class="camera-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>
                  <strong>Upload or take a photo</strong>
                  <span class="muted small" id="fileName">PNG, JPEG, or WEBP</span>
                  <input id="mealImage" name="mealImage" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden>
                </label>
                <button class="remote-btn" data-action="remote-capture" type="button"><span class="remote-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>Snap with phone</button>
              </div>
              <div class="field" style="margin-top:4px">
                <label class="describe-label" for="mealDesc">Or describe the meal</label>
                <textarea id="mealDesc" name="description" rows="3" maxlength="180" placeholder="e.g. chicken breast, rice, broccoli"></textarea>
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
          <p class="muted small" style="margin:0">📅 Weekly Review · week of ${fmtDate(week.weekStart)}</p>
          <p class="weekly-total">${fmt(week.totalCalories)} <span class="muted small">/ ${fmt(week.weeklyTarget)} kcal this week</span></p>
        </div>
        <div class="weekly-verdict ${over ? "surplus-text" : "safe-text"}">
          ${over
            ? `+${fmt(week.overBy)} kcal over weekly target`
            : `${fmt(week.underBy)} kcal under · great week!`}
        </div>
      </div>
    </div>
  `;
}

function kineticCard(totals) {
  return `
    <div class="alert">
      <p class="alert-title">⚡ ${fmt(totals.delta)} kcal surplus · offset with cardio</p>
      <div class="offset-grid">
        <div class="mini"><span class="mini-label">🏃 Run</span><strong>${fmt(totals.cardio.runningMins)} min</strong></div>
        <div class="mini"><span class="mini-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1-1h-4"/><path d="m5.5 14 3.5-7 4.5 4.5 2-3.5 3 3"/></svg> Cycle</span><strong>${fmt(totals.cardio.cyclingMins)} min</strong></div>
        <div class="mini"><span class="mini-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="m9 10 1 4 2-2 2 4"/><path d="m7 20 2-4"/><path d="m15 20-1-4"/><path d="m9 10-2 4"/><path d="m15 10 2 4"/></svg> Walk</span><strong>${fmt(totals.cardio.walkingMins)} min</strong></div>
      </div>
    </div>
  `;
}

function mealCard(meal) {
  const totalMacro = meal.macros.proteinG + meal.macros.carbsG + meal.macros.fatsG || 1;
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `
    <article class="meal" data-meal-id="${esc(meal.id)}">
      <div class="thumb">${meal.imagePreview ? `<img src="${esc(meal.imagePreview)}" alt="">` : `${fmt(meal.macros.calories)}<br>kcal`}</div>
      <div style="flex:1;min-width:0">
        <strong>${esc(meal.foodIdentified)}</strong>
        <div class="muted small">${fmt(meal.macros.calories)} kcal | P ${fmt(meal.macros.proteinG)}g | C ${fmt(meal.macros.carbsG)}g | F ${fmt(meal.macros.fatsG)}g</div>
        <div class="bars">
          <div class="bar"><span class="protein" style="width:${(meal.macros.proteinG / totalMacro) * 100}%"></span></div>
          <div class="bar"><span class="carbs" style="width:${(meal.macros.carbsG / totalMacro) * 100}%"></span></div>
          <div class="bar"><span class="fats" style="width:${(meal.macros.fatsG / totalMacro) * 100}%"></span></div>
        </div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <span class="metric-pill">${fmt(meal.confidenceScore * 100)}%</span>
        <div class="muted small">${time}</div>
        <button class="meal-del-btn" data-action="delete-meal" data-id="${esc(meal.id)}" title="Remove meal" aria-label="Remove meal">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
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
    const file = input ? input.files[0] : null;
    // Read textarea directly — FormData can miss dynamically typed values
    const descEl = form.querySelector("textarea[name='description']");
    const description = (descEl ? descEl.value : "").trim();
    if (!file && !description) {
      setMessage("Error: Upload a photo or describe the meal.");
      return;
    }
    try {
      state.busy = true;
      setMessage("Analyzing meal…");
      renderDashboard();
      let imageDataUrl = "";
      if (file) {
        try { imageDataUrl = await fileToDataUrl(file); }
        catch (imgErr) { setMessage(`Error: ${imgErr.message}`); state.busy = false; renderDashboard(); return; }
      }
      state.data = await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({ description, imageDataUrl })
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

  // Delete meal — event delegation on document
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action='delete-meal']");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    btn.disabled = true;
    btn.style.opacity = "0.4";
    try {
      state.data = await api(`/api/meals/${id}`, { method: "DELETE" });
      render();
    } catch (err) {
      btn.disabled = false;
      btn.style.opacity = "";
      setMessage(`Error: ${err.message}`);
    }
  }, { capture: false });
  
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
  // Minimal QR Code generator — byte mode, ECC-M, masks 0-7, picks best mask
  // Based on the ISO 18004 standard

  // ── GF(256) ──────────────────────────────────────────────────────────────────
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function(){
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x = x & 128 ? (x << 1) ^ 285 : x << 1;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i-255];
  })();
  const gfMul = (a, b) => a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;
  function gfPolyMul(p, q) {
    const r = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++)
      for (let j = 0; j < q.length; j++)
        r[i+j] ^= gfMul(p[i], q[j]);
    return r;
  }
  function rsGenerator(n) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < n; i++) g = gfPolyMul(g, new Uint8Array([1, GF_EXP[i]]));
    return g;
  }
  function rsRemainder(data, gen) {
    const rem = new Uint8Array(gen.length - 1);
    for (const b of data) {
      const coef = b ^ rem[0];
      rem.copyWithin(0, 1); rem[rem.length-1] = 0;
      for (let i = 0; i < rem.length; i++) rem[i] ^= gfMul(coef, gen[i+1]);
    }
    return rem;
  }

  // ── Capacity table ECC-M ──────────────────────────────────────────────────────
  // [dataCW, ecPerBlock, numBlocks1, cwPerBlock1, numBlocks2, cwPerBlock2]
  const CAP = [null,
    [16,10,1,16,0,0],[28,16,1,28,0,0],[44,26,1,44,0,0],[64,18,2,32,0,0],
    [86,24,2,43,0,0],[108,16,4,27,0,0],[124,18,4,31,0,0],[154,22,2,38,2,39],
    [182,22,3,36,2,37],[216,26,4,43,1,44],
  ];

  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  while (ver <= 10 && CAP[ver][0] < bytes.length + 3) ver++;
  if (ver > 10) { console.error("QR: text too long for version 1-10"); return; }

  const [dataCW, ecPerBlock, nb1, cw1, nb2, cw2] = CAP[ver];
  const size = ver * 4 + 17;

  // ── Bitstream ────────────────────────────────────────────────────────────────
  const bits = [];
  const push = (v, n) => { for (let i = n-1; i >= 0; i--) bits.push((v>>i)&1); };
  push(4, 4);
  push(bytes.length, 8);
  bytes.forEach(b => push(b, 8));
  push(0, Math.min(4, dataCW*8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let p = 0; bits.length < dataCW*8; p^=1) push(p ? 0x11 : 0xEC, 8);
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0; for (let j = 0; j < 8; j++) v = (v<<1)|bits[i+j]; dataBytes.push(v);
  }

  // ── Reed-Solomon ──────────────────────────────────────────────────────────────
  const gen = rsGenerator(ecPerBlock);
  const blocks = [];
  let off = 0;
  for (let i = 0; i < nb1; i++) { const d = dataBytes.slice(off, off+cw1); blocks.push({d, ec: Array.from(rsRemainder(d, gen))}); off += cw1; }
  for (let i = 0; i < nb2; i++) { const d = dataBytes.slice(off, off+cw2); blocks.push({d, ec: Array.from(rsRemainder(d, gen))}); off += cw2; }
  const codewords = [];
  const maxD = Math.max(cw1, cw2||0);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) codewords.push(b.d[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of blocks) codewords.push(b.ec[i]);

  // ── Matrix ────────────────────────────────────────────────────────────────────
  const M = Array.from({length:size}, () => new Int8Array(size).fill(-1));
  const F = Array.from({length:size}, () => new Uint8Array(size));
  const set = (r,c,v) => { if(r>=0&&r<size&&c>=0&&c<size){M[r][c]=v;F[r][c]=1;} };

  function drawFinder(r, c) {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      if (r+dr<0||r+dr>=size||c+dc<0||c+dc>=size) continue;
      const onBorder = dr>=0&&dr<=6&&dc>=0&&dc<=6&&(dr===0||dr===6||dc===0||dc===6);
      const inCore = dr>=2&&dr<=4&&dc>=2&&dc<=4;
      set(r+dr, c+dc, (onBorder||inCore)?1:0);
    }
  }
  drawFinder(0,0); drawFinder(0,size-7); drawFinder(size-7,0);

  // Timing
  for (let i = 8; i <= size-9; i++) { set(6,i,i%2===0?1:0); set(i,6,i%2===0?1:0); }
  // Dark module
  set(size-8, 8, 1);

  // Alignment patterns
  const ALN = [null,null,[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,28,46],[6,26,44]];
  if (ALN[ver]) for (const ar of ALN[ver]) for (const ac of ALN[ver]) {
    if (F[ar][ac]) continue;
    for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++) {
      const edge=Math.abs(dr)===2||Math.abs(dc)===2, center=dr===0&&dc===0;
      set(ar+dr,ac+dc,(edge||center)?1:0);
    }
  }

  // Format info placeholder (filled after mask selection)
  const FP1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const FP2=[[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[size-8,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2]];
  FP1.forEach(([r,c])=>{M[r][c]=0;F[r][c]=1;});
  FP2.forEach(([r,c])=>{M[r][c]=0;F[r][c]=1;});

  // ── Data placement (zigzag) ───────────────────────────────────────────────────
  const cwBits = [];
  for (const cw of codewords) for (let i=7;i>=0;i--) cwBits.push((cw>>i)&1);

  let bi = 0, pair = 0;
  for (let right = size-1; right >= 1; right -= 2) {
    if (right === 6) right--;
    const up = (pair % 2 === 0);
    pair++;
    for (let row = 0; row < size; row++) {
      const r = up ? size-1-row : row;
      for (let d = 0; d < 2; d++) {
        const c = right - d;
        if (!F[r][c]) M[r][c] = bi < cwBits.length ? cwBits[bi++] : 0;
      }
    }
  }

  // ── Mask evaluation & selection ───────────────────────────────────────────────
  const maskFns = [
    (r,c)=>(r+c)%2===0,
    (r,c)=>r%2===0,
    (r,c)=>c%3===0,
    (r,c)=>(r+c)%3===0,
    (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,
    (r,c)=>(r*c)%2+(r*c)%3===0,
    (r,c)=>((r*c)%2+(r*c)%3)%2===0,
    (r,c)=>((r+c)%2+(r*c)%3)%2===0,
  ];

  // Format strings for ECC-M (bits 0-1 = 00) + mask 0-7, BCH encoded + XOR 101010000010010
  const FMT_STRINGS = [
    [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0],[1,0,1,0,0,1,1,0,1,1,1,0,1,1,1],
    [1,0,1,1,1,1,0,1,0,0,0,1,1,0,0],[1,0,1,1,0,0,1,1,1,1,0,1,0,0,1],
    [1,0,0,0,1,0,1,1,0,1,0,1,1,1,0],[1,0,0,0,0,1,0,1,1,0,0,1,0,1,1],
    [1,0,0,1,1,1,1,0,0,1,1,0,0,0,0],[1,0,0,1,0,0,0,0,1,0,1,0,1,0,1],
  ];

  function applyMask(maskId) {
    const fn = maskFns[maskId];
    const copy = M.map(r => new Int8Array(r));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      if (!F[r][c] && fn(r,c)) copy[r][c] ^= 1;
    // Apply format string
    const fmt = FMT_STRINGS[maskId];
    FP1.forEach(([r,c],i)=>copy[r][c]=fmt[i]);
    FP2.forEach(([r,c],i)=>copy[r][c]=fmt[i]);
    return copy;
  }

  function penalty(mat) {
    let score = 0;
    // Rule 1: 5+ consecutive same in row/col
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (mat[r][c] === mat[r][c-1]) { run++; if (run===5) score+=3; else if(run>5) score++; }
        else run = 1;
      }
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (mat[r][c] === mat[r-1][c]) { run++; if(run===5) score+=3; else if(run>5) score++; }
        else run = 1;
      }
    }
    // Rule 2: 2x2 blocks
    for (let r = 0; r < size-1; r++) for (let c = 0; c < size-1; c++)
      if (mat[r][c]===mat[r][c+1]&&mat[r][c]===mat[r+1][c]&&mat[r][c]===mat[r+1][c+1]) score+=3;
    // Rule 4: proportion
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (mat[r][c]===1) dark++;
    const pct = dark / (size*size) * 100;
    score += Math.abs(Math.floor(pct/5)*5 - 50) / 5 * 10;
    return score;
  }

  let bestMat = null, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const mat = applyMask(m);
    const s = penalty(mat);
    if (s < bestScore) { bestScore = s; bestMat = mat; }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const QUIET = 4;
  const CELL = Math.max(3, Math.floor(240 / (size + QUIET*2)));
  const PX = (size + QUIET*2) * CELL;
  canvas.width = canvas.height = PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PX, PX);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    if (bestMat[r][c] === 1)
      ctx.fillRect((c+QUIET)*CELL, (r+QUIET)*CELL, CELL, CELL);
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
      <span class="qr-label">Mobile Link</span>
      <button class="qr-close" id="qrCloseBtn" aria-label="Close">✕</button>
    </div>
    <div class="qr-canvas-wrap" id="qrCanvasWrap">
      <div class="qr-loading">
        <span class="qr-spinner"></span>
        <span>Generating…</span>
      </div>
    </div>
    <div class="qr-meta">
      <span class="qr-status-dot" id="qrStatusDot"></span>
      <span id="qrStatusText">Waiting for phone…</span>
      <span class="qr-countdown" id="qrCountdown"></span>
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

  // Build the upload URL — use public origin in production, LAN IP for local dev
  const isLocalDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (isLocalDev) {
    // Local dev — try to get LAN IP so phone can reach laptop on same WiFi
    try {
      const ipRes = await api("/api/local-ip");
      if (ipRes.ip) {
        uploadUrl = `http://${ipRes.ip}:${ipRes.port}/mobile.html?token=${token}`;
      } else {
        uploadUrl = `${location.protocol}//${location.host}/mobile.html?token=${token}`;
      }
    } catch {
      uploadUrl = `${location.protocol}//${location.host}/mobile.html?token=${token}`;
    }
  } else {
    // Production — use the actual public URL (Railway https domain)
    uploadUrl = `${location.protocol}//${location.host}/mobile.html?token=${token}`;
  }

  // Draw QR using qr-server.com API — guaranteed scannable
  const wrap = document.getElementById("qrCanvasWrap");
  wrap.innerHTML = "";
  const qrImg = document.createElement("img");
  qrImg.id = "qrCodeCanvas";
  qrImg.style.cssText = "width:210px;height:210px;border-radius:4px;display:block";
  qrImg.alt = "QR Code";
  const encodedUrl = encodeURIComponent(uploadUrl);
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodedUrl}&bgcolor=ffffff&color=000000&qzone=2`;
  qrImg.onerror = () => {
    // Fallback to our canvas encoder if API fails
    wrap.innerHTML = "";
    const qrCanvas = document.createElement("canvas");
    qrCanvas.id = "qrCodeCanvas";
    wrap.appendChild(qrCanvas);
    drawQRCode(qrCanvas, uploadUrl);
  };
  wrap.appendChild(qrImg);

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
        wrap.innerHTML = `<div class="qr-success"><span class="qr-success-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>Meal logged from phone</span></div>`;
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