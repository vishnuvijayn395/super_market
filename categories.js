/* ==========================================================================
   KAKDE SUPERMARKET - CATEGORIES BROWSER SCRIPT
   ========================================================================== */

let catalogProducts = [];
let selectedCategory = "ALL";

const catalogCategoryPills = document.getElementById("catalogCategoryPills");
const catalogProductGrid = document.getElementById("catalogProductGrid");
const catSearchInput = document.getElementById("catSearchInput");

async function fetchCatalogProducts() {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      catalogProducts = await res.json();
      renderCatalogPills();
      renderCatalogGrid();
      return;
    }
  } catch (e) {}

  const cached = localStorage.getItem("kakde_products_cache");
  if (cached) {
    try {
      catalogProducts = JSON.parse(cached);
      renderCatalogPills();
      renderCatalogGrid();
    } catch (err) {}
  }
}

function renderCatalogPills() {
  if (!catalogCategoryPills) return;
  const categories = ["ALL", ...Array.from(new Set(catalogProducts.map((p) => p.category))).sort()];

  catalogCategoryPills.innerHTML = categories
    .map((cat) => {
      const active = cat === selectedCategory ? "active" : "";
      const label = cat === "ALL" ? "All Departments" : cat;
      const icon = cat === "ALL" ? "assets/icons/sparkles.svg" : "assets/icons/boxes.svg";
      return `<button class="category-pill ${active}" data-cat="${escapeHTML(cat)}"><img src="${icon}" class="icon-svg" alt="" /> ${escapeHTML(label)}</button>`;
    })
    .join("");
}

function renderCatalogGrid() {
  if (!catalogProductGrid) return;
  const query = (catSearchInput?.value || "").trim().toLowerCase();

  const filtered = catalogProducts.filter((p) => {
    const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const text = `${p.name} ${p.category} ${p.meta || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    catalogProductGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <h3>No products found in this category</h3>
      </div>
    `;
    return;
  }

  const FALLBACK_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";

  catalogProductGrid.innerHTML = filtered
    .map((p) => `
      <article class="product-card">
        ${p.discount > 0 ? `<div class="product-card__badge">-${p.discount}% OFF</div>` : ""}
        <div class="product-card__img-wrap">
          <img src="${p.image || FALLBACK_IMG}" alt="${escapeHTML(p.name)}" onerror="this.src='${FALLBACK_IMG}'" />
        </div>
        <span class="product-card__category">${escapeHTML(p.category)}</span>
        <h3 class="product-card__title">${escapeHTML(p.name)}</h3>
        <p class="product-card__meta">${escapeHTML(p.meta || p.unit || "")}</p>
        <div class="product-card__footer">
          <div class="product-card__price-box">
            <span class="product-card__price">₹${p.price}</span>
            ${p.mrp > p.price ? `<span class="product-card__mrp">₹${p.mrp}</span>` : ""}
          </div>
          <a class="btn-add-cart" href="index.html#products">
            <img src="assets/icons/shopping-bag.svg" class="icon-svg" alt="" /> Store
          </a>
        </div>
      </article>
    `)
    .join("");
}

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (catalogCategoryPills) {
  catalogCategoryPills.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-pill");
    if (!btn) return;
    selectedCategory = btn.dataset.cat || "ALL";
    renderCatalogPills();
    renderCatalogGrid();
  });
}

if (catSearchInput) {
  catSearchInput.addEventListener("input", renderCatalogGrid);
}

document.addEventListener("DOMContentLoaded", fetchCatalogProducts);
