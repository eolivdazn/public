import { formatCurrency } from "../lib/format.js";
import { EXPENSE_LABELS } from "../lib/expenses.js";
import { StarRating } from "./StarRating";
import { Icon } from "./Icon";

export function ExpenseEntryRow({ entry, currencyFallback, deleting, editing, onDelete, onEdit }) {
  return (
    <li className={`expense-entry${editing ? " is-editing" : ""}`}>
      <div className="expense-entry-body">
        <div className="expense-entry-top">
          <span className={`badge badge-category category-${entry.category}`}>{EXPENSE_LABELS[entry.category] || entry.category}</span>
          <strong className="expense-entry-amount num">{formatCurrency(entry.amount, entry.currency || currencyFallback)}</strong>
        </div>
        <span className="expense-entry-date">{entry.date}</span>
        {entry.description ? <p className="expense-entry-description">{entry.description}</p> : null}
        {entry.rating ? <StarRating value={entry.rating} disabled /> : null}
        {entry.photos && entry.photos.length > 0 ? (
          <div className="expense-photo-gallery expense-photo-gallery-readonly">
            {entry.photos.map((photo, index) =>
              photo.url ? (
                <a href={photo.url} target="_blank" rel="noreferrer" key={photo.blobName || index}>
                  <img src={photo.url} alt={`Photo ${index + 1} for ${entry.category} on ${entry.date}`} className="expense-entry-receipt-thumb" loading="lazy" width="56" height="56" />
                </a>
              ) : null
            )}
          </div>
        ) : null}
        <div className="expense-entry-footer">
          {entry.createdBy?.userDetails ? <span className="muted-text">added by {entry.createdBy.userDetails}</span> : null}
          {entry.location ? (
            <a
              className="expense-photo-location-link"
              href={`https://www.google.com/maps?q=${entry.location.latitude},${entry.location.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="mapPin" size={16} />
              Map
            </a>
          ) : null}
        </div>
      </div>
      <div className="expense-entry-buttons">
        <button
          type="button"
          className="btn btn-ghost expense-entry-edit"
          disabled={deleting}
          onClick={() => onEdit(entry)}
          aria-label={`Edit expense: ${entry.category} on ${entry.date}`}
        >
          <Icon name="pencil" size={16} />
          {editing ? "Editing..." : "Edit"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-danger expense-entry-delete"
          disabled={deleting}
          onClick={() => onDelete(entry)}
          aria-label={`Delete expense: ${entry.category} on ${entry.date}`}
        >
          <Icon name="trash" size={16} />
          {deleting ? "Removing..." : "Remove"}
        </button>
      </div>
    </li>
  );
}
