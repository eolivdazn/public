import { StatCard } from "./StatCard";
import { FinanceList } from "./FinanceList";
import { ExpenseAccordion } from "./ExpenseAccordion";
import { formatCurrency } from "../lib/format.js";
import { expenseCategoryEntries } from "../lib/expenses.js";
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
  const financialOverviewItems = expenseCategoryEntries(dynamicSummary.expenseCategories, dynamicSummary.expenseCurrency).map(
    (entry) => ({ key: entry.key, label: entry.label, value: entry.formattedValue })
  );

  const overallTotalsItems = [
    { key: "vacationDays", label: "Vacation days", value: dynamicSummary.totalVacationDays },
    { key: "trips", label: "Trips", value: dynamicSummary.totalTrips },
    { key: "tripFilter", label: "Trip filter", value: activeTripLabel },
    { key: "trackedSpend", label: "Tracked spend", value: formatCurrency(dynamicSummary.totalTrackedSpend || 0, dynamicSummary.expenseCurrency) },
    {
      key: "perPersonSpend",
      label: "Per person spend",
      value: formatCurrency(dynamicSummary.totalPerPersonSpend || 0, dynamicSummary.expenseCurrency)
    },
    { key: "partySize", label: "Party size", value: partySizeLabel(dynamicSummary.partySizes) },
    { key: "costPerDay", label: "Cost per day", value: formatCurrency(dynamicSummary.averageSpendPerDay || 0, dynamicSummary.expenseCurrency) }
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

      <section className="stats-grid">
        <StatCard
          label={activeYear === "all" ? "Tracked spend" : `Spend in ${activeYear}`}
          value={formatCurrency(dynamicSummary.totalTrackedSpend || 0, dynamicSummary.expenseCurrency)}
          hint={
            dynamicSummary.trackedTripCount > 0
              ? `${dynamicSummary.trackedTripCount} trip${dynamicSummary.trackedTripCount === 1 ? "" : "s"} with shared costs`
              : "No costs added yet"
          }
        />
        <StatCard
          label="Per person spend"
          value={formatCurrency(dynamicSummary.totalPerPersonSpend || 0, dynamicSummary.expenseCurrency)}
          hint={partySizeLabel(dynamicSummary.partySizes)}
        />
        <StatCard
          label="Average per trip"
          value={formatCurrency(dynamicSummary.averageSpendPerTrip || 0, dynamicSummary.expenseCurrency)}
          hint="Group total across tracked trips"
        />
        <StatCard
          label="Average per day"
          value={formatCurrency(dynamicSummary.averageSpendPerDay || 0, dynamicSummary.expenseCurrency)}
          hint="Group cost divided by vacation days"
        />
      </section>

      <section className="year-grid finance-grid">
        <article className="panel">
          <h3>Financial overview</h3>
          <FinanceList items={financialOverviewItems} />
        </article>

        <article className="panel">
          <h3>{activeYear === "all" ? "Overall totals" : `Totals for ${activeYear}`}</h3>
          <FinanceList items={overallTotalsItems} compact />
        </article>
      </section>
    </>
  );
}
