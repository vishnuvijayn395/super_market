// Kakde Supermarket - Simple app.js

const STORAGE_KEY = "kakde_products";
const FALLBACK_IMG = "https://via.placeholder.com/400x300?text=No+Image";

let cartCount = 0;

// Sync product changes across tabs/windows - REMOVED for original version

/* ---------- Elements ---------- */
const cartCountEl = document.getElementById("cartCount");
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const allCatBtn = document.getElementById("allCatBtn");
const catDropdown = document.getElementById("catDropdown");
const navLinks = [...document.querySelectorAll(".navlink")];

const offersTrack = document.getElementById("offersTrack");
const offersPrev = document.getElementById("offersPrev");
const offersNext = document.getElementById("offersNext");
const offersDots = document.getElementById("offersDots");

const sectionTargets = ["categories", "offers", "bestsellers", "about", "contact"]
  .map((id) => document.getElementById(id))
  .filter(Boolean);

/* ---------- Default products ---------- */
const defaultProducts = [
  {
    id: "1",
    name: "Amul Taaza Milk",
    category: "Milk & Dairy",
    meta: "1 Ltr",
    image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=500&q=80",
    price: 61,
    mrp: 68,
    discount: 10
  },
  {
    id: "2",
    name: "Aashirvaad Atta",
    category: "Staples & Grains",
    meta: "5 Kg",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=500&q=80",
    price: 239,
    mrp: 280,
    discount: 15
  },
  {
    id: "3",
    name: "Fortune Sunflower Oil",
    category: "Cooking Essentials",
    meta: "1 Ltr",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80",
    price: 135,
    mrp: 146,
    discount: 8
  },
  {
    id: "4",
    name: "Tata Tea Premium",
    category: "Beverages",
    meta: "1 Kg",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=500&q=80",
    price: 530,
    mrp: 590,
    discount: 10
  }
];

/* ---------- Utils ---------- */
function esc(str = "") {
  return String(str)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """)
    .replaceAll("'", "&#039;");
}

function resolveImageSrc(raw) {
  if (!raw || typeof raw !== "string") return FALLBACK_IMG;
  const src = raw.trim();

  if (src.startsWith("data:image/")) return src;         // base64 upload
  if (/^https?:\/\//i.test(src)) return src;             // absolute url
  if (src.startsWith("./") || src.startsWith("../") || src.startsWith("/") || src.startsWith("assets/")) {
    return src;                                           // local path
  }
  return FALLBACK_IMG;
}

function getProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // INTENTIONAL TYPO FOR ORIGINAL VERSION: defaultPoints instead of defaultProducts
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProducts));
      return [...defaultPoints]; // This will cause an error in the original version
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...defaultProducts];
  } catch {
    return [...defaultProducts];
  }
}

function setCartCount(n) {
  cartCount = n;
  if (cartCountEl) cartCountEl.textContent = String(n);
}

function getCart() {
  try {
    const raw = localStorage.getItem('kakde_cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem('kakde_cart', JSON.stringify(cart));
    return true;
  } catch {
    return false;
  }
}

function addToCart(productId) {
  const cart = getCart();
  // Simple version: just add the product ID to the cart array (allows duplicates for multiple items)
  cart.push(productId);
  return saveCart(cart);
}

function updateCartCount() {
  const cart = getCart();
  // Simple version: just count the number of items in the cart array
  setCartCount(cart.length);
}

/* ---------- Products Render + Search ---------- */
function ensureNoResultsMessage(show) {
  let msg = document.getElementById("noResultsMsg");
  if (show) {
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "noResultsMsg";
      msg.className = "no-results";
      msg.textContent = "No products found. Try another keyword.";
      productGrid.appendChild(msg);
    }
  } else if (msg) {
    msg.remove();
  }
}

function renderProducts(products) {
  if (!productGrid) return;

  productGrid.innerHTML = products.map((p) => {
    const imgSrc = resolveImageSrc(p.image);
    return `
      <article class="card product" data-id="${p.id}">
        <div class="product__img">
          <img
            src="${imgSrc}"
            alt="${esc(p.name)}"
            loading="lazy"
          />
        </div>
        <h3 class="product__name">${esc(p.name)}</h3>
        <p class="product__meta">${esc(p.meta || "")}</p>
        <div class="product__price">
          <span class="price">₹${Number(p.price || 0)}</span>
          <span class="mrp">₹${Number(p.mrp || 0)}</span>
          <span class="tag">-${Number(p.discount || 0)}% OFF</span>
        </div>
        <button class="btn btn--yellow addToCart">Add to cart</button>
      </article>
    `;
  }).join("");

  ensureNoResultsMessage(products.length === 0);
}

function filterProducts() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const all = getProducts();
  const filtered = all.filter((p) => {
    const text = `${p.name || ""} ${p.meta || ""} ${p.category || ""}`.toLowerCase();
    return !q || text.includes(q);
  });
  renderProducts(filtered);
}

/* ---------- Cart ---------- */
if (productGrid) {
  productGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".addToCart");
    if (!btn) return;

    const productEl = btn.closest(".product");
    if (!productEl) return;
    const productId = productEl.dataset.id;
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    if (addToCart(product.id)) {
      updateCartCount();

      // Simple feedback
      const originalText = btn.textContent;
      btn.textContent = "Added!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1000);
    } else {
      alert("Failed to save cart. Storage may be full.");
    }
  });
}

/* ---------- Search events ---------- */
if (searchBtn) searchBtn.addEventListener("click", filterProducts);
if (searchInput) {
  searchInput.addEventListener("input", filterProducts);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      filterProducts();
    }
  });
}

/* ---------- Category dropdown ---------- */
if (allCatBtn && catDropdown) {
  allCatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (catDropdown.hasAttribute("hidden")) catDropdown.removeAttribute("hidden");
    else catDropdown.setAttribute("hidden", "");
  });

  catDropdown.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    catDropdown.setAttribute("hidden", "");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") catDropdown.setAttribute("hidden", "");
  });
}

/* ---------- Nav scroll + active tab ---------- */
function getHeaderOffset() {
  const header = document.querySelector(".header");
  return (header?.offsetHeight || 0) + 10;
}

function activateNavByHash(hash) {
  navLinks.forEach((l) => l.classList.remove("is-active"));
  const found = navLinks.find((l) => l.getAttribute("href") === hash);
  if (found) found.classList.add("is-active");
  else {
    const home = navLinks.find((l) => l.getAttribute("href") === "#");
    if (home) home.classList.add("is-active");
  }
}

function scrollToHash(hash) {
  if (!hash || hash === "#") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    activateNavByHash("#");
    return;
  }
  const target = document.querySelector(hash);
  if (!target) return;

  const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
  window.scrollTo({ top, behavior: "smooth" });
  activateNavByHash(hash);
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    e.preventDefault();

    scrollToHash(href);

    if (href === "#") history.replaceState(null, "", window.location.pathname);
    else history.replaceState(null, "", href);
  });
});

function updateActiveTabOnScroll() {
  const y = window.scrollY + getHeaderOffset() + 20;
  if (y < 180) {
    activateNavByHash("#");
    return;
  }

  let currentId = "";
  for (const sec of sectionTargets) {
    if (sec.offsetTop <= y) currentId = sec.id;
  }
  if (currentId) activateNavByHash(`#${currentId}`);
}

window.addEventListener("scroll", updateActiveTabOnScroll, { passive: true });
window.addEventListener("resize", updateActiveTabOnScroll);

/* ---------- Offers slider ---------- */
function buildOfferDots() {
  if (!offersTrack || !offersDots) return;
  const total = offersTrack.children.length;
  offersDots.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Go to offer ${i + 1}`);
    dot.addEventListener("click", () => goToOffer(i));
    offersDots.appendChild(dot);
  }
}

function updateOfferDots() {
  if (!offersDots) return;
  [...offersDots.children].forEach((d, i) => d.classList.toggle("active", i === currentOffer));
}

function goToOffer(index) {
  if (!offersTrack) return;
  const total = offersTrack.children.length;
  currentOffer = (index + total) % total;
  offersTrack.style.transform = `translateX(-${currentOffer * 100}%)`;
  updateOfferDots();
}

function nextOffer() { goToOffer(currentOffer + 1); }
function prevOffer() { goToOffer(currentOffer - 1); }

function startOfferAuto() {
  stopOfferAuto();
  offersTimer = setInterval(nextOffer, 3200);
}
function stopOfferAuto() {
  if (offersTimer) clearInterval(offersTimer);
}

if (offersNext) offersNext.addEventListener("click", nextOffer);
if (offersPrev) offersPrev.addEventListener("click", prevOffer);
if (offersTrack) {
  offersTrack.addEventListener("mouseenter", stopOfferAuto);
  offersTrack.addEventListener("mouseleave", startOfferAuto);
}

/* ---------- Init ---------- */
renderProducts(getProducts());
updateCartCount();
buildOfferDots();
goToOffer(0);
startOfferAuto();
updateActiveTabOnScroll();

window.addEventListener("load", () => {
  if (window.location.hash) {
    setTimeout(() => scrollToHash(window.location.hash), 50);
  }
});