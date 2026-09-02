import { useEffect, useMemo, useState } from "react";

const EXPENSE_LABELS = {
  flights: "Flights",
  hotel: "Hotel",
  food: "Food",
  entertainment: "Entertainment"
};

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

function filterYearItemByTrip(yearItem, tripSlug) {
  if (tripSlug === "all") {
    return yearItem;
  }

  const trip = (yearItem.trips || []).find((item) => item.slug === tripSlug);
  if (!trip) {
    return null;
  }

  const cities = [...new Set(trip.cities || [])].sort();
  const countries = extractCountriesFromCities(cities);
  const tripCount = 1;
  const trackedTripCount = trip.expenses?.isTracked ? 1 : 0;
  const totalTrackedSpend = trip.expenses?.total || 0;
  const totalPerPersonSpend = trip.expenses?.totalPerPerson || 0;
  const partySize = trip.expenses?.partySize || 2;

  return {
    ...yearItem,
    totalVacationDays: trip.vacationDays,
    totalTrackedSpend,
    totalPerPersonSpend,
    expenseCategories: trip.expenses?.categories || { flights: 0, hotel: 0, food: 0, entertainment: 0 },
    expenseCurrency: trip.expenses?.baseCurrency || null,
    partySizes: trip.expenses?.isTracked ? [partySize] : [],
    trackedTripCount,
    averageSpendPerTrip: trackedTripCount > 0 ? totalTrackedSpend : 0,
    averagePerPersonSpendPerTrip: trackedTripCount > 0 ? totalPerPersonSpend : 0,
    averageSpendPerDay: trip.vacationDays > 0 ? Math.round((totalTrackedSpend / trip.vacationDays) * 100) / 100 : 0,
    averagePerPersonSpendPerDay:
      trip.vacationDays > 0 ? Math.round((totalPerPersonSpend / trip.vacationDays) * 100) / 100 : 0,
    tripCount,
    cityCount: cities.length,
    countryCount: countries.length,
    cities,
    countries,
    trips: [trip]
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
    if (activeTrip !== "all" && activeYear !== "all") {
      setActiveYear("all");
    }
  }, [activeTrip, activeYear]);

  const years = useMemo(() => yearsFromData(data), [data]);
  const trips = useMemo(() => tripsFromData(data), [data]);

  const tripScopedYears = useMemo(() => {
    return years.map((item) => filterYearItemByTrip(item, activeTrip)).filter(Boolean);
  }, [activeTrip, years]);

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
      return overallSummary;
    }
    return summaryFromYears(filteredYears.length > 0 ? filteredYears : tripScopedYears);
  }, [activeTrip, activeYear, filteredYears, overallSummary, tripScopedYears]);

  const activeTripLabel = useMemo(() => {
    if (activeTrip === "all") {
      return "All trips";
    }
    return trips.find((trip) => trip.slug === activeTrip)?.title || "Selected trip";
  }, [activeTrip, trips]);

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

