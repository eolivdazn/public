import { useEffect, useState } from "react";
import { AuditEntryRow } from "./AuditEntryRow";
import { fetchAuditEntries } from "../lib/api.js";

export function AuditView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetchAuditEntries()
      .then((result) => {
        if (active) {
          setEntries(result);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setEntries([]);
          setError(fetchError.message || "Unable to load audit history.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="panel audit-view">
      <div className="section-heading-row">
        <div>
          <h2>Audit history</h2>
          <p className="section-copy">Most recent expense create/delete actions first.</p>
        </div>
        {loading ? <span className="expense-muted">Refreshing...</span> : null}
      </div>

      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error && entries.length === 0 ? <p className="status">No audit entries recorded yet.</p> : null}

      {!loading && !error && entries.length > 0 ? (
        <ul className="audit-entry-list">
          {entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}
