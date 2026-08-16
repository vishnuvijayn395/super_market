async function loadSessionUi() {
  const accountLink = document.getElementById("accountLink");
  const registerLink = document.getElementById("registerLink");
  if (!accountLink) return;
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    accountLink.textContent = data.user.role === "admin" ? `🛠 Admin · ${data.user.name}` : `👤 ${data.user.name}`;
    accountLink.href = data.user.role === "admin" ? "admin.html" : "user.html";
    if (registerLink) registerLink.hidden = true;
  } catch {
    accountLink.textContent = "👤 Login";
    accountLink.href = "login.html";
    if (registerLink) registerLink.hidden = false;
  }
}
loadSessionUi();
