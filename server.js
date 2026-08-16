const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL = 1000 * 60 * 60 * 8; // 8 hours

const sessions = new Map();
const loginAttempts = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err.message);
    return fallback;
  }
}

function saveJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp_${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, filePath);
}

function loadUsers() {
  return loadJSON(USERS_FILE, []);
}

function saveUsers(users) {
  saveJSON(USERS_FILE, users);
}

function loadProducts() {
  return loadJSON(PRODUCTS_FILE, []);
}

function saveProducts(products) {
  saveJSON(PRODUCTS_FILE, products);
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
  if (!user || !user.salt || !user.passwordHash) return false;
  const candidate = await hashPassword(password, user.salt);
  return crypto.timingSafeEqual(
    Buffer.from(candidate.hash, "hex"),
    Buffer.from(user.passwordHash, "hex")
  );
}

async function ensureAdmin() {
  ensureDir(DATA_DIR);
  const users = loadUsers();
  if (users.some((user) => user.role === "admin")) return;

  const email = (process.env.ADMIN_EMAIL || "admin@kakde.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@123";
  const secured = await hashPassword(password);

  users.push({
    id: crypto.randomUUID(),
    name: "Store Administrator",
    email,
    role: "admin",
    passwordHash: secured.hash,
    salt: secured.salt,
    createdAt: new Date().toISOString()
  });

  saveUsers(users);
  console.log(`[INFO] Admin user initialized: ${email}`);
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": MIME[".json"],
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          part.slice(0, index).trim(),
          decodeURIComponent(part.slice(index + 1))
        ];
      })
  );
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
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId: user.id,
    csrfToken,
    expiresAt: Date.now() + SESSION_TTL
  });
  return { token, csrfToken };
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `kakde_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 500_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(
    (time) => now - time < 15 * 60 * 1000
  );
  loginAttempts.set(ip, recent);
  return recent.length >= 10;
}

function recordFailure(ip) {
  loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()]);
}

/* ---------------- Auth API Routes ---------------- */
async function authApi(req, res, pathname) {
  if (pathname === "/api/auth/me" && req.method === "GET") {
    const session = currentSession(req);
    if (!session) return json(res, 401, { authenticated: false });
    const user = loadUsers().find((item) => item.id === session.userId);
    if (!user) return json(res, 401, { authenticated: false });
    return json(res, 200, {
      authenticated: true,
      user: publicUser(user),
      csrfToken: session.csrfToken
    });
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (name.length < 2)
      return json(res, 400, { error: "Please enter your full name." });
    if (!validEmail(email))
      return json(res, 400, { error: "Please enter a valid email address." });
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return json(res, 400, {
        error:
          "Password must be 8+ characters with uppercase, lowercase, and a number."
      });
    }

    const users = loadUsers();
    if (users.some((user) => user.email === email)) {
      return json(res, 409, {
        error: "An account with this email already exists."
      });
    }

    const secured = await hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      role: "user",
      passwordHash: secured.hash,
      salt: secured.salt,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);

    const session = createSession(user);
    return json(
      res,
      201,
      { user: publicUser(user), csrfToken: session.csrfToken },
      { "Set-Cookie": sessionCookie(session.token) }
    );
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const ip = req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) {
      return json(res, 429, {
        error: "Too many login attempts. Please try again in 15 minutes."
      });
    }

    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const loginAs = body.loginAs === "admin" ? "admin" : "user";

    const user = loadUsers().find((item) => item.email === email);
    if (!user || !(await verifyPassword(password, user))) {
      recordFailure(ip);
      return json(res, 401, { error: "Incorrect email or password." });
    }

    if (user.role !== loginAs) {
      return json(res, 403, {
        error:
          loginAs === "admin"
            ? "This account does not have admin permissions."
            : "Please use the Customer Login tab for this account."
      });
    }

    loginAttempts.delete(ip);
    const session = createSession(user);
    return json(
      res,
      200,
      { user: publicUser(user), csrfToken: session.csrfToken },
      { "Set-Cookie": sessionCookie(session.token) }
    );
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const session = currentSession(req);
    if (!session) return json(res, 200, { success: true });
    sessions.delete(session.token);
    return json(
      res,
      200,
      { success: true },
      {
        "Set-Cookie":
          "kakde_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
      }
    );
  }

  return json(res, 404, { error: "Auth endpoint not found." });
}

/* ---------------- Products API Routes ---------------- */
async function productsApi(req, res, pathname) {
  // GET /api/products
  if (pathname === "/api/products" && req.method === "GET") {
    const products = loadProducts();
    return json(res, 200, products);
  }

  // POST /api/products (Create or Update Product)
  if (pathname === "/api/products" && req.method === "POST") {
    const session = currentSession(req);
    if (!session) return json(res, 401, { error: "Authentication required." });

    const user = loadUsers().find((u) => u.id === session.userId);
    if (!user || user.role !== "admin") {
      return json(res, 403, { error: "Admin permissions required." });
    }

    try {
      const body = await readBody(req);
      if (!body.name || !body.category || !body.price) {
        return json(res, 400, { error: "Product name, category, and price are required." });
      }

      const products = loadProducts();
      const existingIndex = body.id
        ? products.findIndex((p) => String(p.id) === String(body.id))
        : -1;

      const productData = {
        id: body.id || `prod-${Date.now()}`,
        name: String(body.name).trim(),
        category: String(body.category).trim(),
        meta: String(body.meta || "").trim(),
        description: String(body.description || "").trim(),
        image: String(body.image || "").trim(),
        price: Number(body.price) || 0,
        mrp: Number(body.mrp || body.price) || 0,
        discount: Number(body.discount || 0),
        stock: Number(body.stock ?? 25),
        unit: String(body.unit || body.meta || "1 Pc").trim(),
        featured: Boolean(body.featured)
      };

      if (existingIndex >= 0) {
        products[existingIndex] = { ...products[existingIndex], ...productData };
      } else {
        products.unshift(productData);
      }

      saveProducts(products);
      return json(res, existingIndex >= 0 ? 200 : 201, {
        success: true,
        product: productData
      });
    } catch (err) {
      return json(res, 400, { error: err.message || "Failed to save product." });
    }
  }

  // DELETE /api/products/:id
  const deleteMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const session = currentSession(req);
    if (!session) return json(res, 401, { error: "Authentication required." });

    const user = loadUsers().find((u) => u.id === session.userId);
    if (!user || user.role !== "admin") {
      return json(res, 403, { error: "Admin permissions required." });
    }

    const productId = deleteMatch[1];
    let products = loadProducts();
    const initialLen = products.length;
    products = products.filter((p) => String(p.id) !== String(productId));

    if (products.length === initialLen) {
      return json(res, 404, { error: "Product not found." });
    }

    saveProducts(products);
    return json(res, 200, { success: true, message: "Product deleted successfully." });
  }

  return json(res, 404, { error: "Products endpoint not found." });
}

/* ---------------- Static File Server ---------------- */
function serveFile(req, res, pathname) {
  let requested = pathname === "/" ? "/index.html" : pathname;

  // Protect admin.html page redirection if not admin
  if (requested === "/admin.html") {
    const session = currentSession(req);
    if (!session) {
      res.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(requested)}` });
      return res.end();
    }
    const user = loadUsers().find((item) => item.id === session.userId);
    if (user?.role !== "admin") {
      res.writeHead(302, { Location: "/login.html?denied=admin" });
      return res.end();
    }
  }

  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, normalized);

  if (!filePath.startsWith(ROOT)) {
    return json(res, 403, { error: "Forbidden." });
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        return json(res, 404, { error: "Page not found." });
      }
      return json(res, 500, { error: "Server error reading file." });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
}

/* ---------------- Request Router ---------------- */
async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/auth/")) {
      return await authApi(req, res, pathname);
    }
    if (pathname.startsWith("/api/products")) {
      return await productsApi(req, res, pathname);
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      return json(res, 405, { error: "Method not allowed." });
    }

    return serveFile(req, res, pathname);
  } catch (error) {
    console.error("[SERVER ERROR]", error);
    return json(res, 500, { error: "Internal server error." });
  }
}

async function startServer(port = PORT) {
  await ensureAdmin();
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(port, () => {
      console.log(`\n==================================================`);
      console.log(`🛒 Kakde Supermarket Running Live!`);
      console.log(`📍 Store Front : http://localhost:${port}/`);
      console.log(`🛠  Admin Panel: http://localhost:${port}/admin.html`);
      console.log(`🔑 Admin Login: admin@kakde.com / Admin@123`);
      console.log(`==================================================\n`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
