import { StatCard } from "./StatCard";
import { FinanceList } from "./FinanceList";
import { CategoryBars } from "./CategoryBars";
import { ExpenseAccordion } from "./ExpenseAccordion";
import { formatCurrency } from "../lib/format.js";
import { partySizeLabel } from "../lib/yearSummary.js";

export function FinanceView({
  trips,
  selectedExpenseTripSlug,
  onChangeTripSlug,
  tripSelectDisabled,
  selectedExpenseTrip,
  snapshot,
  entries,
  liveLoading,
  liveError,
  addLiveEntry,
  updateLiveEntry,
  removeLiveEntry,
  dynamicSummary,
  activeYear,
  activeTripLabel
}) {
  const currency = dynamicSummary.expenseCurrency;

  const overallTotalsItems = [
    { key: "vacationDays", label: "Vacation days", value: dynamicSummary.totalVacationDays },
    { key: "trips", label: "Trips", value: dynamicSummary.totalTrips },
    { key: "tripFilter", label: "Trip filter", value: activeTripLabel },
    { key: "trackedSpend", label: "Tracked spend", value: formatCurrency(dynamicSummary.totalTrackedSpend || 0, currency) },
    { key: "perPersonSpend", label: "Per person spend", value: formatCurrency(dynamicSummary.totalPerPersonSpend || 0, currency) },
    { key: "partySize", label: "Party size", value: partySizeLabel(dynamicSummary.partySizes) },
    { key: "costPerDay", label: "Cost per day", value: formatCurrency(dynamicSummary.averageSpendPerDay || 0, currency) }
  ];

  return (
    <>
      <ExpenseAccordion
        trips={trips}
        selectedExpenseTripSlug={selectedExpenseTripSlug}
        onChangeTripSlug={onChangeTripSlug}
        tripSelectDisabled={tripSelectDisabled}
        selectedExpenseTrip={selectedExpenseTrip}
        snapshot={snapshot}
        entries={entries}
        liveLoading={liveLoading}
        liveError={liveError}
        addLiveEntry={addLiveEntry}
        updateLiveEntry={updateLiveEntry}
        removeLiveEntry={removeLiveEntry}
      />

      <section className="stats-grid" aria-label="Spend at a glance">
        <StatCard
          icon="wallet"
          label={activeYear === "all" ? "Tracked spend" : `Spend in ${activeYear}`}
          value={formatCurrency(dynamicSummary.totalTrackedSpend || 0, currency)}
          hint={
            dynamicSummary.trackedTripCount > 0
              ? `${dynamicSummary.trackedTripCount} trip${dynamicSummary.trackedTripCount === 1 ? "" : "s"} with shared costs`
              : "No costs added yet"
          }
        />
        <StatCard
          icon="users"
          label="Per person"
          value={formatCurrency(dynamicSummary.totalPerPersonSpend || 0, currency)}
          hint={partySizeLabel(dynamicSummary.partySizes)}
        />
        <StatCard
          icon="map"
          label="Avg per trip"
          value={formatCurrency(dynamicSummary.averageSpendPerTrip || 0, currency)}
          hint="Group total across tracked trips"
        />
        <StatCard
          icon="calendar"
          label="Avg per day"
          value={formatCurrency(dynamicSummary.averageSpendPerDay || 0, currency)}
          hint="Group cost ÷ vacation days"
        />
      </section>

      <section className="two-col">
        <article className="panel">
          <h2 className="panel-title">Where the money went</h2>
          <CategoryBars categories={dynamicSummary.expenseCategories} currency={currency} />
        </article>

        <article className="panel">
          <h2 className="panel-title">{activeYear === "all" ? "Overall totals" : `Totals for ${activeYear}`}</h2>
          <FinanceList items={overallTotalsItems} compact />
        </article>
      </section>
    </>
  );
}
