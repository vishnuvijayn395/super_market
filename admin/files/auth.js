const message = document.getElementById("authMessage");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `auth-message show ${type}`;
}

async function sendAuth(endpoint, body) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(body)
    });
  } catch {
    throw new Error("Authentication server is not reachable. Keep npm start running and use http://localhost:3000.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Authentication failed.");
  return data;
}

function destinationFor(user) {
  const requested = new URLSearchParams(location.search).get("next");
  if (user.role === "admin") return requested === "/user.html" ? "/user.html" : "/admin.html";
  return requested && requested !== "/admin.html" ? requested : "/user.html";
}

document.querySelector("[data-toggle-password]")?.addEventListener("click", event => {
  const input = event.currentTarget.parentElement.querySelector("input");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
});

document.querySelectorAll("[data-login-role]").forEach(tab => {
  tab.addEventListener("click", () => {
    const role = tab.dataset.loginRole;
    document.querySelectorAll("[data-login-role]").forEach(item => item.classList.toggle("is-active", item === tab));
    document.getElementById("loginRole").value = role;
    document.getElementById("loginTitle").textContent = role === "admin" ? "Admin login" : "Customer login";
    document.getElementById("loginSubtitle").textContent = role === "admin"
      ? "Restricted access for store administrators."
      : "Sign in with your registered customer account.";
    document.getElementById("loginSubmit").textContent = role === "admin" ? "Sign in as administrator" : "Sign in as customer";
    message.className = "auth-message";
  });
});

document.getElementById("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const data = await sendAuth("/api/auth/login", {
      email: event.currentTarget.email.value,
      password: event.currentTarget.password.value,
      loginAs: event.currentTarget.loginRole.value
    });
    showMessage("Signed in successfully. Redirecting…", "success");
    location.href = destinationFor(data.user);
  } catch (error) {
    showMessage(error.message);
    button.disabled = false;
  }
});

document.getElementById("registerForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.password.value !== form.confirmPassword.value) return showMessage("Passwords do not match.");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const data = await sendAuth("/api/auth/register", {
      name: form.name.value, email: form.email.value, password: form.password.value
    });
    showMessage("Account created successfully. Redirecting…", "success");
    location.href = destinationFor(data.user);
  } catch (error) {
    showMessage(error.message);
    button.disabled = false;
  }
});
