import { useEffect, useState } from "react";
import { AuditEntryRow } from "./AuditEntryRow";
import { fetchAuditEntries } from "../lib/api.js";

const PAGE_SIZE = 10;

export function AuditView() {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetchAuditEntries({ page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (active) {
          setEntries(result.entries);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setEntries([]);
          setTotal(0);
          setTotalPages(1);
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
  }, [page]);

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

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

      {!error && total > 0 ? (
        <div className="audit-pagination">
          <span className="expense-muted">
            Showing {rangeStart}–{rangeEnd} of {total}
          </span>
          <div className="audit-pagination-controls">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <span className="expense-muted">
              Page {page} of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
