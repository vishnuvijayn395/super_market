/* ==========================================================================
   KAKDE SUPERMARKET - AUTHENTICATION SCRIPT
   ========================================================================== */

const tabCustomer = document.getElementById("tabCustomer");
const tabAdmin = document.getElementById("tabAdmin");
const loginRole = document.getElementById("loginRole");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const authAlert = document.getElementById("authAlert");
const demoCredentialsHint = document.getElementById("demoCredentialsHint");

const urlParams = new URLSearchParams(window.location.search);
const nextUrl = urlParams.get("next") || "";
const deniedReason = urlParams.get("denied") || "";

function showAlert(message, isError = true) {
  if (!authAlert) return;
  authAlert.textContent = message;
  authAlert.className = `auth-alert ${isError ? "error" : "success"}`;
}

if (deniedReason === "admin") {
  showAlert("Admin access required. Please sign in with an Administrator account.");
}

// Role Tabs Handler (Login page)
if (tabCustomer && tabAdmin) {
  tabCustomer.addEventListener("click", () => {
    tabCustomer.classList.add("active");
    tabAdmin.classList.remove("active");
    if (loginRole) loginRole.value = "user";
    if (submitBtn) submitBtn.textContent = "Sign In as Customer";
    if (demoCredentialsHint) demoCredentialsHint.style.display = "none";
  });

  tabAdmin.addEventListener("click", () => {
    tabAdmin.classList.add("active");
    tabCustomer.classList.remove("active");
    if (loginRole) loginRole.value = "admin";
    if (submitBtn) submitBtn.textContent = "Sign In as Admin 🛠";
    if (demoCredentialsHint) demoCredentialsHint.style.display = "block";
  });

  // If next=admin.html, default to Admin tab
  if (nextUrl.includes("admin.html")) {
    tabAdmin.click();
  }
}

// Login Form Submit
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authAlert.style.display = "none";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = loginRole ? loginRole.value : "user";

    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying...";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, loginAs: role })
      });

      const data = await res.json();

      if (res.ok) {
        showAlert("Login successful! Redirecting...", false);
        setTimeout(() => {
          if (role === "admin") {
            window.location.href = "admin.html";
          } else if (nextUrl) {
            window.location.href = nextUrl;
          } else {
            window.location.href = "index.html";
          }
        }, 800);
      } else {
        showAlert(data.error || "Login failed. Please check your credentials.");
        submitBtn.disabled = false;
        submitBtn.textContent = role === "admin" ? "Sign In as Admin 🛠" : "Sign In as Customer";
      }
    } catch (err) {
      showAlert("Network error connecting to authentication server.");
      submitBtn.disabled = false;
    }
  });
}

// Register Form Submit
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authAlert.style.display = "none";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account...";

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showAlert("Account created successfully! Redirecting to supermarket...", false);
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1000);
      } else {
        showAlert(data.error || "Failed to create account.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account ✨";
      }
    } catch (err) {
      showAlert("Network error creating account.");
      submitBtn.disabled = false;
    }
  });
}
