export function YearSummaryCard({ label, days, tripCount, cityCount, isActive, disabled, onClick, barWidthPercent }) {
  return (
    <button
      className={`year-summary-card${isActive ? " is-active" : ""}`}
      type="button"
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="year-summary-top">
        <strong>{label}</strong>
        <span className="num">{days} days</span>
      </span>
      <span className="year-summary-bar" aria-hidden="true">
        <span style={{ width: `${barWidthPercent}%` }} />
      </span>
      <span className="year-summary-meta">
        {tripCount} trips · {cityCount} cities
      </span>
    </button>
  );
}
