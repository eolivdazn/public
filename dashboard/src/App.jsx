import { useEffect, useMemo, useState } from "react";

const EXPENSE_LABELS = {
  flights: "Flights",
  hotel: "Hotel",
  food: "Food",
  entertainment: "Entertainment"
};

const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_LABELS).map(([value, label]) => ({ value, label }));

function createEmptyExpenseCategories() {
  return {
    flights: 0,
    hotel: 0,
    food: 0,
    entertainment: 0
  };
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function card(label, value, hint) {
  return (
    <article className="stat-card" key={label}>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </article>
  );
}

function yearsFromData(data) {
  return Array.isArray(data?.years) ? data.years : [];
}

function tripsFromData(data) {
  return Array.isArray(data?.trips) ? data.trips : [];
}

function formatCurrency(amount, currency) {
  if (!currency) {
    return amount === 0 ? "—" : String(amount);
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function extractCountriesFromCities(cities) {
  return [...new Set((cities || []).map((city) => city.split(", ").slice(1).join(", ")).filter(Boolean))].sort();
}

function liveEntriesForYear(entries, year) {
  return (entries || []).filter((entry) => new Date(`${entry.date}T00:00:00Z`).getUTCFullYear() === Number(year));
}

function combineTripYearSlice(tripSlice, liveEntriesInYear) {
  const tripLiveEntries = (liveEntriesInYear || []).filter((entry) => entry.tripSlug === tripSlice.slug);
  if (tripLiveEntries.length === 0) {
    return tripSlice;
  }

  const liveSummary = aggregateExpenseEntries(tripLiveEntries);
  const baseExpenses = tripSlice.expenses || {};
  const categories = createEmptyExpenseCategories();
  for (const category of Object.keys(categories)) {
    categories[category] = roundMoney((baseExpenses.categories?.[category] || 0) + (liveSummary.categories[category] || 0));
  }
  const partySize = baseExpenses.partySize || 2;
  const total = roundMoney((baseExpenses.total || 0) + liveSummary.total);

  return {
    ...tripSlice,
    expenses: {
      ...baseExpenses,
      categories,
      total,
      totalPerPerson: partySize > 0 ? roundMoney(total / partySize) : 0
    },
    liveCount: liveSummary.count
  };
}

function summarizeYearTrips(trips) {
  const expenseCategories = createEmptyExpenseCategories();
  let totalTrackedSpend = 0;
  let totalPerPersonSpend = 0;
  let trackedTripCount = 0;
  let expenseCurrency = null;
  const partySizes = [];

  for (const trip of trips) {
    totalTrackedSpend = roundMoney(totalTrackedSpend + (trip.expenses?.total || 0));
    totalPerPersonSpend = roundMoney(totalPerPersonSpend + (trip.expenses?.totalPerPerson || 0));
    for (const category of Object.keys(expenseCategories)) {
      expenseCategories[category] = roundMoney(expenseCategories[category] + (trip.expenses?.categories?.[category] || 0));
    }
    if (trip.expenses?.isTracked) {
      trackedTripCount += 1;
      partySizes.push(trip.expenses.partySize || 2);
      expenseCurrency ||= trip.expenses.baseCurrency || null;
    }
  }

  return { totalTrackedSpend, totalPerPersonSpend, expenseCategories, trackedTripCount, partySizes, expenseCurrency };
}

function filterYearItemByTrip(yearItem, tripSlug, liveEntries) {
  const yearLiveEntries = liveEntriesForYear(liveEntries, yearItem.year);

  if (tripSlug === "all") {
    const combinedTrips = (yearItem.trips || []).map((trip) => combineTripYearSlice(trip, yearLiveEntries));
    const totals = summarizeYearTrips(combinedTrips);

    return {
      ...yearItem,
      totalTrackedSpend: totals.totalTrackedSpend,
      totalPerPersonSpend: totals.totalPerPersonSpend,
      expenseCategories: totals.expenseCategories,
      expenseCurrency: yearItem.expenseCurrency || totals.expenseCurrency,
      averageSpendPerTrip: yearItem.trackedTripCount > 0 ? roundMoney(totals.totalTrackedSpend / yearItem.trackedTripCount) : 0,
      averagePerPersonSpendPerTrip:
        yearItem.trackedTripCount > 0 ? roundMoney(totals.totalPerPersonSpend / yearItem.trackedTripCount) : 0,
      averageSpendPerDay: yearItem.totalVacationDays > 0 ? roundMoney(totals.totalTrackedSpend / yearItem.totalVacationDays) : 0,
      averagePerPersonSpendPerDay:
        yearItem.totalVacationDays > 0 ? roundMoney(totals.totalPerPersonSpend / yearItem.totalVacationDays) : 0,
      trips: combinedTrips
    };
  }

  const trip = (yearItem.trips || []).find((item) => item.slug === tripSlug);
  if (!trip) {
    return null;
  }

  const combinedTrip = combineTripYearSlice(trip, yearLiveEntries);
  const cities = [...new Set(combinedTrip.cities || [])].sort();
  const countries = extractCountriesFromCities(cities);
  const trackedTripCount = combinedTrip.expenses?.isTracked ? 1 : 0;
  const totalTrackedSpend = combinedTrip.expenses?.total || 0;
  const totalPerPersonSpend = combinedTrip.expenses?.totalPerPerson || 0;
  const partySize = combinedTrip.expenses?.partySize || 2;

  return {
    ...yearItem,
    totalVacationDays: combinedTrip.vacationDays,
    totalTrackedSpend,
    totalPerPersonSpend,
    expenseCategories: combinedTrip.expenses?.categories || createEmptyExpenseCategories(),
    expenseCurrency: combinedTrip.expenses?.baseCurrency || null,
    partySizes: combinedTrip.expenses?.isTracked ? [partySize] : [],
    trackedTripCount,
    averageSpendPerTrip: trackedTripCount > 0 ? totalTrackedSpend : 0,
    averagePerPersonSpendPerTrip: trackedTripCount > 0 ? totalPerPersonSpend : 0,
    averageSpendPerDay: combinedTrip.vacationDays > 0 ? roundMoney(totalTrackedSpend / combinedTrip.vacationDays) : 0,
    averagePerPersonSpendPerDay:
      combinedTrip.vacationDays > 0 ? roundMoney(totalPerPersonSpend / combinedTrip.vacationDays) : 0,
    tripCount: 1,
    cityCount: cities.length,
    countryCount: countries.length,
    cities,
    countries,
    trips: [combinedTrip]
  };
}

function summaryFromYears(years) {
  const cities = new Set();
  const countries = new Set();
  const trips = new Set();
  let totalVacationDays = 0;
  let totalTrackedSpend = 0;
  let totalPerPersonSpend = 0;
  let trackedTripCount = 0;
  let expenseCurrency = null;
  const partySizes = new Set();
  const expenseCategories = {
    flights: 0,
    hotel: 0,
    food: 0,
    entertainment: 0
  };

  for (const yearItem of years) {
    totalVacationDays += yearItem.totalVacationDays || 0;
    totalTrackedSpend += yearItem.totalTrackedSpend || 0;
    totalPerPersonSpend += yearItem.totalPerPersonSpend || 0;
    trackedTripCount += yearItem.trackedTripCount || 0;
    expenseCurrency ||= yearItem.expenseCurrency || null;
    for (const partySize of yearItem.partySizes || []) {
      partySizes.add(partySize);
    }
    for (const category of Object.keys(expenseCategories)) {
      expenseCategories[category] += yearItem.expenseCategories?.[category] || 0;
    }
    for (const city of yearItem.cities || []) {
      cities.add(city);
    }
    for (const country of yearItem.countries || []) {
      countries.add(country);
    }
    for (const trip of yearItem.trips || []) {
      trips.add(trip.slug);
    }
  }

  return {
    totalVacationDays,
    totalTrips: trips.size,
    totalTrackedSpend,
    totalPerPersonSpend,
    trackedTripCount,
    expenseCurrency,
    partySizes: [...partySizes].sort((a, b) => a - b),
    expenseCategories,
    averageSpendPerTrip: trackedTripCount > 0 ? Math.round((totalTrackedSpend / trackedTripCount) * 100) / 100 : 0,
    averagePerPersonSpendPerTrip:
      trackedTripCount > 0 ? Math.round((totalPerPersonSpend / trackedTripCount) * 100) / 100 : 0,
    averageSpendPerDay: totalVacationDays > 0 ? Math.round((totalTrackedSpend / totalVacationDays) * 100) / 100 : 0,
    averagePerPersonSpendPerDay:
      totalVacationDays > 0 ? Math.round((totalPerPersonSpend / totalVacationDays) * 100) / 100 : 0,
    uniqueCities: [...cities].sort(),
    uniqueCountries: [...countries].sort()
  };
}

function partySizeLabel(partySizes) {
  if (!partySizes || partySizes.length === 0) {
    return "No shared-cost data";
  }
  if (partySizes.length === 1) {
    return `${partySizes[0]} people`;
  }
  return `Mixed: ${partySizes.join(", ")} people`;
}

function aggregateExpenseEntries(entries) {
  const categories = createEmptyExpenseCategories();
  let total = 0;

  for (const entry of entries || []) {
    const amount = Number(entry.amount) || 0;
    total = roundMoney(total + amount);
    if (Object.prototype.hasOwnProperty.call(categories, entry.category)) {
      categories[entry.category] = roundMoney(categories[entry.category] + amount);
    }
  }

  return {
    count: Array.isArray(entries) ? entries.length : 0,
    total,
    categories
  };
}

function calculateTripExpenseSnapshot(trip, liveEntries) {
  if (!trip) {
    return null;
  }

  const staticCategories = trip.expenses?.categories || createEmptyExpenseCategories();
  const liveSummary = aggregateExpenseEntries(liveEntries);
  const partySize = trip.expenses?.partySize || 2;
  const staticTotal = trip.expenses?.total || 0;
  const combinedCategories = createEmptyExpenseCategories();

  for (const category of Object.keys(combinedCategories)) {
    combinedCategories[category] = roundMoney((staticCategories[category] || 0) + (liveSummary.categories[category] || 0));
  }

  const combinedTotal = roundMoney(staticTotal + liveSummary.total);

  return {
    baseCurrency: trip.expenses?.baseCurrency || null,
    partySize,
    staticCategories,
    staticTotal,
    liveCategories: liveSummary.categories,
    liveCount: liveSummary.count,
    liveTotal: liveSummary.total,
    combinedCategories,
    combinedTotal,
    combinedPerPerson: partySize > 0 ? roundMoney(combinedTotal / partySize) : 0
  };
}

async function fetchExpenseEntries(tripSlug) {
  const url = tripSlug ? `/api/expenses?tripSlug=${encodeURIComponent(tripSlug)}` : "/api/expenses";
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Could not load live expenses (${response.status}).`);
  }

  return Array.isArray(payload?.entries) ? payload.entries : [];
}

function yearSummaryCards(years, activeYear, onSelectYear, disabled) {
  const maxDays = Math.max(...years.map((item) => item.totalVacationDays), 1);

  return years.map((yearItem) => {
    return (
      <button
        className={`year-summary-card${String(activeYear) === String(yearItem.year) ? " is-active" : ""}`}
        key={yearItem.year}
        type="button"
        disabled={disabled}
        onClick={() => onSelectYear(yearItem.year)}
      >
        <div className="year-summary-top">
          <strong>{yearItem.year}</strong>
          <span>{yearItem.totalVacationDays} days</span>
        </div>
        <div className="year-summary-bar">
          <span style={{ width: `${Math.max((yearItem.totalVacationDays / maxDays) * 100, 8)}%` }} />
        </div>
        <p>
          {yearItem.tripCount} trips · {yearItem.cityCount} cities
        </p>
      </button>
    );
  });
}

export function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState("all");
  const [activeTrip, setActiveTrip] = useState("all");
  const [expenseTripSlug, setExpenseTripSlug] = useState("");
  const [expenseForm, setExpenseForm] = useState(() => ({
    category: "food",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: ""
  }));
  const [allLiveEntries, setAllLiveEntries] = useState([]);
  const [liveExpenseLoading, setLiveExpenseLoading] = useState(false);
  const [liveExpenseError, setLiveExpenseError] = useState("");
  const [expenseStatus, setExpenseStatus] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  const [isExpenseSectionOpen, setIsExpenseSectionOpen] = useState(false);
  const isYearFilterDisabled = activeTrip !== "all";

  useEffect(() => {
    let active = true;
    const dataUrl = new URL("../dashboard-data.json", window.location.href).toString();

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load dashboard data (${response.status}).`);
        }
        return response.json();
      })
      .then((payload) => {
        if (active) {
          setData(payload);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Could not load dashboard data.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLiveExpenseLoading(true);
    setLiveExpenseError("");

    fetchExpenseEntries()
      .then((entries) => {
        if (active) {
          setAllLiveEntries(entries);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setAllLiveEntries([]);
          setLiveExpenseError(fetchError.message || "Unable to load live expenses.");
        }
      })
      .finally(() => {
        if (active) {
          setLiveExpenseLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTrip !== "all" && activeYear !== "all") {
      setActiveYear("all");
    }
  }, [activeTrip, activeYear]);

  const years = useMemo(() => yearsFromData(data), [data]);
  const trips = useMemo(() => tripsFromData(data), [data]);

  const tripScopedYears = useMemo(() => {
    return years.map((item) => filterYearItemByTrip(item, activeTrip, allLiveEntries)).filter(Boolean);
  }, [activeTrip, allLiveEntries, years]);

  const filteredYears = useMemo(() => {
    return activeYear === "all"
      ? tripScopedYears
      : tripScopedYears.filter((item) => String(item.year) === String(activeYear));
  }, [activeYear, tripScopedYears]);

  const overallSummary =
    data?.summary ||
    {
      totalVacationDays: 0,
      totalTrips: 0,
      totalTrackedSpend: 0,
      totalPerPersonSpend: 0,
      trackedTripCount: 0,
      expenseCurrency: null,
      partySizes: [],
      expenseCategories: { flights: 0, hotel: 0, food: 0, entertainment: 0 },
      averageSpendPerTrip: 0,
      averagePerPersonSpendPerTrip: 0,
      averageSpendPerDay: 0,
      averagePerPersonSpendPerDay: 0,
      uniqueCities: [],
      uniqueCountries: []
    };

  const dynamicSummary = useMemo(() => {
    if (activeYear === "all" && activeTrip === "all") {
      return tripScopedYears.length > 0 ? summaryFromYears(tripScopedYears) : overallSummary;
    }
    return summaryFromYears(filteredYears.length > 0 ? filteredYears : tripScopedYears);
  }, [activeTrip, activeYear, filteredYears, overallSummary, tripScopedYears]);

  const activeTripLabel = useMemo(() => {
    if (activeTrip === "all") {
      return "All trips";
    }
    return trips.find((trip) => trip.slug === activeTrip)?.title || "Selected trip";
  }, [activeTrip, trips]);

  const selectedExpenseTripSlug = activeTrip !== "all" ? activeTrip : expenseTripSlug;

  const selectedExpenseTrip = useMemo(() => {
    return trips.find((trip) => trip.slug === selectedExpenseTripSlug) || null;
  }, [selectedExpenseTripSlug, trips]);

  const liveExpenseEntries = useMemo(() => {
    return selectedExpenseTripSlug ? allLiveEntries.filter((entry) => entry.tripSlug === selectedExpenseTripSlug) : [];
  }, [allLiveEntries, selectedExpenseTripSlug]);

  const recentLiveExpenseEntries = useMemo(() => {
    return [...liveExpenseEntries].slice(-5).reverse();
  }, [liveExpenseEntries]);

  const selectedExpenseSnapshot = useMemo(
    () => calculateTripExpenseSnapshot(selectedExpenseTrip, liveExpenseEntries),
    [liveExpenseEntries, selectedExpenseTrip]
  );

  useEffect(() => {
    if (!trips.length) {
      return;
    }

    if (activeTrip !== "all") {
      if (expenseTripSlug !== activeTrip) {
        setExpenseTripSlug(activeTrip);
      }
      return;
    }

    if (!expenseTripSlug || !trips.some((trip) => trip.slug === expenseTripSlug)) {
      setExpenseTripSlug(trips[0].slug);
    }
  }, [activeTrip, expenseTripSlug, trips]);

  useEffect(() => {
    if (!selectedExpenseTrip) {
      return;
    }

    setExpenseForm((current) => {
      const currency = selectedExpenseTrip.expenses?.baseCurrency || "EUR";
      return current.date && current.category
        ? {
            ...current,
            description: current.description || "",
            amount: current.amount || "",
            date: current.date,
            category: current.category,
            currency
          }
        : {
            category: "food",
            amount: "",
            date: new Date().toISOString().slice(0, 10),
            description: "",
            currency
          };
    });
  }, [selectedExpenseTrip]);

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    if (!selectedExpenseTrip) {
      setExpenseStatus("Select a trip first.");
      return;
    }

    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setExpenseStatus("Enter a valid amount.");
      return;
    }

    const payload = {
      tripSlug: selectedExpenseTrip.slug,
      category: expenseForm.category,
      amount,
      currency: selectedExpenseTrip.expenses?.baseCurrency || "EUR",
      date: expenseForm.date,
      description: expenseForm.description
    };

    setSavingExpense(true);
    setExpenseStatus("");

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Could not save expense (${response.status}).`);
      }

      if (result?.entry) {
        setAllLiveEntries((current) => [...current, result.entry]);
      }
      setExpenseForm((current) => ({
        ...current,
        amount: "",
        description: "",
        date: new Date().toISOString().slice(0, 10)
      }));
      setExpenseStatus("Expense saved.");
    } catch (submitError) {
      setExpenseStatus(submitError.message || "Could not save expense.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleExpenseDelete(entry) {
    setDeletingEntryId(entry.id);
    setExpenseStatus("");

    try {
      const response = await fetch(
        `/api/expenses?id=${encodeURIComponent(entry.id)}&tripSlug=${encodeURIComponent(entry.tripSlug)}`,
        { method: "DELETE" }
      );
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Could not delete expense (${response.status}).`);
      }

      setAllLiveEntries((current) => current.filter((item) => item.id !== entry.id));
      setExpenseStatus("Expense deleted.");
    } catch (deleteError) {
      setExpenseStatus(deleteError.message || "Could not delete expense.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <h1>Travel Dashboard</h1>
        <p className="status">Loading dashboard data...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <h1>Travel Dashboard</h1>
        <p className="status error">{error}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <div>
          <span className="eyebrow">Interactive overview</span>
          <h1>Travel Dashboard</h1>
          <p>
            Explore total vacation time, compare yearly totals, and focus on a specific trip when needed.
          </p>
        </div>
        <a className="back-link" href="../index.html">
          Back to trip pages
        </a>
      </header>

      <section className="toolbar panel">
        <div className="toolbar-row">
          <div>
            <label className="field-label" htmlFor="year-filter">
              View
            </label>
            <div className="segmented-control" id="year-filter">
              <button
                className={activeYear === "all" ? "is-active" : ""}
                type="button"
                disabled={isYearFilterDisabled}
                onClick={() => setActiveYear("all")}
              >
                Total
              </button>
              {years.map((yearItem) => (
                <button
                  className={String(activeYear) === String(yearItem.year) ? "is-active" : ""}
                  key={yearItem.year}
                  type="button"
                  disabled={isYearFilterDisabled}
                  onClick={() => setActiveYear(yearItem.year)}
                >
                  {yearItem.year}
                </button>
              ))}
            </div>
          </div>

          <div className="trip-filter-block">
            <label className="field-label" htmlFor="trip-filter">
              Trip
            </label>
            <select id="trip-filter" value={activeTrip} onChange={(event) => setActiveTrip(event.target.value)}>
              <option value="all">All trips</option>
              {trips.map((trip) => (
                <option key={trip.slug} value={trip.slug}>
                  {trip.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel expense-accordion">
        <button
          className="expense-toggle-button"
          type="button"
          aria-expanded={isExpenseSectionOpen}
          onClick={() => setIsExpenseSectionOpen((open) => !open)}
        >
          <span>Add / view expenses</span>
          <span className="expense-toggle-icon">{isExpenseSectionOpen ? "−" : "+"}</span>
        </button>

        {isExpenseSectionOpen ? (
          <div className="expense-accordion-body">
            <div className="expense-grid">
              <article className="panel expense-form-panel">
                <div className="section-heading-row">
                  <div>
                    <h2>Add expense</h2>
                    <p className="section-copy">
                      Log food and entertainment during the trip. Static flights and hotel stay in the markdown file.
                    </p>
                  </div>
                </div>

                <form className="expense-form" onSubmit={handleExpenseSubmit}>
                  <div className="expense-form-grid">
                    <label className="expense-field">
                      <span>Trip</span>
                      <select
                        value={selectedExpenseTripSlug || ""}
                        disabled={activeTrip !== "all"}
                        onChange={(event) => setExpenseTripSlug(event.target.value)}
                      >
                        {trips.map((trip) => (
                          <option key={trip.slug} value={trip.slug}>
                            {trip.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="expense-field">
                      <span>Category</span>
                      <select
                        value={expenseForm.category}
                        onChange={(event) =>
                          setExpenseForm((current) => ({ ...current, category: event.target.value }))
                        }
                      >
                        {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="expense-field">
                      <span>Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(event) =>
                          setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </label>

                    <label className="expense-field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="expense-field expense-field-full">
                    <span>Description</span>
                    <textarea
                      rows="3"
                      value={expenseForm.description}
                      onChange={(event) =>
                        setExpenseForm((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Dinner, taxi, museum, coffee..."
                    />
                  </label>

                  <div className="expense-form-actions">
                    <button type="submit" disabled={!selectedExpenseTrip || savingExpense}>
                      {savingExpense ? "Saving..." : "Save expense"}
                    </button>
                    <p className="expense-form-note">
                      {selectedExpenseTrip
                        ? `Currency: ${selectedExpenseTrip.expenses?.baseCurrency || "EUR"} · Party size: ${selectedExpenseTrip.expenses?.partySize || 2}`
                        : "Select a trip to enable the form."}
                    </p>
                  </div>

                  {expenseStatus ? <p className="status success">{expenseStatus}</p> : null}
                </form>
              </article>

              <article className="panel expense-live-panel">
                <div className="section-heading-row">
                  <div>
                    <h2>Live trip expenses</h2>
                    <p className="section-copy">
                      {selectedExpenseTrip ? `Tracking ${selectedExpenseTrip.title}.` : "Pick a trip to load live expenses."}
                    </p>
                  </div>
                </div>

                {selectedExpenseSnapshot ? (
                  <>
                    <ul className="finance-list compact expense-summary-list">
                      <li>
                        <span>Static planned</span>
                        <strong>{formatCurrency(selectedExpenseSnapshot.staticTotal, selectedExpenseSnapshot.baseCurrency)}</strong>
                      </li>
                      <li>
                        <span>Live added</span>
                        <strong>{formatCurrency(selectedExpenseSnapshot.liveTotal, selectedExpenseSnapshot.baseCurrency)}</strong>
                      </li>
                      <li>
                        <span>Combined total</span>
                        <strong>{formatCurrency(selectedExpenseSnapshot.combinedTotal, selectedExpenseSnapshot.baseCurrency)}</strong>
                      </li>
                      <li>
                        <span>Per person</span>
                        <strong>
                          {formatCurrency(selectedExpenseSnapshot.combinedPerPerson, selectedExpenseSnapshot.baseCurrency)}
                        </strong>
                      </li>
                      <li>
                        <span>Live entries</span>
                        <strong>{selectedExpenseSnapshot.liveCount}</strong>
                      </li>
                    </ul>

                    <div className="expense-live-breakdown">
                      {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
                        <div className="expense-breakdown-item" key={key}>
                          <span>{label}</span>
                          <strong>
                            {formatCurrency(
                              selectedExpenseSnapshot.combinedCategories[key] || 0,
                              selectedExpenseSnapshot.baseCurrency
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="expense-entries-header">
                      <h3>Recent entries</h3>
                      {liveExpenseLoading ? <span className="expense-muted">Refreshing...</span> : null}
                    </div>

                    {liveExpenseError ? <p className="status error">{liveExpenseError}</p> : null}

                    {!liveExpenseLoading && !liveExpenseError && recentLiveExpenseEntries.length === 0 ? (
                      <p className="status">No live expenses recorded yet.</p>
                    ) : null}

                    {!liveExpenseLoading && !liveExpenseError && recentLiveExpenseEntries.length > 0 ? (
                      <ul className="expense-entry-list">
                        {recentLiveExpenseEntries.map((entry) => (
                          <li className="expense-entry" key={entry.id}>
                            <div>
                              <strong>{entry.category}</strong>
                              <span>{entry.date}</span>
                              {entry.description ? <p>{entry.description}</p> : null}
                            </div>
                            <div className="expense-entry-actions">
                              <strong>
                                {formatCurrency(entry.amount, entry.currency || selectedExpenseSnapshot.baseCurrency)}
                              </strong>
                              <button
                                type="button"
                                className="expense-entry-delete"
                                disabled={deletingEntryId === entry.id}
                                onClick={() => handleExpenseDelete(entry)}
                                aria-label={`Delete expense: ${entry.category} on ${entry.date}`}
                              >
                                {deletingEntryId === entry.id ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="status">Select a trip to view live expense totals.</p>
                )}
              </article>
            </div>
          </div>
        ) : null}
      </section>

      <section className="stats-grid">
        {card(
          activeYear === "all" ? "Total vacation days" : `Vacation days in ${activeYear}`,
          dynamicSummary.totalVacationDays,
          activeTrip === "all" ? (activeYear === "all" ? "All recorded trips" : "Selected yearly view") : activeTripLabel
        )}
        {card(
          activeYear === "all" ? "Tracked spend" : `Spend in ${activeYear}`,
          formatCurrency(dynamicSummary.totalTrackedSpend || 0, dynamicSummary.expenseCurrency),
          dynamicSummary.trackedTripCount > 0
            ? `${dynamicSummary.trackedTripCount} trip${dynamicSummary.trackedTripCount === 1 ? "" : "s"} with shared costs`
            : "No costs added yet"
        )}
        {card("Trips", dynamicSummary.totalTrips)}
        {card(
          "Per person spend",
          formatCurrency(dynamicSummary.totalPerPersonSpend || 0, dynamicSummary.expenseCurrency),
          partySizeLabel(dynamicSummary.partySizes)
        )}
        {card(
          "Average per trip",
          formatCurrency(dynamicSummary.averageSpendPerTrip || 0, dynamicSummary.expenseCurrency),
          "Group total across tracked trips"
        )}
        {card(
          "Average per day",
          formatCurrency(dynamicSummary.averageSpendPerDay || 0, dynamicSummary.expenseCurrency),
          "Group cost divided by vacation days"
        )}
        {card("Cities", dynamicSummary.uniqueCities?.length || 0)}
        {card("Countries", dynamicSummary.uniqueCountries?.length || 0)}
      </section>

      <section className="year-grid finance-grid">
        <article className="panel">
          <h3>Financial overview</h3>
          <ul className="finance-list">
            {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
              <li key={key}>
                <span>{label}</span>
                <strong>{formatCurrency(dynamicSummary.expenseCategories?.[key] || 0, dynamicSummary.expenseCurrency)}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h3>{activeYear === "all" ? "Overall totals" : `Totals for ${activeYear}`}</h3>
          <ul className="finance-list compact">
            <li>
              <span>Vacation days</span>
              <strong>{dynamicSummary.totalVacationDays}</strong>
            </li>
            <li>
              <span>Trips</span>
              <strong>{dynamicSummary.totalTrips}</strong>
            </li>
            <li>
              <span>Trip filter</span>
              <strong>{activeTripLabel}</strong>
            </li>
            <li>
              <span>Tracked spend</span>
              <strong>{formatCurrency(dynamicSummary.totalTrackedSpend || 0, dynamicSummary.expenseCurrency)}</strong>
            </li>
            <li>
              <span>Per person spend</span>
              <strong>{formatCurrency(dynamicSummary.totalPerPersonSpend || 0, dynamicSummary.expenseCurrency)}</strong>
            </li>
            <li>
              <span>Party size</span>
              <strong>{partySizeLabel(dynamicSummary.partySizes)}</strong>
            </li>
            <li>
              <span>Cost per day</span>
              <strong>{formatCurrency(dynamicSummary.averageSpendPerDay || 0, dynamicSummary.expenseCurrency)}</strong>
            </li>
          </ul>
        </article>
      </section>

      <section className="panel section-stack">
        <div className="section-heading-row">
          <div>
            <h2>Summary by year</h2>
            <p className="section-copy">
              {isYearFilterDisabled
                ? "Year selection is disabled while a trip filter is active. Clear the trip filter to compare years again."
                : "Switch between the total view and a specific year, then optionally narrow the dashboard to one trip."}
            </p>
          </div>
        </div>
        <div className="year-summary-grid">
          <button
            className={`year-summary-card${activeYear === "all" ? " is-active" : ""}`}
            type="button"
            disabled={isYearFilterDisabled}
            onClick={() => setActiveYear("all")}
          >
            <div className="year-summary-top">
              <strong>Total</strong>
              <span>{dynamicSummary.totalVacationDays} days</span>
            </div>
            <div className="year-summary-bar">
              <span style={{ width: "100%" }} />
            </div>
            <p>
              {dynamicSummary.totalTrips} trips · {dynamicSummary.uniqueCities?.length || 0} cities
            </p>
          </button>
          {yearSummaryCards(
            tripScopedYears,
            activeYear,
            setActiveYear,
            isYearFilterDisabled
          )}
        </div>
      </section>

      {filteredYears.length === 0 ? <p className="status">No data matches the selected trip and year.</p> : null}

      {filteredYears.map((yearItem) => (
        <section className="year-block" key={yearItem.year}>
          <div className="year-header">
            <div>
              <h2>{yearItem.year}</h2>
              <p>
                {yearItem.totalVacationDays} vacation days · {yearItem.tripCount} trips
              </p>
            </div>
          </div>

          <div className="year-grid">
            <article className="panel">
              <h3>Cities visited</h3>
              <ul className="tag-list">
                {(yearItem.cities || []).map((city) => (
                  <li key={`${yearItem.year}-${city}`}>{city}</li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h3>Countries visited</h3>
              <ul className="tag-list">
                {(yearItem.countries || []).map((country) => (
                  <li key={`${yearItem.year}-${country}`}>{country}</li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h3>Financials</h3>
              <ul className="finance-list compact">
                <li>
                  <span>Total spend</span>
                  <strong>{formatCurrency(yearItem.totalTrackedSpend || 0, yearItem.expenseCurrency)}</strong>
                </li>
                <li>
                  <span>Per person</span>
                  <strong>{formatCurrency(yearItem.totalPerPersonSpend || 0, yearItem.expenseCurrency)}</strong>
                </li>
                <li>
                  <span>Party size</span>
                  <strong>{partySizeLabel(yearItem.partySizes)}</strong>
                </li>
                {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
                  <li key={`${yearItem.year}-${key}`}>
                    <span>{label}</span>
                    <strong>{formatCurrency(yearItem.expenseCategories?.[key] || 0, yearItem.expenseCurrency)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="panel">
            <h3>Trips in {yearItem.year}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Dates</th>
                    <th>Days in year</th>
                    <th>Spend</th>
                    <th>Per person</th>
                    <th>Cities</th>
                  </tr>
                </thead>
                <tbody>
                  {(yearItem.trips || []).map((trip) => (
                    <tr key={`${yearItem.year}-${trip.slug}`}>
                      <td>
                        <a href={`../${trip.slug}.html`}>{trip.title}</a>
                      </td>
                      <td>
                        {trip.startDate} to {trip.endDate}
                      </td>
                      <td>{trip.vacationDays}</td>
                      <td>{formatCurrency(trip.expenses?.total || 0, trip.expenses?.baseCurrency || yearItem.expenseCurrency)}</td>
                      <td>
                        {formatCurrency(
                          trip.expenses?.totalPerPerson || 0,
                          trip.expenses?.baseCurrency || yearItem.expenseCurrency
                        )}
                      </td>
                      <td>{(trip.cities || []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ))}
    </main>
  );
}

