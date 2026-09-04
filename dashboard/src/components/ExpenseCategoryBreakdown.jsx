import { expenseCategoryEntries } from "../lib/expenses.js";

export function ExpenseCategoryBreakdown({ categories, currency }) {
  return (
    <div className="expense-live-breakdown">
      {expenseCategoryEntries(categories, currency).map((entry) => (
        <div className="expense-breakdown-item" key={entry.key}>
          <span>{entry.label}</span>
          <strong>{entry.formattedValue}</strong>
        </div>
      ))}
    </div>
  );
}
