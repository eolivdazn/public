import { formatAuditTimestamp } from "../lib/format.js";

export function AuditEntryRow({ entry }) {
  return (
    <li className="audit-entry">
      <div>
        <strong className={`audit-action audit-action-${entry.action}`}>
          {entry.action === "create" ? "Created" : "Deleted"}
        </strong>
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
