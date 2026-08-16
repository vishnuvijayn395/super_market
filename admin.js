/* ==========================================================================
   KAKDE SUPERMARKET - ADMIN DASHBOARD ENGINE
   ========================================================================== */

let products = [];
let csrfToken = "";

const adminTableBody = document.getElementById("adminTableBody");
const adminSearchInput = document.getElementById("adminSearchInput");
const adminCategoryFilter = document.getElementById("adminCategoryFilter");
const adminSessionName = document.getElementById("adminSessionName");
const logoutBtn = document.getElementById("logoutBtn");

const statTotalProducts = document.getElementById("statTotalProducts");
const statLowStock = document.getElementById("statLowStock");
const statCategories = document.getElementById("statCategories");
const statDiscountItems = document.getElementById("statDiscountItems");

const openAddModalBtn = document.getElementById("openAddModalBtn");
const productFormModal = document.getElementById("productFormModal");
const closeFormModalBtn = document.getElementById("closeFormModalBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");
const productForm = document.getElementById("productForm");

const formProductId = document.getElementById("formProductId");
const formName = document.getElementById("formName");
const formCategory = document.getElementById("formCategory");
const formUnit = document.getElementById("formUnit");
const formPrice = document.getElementById("formPrice");
const formMrp = document.getElementById("formMrp");
const formDiscount = document.getElementById("formDiscount");
const formStock = document.getElementById("formStock");
const formImage = document.getElementById("formImage");
const formImagePreview = document.getElementById("formImagePreview");
const formDescription = document.getElementById("formDescription");
const modalFormTitle = document.getElementById("modalFormTitle");

/* ---------- Auth & Session Check ---------- */
async function checkAdminAuth() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user && data.user.role === "admin") {
        csrfToken = data.csrfToken || "";
        if (adminSessionName) {
          adminSessionName.innerHTML = `<img src="assets/icons/user-check.svg" class="icon-svg icon-svg-green" alt="" /> ${escapeHTML(data.user.name)} (Admin)`;
        }
        loadAdminProducts();
        return;
      }
    }
  } catch (err) {}

  // Not authorized -> Redirect to login page
  window.location.href = "/login.html?next=admin.html&denied=admin";
}

/* ---------- Logout Action ---------- */
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken }
      });
    } catch (e) {}
    window.location.href = "/login.html";
  });
}

/* ---------- Load Products from REST API ---------- */
async function loadAdminProducts() {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      products = await res.json();
      renderStats();
      renderCategoryDropdown();
      renderAdminTable();
      return;
    }
  } catch (err) {
    console.error("Failed to load products for admin:", err);
  }

  // Fallback
  const cached = localStorage.getItem("kakde_products_cache");
  if (cached) {
    try {
      products = JSON.parse(cached);
      renderStats();
      renderCategoryDropdown();
      renderAdminTable();
    } catch (e) {}
  }
}

/* ---------- Render Dashboard Stats ---------- */
function renderStats() {
  if (statTotalProducts) statTotalProducts.textContent = String(products.length);

  const lowStockCount = products.filter((p) => Number(p.stock) <= 5).length;
  if (statLowStock) statLowStock.textContent = String(lowStockCount);

  const uniqueCats = new Set(products.map((p) => p.category));
  if (statCategories) statCategories.textContent = String(uniqueCats.size);

  const discountCount = products.filter((p) => Number(p.discount) > 0).length;
  if (statDiscountItems) statDiscountItems.textContent = String(discountCount);
}

/* ---------- Category Filter Options ---------- */
function renderCategoryDropdown() {
  if (!adminCategoryFilter) return;
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  adminCategoryFilter.innerHTML = `<option value="ALL">All Categories (${products.length})</option>` +
    categories.map((cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join("");
}

/* ---------- Render Admin Data Table ---------- */
function renderAdminTable() {
  if (!adminTableBody) return;

  const query = (adminSearchInput?.value || "").trim().toLowerCase();
  const catFilter = adminCategoryFilter?.value || "ALL";

  const filtered = products.filter((p) => {
    const matchesCat = catFilter === "ALL" || p.category === catFilter;
    const text = `${p.name} ${p.category} ${p.meta || ""} ${p.unit || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    adminTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: var(--admin-muted);">
          No matching products found in database.
        </td>
      </tr>
    `;
    return;
  }

  adminTableBody.innerHTML = filtered
    .map((p) => {
      const stock = Number(p.stock ?? 25);
      let stockBadge = `<span class="badge-stock in-stock">In Stock (${stock})</span>`;
      if (stock === 0) stockBadge = `<span class="badge-stock out-stock">Out of Stock</span>`;
      else if (stock <= 5) stockBadge = `<span class="badge-stock low-stock">Low (${stock})</span>`;

      const fallbackImg = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80";

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <img class="product-thumb" src="${p.image || fallbackImg}" alt="" onerror="this.src='${fallbackImg}'" />
              <div>
                <strong style="color: #ffffff;">${escapeHTML(p.name)}</strong>
                <div style="font-size: 0.78rem; color: var(--admin-muted);">${escapeHTML(p.meta || p.unit || "")}</div>
              </div>
            </div>
          </td>
          <td><span style="background: rgba(255,255,255,0.06); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${escapeHTML(p.category)}</span></td>
          <td><strong style="color: var(--admin-accent); font-size: 1rem;">₹${p.price}</strong></td>
          <td><span style="color: var(--admin-muted); text-decoration: line-through;">₹${p.mrp || p.price}</span></td>
          <td><span style="color: #fbbf24; font-weight: 700;">${p.discount || 0}% OFF</span></td>
          <td>${stockBadge}</td>
          <td style="text-align: right;">
            <button class="btn-admin btn-admin-outline" onclick="openEditModal('${p.id}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              <img src="assets/icons/pencil.svg" class="icon-svg" alt="" /> Edit
            </button>
            <button class="btn-admin btn-admin-danger" onclick="deleteProduct('${p.id}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-left: 0.35rem;">
              <img src="assets/icons/trash-2.svg" class="icon-svg" alt="" /> Delete
            </button>
          </td>
        </tr>
      `;
    })
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

/* ---------- Modal Form Handling ---------- */
function openAddModal() {
  productForm.reset();
  formProductId.value = "";
  modalFormTitle.textContent = "Add New Product";
  formImagePreview.style.display = "none";
  productFormModal.classList.add("is-open");
}

function openEditModal(productId) {
  const p = products.find((prod) => String(prod.id) === String(productId));
  if (!p) return;

  formProductId.value = p.id;
  formName.value = p.name || "";
  formCategory.value = p.category || "";
  formUnit.value = p.unit || p.meta || "";
  formPrice.value = p.price ?? "";
  formMrp.value = p.mrp ?? p.price ?? "";
  formDiscount.value = p.discount ?? "";
  formStock.value = p.stock ?? 25;
  formImage.value = p.image || "";
  formDescription.value = p.description || "";

  if (p.image) {
    formImagePreview.src = p.image;
    formImagePreview.style.display = "block";
  } else {
    formImagePreview.style.display = "none";
  }

  modalFormTitle.textContent = "Edit Product";
  productFormModal.classList.add("is-open");
}

function closeFormModal() {
  productFormModal.classList.remove("is-open");
}

if (openAddModalBtn) openAddModalBtn.addEventListener("click", openAddModal);
if (closeFormModalBtn) closeFormModalBtn.addEventListener("click", closeFormModal);
if (cancelFormBtn) cancelFormBtn.addEventListener("click", closeFormModal);

/* ---------- Auto Calculate Discount % ---------- */
function autoCalcDiscount() {
  const price = parseFloat(formPrice.value) || 0;
  const mrp = parseFloat(formMrp.value) || 0;
  if (mrp > price && price > 0) {
    const calc = Math.round(((mrp - price) / mrp) * 100);
    formDiscount.value = String(calc);
  }
}
if (formPrice) formPrice.addEventListener("input", autoCalcDiscount);
if (formMrp) formMrp.addEventListener("input", autoCalcDiscount);

/* ---------- Live Image Preview ---------- */
if (formImage) {
  formImage.addEventListener("input", () => {
    const val = formImage.value.trim();
    if (val) {
      formImagePreview.src = val;
      formImagePreview.style.display = "block";
    } else {
      formImagePreview.style.display = "none";
    }
  });
}

/* ---------- Save Product (POST /api/products) ---------- */
if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const priceNum = parseFloat(formPrice.value) || 0;
    const mrpNum = parseFloat(formMrp.value) || priceNum;

    if (priceNum <= 0) {
      alert("Please enter a valid price greater than 0.");
      return;
    }

    const payload = {
      id: formProductId.value || undefined,
      name: formName.value.trim(),
      category: formCategory.value.trim(),
      unit: formUnit.value.trim(),
      meta: formUnit.value.trim(),
      price: priceNum,
      mrp: mrpNum,
      discount: parseInt(formDiscount.value) || 0,
      stock: parseInt(formStock.value) || 0,
      image: formImage.value.trim(),
      description: formDescription.value.trim()
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeFormModal();
        await loadAdminProducts();
        alert("Product saved successfully!");
        return;
      } else {
        const errData = await res.json();
        alert(`Failed to save product: ${errData.error || "Server error"}`);
      }
    } catch (err) {
      alert(`Network error saving product: ${err.message}`);
    }
  });
}

/* ---------- Delete Product (DELETE /api/products/:id) ---------- */
async function deleteProduct(productId) {
  const p = products.find((prod) => String(prod.id) === String(productId));
  if (!p) return;

  if (!confirm(`Are you sure you want to delete "${p.name}"?`)) return;

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken }
    });

    if (res.ok) {
      await loadAdminProducts();
      alert(`Product "${p.name}" deleted successfully.`);
    } else {
      const errData = await res.json();
      alert(`Failed to delete product: ${errData.error || "Server error"}`);
    }
  } catch (err) {
    alert(`Network error deleting product: ${err.message}`);
  }
}

/* ---------- Search & Filter Listeners ---------- */
if (adminSearchInput) adminSearchInput.addEventListener("input", renderAdminTable);
if (adminCategoryFilter) adminCategoryFilter.addEventListener("change", renderAdminTable);

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
});
