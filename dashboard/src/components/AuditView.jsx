import { useEffect, useState } from "react";
import { AuditEntryRow } from "./AuditEntryRow";
import { Pagination } from "./Pagination";
import { SkeletonRows } from "./Skeleton";
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

  return (
    <article className="panel audit-view" aria-busy={loading}>
      <div className="section-heading-row">
        <h2>Audit history</h2>
        <p className="section-copy">Most recent expense changes first.</p>
      </div>

      {error ? (
        <p className="status error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && entries.length === 0 ? <SkeletonRows count={4} /> : null}

      {!loading && !error && entries.length === 0 ? (
        <div className="empty-state">
          <p>No audit entries recorded yet.</p>
        </div>
      ) : null}

      {!error && entries.length > 0 ? (
        <ul className={`audit-entry-list${loading ? " is-refreshing" : ""}`}>
          {entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : null}

      {!error ? (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} />
      ) : null}
    </article>
  );
}
