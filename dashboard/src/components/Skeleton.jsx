export function SkeletonRows({ count = 3 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Loading dashboard data">
      <div className="skeleton skeleton-block" />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((index) => (
          <div className="skeleton skeleton-stat" key={index} />
        ))}
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
