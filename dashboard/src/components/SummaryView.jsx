import { StatCard } from "./StatCard";
import { YearSummaryGrid } from "./YearSummaryGrid";
import { YearBlock } from "./YearBlock";

export function SummaryView({
  dynamicSummary,
  activeYear,
  activeTrip,
  activeTripLabel,
  isYearFilterDisabled,
  tripScopedYears,
  filteredYears,
  onSelectYear
}) {
  return (
    <>
      <section className="stats-grid">
        <StatCard
          label={activeYear === "all" ? "Total vacation days" : `Vacation days in ${activeYear}`}
          value={dynamicSummary.totalVacationDays}
          hint={activeTrip === "all" ? (activeYear === "all" ? "All recorded trips" : "Selected yearly view") : activeTripLabel}
        />
        <StatCard label="Trips" value={dynamicSummary.totalTrips} />
        <StatCard label="Cities" value={dynamicSummary.uniqueCities?.length || 0} />
        <StatCard label="Countries" value={dynamicSummary.uniqueCountries?.length || 0} />
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
        <YearSummaryGrid
          years={tripScopedYears}
          activeYear={activeYear}
          onSelectYear={onSelectYear}
          disabled={isYearFilterDisabled}
          totals={dynamicSummary}
        />
      </section>

      {filteredYears.length === 0 ? <p className="status">No data matches the selected trip and year.</p> : null}

      {filteredYears.map((yearItem) => (
        <YearBlock key={yearItem.year} yearItem={yearItem} />
      ))}
    </>
  );
}
