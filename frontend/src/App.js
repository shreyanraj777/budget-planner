// App.js
// Final version: History has NO chart (text-only), dates included, Setup editable, no Syncing UI.

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Chart from "chart.js/auto";
import "./App.css";

const API = "http://localhost:5000";

export default function App() {
  // ========== AUTH ==========
  useEffect(() => {
    const u = localStorage.getItem("bp_user");
    if (!u) window.location.href = "/login.html";
  }, []);
  const user = JSON.parse(localStorage.getItem("bp_user") || "null");

  // ========== CONSTANTS ==========
  const needCategories = [
    "EMI",
    "Groceries",
    "Rent",
    "Stationaries",
    "Fees",
    "Medicines",
    "Transport",
    "Current Bill",
    "Wifi Bill",
    "Phone Bill",
    "Clothes",
    "Accessories",
    "Trip",
  ];

  // ========== STATE ==========
  // current month
  const [salary, setSalary] = useState("");
  const [savingGoal, setSavingGoal] = useState("");
  const [needs, setNeeds] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [wantBalance, setWantBalance] = useState(0);

  // history
  const [months, setMonths] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);

  // ui
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState("Dashboard");
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("bp_theme") === "dark"
  );

  // track if user edited salary/savingGoal (so load() won’t overwrite)
  const hasEditedSetupRef = useRef(false);

  // charts for Dashboard only
  const needsChartRef = useRef(null);
  const pieChartRef = useRef(null);

  // helpers
  const sumNeeds = (obj) =>
    Object.values(obj || {}).reduce((sum, v) => sum + Number(v || 0), 0);
  const sumTrans = (arr) =>
    (arr || []).reduce((sum, v) => sum + Number(v || 0), 0);

  // ========== THEME ==========
  useEffect(() => {
    const root = document.body;
    if (isDark) {
      root.classList.add("bp-dark");
      root.classList.remove("bp-light");
    } else {
      root.classList.add("bp-light");
      root.classList.remove("bp-dark");
    }
    localStorage.setItem("bp_theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // ========== LOAD MONTHS (NO OVERWRITE AFTER EDIT) ==========
  useEffect(() => {
    async function load() {
      if (!user || !user.email) return;
      try {
        const res = await axios.get(
          `${API}/get-months/${encodeURIComponent(user.email)}`
        );
        const saved = res.data.months || [];
        setMonths(saved);
        setCurrentMonth((saved?.length || 0) + 1);

        if (saved.length > 0 && !hasEditedSetupRef.current) {
          const last = saved[saved.length - 1];
          if (last.salary != null) setSalary(String(last.salary));
          if (last.savingGoal != null) setSavingGoal(String(last.savingGoal));
        }
      } catch (e) {
        console.warn("load months failed", e);
      }
    }
    load();
  }, [user]);

  // ========== LOCAL BACKUP ==========
  useEffect(() => {
    const data = {
      salary,
      savingGoal,
      needs,
      wantBalance,
      transactions,
      months,
      currentMonth,
    };
    localStorage.setItem("bp_local_data", JSON.stringify(data));
  }, [salary, savingGoal, needs, wantBalance, transactions, months, currentMonth]);

  // ========== LIVE WANT BALANCE ==========
  useEffect(() => {
    const s = Number(salary) || 0;
    const g = Number(savingGoal) || 0;
    const totalNeeds = sumNeeds(needs);
    const spentWants = sumTrans(transactions);
    const computed = s - g - totalNeeds - spentWants;
    setWantBalance(Number.isFinite(computed) ? computed : 0);
  }, [salary, savingGoal, needs, transactions]);

  // ========== HANDLERS ==========
  const applySetup = () => {
    setError("");
    const s = Number(salary) || 0;
    const g = Number(savingGoal) || 0;

    if (!s || s <= 0) {
      setError("Enter a valid salary.");
      return;
    }
    if (g > s) {
      setError("Saving goal cannot exceed salary.");
      return;
    }

    const totalNeeds = sumNeeds(needs);
    const totalWants = sumTrans(transactions);
    setWantBalance(s - g - totalNeeds - totalWants);
  };

  const updateNeed = (category, value) => {
    setError("");
    const newVal = Number(value) || 0;
    const next = { ...needs, [category]: newVal };

    const s = Number(salary) || 0;
    const g = Number(savingGoal) || 0;
    if (sumNeeds(next) > s - g) {
      setError("Total needs exceed available funds after savings.");
      return;
    }
    setNeeds(next);
  };

  const addTransaction = (amount) => {
    setError("");
    const n = Number(amount) || 0;
    if (n <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (n > wantBalance) {
      setError("Not enough wants balance.");
      return;
    }
    setTransactions((prev) => [...prev, n]);
  };

  const saveMonth = async () => {
    setError("");
    const payload = {
      month: currentMonth,
      salary: Number(salary) || 0,
      savingGoal: Number(savingGoal) || 0,
      needs,
      wants: transactions,
      wantBalance,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await axios.post(`${API}/save-month`, {
        email: user.email,
        month: payload,
      });
    } catch (e) {
      console.warn("save-month failed", e);
    } finally {
      setMonths((prev) => [...prev, payload]);
      setCurrentMonth((m) => m + 1);
      setNeeds({});
      setTransactions([]);
      setWantBalance(
        Number(salary || 0) - Number(savingGoal || 0) || 0
      );
      setIsSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("bp_user");
    window.location.href = "/login.html";
  };

  // ========== DASHBOARD CHARTS (ONLY PLACE WE USE CHARTS) ==========
  useEffect(() => {
    if (currentTab !== "Dashboard") {
      if (needsChartRef.current) {
        needsChartRef.current.destroy();
        needsChartRef.current = null;
      }
      if (pieChartRef.current) {
        pieChartRef.current.destroy();
        pieChartRef.current = null;
      }
      return;
    }

    // Needs bar chart
    const labels = needCategories;
    const needsData = labels.map((l) => Number(needs[l] || 0));

    try {
      if (needsChartRef.current) needsChartRef.current.destroy();
      const ctx = document.getElementById("needsChart");
      if (ctx) {
        needsChartRef.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Needs (₹)",
                data: needsData,
                backgroundColor: labels.map(() => "#22c55e"),
                borderColor: labels.map(() => "#15803d"),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.8,
                categoryPercentage: 0.9,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                ticks: { color: isDark ? "#e5e7eb" : "#374151" },
                grid: { display: false },
                offset: true,
              },
              y: {
                ticks: { color: isDark ? "#e5e7eb" : "#374151" },
                beginAtZero: true,
              },
            },
          },
        });
      }
    } catch (e) {
      console.warn("needs chart error", e);
    }

    // Pie chart (current month breakdown)
    try {
      if (pieChartRef.current) pieChartRef.current.destroy();
      const needsTotal = sumNeeds(needs);
      const wantsSpent = sumTrans(transactions);
      const savingsVal = Number(savingGoal) || 0;
      const ctx2 = document.getElementById("pieChart");
      if (ctx2) {
        pieChartRef.current = new Chart(ctx2, {
          type: "pie",
          data: {
            labels: ["Needs", "Wants Spent", "Savings Goal"],
            datasets: [
              {
                data: [needsTotal, wantsSpent, savingsVal],
                backgroundColor: ["#22c55e", "#3b82f6", "#f97316"],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: isDark ? "#e5e7eb" : "#374151" },
              },
            },
          },
        });
      }
    } catch (e) {
      console.warn("pie chart error", e);
    }
  }, [needs, transactions, savingGoal, isDark, currentTab]);

  const selectedMonth =
    selectedMonthIndex !== null && months[selectedMonthIndex]
      ? months[selectedMonthIndex]
      : null;

  // ========== TAB RENDERERS ==========
  const renderDashboardTab = () => (
    <div className="row g-3">
      <div className="col-lg-5">
        <section className="bp-card">
          <h5 className="bp-section-title mb-2">Summary</h5>
          <div className="bp-summary-grid">
            <div className="bp-summary-box">
              <span className="bp-summary-label">Salary</span>
              <span className="bp-summary-value">₹{salary || 0}</span>
            </div>
            <div className="bp-summary-box">
              <span className="bp-summary-label">Saving Goal</span>
              <span className="bp-summary-value">₹{savingGoal || 0}</span>
            </div>
            <div className="bp-summary-box">
              <span className="bp-summary-label">Needs Total</span>
              <span className="bp-summary-value">₹{sumNeeds(needs)}</span>
            </div>
            <div className="bp-summary-box">
              <span className="bp-summary-label">Wants Spent</span>
              <span className="bp-summary-value">₹{sumTrans(transactions)}</span>
            </div>
          </div>
        </section>

        <section className="bp-card">
          <h5 className="bp-section-title mb-2">Savings Snapshot</h5>
          <p className="small mb-1">
            <b>Locked Savings:</b> ₹{savingGoal || 0}
          </p>
          <p className="small mb-1">
            <b>Wants Balance:</b> ₹{wantBalance}
          </p>
          <p className="small text-muted">
            Tip: Adjust needs carefully to keep your wants and savings healthy.
          </p>
        </section>
      </div>

      <div className="col-lg-7">
        <section className="bp-card">
          <h5 className="bp-section-title mb-2">Visual Breakdown</h5>
          <div className="chart-box mb-3">
            <canvas id="needsChart"></canvas>
          </div>
          <div className="chart-box">
            <canvas id="pieChart"></canvas>
          </div>
        </section>
      </div>
    </div>
  );

  const renderSetupTab = () => (
    <div className="row g-3">
      <div className="col-12">
        <section className="bp-card">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="bp-section-title">Setup</h5>
            <span className="bp-mini-label">Start here</span>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label bp-label">Salary</label>
              <input
                type="number"
                className="form-control bp-input"
                value={salary}
                onChange={(e) => {
                  hasEditedSetupRef.current = true;
                  setSalary(e.target.value);
                }}
                placeholder="e.g. 30000"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label bp-label">Saving Goal</label>
              <input
                type="number"
                className="form-control bp-input"
                value={savingGoal}
                onChange={(e) => {
                  hasEditedSetupRef.current = true;
                  setSavingGoal(e.target.value);
                }}
                placeholder="e.g. 10000"
              />
            </div>
            <div className="col-md-4 d-flex justify-content-end">
              <button className="btn btn-emerald w-100" onClick={applySetup}>
                Apply Plan
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="col-12">
        <section className="bp-card">
          <h5 className="bp-section-title mb-2">Needs</h5>
          <div className="row g-3">
            {needCategories.map((c) => (
              <div className="col-6 col-md-4" key={c}>
                <label className="form-label bp-label small">{c}</label>
                <input
                  type="number"
                  className="form-control bp-input"
                  value={needs[c] || ""}
                  onChange={(e) => updateNeed(c, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  const renderTransactionsTab = () => (
    <div className="row g-3">
      <div className="col-12">
        <section className="bp-card">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="bp-section-title">Wants & Transactions</h5>
            <span className="bp-tag">Wants Balance: ₹{wantBalance}</span>
          </div>
          <div className="d-flex gap-2 align-items-center mb-3">
            <input
              id="wantInput"
              type="number"
              placeholder="Enter amount"
              className="form-control bp-input w-25"
            />
            <button
              className="btn btn-emerald"
              onClick={() => {
                const v = document.getElementById("wantInput").value;
                addTransaction(v);
                document.getElementById("wantInput").value = "";
              }}
            >
              Add Transaction
            </button>
          </div>
          {transactions.length === 0 ? (
            <p className="text-muted small mb-0">No want transactions yet.</p>
          ) : (
            <ul className="list-group small bp-list">
              {transactions.map((t, i) => (
                <li
                  key={i}
                  className="list-group-item d-flex justify-content-between"
                >
                  <span>Transaction {i + 1}</span>
                  <span>₹{t}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="col-12 text-center">
        <button
          className="btn btn-emerald px-4"
          onClick={saveMonth}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Current Month"}
        </button>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <>
      {/* Chart card REMOVED – text-only history below */}
      <section className="bp-card mt-1">
        <h5 className="bp-section-title mb-2">Previous Months (Details)</h5>
        {months.length === 0 ? (
          <p className="text-muted small mb-0">
            Start by saving this month to build history.
          </p>
        ) : (
          <>
            <div className="row g-3 mb-2">
              {months.map((m, i) => (
                <div className="col-md-6" key={i}>
                  <div
                    className="bp-month-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedMonthIndex(i)}
                  >
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">
                        Month {m.month}{" "}
                      </span>
                      <span className="bp-month-date">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bp-month-row small text-muted">
                      Date:{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                    <div className="bp-month-row">
                      Salary: <b>₹{m.salary}</b>
                    </div>
                    <div className="bp-month-row">
                      Saving Goal: <b>₹{m.savingGoal}</b>
                    </div>
                    <div className="bp-month-row">
                      Needs Total: <b>₹{sumNeeds(m.needs)}</b>
                    </div>
                    <div className="bp-month-row">
                      Wants Spent: <b>₹{sumTrans(m.wants)}</b>
                    </div>
                    <div className="bp-month-row">
                      Wants Left: <b>₹{m.wantBalance}</b>
                    </div>
                    <div className="bp-month-row small text-muted">
                      Click for full breakdown
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedMonth && (
              <div className="bp-detail-panel mt-2">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">
                    Detailed view – Month {selectedMonth.month}
                  </h6>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setSelectedMonthIndex(null)}
                  >
                    Close
                  </button>
                </div>
                <p className="small mb-2">
                  <b>Date:</b>{" "}
                  {new Date(selectedMonth.createdAt).toLocaleString()}
                </p>
                <div className="row g-3">
                  <div className="col-md-4">
                    <p className="small mb-1">
                      <b>Salary:</b> ₹{selectedMonth.salary}
                    </p>
                    <p className="small mb-1">
                      <b>Saving Goal:</b> ₹{selectedMonth.savingGoal}
                    </p>
                    <p className="small mb-1">
                      <b>Needs Total:</b> ₹{sumNeeds(selectedMonth.needs)}
                    </p>
                    <p className="small mb-1">
                      <b>Wants Spent:</b> ₹{sumTrans(selectedMonth.wants)}
                    </p>
                    <p className="small mb-1">
                      <b>Wants Left:</b> ₹{selectedMonth.wantBalance}
                    </p>
                  </div>
                  <div className="col-md-4">
                    <h6 className="small fw-semibold mb-1">
                      Needs by category
                    </h6>
                    <ul className="small mb-0">
                      {needCategories.map((c) => {
                        const v = Number(
                          (selectedMonth.needs || {})[c] || 0
                        );
                        if (!v) return null;
                        return (
                          <li key={c}>
                            {c}: ₹{v}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <h6 className="small fw-semibold mb-1">
                      Want transactions
                    </h6>
                    {!selectedMonth.wants ||
                    selectedMonth.wants.length === 0 ? (
                      <p className="small text-muted mb-0">
                        No wants recorded.
                      </p>
                    ) : (
                      <ul className="small mb-0">
                        {selectedMonth.wants.map((w, idx) => (
                          <li key={idx}>
                            Txn {idx + 1}: ₹{w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );

  // ========== MAIN JSX ==========
  return (
    <div className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      {/* HEADER */}
      <header className="bp-header d-flex align-items-center justify-content-between px-4">
        <div className="d-flex align-items-center gap-2">
          <span className="bp-logo">🌿</span>
          <div>
            <div className="fw-semibold">BudgetPlanner</div>
            <div className="bp-subtitle">Plan • Save • Spend smarter</div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-3 header-right">
          <div className="bp-user text-truncate">
            <span className="bp-pill">Logged in</span>{" "}
            <span className="bp-user-email">{user?.email}</span>
          </div>

          <span className="bp-chip">{`Current month: ${currentMonth}`}</span>

          <button
            className="bp-icon-btn"
            onClick={toggleTheme}
            title="Toggle dark mode"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
          <button className="btn btn-outline-light bp-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="bp-hero px-4 py-4">
        <div className="bp-hero-inner">
          <div className="bp-hero-left">
            <h1 className="bp-hero-title">
              <span>Take control of your money.</span>
              <span className="bp-hero-highlight">
                Plan every month with clarity.
              </span>
            </h1>
            <p className="bp-hero-text">
              Stop guessing where your salary goes. BudgetPlanner helps you lock
              savings, organise needs, and track wants — all in one simple view.
            </p>
          </div>
          <div className="bp-hero-right">
            <div className="bp-hero-card">
              <p className="bp-hero-card-title">Quick glance</p>
              <div className="bp-hero-card-grid">
                <div>
                  <span className="bp-mini-label">Salary</span>
                  <div className="bp-hero-stat">₹{salary || 0}</div>
                </div>
                <div>
                  <span className="bp-mini-label">Saving goal</span>
                  <div className="bp-hero-stat">₹{savingGoal || 0}</div>
                </div>
                <div>
                  <span className="bp-mini-label">Needs total</span>
                  <div className="bp-hero-stat">₹{sumNeeds(needs)}</div>
                </div>
                <div>
                  <span className="bp-mini-label">Wants spent</span>
                  <div className="bp-hero-stat">
                    ₹{sumTrans(transactions)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="bp-main px-4 pb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
          <h2 className="bp-title mb-2 mb-md-0">Monthly Budget Overview</h2>
          <span className="bp-chip">{`Months saved: ${months.length}`}</span>
        </div>

        <div className="bp-tabs mb-3">
          {["Dashboard", "Setup", "Transactions", "History"].map((tab) => (
            <button
              key={tab}
              className={
                "bp-tab" + (currentTab === tab ? " bp-tab-active" : "")
              }
              onClick={() => setCurrentTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        {currentTab === "Dashboard" && renderDashboardTab()}
        {currentTab === "Setup" && renderSetupTab()}
        {currentTab === "Transactions" && renderTransactionsTab()}
        {currentTab === "History" && renderHistoryTab()}
      </main>
    </div>
  );
}
