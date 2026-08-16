// Kakde Supermarket Admin - Simple product management

const STORAGE_KEY = "kakde_products";

// Get elements
const form = document.getElementById("productForm");
const formTitle = document.getElementById("formTitle");
const productId = document.getElementById("productId");
const nameInput = document.getElementById("name");
const categoryInput = document.getElementById("category");
const metaInput = document.getElementById("meta");
const imageUrlInput = document.getElementById("image");
const imageFileInput = document.getElementById("imageFile");
const priceInput = document.getElementById("price");
const mrpInput = document.getElementById("mrp");
const discountInput = document.getElementById("discount");
const resetBtn = document.getElementById("resetBtn");
const tableWrap = document.getElementById("tableWrap");
const searchAdmin = document.getElementById("searchAdmin");

// Simple product storage functions
function getProducts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveProducts(products) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch {
    return false;
  }
}

// Form handling
function resetForm() {
  form.reset();
  productId.value = "";
  formTitle.textContent = "Add Product";
}

function fillForm(product) {
  productId.value = product.id;
  nameInput.value = product.name || "";
  categoryInput.value = product.category || "";
  metaInput.value = product.meta || "";
  imageUrlInput.value = product.image || "";
  priceInput.value = product.price ?? "";
  mrpInput.value = product.mrp ?? "";
  discountInput.value = product.discount ?? "";
  formTitle.textContent = "Edit Product";
}

function saveProduct(e) {
  e.preventDefault();

  const product = {
    id: productId.value || Date.now().toString(),
    name: nameInput.value.trim(),
    category: categoryInput.value.trim(),
    meta: metaInput.value.trim(),
    image: imageUrlInput.value.trim(),
    price: parseFloat(priceInput.value) || 0,
    mrp: parseFloat(mrpInput.value) || 0,
    discount: parseInt(discountInput.value) || 0,
  };

  // Validation
  if (!product.name || !product.category || !product.meta) {
    alert("Please fill all fields.");
    return;
  }
  if (product.price <= 0 || product.mrp <= 0) {
    alert("Price and MRP must be greater than 0.");
    return;
  }
  if (product.price > product.mrp) {
    alert("Price should be less than or equal to MRP.");
    return;
  }
  if (product.discount < 0 || product.discount > 90) {
    alert("Discount must be between 0 and 90.");
    return;
  }

  const products = getProducts();
  const index = products.findIndex(p => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.unshift(product);
  }

  if (saveProducts(products)) {
    resetForm();
    renderProductList();
    alert("Product saved successfully!");
  } else {
    alert("Failed to save product. Storage may be full.");
  }
}

// Product list rendering
function renderProductList() {
  const query = (searchAdmin.value || "").toLowerCase().trim();
  const products = getProducts().filter(p =>
    `${p.name || ""} ${p.category || ""} ${p.meta || ""}`
      .toLowerCase()
      .includes(query)
  );

  if (products.length === 0) {
    tableWrap.innerHTML = '<div class="empty">No products found.</div>';
    return;
  }

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Price</th>
          <th>MRP</th>
          <th>Discount</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (p) => `
          <tr>
            <td>${p.name || ""}<br><small>${p.meta || ""}</small></td>
            <td>${p.category || ""}</td>
            <td>₹${Number(p.price || 0)}</td>
            <td>₹${Number(p.mrp || 0)}</td>
            <td>${Number(p.discount || 0)}%</td>
            <td>
              <button class="btn edit" data-id="${p.id}">Edit</button>
              <button class="btn danger" data-delete="${p.id}">Delete</button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  // Add event listeners to edit/delete buttons
  document.querySelectorAll(".edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const product = getProducts().find((p) => p.id === id);
      if (product) fillForm(product);
    });
  });

  document.querySelectorAll(".danger").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this product?")) return;
      const id = btn.getAttribute("data-delete");
      const products = getProducts().filter((p) => p.id !== id);
      if (saveProducts(products)) renderProductList();
    });
  });
}

// Event listeners
form.addEventListener("submit", saveProduct);
resetBtn.addEventListener("click", resetForm);
searchAdmin.addEventListener("input", renderProductList);

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  resetForm();
  renderProductList();
});