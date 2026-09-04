import { formatAuditTimestamp } from "../lib/format.js";

const ACTION_LABELS = {
  create: "Created",
  update: "Updated",
  delete: "Deleted"
};

export function AuditEntryRow({ entry }) {
  return (
    <li className="audit-entry">
      <div>
        <strong className={`audit-action audit-action-${entry.action}`}>{ACTION_LABELS[entry.action] || entry.action}</strong>
        <span className="expense-muted">{entry.tripSlug}</span>
        <span className="expense-muted">expense {entry.expenseId}</span>
      </div>
      <div className="audit-entry-meta">
        <span>{entry.actor?.userDetails || "Unknown user"}</span>
        <time dateTime={entry.at}>{formatAuditTimestamp(entry.at)}</time>
      </div>
    </li>
  );
}
