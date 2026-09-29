export function FinanceList({ items, compact, className }) {
  const classes = ["finance-list", compact ? "compact" : null, className].filter(Boolean).join(" ");

  return (
    <dl className={classes}>
      {items.map((item) => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd className="num">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
