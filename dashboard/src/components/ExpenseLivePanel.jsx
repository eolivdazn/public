import { useState } from "react";
import { FinanceList } from "./FinanceList";
import { ExpenseCategoryBreakdown } from "./ExpenseCategoryBreakdown";
import { ExpenseEntryRow } from "./ExpenseEntryRow";
import { formatCurrency } from "../lib/format.js";

export function ExpenseLivePanel({ selectedExpenseTrip, snapshot, loading, error, entries, onDeleteEntry }) {
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(entry) {
    setDeletingId(entry.id);
    await onDeleteEntry(entry);
    setDeletingId(null);
  }

  const summaryItems = snapshot
    ? [
        { key: "static", label: "Static planned", value: formatCurrency(snapshot.staticTotal, snapshot.baseCurrency) },
        { key: "live", label: "Live added", value: formatCurrency(snapshot.liveTotal, snapshot.baseCurrency) },
        { key: "combined", label: "Combined total", value: formatCurrency(snapshot.combinedTotal, snapshot.baseCurrency) },
        { key: "perPerson", label: "Per person", value: formatCurrency(snapshot.combinedPerPerson, snapshot.baseCurrency) },
        { key: "count", label: "Live entries", value: snapshot.liveCount }
      ]
    : [];

  return (
    <article className="panel expense-live-panel">
      <div className="section-heading-row">
        <div>
          <h2>Live trip expenses</h2>
          <p className="section-copy">
            {selectedExpenseTrip ? `Tracking ${selectedExpenseTrip.title}.` : "Pick a trip to load live expenses."}
          </p>
        </div>
      </div>

      {snapshot ? (
        <>
          <FinanceList items={summaryItems} compact className="expense-summary-list" />

          <ExpenseCategoryBreakdown categories={snapshot.combinedCategories} currency={snapshot.baseCurrency} />

          <div className="expense-entries-header">
            <h3>Recent entries</h3>
            {loading ? <span className="expense-muted">Refreshing...</span> : null}
          </div>

          {error ? <p className="status error">{error}</p> : null}

          {!loading && !error && entries.length === 0 ? <p className="status">No live expenses recorded yet.</p> : null}

          {!loading && !error && entries.length > 0 ? (
            <ul className="expense-entry-list">
              {entries.map((entry) => (
                <ExpenseEntryRow
                  key={entry.id}
                  entry={entry}
                  currencyFallback={snapshot.baseCurrency}
                  deleting={deletingId === entry.id}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="status">Select a trip to view live expense totals.</p>
      )}
    </article>
  );
}
