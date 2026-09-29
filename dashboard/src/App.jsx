import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Toolbar } from "./components/Toolbar";
import { ViewNav } from "./components/ViewNav";
import { DashboardSkeleton } from "./components/Skeleton";
import { Icon } from "./components/Icon";
import { FinanceView } from "./components/FinanceView";
import { SummaryView } from "./components/SummaryView";
import { AuditView } from "./components/AuditView";
import { calculateTripExpenseSnapshot, createEmptyExpenseCategories } from "./lib/expenses.js";
import { yearsFromData, tripsFromData, filterYearItemByTrip, summaryFromYears } from "./lib/yearSummary.js";
import { fetchExpenseEntries } from "./lib/api.js";

export function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("finance");
  const [activeYear, setActiveYear] = useState("all");
  const [activeTrip, setActiveTrip] = useState("all");
  const [expenseTripSlug, setExpenseTripSlug] = useState("");
  const [allLiveEntries, setAllLiveEntries] = useState([]);
  const [liveExpenseLoading, setLiveExpenseLoading] = useState(false);
  const [liveExpenseError, setLiveExpenseError] = useState("");
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

  useEffect(() => {
    if (activeView === "finance" && activeYear !== "all") {
      setActiveYear("all");
    }
  }, [activeView, activeYear]);

  const years = useMemo(() => yearsFromData(data), [data]);
  const trips = useMemo(() => tripsFromData(data), [data]);

  const tripScopedYears = useMemo(() => {
    return years.map((item) => filterYearItemByTrip(item, activeTrip, allLiveEntries)).filter(Boolean);
  }, [activeTrip, allLiveEntries, years]);

  const filteredYears = useMemo(() => {
    return activeYear === "all" ? tripScopedYears : tripScopedYears.filter((item) => String(item.year) === String(activeYear));
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
      expenseCategories: createEmptyExpenseCategories(),
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

  const sortedLiveExpenseEntries = useMemo(() => {
    return [...liveExpenseEntries].reverse();
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

  function changeView(view) {
    setActiveView(view);
    // The view switcher is a fixed bottom bar on phones, so it's usually tapped from far down the page.
    window.scrollTo({ top: 0 });
  }

  function addLiveEntry(entry) {
    setAllLiveEntries((current) => [...current, entry]);
  }

  function updateLiveEntry(entry) {
    setAllLiveEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)));
  }

  function removeLiveEntry(entryId) {
    setAllLiveEntries((current) => current.filter((item) => item.id !== entryId));
  }

  if (loading || error) {
    return (
      <>
        <Header />
        <main className="container" id="main">
          <div className="page-intro">
            <h1>Travel Dashboard</h1>
          </div>
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <div className="empty-state error-state" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                <Icon name="refresh" size={18} />
                Try again
              </button>
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />

      <main className="container" id="main" tabIndex={-1}>
        <div className="page-intro">
          <div>
            <h1>Travel Dashboard</h1>
            <p>Vacation time, spend and trips across the years.</p>
          </div>
          <ViewNav activeView={activeView} onChangeView={changeView} />
        </div>

        <Toolbar
          activeView={activeView}
          trips={trips}
          activeTrip={activeTrip}
          onChangeTrip={setActiveTrip}
          years={years}
          activeYear={activeYear}
          onChangeYear={setActiveYear}
          isYearFilterDisabled={isYearFilterDisabled}
        />

        {activeView === "finance" ? (
          <FinanceView
            trips={trips}
            selectedExpenseTripSlug={selectedExpenseTripSlug}
            onChangeTripSlug={setExpenseTripSlug}
            tripSelectDisabled={activeTrip !== "all"}
            selectedExpenseTrip={selectedExpenseTrip}
            snapshot={selectedExpenseSnapshot}
            entries={sortedLiveExpenseEntries}
            liveLoading={liveExpenseLoading}
            liveError={liveExpenseError}
            addLiveEntry={addLiveEntry}
            updateLiveEntry={updateLiveEntry}
            removeLiveEntry={removeLiveEntry}
            dynamicSummary={dynamicSummary}
            activeYear={activeYear}
            activeTripLabel={activeTripLabel}
          />
        ) : null}

        {activeView === "summary" ? (
          <SummaryView
            dynamicSummary={dynamicSummary}
            activeYear={activeYear}
            activeTrip={activeTrip}
            activeTripLabel={activeTripLabel}
            isYearFilterDisabled={isYearFilterDisabled}
            tripScopedYears={tripScopedYears}
            filteredYears={filteredYears}
            onSelectYear={setActiveYear}
          />
        ) : null}

        {activeView === "audit" ? <AuditView /> : null}
      </main>
    </>
  );
}
