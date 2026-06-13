import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import pg from "pg";
const { Pool } = pg;
const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT || 8080);
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const isProduction = process.env.NODE_ENV === "production";


const buckets = new Map();
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isProduction ? { rejectUnauthorized: false } : false });

// Initialize schema
async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL,
      profile TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "expiresAt" BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "loggedAt" TEXT NOT NULL,
      "imagePreview" TEXT,
      "foodIdentified" TEXT,
      "confidenceScore" REAL,
      "glycemicTier" TEXT,
      calories REAL,
      "proteinG" REAL,
      "carbsG" REAL,
      "fatsG" REAL,
      "portionAnalysis" TEXT
    );
    CREATE TABLE IF NOT EXISTS mobile_tokens (
      token TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "expiresAt" BIGINT NOT NULL,
      "usedAt" BIGINT
    );
  `);
}

const activityMultipliers = {
  sedentary: 1.23456789,
  light: 1.375,
  moderate: 1.55,
  intense: 1.725
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml; charset=utf-8",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp"
};

// ─── Food knowledge base for mock estimator ───────────────────────────────────
// Each entry: [calories, proteinG, carbsG, fatsG, glycemicTier]
const FOOD_DB = {
  // Fruits
  apple: [95, 0.5, 25, 0.3, "Low"],
  banana: [105, 1.3, 27, 0.4, "Medium"],
  orange: [62, 1.2, 15, 0.2, "Low"],
  mango: [135, 1.1, 35, 0.6, "Medium"],
  grapes: [104, 1.1, 27, 0.2, "Medium"],
  strawberry: [49, 1.0, 12, 0.5, "Low"],
  watermelon: [86, 1.7, 22, 0.4, "High"],
  pineapple: [83, 0.9, 22, 0.2, "Medium"],
  // Vegetables
  broccoli: [55, 3.7, 11, 0.6, "Low"],
  spinach: [23, 2.9, 3.6, 0.4, "Low"],
  carrot: [52, 1.2, 12, 0.3, "Low"],
  potato: [161, 4.3, 37, 0.2, "High"],
  sweetpotato: [103, 2.3, 24, 0.1, "Medium"],
  "sweet potato": [103, 2.3, 24, 0.1, "Medium"],
  corn: [132, 4.9, 29, 1.8, "Medium"],
  tomato: [35, 1.8, 7, 0.4, "Low"],
  cucumber: [16, 0.7, 3.6, 0.1, "Low"],
  // Grains & Carbs
  rice: [206, 4.3, 45, 0.4, "High"],
  "white rice": [206, 4.3, 45, 0.4, "High"],
  "brown rice": [216, 5.0, 45, 1.8, "Medium"],
  pasta: [220, 8.1, 43, 1.3, "Medium"],
  bread: [79, 2.7, 15, 1.0, "High"],
  "white bread": [79, 2.7, 15, 1.0, "High"],
  "whole wheat bread": [69, 3.6, 12, 1.1, "Medium"],
  oats: [307, 10.7, 55, 5.3, "Low"],
  oatmeal: [166, 5.9, 28, 3.6, "Low"],
  quinoa: [222, 8.1, 39, 3.6, "Low"],
  naan: [262, 8.7, 45, 5.1, "High"],
  roti: [120, 3.1, 18, 3.7, "Medium"],
  chapati: [120, 3.1, 18, 3.7, "Medium"],
  // Proteins
  chicken: [335, 43, 0, 17, "Low"],
  "chicken breast": [284, 53, 0, 6.2, "Low"],
  "chicken thigh": [294, 38, 0, 15, "Low"],
  beef: [338, 31, 0, 23, "Low"],
  "ground beef": [338, 31, 0, 23, "Low"],
  steak: [271, 26, 0, 18, "Low"],
  salmon: [367, 40, 0, 22, "Low"],
  tuna: [191, 42, 0, 1.3, "Low"],
  shrimp: [101, 19, 1.3, 1.4, "Low"],
  egg: [78, 6.3, 0.6, 5.3, "Low"],
  eggs: [156, 12.6, 1.2, 10.6, "Low"],
  "boiled egg": [78, 6.3, 0.6, 5.3, "Low"],
  tofu: [144, 15.5, 3.5, 8.7, "Low"],
  // Dairy
  milk: [149, 8.0, 12, 8.0, "Low"],
  cheese: [113, 6.4, 0.4, 9.4, "Low"],
  yogurt: [100, 17, 6.8, 0.7, "Low"],
  "greek yogurt": [100, 17, 6.8, 0.7, "Low"],
  butter: [102, 0.1, 0, 11.5, "Low"],
  // Legumes
  lentils: [230, 17.9, 39.9, 0.8, "Low"],
  beans: [227, 15.2, 40.8, 0.9, "Low"],
  chickpeas: [269, 14.5, 44.7, 4.3, "Low"],
  // Fast Food & Heavy Items
  pizza: [570, 22, 67, 22, "High"],
  burger: [540, 28, 45, 26, "High"],
  hamburger: [540, 28, 45, 26, "High"],
  cheeseburger: [590, 30, 46, 29, "High"],
  fries: [365, 4.4, 48, 17, "High"],
  "french fries": [365, 4.4, 48, 17, "High"],
  hotdog: [290, 10, 24, 18, "High"],
  "hot dog": [290, 10, 24, 18, "High"],
  sandwich: [340, 16, 41, 12, "Medium"],
  wrap: [310, 14, 38, 11, "Medium"],
  taco: [210, 11, 22, 9, "Medium"],
  burrito: [520, 22, 70, 15, "High"],
  nachos: [480, 10, 58, 24, "High"],
  // Snacks & Sweets
  chocolate: [216, 2.2, 24, 12, "High"],
  cookie: [148, 1.5, 19, 7.5, "High"],
  cake: [350, 4.0, 51, 15, "High"],
  "ice cream": [273, 4.6, 31, 14.5, "High"],
  donut: [253, 3.2, 28, 14, "High"],
  chips: [153, 2.0, 14, 10, "High"],
  crackers: [131, 2.9, 21, 4.3, "Medium"],
  popcorn: [106, 3.4, 21, 1.2, "Medium"],
  // Drinks
  juice: [114, 0.6, 26, 0.5, "High"],
  "orange juice": [112, 1.7, 26, 0.5, "High"],
  soda: [140, 0, 39, 0, "High"],
  "cola": [140, 0, 39, 0, "High"],
  coffee: [5, 0.3, 0, 0, "Low"],
  tea: [2, 0, 0.5, 0, "Low"],
  beer: [153, 1.6, 13, 0, "High"],
  wine: [125, 0.1, 3.8, 0, "Medium"],
  // Common Meals
  "fried rice": [333, 8.2, 48, 12, "High"],
  "biryani": [490, 24, 60, 16, "High"],
  "dal": [220, 14, 38, 1.5, "Low"],
  "samosa": [308, 6.0, 34, 16, "High"],
  "idli": [128, 4.5, 26, 0.4, "Low"],
  "dosa": [168, 3.8, 28, 4.5, "Medium"],
  "curry": [280, 18, 24, 12, "Medium"],
  "soup": [90, 5.0, 12, 2.5, "Low"],
  "salad": [120, 4.0, 14, 6.0, "Low"],
  "sushi": [300, 16, 42, 5.5, "Medium"],
  "ramen": [436, 18, 60, 14, "High"],
  "noodles": [220, 7.5, 43, 1.4, "High"],
  "stir fry": [280, 18, 22, 14, "Medium"],
  "pancakes": [340, 8.2, 52, 11, "High"],
  "waffle": [310, 9.0, 43, 12, "High"],
  "cereal": [207, 5.2, 43, 2.8, "High"],
  "granola": [471, 10, 64, 20, "Medium"],
  "smoothie": [180, 4.0, 38, 1.5, "Medium"],
  "protein shake": [200, 30, 10, 3.5, "Low"],
};

// Non-food items that should be rejected
const NON_FOOD_TERMS = [
  "laptop", "computer", "phone", "keyboard", "mouse", "monitor", "desk", "chair",
  "book", "pen", "pencil", "paper", "bag", "shoe", "shirt", "table", "lamp",
  "bottle", "cup", "plate", "bowl", "fork", "spoon", "knife", "glass",
  "car", "bike", "tree", "grass", "rock", "soil", "concrete", "wall",
  "cat", "dog", "bird", "fish tank", "flower", "plant"
];

function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function getIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimit(req, res) {
  const now = Date.now();
  const route = req.url.split("?")[0];
  const isAuthRoute = route.startsWith("/api/auth/");
  const limit = isAuthRoute ? (isProduction ? 5 : 50) : 120;
  const windowMs = 15 * 60 * 1000;
  const key = `${getIp(req)}:${isAuthRoute ? "auth" : route}`;
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > limit) {
    send(res, 429, { error: "Too many requests. Try again later." });
    return false;
  }
  return true;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>`{}]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function numberInRange(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function calculateBmr(profile) {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}

function calculateTdee(profile) {
  return calculateBmr(profile) * activityMultipliers[profile.activityLevel];
}

function calorieTarget(profile) {
  const tdee = calculateTdee(profile);
  if (profile.goal === "loss") return tdee - 500;
  if (profile.goal === "gain") return tdee + 350;
  return tdee;
}

function cardioOffsets(delta, weightKg) {
  if (delta <= 0) return { runningMins: 0, cyclingMins: 0, walkingMins: 0 };
  const burnRate = (met) => (met * 3.5 * weightKg) / 200;
  return {
    runningMins: Number((delta / burnRate(8.8)).toFixed(1)),
    cyclingMins: Number((delta / burnRate(6.8)).toFixed(1)),
    walkingMins: Number((delta / burnRate(4.3)).toFixed(1))
  };
}

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

async function createToken(userId) {
  const raw = `${userId}.${randomBytes(24).toString("base64url")}.${Date.now()}`;
  const token = `${raw}.${sign(raw)}`;

  await db.query('INSERT INTO sessions(token,"userId","expiresAt") VALUES($1,$2,$3)',
    [token, userId, Date.now() + 7 * 24 * 60 * 60 * 1000]);

  return token;
}

async function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const raw = parts.slice(0, 3).join(".");
  const expected = sign(raw);
  const actual = parts[3];
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;
const session = (await db.query('SELECT token,"userId","expiresAt" FROM sessions WHERE token = $1', [token])).rows[0];

if (!session) return null;

if (session.expiresAt < Date.now()) {
  await db.query("DELETE FROM sessions WHERE token = $1", [token]);

  return null;
}

return session.userid || session.userId;
}
function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2));
}

async function getUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const userId = await verifyToken(cookies.bd_session);
  if (!userId) return null;

const row = (await db.query('SELECT id,email,"passwordHash",profile FROM users WHERE id = $1', [userId])).rows[0];

if (!row) return null;

return {
  ...row,
  id: row.id,
  email: row.email,
  passwordHash: row.passwordhash || row.passwordHash,
  profile: row.profile ? JSON.parse(row.profile) : null
};
}

function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function parseJson(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("Payload too large"), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Malformed JSON"), { status: 400 });
  }
}

function validateProfile(input) {
  const age = numberInRange(input.age, 13, 110);
  const weightKg = numberInRange(input.weightKg, 30, 300);
  const targetWeightKg = numberInRange(input.targetWeightKg, 30, 300);
  const heightCm = numberInRange(input.heightCm, 120, 230);
  const sex = input.sex === "male" || input.sex === "female" ? input.sex : null;
  const activityLevel = Object.hasOwn(activityMultipliers, input.activityLevel) ? input.activityLevel : null;
  const goal = ["loss", "maintain", "gain"].includes(input.goal) ? input.goal : null;
  if (!age || !weightKg || !targetWeightKg || !heightCm || !sex || !activityLevel || !goal) return null;
  const profile = { age, weightKg, targetWeightKg, heightCm, sex, activityLevel, goal };
  return {
    ...profile,
    bmr: Number(calculateBmr(profile).toFixed(1)),
    tdee: Number(calculateTdee(profile).toFixed(1)),
    calorieTarget: Number(calorieTarget(profile).toFixed(1))
  };
}

// Returns datestring YYYY-MM-DD in local server time
function toDateStr(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return toDateStr(new Date().toISOString());
}

// Returns the Monday of the week containing the given date string
function weekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function summarize(user) {
  const rows = (await db.query('SELECT id,"userId","loggedAt","imagePreview","foodIdentified","confidenceScore","glycemicTier","portionAnalysis",calories,"proteinG","carbsG","fatsG" FROM meals WHERE "userId" = $1 ORDER BY "loggedAt" DESC', [user.id])).rows;

const allMeals = rows.map(m => ({
  id: m.id,
  loggedAt: m.loggedat || m.loggedAt,
  imagePreview: m.imagepreview || m.imagePreview || "",
  foodIdentified: m.foodidentified || m.foodIdentified || "",
  confidenceScore: m.confidencescore || m.confidenceScore || 0,
  glycemicTier: m.glycemictier || m.glycemicTier || "Medium",
  portionAnalysis: m.portionanalysis || m.portionAnalysis || "",
  macros: {
    calories: Number(m.calories) || 0,
    proteinG: Number(m.proteing || m.proteinG) || 0,
    carbsG: Number(m.carbsg || m.carbsG) || 0,
    fatsG: Number(m.fatsg || m.fatsG) || 0,
  }
}));
  const today = todayStr();

  // Group all meals by date
  const byDate = {};
  for (const meal of allMeals) {
    const d = toDateStr(meal.loggedAt);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(meal);
  }

  // Today's totals
  const todayMeals = byDate[today] || [];
  const consumed = todayMeals.reduce((sum, m) => sum + m.macros.calories, 0);
  const target = user.profile?.calorieTarget || 0;
  const delta = Math.max(0, consumed - target);

  // Weekly summary: group by week (Mon–Sun), keyed by week start Monday
  const weeklyMap = {};
  for (const [dateStr, dayMeals] of Object.entries(byDate)) {
    const wk = weekStart(dateStr);
    if (!weeklyMap[wk]) weeklyMap[wk] = { totalCalories: 0, days: {} };
    const dayCals = dayMeals.reduce((sum, m) => sum + m.macros.calories, 0);
    weeklyMap[wk].totalCalories += dayCals;
    weeklyMap[wk].days[dateStr] = dayCals;
  }

  // Weekly target = daily target * 7
  const weeklyTarget = target * 7;

  // Build sorted weekly summaries (most recent first)
  const weeklySummaries = Object.entries(weeklyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStartDate, data]) => ({
      weekStart: weekStartDate,
      totalCalories: Number(data.totalCalories.toFixed(1)),
      weeklyTarget: Number(weeklyTarget.toFixed(1)),
      overBy: Number(Math.max(0, data.totalCalories - weeklyTarget).toFixed(1)),
      underBy: Number(Math.max(0, weeklyTarget - data.totalCalories).toFixed(1)),
      days: data.days
    }));

  return {
    user: { email: user.email, profile: user.profile || null },
    meals: todayMeals,
    allMealsByDate: byDate,
    totals: {
      consumed: Number(consumed.toFixed(1)),
      remaining: Number((target - consumed).toFixed(1)),
      delta: Number(delta.toFixed(1)),
      cardio: cardioOffsets(delta, user.profile?.weightKg || 70)
    },
    weeklySummaries,
    today
  };
}

// ─── Improved mock food estimator ────────────────────────────────────────────
function mockAnalysis(description) {
  const raw = cleanText(description, 180).toLowerCase().trim();

  // Check for non-food items
  for (const term of NON_FOOD_TERMS) {
    if (raw.includes(term)) {
      return {
        error: `"${cleanText(description, 60)}" doesn't look like a food item. Please describe what you ate.`
      };
    }
  }

  if (!raw) {
    return { error: "Please describe the meal you ate." };
  }

  // Try to match known foods in the description
  let matchedFoods = [];
  for (const [foodKey, nutrients] of Object.entries(FOOD_DB)) {
    if (raw.includes(foodKey)) {
      matchedFoods.push({ name: foodKey, nutrients });
    }
  }

  // If multiple matches, sum them up (e.g. "chicken and rice")
  if (matchedFoods.length > 0) {
    let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0;
    let glycemicScores = [];
    let names = [];
    for (const { name, nutrients } of matchedFoods) {
      const [cal, pro, carb, fat, gi] = nutrients;
      totalCals += cal;
      totalProtein += pro;
      totalCarbs += carb;
      totalFats += fat;
      glycemicScores.push(gi);
      names.push(name);
    }
    // Pick highest glycemic tier
    const tier = glycemicScores.includes("High") ? "High" : glycemicScores.includes("Medium") ? "Medium" : "Low";
    return {
      foodIdentified: names.join(", "),
      confidenceScore: 0.88,
      glycemicTier: tier,
      macros: {
        calories: Math.round(totalCals),
        proteinG: Math.round(totalProtein * 10) / 10,
        carbsG: Math.round(totalCarbs * 10) / 10,
        fatsG: Math.round(totalFats * 10) / 10
      },
      portionAnalysis: "Estimated from text description. Add GEMINI_API_KEY for image-based precision."
    };
  }

  // Fallback: description contains unknown food words — give a generic estimate
  // but flag low confidence
  return {
    foodIdentified: cleanText(description, 120),
    confidenceScore: 0.45,
    glycemicTier: "Medium",
    macros: {
      calories: 350,
      proteinG: 12,
      carbsG: 40,
      fatsG: 10
    },
    portionAnalysis: "Unknown food — rough estimate only. Add GEMINI_API_KEY for accurate analysis."
  };
}

// ─── Gemini model fallback chain ─────────────────────────────────────────────
// Models listed in order of preference — tries next on quota/overload errors
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",   // cheapest quota, try first
  "gemini-2.5-flash",        // standard
  "gemini-3.5-flash",        // newest fallback
];

async function callGeminiModel(model, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 }
    })
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const status = response.status;
    const msg = errBody?.error?.message || `Model ${model} failed`;
    // 429 = quota, 503 = overloaded, 500 = server error — all retryable with next model
    const retryable = status === 429 || status === 503 || status === 500;
    throw Object.assign(new Error(msg), { status: retryable ? "retry" : 502 });
  }
  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw Object.assign(new Error("Empty response from model"), { status: "retry" });
  return text;
}

function parseGeminiResponse(text) {
  // Strip markdown code fences if model wraps response in them
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return null; }
  return {
    foodIdentified: cleanText(parsed.foodIdentified, 160) || "Detected meal",
    confidenceScore: Math.min(1, Math.max(0, Number(parsed.confidenceScore || 0))),
    glycemicTier: ["Low", "Medium", "High"].includes(parsed.glycemicTier) ? parsed.glycemicTier : "Medium",
    macros: {
      calories: numberInRange(parsed.macros?.calories, 0, 5000) ?? 0,
      proteinG: numberInRange(parsed.macros?.proteinG, 0, 500) ?? 0,
      carbsG: numberInRange(parsed.macros?.carbsG, 0, 700) ?? 0,
      fatsG: numberInRange(parsed.macros?.fatsG, 0, 500) ?? 0
    },
    portionAnalysis: cleanText(parsed.portionAnalysis, 220)
  };
}

async function analyzeWithGemini(imageDataUrl, description) {
  const hasImage = Boolean(imageDataUrl && imageDataUrl.length > 50);
  const hasDescription = Boolean(description && description.trim().length > 0);

  // No key — fall back to mock estimator
  if (!geminiApiKey) {
    if (!hasDescription) return { error: "No Gemini API key set. Please describe the meal as text." };
    return mockAnalysis(description);
  }

  // Validate image if present
  let mimeType, base64Data;
  if (hasImage) {
    const match = imageDataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) throw Object.assign(new Error("Invalid image format. Use PNG, JPEG, or WEBP."), { status: 400 });
    [, mimeType, base64Data] = match;
    if (Buffer.byteLength(base64Data, "base64") > 5_000_000)
      throw Object.assign(new Error("Image too large. Maximum 5 MB."), { status: 400 });
  }

  const prompt = `You are a precise nutritional analysis engine. Return ONLY a valid JSON object, no markdown, no code fences, no extra text. Schema: {"foodIdentified":"string","confidenceScore":0.0,"glycemicTier":"Low|Medium|High","macros":{"calories":0,"proteinG":0,"carbsG":0,"fatsG":0},"portionAnalysis":"string"}.${hasImage ? " Analyze the food visible in the image." : ""}${hasDescription ? ` Meal description: ${cleanText(description, 180)}` : ""}`;

  const parts = [{ text: prompt }];
  if (hasImage) parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });

  // Try each model in order until one succeeds
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[Gemini] Trying: ${model}`);
      const text = await callGeminiModel(model, parts);
      const parsed = parseGeminiResponse(text);
      if (!parsed) {
        console.warn(`[Gemini] ${model} returned unparseable response, trying next...`);
        continue;
      }
      console.log(`[Gemini] Success: ${model}`);
      return parsed;
    } catch (err) {
      if (err.status === "retry") {
        console.warn(`[Gemini] ${model} busy/quota: ${err.message}`);
        continue;
      }
      // Hard error (bad key, bad request) — no point trying next model
      throw Object.assign(new Error(err.message), { status: 502 });
    }
  }

  // All models failed — use mock if description available
  console.warn("[Gemini] All models failed, falling back to mock estimator");
  if (hasDescription) return mockAnalysis(description);
  throw Object.assign(
    new Error("All AI models are busy. Try again shortly or describe the meal as text."),
    { status: 503 }
  );
}

// Returns the first private LAN IPv4 address (e.g. 192.168.x.x)
function getLanIp() {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

async function handleApi(req, res) {
  if (!rateLimit(req, res)) return;
  const route = req.url.split("?")[0];
  try {
    // ── Public routes (no auth required) ──────────────────────────────────────
    if (route === "/api/health" && req.method === "GET")
      return send(res, 200, { ok: true });

    if (route === "/api/version" && req.method === "GET")
      return send(res, 200, { version: 2, features: ["mobile-qr"] });

    if (route === "/api/local-ip" && req.method === "GET") {
      const ip = getLanIp();
      return send(res, 200, { ip, port });
    }

    if (route === "/api/auth/register" && req.method === "POST") {
      const body = await parseJson(req);
      const email = cleanText(body.email, 254).toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128)
        return send(res, 400, { error: "Use a valid email and a password of 10 to 128 characters." });
      const existing = (await db.query("SELECT id FROM users WHERE email = $1", [email])).rows[0];
      if (existing) return send(res, 409, { error: "Account already exists." });
      const newUser = { id: randomBytes(16).toString("hex"), email, passwordHash: hashPassword(password), profile: null };
      await db.query('INSERT INTO users (id,email,"passwordHash",profile) VALUES($1,$2,$3,$4)', [newUser.id, newUser.email, newUser.passwordHash, null]);
      const regToken = await createToken(newUser.id);
      const secure = isProduction ? "; Secure" : "";
      return send(res, 201, summarize(newUser), { "Set-Cookie": `bd_session=${regToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}` });
    }

    if (route === "/api/auth/login" && req.method === "POST") {
      const body = await parseJson(req);
      const email = cleanText(body.email, 254).toLowerCase();
      const password = String(body.password || "");
      const row = (await db.query('SELECT id,email,"passwordHash",profile FROM users WHERE email = $1', [email])).rows[0];
      if (!row) return send(res, 401, { error: "Invalid credentials." });
      const loginUser = { ...row, passwordHash: row.passwordhash || row.passwordHash, profile: row.profile ? JSON.parse(row.profile) : null };
      if (!verifyPassword(password, loginUser.passwordHash)) return send(res, 401, { error: "Invalid credentials." });
      const loginToken = await createToken(loginUser.id);
      const secure = isProduction ? "; Secure" : "";
      return send(res, 200, summarize(loginUser), { "Set-Cookie": `bd_session=${loginToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}` });
    }

    if (route === "/api/auth/logout" && req.method === "POST") {
      const cookies = parseCookies(req.headers.cookie || "");
      if (cookies.bd_session) await db.query("DELETE FROM sessions WHERE token = $1", [cookies.bd_session]);
      return send(res, 200, { ok: true }, { "Set-Cookie": "bd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
    }

    // Mobile upload — authenticated by token in body, not session cookie
    if (route === "/api/mobile-upload" && req.method === "POST") {
      const body = await parseJson(req, 6_000_000);
      const mobileToken = String(body.token || "");
      const tokenRow = (await db.query("SELECT * FROM mobile_tokens WHERE token = $1", [mobileToken])).rows[0];
      if (!tokenRow) return send(res, 401, { error: "Invalid or expired link. Scan a fresh QR code." });
      if ((tokenRow.expiresat || tokenRow.expiresAt) < Date.now()) {
        await db.query("DELETE FROM mobile_tokens WHERE token = $1", [mobileToken]);
        return send(res, 410, { error: "QR code has expired. Generate a new one on desktop." });
      }
      if (tokenRow.usedat || tokenRow.usedAt) return send(res, 409, { error: "This link has already been used." });
      const mobileUser = (await db.query('SELECT id,email,"passwordHash",profile FROM users WHERE id = $1', [tokenRow.userid || tokenRow.userId])).rows[0];
      if (!mobileUser) return send(res, 404, { error: "User not found." });
      const fullUser = { ...mobileUser, passwordHash: mobileUser.passwordhash || mobileUser.passwordHash, profile: mobileUser.profile ? JSON.parse(mobileUser.profile) : null };
      if (!fullUser.profile) return send(res, 409, { error: "Complete your profile on desktop first." });
      const imageDataUrl = String(body.imageDataUrl || "");
      const description = cleanText(body.description || "", 180);
      const hasImage = imageDataUrl.length > 50;
      const hasDescription = description.trim().length > 0;
      if (!hasImage && !hasDescription) return send(res, 400, { error: "Send a photo or describe the meal." });
      if (hasImage && !/^data:image\/(?:png|jpe?g|webp);base64,[a-zA-Z0-9+/=]+$/.test(imageDataUrl))
        return send(res, 400, { error: "Only PNG, JPEG, and WEBP images are accepted." });
      const analysis = await analyzeWithGemini(hasImage ? imageDataUrl : "", description);
      if (analysis.error) return send(res, 400, { error: analysis.error });
      const meal = { id: randomBytes(8).toString("hex"), loggedAt: new Date().toISOString(), imagePreview: imageDataUrl || "", ...analysis };
      await db.query('INSERT INTO meals (id,"userId","loggedAt","imagePreview","foodIdentified","confidenceScore","glycemicTier",calories,"proteinG","carbsG","fatsG","portionAnalysis") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [meal.id, fullUser.id, meal.loggedAt, meal.imagePreview, meal.foodIdentified, meal.confidenceScore, meal.glycemicTier, meal.macros.calories, meal.macros.proteinG, meal.macros.carbsG, meal.macros.fatsG, meal.portionAnalysis]);
      await db.query('UPDATE mobile_tokens SET "usedAt" = $1 WHERE token = $2', [Date.now(), mobileToken]);
      return send(res, 201, { ok: true, food: meal.foodIdentified, calories: meal.macros.calories });
    }

    // ── Authenticated routes (session cookie required) ─────────────────────────
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Authentication required." });

    if (route === "/api/me" && req.method === "GET") return send(res, 200, await summarize(user));

    if (route === "/api/profile" && req.method === "POST") {
      const profile = validateProfile(await parseJson(req));
      if (!profile) return send(res, 400, { error: "Profile payload is outside accepted biometric ranges." });
      user.profile = profile;
      await db.query("UPDATE users SET profile = $1 WHERE id = $2", [JSON.stringify(profile), user.id]);
      return send(res, 200, await summarize(user));
    }

    if (route === "/api/meals" && req.method === "POST") {
      if (!user.profile) return send(res, 409, { error: "Create a profile before logging meals." });
      const body = await parseJson(req, 6_000_000);
      const imageDataUrl = String(body.imageDataUrl || "");
      const description = cleanText(body.description, 180);
      const hasImage = imageDataUrl.length > 50;
      const hasDescription = description.trim().length > 0;
      if (!hasImage && !hasDescription) return send(res, 400, { error: "Upload a meal photo or describe what you ate." });
      if (hasImage && !/^data:image\/(?:png|jpe?g|webp);base64,[a-zA-Z0-9+/=]+$/.test(imageDataUrl))
        return send(res, 400, { error: "Only PNG, JPEG, and WEBP images are accepted." });
      const analysis = await analyzeWithGemini(hasImage ? imageDataUrl : "", description);
      if (analysis.error) return send(res, 400, { error: analysis.error });
      const meal = { id: randomBytes(8).toString("hex"), loggedAt: new Date().toISOString(), imagePreview: imageDataUrl || "", ...analysis };
      await db.query('INSERT INTO meals (id,"userId","loggedAt","imagePreview","foodIdentified","confidenceScore","glycemicTier",calories,"proteinG","carbsG","fatsG","portionAnalysis") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [meal.id, user.id, meal.loggedAt, meal.imagePreview, meal.foodIdentified, meal.confidenceScore, meal.glycemicTier, meal.macros.calories, meal.macros.proteinG, meal.macros.carbsG, meal.macros.fatsG, meal.portionAnalysis]);
      return send(res, 201, await summarize(await getUser(req)));
    }

    if (route === "/api/mobile-token" && req.method === "POST") {
      await db.query('DELETE FROM mobile_tokens WHERE "expiresAt" < $1', [Date.now()]);
      const mobileToken = randomBytes(20).toString("hex");
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await db.query('INSERT INTO mobile_tokens (token,"userId","expiresAt") VALUES($1,$2,$3)', [mobileToken, user.id, expiresAt]);
      return send(res, 200, { token: mobileToken, expiresIn: 600 });
    }

    if (route === "/api/mobile-token/poll" && req.method === "GET") {
      const tok = new URL(req.url, "http://x").searchParams.get("token") || "";
      if (!tok) return send(res, 400, { error: "Missing token." });
      const row = (await db.query("SELECT * FROM mobile_tokens WHERE token = $1", [tok])).rows[0];
      if (!row) return send(res, 404, { error: "Token not found." });
      if ((row.expiresat || row.expiresAt) < Date.now()) return send(res, 410, { error: "Token expired." });
      return send(res, 200, { used: !!(row.usedAt || row.usedat) });
    }

    return send(res, 404, { error: "Not found." });
  } catch (error) {
    return send(res, error.status || 500, { error: error.status ? error.message : "Unexpected server error." });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}



setInterval(() => {
  db.prepare("DELETE FROM sessions WHERE expiresAt < ?").run(Date.now());
  await db.query('DELETE FROM mobile_tokens WHERE "expiresAt" < $1', [Date.now()]);
}, 60 * 60 * 1000);

initDb().then(() => {
  createServer((req, res) => {
    if (req.url.startsWith("/api/")) return handleApi(req, res);
    return serveStatic(req, res);
  }).listen(port, () => {
    console.log(`BurnDelta v2 (mobile QR) running at http://localhost:${port}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
