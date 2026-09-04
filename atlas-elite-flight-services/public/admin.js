const loginScreen = document.querySelector("#loginScreen");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const bookingList = document.querySelector("#bookingList");
const tokenKey = "aefs_admin_token";

let token = sessionStorage.getItem(tokenKey);
let bookings = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function discordText(b) {
  return [
    "✈️ **ATLAS ELITE FLIGHT REQUEST**",
    "",
    `**Reference:** ${b.id}`,
    "",
    `**Discord:** ${b.discordUsername}`,
    `**Route:** ${b.origin} → ${b.destination}`,
    `**Roblox:** ${b.robloxUsername}`,
    "",
    `**Date:** ${new Date(`${b.flightDate}T00:00:00`).toLocaleDateString(undefined, {month:"long", day:"numeric", year:"numeric"})}`,
    `**Time:** ${b.preferredTime}`,
    `**Passengers:** ${b.passengers}`,
    `**Aircraft:** ${b.aircraft}`,
    "",
    `**Transport:** ${b.transportation}`,
    `**Food:** ${b.catering}`,
    "",
    `**Notes:** ${b.notes || "None provided"}`,
    "",
    `**Status:** ${b.status}`
  ].join("\n");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      "x-admin-token": token || ""
    }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    logout(false);
    throw new Error("Session expired.");
  }
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function updateStats() {
  document.querySelector("#totalStat").textContent = bookings.length;
  document.querySelector("#newStat").textContent = bookings.filter(b => b.status === "New").length;
  document.querySelector("#confirmedStat").textContent = bookings.filter(b => b.status === "Confirmed").length;
}

function renderBookings() {
  updateStats();
  if (!bookings.length) {
    bookingList.innerHTML = `<div class="empty"><strong>No flight requests yet.</strong>New requests will appear here as passengers submit them.</div>`;
    return;
  }

  bookingList.innerHTML = bookings.map(b => `
    <article class="booking-card">
      <div class="booking-card-head">
        <div>
          <div class="ref">${escapeHtml(b.id)}</div>
          <h2>${escapeHtml(b.robloxUsername)}</h2>
          <div style="color:#6f6b64;font-size:9px;text-transform:uppercase;letter-spacing:.1em">Created ${escapeHtml(new Date(b.createdAt).toLocaleString())}</div>
        </div>
        <select class="status-select" data-status-id="${escapeHtml(b.id)}">
          ${["New","Contacted","Confirmed","Completed","Cancelled"].map(s => `<option ${b.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="booking-grid">
        <div class="booking-field"><label>Discord Username</label><div>${escapeHtml(b.discordUsername)}</div></div>
        <div class="booking-field"><label>Roblox Username</label><div>${escapeHtml(b.robloxUsername)}</div></div>
        <div class="booking-field"><label>Origin</label><div>${escapeHtml(b.origin)}</div></div>
        <div class="booking-field"><label>Destination</label><div>${escapeHtml(b.destination)}</div></div>
        <div class="booking-field"><label>Flight</label><div>${escapeHtml(new Date(`${b.flightDate}T00:00:00`).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"}))}<br>${escapeHtml(b.preferredTime)}</div></div>
        <div class="booking-field"><label>Passengers</label><div>${escapeHtml(b.passengers)}</div></div>
        <div class="booking-field"><label>Aircraft</label><div>${escapeHtml(b.aircraft)}</div></div>
        <div class="booking-field"><label>Transport</label><div>${escapeHtml(b.transportation)}</div></div>
        <div class="booking-field"><label>Catering</label><div>${escapeHtml(b.catering)}</div></div>
        <div class="booking-field"><label>Booking Reference</label><div>${escapeHtml(b.id)}</div></div>
        <div class="booking-field"><label>Status</label><div>${escapeHtml(b.status)}</div></div>
        <div class="booking-field notes"><label>Notes</label><div>${escapeHtml(b.notes || "None provided")}</div></div>
      </div>
      <div class="admin-card-actions">
        <button class="copy-button" data-copy-id="${escapeHtml(b.id)}">Copy for Discord</button>
        <button class="delete-button" data-delete-id="${escapeHtml(b.id)}">Delete</button>
      </div>
    </article>
  `).join("");

  bookingList.querySelectorAll("[data-status-id]").forEach(select => {
    select.addEventListener("change", async () => {
      try {
        const updated = await api(`/api/admin/bookings/${encodeURIComponent(select.dataset.statusId)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: select.value })
        });
        const index = bookings.findIndex(b => b.id === updated.id);
        if (index >= 0) bookings[index] = updated;
        renderBookings();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  bookingList.querySelectorAll("[data-copy-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const booking = bookings.find(b => b.id === button.dataset.copyId);
      if (!booking) return;
      try {
        await navigator.clipboard.writeText(discordText(booking));
        const original = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => button.textContent = original, 1400);
      } catch {
        alert("Clipboard access was unavailable. Please copy the message manually.");
      }
    });
  });

  bookingList.querySelectorAll("[data-delete-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const booking = bookings.find(b => b.id === button.dataset.deleteId);
      if (!booking) return;
      if (!confirm(`Delete flight request ${booking.id}? This cannot be undone.`)) return;
      try {
        await api(`/api/admin/bookings/${encodeURIComponent(booking.id)}`, { method: "DELETE" });
        bookings = bookings.filter(b => b.id !== booking.id);
        renderBookings();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

async function loadBookings() {
  bookingList.innerHTML = `<div class="empty"><strong>Loading requests...</strong>Please wait.</div>`;
  try {
    bookings = await api("/api/admin/bookings");
    renderBookings();
  } catch (error) {
    bookingList.innerHTML = `<div class="empty"><strong>Unable to load requests.</strong>${escapeHtml(error.message)}</div>`;
  }
}

function showDashboard() {
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadBookings();
}

function logout(callServer = true) {
  const oldToken = token;
  token = null;
  sessionStorage.removeItem(tokenKey);
  dashboard.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  if (callServer && oldToken) {
    fetch("/api/admin/logout", {
      method: "POST",
      headers: { "x-admin-token": oldToken }
    }).catch(() => {});
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;
  button.innerHTML = "Authenticating <span>…</span>";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ password: document.querySelector("#adminPassword").value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Login failed.");
    token = result.token;
    sessionStorage.setItem(tokenKey, token);
    loginForm.reset();
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = "Enter Operations <span>→</span>";
  }
});

document.querySelector("#refreshBtn").addEventListener("click", loadBookings);
document.querySelector("#logoutBtn").addEventListener("click", () => logout());

if (token) showDashboard();
