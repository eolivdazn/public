import { useEffect, useMemo, useState } from "react";

function card(label, value) {
  return (
    <article className="stat-card" key={label}>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </article>
  );
}

function yearsFromData(data) {
  return Array.isArray(data?.years) ? data.years : [];
}

export function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  const years = useMemo(() => yearsFromData(data), [data]);

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

  const summary = data?.summary || {
    totalVacationDays: 0,
    totalTrips: 0,
    uniqueCities: [],
    uniqueCountries: []
  };

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Travel Dashboard</h1>
          <p>
            Yearly totals are calculated using inclusive day counting between each trip start and end date.
          </p>
        </div>
        <a className="back-link" href="../index.html">
          Back to trip pages
        </a>
      </header>

      <section className="stats-grid">
        {card("Total vacation days", summary.totalVacationDays)}
        {card("Trips", summary.totalTrips)}
        {card("Unique cities", summary.uniqueCities?.length || 0)}
        {card("Unique countries", summary.uniqueCountries?.length || 0)}
      </section>

      {years.length === 0 && <p className="status">No years found in the trip metadata.</p>}

      {years.map((yearItem) => (
        <section className="year-block" key={yearItem.year}>
          <div className="year-header">
            <div>
              <h2>{yearItem.year}</h2>
              <p>
                {yearItem.totalVacationDays} vacation days - {yearItem.tripCount} trips
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

