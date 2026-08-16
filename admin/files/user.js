let csrfToken = "";
async function loadAccount() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!response.ok) return location.replace("/login.html?next=/user.html");
    const data = await response.json();
    csrfToken = data.csrfToken;
    const user = data.user;
    document.getElementById("customerName").textContent = user.name.split(" ")[0];
    document.getElementById("profileName").textContent = user.name;
    document.getElementById("profileEmail").textContent = user.email;
    document.getElementById("profileAvatar").textContent = user.name.charAt(0).toUpperCase();
    document.getElementById("accessNote").hidden = new URLSearchParams(location.search).get("denied") !== "admin";
  } catch { location.replace("/login.html"); }
}
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrfToken } });
  location.replace("/login.html");
});
loadAccount();
