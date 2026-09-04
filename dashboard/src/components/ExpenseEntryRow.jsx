import { formatCurrency } from "../lib/format.js";

export function ExpenseEntryRow({ entry, currencyFallback, deleting, onDelete }) {
  return (
    <li className="expense-entry">
      <div>
        <strong>{entry.category}</strong>
        <span>{entry.date}</span>
        {entry.description ? <p>{entry.description}</p> : null}
        {entry.createdBy?.userDetails ? <span className="expense-muted">added by {entry.createdBy.userDetails}</span> : null}
      </div>
      <div className="expense-entry-actions">
        <strong>{formatCurrency(entry.amount, entry.currency || currencyFallback)}</strong>
        <button
          type="button"
          className="expense-entry-delete"
          disabled={deleting}
          onClick={() => onDelete(entry)}
          aria-label={`Delete expense: ${entry.category} on ${entry.date}`}
        >
          {deleting ? "Removing..." : "Remove"}
        </button>
      </div>
    </li>
  );
}
