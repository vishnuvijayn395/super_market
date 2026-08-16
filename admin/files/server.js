const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL = 1000 * 60 * 60 * 8;
const sessions = new Map();
const loginAttempts = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml"
};

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }
  catch { return []; }
}

function saveUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(users, null, 2));
  fs.renameSync(temp, USERS_FILE);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve({ salt, hash: key.toString("hex") });
    });
  });
}

async function verifyPassword(password, user) {
  const candidate = await hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

async function ensureAdmin() {
  const users = loadUsers();
  if (users.some(user => user.role === "admin")) return;
  const email = (process.env.ADMIN_EMAIL || "admin@kakde.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@123";
  const secured = await hashPassword(password);
  users.push({
    id: crypto.randomUUID(), name: "Store Administrator", email, role: "admin",
    passwordHash: secured.hash, salt: secured.salt, createdAt: new Date().toISOString()
  });
  saveUsers(users);
  console.log(`Admin account created: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log("Development password: Admin@123 (change with ADMIN_PASSWORD before first production run)");
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": MIME[".json"], "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function currentSession(req) {
  const token = parseCookies(req).kakde_session;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { userId: user.id, csrfToken, expiresAt: Date.now() + SESSION_TTL });
  return { token, csrfToken };
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `kakde_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 20_000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(time => now - time < 15 * 60 * 1000);
  loginAttempts.set(ip, recent);
  return recent.length >= 8;
}

function recordFailure(ip) {
  loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()]);
}

async function authApi(req, res, pathname) {
  if (pathname === "/api/auth/me" && req.method === "GET") {
    const session = currentSession(req);
    if (!session) return json(res, 401, { authenticated: false });
    const user = loadUsers().find(item => item.id === session.userId);
    if (!user) return json(res, 401, { authenticated: false });
    return json(res, 200, { authenticated: true, user: publicUser(user), csrfToken: session.csrfToken });
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (name.length < 2) return json(res, 400, { error: "Please enter your full name." });
    if (!validEmail(email)) return json(res, 400, { error: "Please enter a valid email address." });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return json(res, 400, { error: "Password needs 8+ characters with uppercase, lowercase, and a number." });
    }
    const users = loadUsers();
    if (users.some(user => user.email === email)) return json(res, 409, { error: "An account with this email already exists." });
    const secured = await hashPassword(password);
    const user = { id: crypto.randomUUID(), name, email, role: "user", passwordHash: secured.hash, salt: secured.salt, createdAt: new Date().toISOString() };
    users.push(user);
    saveUsers(users);
    const session = createSession(user);
    return json(res, 201, { user: publicUser(user), csrfToken: session.csrfToken }, { "Set-Cookie": sessionCookie(session.token) });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const ip = req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) return json(res, 429, { error: "Too many login attempts. Please try again in 15 minutes." });
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const loginAs = body.loginAs === "admin" ? "admin" : "user";
    const user = loadUsers().find(item => item.email === email);
    if (!user || !(await verifyPassword(password, user))) {
      recordFailure(ip);
      return json(res, 401, { error: "Incorrect email or password." });
    }
    if (user.role !== loginAs) {
      return json(res, 403, { error: loginAs === "admin" ? "This is not an administrator account." : "Use the Admin Login tab for this account." });
    }
    loginAttempts.delete(ip);
    const session = createSession(user);
    return json(res, 200, { user: publicUser(user), csrfToken: session.csrfToken }, { "Set-Cookie": sessionCookie(session.token) });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const session = currentSession(req);
    if (!session || req.headers["x-csrf-token"] !== session.csrfToken) return json(res, 403, { error: "Invalid session request." });
    sessions.delete(session.token);
    return json(res, 200, { success: true }, { "Set-Cookie": "kakde_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }

  return json(res, 404, { error: "Not found." });
}

function serveFile(req, res, pathname) {
  let requested = pathname === "/" ? "/index.html" : pathname;
  if (requested === "/admin.html" || requested === "/user.html") {
    const session = currentSession(req);
    if (!session) {
      res.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(requested)}` });
      return res.end();
    }
    const user = loadUsers().find(item => item.id === session.userId);
    if (requested === "/admin.html" && user?.role !== "admin") {
      res.writeHead(302, { Location: "/user.html?denied=admin" });
      return res.end();
    }
  }
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, normalized);
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: "Forbidden." });
  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, error.code === "ENOENT" ? 404 : 500, { error: "Page not found." });
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/auth/")) return await authApi(req, res, url.pathname);
    if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, { error: "Method not allowed." });
    return serveFile(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Something went wrong." });
  }
}

async function startServer(port = PORT) {
  await ensureAdmin();
  return new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(port, () => {
      console.log(`Kakde Supermarket running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) startServer();
module.exports = { startServer };
