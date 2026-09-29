import { expenseCategoryEntries } from "../lib/expenses.js";

// Proportion of spend per category. Values are always printed, so the bar is never the only signal.
export function CategoryBars({ categories, currency }) {
  const entries = expenseCategoryEntries(categories, currency);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <ul className="category-bars">
      {entries.map((entry) => {
        const share = total > 0 ? Math.round((entry.value / total) * 100) : 0;
        return (
          <li key={entry.key} className={entry.value === 0 ? "is-empty" : ""}>
            <div className="category-bars-row">
              <span>{entry.label}</span>
              <strong className="num">{entry.formattedValue}</strong>
            </div>
            <div className="category-bars-track" aria-hidden="true">
              <span className={`category-fill category-${entry.key}`} style={{ width: `${share}%` }} />
            </div>
            <span className="category-bars-share">{total > 0 ? `${share}% of spend` : "No spend yet"}</span>
          </li>
        );
      })}
    </ul>
  );
}
