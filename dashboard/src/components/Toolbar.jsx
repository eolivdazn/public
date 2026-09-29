import { SegmentedControl } from "./SegmentedControl";

export function Toolbar({ activeView, trips, activeTrip, onChangeTrip, years, activeYear, onChangeYear, isYearFilterDisabled }) {
  const yearOptions = [{ value: "all", label: "Total" }, ...years.map((yearItem) => ({ value: yearItem.year, label: yearItem.year }))];
  const showYearFilter = activeView === "summary";
  const showTripFilter = activeView !== "audit";

  if (!showTripFilter) {
    return null;
  }

  return (
    <section className="toolbar" aria-label="Filters">
      <div className="toolbar-field">
        <label className="field-label" htmlFor="trip-filter">
          Trip
        </label>
        <div className="select-wrap">
          <select id="trip-filter" value={activeTrip} onChange={(event) => onChangeTrip(event.target.value)}>
            <option value="all">All trips</option>
            {trips.map((trip) => (
              <option key={trip.slug} value={trip.slug}>
                {trip.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showYearFilter ? (
        <div className="toolbar-field">
          <span className="field-label" id="year-filter-label">
            Year
          </span>
          <SegmentedControl
            id="year-filter"
            labelledBy="year-filter-label"
            options={yearOptions}
            value={activeYear}
            onChange={onChangeYear}
            disabled={isYearFilterDisabled}
          />
          {isYearFilterDisabled ? <p className="field-hint">Clear the trip filter to compare years.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
