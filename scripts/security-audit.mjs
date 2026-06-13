import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ignoredDirs = new Set([".git", "node_modules", "outputs"]);
const findings = [];

const secretPatterns = [
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "JWT-like token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
  { name: "Hardcoded password assignment", regex: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else {
      await scan(path);
    }
  }
}

async function scan(path) {
  if (/\.(png|jpg|jpeg|webp|gif|pdf)$/i.test(path)) return;
  const text = await readFile(path, "utf8").catch(() => "");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line) && !path.endsWith(".env.example")) {
        findings.push({ file: path, line: index + 1, issue: pattern.name });
      }
    }
    if (path.includes(`${join("public", "")}`) && /GEMINI_API_KEY|SESSION_SECRET|SUPABASE_SERVICE_ROLE/i.test(line)) {
      findings.push({ file: path, line: index + 1, issue: "Sensitive env reference in frontend" });
    }
  });
}

await walk(root);

if (findings.length) {
  console.error("Security audit failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.issue}`);
  }
  process.exit(1);
}

console.log("Security audit passed: no hardcoded API keys, tokens, passwords, private keys, or frontend secret references found.");
