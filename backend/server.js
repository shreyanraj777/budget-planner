// server.js (backend)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// simple JSON persistence files inside backend folder
const USERS_FILE = path.join(__dirname, "users.json");
const MONTHS_FILE = path.join(__dirname, "months.json");

// ensure files exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(MONTHS_FILE)) fs.writeFileSync(MONTHS_FILE, JSON.stringify([]));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
  } catch (e) {
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ---------- AUTH ---------- */

// Register
app.post("/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "email & password required" });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ message: "User already exists" });
  }
  users.push({ email, password });
  writeJSON(USERS_FILE, users);
  return res.json({ message: "Registered" });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "email & password required" });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  return res.json({ message: "Login OK", user: { email: user.email } });
});

/* ---------- MONTHS (per-user) ---------- */

// Save a month for a user
// Body: { email, month } where month is the month object (salary, savingGoal, needs, wants, wantBalance, month number)
app.post("/save-month", (req, res) => {
  const { email, month } = req.body;
  if (!email || !month) return res.status(400).json({ message: "email and month required" });

  const monthsData = readJSON(MONTHS_FILE); // array of { email, months: [] }
  let userEntry = monthsData.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!userEntry) {
    userEntry = { email, months: [] };
    monthsData.push(userEntry);
  }
  month.createdAt = month.createdAt || new Date().toISOString();
  userEntry.months.push(month);
  writeJSON(MONTHS_FILE, monthsData);
  return res.json({ message: "Saved", month });
});

// Get months for a user
app.get("/get-months/:email", (req, res) => {
  const email = req.params.email;
  if (!email) return res.status(400).json({ message: "email required" });

  const monthsData = readJSON(MONTHS_FILE);
  const userEntry = monthsData.find(e => e.email.toLowerCase() === email.toLowerCase());
  return res.json({ months: userEntry ? userEntry.months : [] });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
