import { SegmentedControl } from "./SegmentedControl";

const VIEW_OPTIONS = [
  { value: "finance", label: "Finance" },
  { value: "summary", label: "Summary by year" }
];

export function Toolbar({
  activeView,
  onChangeView,
  trips,
  activeTrip,
  onChangeTrip,
  years,
  activeYear,
  onChangeYear,
  isYearFilterDisabled
}) {
  const yearOptions = [{ value: "all", label: "Total" }, ...years.map((yearItem) => ({ value: yearItem.year, label: yearItem.year }))];

  return (
    <section className="toolbar panel">
      <div className="toolbar-row">
        <div>
          <label className="field-label" htmlFor="page-switch">
            View
          </label>
          <SegmentedControl id="page-switch" options={VIEW_OPTIONS} value={activeView} onChange={onChangeView} />
        </div>

        <div className="trip-filter-block">
          <label className="field-label" htmlFor="trip-filter">
            Trip
          </label>
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

      {activeView === "summary" ? (
        <div className="toolbar-row">
          <div>
            <label className="field-label" htmlFor="year-filter">
              Year
            </label>
            <SegmentedControl
              id="year-filter"
              options={yearOptions}
              value={activeYear}
              onChange={onChangeYear}
              disabled={isYearFilterDisabled}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
