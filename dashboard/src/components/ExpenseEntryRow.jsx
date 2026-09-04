import { formatCurrency } from "../lib/format.js";
import { StarRating } from "./StarRating";

export function ExpenseEntryRow({ entry, currencyFallback, deleting, editing, onDelete, onEdit }) {
  return (
    <li className={`expense-entry${editing ? " is-editing" : ""}`}>
      <div>
        <strong>{entry.category}</strong>
        <span>{entry.date}</span>
        {entry.description ? <p>{entry.description}</p> : null}
        {entry.createdBy?.userDetails ? <span className="expense-muted">added by {entry.createdBy.userDetails}</span> : null}
        {entry.rating ? <StarRating value={entry.rating} disabled /> : null}
        {entry.photos && entry.photos.length > 0 ? (
          <div className="expense-photo-gallery expense-photo-gallery-readonly">
            {entry.photos.map((photo, index) =>
              photo.url ? (
                <a href={photo.url} target="_blank" rel="noreferrer" key={photo.blobName || index}>
                  <img src={photo.url} alt="Receipt" className="expense-entry-receipt-thumb" />
                </a>
              ) : null
            )}
          </div>
        ) : null}
        {entry.location ? (
          <a
            className="expense-photo-location-link"
            href={`https://www.google.com/maps?q=${entry.location.latitude},${entry.location.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            📍 Map
          </a>
        ) : null}
      </div>
      <div className="expense-entry-actions">
        <strong>{formatCurrency(entry.amount, entry.currency || currencyFallback)}</strong>
        <div className="expense-entry-buttons">
          <button
            type="button"
            className="expense-entry-edit"
            disabled={deleting}
            onClick={() => onEdit(entry)}
            aria-label={`Edit expense: ${entry.category} on ${entry.date}`}
          >
            {editing ? "Editing..." : "Edit"}
          </button>
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
      </div>
    </li>
  );
}
