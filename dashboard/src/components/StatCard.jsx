import { Icon } from "./Icon";

export function StatCard({ label, value, hint, icon }) {
  return (
    <article className="stat-card">
      <p className="stat-label">
        {icon ? <Icon name={icon} size={16} /> : null}
        <span>{label}</span>
      </p>
      <p className="stat-value">{value}</p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </article>
  );
}
