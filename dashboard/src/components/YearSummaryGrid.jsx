import { YearSummaryCard } from "./YearSummaryCard";

export function YearSummaryGrid({ years, activeYear, onSelectYear, disabled, totals }) {
  const maxDays = Math.max(...years.map((item) => item.totalVacationDays), 1);

  return (
    <div className="year-summary-grid">
      <YearSummaryCard
        label="Total"
        days={totals.totalVacationDays}
        tripCount={totals.totalTrips}
        cityCount={totals.uniqueCities?.length || 0}
        isActive={activeYear === "all"}
        disabled={disabled}
        onClick={() => onSelectYear("all")}
        barWidthPercent={100}
      />
      {years.map((yearItem) => (
        <YearSummaryCard
          key={yearItem.year}
          label={yearItem.year}
          days={yearItem.totalVacationDays}
          tripCount={yearItem.tripCount}
          cityCount={yearItem.cityCount}
          isActive={String(activeYear) === String(yearItem.year)}
          disabled={disabled}
          onClick={() => onSelectYear(yearItem.year)}
          barWidthPercent={Math.max((yearItem.totalVacationDays / maxDays) * 100, 8)}
        />
      ))}
    </div>
  );
}
