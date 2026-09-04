export function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled }) {
  if (total === 0) {
    return null;
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="expense-muted">
        Showing {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="pagination-controls">
        <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span className="expense-muted">
          Page {page} of {totalPages}
        </span>
        <button type="button" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
