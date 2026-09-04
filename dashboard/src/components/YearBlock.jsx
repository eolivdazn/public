import { FinanceList } from "./FinanceList";
import { TripsTable } from "./TripsTable";
import { formatCurrency } from "../lib/format.js";
import { expenseCategoryEntries } from "../lib/expenses.js";
import { partySizeLabel } from "../lib/yearSummary.js";

export function YearBlock({ yearItem }) {
  const financeItems = [
    { key: "totalSpend", label: "Total spend", value: formatCurrency(yearItem.totalTrackedSpend || 0, yearItem.expenseCurrency) },
    { key: "perPerson", label: "Per person", value: formatCurrency(yearItem.totalPerPersonSpend || 0, yearItem.expenseCurrency) },
    { key: "partySize", label: "Party size", value: partySizeLabel(yearItem.partySizes) },
    ...expenseCategoryEntries(yearItem.expenseCategories, yearItem.expenseCurrency).map((entry) => ({
      key: entry.key,
      label: entry.label,
      value: entry.formattedValue
    }))
  ];

  return (
    <section className="year-block">
      <div className="year-header">
        <div>
          <h2>{yearItem.year}</h2>
          <p>
            {yearItem.totalVacationDays} vacation days · {yearItem.tripCount} trips
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

        <article className="panel">
          <h3>Financials</h3>
          <FinanceList items={financeItems} compact />
        </article>
      </div>

      <article className="panel">
        <h3>Trips in {yearItem.year}</h3>
        <TripsTable trips={yearItem.trips} year={yearItem.year} fallbackCurrency={yearItem.expenseCurrency} />
      </article>
    </section>
  );
}
