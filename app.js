/* ==========================================================================
   KAKDE SUPERMARKET - FRONTEND STORE LOGIC & APP ENGINE
   ========================================================================== */

const CART_KEY = "kakde_cart_v2";
const FALLBACK_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
const WHATSAPP_NUMBER = "919730708582";

let allProducts = [];
let activeCategory = "ALL";
let currentOfferIndex = 0;
let offerTimer = null;
let currentModalProductId = null;

/* ---------- DOM Element References ---------- */
const productGrid = document.getElementById("productGrid");
const productCountSub = document.getElementById("productCountSub");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchForm = document.getElementById("searchForm");

const categoryPills = document.getElementById("categoryPills");
const cartCountBadge = document.getElementById("cartCountBadge");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartDrawerOverlay = document.getElementById("cartDrawerOverlay");
const cartItemsContainer = document.getElementById("cartItemsContainer");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartDelivery = document.getElementById("cartDelivery");
const cartTotal = document.getElementById("cartTotal");
const whatsappCheckoutBtn = document.getElementById("whatsappCheckoutBtn");

const productModalBackdrop = document.getElementById("productModalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalCategory = document.getElementById("modalCategory");
const modalPrice = document.getElementById("modalPrice");
const modalMrp = document.getElementById("modalMrp");
const modalDiscount = document.getElementById("modalDiscount");
const modalAddToCartBtn = document.getElementById("modalAddToCartBtn");

const offersTrack = document.getElementById("offersTrack");
const offerPrevBtn = document.getElementById("offerPrevBtn");
const offerNextBtn = document.getElementById("offerNextBtn");
const toastContainer = document.getElementById("toastContainer");
const authAccountNav = document.getElementById("authAccountNav");

/* ---------- Toast Notification Utility ---------- */
function showToast(message, iconSvg = "assets/icons/check.svg") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<img src="${iconSvg}" class="icon-svg" style="filter: brightness(0) invert(1);" alt="" /> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ---------- Products Data Fetching & Sync ---------- */
async function fetchProducts() {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        allProducts = data;
        localStorage.setItem("kakde_products_cache", JSON.stringify(allProducts));
        renderProducts();
        return;
      }
    }
  } catch (err) {
    console.warn("API fetch failed, falling back to local cache or default data:", err);
  }

  // Fallback to local cache
  const cached = localStorage.getItem("kakde_products_cache");
  if (cached) {
    try {
      allProducts = JSON.parse(cached);
      renderProducts();
      return;
    } catch (e) {}
  }
}

/* ---------- Session & Auth Check ---------- */
async function checkAuthSession() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        if (authAccountNav) {
          authAccountNav.innerHTML = `
            <a class="btn-action" href="user.html" style="color: var(--primary); font-weight: 700;">
              <img src="assets/icons/user.svg" class="icon-svg icon-svg-green" alt="" /> Hi, ${escapeHTML(data.user.name.split(" ")[0])}
            </a>
          `;
        }
      }
    }
  } catch (err) {}
}

/* ---------- Helper: HTML Escape ---------- */
function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Render Products Grid ---------- */
function renderProducts() {
  if (!productGrid) return;

  const query = (searchInput?.value || "").trim().toLowerCase();
  
  const filtered = allProducts.filter((p) => {
    const matchesCat = activeCategory === "ALL" || p.category === activeCategory;
    const searchText = `${p.name} ${p.category} ${p.meta || ""} ${p.description || ""}`.toLowerCase();
    const matchesQuery = !query || searchText.includes(query);
    return matchesCat && matchesQuery;
  });

  if (productCountSub) {
    productCountSub.textContent = `Showing ${filtered.length} of ${allProducts.length} items`;
  }

  if (filtered.length === 0) {
    productGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <img src="assets/icons/search.svg" class="icon-svg icon-svg-muted" style="width: 48px; height: 48px; margin-bottom: 0.5rem;" alt="" />
        <h3 style="font-family: var(--font-heading); font-size: 1.4rem; color: var(--dark-slate);">No products found</h3>
        <p style="margin-top: 0.25rem;">Try adjusting your search query or select another category tab.</p>
        <button onclick="resetFilters()" class="btn-primary" style="margin-top: 1.25rem; font-size: 0.9rem;">
          View All Products
        </button>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = filtered
    .map((p) => {
      const discountTag = p.discount > 0 ? `<div class="product-card__badge">-${p.discount}% OFF</div>` : "";
      const imgSrc = p.image || FALLBACK_IMG;
      const mrpHtml = p.mrp > p.price ? `<span class="product-card__mrp">₹${p.mrp}</span>` : "";

      return `
        <article class="product-card" data-id="${p.id}">
          ${discountTag}
          <div class="product-card__img-wrap" onclick="openProductModal('${p.id}')">
            <img src="${imgSrc}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'" />
          </div>
          <span class="product-card__category">${escapeHTML(p.category)}</span>
          <h3 class="product-card__title" onclick="openProductModal('${p.id}')">${escapeHTML(p.name)}</h3>
          <p class="product-card__meta">${escapeHTML(p.meta || p.unit || "")}</p>
          <div class="product-card__footer">
            <div class="product-card__price-box">
              <span class="product-card__price">₹${p.price}</span>
              ${mrpHtml}
            </div>
            <button class="btn-add-cart" onclick="handleAddToCart(event, '${p.id}')">
              <img src="assets/icons/plus.svg" class="icon-svg" alt="" />
              <span>Add</span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function resetFilters() {
  if (searchInput) searchInput.value = "";
  activeCategory = "ALL";
  updateCategoryPillsUI();
  renderProducts();
}

/* ---------- Category Pills Filter ---------- */
if (categoryPills) {
  categoryPills.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-pill");
    if (!btn) return;
    activeCategory = btn.dataset.category || "ALL";
    updateCategoryPillsUI();
    renderProducts();
  });
}

function updateCategoryPillsUI() {
  if (!categoryPills) return;
  const pills = categoryPills.querySelectorAll(".category-pill");
  pills.forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.category === activeCategory);
  });
}

/* ---------- Search Event Listeners ---------- */
if (searchInput) {
  searchInput.addEventListener("input", renderProducts);
}
if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    renderProducts();
  });
}

/* ---------- Cart State & Drawer Logic ---------- */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCountBadge();
    renderCartDrawer();
  } catch (e) {}
}

function updateCartCountBadge() {
  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  if (cartCountBadge) {
    cartCountBadge.textContent = String(totalCount);
  }
}

function handleAddToCart(event, productId) {
  if (event) event.stopPropagation();

  const product = allProducts.find((p) => String(p.id) === String(productId));
  if (!product) return;

  const cart = getCart();
  const existing = cart.find((item) => String(item.id) === String(productId));

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, qty: 1 });
  }

  saveCart(cart);
  showToast(`Added <strong>${escapeHTML(product.name)}</strong> to cart!`, "assets/icons/shopping-bag.svg");

  // Visual feedback on button
  if (event && event.currentTarget) {
    const btn = event.currentTarget;
    btn.classList.add("added");
    btn.innerHTML = `<img src="assets/icons/check.svg" class="icon-svg" alt="" /> <span>Added</span>`;
    setTimeout(() => {
      btn.classList.remove("added");
      btn.innerHTML = `<img src="assets/icons/plus.svg" class="icon-svg" alt="" /> <span>Add</span>`;
    }, 1000);
  }
}

function updateCartItemQty(productId, delta) {
  let cart = getCart();
  const item = cart.find((i) => String(i.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => String(i.id) !== String(productId));
  }
  saveCart(cart);
}

function removeCartItem(productId) {
  let cart = getCart();
  cart = cart.filter((i) => String(i.id) !== String(productId));
  saveCart(cart);
}

function renderCartDrawer() {
  if (!cartItemsContainer) return;

  const cart = getCart();
  let subtotal = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <img src="assets/icons/shopping-bag.svg" class="icon-svg icon-svg-muted" alt="" />
        <h3>Your Cart is Empty</h3>
        <p>Explore our wide range of groceries and add items to your cart.</p>
      </div>
    `;
    if (cartSubtotal) cartSubtotal.textContent = "₹0";
    if (cartDelivery) cartDelivery.textContent = "₹0";
    if (cartTotal) cartTotal.textContent = "₹0";
    return;
  }

  const itemsHtml = cart
    .map((cartItem) => {
      const p = allProducts.find((item) => String(item.id) === String(cartItem.id));
      if (!p) return "";
      const itemTotal = p.price * cartItem.qty;
      subtotal += itemTotal;

      return `
        <div class="cart-item">
          <img class="cart-item__img" src="${p.image || FALLBACK_IMG}" alt="${escapeHTML(p.name)}" onerror="this.src='${FALLBACK_IMG}'" />
          <div class="cart-item__details">
            <div class="cart-item__name">${escapeHTML(p.name)}</div>
            <div class="cart-item__meta">${escapeHTML(p.meta || p.unit || "")}</div>
            <div class="cart-item__price">₹${p.price} x ${cartItem.qty} = ₹${itemTotal}</div>
          </div>
          <div class="cart-item__controls">
            <button class="cart-item__btn" onclick="updateCartItemQty('${p.id}', -1)">-</button>
            <span class="cart-item__qty">${cartItem.qty}</span>
            <button class="cart-item__btn" onclick="updateCartItemQty('${p.id}', 1)">+</button>
          </div>
        </div>
      `;
    })
    .join("");

  cartItemsContainer.innerHTML = itemsHtml;

  const deliveryFee = subtotal >= 499 || subtotal === 0 ? 0 : 30;
  const grandTotal = subtotal + deliveryFee;

  if (cartSubtotal) cartSubtotal.textContent = `₹${subtotal}`;
  if (cartDelivery) cartDelivery.textContent = deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`;
  if (cartTotal) cartTotal.textContent = `₹${grandTotal}`;
}

/* ---------- Cart Drawer Toggle ---------- */
function openCartDrawer() {
  if (cartDrawerOverlay) {
    cartDrawerOverlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    renderCartDrawer();
  }
}

function closeCartDrawer() {
  if (cartDrawerOverlay) {
    cartDrawerOverlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }
}

if (openCartBtn) openCartBtn.addEventListener("click", openCartDrawer);
if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);
if (cartDrawerOverlay) {
  cartDrawerOverlay.addEventListener("click", (e) => {
    if (e.target === cartDrawerOverlay) closeCartDrawer();
  });
}

/* ---------- WhatsApp Business Checkout (9730708582) ---------- */
if (whatsappCheckoutBtn) {
  whatsappCheckoutBtn.addEventListener("click", () => {
    const cart = getCart();
    if (cart.length === 0) {
      showToast("Your cart is empty!", "assets/icons/circle-alert.svg");
      return;
    }

    let text = "🛒 *NEW ORDER FROM KAKDE SUPERMARKET*\n\n";
    let subtotal = 0;

    cart.forEach((item, index) => {
      const p = allProducts.find((prod) => String(prod.id) === String(item.id));
      if (p) {
        const lineTotal = p.price * item.qty;
        subtotal += lineTotal;
        text += `${index + 1}. *${p.name}* (${p.meta || p.unit || "1 Pc"})\n   Qty: ${item.qty} x ₹${p.price} = ₹${lineTotal}\n`;
      }
    });

    const deliveryFee = subtotal >= 499 ? 0 : 30;
    const grandTotal = subtotal + deliveryFee;

    text += `\n--------------------------------\n`;
    text += `*Subtotal:* ₹${subtotal}\n`;
    text += `*Delivery Fee:* ${deliveryFee === 0 ? "FREE" : "₹" + deliveryFee}\n`;
    text += `*Grand Total:* ₹${grandTotal}\n`;
    text += `--------------------------------\n`;
    text += `\nPlease confirm my order and share delivery timing!`;

    const encoded = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
    window.open(whatsappUrl, "_blank");
  });
}

/* ---------- Product Quick View Modal ---------- */
function openProductModal(productId) {
  const p = allProducts.find((prod) => String(prod.id) === String(productId));
  if (!p || !productModalBackdrop) return;

  currentModalProductId = p.id;
  if (modalImg) modalImg.src = p.image || FALLBACK_IMG;
  if (modalTitle) modalTitle.textContent = p.name;
  if (modalDesc) modalDesc.textContent = p.description || `${p.name} - Premium quality product available at best price in Kakde Supermarket.`;
  if (modalCategory) modalCategory.textContent = p.category;
  if (modalPrice) modalPrice.textContent = `₹${p.price}`;
  if (modalMrp) modalMrp.textContent = p.mrp > p.price ? `₹${p.mrp}` : "";
  if (modalDiscount) {
    modalDiscount.textContent = p.discount > 0 ? `-${p.discount}% OFF` : "";
    modalDiscount.style.display = p.discount > 0 ? "inline-block" : "none";
  }

  productModalBackdrop.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  if (productModalBackdrop) {
    productModalBackdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  }
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeProductModal);
if (productModalBackdrop) {
  productModalBackdrop.addEventListener("click", (e) => {
    if (e.target === productModalBackdrop) closeProductModal();
  });
}
if (modalAddToCartBtn) {
  modalAddToCartBtn.addEventListener("click", () => {
    if (currentModalProductId) {
      handleAddToCart(null, currentModalProductId);
      closeProductModal();
    }
  });
}

/* ---------- Offers Carousel Slider ---------- */
function goToOffer(index) {
  if (!offersTrack) return;
  const count = offersTrack.children.length;
  currentOfferIndex = (index + count) % count;
  offersTrack.style.transform = `translateX(-${currentOfferIndex * 100}%)`;
}

function nextOffer() { goToOffer(currentOfferIndex + 1); }
function prevOffer() { goToOffer(currentOfferIndex - 1); }

if (offerNextBtn) offerNextBtn.addEventListener("click", nextOffer);
if (offerPrevBtn) offerPrevBtn.addEventListener("click", prevOffer);

function startOfferAuto() {
  stopOfferAuto();
  offerTimer = setInterval(nextOffer, 4000);
}
function stopOfferAuto() {
  if (offerTimer) clearInterval(offerTimer);
}

if (offersTrack) {
  offersTrack.addEventListener("mouseenter", stopOfferAuto);
  offersTrack.addEventListener("mouseleave", startOfferAuto);
}

/* ---------- Smooth Nav Jump ---------- */
document.querySelectorAll(".navlink[data-hash]").forEach((link) => {
  link.addEventListener("click", (e) => {
    const hash = link.dataset.hash;
    if (!hash || hash === "#") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.querySelector(hash);
    if (target) {
      e.preventDefault();
      const headerOffset = 110;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  });
});

/* ---------- Initialization ---------- */
document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  checkAuthSession();
  updateCartCountBadge();
  startOfferAuto();
});