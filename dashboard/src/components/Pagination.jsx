import { Icon } from "./Icon";

export function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled }) {
  if (total === 0) {
    return null;
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted-text">
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div className="pagination-controls">
        <button type="button" className="btn btn-ghost" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevronLeft" size={18} />
          <span>Previous</span>
        </button>
        <span className="muted-text num" aria-live="polite">
          {page} / {totalPages}
        </span>
        <button type="button" className="btn btn-ghost" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <span>Next</span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </nav>
  );
}
