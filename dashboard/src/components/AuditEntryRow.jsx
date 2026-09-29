import { formatAuditTimestamp } from "../lib/format.js";

const ACTION_LABELS = {
  create: "Created",
  update: "Updated",
  delete: "Deleted"
};

export function AuditEntryRow({ entry }) {
  return (
    <li className="audit-entry">
      <div className="audit-entry-main">
        <span className={`badge badge-${entry.action}`}>{ACTION_LABELS[entry.action] || entry.action}</span>
        <span className="audit-entry-trip">{entry.tripSlug}</span>
        <span className="muted-text audit-entry-id">expense {entry.expenseId}</span>
      </div>
      <div className="audit-entry-meta">
        <span>{entry.actor?.userDetails || "Unknown user"}</span>
        <time dateTime={entry.at}>{formatAuditTimestamp(entry.at)}</time>
      </div>
    </li>
  );
}
