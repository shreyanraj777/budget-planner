// -------------------------
// Imports
// -------------------------
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// -------------------------
// MongoDB Connection
// -------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✔ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------------
// Schemas
// -------------------------
const UserSchema = new mongoose.Schema(
  {
    email: String,
    password: String,
  },
  { timestamps: true }
);

const MonthSchema = new mongoose.Schema(
  {
    email: String,
    monthData: mongoose.Schema.Types.Mixed, // full month object here
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
const Month = mongoose.model("Month", MonthSchema);

// -------------------------
// Auth Routes
// -------------------------
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "email & password required" });

  const exists = await User.findOne({ email });
  if (exists)
    return res.status(400).json({ message: "User already exists" });

  await User.create({ email, password });
  return res.json({ message: "Registered" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });
  if (!user)
    return res.status(401).json({ message: "Invalid credentials" });

  return res.json({ message: "Login OK", user: { email: user.email } });
});

// -------------------------
// Month Routes
// -------------------------
app.post("/save-month", async (req, res) => {
  const { email, month } = req.body;
  if (!email || !month)
    return res.status(400).json({ message: "email and month required" });

  const doc = await Month.create({
    email,
    monthData: {
      ...month,
      createdAt: month.createdAt || new Date().toISOString(),
    },
  });

  return res.json({ message: "Saved", month: doc.monthData });
});

app.get("/get-months/:email", async (req, res) => {
  const email = req.params.email;

  const docs = await Month.find({ email }).sort({ createdAt: 1 });

  // return just the stored month objects
  const months = docs.map((d) => d.monthData || {});
  return res.json({ months });
});

// -------------------------
// Start Server
// -------------------------
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
