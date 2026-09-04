export function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </article>
  );
}
