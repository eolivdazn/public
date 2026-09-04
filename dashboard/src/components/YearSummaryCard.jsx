export function YearSummaryCard({ label, days, tripCount, cityCount, isActive, disabled, onClick, barWidthPercent }) {
  return (
    <button
      className={`year-summary-card${isActive ? " is-active" : ""}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <div className="year-summary-top">
        <strong>{label}</strong>
        <span>{days} days</span>
      </div>
      <div className="year-summary-bar">
        <span style={{ width: `${barWidthPercent}%` }} />
      </div>
      <p>
        {tripCount} trips · {cityCount} cities
      </p>
    </button>
  );
}
