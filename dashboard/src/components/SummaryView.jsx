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
      <section className="stats-grid" aria-label="Travel at a glance">
        <StatCard
          icon="calendar"
          label={activeYear === "all" ? "Vacation days" : `Days in ${activeYear}`}
          value={dynamicSummary.totalVacationDays}
          hint={activeTrip === "all" ? (activeYear === "all" ? "All recorded trips" : "Selected year") : activeTripLabel}
        />
        <StatCard icon="map" label="Trips" value={dynamicSummary.totalTrips} />
        <StatCard icon="building" label="Cities" value={dynamicSummary.uniqueCities?.length || 0} />
        <StatCard icon="globe" label="Countries" value={dynamicSummary.uniqueCountries?.length || 0} />
      </section>

      <section className="panel section-stack">
        <div className="section-heading-row">
          <h2>Summary by year</h2>
          <p className="section-copy">
            {isYearFilterDisabled
              ? "Year selection is disabled while a trip filter is active. Clear the trip filter to compare years again."
              : "Tap a year to focus on it, or Total to see everything."}
          </p>
        </div>
        <YearSummaryGrid
          years={tripScopedYears}
          activeYear={activeYear}
          onSelectYear={onSelectYear}
          disabled={isYearFilterDisabled}
          totals={dynamicSummary}
        />
      </section>

      {filteredYears.length === 0 ? (
        <div className="empty-state">
          <p>No data matches the selected trip and year.</p>
        </div>
      ) : null}

      {filteredYears.map((yearItem) => (
        <YearBlock key={yearItem.year} yearItem={yearItem} />
      ))}
    </>
  );
}
