// public/login.js
const API_BASE = "http://localhost:5000";

function showMsg(text, color = "red") {
  const el = document.getElementById("msg");
  if (!el) return;
  el.style.color = color;
  el.textContent = text;
}

// simple email format check
function isValidEmail(email) {
  // basic pattern: something@something.something
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function registerUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    return showMsg("Enter email & password.");
  }

  // NEW: email format validation
  if (!isValidEmail(email)) {
    return showMsg("Please enter a valid email address.");
  }

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg("Registered — please login.", "green");
    } else {
      showMsg(data.message || "Register failed");
    }
  } catch (err) {
    // fallback: store locally
    const users = JSON.parse(localStorage.getItem("bp_local_users") || "[]");
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      showMsg("User exists (local).");
      return;
    }
    users.push({ email, password });
    localStorage.setItem("bp_local_users", JSON.stringify(users));
    showMsg("Registered locally — please login.", "green");
  }
}

async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    return showMsg("Enter email & password.");
  }

  // NEW: email format validation
  if (!isValidEmail(email)) {
    return showMsg("Please enter a valid email address.");
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      localStorage.setItem("bp_user", JSON.stringify({ email }));
      window.location.href = "/";
      return;
    } else {
      const d = await res.json().catch(() => ({}));
      showMsg(d.message || "Invalid credentials");
    }
  } catch (err) {
    // backend unreachable fallback
    const users = JSON.parse(localStorage.getItem("bp_local_users") || "[]");
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password
    );
    if (user) {
      localStorage.setItem("bp_user", JSON.stringify({ email }));
      window.location.href = "/";
      return;
    }
    showMsg("Server unreachable and no local account found.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");

  if (loginBtn) loginBtn.addEventListener("click", loginUser);
  if (registerBtn) registerBtn.addEventListener("click", registerUser);

  // allow Enter key
  ["email", "password"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loginUser();
    });
  });
});
